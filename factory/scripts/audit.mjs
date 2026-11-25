#!/usr/bin/env node
// Step 1 — Audit. Scores how weak a lead's current website is (0 = great, 100 = no site / broken)
// and writes the three talking points Adam can show the owner in ten seconds.
//   npm run audit -- <lead-id|name> [<lead-id> ...]
//   npm run audit -- --city Rotterdam [--limit 20]
//   npm run audit -- --url https://example.nl --name "Some Café"
// Output: clients/_audits/<lead-id>.json + <lead-id>-mobile.png, and clients/_audits/summary.md
import fs from 'node:fs';
import path from 'node:path';
import { args, CLIENTS, fail, findLead, loadLeads, loadPlaywright, readJson, rel, slugify, today, writeJson, writeText } from './lib/util.mjs';
import { analyse, loadPage, normalizeUrl } from './lib/probe.mjs';

const AUDITS = path.join(CLIENTS, '_audits');
const DINING = /restaurant|bistro|brasserie|dining|eetcafé|eetcafe|kitchen|keuken|grill/i;

// Each signal: weight (points of weakness), what Adam says (EN + NL), what our demo fixes.
const SIGNALS = {
  no_website: { w: 100, en: 'You have no website, so guests who search for you only find third-party listings.', nl: 'Jullie hebben geen website, dus wie jullie zoekt vindt alleen andermans pagina’s.', fix: 'A complete site with menu, hours, map and a booking or call button.' },
  site_down: { w: 60, en: 'Your website does not load at the moment.', nl: 'Jullie website laadt op dit moment niet.', fix: 'A fast, reliable site on modern hosting.' },
  not_https: { w: 12, en: 'Browsers mark your site as “not secure”.', nl: 'Browsers tonen jullie site als ‘niet veilig’.', fix: 'HTTPS on every page.' },
  cert_error: { w: 20, en: 'Your site shows a security warning before it opens.', nl: 'Jullie site geeft een beveiligingswaarschuwing voordat hij opent.', fix: 'A valid certificate, renewed automatically.' },
  no_viewport: { w: 15, en: 'On a phone your site shows as a shrunken desktop page.', nl: 'Op een telefoon zie je een verkleinde desktoppagina.', fix: 'Designed for the phone first.' },
  mobile_overflow: { w: 15, en: 'On a phone the page slides sideways; parts fall off the screen.', nl: 'Op een telefoon schuift de pagina opzij; stukken vallen buiten beeld.', fix: 'Every section fits a phone screen exactly.' },
  slow_mobile: { w: 15, en: 'Your site is slow on a phone (PageSpeed {psi}/100); many guests leave before it loads.', nl: 'Jullie site is traag op een telefoon (PageSpeed {psi}/100); veel gasten haken af.', fix: 'A site that scores 90+ on PageSpeed mobile.' },
  meh_mobile: { w: 7, en: 'Your site could be faster on a phone (PageSpeed {psi}/100).', nl: 'Jullie site kan sneller op een telefoon (PageSpeed {psi}/100).', fix: 'A site that scores 90+ on PageSpeed mobile.' },
  heavy_page: { w: 8, en: 'Your homepage downloads {mb} MB, which is slow on 4G.', nl: 'Jullie homepage is {mb} MB, dat is traag op 4G.', fix: 'Optimised photos: the whole page under 1.5 MB.' },
  menu_pdf: { w: 15, en: 'Your menu is a PDF: hard to read on a phone and invisible to Google.', nl: 'Jullie menu is een pdf: lastig te lezen op een telefoon en onzichtbaar voor Google.', fix: 'The menu as real text: readable, searchable, findable in Google.' },
  menu_image: { w: 15, en: 'Your menu is a photo: hard to read on a phone and invisible to Google.', nl: 'Jullie menu is een foto: lastig te lezen op een telefoon en onzichtbaar voor Google.', fix: 'The menu as real text.' },
  no_menu: { w: 12, en: 'There is no menu on your website, which is the first thing guests look for.', nl: 'Er staat geen menu op jullie site, terwijl gasten daar als eerste naar zoeken.', fix: 'The full menu with prices, in Dutch and English.' },
  no_booking: { w: 10, en: 'There is no booking button; guests have to call during service.', nl: 'Er is geen reserveerknop; gasten moeten bellen tijdens de service.', fix: 'A booking button on every screen, using your current system.' },
  no_booking_bar: { w: 4, en: 'There is no easy way to reserve a table or ask about groups.', nl: 'Er is geen makkelijke manier om te reserveren of een groep aan te vragen.', fix: 'A clear booking/group button.' },
  no_english: { w: 10, en: 'There is no English version, while many of your guests are tourists and internationals.', nl: 'Er is geen Engelse versie, terwijl veel gasten toeristen en expats zijn.', fix: 'The whole site in Dutch and English.' },
  dated: { w: 10, en: 'The design looks dated next to the experience you offer in person.', nl: 'Het ontwerp oogt verouderd naast wat jullie in het echt bieden.', fix: 'A modern design that matches the place.' },
  no_tel: { w: 5, en: 'Guests can’t tap your phone number to call.', nl: 'Gasten kunnen niet op jullie nummer tikken om te bellen.', fix: 'Tap-to-call and tap-for-directions.' },
  tiny_text: { w: 5, en: 'Much of the text is too small to read on a phone.', nl: 'Veel tekst is te klein om op een telefoon te lezen.', fix: 'Readable type sizes everywhere.' },
  no_seo_basics: { w: 4, en: 'Google gets little information about you (no structured data or share image).', nl: 'Google krijgt weinig informatie over jullie (geen gestructureerde data of deelafbeelding).', fix: 'Restaurant data for Google: hours, menu, location.' },
  thin_homepage: { w: 10, en: 'Your homepage says almost nothing: no menu, story or hours on the first screen.', nl: 'Jullie homepage vertelt bijna niets: geen menu, verhaal of openingstijden in beeld.', fix: 'A homepage that answers what, when, where and how to book in one scroll.' },
  js_errors: { w: 3, en: 'Parts of the site throw errors in the browser.', nl: 'Delen van de site geven fouten in de browser.', fix: 'Clean, tested code.' },
};

