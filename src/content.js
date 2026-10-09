// Isolated world: wykrywa głosówki, dodaje przycisk i wyświetla wynik. Nic nie wysyła w WhatsAppie.
import { findVoiceRows, messageId } from './selectors.js';
import { bytesToB64, paragraphs } from './shared.js';

const TAG = 'WAT';
const ui = new Map(); // msgId -> controller

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function makeUi(row, msgId) {
  const box = el('div', row.querySelector('[data-icon="tail-out"]') ? 'wat-box wat-out' : 'wat-box');
  box.setAttribute('data-wat-for', msgId);
  const head = el('div', 'wat-head');
  const btn = el('button', 'wat-btn', 'Transkrybuj');
  btn.type = 'button';
  const status = el('span', 'wat-status');
  head.append(btn, status);
  const bar = el('div', 'wat-bar');
  const barFill = el('i');
  bar.append(barFill);
  bar.hidden = true;
  const err = el('div', 'wat-err');
  err.hidden = true;
  const body = el('div', 'wat-text');
  box.append(head, bar, err, body);
  row.appendChild(box);

  const c = {
    box, btn, msgId,
    busy: false,
    setStatus(t, pct) {
      status.textContent = t || '';
      if (pct == null) bar.hidden = true;
      else { bar.hidden = false; barFill.style.width = `${Math.max(0, Math.min(100, pct))}%`; }
    },
    setError(t) { err.hidden = !t; err.textContent = t || ''; },
    showResult({ text, tldr, cached }) {
      body.textContent = '';
      for (const p of paragraphs(text)) body.append(el('p', null, p));
      const copy = el('button', 'wat-btn wat-copy', 'Kopiuj');
      copy.type = 'button';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(text); copy.textContent = 'Skopiowano'; }
        catch { copy.textContent = 'Nie udało się skopiować'; }
        setTimeout(() => (copy.textContent = 'Kopiuj'), 1500);
      });
      body.append(copy);
      if (tldr) {
        const d = el('details', 'wat-tldr');
        d.append(el('summary', null, 'TL;DR'), el('div', null, tldr));
        body.prepend(d);
      }
      c.setStatus(cached ? 'z pamięci podręcznej' : 'gotowe', null);
      btn.textContent = 'Transkrybuj ponownie';
      btn.disabled = false;
      c.busy = false;
    },
  };
  btn.addEventListener('click', () => start(c));
  return c;
}

async function start(c) {
  if (c.busy) return;
  c.busy = true;
  c.btn.disabled = true;
  c.setError('');
  const force = c.btn.textContent !== 'Transkrybuj';
  try {
    const cached = force ? null : await chrome.runtime.sendMessage({ type: 'get-cached', msgId: c.msgId });
    if (cached && cached.text) { c.showResult({ ...cached, cached: true }); return; }
    c.setStatus('Przechwytuję audio…', 0);
    const { buf, mime } = await captureAudio(c.msgId);
    c.setStatus('Wysyłam do transkrypcji…', 0);
    const res = await chrome.runtime.sendMessage({
      type: 'transcribe', msgId: c.msgId, mime, b64: bytesToB64(new Uint8Array(buf)), force,
    });
    if (res && res.error) throw new Error(res.error);
  } catch (e) {
    c.setStatus('', null);
    c.setError(String(e.message || e));
    c.btn.disabled = false;
    c.busy = false;
  }
}

function captureAudio(msgId) {
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const d = ev.data;
      if (ev.source !== window || !d || d.tag !== TAG || d.msgId !== msgId) return;
      if (d.type === 'blob') { cleanup(); resolve({ buf: d.buf, mime: d.mime }); }
      else if (d.type === 'capture-error') { cleanup(); reject(new Error(d.error)); }
    };
    const cleanup = () => window.removeEventListener('message', onMsg);
    window.addEventListener('message', onMsg);
    window.postMessage({ tag: TAG, type: 'capture', msgId }, '*');
  });
}

chrome.runtime.onMessage.addListener((m) => {
  if (m.type !== 'job-update') return;
  const c = ui.get(m.msgId);
  if (!c) return;
  if (m.state === 'progress') c.setStatus(m.label, m.pct);
  else if (m.state === 'done') c.showResult({ text: m.text, tldr: m.tldr });
  else if (m.state === 'error') {
    c.setStatus('', null);
    c.setError(m.error);
    c.btn.disabled = false;
    c.busy = false;
  }
});

let warmed = false;
function scan() {
  const found = findVoiceRows();
  if (found.length && !warmed) { warmed = true; chrome.runtime.sendMessage({ type: 'warmup' }).catch(() => {}); }
  for (const row of found) {
    const id = messageId(row);
    if (!id || row.querySelector(':scope > .wat-box')) continue;
    const old = ui.get(id);
    if (old) row.appendChild(old.box); // WhatsApp przerysował wiersz – przywróć nasze UI
    else ui.set(id, makeUi(row, id));
  }
}

let scheduled = false;
new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => { scheduled = false; scan(); }, 300);
}).observe(document.documentElement, { childList: true, subtree: true });
scan();
