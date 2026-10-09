// WER / CER. Normalizacja: małe litery, bez interpunkcji.
export function normalize(s) {
  return String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function editDistance(a, b) {
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

export function wer(ref, hyp) {
  const r = normalize(ref).split(' ').filter(Boolean);
  const h = normalize(hyp).split(' ').filter(Boolean);
  return editDistance(r, h) / Math.max(1, r.length);
}

export function cer(ref, hyp) {
  const r = [...normalize(ref)];
  const h = [...normalize(hyp)];
  return editDistance(r, h) / Math.max(1, r.length);
}

// CLI: node scripts/wer.js ref.txt hyp.txt
if (process.argv[1] && process.argv[1].endsWith('wer.js') && process.argv[3]) {
  const fs = await import('node:fs');
  const ref = fs.readFileSync(process.argv[2], 'utf8');
  const hyp = fs.readFileSync(process.argv[3], 'utf8');
  console.log(`WER=${(wer(ref, hyp) * 100).toFixed(1)}%  CER=${(cer(ref, hyp) * 100).toFixed(1)}%`);
}
