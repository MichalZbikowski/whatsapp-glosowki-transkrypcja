// Faza 2: transkrypcja lokalna pliku przez popup (offscreen + Whisper). Użycie: node tests/pipeline.mjs [plik] [ref.txt]
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { launch } from '../scripts/launch.mjs';
import { wer, cer } from '../scripts/wer.js';

const file = process.argv[2] || 'test-audio/krotka.ogg';
const refFile = process.argv[3] || file.replace(/\.(ogg|opus)$/, '.ref.txt');
const timeoutMs = Number(process.env.TIMEOUT_MS || 40 * 60 * 1000);

const { ctx, extId } = await launch({ profile: './.tmp-profile-pipe', extra: process.env.EXTRA ? process.env.EXTRA.split(' ') : [] });
const errors = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`chrome-extension://${extId}/popup.html`);
const t0 = Date.now();
await page.setInputFiles('#file', file);

let last = '';
const deadline = Date.now() + timeoutMs;
let text = null;
while (Date.now() < deadline) {
  const status = await page.textContent('#status');
  const err = await page.textContent('#err');
  if (status !== last) { console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${status}`); last = status; }
  if (err) { console.log('BŁĄD:', err); break; }
  if (status === 'Gotowe') { text = await page.$$eval('#out p', (ps) => ps.map((p) => p.textContent).join(' ')); break; }
  await page.waitForTimeout(1000);
}
const secs = (Date.now() - t0) / 1000;
await ctx.close();

if (text == null) { console.log('NIEPOWODZENIE'); process.exit(1); }
console.log(`Czas: ${secs.toFixed(1)} s\nTekst: ${text}`);
if (existsSync(refFile)) {
  const ref = readFileSync(refFile, 'utf8');
  console.log(`WER=${(wer(ref, text) * 100).toFixed(1)}%  CER=${(cer(ref, text) * 100).toFixed(1)}%`);
}
if (errors.length) console.log('pageerrors:', errors);
appendFileSync('.tmp-last-transcript.txt', `\n### ${file}\n${text}\n`);
