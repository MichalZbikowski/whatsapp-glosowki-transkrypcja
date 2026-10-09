// Test na prawdziwym WhatsApp Web, WYŁĄCZNIE testowy czat. Klika: wybór czatu, "Transkrybuj" (które samo robi play/pauza).
// Użycie: node tests/wa-e2e.mjs [indeks_głosówki|all]
import { mkdirSync } from 'node:fs';
import { launch } from '../scripts/launch.mjs';

const CHAT = 'Szymon Perlicki Praca';
const which = process.argv[2] || '0';
const { ctx, sw } = await launch({ profile: './.wa-profile' });
if (process.env.CLEAR) await sw.evaluate(async () => { const all = await chrome.storage.local.get(null); await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('tr:'))); });
if (process.env.DTYPE) await sw.evaluate(async (d) => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...(settings || {}), encoderDtype: d } }); }, process.env.DTYPE);
const errors = [];
const page = ctx.pages().find((p) => p.url().includes('whatsapp')) || ctx.pages()[0] || (await ctx.newPage());
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && /WAT|wat-|extension/i.test(m.text())) errors.push(m.text()); });
await page.goto('https://web.whatsapp.com/');
await page.waitForSelector('#pane-side', { timeout: 120000 });
await page.waitForTimeout(3000);
await page.locator(`#pane-side span[title="${CHAT}"]`).first().click();
await page.waitForTimeout(5000);

await page.waitForTimeout(Number(process.env.WARM_WAIT || 0) * 1000);
const rows = page.locator('[data-id]:has([data-icon="ptt-status"])');
const n = await rows.count();
const boxes = await page.locator('[data-id]:has([data-icon="ptt-status"]) > .wat-box').count();
console.log(`głosówek: ${n}, z przyciskiem Transkrybuj: ${boxes}`);
mkdirSync('docs/screenshots', { recursive: true });

const idx = which === 'all' ? [...Array(n).keys()] : [Number(which)];
let failed = 0;
for (const i of idx) {
  const row = rows.nth(i);
  await row.scrollIntoViewIfNeeded();
  const id = await row.getAttribute('data-id');
  const t0 = Date.now();
  await row.locator('.wat-btn').first().click();
  let last = '';
  let ok = false;
  while (Date.now() - t0 < 30 * 60 * 1000) {
    const status = (await row.locator('.wat-status').textContent().catch(() => '')) || '';
    const err = (await row.locator('.wat-err').textContent().catch(() => '')) || '';
    if (status !== last) { console.log(`  [#${i} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${status}`); last = status; }
    if (err) { console.log(`  BŁĄD #${i}: ${err}`); break; }
    if (/gotowe|pamięci/.test(status)) { ok = true; break; }
    await page.waitForTimeout(1500);
  }
  if (!ok) { failed++; continue; }
  const text = await row.locator('.wat-text p').allTextContents();
  console.log(`  #${i} (${id.slice(0, 6)}…): ${text.join(' ').length} znaków, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`  początek: ${text.join(' ').slice(0, 200)}`);
  await row.screenshot({ path: `docs/screenshots/wa-glosowka-${i}.png` });
}
console.log(errors.length ? `błędy strony: ${errors.join(' | ')}` : 'brak błędów strony');
await ctx.close();
process.exit(failed ? 1 : 0);
