// Wspólny launcher: Brave (headed) z załadowanym rozszerzeniem z dist/.
import { chromium } from 'playwright';
import { resolve } from 'node:path';

export const BRAVE = process.env.BRAVE_PATH || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

export async function launch({ profile = './.wa-profile', extra = [] } = {}) {
  const ext = resolve('dist');
  const ctx = await chromium.launchPersistentContext(resolve(profile), {
    executablePath: BRAVE,
    headless: false,
    viewport: null,
    args: [
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      '--enable-unsafe-webgpu',
      ...extra,
    ],
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  return { ctx, sw, extId };
}