async function pageSpeed(url) {
  // Key goes in a header so a proxy can inject it (cloud sessions); locally set PAGESPEED_API_KEY.
  const key = process.env.PAGESPEED_API_KEY;
  const q = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' });
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { headers: key ? { 'X-Goog-Api-Key': key } : {}, signal: AbortSignal.timeout(90000) });
    if (!res.ok) return { error: `PageSpeed API ${res.status}${res.status === 429 ? ' (set PAGESPEED_API_KEY)' : ''}` };
    const data = await res.json();
    const lh = data.lighthouseResult;
    return { score: Math.round((lh?.categories?.performance?.score ?? 0) * 100), lcp: lh?.audits?.['largest-contentful-paint']?.displayValue, cls: lh?.audits?.['cumulative-layout-shift']?.displayValue };
  } catch (err) {
    return { error: `PageSpeed API unreachable: ${err.message}` };
  }
}

function fillVars(s, v) {
  return s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
}

export async function auditLead(lead, browser, { psi = true } = {}) {
  const id = lead.id ?? slugify(`${lead.name}-${lead.city ?? ''}`);
  const found = [];
  const evidence = {};
  const hit = (key, ev, vars = {}) => {
    found.push({ key, weight: SIGNALS[key].w, say_en: fillVars(SIGNALS[key].en, vars), say_nl: fillVars(SIGNALS[key].nl, vars), demo_fix: SIGNALS[key].fix });
    if (ev) evidence[key] = ev;
  };
  const result = { id, name: lead.name, city: lead.city, website: lead.website ?? null, audited_on: today(), lead: { rating: lead.rating, reviews: lead.reviews, profile: lead.profile, category: lead.category, phone: lead.phone, score: lead.score } };

  const url = normalizeUrl(lead.website);
  if (!url) {
    hit('no_website');
  } else {
    let page = await loadPage(browser, url, { screenshot: true });
    if (!page.ok && url.startsWith('https://')) {
      const http = await loadPage(browser, url.replace('https://', 'http://'), { screenshot: true });
      if (http.ok) { page = http; hit('not_https', 'only loads over http'); }
      else if (page.certError) hit('cert_error', page.certError);
    }
    if (!page.ok) {
      hit('site_down', page.error);
    } else {
      result.final_url = page.finalUrl;
      if (page.finalUrl.startsWith('http://') && !found.some((f) => f.key === 'not_https')) hit('not_https', page.finalUrl);
      const a = analyse(page.html, page.finalUrl);
      result.page = { title: a.title, load_ms: page.loadMs, transfer_mb: +(page.bytes / 1048576).toFixed(2), requests: page.requests, overflow_px: Math.max(0, Math.round(page.overflow)), small_text_ratio: +page.smallTextRatio.toFixed(2), generator: a.generator || null, jquery: a.jquery, copyright_year: a.copyrightYear };
      if (!a.viewport) hit('no_viewport', 'no <meta name="viewport">');
      else if (page.overflow > 8) hit('mobile_overflow', `${Math.round(page.overflow)}px wider than the phone screen`);
      const words = (page.text ?? '').split(/\s+/).filter((w) => w.length > 1).length;
      result.page.words = words;
      if (words < 60) hit('thin_homepage', `${words} words of visible text on the homepage`);
      if (page.smallTextRatio > 0.3) hit('tiny_text', `${Math.round(page.smallTextRatio * 100)}% of text under 12px`);

      if (psi) {
        result.pagespeed = await pageSpeed(page.finalUrl);
        const s = result.pagespeed.score;
        if (typeof s === 'number') {
          if (s < 50) hit('slow_mobile', `PageSpeed mobile ${s}`, { psi: s });
          else if (s < 90) hit('meh_mobile', `PageSpeed mobile ${s}`, { psi: s });
        }
      }
      if (typeof result.pagespeed?.score !== 'number' && page.bytes > 3 * 1048576) hit('heavy_page', `${(page.bytes / 1048576).toFixed(1)} MB transferred`, { mb: (page.bytes / 1048576).toFixed(1) });

      // Menu: PDF / image / missing. Follow the first menu link to see if the menu page has real prices.
      if (a.pdfMenus.length) hit('menu_pdf', a.pdfMenus.map((l) => l.href).slice(0, 3));
      else if (a.imageMenus.length) hit('menu_image', a.imageMenus.map((l) => l.href).slice(0, 3));
      else {
        const menuPage = a.menuLinks.find((l) => l.href.startsWith(new URL(page.finalUrl).origin) && !/\.(pdf|jpe?g|png)$/i.test(l.href));
        let prices = a.pricesInHtml;
        if (menuPage) {
          const mp = await loadPage(browser, menuPage.href);
          if (mp.ok) {
            const ma = analyse(mp.html, mp.finalUrl);
            prices = Math.max(prices, ma.pricesInHtml);
            if (ma.pdfMenus.length) hit('menu_pdf', ma.pdfMenus.map((l) => l.href).slice(0, 3));
            else if (ma.imageMenus.length) hit('menu_image', ma.imageMenus.map((l) => l.href).slice(0, 3));
            else if (prices < 3) {
              const imgsOnly = mp.imgs.filter((i) => i.w > 700 && i.h > 900).length;
              if (imgsOnly) hit('menu_image', `${menuPage.href}: menu appears to be images (${imgsOnly} tall images, ${prices} prices in text)`);
            }
            result.menu_page = menuPage.href;
          }
        }
        if (!menuPage && prices < 3 && !found.some((f) => f.key.startsWith('menu_'))) hit('no_menu', 'no menu link or prices found');
      }

      const isDining = DINING.test(`${lead.category ?? ''} ${lead.name}`);
      if (!a.booking) hit(isDining ? 'no_booking' : 'no_booking_bar', 'no booking provider or reservation link');
      else result.booking = a.booking;
      if (!a.english) hit('no_english', `html lang="${a.htmlLang || '?'}", no English link or hreflang`);
      const datedReasons = [];
      if (a.copyrightYear && a.copyrightYear <= 2020) datedReasons.push(`© ${a.copyrightYear}`);
      if (a.jquery && Number(a.jquery.split('.')[0]) < 2) datedReasons.push(`jQuery ${a.jquery}`);
      if (a.flash) datedReasons.push('Flash objects');
      if (a.tables > 3) datedReasons.push(`${a.tables} layout tables`);
      if (/WordPress [1-4]\.|Joomla! 1\.|Joomla! 2\./i.test(a.generator)) datedReasons.push(a.generator);
      if (!a.viewport) datedReasons.push('not responsive');
      if (datedReasons.length >= 1) hit('dated', datedReasons);
      if (!a.tel.length) hit('no_tel', 'no tel: link on the homepage');
      if (!a.business && !a.ogImage) hit('no_seo_basics', 'no JSON-LD business data and no og:image');
      if (page.jsErrors.length > 2) hit('js_errors', page.jsErrors.slice(0, 3));

      if (page.shot) {
        fs.mkdirSync(AUDITS, { recursive: true });
        fs.writeFileSync(path.join(AUDITS, `${id}-mobile.png`), page.shot);
        result.screenshot = `${id}-mobile.png`;
      }
    }
  }

  found.sort((x, y) => y.weight - x.weight);
  result.weakness = Math.min(100, found.reduce((n, f) => n + f.weight, 0));
  result.signals = found.map(({ key, weight }) => ({ key, weight }));
  result.evidence = evidence;
  result.talking_points = found.slice(0, 3).map(({ key, say_en, say_nl, demo_fix }) => ({ key, say_en, say_nl, demo_fix }));
  return result;
}

