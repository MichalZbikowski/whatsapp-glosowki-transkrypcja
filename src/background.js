// Service worker: koordynuje kolejkę, cache i opcjonalny tryb Groq / korektę Claude Haiku.
import { getSettings, b64ToBytes } from './shared.js';

const OFFSCREEN_URL = 'offscreen.html';
const jobs = new Map(); // jobId -> { msgId, tabId, settings }
let queue = Promise.resolve();
let seq = 0;

async function ensureOffscreen() {
  const has = chrome.runtime.getContexts
    ? (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length > 0
    : false;
  if (has) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['WORKERS'],
    justification: 'Lokalna transkrypcja mowy modelem Whisper (WebGPU/WASM).',
  });
}

async function notify(job, payload) {
  const msg = { type: 'job-update', jobId: job.jobId, msgId: job.msgId, ...payload };
  if (job.tabId != null) {
    try { await chrome.tabs.sendMessage(job.tabId, msg); } catch { /* karta zamknięta */ }
  }
  try { await chrome.runtime.sendMessage(msg); } catch { /* brak odbiorców */ }
}

const progress = (job, label, pct) => notify(job, { state: 'progress', label, pct });

function describeHttpError(service, status, body) {
  if (status === 401 || status === 403) return `${service}: nieprawidłowy klucz API (HTTP ${status}). Sprawdź klucz w ustawieniach.`;
  if (status === 429) return `${service}: przekroczono limit zapytań (HTTP 429). Spróbuj za chwilę.`;
  if (status === 413) return `${service}: plik jest za duży dla API (HTTP 413).`;
  return `${service}: błąd HTTP ${status}. ${String(body || '').slice(0, 200)}`;
}

async function transcribeGroq(job, bytes, mime, settings) {
  if (!settings.groqKey) throw new Error('Brak klucza Groq. Wpisz go w ustawieniach rozszerzenia albo przełącz na tryb lokalny.');
  await progress(job, 'Wysyłam do Groq…', 30);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime || 'audio/ogg' }), 'audio.ogg');
  form.append('model', 'whisper-large-v3');
  form.append('language', 'pl');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  if (settings.vocab) form.append('prompt', `Rozmowa po polsku o programowaniu. Terminy: ${settings.vocab}.`);
  let res;
  try {
    res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${settings.groqKey}` }, body: form,
    });
  } catch {
    throw new Error('Groq: brak połączenia z internetem lub zablokowane zapytanie.');
  }
  if (!res.ok) throw new Error(describeHttpError('Groq', res.status, await res.text().catch(() => '')));
  const data = await res.json();
  return (data.text || '').trim();
}

async function callHaiku(settings, system, user, maxTokens) {
  if (!settings.anthropicKey) throw new Error('Brak klucza Anthropic (korekta/TL;DR). Wpisz go w ustawieniach albo wyłącz te opcje.');
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, system,
        messages: [{ role: 'user', content: user }],
      }),
    });
  } catch {
    throw new Error('Anthropic: brak połączenia z internetem.');
  }
  if (!res.ok) throw new Error(describeHttpError('Anthropic', res.status, await res.text().catch(() => '')));
  const data = await res.json();
  return (data.content || []).map((c) => c.text || '').join('').trim();
}

async function postProcess(job, text, settings) {
  let out = text;
  let tldr = '';
  if (settings.correct) {
    await progress(job, 'Korekta terminów (Claude Haiku)…', 95);
    out = await callHaiku(
      settings,
      'Poprawiasz transkrypcję polskiej wypowiedzi z angielskimi terminami programistycznymi. Popraw WYŁĄCZNIE pisownię terminów technicznych (np. słowa z listy). Nie zmieniaj treści, szyku, interpunkcji ani nie dodawaj nic od siebie. Zwróć tylko poprawiony tekst.',
      `Terminy: ${settings.vocab}\n\nTranskrypcja:\n${text}`,
      Math.max(1024, Math.ceil(text.length / 2)),
    );
  }
  if (settings.tldr) {
    await progress(job, 'Streszczenie (Claude Haiku)…', 98);
    tldr = await callHaiku(settings, 'Streszczasz po polsku wypowiedź w 2-4 krótkich punktach. Tylko treść streszczenia.', out, 600);
  }
  return { text: out, tldr };
}

async function finish(job, text, settings, stats) {
  let result = { text, tldr: '' };
  try {
    result = await postProcess(job, text, settings);
  } catch (e) {
    // transkrypcja się udała – pokaż ją, a błąd korekty zgłoś osobno
    await notify(job, { state: 'warn', warn: String(e.message || e) });
  }
  if (!job.noCache) await chrome.storage.local.set({ [`tr:${job.msgId}`]: { ...result, at: Date.now() } });
  await notify(job, { state: 'done', ...result, stats });
  jobs.delete(job.jobId);
}

async function fail(job, error) {
  await notify(job, { state: 'error', error });
  jobs.delete(job.jobId);
}

async function runJob(job, bytes, mime) {
  const settings = job.settings;
  try {
    if (settings.mode === 'groq') {
      const text = await transcribeGroq(job, bytes, mime, settings);
      if (!text) throw new Error('Groq zwrócił pusty tekst.');
      await finish(job, text, settings);
      return;
    }
    await ensureOffscreen();
    await progress(job, 'Uruchamiam model lokalny…', 1);
    // asynchronicznie: wynik wróci komunikatem z offscreen
    await new Promise((resolve) => { job.resolve = resolve; chrome.runtime.sendMessage({
      target: 'offscreen', type: 'run', jobId: job.jobId, mime,
      b64: job.b64, settings: { encoderDtype: settings.encoderDtype, vocab: settings.vocab },
    }).catch(async (e) => { await fail(job, `Nie udało się uruchomić modułu transkrypcji: ${e.message || e}`); resolve(); }); });
  } catch (e) {
    await fail(job, String(e.message || e));
  }
}

chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
  if (m.target === 'offscreen') return false;

  if (m.type === 'get-cached') {
    chrome.storage.local.get(`tr:${m.msgId}`).then((r) => sendResponse(r[`tr:${m.msgId}`] || null));
    return true;
  }

  if (m.type === 'warmup') {
    (async () => {
      const settings = await getSettings();
      if (settings.mode !== 'local') return;
      await ensureOffscreen();
    })();
    return false;
  }

  if (m.type === 'transcribe') {
    (async () => {
      const settings = await getSettings();
      const jobId = `j${Date.now()}_${++seq}`;
      const job = { jobId, msgId: m.msgId, tabId: sender.tab ? sender.tab.id : null, settings, noCache: !!m.noCache, b64: m.b64 };
      jobs.set(jobId, job);
      sendResponse({ jobId });
      const bytes = b64ToBytes(m.b64);
      // kolejka: jedna transkrypcja naraz
      queue = queue.then(() => runJob(job, bytes, m.mime)).catch(() => {});
    })();
    return true;
  }

  // Zdarzenia z offscreen
  if (m.target === 'background') {
    const job = jobs.get(m.jobId);
    if (!job) return false;
    if (m.type === 'progress') {
      progress(job, m.label, m.pct);
    } else if (m.type === 'result') {
      job.b64 = null;
      finish(job, m.text, job.settings, m.stats).finally(() => job.resolve && job.resolve());
    } else if (m.type === 'error') {
      fail(job, m.error).finally(() => job.resolve && job.resolve());
    }
    return false;
  }
  return false;
});
