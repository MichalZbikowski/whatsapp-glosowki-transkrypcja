import { DEFAULT_SETTINGS, getSettings } from './shared.js';

const $ = (id) => document.getElementById(id);
const textKeys = ['mode', 'encoderDtype', 'groqKey', 'anthropicKey', 'vocab'];
const boolKeys = ['correct', 'tldr'];

function fill(s) {
  for (const k of textKeys) $(k).value = s[k];
  for (const k of boolKeys) $(k).checked = !!s[k];
}

fill(await getSettings());

$('save').addEventListener('click', async () => {
  const s = {};
  for (const k of textKeys) s[k] = $(k).value.trim();
  for (const k of boolKeys) s[k] = $(k).checked;
  await chrome.storage.local.set({ settings: s });
  $('saved').textContent = 'Zapisano';
  setTimeout(() => ($('saved').textContent = ''), 1500);
});

$('reset').addEventListener('click', async () => {
  const keep = await getSettings();
  const s = { ...DEFAULT_SETTINGS, groqKey: keep.groqKey, anthropicKey: keep.anthropicKey };
  await chrome.storage.local.set({ settings: s });
  fill(s);
});
