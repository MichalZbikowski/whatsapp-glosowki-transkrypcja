export const DEFAULT_VOCAB =
  'commit, pull request, merge, branch, deploy, Docker, Zabbix, Jira, endpoint, API, JSON, frontend, backend, bug, feature, review, repo, GitHub, Claude Code';

export const DEFAULT_SETTINGS = {
  mode: 'local', // 'local' | 'groq'
  groqKey: '',
  anthropicKey: '',
  vocab: DEFAULT_VOCAB,
  correct: false,
  tldr: false,
  encoderDtype: 'fp16', // koder przy WebGPU: fp16 | q4 | q4f16
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export function bytesToB64(bytes) {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  return btoa(s);
}

export function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Dzieli tekst na akapity (po ok. 3-4 zdania).
export function paragraphs(text) {
  const sentences = (text || '').trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
  const out = [];
  let cur = [];
  let len = 0;
  for (const s of sentences) {
    cur.push(s);
    len += s.length;
    if (cur.length >= 4 || len > 420) {
      out.push(cur.join(' '));
      cur = [];
      len = 0;
    }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}
