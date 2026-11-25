#!/usr/bin/env node
// Step 8 — Pitch kit. Everything Adam takes to the visit:
//   pitch/before-after.png   their current site vs. our concept, side by side on phones
//   pitch/card-a5.pdf        printable A5 card (front + back) with a QR code to the private demo
//   pitch/demo-mobile.mp4    ~45-60 s screen recording of the demo on a phone
//   pitch/talking-points.md  opening line, the three weaknesses, what to show, objections (English)
//   npm run pitch -- <slug> [--no-video]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import { args, CLIENTS, FACTORY, clientDir, demoPath, fail, loadPlaywright, readJson, rel, studioConfig, writeText } from './lib/util.mjs';
import { serve } from './lib/serve.mjs';
import { setStage } from './status.mjs';

const fontFile = (pkg, match) => {
  const dir = path.join(FACTORY, 'node_modules', '@fontsource-variable', pkg, 'files');
  const f = fs.readdirSync(dir).find((x) => x.includes('latin-') && !x.includes('ext') && x.includes(match) && x.endsWith('.woff2'));
  return f ? `file://${path.join(dir, f)}` : null;
};

const STUDIO_CSS = () => `
  @font-face { font-family: 'Fraunces'; src: url('${fontFile('fraunces', 'full-normal')}') format('woff2'); font-weight: 100 900; }
  @font-face { font-family: 'Fraunces'; src: url('${fontFile('fraunces', 'full-italic')}') format('woff2'); font-weight: 100 900; font-style: italic; }
  @font-face { font-family: 'Figtree'; src: url('${fontFile('figtree', 'wght-normal')}') format('woff2'); font-weight: 300 900; }
  :root { --paper: #f6f1e7; --ink: #1d2a22; --green: #234a36; --tomato: #d2452d; --muted: #5d665f; }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Figtree', sans-serif; color: var(--ink); background: var(--paper); -webkit-font-smoothing: antialiased; }
  .serif { font-family: 'Fraunces', serif; font-variation-settings: 'SOFT' 80, 'opsz' 72; }
`;

function phone(src, label) {
  return `<figure class="phone"><div class="screen"><img src="${src}"></div><figcaption>${label}</figcaption></figure>`;
}

async function shot(browser, url, file, { scrollTo } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (scrollTo) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView(), scrollTo);
  await page.screenshot({ path: file });
  await page.close();
}

