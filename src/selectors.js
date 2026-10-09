// WSZYSTKIE selektory WhatsApp Web są tutaj. Jeśli WhatsApp zmieni wygląd, poprawiasz tylko ten plik.
// Opieramy się na data-icon, role i tytułach ikon SVG (niezależne od języka), nie na klasach CSS.
// Struktura zweryfikowana na fixture: tests/fixtures/wa-bubble.html.

// Znacznik głosówki: ikona mikrofonu "ptt-status" (+ awaryjnie suwak postępu).
export const VOICE_MARKER_SELECTOR = '[data-icon="ptt-status"], [data-icon="audio-play"], [role="slider"][aria-valuemax][aria-valuetext]';

// Wiersz wiadomości (data-id = ID wiadomości).
export const MESSAGE_ROW_SELECTOR = '[data-id]';

export const CLICKABLE_SELECTOR = 'button, [role="button"]';

const PLAY_RE = /play/i;
const PAUSE_RE = /pause/i;

function buttonsWithIcon(row, re) {
  const out = [];
  for (const b of row.querySelectorAll('button')) {
    const t = b.querySelector('svg title');
    if (t && re.test(t.textContent || '')) out.push(b);
  }
  return out;
}

// Przycisk odtwarzania (ikona ic-play-arrow-filled / data-icon="audio-play").
export function findPlayButton(row) {
  const byIcon = row.querySelector('[data-icon="audio-play"]');
  if (byIcon) return byIcon.closest(CLICKABLE_SELECTOR) || byIcon;
  return buttonsWithIcon(row, PLAY_RE)[0] || null;
}

// Przycisk pauzy (widoczny w trakcie odtwarzania).
export function findPauseButton(row) {
  const byIcon = row.querySelector('[data-icon="audio-pause"]');
  if (byIcon) return byIcon.closest(CLICKABLE_SELECTOR) || byIcon;
  return buttonsWithIcon(row, PAUSE_RE)[0] || null;
}

export function findVoiceRows(root = document) {
  const rows = new Set();
  for (const m of root.querySelectorAll(VOICE_MARKER_SELECTOR)) {
    const row = m.closest(MESSAGE_ROW_SELECTOR);
    if (row) rows.add(row);
  }
  return [...rows];
}

export function messageId(row) {
  return row.getAttribute('data-id');
}
