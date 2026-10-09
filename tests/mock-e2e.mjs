// Test E2E na atrapie (bez logowania): przycisk przy każdej głosówce, poprawne przypisanie tekstu, tylko play/pauza.
import { readFileSync, mkdirSync } from 'node:fs';
import { launch } from '../scripts/launch.mjs';

const { ctx } = await launch({ profile: './.tmp-profile-pipe' });
const page = await ctx.newPage();
await page.route('https://web.whatsapp.com/mock', (r) => r.fulfill({ contentType: 'text/html', body: readFileSync('tests/mock-wa.html') }));
await page.route('https://web.whatsapp.com/mock-audio.ogg', (r) => r.fulfill({ contentType: 'audio/ogg', body: readFileSync('tests/fixtures/sample.ogg') }));
await page.goto('https://web.whatsapp.com/mock');
await page.waitForTimeout(1500);

const rows = page.locator('[data-id]:has([data-icon="ptt-status"])');
const n = await rows.count();
const boxes = await page.locator('[data-id] > .wat-box').count();
console.log(`głosówek: ${n}, przycisków: ${boxes}`);
if (n < 1 || n !== boxes) { console.log('NIE OK: przycisk nie przy każdej głosówce'); process.exit(1); }

const target = n > 1 ? 1 : 0;
const row = rows.nth(target);
await row.locator('.wat-btn').click();
const t0 = Date.now();
while (Date.now() - t0 < 15 * 60 * 1000) {
  const s = (await row.locator('.wat-status').textContent()) || '';
  const e = (await row.locator('.wat-err').textContent()) || '';
  if (e) { console.log('BŁĄD:', e); process.exit(1); }
  if (/gotowe|pamięci/.test(s)) break;
  await page.waitForTimeout(1000);
}
const text = (await row.locator('.wat-text p').allTextContents()).join(' ');
console.log('tekst:', text.slice(0, 120));
let ok = /commit|branch|pull request/i.test(text);
for (let i = 0; i < n; i++) {
  if (i === target) continue;
  const other = await rows.nth(i).locator('.wat-text p').count();
  if (other) { console.log(`NIE OK: tekst trafił do dymka ${i}`); ok = false; }
}
const clicks = await page.evaluate(() => window.__clicks);
console.log('kliknięte elementy:', JSON.stringify(clicks));
const forbidden = clicks.filter((c) => !/Odtwórz|Transkrybuj|Kopiuj|Pauz|wiadomość głosową/i.test(c));
if (forbidden.length) { console.log('NIE OK: nieoczekiwane kliknięcia', forbidden); ok = false; }
mkdirSync('docs/screenshots', { recursive: true });
await row.screenshot({ path: 'docs/screenshots/mock-glosowka.png' });
console.log(ok ? 'OK: atrapa przechodzi' : 'NIE OK');
await ctx.close();
process.exit(ok ? 0 : 1);
