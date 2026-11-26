#!/usr/bin/env node
// Step 9 — Launch on yes. Turns a demo into the client's live site, but only when the facts are confirmed.
//   npm run launch -- <slug> --check                 what still blocks the launch
//   npm run launch -- <slug> --url https://kiemfoei.nl   switch to live mode (after the checklist is done)
// Writes clients/<slug>/launch/checklist.md and handover-sheet.pdf ("how to request changes", NL + EN).
import fs from 'node:fs';
import path from 'node:path';
import { args, clientDir, fail, loadPlaywright, readJson, rel, studioConfig, today, writeJson, writeText } from './lib/util.mjs';
import { validateClient } from './lib/validate.mjs';
import { setStage } from './status.mjs';

function blockers(c) {
  const b = [];
  const m = c.media ?? {};
  if (c.hours?.unverified) b.push('Opening hours not confirmed by the owner (hours.unverified).');
  if (c.menu?.unverified) b.push('Menu and prices not confirmed by the owner (menu.unverified).');
  if ([m.hero, m.story, ...(m.gallery ?? [])].filter(Boolean).some((i) => i.origin === 'stand-in')) b.push('Stand-in photos still in use: replace with the client’s own.');
  if ([m.hero, m.story, ...(m.gallery ?? [])].filter(Boolean).some((i) => ['their-website', 'google-maps', 'their-instagram'].includes(i.origin))) b.push('Photos taken from public sources: get the owner’s written OK (or new photos) and set origin to "client".');
  if (c.groups?.enabled && c.groups.form?.method === 'endpoint') b.push('Group form stores guest data: sign a data-processing agreement (verwerkersovereenkomst) with the client.');
  if (!c.site?.analytics) b.push('Choose privacy-friendly statistics (site.analytics.provider, or "none").');
  if (c.booking?.provider === 'phone' && !c.booking?.label) b.push('Confirm how guests should book or order.');
  return b;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  const slug = a._[0];
  if (!slug) fail('usage: npm run launch -- <slug> --check | --url https://domain');
  const dir = clientDir(slug);
  const file = path.join(dir, 'content.json');
  const c = readJson(file);
  const studio = studioConfig();
  const b = blockers(c);
  const out = path.join(dir, 'launch');
  const checklist = [
    `# Launch checklist — ${c.business.name}`, '', `Updated ${today()}.`, '',
    '## Content (blocking)', '', ...(b.length ? b.map((x) => `- [ ] ${x}`) : ['- [x] Content confirmed']), '',
    '## Contract & money', '', '- [ ] Order form + general terms signed', `- [ ] 50% of setup paid (€${studio.offer.setup_eur / 2})`, '- [ ] SEPA direct-debit mandate for the monthly fee', '',
    '## Domain & hosting', '', '- [ ] Domain registered in the client’s name (fair-exit promise)', '- [ ] Site on a host whose plan allows commercial use (Vercel Pro or equivalent)', '- [ ] DNS pointed, HTTPS active, old site redirects to the new pages', '',
    '## Google', '', '- [ ] Google Business Profile: website link, hours and menu link updated', '- [ ] Submit sitemap.xml in Google Search Console', '',
    '## Handover', '', '- [ ] Send the handover sheet (launch/handover-sheet.pdf) and add the client to our WhatsApp changes list', '- [ ] Ask for the Google review and two introductions (founding clients)', '- [ ] Remaining 50% invoiced, monthly debit starts', '',
  ].join('\n');
  writeText(path.join(out, 'checklist.md'), checklist);

  // Handover sheet
  const people = studio.contact.people.map((p) => `<li><strong>${p.name}</strong> (${p.role}) · ${p.whatsapp ?? 'WhatsApp: to be added'}</li>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm; } body { font-family: Georgia, serif; color: #1d2a22; line-height: 1.45; }
    h1 { font-size: 24pt; margin: 0 0 4mm; } h2 { font-size: 13pt; margin: 7mm 0 2mm; } p, li { font-size: 10.5pt; } .en { color: #5d665f; }
    .box { border: 1px solid #234a36; border-radius: 3mm; padding: 4mm 5mm; margin-top: 5mm; }
  </style></head><body>
    <h1>${c.business.name}: zo vraag je een wijziging aan</h1><p class="en">How to request a change to your website</p>
    <h2>1. Stuur een WhatsApp</h2><p>Nieuw menu, andere prijs, vakantietijden, nieuwe foto’s: stuur het in één bericht. Foto of pdf mag ook.<br><span class="en">Send menu, price, holiday-hour or photo changes in one WhatsApp message. A photo or PDF is fine.</span></p>
    <h2>2. Wij passen het aan</h2><p>Kleine wijzigingen staan meestal binnen twee werkdagen online. Tot ongeveer een uur werk per maand zit in je abonnement.<br><span class="en">Small changes are usually live within two working days. About one hour of changes a month is included.</span></p>
    <h2>3. Elke maand een controle</h2><p>We kijken maandelijks of alles werkt: links, reserveerknop, tijden, snelheid.<br><span class="en">Every month we check that links, the booking button, hours and speed all work.</span></p>
    <div class="box"><p><strong>Contact</strong></p><ul>${people}</ul><p>${studio.contact.email ?? ''}</p></div>
    <p class="en" style="margin-top:8mm">Your domain is registered in your name. After the minimum term you can take the site with you (handover fee €150).</p>
  </body></html>`;
  fs.mkdirSync(out, { recursive: true });
  const tmp = path.join(out, 'handover.render.html');
  fs.writeFileSync(tmp, html);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file://${tmp}`);
  await page.pdf({ path: path.join(out, 'handover-sheet.pdf'), format: 'A4', printBackground: true });
  await browser.close();
  fs.rmSync(tmp);

  if (a.check || !a.url) {
    console.log(b.length ? `✗ ${b.length} blocker(s):\n  - ${b.join('\n  - ')}` : '✓ content is ready to launch');
    console.log(`  ${rel(path.join(out, 'checklist.md'))}\n  ${rel(path.join(out, 'handover-sheet.pdf'))}`);
    process.exit(b.length ? 1 : 0);
  }
  if (b.length) fail(`not launching, fix first:\n  - ${b.join('\n  - ')}`);
  c.mode = 'live';
  c.site = { ...(c.site ?? {}), url: String(a.url).replace(/\/$/, '') };
  writeJson(file, c);
  const { errors } = validateClient(slug);
  if (errors.length) fail(`content invalid after switching to live:\n  - ${errors.join('\n  - ')}`);
  setStage(slug, 'live', { site_url: c.site.url });
  console.log(`✓ ${slug} is now in live mode for ${c.site.url}. Next: npm run qa -- ${slug}, then deploy the client site (see checklist).`);
}
