#!/usr/bin/env node
// Screenshots of a built client site at the four review sizes, both languages.
//   npm run shots -- <slug> [--full] [--sizes 390x844,1440x900]
import fs from 'node:fs';
import path from 'node:path';
import { args, clientDir, fail, loadPlaywright, rel } from './lib/util.mjs';
import { serve } from './lib/serve.mjs';

export const SIZES = { desktop: [1440, 900], laptop: [1024, 768], tablet: [768, 1024], phone: [390, 844] };

/** Make lazy images load and reveal animations settle before a full-page capture. */
export async function loadEverything(page) {
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  });
  await page.waitForLoadState('networkidle');
}

export async function takeShots(slug, { full = true, sizes = SIZES, langs = ['nl', 'en'], out } = {}) {
  const dist = path.join(clientDir(slug), 'dist-local');
  if (!fs.existsSync(dist)) fail(`no local build for ${slug}: run npm run build -- ${slug} --local`);
  const outDir = out ?? path.join(clientDir(slug), 'qa', 'shots');
  fs.mkdirSync(outDir, { recursive: true });
  const server = await serve(dist);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const files = [];
  try {
    for (const [name, [w, h]] of Object.entries(sizes)) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: w < 500, hasTouch: w < 500 });
      const page = await ctx.newPage();
      for (const lang of langs) {
        await page.goto(server.url + (lang === 'en' ? 'en/' : ''), { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        if (full) await loadEverything(page);
        const file = path.join(outDir, `${name}-${lang}${full ? '-full' : ''}.png`);
        await page.screenshot({ path: file, fullPage: full });
        files.push(file);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  if (!a._[0]) fail('usage: node scripts/shots.mjs <slug> [--viewport]');
  const sizes = a.sizes ? Object.fromEntries(String(a.sizes).split(',').map((s) => [s, s.split('x').map(Number)])) : SIZES;
  const files = await takeShots(a._[0], { full: !a.viewport, sizes, langs: a.lang ? [a.lang] : ['nl', 'en'] });
  files.forEach((f) => console.log(`  ${rel(f)}`));
}
