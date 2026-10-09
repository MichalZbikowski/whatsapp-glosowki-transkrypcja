// Offscreen document: dekodowanie audio + Whisper (Transformers.js) na WebGPU z fallbackiem na WASM.
import { pipeline, env } from '@huggingface/transformers';
import { b64ToBytes, getSettings } from './shared.js';

const MODEL = 'onnx-community/whisper-large-v3-turbo';
const SR = 16000;

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('ort/');
env.backends.onnx.wasm.numThreads = 1;

let asrPromise = null;
let asrKey = '';
let currentJob = null;

const send = (m) => chrome.runtime.sendMessage({ target: 'background', ...m }).catch(() => {});

// Heartbeat – utrzymuje service worker przy życiu podczas długich transkrypcji.
setInterval(() => { if (currentJob) send({ type: 'heartbeat', jobId: currentJob }); }, 10000);

async function pickDevice() {
  try {
    if (navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    }
  } catch { /* brak WebGPU */ }
  return 'wasm';
}

function dtypeFor(device, encoderDtype) {
  return device === 'webgpu'
    ? { encoder_model: encoderDtype || 'fp16', decoder_model_merged: 'q4' }
    : { encoder_model: 'q4', decoder_model_merged: 'q4' };
}

async function loadAsr(jobId, settings) {
  const preferred = await pickDevice();
  const key = `${preferred}|${settings.encoderDtype}`;
  if (asrPromise && asrKey === key) return asrPromise;
  asrKey = key;
  asrPromise = (async () => {
    const files = new Map();
    const cb = (p) => {
      if (p.status === 'progress' && p.total) {
        files.set(p.file, { loaded: p.loaded, total: p.total });
        let l = 0; let t = 0;
        for (const f of files.values()) { l += f.loaded; t += f.total; }
        const mb = (l / 1048576).toFixed(0);
        const tb = (t / 1048576).toFixed(0);
        if (jobId) send({ type: 'progress', jobId, label: `Pobieranie modelu (tylko za pierwszym razem)… ${mb}/${tb} MB`, pct: t ? (l / t) * 100 : 0 });
      }
    };
    const attempts = preferred === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
    let lastErr;
    for (const device of attempts) {
      try {
        const asr = await pipeline('automatic-speech-recognition', MODEL, {
          device, dtype: dtypeFor(device, settings.encoderDtype), progress_callback: cb,
        });
        asr.__device = device;
        return asr;
      } catch (e) {
        lastErr = e;
        console.warn('Ładowanie modelu nie powiodło się na', device, e);
        if (device === 'webgpu' && jobId) send({ type: 'progress', jobId, label: 'WebGPU niedostępne – przełączam na wolniejszy tryb CPU (WASM)…', pct: 0 });
      }
    }
    throw lastErr;
  })();
  asrPromise.catch(() => { asrPromise = null; });
  return asrPromise;
}

async function decode(bytes) {
  const ctx = new OfflineAudioContext(1, SR, SR);
  let buf;
  try {
    buf = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  } catch {
    throw new Error('Nie udało się zdekodować pliku audio (nieobsługiwany format?).');
  }
  const n = buf.length;
  const out = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return out;
}

// Dzieli długie nagranie na segmenty (~2 min) w miejscach największej ciszy.
function splitSegments(audio, target = 120 * SR, window = 8 * SR) {
  if (audio.length <= target + window) return [audio];
  const out = [];
  let start = 0;
  const hop = Math.floor(0.05 * SR);
  while (audio.length - start > target + window) {
    let best = start + target;
    let bestE = Infinity;
    for (let c = start + target - window; c < start + target + window; c += hop) {
      let e = 0;
      for (let i = c; i < c + hop; i++) e += audio[i] * audio[i];
      if (e < bestE) { bestE = e; best = c + (hop >> 1); }
    }
    out.push(audio.subarray(start, best));
    start = best;
  }
  out.push(audio.subarray(start));
  return out;
}

async function run(m) {
  const jobId = m.jobId;
  currentJob = jobId;
  try {
    send({ type: 'progress', jobId, label: 'Dekodowanie audio…', pct: 1 });
    const audio = await decode(b64ToBytes(m.b64));
    if (audio.length < SR * 0.3) throw new Error('Nagranie jest puste lub zbyt krótkie.');
    const tl = performance.now();
    const asr = await loadAsr(jobId, m.settings);
    const loadSeconds = (performance.now() - tl) / 1000;
    const segs = splitSegments(audio);
    const total = audio.length;
    let done = 0;
    const texts = [];
    const t0 = performance.now();
    for (let i = 0; i < segs.length; i++) {
      const pct = 5 + (done / total) * 94;
      send({ type: 'progress', jobId, label: `Transkrypcja (${asr.__device}) ${Math.round(pct)}%`, pct });
      const out = await asr(segs[i], {
        language: 'polish', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: false,
      });
      texts.push((out.text || '').trim());
      done += segs[i].length;
    }
    const secs = (performance.now() - t0) / 1000;
    send({
      type: 'result', jobId, text: texts.join(' ').replace(/\s+/g, ' ').trim(),
      stats: { loadSeconds, audioSeconds: total / SR, seconds: secs, device: asr.__device, segments: segs.length },
    });
  } catch (e) {
    console.error(e);
    send({ type: 'error', jobId, error: friendlyError(e) });
  } finally {
    currentJob = null;
  }
}

function friendlyError(e) {
  const msg = String((e && e.message) || e);
  if (/zdekodowa|puste/i.test(msg)) return msg;
  if (/fetch|network|Failed to load|download|Unauthorized|HTTP/i.test(msg)) {
    return `Model się nie pobrał (sprawdź internet i spróbuj ponownie): ${msg.slice(0, 160)}`;
  }
  if (/webgpu|gpu/i.test(msg)) return `Błąd WebGPU: ${msg.slice(0, 160)}. Spróbuj ponownie – rozszerzenie przełączy się na tryb CPU.`;
  return `Błąd transkrypcji lokalnej: ${msg.slice(0, 200)}`;
}

chrome.runtime.onMessage.addListener((m) => {
  if (m.target !== 'offscreen') return false;
  if (m.type === 'run') run(m);
  else if (m.type === 'warmup') loadAsr(null, m.settings).catch(() => {});
  return false;
});

// Model ładuje się od razu po utworzeniu dokumentu (rozgrzewka), zanim użytkownik kliknie „Transkrybuj”.
getSettings().then((s) => loadAsr(null, s)).catch(() => {});
