#!/usr/bin/env node
// Style step helper: render one client in all four looks and capture the first screen
// on phone and desktop, so the look is chosen by eye, not by guess.
//   npm run looks -- <slug>        -> clients/<slug>/qa/looks/<look>-{phone,desktop}.png
import fs from 'node:fs';
import path from 'node:path';
import { args, clientDir, fail, loadPlaywright, readJson, rel, STARTER } from './lib/util.mjs';
import { build } from './build.mjs';
import { serve } from './lib/serve.mjs';

const a = args();
const slug = a._[0];
if (!slug) fail('usage: npm run looks -- <slug>');
const looks = Object.keys(readJson(path.join(STARTER, 'src', 'looks', 'looks.json')));
const outDir = path.join(clientDir(slug), 'qa', 'looks');
fs.mkdirSync(outDir, { recursive: true });
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
  for (const look of looks) {
    const dist = build(slug, { local: true, look, out: path.join(clientDir(slug), 'qa', 'looks', `site-${look}`) });
    const server = await serve(dist);
    for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
      const page = await browser.newPage({ viewport: vp, reducedMotion: 'reduce' });
      await page.goto(server.url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(outDir, `${look}-${name}.png`);
      await page.screenshot({ path: file });
      console.log(`  ${rel(file)}`);
      await page.close();
    }
    await server.close();
    fs.rmSync(dist, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}
