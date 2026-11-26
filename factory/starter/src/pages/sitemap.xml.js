import content from '../client/content.json';

export function GET() {
  const url = content.site?.url?.replace(/\/$/, '');
  if (content.mode !== 'live' || !url) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', { headers: { 'Content-Type': 'application/xml' } });
  }
  const today = new Date().toISOString().slice(0, 10);
  const entry = (loc, alt) => `<url><loc>${loc}</loc><lastmod>${today}</lastmod>${alt.map(([l, h]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${h}"/>`).join('')}</url>`;
  const alts = [['nl', `${url}/`], ['en', `${url}/en/`], ['x-default', `${url}/`]];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entry(`${url}/`, alts)}${entry(`${url}/en/`, alts)}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
