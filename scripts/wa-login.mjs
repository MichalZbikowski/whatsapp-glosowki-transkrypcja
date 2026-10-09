// Otwiera web.whatsapp.com w Brave (profil .wa-profile) i czeka na zeskanowanie QR. Niczego nie klika.
import { writeFileSync, existsSync, rmSync } from 'node:fs';
import { launch } from './launch.mjs';

if (existsSync('.wa-logged-in')) rmSync('.wa-logged-in');
const { ctx } = await launch({ profile: './.wa-profile' });
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://web.whatsapp.com/');
console.log('Czekam na zalogowanie (zeskanuj kod QR)…');
// zalogowany = widoczny panel listy czatów
await page.waitForSelector('#pane-side', { timeout: 30 * 60 * 1000 });
console.log('Zalogowano. Daję 20 s na zapis sesji…');
await page.waitForTimeout(20000);
writeFileSync('.wa-logged-in', new Date().toISOString());
await ctx.close();
console.log('Gotowe – sesja zapisana w .wa-profile');
