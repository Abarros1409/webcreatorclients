#!/usr/bin/env node
// Step 3 — Collect. Gathers a lead's public information into clients/<slug>/:
//   collected/pages/*.txt     rendered text of the homepage + menu/about/contact pages
//   collected/pdf/*.txt       PDF menus converted to text (pdftotext -layout)
//   collected/facts.json      everything extracted, each with its source URL (provenance)
//   collected/images.json     downloaded photos with source URL and size
//   photos/source/*           the downloaded images (pick + rename into photos/ during Generate)
//   content.json              draft with every deterministic field filled; TODO markers for Generate
//   brief.md                  the one-page brief Generate works from
//   status.json               pipeline stage
//   npm run collect -- <lead-id|name> [--max-pages 10] [--max-images 24]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { args, CLIENTS, clientDir, fail, findLead, loadPlaywright, readJson, rel, slugify, today, token, writeJson, writeText } from './lib/util.mjs';
import { analyse, loadPage, normalizeUrl, toE164 } from './lib/probe.mjs';
import { setStage } from './status.mjs';

const KIND_RULES = [
  [/fine dining|michelin|tasting/i, 'fine-dining', 'Restaurant', 'dining'],
  [/wine|wijn/i, 'wine-bar', 'BarOrPub', 'dining'],
  [/cocktail/i, 'cocktail-bar', 'BarOrPub', 'dining'],
  [/sports/i, 'sports-bar', 'BarOrPub', 'street-food'],
  [/beer|bier|brew|tap/i, 'beer-bar', 'BarOrPub', 'brown-cafe'],
  [/brown|bruin|eetcaf|grand caf/i, 'brown-cafe', 'BarOrPub', 'brown-cafe'],
  [/coffee|koffie|brunch|lunch|bakery|bakker|espresso/i, 'coffee-brunch', 'CafeOrCoffeeShop', 'coffee-brunch'],
  [/takeaway|afhaal|snack|fast ?food|eethuis|toko|grill|kebab|shoarma|pizza|burger|street/i, 'eethuis', 'Restaurant', 'street-food'],
  [/restaurant|bistro|brasserie|kitchen/i, 'restaurant', 'Restaurant', 'dining'],
];

export function guessKind(lead) {
  const s = `${lead.category ?? ''} ${lead.name ?? ''} ${lead.summary ?? ''}`;
  for (const [re, kind, schema, look] of KIND_RULES) if (re.test(s)) return { kind, schema_type: schema, look };
  return { kind: 'other', schema_type: 'FoodEstablishment', look: 'brown-cafe' };
}

function parseAddress(addr) {
  const m = String(addr ?? '').match(/^(.*?),\s*(\d{4}\s?[A-Z]{2})\s+(.+)$/);
  return m ? { street: m[1].trim(), postal_code: m[2].replace(/(\d{4})([A-Z]{2})/, '$1 $2'), city: m[3].trim(), country: 'NL' } : null;
}

async function geocode(address) {
  // PDOK Locatieserver: the Dutch government's free geocoder (no key). Needs network access to api.pdok.nl.
  try {
    const q = new URLSearchParams({ q: `${address.street} ${address.postal_code} ${address.city}`, rows: '1', fq: 'type:adres' });
    const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${q}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const doc = (await res.json()).response?.docs?.[0];
    const m = doc?.centroide_ll?.match(/POINT\(([\d.]+) ([\d.]+)\)/);
    return m ? { lat: Number(m[2]), lng: Number(m[1]), source: 'PDOK Locatieserver' } : null;
  } catch {
    return null;
  }
}

