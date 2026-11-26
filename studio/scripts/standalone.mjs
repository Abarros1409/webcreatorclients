// One-file preview of the studio site per language: CSS, script, fonts and posters inlined, and the
// four example sites embedded (the hero phone loads them from the file itself). For sharing before
// the site has a domain.   node scripts/standalone.mjs  ->  preview/amuse-studio-nl.html + -en.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
const outDir = path.resolve(here, '../preview');
const factory = path.resolve(here, '../../factory');
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.avif': 'image/avif' };
const uri = (p) => { const f = path.join(dist, p.split(/[?#]/)[0]); return fs.existsSync(f) ? `data:${MIME[path.extname(f)] ?? 'application/octet-stream'};base64,${fs.readFileSync(f).toString('base64')}` : null; };

const { standalone } = await import(pathToFileURL(path.join(factory, 'scripts/standalone.mjs')).href);
const LOOKS = { 'bruin-cafe': 'showcase-bruin-cafe', 'koffie-brunch': 'showcase-koffie-brunch', diner: 'showcase-diner', streetfood: 'showcase-streetfood' };
const demos = {};
for (const [look, slug] of Object.entries(LOOKS)) {
  const [nl, en] = standalone(slug);
  demos[look] = { nl: fs.readFileSync(nl, 'utf8'), en: fs.readFileSync(en, 'utf8') };
}

fs.mkdirSync(outDir, { recursive: true });
for (const lang of ['nl', 'en']) {
  let html = fs.readFileSync(path.join(dist, lang === 'nl' ? 'index.html' : 'en/index.html'), 'utf8');
  html = html.replace(/<script type="module" src="(\/[^"]+)"><\/script>/g, (m, src) => `<script type="module">${fs.readFileSync(path.join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`);
  html = html.replace(/url\((["']?)(\/_assets\/[^)"']+)\1\)/g, (m, q, u) => (uri(u) ? `url(${uri(u)})` : m));
  html = html.replace(/<link rel="preload"[^>]*>/g, '');
  html = html.replace(/(src|data-poster-src)="(\/voorbeeld\/posters\/[^"]+)"/g, (m, attr, u) => `${attr}="${uri(u) ?? u}"`);
  html = html.replace(/data-src="\/voorbeeld\/([a-z-]+)\/(en\/)?"/g, (m, look) => `data-src="demo:${look}"`);
  html = html.replace(/href="\/en\/"/g, 'href="amuse-studio-en.html"').replace(/href="\/"/g, 'href="amuse-studio-nl.html"');
  const blobs = Object.entries(demos).map(([look, d]) => `<script type="application/json" id="demo-${look}">${JSON.stringify(d[lang]).replace(/</g, '\\u003c')}</script>`).join('\n');
  html = html.replace('</body>', `${blobs}\n</body>`);
  const file = path.join(outDir, `amuse-studio-${lang}.html`);
  fs.writeFileSync(file, html);
  console.log(`✓ ${path.relative(path.resolve(here, '..'), file)} · ${Math.round(fs.statSync(file).size / 1024)} KB`);
}
