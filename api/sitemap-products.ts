const SITE_URL = 'https://reveta.es';

const createProductSlug = (title: string) => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';
};

const escapeXml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const buildUrl = (id: string, title: string, createdAt?: string | null) => {
  const loc = `${SITE_URL}/producto/${id}/${createProductSlug(title)}`;
  const lastmod = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();

  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>',
  ].join('\n');
};

const buildXml = (items: Array<{ id: string; title: string; created_at?: string | null }>) => {
  const urls = items
    .filter((item) => item.id && item.title)
    .map((item) => buildUrl(item.id, item.title, item.created_at))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
};

export default async function handler(_request: any, response: any) {
  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  response.status(200).send(buildXml([]));
}
