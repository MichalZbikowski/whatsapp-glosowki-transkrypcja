// Faza 1: rozszerzenie ładuje się w Brave bez błędów w konsoli.
import { launch } from '../scripts/launch.mjs';

const errors = [];
const { ctx, sw, extId } = await launch({ profile: './.tmp-profile-smoke' });
console.log('extension id:', extId);
sw.on('console', (m) => { if (m.type() === 'error') errors.push(`sw: ${m.text()}`); });

for (const page of ['options.html', 'popup.html', 'offscreen.html']) {
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${page}: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`${page} pageerror: ${e.message}`));
  await p.goto(`chrome-extension://${extId}/${page}`);
  await p.waitForTimeout(1500);
  console.log(page, 'title =', await p.title());
}
const gpu = await (await ctx.newPage()).evaluate(async () => !!(navigator.gpu && (await navigator.gpu.requestAdapter())));
console.log('WebGPU adapter:', gpu);
await ctx.close();
console.log(errors.length ? `BŁĘDY:\n${errors.join('\n')}` : 'OK: brak błędów w konsoli');
process.exit(errors.length ? 1 : 0);
