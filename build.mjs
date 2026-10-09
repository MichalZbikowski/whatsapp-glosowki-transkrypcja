import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/ort', { recursive: true });

const common = { bundle: true, target: 'chrome116', logLevel: 'info', legalComments: 'none' };


await build({ ...common, entryPoints: ['src/background.js'], outfile: 'dist/background.js', format: 'esm' });
await build({ ...common, entryPoints: ['src/content.js'], outfile: 'dist/content.js', format: 'iife' });
await build({ ...common, entryPoints: ['src/main-world.js'], outfile: 'dist/main-world.js', format: 'iife' });
await build({ ...common, entryPoints: ['src/popup.js'], outfile: 'dist/popup.js', format: 'esm' });
await build({ ...common, entryPoints: ['src/options.js'], outfile: 'dist/options.js', format: 'esm' });
await build({
  ...common, entryPoints: ['src/offscreen.js'], outfile: 'dist/offscreen.js', format: 'esm', external: [],
});

for (const f of ['manifest.json', 'content.css', 'popup.html', 'options.html', 'offscreen.html']) cpSync(`src/${f}`, `dist/${f}`);

const ort = 'node_modules/onnxruntime-web/dist';
for (const f of readdirSync(ort)) {
  if (/^ort-wasm.*.(mjs|wasm)$/.test(f)) cpSync(`${ort}/${f}`, `dist/ort/${f}`);
}
console.log('OK -> dist/');
