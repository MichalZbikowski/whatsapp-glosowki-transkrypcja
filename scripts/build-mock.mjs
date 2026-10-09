// Buduje tests/mock-wa.html z prawdziwego fixture dymków. Atrapa naśladuje: play -> blob audio/ogg -> <audio>.
import { readFileSync, writeFileSync } from 'node:fs';
const bubbles = readFileSync('tests/fixtures/wa-bubble.html', 'utf8').replace(/<!-- bubble -->/g, '');
const html = `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Atrapa WhatsApp</title>
<body><div id="pane-side"></div><div id="main">
${bubbles}
</div>
<script>
window.__clicks = [];
document.addEventListener('click', (e) => { const b = e.target.closest('button'); window.__clicks.push(b ? (b.getAttribute('aria-label') || 'button') : e.target.tagName); }, true);
document.querySelectorAll('[data-id] button[aria-label="Odtwórz wiadomość głosową"]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const t = btn.querySelector('svg title');
    if (t.textContent.includes('pause')) { t.textContent = 'ic-play-arrow-filled'; window.__audio && window.__audio.pause(); return; }
    t.textContent = 'ic-pause-filled';
    const blob = await (await fetch('/mock-audio.ogg')).blob();
    const a = new Audio();
    a.src = URL.createObjectURL(new Blob([blob], { type: 'audio/ogg; codecs=opus' }));
    window.__audio = a;
    a.play().catch(() => {});
  });
});
</script></html>`;
writeFileSync('tests/mock-wa.html', html);
console.log('tests/mock-wa.html', html.length, 'B');
