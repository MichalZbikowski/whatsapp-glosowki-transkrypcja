import { launch } from './launch.mjs';

const flagSets = {
  domyslne: [],
  'unsafe-webgpu+vulkan': ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=d3d11'],
  'ignore-blocklist': ['--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-webgpu-developer-features'],
};
for (const [name, extra] of Object.entries(flagSets)) {
  const { ctx, extId } = await launch({ profile: `./.tmp-profile-gpu-${name.replace(/\W/g, '')}`, extra });
  const p = await ctx.newPage();
  await p.goto(`chrome-extension://${extId}/options.html`);
  const r = await p.evaluate(async () => {
    if (!navigator.gpu) return 'brak navigator.gpu';
    const a = await navigator.gpu.requestAdapter();
    if (!a) return 'navigator.gpu jest, adapter = null';
    const i = a.info || {};
    return `adapter: ${i.vendor} ${i.architecture} ${i.description}; fp16=${a.features.has('shader-f16')}`;
  });
  console.log(name, '=>', r);
  await ctx.close();
}
