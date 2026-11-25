#!/usr/bin/env node
// Step 7 — Publish demos. All demos live on one private site: demo.<studio-domain>/<slug>-<token>/
// Hidden from search engines three ways (robots.txt, X-Robots-Tag header, meta robots) and the
// root page lists nothing, so a demo is only reachable with its link.
//   npm run publish                     rebuild out/demos from every QA-passed demo and deploy (needs VERCEL_TOKEN)
//   npm run publish -- --dry            assemble out/demos only
//   npm run publish -- --remove <slug>  take a declined demo offline (then publish again)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { args, CLIENTS, FACTORY, clientDir, demoPath, fail, readJson, rel, studioConfig, writeJson, writeText } from './lib/util.mjs';
import { build } from './build.mjs';
import { setStage } from './status.mjs';

const OUT = path.join(FACTORY, 'out', 'demos');

function demos() {
  if (!fs.existsSync(CLIENTS)) return [];
  return fs.readdirSync(CLIENTS)
    .filter((d) => !d.startsWith('_') && fs.existsSync(path.join(CLIENTS, d, 'content.json')))
    .map((d) => ({ slug: d, content: readJson(path.join(CLIENTS, d, 'content.json')), status: readJson(path.join(CLIENTS, d, 'status.json'), {}), qa: readJson(path.join(CLIENTS, d, 'qa', 'report.json'), null) }))
    .filter((x) => x.content.mode === 'demo' && !x.status.removed && !x.slug.startsWith('example-')); // example-* are fixtures, never published
}

function assemble() {
  const studio = studioConfig();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const published = [];
  for (const d of demos()) {
    if (!d.qa?.passed) { console.log(`  · skip ${d.slug}: QA has not passed`); continue; }
    const dist = build(d.slug, {});
    const target = path.join(OUT, demoPath(d.content).replace(/^\/|\/$/g, ''));
    fs.cpSync(dist, target, { recursive: true });
    published.push({ slug: d.slug, url: studio.demo_base_url.replace(/\/$/, '') + demoPath(d.content) });
  }
  writeText(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  writeText(path.join(OUT, 'index.html'), `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${studio.name}</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;font-family:Georgia,serif;background:#f6f1e7;color:#1d2a22}p{font-size:1.25rem;font-style:italic}</style></head><body><p>${studio.name.toLowerCase()}</p></body></html>\n`);
  writeText(path.join(OUT, '404.html'), '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title><p style="font-family:system-ui;padding:2rem">This preview is no longer available.</p>\n');
  writeJson(path.join(OUT, 'vercel.json'), {
    cleanUrls: false,
    trailingSlash: true,
    headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Referrer-Policy', value: 'no-referrer' }] }],
  });
  return published;
}

function deploy() {
  const token = process.env.VERCEL_TOKEN;
  const project = studioConfig().hosting?.demo_project ?? 'amuse-demos';
  if (!token) {
    console.log(`\n  No VERCEL_TOKEN set: out/demos is ready but not deployed.\n  Deploy by hand: cd ${rel(OUT)} && npx vercel deploy --prod --name ${project}`);
    return false;
  }
  const r = spawnSync('npx', ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes', '--name', project, '--token', token], { cwd: OUT, stdio: 'inherit' });
  return r.status === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  if (a.remove) {
    const slug = String(a.remove);
    if (!fs.existsSync(clientDir(slug))) fail(`no client ${slug}`);
    setStage(slug, 'lost', { removed: true, note: 'demo removed from the demo site' });
    console.log(`✓ ${slug} marked removed. Run npm run publish to take it offline.`);
    process.exit(0);
  }
  const published = assemble();
  console.log(`✓ assembled ${rel(OUT)} with ${published.length} demo(s)`);
  published.forEach((p) => console.log(`  ${p.url}`));
  if (!a.dry && deploy()) for (const p of published) setStage(p.slug, 'published', { demo_url: p.url });
}
