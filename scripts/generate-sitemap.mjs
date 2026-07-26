// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
// Keeps SEO landing pages, active products and useful seller profiles discoverable by crawlers.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://reveta.es";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const MAX_PRODUCTS = 2000;
const MAX_SELLERS = 1000;

const citySlugs = [
  "barcelona", "madrid", "valencia", "sevilla", "malaga", "zaragoza", "bilbao", "alicante", "murcia", "granada",
  "girona", "tarragona", "lleida", "reus", "badalona", "hospitalet-de-llobregat", "sabadell", "terrassa", "mataro",
  "santa-coloma-de-gramenet", "pineda-de-mar", "lloret-de-mar", "blanes", "malgrat-de-mar", "figueres", "granollers", "vic",
];

const priorityCitySlugs = new Set([
  "barcelona", "madrid", "valencia", "girona", "tarragona", "lleida", "reus", "badalona", "sabadell", "terrassa",
  "mataro", "pineda-de-mar", "lloret-de-mar", "blanes", "malgrat-de-mar",
]);

const mainCategories = ["electronica", "iphone", "muebles", "motor", "bicicletas", "hogar", "moda"];
const secondaryCategories = ["juegos", "libros", "deportes"];
const coreCities = ["barcelona", "madrid", "valencia"];
const cataloniaCities = [
  "girona", "tarragona", "lleida", "reus", "badalona", "hospitalet-de-llobregat", "sabadell", "terrassa", "mataro",
  "pineda-de-mar", "lloret-de-mar", "blanes", "malgrat-de-mar", "figueres", "granollers", "vic",
];

const cityCategoryPairs = [
  ...coreCities.flatMap((city) => [...mainCategories, ...secondaryCategories].map((category) => [city, category])),
  ...cataloniaCities.flatMap((city) => mainCategories.map((category) => [city, category])),
  ["sevilla", "electronica"], ["sevilla", "muebles"], ["sevilla", "motor"],
  ["malaga", "electronica"], ["malaga", "muebles"], ["malaga", "motor"],
  ["zaragoza", "electronica"], ["zaragoza", "muebles"], ["bilbao", "electronica"], ["bilbao", "muebles"],
  ["alicante", "electronica"], ["murcia", "electronica"], ["granada", "electronica"],
];

const staticEntries = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/segunda-mano", changefreq: "weekly", priority: "0.9" },
  { path: "/seguridad", changefreq: "monthly", priority: "0.7" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/cookies", changefreq: "yearly", priority: "0.3" },
];

const seoLandingEntries = [
  ...citySlugs.map((city) => ({
    path: `/segunda-mano/${city}`,
    changefreq: "weekly",
    priority: priorityCitySlugs.has(city) ? "0.86" : "0.82",
  })),
  ...cityCategoryPairs.map(([city, category]) => ({
    path: `/segunda-mano/${city}/${category}`,
    changefreq: "weekly",
    priority: category === "electronica" || category === "iphone" ? "0.88" : "0.84",
  })),
];

function createSlug(value) {
  return (value || "producto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "producto";
}

function toLastmod(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().split("T")[0];
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dedupe(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}

function productPriority(createdAt) {
  if (!createdAt) return "0.72";
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  if (ageDays <= 7) return "0.80";
  if (ageDays <= 30) return "0.76";
  return "0.72";
}

function sellerPriority(activeCount) {
  if (activeCount >= 10) return "0.76";
  if (activeCount >= 4) return "0.71";
  return "0.66";
}

async function fetchDynamicEntries() {
  const entries = [];

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("sitemap: missing Supabase environment variables, using static SEO entries only");
    return entries;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,title,updated_at,created_at,user_id")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(MAX_PRODUCTS);

    if (productsError) throw productsError;

    const sellerStats = new Map();

    for (const product of products || []) {
      if (product.user_id) {
        const current = sellerStats.get(product.user_id) || { count: 0, lastmod: null };
        current.count += 1;
        const candidate = product.updated_at || product.created_at;
        if (!current.lastmod || new Date(candidate) > new Date(current.lastmod)) current.lastmod = candidate;
        sellerStats.set(product.user_id, current);
      }

      entries.push({
        path: `/producto/${product.id}/${createSlug(product.title)}`,
        lastmod: toLastmod(product.updated_at || product.created_at),
        changefreq: "weekly",
        priority: productPriority(product.created_at),
      });
    }

    if (sellerStats.size > 0) {
      const sellerIds = [...sellerStats.keys()].slice(0, MAX_SELLERS);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,username,updated_at,created_at")
        .in("id", sellerIds);

      if (!profilesError && profiles) {
        for (const profile of profiles) {
          const stats = sellerStats.get(profile.id);
          if (!stats?.count) continue;

          const canonicalIdentifier = profile.username?.trim().toLowerCase() || profile.id;
          entries.push({
            path: `/usuario/${encodeURIComponent(canonicalIdentifier)}`,
            lastmod: toLastmod(stats.lastmod || profile.updated_at || profile.created_at),
            changefreq: stats.count >= 4 ? "daily" : "weekly",
            priority: sellerPriority(stats.count),
          });
        }
      }
    }
  } catch (err) {
    console.warn("sitemap: dynamic fetch failed, using static SEO entries only", err);
  }

  return entries;
}

function generateSitemap(entries) {
  const urls = entries.map((entry) => {
    const loc = `${BASE_URL}${entry.path}`;
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
      entry.priority ? `    <priority>${entry.priority}</priority>` : null,
      "  </url>",
    ].filter(Boolean).join("\n");
  });

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

async function main() {
  const dynamicEntries = await fetchDynamicEntries();
  const allEntries = dedupe([...staticEntries, ...seoLandingEntries, ...dynamicEntries]);
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(allEntries));
  console.log(`sitemap.xml written (${allEntries.length} entries)`);
}

main().catch((error) => {
  console.error("sitemap: generation failed", error);
  process.exitCode = 1;
});
