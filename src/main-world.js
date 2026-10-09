// Świat MAIN: przechwytuje bloby audio WhatsAppa. Tylko odczyt – klika wyłącznie play/pauza.
import { findPlayButton, findPauseButton, MESSAGE_ROW_SELECTOR } from './selectors.js';

const TAG = 'WAT';
const blobs = new Map(); // url -> Blob
let waiter = null; // { resolve }
const mutedEls = new Set();

const origCreate = URL.createObjectURL.bind(URL);
URL.createObjectURL = function (obj) {
  const url = origCreate(obj);
  try {
    if (obj instanceof Blob && (obj.type || '').startsWith('audio/')) {
      blobs.set(url, obj);
      if (waiter) waiter.resolve(obj);
    }
  } catch (e) { /* ignoruj */ }
  return url;
};

// Drugi tor: element audio z blobowym src (blob mógł powstać wcześniej).
const origPlay = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function (...args) {
  try {
    if (waiter) {
      this.muted = true;
      mutedEls.add(this);
      const src = this.currentSrc || this.src;
      if (src && src.startsWith('blob:')) {
        const known = blobs.get(src);
        if (known) waiter.resolve(known);
        else fetch(src).then((r) => r.blob()).then((b) => waiter && waiter.resolve(b)).catch(() => {});
      }
    }
  } catch (e) { /* ignoruj */ }
  return origPlay.apply(this, args);
};

function click(el) {
  el.click();
}

function findRow(msgId) {
  return [...document.querySelectorAll(MESSAGE_ROW_SELECTOR)].find((r) => r.getAttribute('data-id') === msgId);
}

function pauseIfPlaying(row) {
  const pause = row && findPauseButton(row);
  if (pause) click(pause);
}

async function capture(msgId) {
  const row = findRow(msgId);
  if (!row) throw new Error('Nie znaleziono wiadomości na stronie.');
  const play = findPlayButton(row);
  if (!play) throw new Error('Nie znaleziono przycisku odtwarzania w tej głosówce.');
  let timer;
  const got = new Promise((resolve, reject) => {
    waiter = { resolve };
    timer = setTimeout(() => reject(new Error('Nie udało się przechwycić audio (przekroczono czas oczekiwania).')), 20000);
  });
  click(play);
  try {
    return await got;
  } finally {
    clearTimeout(timer);
    waiter = null;
    pauseIfPlaying(findRow(msgId));
    setTimeout(() => {
      for (const el of mutedEls) {
        try { el.pause(); el.currentTime = 0; el.muted = false; } catch (e) { /* */ }
      }
      mutedEls.clear();
    }, 300);
  }
}

window.addEventListener('message', async (ev) => {
  if (ev.source !== window || !ev.data || ev.data.tag !== TAG || ev.data.type !== 'capture') return;
  const { msgId } = ev.data;
  try {
    const blob = await capture(msgId);
    const buf = await blob.arrayBuffer();
    window.postMessage({ tag: TAG, type: 'blob', msgId, mime: blob.type, buf }, '*', [buf]);
  } catch (e) {
    window.postMessage({ tag: TAG, type: 'capture-error', msgId, error: String(e.message || e) }, '*');
  }
});
