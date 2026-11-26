// Opens a site in a real mobile browser (JS rendered) and extracts what audit + collect need.
import * as cheerio from 'cheerio';

export const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', locale: 'nl-NL' };

export const BOOKING = [
  ['zenchef', /zenchef\.(com|io)|bookings\.zenchef/i],
  ['formitable', /formitable\.(com|nl)/i],
  ['resengo', /resengo\.(com|nl|be)/i],
  ['opentable', /opentable\.(com|nl|co\.uk)/i],
  ['thefork', /thefork\.|lafourchette\./i],
  ['tablebooker', /tablebooker\./i],
  ['other', /eet\.nu\/.*reserv|bookingkit|guestplan|tableagent|teburu|seatme|dish\.co|quandoo|resmio/i],
];
export const ORDERING = [
  ['thuisbezorgd', /thuisbezorgd\.nl|just-?eat/i],
  ['ubereats', /ubereats\.com/i],
  ['deliveroo', /deliveroo\./i],
  ['own', /bestellen|order(ing)?\.|\/order|webshop|takeaway\.com/i],
];
const MENU_WORDS = /(menu|kaart|menukaart|eten|drinken|food|drinks|dranken|lunch|diner|dinner|brunch|ontbijt|breakfast|bier|beer|wijn|wine|cocktail|gerechten|dishes)/i;
const PAGE_WORDS = /(menu|kaart|over|about|verhaal|story|contact|reserv|book|groep|group|feest|party|event|agenda|evenement|openingstijden|hours|bier|beer|wijn|wine|lunch|diner|dinner|brunch)/i;

export function normalizeUrl(u) {
  if (!u) return null;
  let s = String(u).trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { return new URL(s).href; } catch { return null; }
}

/** Load a page in Playwright and return rendered HTML, text, metrics and a screenshot buffer. */
export async function loadPage(browser, url, { screenshot = false, timeout = 30000 } = {}) {
  const ctx = await browser.newContext({ ...MOBILE, ignoreHTTPSErrors: false });
  const page = await ctx.newPage();
  let bytes = 0;
  let requests = 0;
  const failures = [];
  page.on('response', async (res) => {
    requests++;
    const len = Number(res.headers()['content-length'] ?? 0);
    if (len) bytes += len;
  });
  page.on('pageerror', (e) => failures.push(String(e.message).slice(0, 140)));
  const t0 = Date.now();
  let res;
  let certError = null;
  try {
    res = await page.goto(url, { waitUntil: 'load', timeout });
  } catch (err) {
    if (/ERR_CERT|SSL|certificate/i.test(err.message)) certError = err.message.split('\n')[0];
    await ctx.close();
    return { ok: false, url, error: err.message.split('\n')[0], certError };
  }
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(1200);
  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth;
    let small = 0, total = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const text = n.textContent.trim();
      if (text.length < 3) continue;
      const el = n.parentElement;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      total += text.length;
      if (parseFloat(cs.fontSize) < 12) small += text.length;
    }
    // Colours actually used on prominent elements (for brand extraction).
    const colours = {};
    const add = (c, w) => { if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) colours[c] = (colours[c] ?? 0) + w; };
    document.querySelectorAll('header, nav, footer, a, button, h1, h2, h3, [class*="btn"], [class*="button"]').forEach((el) => {
      const cs = getComputedStyle(el);
      add(cs.backgroundColor, el.matches('header, nav, footer') ? 6 : 2);
      add(cs.color, el.matches('h1, h2, h3') ? 3 : 1);
    });
    // Large images actually rendered, including CSS backgrounds.
    const imgs = [];
    document.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.src;
      if (src) imgs.push({ src, w: img.naturalWidth, h: img.naturalHeight, alt: img.alt || '', cls: `${img.className} ${img.id}`.toLowerCase(), inHeader: !!img.closest('header, nav, [class*="logo"], [id*="logo"]') });
    });
    document.querySelectorAll('*').forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      const m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (m && !/gradient/.test(bg)) {
        const r = el.getBoundingClientRect();
        if (r.width > 300 && r.height > 200) imgs.push({ src: new URL(m[1], location.href).href, w: Math.round(r.width * 2), h: Math.round(r.height * 2), alt: '', cls: 'css-background', inHeader: false });
      }
    });
    return { overflow, smallTextRatio: total ? small / total : 0, colours, imgs, title: document.title, text: document.body?.innerText ?? '' };
  });
  const html = await page.content();
  const shot = screenshot ? await page.screenshot({ type: 'png' }) : null;
  const finalUrl = page.url();
  await ctx.close();
  return { ok: true, url, finalUrl, status: res?.status() ?? 0, loadMs, bytes, requests, jsErrors: failures, html, shot, ...layout };
}

