// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
// Keeps SEO landing pages, active products and active seller profiles discoverable by crawlers.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://reveta.es";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

interface ProductRow {
  id: string;
  title: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  user_id?: string | null;
}

interface ProfileRow {
  id: string;
  username: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

const citySlugs = [
  "barcelona",
  "madrid",
  "valencia",
  "sevilla",
  "malaga",
  "zaragoza",
  "bilbao",
  "alicante",
  "murcia",
  "granada",
  "girona",
  "tarragona",
  "lleida",
  "reus",
  "badalona",
  "hospitalet-de-llobregat",
  "sabadell",
  "terrassa",
  "mataro",
  "santa-coloma-de-gramenet",
  "pineda-de-mar",
  "lloret-de-mar",
  "blanes",
  "malgrat-de-mar",
  "figueres",
  "granollers",
  "vic",
];

const priorityCitySlugs = new Set(["barcelona", "madrid", "valencia", "girona", "badalona", "sabadell", "terrassa", "mataro", "pineda-de-mar"]);

const cityCategoryPairs = [
  ["barcelona", "electronica"],
  ["barcelona", "iphone"],
  ["barcelona", "muebles"],
  ["barcelona", "motor"],
  ["barcelona", "bicicletas"],
  ["barcelona", "hogar"],
  ["madrid", "electronica"],
  ["madrid", "iphone"],
  ["madrid", "muebles"],
  ["madrid", "motor"],
  ["madrid", "bicicletas"],
  ["valencia", "electronica"],
  ["valencia", "iphone"],
  ["valencia", "muebles"],
  ["valencia", "motor"],
  ["sevilla", "electronica"],
  ["sevilla", "muebles"],
  ["sevilla", "motor"],
  ["malaga", "electronica"],
  ["malaga", "muebles"],
  ["malaga", "motor"],
  ["girona", "electronica"],
  ["girona", "muebles"],
  ["tarragona", "electronica"],
  ["tarragona", "muebles"],
  ["badalona", "electronica"],
  ["badalona", "iphone"],
  ["badalona", "muebles"],
  ["hospitalet-de-llobregat", "electronica"],
  ["hospitalet-de-llobregat", "iphone"],
  ["hospitalet-de-llobregat", "muebles"],
  ["sabadell", "electronica"],
  ["sabadell", "muebles"],
  ["terrassa", "electronica"],
  ["terrassa", "muebles"],
  ["mataro", "electronica"],
  ["mataro", "muebles"],
  ["pineda-de-mar", "electronica"],
  ["pineda-de-mar", "muebles"],
  ["lloret-de-mar", "electronica"],
  ["blanes", "electronica"],
  ["malgrat-de-mar", "electronica"],
] as const;

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/cookies", changefreq: "yearly", priority: "0.3" },
];

const seoLandingEntries: SitemapEntry[] = [
  ...citySlugs.map((city) => ({
    path: `/segunda-mano/${city}`,
    changefreq: "weekly" as const,
    priority: priorityCitySlugs.has(city) ? "0.86" : "0.82",
  })),
  ...cityCategoryPairs.map(([city, category]) => ({
    path: `/segunda-mano/${city}/${category}`,
    changefreq: "weekly" as const,
    priority: category === "electronica" || category === "iphone" ? "0.88" : "0.84",
  })),
];

function createSlug(value: string | null | undefined) {
  return (value || "producto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "producto";
}

function toLastmod(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().split("T")[0];
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dedupe(entries: SitemapEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}

async function fetchDynamicEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("sitemap: missing Supabase environment variables, using static SEO entries only");
    return entries;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,title,updated_at,created_at,user_id")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(2000);

    if (productsError) throw productsError;

    const productRows = (products || []) as ProductRow[];
    const activeSellerIds = new Set<string>();

    for (const product of productRows) {
      if (product.user_id) activeSellerIds.add(product.user_id);
      entries.push({
        path: `/producto/${product.id}/${createSlug(product.title)}`,
        lastmod: toLastmod(product.updated_at || product.created_at),
        changefreq: "weekly",
        priority: "0.72",
      });
    }

    if (activeSellerIds.size > 0) {
      const sellerIds = [...activeSellerIds].slice(0, 1000);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,username,updated_at,created_at")
        .in("id", sellerIds);

      if (!profilesError && profiles) {
        for (const profile of profiles as ProfileRow[]) {
          entries.push({
            path: `/usuario/${profile.username || profile.id}`,
            lastmod: toLastmod(profile.updated_at || profile.created_at),
            changefreq: "weekly",
            priority: "0.65",
          });
        }
      }
    }
  } catch (err) {
    console.warn("sitemap: dynamic fetch failed, using static SEO entries only", err);
  }

  return entries;
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((entry) => {
    const loc = `${BASE_URL}${entry.path}`;
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
      entry.priority ? `    <priority>${entry.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n");
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

main();
