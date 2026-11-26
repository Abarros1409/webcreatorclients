// Builds the four fictional showcase businesses with the factory into public/voorbeeld/<look>/,
// then captures a phone-sized poster of each (NL + EN) so the hero phone can show it instantly
// and load the live site only when someone touches it. Output is generated, not committed.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const factory = path.resolve(here, '../../factory');
const pub = path.resolve(here, '../public/voorbeeld');
const SHOWCASES = { 'bruin-cafe': 'showcase-bruin-cafe', 'koffie-brunch': 'showcase-koffie-brunch', diner: 'showcase-diner', streetfood: 'showcase-streetfood' };

for (const [look, slug] of Object.entries(SHOWCASES)) {
  const out = path.join(pub, look);
  const r = spawnSync(process.execPath, ['scripts/build.mjs', slug, '--base', `/voorbeeld/${look}/`, '--out', out], { cwd: factory, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  if (r.status !== 0) { process.stdout.write(r.stdout); process.exit(r.status ?? 1); }
  console.log(`✓ showcase ${look}`);
}

// Posters
const req = createRequire(path.join(factory, 'package.json'));
let chromium;
try { ({ chromium } = req('playwright')); } catch { console.log('! playwright not found: skipping posters'); process.exit(0); }
const sharp = createRequire(import.meta.url)('sharp');
const { serve } = await import(path.join(factory, 'scripts/lib/serve.mjs'));
const server = await serve(path.resolve(here, '../public'));
const browser = await chromium.launch();
fs.mkdirSync(path.join(pub, 'posters'), { recursive: true });
try {
  for (const look of Object.keys(SHOWCASES)) {
    for (const lang of ['nl', 'en']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await page.goto(`${server.url}voorbeeld/${look}/${lang === 'en' ? 'en/' : ''}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const png = await page.screenshot();
      await sharp(png).resize(632).webp({ quality: 78 }).toFile(path.join(pub, 'posters', `${look}-${lang}.webp`));
      await page.close();
    }
  }
  console.log('✓ posters');
} finally {
  await browser.close();
  await server.close();
}
