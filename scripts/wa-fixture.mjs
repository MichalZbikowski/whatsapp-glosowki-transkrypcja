// Otwiera WYŁĄCZNIE testowy czat, zapisuje zanonimizowany HTML dymka głosówki. Nic nie wysyła ani nie klika poza wyborem czatu.
import { writeFileSync } from 'node:fs';
import { launch } from './launch.mjs';

const CHAT = 'Szymon Perlicki Praca';
const { ctx } = await launch({ profile: './.wa-profile' });
const page = ctx.pages().find((p) => p.url().includes('whatsapp')) || ctx.pages()[0] || (await ctx.newPage());
await page.goto('https://web.whatsapp.com/');
await page.waitForSelector('#pane-side', { timeout: 120000 });
await page.waitForTimeout(3000);

const chat = page.locator(`#pane-side span[title="${CHAT}"]`).first();
if (!(await chat.count())) {
  console.log('NIE MA czatu na liście (bez przewijania).');
  await ctx.close();
  process.exit(2);
}
await chat.click();
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const icons = [...document.querySelectorAll('[data-icon]')].map((e) => e.getAttribute('data-icon'));
  const counts = {};
  for (const i of icons) counts[i] = (counts[i] || 0) + 1;
  const voiceIcons = document.querySelectorAll('[data-icon="audio-play"],[data-icon="ptt-status"],[data-icon="audio-download"]');
  const rows = [...new Set([...voiceIcons].map((i) => i.closest('[data-id]')).filter(Boolean))];
  const clean = (html) => html
    .replace(/(true|false)_[0-9a-z@.\-]+_[0-9A-Z]+/g, '$1_JID_MSGID')
    .replace(/blob:[^"']+/g, 'blob:URL')
    .replace(/https?:\/\/[^"')\s]+/g, 'URL');
  return {
    iconCounts: counts,
    voiceRows: rows.length,
    audioEls: document.querySelectorAll('audio').length,
    idFormats: rows.map((r) => r.getAttribute('data-id').replace(/[0-9a-z@.\-]+_[0-9A-Z]+$/, '<..>')),
    htmls: rows.slice(-3).map((r) => clean(r.outerHTML)),
  };
});
console.log(JSON.stringify({ ...info, htmls: undefined }, null, 1));
if (info.htmls.length) {
  writeFileSync('tests/fixtures/wa-bubble.html', info.htmls.map((h) => `<!-- bubble -->\n${h}`).join('\n\n'));
  console.log('Zapisano tests/fixtures/wa-bubble.html');
}
await ctx.close();
