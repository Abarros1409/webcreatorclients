#!/usr/bin/env node
// Build one client's site: starter + clients/<slug>/{content.json, photos, theme.css, overrides/} -> clients/<slug>/dist
//   npm run build -- <slug>                 demo build at /<slug>-<token>/ (what gets published)
//   npm run build -- <slug> --local         same site at / (for QA, screenshots, local preview)
//   npm run dev -- <slug>                   live-reload dev server
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { FACTORY, STARTER, BUILD, args, clientDir, fail, readJson, rel, studioConfig, demoPath } from './lib/util.mjs';
import { validateClient } from './lib/validate.mjs';

export function prepare(slug, { look } = {}) {
  const { errors, warnings, content } = validateClient(slug);
  if (errors.length) fail(`content.json for "${slug}" is not valid:\n  - ${errors.join('\n  - ')}`);
  for (const w of warnings) console.log(`  ! ${w}`);

  const src = clientDir(slug);
  const dst = path.join(BUILD, slug);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(STARTER, dst, {
    recursive: true,
    filter: (p) => !/[\\/](node_modules|dist|\.astro)([\\/]|$)/.test(path.relative(STARTER, p)) && !path.relative(STARTER, p).startsWith(path.join('src', 'client')),
  });
  const client = path.join(dst, 'src', 'client');
  fs.mkdirSync(path.join(client, 'photos'), { recursive: true });
  const built = look ? { ...content, look } : content;
  fs.writeFileSync(path.join(client, 'content.json'), JSON.stringify(built, null, 2));
  if (fs.existsSync(path.join(src, 'photos'))) {
    for (const f of fs.readdirSync(path.join(src, 'photos'))) {
      const p = path.join(src, 'photos', f);
      if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(client, 'photos', f));
    }
  }
  const theme = path.join(src, 'theme.css');
  fs.writeFileSync(path.join(client, 'theme.css'), fs.existsSync(theme) ? fs.readFileSync(theme, 'utf8') : '/* no client overrides */\n');
  const looks = readJson(path.join(STARTER, 'src', 'looks', 'looks.json'));
  if (!looks[built.look]) fail(`unknown look "${built.look}"`);
  fs.copyFileSync(path.join(STARTER, 'src', 'looks', `${built.look}.css`), path.join(client, 'look.css'));
  fs.writeFileSync(path.join(client, 'look.json'), JSON.stringify(looks[built.look], null, 2));
  const studio = studioConfig();
  fs.writeFileSync(path.join(client, 'studio.json'), JSON.stringify({ name: studio.name, url: studio.url ?? null }, null, 2));

  // Per-client component overrides: clients/<slug>/overrides/sections/Hero.astro replaces src/sections/Hero.astro
  const overrides = path.join(src, 'overrides');
  if (fs.existsSync(overrides)) fs.cpSync(overrides, path.join(dst, 'src'), { recursive: true });
  return { dst, content: built };
}

export function build(slug, a = {}) {
  const { dst, content } = prepare(slug, { look: a.look });
  const live = content.mode === 'live';
  const base = a.base ?? (a.local || a.dev || live ? '/' : demoPath(content));
  const out = a.out ? path.resolve(a.out) : path.join(clientDir(slug), a.local ? 'dist-local' : 'dist');
  const env = {
    ...process.env,
    SITE_BASE: base,
    SITE_OUT: out,
    SITE_URL: live ? content.site.url : '',
    ASTRO_TELEMETRY_DISABLED: '1',
  };
  const astro = path.join(FACTORY, 'node_modules', '.bin', 'astro');
  if (a.dev) {
    console.log(`→ dev server for ${slug} (Ctrl+C to stop)`);
    spawn(astro, ['dev', '--root', dst, '--host'], { env, stdio: 'inherit' });
    return null;
  }
  console.log(`→ building ${slug} (${content.mode}, look ${content.look}) at base ${base}`);
  const r = spawnSync(astro, ['build', '--root', dst], { env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0) {
    process.stdout.write(r.stdout ?? '');
    process.stderr.write(r.stderr ?? '');
    fail(`astro build failed for ${slug}`);
  }
  const warnings = (r.stdout + r.stderr).split('\n').filter((l) => /\[(WARN|warn)\]/.test(l));
  warnings.forEach((w) => console.log(`  ! ${w.trim()}`));
  console.log(`✓ built ${rel(out)}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  if (!a._[0]) fail('usage: npm run build -- <slug> [--local] [--dev] [--look <look>] [--out <dir>]');
  build(a._[0], a);
}