async function render(browser, html, out, { pdf, width, height }) {
  const page = await browser.newPage({ viewport: { width: width ?? 1600, height: height ?? 1000 }, deviceScaleFactor: 2 });
  // Load from a file so file:// photos and fonts are allowed.
  const tmp = out.replace(/\.(png|pdf)$/, '.render.html');
  fs.writeFileSync(tmp, html);
  await page.goto(`file://${tmp}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  if (pdf) await page.pdf({ path: out, width: '148mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
  else await page.screenshot({ path: out, fullPage: true });
  await page.close();
  fs.rmSync(tmp, { force: true });
}

async function recordVideo(browser, url, outDir) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: outDir, size: { width: 390 * 2, height: 844 * 2 } } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const pause = (ms) => page.waitForTimeout(ms);
  const glide = async (to, ms = 2200) => {
    await page.evaluate(async ({ to, ms }) => {
      const start = window.scrollY; const end = typeof to === 'number' ? to : (document.querySelector(to)?.getBoundingClientRect().top ?? 0) + window.scrollY - 70;
      const t0 = performance.now();
      await new Promise((done) => { const step = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; window.scrollTo(0, start + (end - start) * e); k < 1 ? requestAnimationFrame(step) : done(); }; requestAnimationFrame(step); });
    }, { to, ms });
  };
  await pause(2500);
  await glide('#menu', 2600); await pause(1500);
  const chips = page.locator('.menu-tabs [data-filter]');
  if (await chips.count() > 2) { await chips.nth(2).tap(); await pause(1600); await chips.nth(1).tap(); await pause(1400); }
  const search = page.locator('[data-menu-search]');
  if (await search.count()) { await search.tap(); await search.pressSequentially('nasi', { delay: 180 }); await pause(2000); await search.fill(''); await pause(800); }
  await glide(window => 0, 10).catch(() => {});
  for (const sel of ['#story', '#gallery', '#hours', '#reviews', '#booking']) {
    if (await page.locator(sel).count()) { await glide(sel, 2200); await pause(1500); }
  }
  await glide(0, 2200); await pause(800);
  const lang = page.locator('.header-actions .lang-switch');
  if (await lang.count()) { await lang.tap(); await page.waitForLoadState('networkidle'); await pause(2500); await glide('#menu', 2400); await pause(2000); }
  await ctx.close();
  return await page.video().path();
}

export async function pitch(slug, { video = true } = {}) {
  const dir = clientDir(slug);
  const c = readJson(path.join(dir, 'content.json'));
  const status = readJson(path.join(dir, 'status.json'), {});
  const audit = status.lead_id ? readJson(path.join(CLIENTS, '_audits', `${status.lead_id}.json`), null) : null;
  // Generate may curate the three points so they match what the demo really shows.
  const curated = readJson(path.join(dir, 'talking-points.json'), null);
  const points = curated ?? audit?.talking_points ?? [];
  const facts = readJson(path.join(dir, 'collected', 'facts.json'), {});
  const studio = studioConfig();
  const demoUrl = studio.demo_base_url.replace(/\/$/, '') + demoPath(c);
  const out = path.join(dir, 'pitch');
  fs.mkdirSync(out, { recursive: true });
  const dist = path.join(dir, 'dist-local');
  if (!fs.existsSync(dist)) fail(`no local build: npm run build -- ${slug} --local`);
  const warnings = [];
  const adam = studio.contact.people.find((p) => p.role === 'Clients') ?? studio.contact.people[0];
  if (!adam?.whatsapp) warnings.push('studio.config.json has no WhatsApp number for Adam: the card shows a placeholder line');

  const server = await serve(dist);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const newShot = path.join(out, 'concept-phone.png');
    await shot(browser, server.url, newShot);
    const menuShot = path.join(out, 'concept-menu-phone.png');
    await shot(browser, server.url, menuShot, { scrollTo: '#menu' });
    const before = audit?.screenshot ? path.join(CLIENTS, '_audits', audit.screenshot) : null;

    // Before / after
    const tp = points.slice(0, 3);
    const baHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${STUDIO_CSS()}
      body { padding: 64px 72px; width: 1600px; }
      h1 { font-size: 54px; font-weight: 560; letter-spacing: -0.02em; margin-bottom: 8px; }
      .sub { color: var(--muted); font-size: 22px; margin-bottom: 48px; }
      .row { display: grid; grid-template-columns: 1fr 1fr 1.05fr; gap: 56px; align-items: start; }
      .phone { display: grid; gap: 18px; justify-items: center; }
      .screen { width: 360px; height: 779px; border-radius: 48px; overflow: hidden; border: 12px solid #111; box-shadow: 0 30px 60px -30px rgba(0,0,0,.5); background: #fff; }
      .screen img { width: 100%; display: block; }
      figcaption { font-weight: 700; font-size: 20px; letter-spacing: .08em; text-transform: uppercase; }
      .none { display: grid; place-items: center; height: 100%; padding: 40px; text-align: center; font-size: 24px; color: var(--muted); background: repeating-linear-gradient(-45deg,#eee 0 12px,#e4e4e4 12px 13px); }
      ol { display: grid; gap: 22px; padding: 0; list-style: none; counter-reset: n; }
      li { counter-increment: n; display: grid; grid-template-columns: 44px 1fr; gap: 14px; font-size: 21px; line-height: 1.35; }
      li::before { content: counter(n); width: 40px; height: 40px; border-radius: 50%; background: var(--tomato); color: #fff; display: grid; place-items: center; font-weight: 800; }
      li small { display: block; color: var(--green); font-weight: 700; margin-top: 6px; font-size: 18px; }
      .brand { margin-top: 40px; font-size: 18px; color: var(--muted); }
    </style></head><body>
      <h1 class="serif">${c.business.name}: nu en straks</h1>
      <p class="sub">Your website today, and the concept we built for you · ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="row">
        ${before ? phone(`file://${before}`, 'Nu · Today') : `<figure class="phone"><div class="screen"><div class="none">Geen website<br>No website yet</div></div><figcaption>Nu · Today</figcaption></figure>`}
        ${phone(`file://${newShot}`, 'Concept')}
        <div><ol>${tp.map((t) => `<li><span>${t.say_en}<small>→ ${t.demo_fix}</small></span></li>`).join('')}</ol><p class="brand">${studio.name} · private preview, not public</p></div>
      </div></body></html>`;
    await render(browser, baHtml, path.join(out, 'before-after.png'), { width: 1600, height: 1000 });

    // A5 card, front + back
    const qr = await QRCode.toString(demoUrl, { type: 'svg', margin: 0, color: { dark: '#1d2a22', light: '#0000' } });
    const people = studio.contact.people.map((p) => `<p><strong>${p.name}</strong> · ${p.whatsapp ?? '<span class="todo">WhatsApp number</span>'}</p>`).join('');
    const cardHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${STUDIO_CSS()}
      @page { size: 148mm 210mm; margin: 0; }
      .page { width: 148mm; height: 210mm; padding: 13mm 12mm 11mm; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
      .front { background: var(--green); color: var(--paper); }
      .kicker { font-size: 9pt; letter-spacing: .16em; text-transform: uppercase; opacity: .8; }
      h1 { font-size: 27pt; line-height: 1.02; font-weight: 520; margin: 5mm 0 3mm; letter-spacing: -0.015em; }
      h1 em { color: #ffb9a6; font-style: italic; }
      .en { font-size: 10.5pt; opacity: .85; max-width: 95mm; line-height: 1.35; }
      .mid { display: grid; grid-template-columns: 50mm 1fr; gap: 7mm; margin-top: auto; align-items: end; }
      .mini { width: 50mm; height: 108mm; border-radius: 7mm; border: 2.2mm solid #0d1511; overflow: hidden; background: #fff; box-shadow: 0 6mm 10mm -6mm rgba(0,0,0,.5); }
      .mini img { width: 100%; display: block; }
      .qrbox { background: var(--paper); color: var(--ink); border-radius: 4mm; padding: 5mm; display: grid; gap: 3mm; }
      .qrbox svg { width: 100%; height: auto; display: block; }
      .qrbox p { font-size: 8.5pt; line-height: 1.3; }
      .qrbox .url { font-size: 6.5pt; color: var(--muted); word-break: break-all; }
      .for { margin-top: 6mm; font-size: 9pt; opacity: .85; display: flex; justify-content: space-between; }
      .back { background: var(--paper); }
      .back h2 { font-size: 19pt; font-weight: 540; line-height: 1.05; margin: 3mm 0 6mm; }
      .steps { display: grid; gap: 5mm; }
      .step { display: grid; grid-template-columns: 9mm 1fr; gap: 3mm; }
      .step b { width: 8mm; height: 8mm; border-radius: 50%; background: var(--tomato); color: #fff; display: grid; place-items: center; font-size: 10pt; }
      .step p { font-size: 10pt; line-height: 1.3; } .step p span { display: block; color: var(--muted); font-size: 8.5pt; margin-top: 1mm; }
      .promise { margin-top: 7mm; padding: 4mm 5mm; border: .4mm solid var(--green); border-radius: 3mm; font-size: 9.5pt; line-height: 1.35; }
      .contact { margin-top: auto; display: grid; gap: 1.2mm; font-size: 9.5pt; }
      .wordmark { font-size: 15pt; font-style: italic; color: var(--green); margin-bottom: 2mm; }
      .todo { background: #ffe1d8; color: #a33; padding: 0 1.5mm; border-radius: 1mm; }
    </style></head><body>
      <section class="page front">
        <p class="kicker">Voor ${c.business.name}</p>
        <h1 class="serif">We hebben een <em>nieuwe website</em> voor jullie gemaakt.</h1>
        <p class="en">We built you a new website. Free to look at, no strings attached. Scan the code to see it on your phone.</p>
        <div class="mid">
          <div class="mini"><img src="file://${newShot}"></div>
          <div class="qrbox">${qr}<p><strong>Scan en bekijk</strong><br>Privé-voorbeeld, alleen voor jullie.</p><p class="url">${demoUrl.replace(/^https?:\/\//, '')}</p></div>
        </div>
        <p class="for"><span>${studio.name}</span><span>Rotterdam</span></p>
      </section>
      <section class="page back">
        <p class="kicker" style="color:var(--muted)">Hoe het werkt · How it works</p>
        <h2 class="serif">Al gebouwd. Jullie beslissen.</h2>
        <div class="steps">
          <div class="step"><b>1</b><p>Bekijk het concept op je telefoon.<span>Look at the concept on your phone.</span></p></div>
          <div class="step"><b>2</b><p>Goed? Binnen een week staat hij live, met jullie eigen foto’s en teksten.<span>Like it? It’s live within a week, with your own photos and texts.</span></p></div>
          <div class="step"><b>3</b><p>Wij houden hem bij: menu, prijzen en tijden via WhatsApp.<span>We keep it up to date: send menu, price and hour changes on WhatsApp.</span></p></div>
        </div>
        <p class="promise"><strong>Niet goed? Dan verwijderen we hem.</strong> Geen kosten, geen gedoe.<br><span style="color:var(--muted)">Not for you? We delete it. No cost, no fuss.</span></p>
        <div class="contact"><p class="wordmark serif">${studio.name.toLowerCase()}</p>${people}${studio.contact.email ? `<p>${studio.contact.email}</p>` : '<p><span class="todo">studio email</span></p>'}</div>
      </section>
    </body></html>`;
    await render(browser, cardHtml, path.join(out, 'card-a5.pdf'), { pdf: true });
    await render(browser, cardHtml.replace('page-break-after: always;', 'margin-bottom: 8mm;'), path.join(out, 'card-a5-preview.png'), { width: 560, height: 1600 });

    // Screen recording
    if (video) {
      const tmp = path.join(out, '.video');
      fs.rmSync(tmp, { recursive: true, force: true });
      const webm = await recordVideo(browser, server.url, tmp);
      const mp4 = path.join(out, 'demo-mobile.mp4');
      try {
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-crf', '23', mp4]);
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        fs.renameSync(webm, path.join(out, 'demo-mobile.webm'));
        warnings.push('ffmpeg not found: kept the recording as demo-mobile.webm');
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  // Talking points for Adam (English, per the working agreement).
  const legal = facts.legal;
  const tpLines = points.map((t, i) => `${i + 1}. **${t.say_en}**\n   NL: “${t.say_nl}”\n   Show: ${t.demo_fix}`);
  const md = [
    `# Visit sheet — ${c.business.name}`, '',
    `- Address: ${c.contact.address.street}, ${c.contact.address.postal_code} ${c.contact.address.city}`,
    `- Demo (private): ${demoUrl}`,
    `- Current site: ${c.links?.current_website ?? 'none'}`,
    `- Rating: ${c.reviews?.rating ?? '?'} (${c.reviews?.count ?? '?'} reviews on ${c.reviews?.source ?? 'Google'})`,
    `- Weakness score: ${audit?.weakness ?? 'not audited'}/100`,
    `- May we phone them? ${legal?.may_cold_call === true ? `Probably yes: their site says ${legal.form_on_site}${legal.kvk ? ` (KvK ${legal.kvk})` : ''}. Confirm in the KVK register first.` : legal?.may_cold_call === false ? `No: ${legal.form_on_site} needs consent before any call.` : 'Unknown: check the legal form in KVK before calling.'}`,
    '- Best time to visit: Tuesday–Thursday, 14:30–16:30.', '',
    '## Opening', '',
    '> “Goedemiddag! Is de eigenaar toevallig aanwezig? We hebben een nieuwe website voor jullie gemaakt, gratis en vrijblijvend. Mag ik hem even laten zien? Het duurt twee minuten.”', '',
    '## What to point at (their real weaknesses)', '', ...tpLines, '',
    '## Show on the phone, in this order', '',
    '1. The first screen: name, what they serve, the call/book button.',
    `2. The menu${c.menu?.searchable ? ': tap a category, then search a dish by name or number' : ''}.`,
    '3. Opening hours with the live “open now” badge, then the directions button.',
    '4. Switch to English at the top: the whole site is bilingual.',
    '5. Before/after image (pitch/before-after.png) if they say “we already have a website”.', '',
    '## Questions to ask the owner', '',
    '- Are the opening hours and menu prices still right? (We marked them unverified.)',
    '- Which photos may we use? Do you have better ones of the food and the room?',
    '- Who handles reservations, and which system do you use?',
    ...(c.groups?.enabled ? [] : ['- Do you take groups or parties? Which email or WhatsApp should enquiries go to?']),
    ...(fs.existsSync(path.join(dir, 'brief.md')) && /halal/i.test(fs.readFileSync(path.join(dir, 'brief.md'), 'utf8')) ? ['- (See brief) Should the site mention halal? Their old site shows a supplier certificate.'] : []), '',
    '## Objections', '',
    '| They say | We answer |', '|---|---|',
    '| “We already have a website.” | Show old and new side by side on the phone. |',
    '| “No time.” | “You don’t need any. We do it all; changes go by WhatsApp.” |',
    `| “Too expensive.” | €${studio.offer.monthly_eur}/month is about one extra table of two per month. |`,
    '| “My nephew made it.” | “Keep him! We can just keep it fast and updated.” Leave the card. |',
    '| “Send me something.” | “Sure, what’s the best email or WhatsApp?” That is their consent. |', '',
    '## After the visit', '',
    `- Log it: \`npm run status -- ${slug} --stage visited --note "who you spoke to, what they said"\``,
    '- Day 2: send the link only if they said yes to receiving it. Day 7: second visit (or call if BV/NV). Day 14: last check, then park for 3 months.',
  ].join('\n');
  writeText(path.join(out, 'talking-points.md'), md + '\n');
  setStage(slug, 'pitch-ready', { demo_url: demoUrl });
  return { out, demoUrl, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  if (!a._[0]) fail('usage: npm run pitch -- <slug> [--no-video]');
  const r = await pitch(a._[0], { video: !a['no-video'] });
  r.warnings.forEach((w) => console.log(`  ! ${w}`));
  for (const f of fs.readdirSync(r.out).filter((f) => !f.startsWith('.'))) console.log(`  ${rel(path.join(r.out, f))}`);
  console.log(`✓ pitch kit ready · demo URL ${r.demoUrl}`);
}
