import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://reveta.es';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dnjjvtjcjfeklgwbhwpy.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_nYmr_026d-jL5jU2GyUvTA_g10_FHfO';

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createSlug(value) {
  return (value || 'producto')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';
}

function toLastmod(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function buildUrl({ loc, lastmod, changefreq = 'weekly', priority = '0.72' }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id,title,updated_at,created_at,user_id')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(5000);

    if (productsError) throw productsError;

    const urls = [];
    const activeSellerIds = new Set();

    for (const product of products || []) {
      if (product.user_id) activeSellerIds.add(product.user_id);
      urls.push(buildUrl({
        loc: `${BASE_URL}/producto/${product.id}/${createSlug(product.title)}`,
        lastmod: toLastmod(product.updated_at || product.created_at),
        priority: '0.74',
      }));
    }

    if (activeSellerIds.size > 0) {
      const sellerIds = [...activeSellerIds].slice(0, 1000);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,username,updated_at,created_at')
        .in('id', sellerIds);

      for (const profile of profiles || []) {
        urls.push(buildUrl({
          loc: `${BASE_URL}/usuario/${profile.username || profile.id}`,
          lastmod: toLastmod(profile.updated_at || profile.created_at),
          priority: '0.65',
        }));
      }
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls,
      '</urlset>',
      '',
    ].join('\n');

    res.status(200).send(xml);
  } catch (error) {
    const fallbackXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '</urlset>',
      '',
    ].join('\n');

    console.error('dynamic product sitemap failed', error);
    res.status(200).send(fallbackXml);
  }
}
