import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

// Behind an HTTPS proxy (cloud sessions), Node's fetch only uses it with NODE_USE_ENV_PROXY=1.
// Re-run this script once with it set. No effect on a normal laptop without a proxy.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --disable-warning=UNDICI-EHPA`.trim() },
  });
  process.exit(r.status ?? 1);
}

export const FACTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPO = path.resolve(FACTORY, '..');
export const CLIENTS = process.env.CLIENTS_DIR ? path.resolve(process.env.CLIENTS_DIR) : path.join(REPO, 'clients');
export const STARTER = path.join(FACTORY, 'starter');
export const BUILD = path.join(FACTORY, '.build');
export const LEADS = path.join(REPO, 'data', 'leads.json');

export const require = createRequire(import.meta.url);

export function clientDir(slug) {
  return path.join(CLIENTS, slug);
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (fallback !== undefined && err.code === 'ENOENT') return fallback;
    throw new Error(`Could not read ${path.relative(REPO, file)}: ${err.message}`);
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function slugify(s) {
  return String(s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' en ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function token(n = 6) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join('');
}

export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function rel(p) {
  return path.relative(REPO, p) || '.';
}

export function fail(msg, code = 1) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(code);
}

export function loadLeads() {
  const data = readJson(LEADS, { leads: [] });
  return data.leads ?? data;
}

export function findLead(idOrName) {
  const q = slugify(idOrName);
  const leads = loadLeads();
  return leads.find((l) => l.id === idOrName) ?? leads.find((l) => slugify(l.name) === q) ?? leads.find((l) => (l.id ?? '').startsWith(q));
}

/** Playwright is preinstalled globally in cloud sessions; fall back to a local install. */
export function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    try {
      return createRequire(path.join(process.cwd(), 'noop.js'))('playwright');
    } catch {
      fail('Playwright is not available. Install it with: npm i -D playwright && npx playwright install chromium');
    }
  }
}

export function studioConfig() {
  return readJson(path.join(FACTORY, 'studio.config.json'));
}

export function demoPath(content) {
  return `/${content.slug}-${content.demo?.token ?? 'preview'}/`;
}
