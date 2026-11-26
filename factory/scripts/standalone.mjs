#!/usr/bin/env node
// Packs a built demo into one self-contained HTML file per language (photos, fonts and script inlined),
// so it opens anywhere without a server or a link: to preview privately, send to a partner, or show offline.
//   npm run standalone -- <slug>   ->  clients/<slug>/pitch/site-nl.html + site-en.html
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { args, clientDir, fail, rel } from './lib/util.mjs';
import { build } from './build.mjs';

const MIME = { '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };

function dataUri(dist, url) {
  const file = path.join(dist, decodeURIComponent(url.split(/[?#]/)[0]));
  if (!fs.existsSync(file)) return null;
  return `data:${MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;
}

/** From a srcset, the candidate closest to the target width. */
function pick(srcset, target = 960) {
  const c = srcset.split(',').map((s) => s.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 }));
  return c.sort((a, b) => Math.abs(a.w - target) - Math.abs(b.w - target))[0]?.u;
}

export function standalone(slug) {
  const dist = build(slug, { local: true });
  const out = path.join(clientDir(slug), 'pitch');
  fs.mkdirSync(out, { recursive: true });
  const files = [];
  for (const lang of ['nl', 'en']) {
    let html = fs.readFileSync(path.join(dist, lang === 'nl' ? 'index.html' : 'en/index.html'), 'utf8');
    // Pictures: drop AVIF, keep one WebP candidate, inline it, and use it for the <img> too.
    html = html.replace(/<picture[^>]*>([\s\S]*?)<\/picture>/g, (whole, inner) => {
      const webp = inner.match(/<source[^>]+srcset="([^"]+)"[^>]+type="image\/webp"/)?.[1];
      const imgSrcset = inner.match(/<img[^>]+srcset="([^"]+)"/)?.[1];
      const chosen = webp ? pick(webp, whole.includes('fetchpriority') ? 1200 : 800) : imgSrcset ? pick(imgSrcset) : null;
      const uri = chosen ? dataUri(dist, chosen) : null;
      if (!uri) return whole;
      const img = inner.match(/<img[^>]*>/)[0].replace(/\ssrcset="[^"]*"/, '').replace(/\ssizes="[^"]*"/, '').replace(/\ssrc="[^"]*"/, ` src="${uri}"`).replace(/loading="lazy"/, 'loading="eager"');
      return whole.replace(inner, img);
    });
    html = html.replace(/<img([^>]*?)\ssrc="(\/[^"]+)"/g, (m, attrs, src) => { const u = dataUri(dist, src); return u ? `<img${attrs} src="${u}"` : m; });
    html = html.replace(/url\((["']?)(\/_assets\/[^)"']+)\1\)/g, (m, q, u) => { const d = dataUri(dist, u); return d ? `url(${d})` : m; });
    html = html.replace(/<script type="module" src="(\/[^"]+)"><\/script>/g, (m, src) => {
      const f = path.join(dist, src);
      return fs.existsSync(f) ? `<script type="module">${fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script')}</script>` : m;
    });
    // Language switch and logo links point at the sibling file.
    html = html.replace(/href="\/en\/"/g, 'href="site-en.html"').replace(/href="\/"/g, 'href="site-nl.html"');
    const file = path.join(out, `site-${lang}.html`);
    fs.writeFileSync(file, html);
    files.push(file);
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = args()._[0];
  if (!slug) fail('usage: npm run standalone -- <slug>');
  for (const f of standalone(slug)) {
    const kb = Math.round(fs.statSync(f).size / 1024);
    const leftover = (fs.readFileSync(f, 'utf8').match(/(?:src|href)="\/_assets\//g) ?? []).length;
    console.log(`  ${rel(f)} · ${kb} KB${leftover ? ` · ${leftover} asset links not inlined` : ''}`);
  }
}