/** Pure HTML analysis shared by audit and collect. */
export function analyse(html, baseUrl) {
  const $ = cheerio.load(html);
  const abs = (h) => { try { return new URL(h, baseUrl).href; } catch { return null; } };
  const origin = new URL(baseUrl).origin;
  const links = [];
  $('a[href]').each((_, a) => {
    const href = abs($(a).attr('href'));
    if (href) links.push({ href, text: $(a).text().replace(/\s+/g, ' ').trim(), title: $(a).attr('title') ?? '' });
  });
  const scripts = $('script[src]').map((_, s) => abs($(s).attr('src'))).get().filter(Boolean);
  const iframes = $('iframe[src]').map((_, s) => abs($(s).attr('src'))).get().filter(Boolean);
  const everything = [...links.map((l) => l.href), ...scripts, ...iframes, html.slice(0, 400000)].join('\n');

  const jsonld = [];
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const data = JSON.parse($(s).contents().text());
      const flat = Array.isArray(data) ? data : data['@graph'] ?? [data];
      jsonld.push(...flat);
    } catch { /* ignore broken JSON-LD */ }
  });
  const business = jsonld.find((d) => /Restaurant|Cafe|Bar|Pub|FoodEstablishment|LocalBusiness|Bakery|Winery/i.test([].concat(d['@type']).join(' ')));

  const menuLinks = links.filter((l) => MENU_WORDS.test(l.text + ' ' + l.href + ' ' + l.title));
  const pdfMenus = menuLinks.filter((l) => /\.pdf(\?|#|$)/i.test(l.href)).concat(links.filter((l) => /\.pdf(\?|#|$)/i.test(l.href) && MENU_WORDS.test(decodeURIComponent(l.href))));
  const imageMenus = menuLinks.filter((l) => /\.(jpe?g|png|webp)(\?|#|$)/i.test(l.href));
  const booking = BOOKING.find(([, re]) => re.test(everything));
  const bookingLink = links.find((l) => booking && booking[1].test(l.href)) ?? links.find((l) => /reserv|book a table|tafel/i.test(l.text));
  const ordering = ORDERING.find(([, re]) => re.test(links.map((l) => l.href + ' ' + l.text).join('\n')));
  const orderingLink = ordering ? links.find((l) => ordering[1].test(l.href + ' ' + l.text)) : null;
  const hreflangEn = $('link[rel="alternate"][hreflang^="en"]').length > 0;
  const langLinks = links.filter((l) => /^(en|eng|english)$/i.test(l.text) || /\/en(\/|$)|[?&]lang=en|\ben-gb\b|\ben-us\b/i.test(l.href) || /english/i.test(l.title));
  const htmlLang = ($('html').attr('lang') ?? '').toLowerCase();
  const tel = links.filter((l) => l.href.startsWith('tel:')).map((l) => l.href.slice(4));
  const mail = links.filter((l) => l.href.startsWith('mailto:')).map((l) => l.href.slice(7).split('?')[0]);
  const social = {
    instagram: links.find((l) => /instagram\.com\/[^/?#]+/i.test(l.href))?.href,
    facebook: links.find((l) => /facebook\.com\/[^/?#]+/i.test(l.href) && !/sharer|share\.php/i.test(l.href))?.href,
    tiktok: links.find((l) => /tiktok\.com\/@/i.test(l.href))?.href,
    untappd: links.find((l) => /untappd\.com\//i.test(l.href))?.href,
  };
  const text = $('body').text().replace(/\s+/g, ' ');
  const years = [...text.matchAll(/(?:©|copyright|&copy;)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1])).filter((y) => y > 1995 && y < 2100);
  const generator = $('meta[name="generator"]').attr('content') ?? '';
  const jquery = scripts.map((s) => s.match(/jquery[.-]?(\d)\.(\d+)/i)).find(Boolean);
  const pages = links
    .filter((l) => l.href.startsWith(origin) && !/\.(pdf|jpe?g|png|webp|gif|zip)(\?|#|$)/i.test(l.href) && PAGE_WORDS.test(l.text + ' ' + l.href))
    .map((l) => l.href.split('#')[0])
    .filter((h, i, arr) => arr.indexOf(h) === i && h !== baseUrl && h !== origin + '/');
  const pricesInHtml = (text.match(/(€\s?\d{1,3}[.,]\d{2})|(\b\d{1,2}[.,]\d{2}\b)/g) ?? []).length;

  return {
    title: $('title').text().trim(),
    description: $('meta[name="description"]').attr('content') ?? '',
    viewport: $('meta[name="viewport"]').attr('content') ?? null,
    ogImage: abs($('meta[property="og:image"]').attr('content')),
    favicon: abs($('link[rel~="icon"]').attr('href') ?? $('link[rel="apple-touch-icon"]').attr('href')),
    appleIcon: abs($('link[rel="apple-touch-icon"]').attr('href')),
    themeColor: $('meta[name="theme-color"]').attr('content') ?? null,
    htmlLang,
    english: hreflangEn || langLinks.length > 0 || htmlLang.startsWith('en'),
    englishLinks: langLinks.map((l) => l.href).slice(0, 3),
    menuLinks: menuLinks.slice(0, 12),
    pdfMenus: [...new Map(pdfMenus.map((l) => [l.href, l])).values()],
    imageMenus,
    pricesInHtml,
    booking: booking ? { provider: booking[0], url: bookingLink?.href ?? null } : bookingLink ? { provider: 'unknown', url: bookingLink.href } : null,
    ordering: ordering ? { provider: ordering[0], url: orderingLink?.href ?? null } : null,
    tel, mail, social,
    jsonld, business,
    copyrightYear: years.length ? Math.max(...years) : null,
    generator, jquery: jquery ? `${jquery[1]}.${jquery[2]}` : null,
    tables: $('table').length,
    flash: $('object, embed').filter((_, e) => /flash|swf/i.test($.html(e))).length,
    pages,
    links,
  };
}

/** Dutch phone number -> E.164 (+31...). Returns null when it can't be sure. */
export function toE164(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
  if (d.startsWith('0') && d.length === 10) return '+31' + d.slice(1);
  return null;
}