async function download(url, file) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Mozilla/5.0 (factory collect)' } });
  if (!res.ok) throw new Error(`${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf.length;
}

function imageSize(file) {
  try {
    const out = execFileSync('identify', ['-format', '%w %h', `${file}[0]`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const [w, h] = out.trim().split(' ').map(Number);
    return { w, h };
  } catch {
    return null;
  }
}

function hexOf(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
function isNeutral(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) < 24;
}

export async function collect(lead, { maxPages = 10, maxImages = 24 } = {}) {
  const slug = slugify(lead.name.replace(/^(cafe|café|restaurant|bar|eetcafe|eetcafé)\s+/i, (m) => m)).replace(/-rotterdam$/, '');
  const dir = clientDir(slug);
  const col = path.join(dir, 'collected');
  for (const d of ['pages', 'pdf']) fs.mkdirSync(path.join(col, d), { recursive: true });
  fs.mkdirSync(path.join(dir, 'photos', 'source'), { recursive: true });

  const facts = { lead_id: lead.id, collected_on: today(), from_lead_list: { ...lead }, website: null, sources: [] };
  const addSource = (url, what) => facts.sources.push({ url, what, fetched_on: today() });
  const images = [];
  const url = normalizeUrl(lead.website);
  const { kind, schema_type, look } = guessKind(lead);

  if (url) {
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch();
    try {
      const home = await loadPage(browser, url);
      if (!home.ok) throw new Error(`homepage did not load: ${home.error}`);
      facts.website = home.finalUrl;
      const a = analyse(home.html, home.finalUrl);
      addSource(home.finalUrl, 'homepage');
      writeText(path.join(col, 'pages', '00-home.txt'), `# ${home.finalUrl}\n# ${a.title}\n\n${home.text}`);
      Object.assign(facts, {
        title: a.title, meta_description: a.description, html_lang: a.htmlLang, theme_color: a.themeColor,
        jsonld_business: a.business ?? null, tel: a.tel, email: a.mail, social: a.social,
        booking: a.booking, ordering: a.ordering, pdf_menus: a.pdfMenus.map((l) => l.href), image_menus: a.imageMenus.map((l) => l.href),
        logo_candidates: [], colours: [],
      });
      const pageImgs = [...home.imgs.map((i) => ({ ...i, page: home.finalUrl }))];
      // Lightbox links: thumbnails that open the full-size photo.
      const lightbox = (an, page) => an.links.filter((l) => /\.(jpe?g|png|webp)(\?|$)/i.test(l.href) && !/menu|kaart/i.test(l.href)).map((l) => ({ src: l.href, w: 0, h: 0, alt: l.text, cls: 'lightbox', inHeader: false, page }));
      pageImgs.push(...lightbox(a, home.finalUrl));
      const legal = (text) => {
        const kvk = text.match(/k\.?v\.?k\.?[\s:.-]*(?:nr\.?|nummer)?[\s:.-]*(\d{8})/i)?.[1];
        const form = text.match(/\b(B\.\s?V\.|BV|N\.\s?V\.|V\.\s?O\.\s?F\.|VOF|eenmanszaak|Holding B\.?V\.?)(?=[\s,.|-]|$)/)?.[1];
        return { kvk, form };
      };
      const lg = legal(home.text);
      const colourVotes = { ...home.colours };

      // Sub-pages most likely to hold menu, story, hours, groups.
      const pages = a.pages.slice(0, maxPages);
      let n = 1;
      for (const p of pages) {
        const r = await loadPage(browser, p);
        if (!r.ok) continue;
        const pa = analyse(r.html, r.finalUrl);
        addSource(r.finalUrl, 'page');
        writeText(path.join(col, 'pages', `${String(n++).padStart(2, '0')}-${slugify(new URL(r.finalUrl).pathname) || 'page'}.txt`), `# ${r.finalUrl}\n# ${pa.title}\n\n${r.text}`);
        pageImgs.push(...r.imgs.map((i) => ({ ...i, page: r.finalUrl })), ...lightbox(pa, r.finalUrl));
        const lp = legal(r.text);
        lg.kvk ??= lp.kvk; lg.form ??= lp.form;
        for (const [c, v] of Object.entries(r.colours)) colourVotes[c] = (colourVotes[c] ?? 0) + v / 2;
        for (const pdf of pa.pdfMenus) if (!facts.pdf_menus.includes(pdf.href)) facts.pdf_menus.push(pdf.href);
        if (!facts.booking && pa.booking) facts.booking = pa.booking;
        if (!facts.ordering && pa.ordering) facts.ordering = pa.ordering;
        for (const k of Object.keys(pa.social)) facts.social[k] ??= pa.social[k];
        facts.tel = [...new Set([...facts.tel, ...pa.tel])];
        facts.email = [...new Set([...facts.email, ...pa.mail])];
        if (!facts.jsonld_business && pa.business) facts.jsonld_business = pa.business;
      }

      // Legal form decides whether Adam may phone (BV/NV yes; eenmanszaak/vof/maatschap only with consent).
      const formNorm = lg.form ? lg.form.replace(/[\s.]/g, '').toUpperCase() : null;
      facts.legal = {
        kvk: lg.kvk ?? null,
        form_on_site: formNorm,
        may_cold_call: formNorm ? ['BV', 'NV', 'HOLDINGBV'].includes(formNorm) : null,
        note: formNorm ? `Found "${lg.form}" on their website. Confirm in the KVK register before calling.` : 'Legal form not on the website: check KVK before any call.',
      };

      // PDF menus -> text.
      let pi = 1;
      for (const pdf of facts.pdf_menus.slice(0, 6)) {
        const file = path.join(col, 'pdf', `menu-${pi++}.pdf`);
        try {
          await download(pdf, file);
          execFileSync('pdftotext', ['-layout', file, file.replace(/\.pdf$/, '.txt')]);
          addSource(pdf, 'pdf menu');
        } catch (err) {
          facts.sources.push({ url: pdf, what: 'pdf menu (download failed)', error: String(err.message) });
        }
      }

      // Photos: biggest first, skip icons and duplicates.
      const seen = new Set();
      const cands = pageImgs
        .filter((i) => i.src && !i.src.startsWith('data:') && !/\.svg(\?|$)/i.test(i.src) && !/sprite|icon|favicon|pixel|tracking|emoji|flag/i.test(i.src))
        .map((i) => ({ ...i, area: (i.w || 0) * (i.h || 0) }))
        .sort((x, y) => y.area - x.area)
        .filter((i) => { const k = i.src.split('?')[0]; if (seen.has(k)) return false; seen.add(k); return true; });
      const logos = pageImgs.filter((i) => /logo/i.test(i.src + ' ' + i.alt + ' ' + i.cls) || i.inHeader);
      let k = 1;
      for (const img of cands) {
        if (images.length >= maxImages) break;
        if ((img.w && img.w < 500) || (img.h && img.h < 350)) continue; // unknown sizes (lightbox) are checked after download
        const ext = (img.src.split('?')[0].match(/\.(jpe?g|png|webp|avif)$/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg');
        const name = `src-${String(k).padStart(2, '0')}.${ext}`;
        const file = path.join(dir, 'photos', 'source', name);
        try {
          await download(img.src, file);
          const size = imageSize(file);
          if (!size || size.w < 500) { fs.rmSync(file); continue; }
          images.push({ file: `source/${name}`, width: size.w, height: size.h, source_url: img.src, page: img.page, alt_on_site: img.alt, origin: 'their-website' });
          k++;
        } catch { /* skip */ }
      }
      for (const [j, logo] of logos.slice(0, 3).entries()) {
        const ext = (logo.src.split('?')[0].match(/\.(jpe?g|png|webp|svg)$/i)?.[1] ?? 'png').toLowerCase();
        const name = `logo-${j + 1}.${ext}`;
        try {
          await download(logo.src, path.join(dir, 'photos', 'source', name));
          facts.logo_candidates.push({ file: `source/${name}`, source_url: logo.src });
        } catch { /* skip */ }
      }
      facts.colours = Object.entries(colourVotes)
        .map(([c, v]) => [hexOf(c), v]).filter(([h]) => h && !isNeutral(h))
        .reduce((acc, [h, v]) => { acc[h] = (acc[h] ?? 0) + v; return acc; }, {});
      facts.colours = Object.entries(facts.colours).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([hex, votes]) => ({ hex, votes: Math.round(votes) }));
    } finally {
      await browser.close();
    }
  }

  // Deterministic draft. Everything marked TODO is Generate's job (Claude), and QA fails while any TODO remains.
  const address = parseAddress(lead.address) ?? { street: 'TODO street', postal_code: '0000 AA', city: lead.city ?? 'TODO' };
  const geo = await geocode(address);
  if (geo) addSource('https://api.pdok.nl/bzk/locatieserver', `geocode (${geo.source})`);
  const phone = toE164(lead.phone ?? facts.tel?.[0]);
  const L = (s) => ({ nl: `TODO ${s}`, en: `TODO ${s}` });
  const existing = readJson(path.join(dir, 'content.json'), null);
  const draft = {
    schema_version: 1,
    slug,
    mode: 'demo',
    look,
    business: {
      name: lead.name.replace(/^Cafe /, 'Café '),
      kind, schema_type,
      tagline: L('one line in their voice'),
      intro: L('two sentences: what it is and what makes it theirs'),
      story: { title: L('story title'), body: L('two short paragraphs from their own words') },
    },
    contact: {
      ...(phone ? { phone, phone_display: lead.phone } : {}),
      ...(facts.email?.[0] ? { email: facts.email[0] } : {}),
      address,
      ...(geo ? { geo: { lat: geo.lat, lng: geo.lng } } : {}),
      maps_url: lead.maps_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address ?? ''}`)}`,
    },
    hours: { timezone: 'Europe/Amsterdam', regular: [], unverified: true },
    booking: facts.booking?.url && facts.booking.provider !== 'unknown'
      ? { provider: facts.booking.provider, url: facts.booking.url }
      : { provider: phone ? 'phone' : 'none' },
    ...(facts.ordering?.url ? { ordering: { url: facts.ordering.url, provider: facts.ordering.provider } } : {}),
    links: Object.fromEntries(Object.entries({ ...(facts.social ?? {}), google_reviews: lead.maps_url, current_website: facts.website ?? undefined }).filter(([, v]) => v)),
    reviews: lead.rating ? { rating: lead.rating, count: lead.reviews ?? 0, source: lead.rating_source ?? 'Google', ...(lead.maps_url ? { url: lead.maps_url } : {}), checked_on: today(), highlights: [] } : undefined,
    groups: { enabled: true, title: L('groups title'), body: L('groups text'), form: { method: facts.email?.[0] ? 'mailto' : 'whatsapp', to: facts.email?.[0] ?? (phone?.startsWith('+316') ? phone : undefined) } },
    media: {},
    seo: { title: L('page title (≤ 60 chars)'), description: L('meta description (≤ 155 chars)') },
    demo: { token: existing?.demo?.token ?? token(6), made_on: today() },
  };
  if (!draft.groups.form.to) delete draft.groups.form;
  if (!draft.reviews) delete draft.reviews;
  if (existing && !process.argv.includes('--force')) {
    writeJson(path.join(dir, 'content.collected.json'), draft);
  } else {
    writeJson(path.join(dir, 'content.json'), draft);
  }
  writeJson(path.join(col, 'facts.json'), facts);
  writeJson(path.join(col, 'images.json'), images);

  // Brief for Generate.
  const audit = readJson(path.join(CLIENTS, '_audits', `${lead.id}.json`), null);
  const brief = [
    `# Brief — ${lead.name}`, '',
    `- Lead: \`${lead.id}\` · ${lead.category ?? ''} · ${lead.city ?? ''}`,
    `- Rating: ${lead.rating ?? '?'} (${lead.reviews ?? '?'} reviews, ${lead.rating_source ?? 'Google'})`,
    `- Current site: ${facts.website ?? 'none'}`,
    `- Suggested look: **${look}** (kind: ${kind}) — confirm with \`npm run looks -- ${slug}\``,
    `- Demo URL path: /${slug}-${draft.demo.token}/`, '',
    '## Why they need us (audit)', '',
    ...(audit ? [`Weakness ${audit.weakness}/100.`, '', ...audit.talking_points.map((t) => `- ${t.say_en} → **Demo:** ${t.demo_fix}`)] : ['Not audited yet: run `npm run audit -- ' + lead.id + '`.']), '',
    '## What we know', '',
    `- From the lead list: ${lead.summary ?? '—'}`,
    `- Guests say (summary, not quotable): ${lead.sentiment ?? '—'}`,
    `- Booking: ${facts.booking ? `${facts.booking.provider} ${facts.booking.url ?? ''}` : 'none found'}`,
    `- Ordering: ${facts.ordering ? `${facts.ordering.provider} ${facts.ordering.url ?? ''}` : 'none found'}`,
    `- Menu: ${facts.pdf_menus?.length ? `PDF (${facts.pdf_menus.length}) → collected/pdf/*.txt` : 'see collected/pages/*.txt'}`,
    `- Social: ${Object.entries(facts.social ?? {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'none found'}`,
    `- Brand colours seen: ${(facts.colours ?? []).map((c) => c.hex).join(' ') || '—'}`,
    `- Photos downloaded: ${images.length} (photos/source/, see collected/images.json)`,
    `- Logo candidates: ${(facts.logo_candidates ?? []).map((l) => l.file).join(', ') || 'none'}`,
    `- Legal form: ${facts.legal?.form_on_site ?? 'unknown'}${facts.legal?.kvk ? ` (KvK ${facts.legal.kvk})` : ''} → ${facts.legal?.may_cold_call === true ? 'may be phoned (confirm in KVK)' : facts.legal?.may_cold_call === false ? 'NO cold calls without consent' : 'check KVK before calling'}`,
    `- Geo: ${geo ? `${geo.lat}, ${geo.lng} (PDOK)` : 'not found (map embed hidden)'}`, '',
    '## Demo angle', '', 'TODO (Generate): one sentence — the thing the owner should see in ten seconds.', '',
    '## Check with the owner before launch', '',
    '- Opening hours (marked unverified)', '- Menu prices', '- Which photos they own and want to use', '- Booking system login / link', '',
  ].join('\n');
  if (!fs.existsSync(path.join(dir, 'brief.md')) || process.argv.includes('--force')) writeText(path.join(dir, 'brief.md'), brief);
  setStage(slug, 'collected', { lead_id: lead.id });
  return { slug, dir, facts, images };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  const lead = a._[0] ? findLead(a._[0]) : null;
  if (!lead) fail('usage: npm run collect -- <lead-id|name> [--force]');
  console.log(`→ collecting ${lead.name}`);
  const r = await collect(lead, { maxPages: Number(a['max-pages'] ?? 10), maxImages: Number(a['max-images'] ?? 24) });
  console.log(`✓ ${rel(r.dir)}: ${fs.readdirSync(path.join(r.dir, 'collected', 'pages')).length} pages, ${r.images.length} photos, ${r.facts.pdf_menus?.length ?? 0} PDF menus`);
  console.log(`  next: write content.json (Generate), then npm run build -- ${r.slug} --local`);
}
