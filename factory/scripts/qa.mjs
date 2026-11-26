#!/usr/bin/env node
// Step 6 — QA. The plan's checklist, automated. A demo is only published when this passes.
//   npm run qa -- <slug> [--no-lighthouse] [--no-shots]
// Builds a local copy (dist-local), then checks content, HTML, both languages, links, demo privacy,
// structured data, layout at 4 widths, accessibility (axe) and Lighthouse mobile scores.
// Output: clients/<slug>/qa/report.md + report.json + shots/*.png. Exit code 1 when anything blocks.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { args, clientDir, fail, loadPlaywright, rel, require, today, writeJson, writeText } from './lib/util.mjs';
import { validateClient } from './lib/validate.mjs';
import { build } from './build.mjs';
import { serve } from './lib/serve.mjs';
import { takeShots } from './shots.mjs';
import { setStage } from './status.mjs';

const PLACEHOLDER = /\bTODO\b|\bTBD\b|lorem|ipsum|\{\{|\}\}|XXX|\bundefined\b|\bNaN\b|\[object Object\]/i;
const THRESHOLDS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 };

async function lighthouse(url, live) {
  const { default: lh } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');
  const chromePath = process.env.CHROME_PATH ?? (fs.existsSync('/opt/pw-browsers/chromium-1243/chrome-linux64/chrome') ? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' : undefined);
  let executable = chromePath;
  if (!executable) {
    try { executable = loadPlaywright().chromium.executablePath(); } catch { /* chrome-launcher finds a local Chrome */ }
  }
  const chrome = await chromeLauncher.launch({ chromePath: executable, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
  try {
    const categories = live ? ['performance', 'accessibility', 'best-practices', 'seo'] : ['performance', 'accessibility', 'best-practices'];
    const r = await lh(url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: categories, formFactor: 'mobile', screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false } });
    const cats = Object.fromEntries(Object.entries(r.lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
    const failing = Object.values(r.lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === 'binary').map((a) => a.title).slice(0, 8);
    return { scores: cats, lcp: r.lhr.audits['largest-contentful-paint']?.displayValue, cls: r.lhr.audits['cumulative-layout-shift']?.displayValue, tbt: r.lhr.audits['total-blocking-time']?.displayValue, failing };
  } finally {
    await chrome.kill();
  }
}

export async function qa(slug, opts = {}) {
  const checks = [];
  const add = (group, name, ok, detail = '', level = 'block') => checks.push({ group, name, ok: !!ok, level: ok ? 'pass' : level, detail });

  // 1. Content
  const { errors, warnings, content: c } = validateClient(slug);
  add('content', 'content.json matches the schema', errors.length === 0, errors.slice(0, 8).join('; '));
  for (const w of warnings) add('content', w, false, '', 'warn');
  if (!c) return finish(slug, checks, opts);
  const strings = [];
  const walk = (v) => (typeof v === 'string' ? strings.push(v) : v && typeof v === 'object' && Object.values(v).forEach(walk));
  walk(c);
  const ph = strings.join('\n').match(new RegExp(PLACEHOLDER.source, 'gi'));
  add('content', 'no placeholder text in content.json', !ph, ph ? [...new Set(ph)].join(', ') : '');

  // 2. Build (local, base /) and the publishable build
  if (!errors.length) {
    build(slug, { local: true });
    build(slug, {});
  }
  const dist = path.join(clientDir(slug), 'dist-local');
  const pages = { nl: path.join(dist, 'index.html'), en: path.join(dist, 'en', 'index.html') };
  add('build', 'both language pages exist', fs.existsSync(pages.nl) && fs.existsSync(pages.en));
  if (!fs.existsSync(pages.nl) || !fs.existsSync(pages.en)) return finish(slug, checks, opts);

  const $ = { nl: cheerio.load(fs.readFileSync(pages.nl, 'utf8')), en: cheerio.load(fs.readFileSync(pages.en, 'utf8')) };
  for (const lang of ['nl', 'en']) {
    const d = $[lang];
    const text = d('body').text();
    const hits = text.match(new RegExp(PLACEHOLDER.source, 'gi'));
    add('html', `[${lang}] no placeholder text on the page`, !hits, hits ? [...new Set(hits)].join(', ') : '');
    add('html', `[${lang}] <html lang="${lang}">`, d('html').attr('lang') === lang);
    add('html', `[${lang}] title and meta description`, d('title').text().length > 10 && (d('meta[name="description"]').attr('content') ?? '').length > 50, `${d('title').text().length} / ${(d('meta[name="description"]').attr('content') ?? '').length} chars`);
    add('html', `[${lang}] title ≤ 60 chars`, d('title').text().length <= 60, `${d('title').text().length}`, 'warn');
    add('html', `[${lang}] one h1`, d('h1').length === 1, `${d('h1').length}`);
    const missing = d('[data-missing-photo]').map((_, e) => d(e).attr('data-missing-photo')).get();
    add('html', `[${lang}] no missing photos`, missing.length === 0, missing.join(', '));
    const noAlt = d('img').filter((_, e) => d(e).attr('alt') === undefined).length;
    add('html', `[${lang}] every image has alt text`, noAlt === 0, `${noAlt} without alt`);
    const ids = new Set(d('[id]').map((_, e) => d(e).attr('id')).get());
    const badAnchors = d('a[href^="#"]').map((_, e) => d(e).attr('href').slice(1)).get().filter((h) => h && !ids.has(h));
    add('links', `[${lang}] in-page links point to real sections`, badAnchors.length === 0, [...new Set(badAnchors)].join(', '));
    const tels = d('a[href^="tel:"]').map((_, e) => d(e).attr('href').slice(4)).get();
    if (c.contact.phone) add('links', `[${lang}] tap-to-call works (E.164)`, tels.length > 0 && tels.every((t) => /^\+[1-9]\d{7,14}$/.test(t)), tels.join(', '));
    add('links', `[${lang}] directions link`, d(`a[href="${c.contact.maps_url}"]`).length > 0);
    const local = d('a[href^="/"]').map((_, e) => d(e).attr('href')).get().filter((h) => !h.startsWith('//'));
    const broken = local.filter((h) => { const p = path.join(dist, h.split('#')[0]); return !(fs.existsSync(p) || fs.existsSync(path.join(p, 'index.html'))); });
    add('links', `[${lang}] internal links resolve`, broken.length === 0, broken.join(', '));
    add('links', `[${lang}] language switch present`, d(`a[hreflang="${lang === 'nl' ? 'en' : 'nl'}"]`).length > 0);
    let ld = null;
    try { ld = JSON.parse(d('script[type="application/ld+json"]').first().contents().text()); } catch { /* invalid */ }
    add('seo', `[${lang}] JSON-LD business data`, ld && ld.name && ld.address && ld.openingHoursSpecification, ld ? ld['@type'] : 'missing or invalid');
    add('seo', `[${lang}] hreflang alternates`, d('link[rel="alternate"][hreflang]').length >= 3);
    const demo = c.mode !== 'live';
    if (demo) {
      add('privacy', `[${lang}] demo is noindex`, /noindex/.test(d('meta[name="robots"]').attr('content') ?? ''));
      add('privacy', `[${lang}] "Concept for …" label shown`, d('[data-concept-ribbon]').length === 1);
    } else {
      add('privacy', `[${lang}] live site is indexable`, !/noindex/.test(d('meta[name="robots"]').attr('content') ?? ''));
      add('privacy', `[${lang}] no concept label on the live site`, d('[data-concept-ribbon]').length === 0);
      add('seo', `[${lang}] canonical URL`, d('link[rel="canonical"]').length === 1);
    }
  }
  const robots = fs.existsSync(path.join(dist, 'robots.txt')) ? fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8') : '';
  add('privacy', 'robots.txt matches the mode', c.mode === 'live' ? /Allow: \//.test(robots) : /Disallow: \//.test(robots));
  const secNl = $.nl('[data-section]').length;
  const secEn = $.en('[data-section]').length;
  add('html', 'both languages have the same sections', secNl === secEn, `nl ${secNl} / en ${secEn}`);
  const sameText = ['nl', 'en'].map((l) => $[l]('main').text().replace(/\s+/g, ' ').length);
  add('html', 'English is not a copy of Dutch', $.nl('main').text() !== $.en('main').text(), `${sameText[0]} / ${sameText[1]} chars`);

  // 3. In the browser: layout, console errors, accessibility
  const server = await serve(dist);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      // Reduced motion: measure the settled page, not elements halfway through a fade-in.
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
      for (const lang of ['nl', 'en']) {
        await page.goto(server.url + (lang === 'en' ? 'en/' : ''), { waitUntil: 'networkidle' });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        add('layout', `[${lang}] no sideways scroll at ${width}px`, overflow <= 1, `${overflow}px`);
      }
      add('layout', `no console errors at ${width}px`, errs.length === 0, errs.slice(0, 3).join(' | '));
      if (width === 390) {
        await page.addScriptTag({ path: require.resolve('axe-core') });
        const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help })));
        const serious = res.filter((v) => ['serious', 'critical'].includes(v.impact));
        add('a11y', 'no serious accessibility violations (axe)', serious.length === 0, serious.map((v) => `${v.id} ×${v.n}: ${v.help}`).join('; '));
        const minor = res.filter((v) => !['serious', 'critical'].includes(v.impact));
        if (minor.length) add('a11y', 'minor accessibility issues', false, minor.map((v) => `${v.id} ×${v.n}`).join('; '), 'warn');
        // Interactions: open-now badge rendered, menu search narrows results
        const badge = await page.locator('[data-open-badge]').first().isVisible().catch(() => false);
        add('behaviour', '“open now” badge renders', badge);
        if (c.menu?.searchable) {
          const before = await page.locator('[data-menu-item]:visible').count();
          await page.fill('[data-menu-search]', (typeof c.menu.sections[0].items[0].name === 'string' ? c.menu.sections[0].items[0].name : c.menu.sections[0].items[0].name.nl).slice(0, 5));
          const after = await page.locator('[data-menu-item]:visible').count();
          add('behaviour', 'menu search filters items', after > 0 && after <= Math.max(before, 1) + 200, `${before} → ${after}`);
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  // 4. Lighthouse (mobile)
  if (!opts.noLighthouse) {
    try {
      const lh = await lighthouse(server.url, c.mode === 'live');
      for (const [cat, score] of Object.entries(lh.scores)) add('lighthouse', `${cat} ≥ ${THRESHOLDS[cat]} (mobile)`, score >= THRESHOLDS[cat], `${score}${cat === 'performance' ? ` · LCP ${lh.lcp} · CLS ${lh.cls} · TBT ${lh.tbt}` : ''}`);
      if (lh.failing.length) add('lighthouse', 'audits to look at', false, lh.failing.join('; '), 'warn');
    } catch (err) {
      add('lighthouse', 'Lighthouse ran', false, err.message.split('\n')[0], 'warn');
    }
  }
  await server.close();

  // 5. Screenshots for the human/Claude visual review (the step no script replaces)
  if (!opts.noShots) {
    const files = await takeShots(slug, { full: true });
    add('review', 'screenshots ready for visual review', files.length === 8, rel(path.dirname(files[0])), 'warn');
  }
  return finish(slug, checks, opts);
}

function finish(slug, checks, opts) {
  const blocking = checks.filter((x) => x.level === 'block');
  const warnings = checks.filter((x) => x.level === 'warn');
  const passed = blocking.length === 0;
  const lines = [
    `# QA — ${slug}`, '', `${today()} · ${passed ? '**PASS**' : `**FAIL** (${blocking.length} blocking)`} · ${warnings.length} warnings`, '',
    '| | Group | Check | Detail |', '|---|---|---|---|',
    ...checks.map((x) => `| ${x.level === 'pass' ? '✅' : x.level === 'warn' ? '⚠️' : '❌'} | ${x.group} | ${x.name} | ${String(x.detail ?? '').replace(/\|/g, '/').slice(0, 220)} |`),
    '', 'Visual review still required: open qa/shots/*.png and check hierarchy, spacing, photos and copy at every size.',
  ];
  const dir = path.join(clientDir(slug), 'qa');
  writeText(path.join(dir, 'report.md'), lines.join('\n') + '\n');
  writeJson(path.join(dir, 'report.json'), { slug, date: today(), passed, checks });
  if (passed && !opts.dry) setStage(slug, 'qa-passed');
  return { passed, blocking, warnings, report: path.join(dir, 'report.md') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  if (!a._[0]) fail('usage: npm run qa -- <slug> [--no-lighthouse] [--no-shots]');
  const r = await qa(a._[0], { noLighthouse: a['no-lighthouse'], noShots: a['no-shots'] });
  for (const b of r.blocking) console.log(`  ✗ ${b.group}: ${b.name}${b.detail ? ` — ${b.detail}` : ''}`);
  for (const w of r.warnings) console.log(`  ! ${w.group}: ${w.name}${w.detail ? ` — ${String(w.detail).slice(0, 160)}` : ''}`);
  console.log(`\n${r.passed ? '✓ QA passed' : '✗ QA failed'} → ${rel(r.report)}`);
  process.exit(r.passed ? 0 : 1);
}
