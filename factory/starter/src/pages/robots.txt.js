import content from '../client/content.json';

// Demos are private: block every crawler. Live sites allow indexing and point to the sitemap.
export function GET() {
  const live = content.mode === 'live' && content.site?.url;
  const body = live
    ? `User-agent: *\nAllow: /\n\nSitemap: ${content.site.url.replace(/\/$/, '')}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
