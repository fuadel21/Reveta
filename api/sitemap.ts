const SITE_URL = 'https://reveta.es';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dnjjvtjcjfeklgwbhwpy.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { send: (body: string) => void };
};

type Product = {
  id: string;
  title: string;
  updated_at?: string | null;
  created_at?: string | null;
};

const staticUrls = [
  '/',
  '/search',
  '/terms',
  '/privacy',
  '/cookies',
  '/segunda-mano/madrid',
  '/segunda-mano/barcelona',
  '/segunda-mano/valencia',
  '/segunda-mano/sevilla',
  '/segunda-mano/malaga',
  '/segunda-mano/zaragoza',
  '/segunda-mano/bilbao',
  '/segunda-mano/alicante',
  '/segunda-mano/pineda-de-mar',
  '/segunda-mano/madrid/motor',
  '/segunda-mano/madrid/electronica',
  '/segunda-mano/madrid/muebles',
  '/segunda-mano/madrid/iphone',
  '/segunda-mano/madrid/bicicletas',
  '/segunda-mano/barcelona/motor',
  '/segunda-mano/barcelona/electronica',
  '/segunda-mano/barcelona/muebles',
  '/segunda-mano/barcelona/iphone',
  '/segunda-mano/barcelona/bicicletas',
  '/segunda-mano/valencia/motor',
  '/segunda-mano/valencia/electronica',
  '/segunda-mano/valencia/muebles',
  '/segunda-mano/valencia/iphone',
  '/segunda-mano/valencia/bicicletas',
  '/segunda-mano/sevilla/motor',
  '/segunda-mano/sevilla/electronica',
  '/segunda-mano/sevilla/muebles',
  '/segunda-mano/malaga/motor',
  '/segunda-mano/malaga/electronica',
  '/segunda-mano/malaga/muebles',
];

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const createSlug = (title: string) => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';
};

const xmlUrl = (loc: string, options: { lastmod?: string; changefreq?: string; priority?: string } = {}) => {
  const lastmod = options.lastmod ? `<lastmod>${escapeXml(options.lastmod)}</lastmod>` : '';
  const changefreq = options.changefreq ? `<changefreq>${options.changefreq}</changefreq>` : '';
  const priority = options.priority ? `<priority>${options.priority}</priority>` : '';
  return `<url><loc>${escapeXml(loc)}</loc>${lastmod}${changefreq}${priority}</url>`;
};

const fetchActiveProducts = async (): Promise<Product[]> => {
  if (!SUPABASE_KEY) return [];

  const url = `${SUPABASE_URL}/rest/v1/products?select=id,title,created_at,updated_at&status=eq.active&order=created_at.desc&limit=5000`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) return [];
  return response.json();
};

export default async function handler(_req: unknown, res: VercelResponse) {
  const products = await fetchActiveProducts();

  const urls = [
    ...staticUrls.map((path) => xmlUrl(`${SITE_URL}${path}`, { changefreq: path === '/' || path === '/search' ? 'daily' : 'weekly', priority: path === '/' ? '1.0' : '0.8' })),
    ...products.map((product) => {
      const slug = createSlug(product.title);
      const date = product.updated_at || product.created_at;
      return xmlUrl(`${SITE_URL}/producto/${product.id}/${slug}`, { lastmod: date ? new Date(date).toISOString().split('T')[0] : undefined, changefreq: 'weekly', priority: '0.7' });
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
