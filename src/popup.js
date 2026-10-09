import { bytesToB64, paragraphs } from './shared.js';

const $ = (id) => document.getElementById(id);
let jobId = null;
let fullText = '';

function setProgress(label, pct) {
  $('status').textContent = label || '';
  $('bar').hidden = pct == null;
  if (pct != null) $('bar').firstElementChild.style.width = `${pct}%`;
}

chrome.runtime.onMessage.addListener((m) => {
  if (m.type !== 'job-update' || m.jobId !== jobId) return;
  if (m.state === 'progress') setProgress(m.label, m.pct);
  else if (m.state === 'warn') $('err').textContent = m.warn;
  else if (m.state === 'error') { setProgress('', null); $('err').textContent = m.error; }
  else if (m.state === 'done') {
    setProgress('Gotowe', null);
    fullText = m.text;
    $('out').textContent = '';
    if (m.tldr) { const t = document.createElement('p'); t.textContent = `TL;DR: ${m.tldr}`; $('out').append(t); }
    for (const p of paragraphs(m.text)) { const e = document.createElement('p'); e.textContent = p; $('out').append(e); }
    $('copy').hidden = false;
  }
});

$('file').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  $('err').textContent = '';
  $('out').textContent = '';
  $('copy').hidden = true;
  setProgress('Wczytuję plik…', 0);
  const bytes = new Uint8Array(await f.arrayBuffer());
  const res = await chrome.runtime.sendMessage({
    type: 'transcribe', msgId: `file:${f.name}:${f.size}`, mime: f.type, b64: bytesToB64(bytes), noCache: true,
  });
  if (res && res.error) { setProgress('', null); $('err').textContent = res.error; return; }
  jobId = res.jobId;
});

$('copy').addEventListener('click', () => navigator.clipboard.writeText(fullText));
$('opts').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('tab').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') }));