function summary() {
  const files = fs.existsSync(AUDITS) ? fs.readdirSync(AUDITS).filter((f) => f.endsWith('.json')) : [];
  const rows = files.map((f) => readJson(path.join(AUDITS, f))).sort((a, b) => b.weakness - a.weakness);
  const lines = [
    '# Website audits', '', `Updated ${today()}. Weakness 0–100: higher means a weaker current site (bigger opportunity).`, '',
    '| Weakness | Business | City | Rating | Top talking point | Audited |', '|---:|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.weakness} | ${r.name} | ${r.city ?? ''} | ${r.lead?.rating ?? ''} (${r.lead?.reviews ?? '?'}) | ${r.talking_points[0]?.say_en ?? '—'} | ${r.audited_on} |`),
  ];
  writeText(path.join(AUDITS, 'summary.md'), lines.join('\n') + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args();
  let leads = [];
  if (a.url) leads = [{ id: slugify(a.name ?? new URL(normalizeUrl(a.url)).hostname), name: a.name ?? a.url, website: a.url, city: a.city }];
  else if (a.city) leads = loadLeads().filter((l) => l.city?.toLowerCase() === String(a.city).toLowerCase()).slice(0, Number(a.limit ?? 999));
  else leads = a._.map((q) => findLead(q) ?? fail(`lead not found: ${q}`));
  if (!leads.length) fail('usage: npm run audit -- <lead-id|name> ... | --city Rotterdam | --url https://… --name "…"');
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    for (const lead of leads) {
      process.stdout.write(`→ ${lead.name} … `);
      const r = await auditLead(lead, browser, { psi: !a['no-psi'] });
      writeJson(path.join(AUDITS, `${r.id}.json`), r);
      console.log(`weakness ${r.weakness}${r.pagespeed?.error ? ` (${r.pagespeed.error})` : ''}`);
      r.talking_points.forEach((t) => console.log(`    · ${t.say_en}`));
    }
  } finally {
    await browser.close();
  }
  summary();
  console.log(`\n✓ ${rel(path.join(AUDITS, 'summary.md'))}`);
}
