// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
// Fetches dynamic categories and cities from Supabase to keep the sitemap fresh.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// TODO: replace with your project URL once a custom domain is set.
const BASE_URL = "https://reveta.es";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://dnjjvtjcjfeklgwbhwpy.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_nYmr_026d-jL5jU2GyUvTA_g10_FHfO";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/search", changefreq: "daily", priority: "0.9" },
  { path: "/auth", changefreq: "monthly", priority: "0.5" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/cookies", changefreq: "yearly", priority: "0.3" },
];

async function fetchDynamicEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Categories
    const { data: categories } = await supabase.from("categories").select("id, name");
    if (categories) {
      for (const c of categories) {
        entries.push({
          path: `/search?category=${encodeURIComponent(c.id)}`,
          changefreq: "daily",
          priority: "0.8",
        });
      }
    }

    // Cities (unique non-null locations from active products)
    const { data: products } = await supabase
      .from("products")
      .select("location")
      .eq("status", "active")
      .not("location", "is", null)
      .limit(1000);

    if (products) {
      const cities = new Set<string>();
      for (const p of products) {
        if (p.location) cities.add(p.location.trim());
      }
      for (const city of cities) {
        entries.push({
          path: `/search?location=${encodeURIComponent(city)}`,
          changefreq: "weekly",
          priority: "0.6",
        });
      }
    }

    // Published product pages
    const { data: published } = await supabase
      .from("products")
      .select("id, updated_at")
      .eq("status", "active")
      .limit(1000);
    if (published) {
      for (const p of published) {
        entries.push({
          path: `/product/${p.id}`,
          lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : undefined,
          changefreq: "weekly",
          priority: "0.7",
        });
      }
    }
  } catch (err) {
    console.warn("sitemap: dynamic fetch failed, using static entries only", err);
  }

  return entries;
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

async function main() {
  const dynamic = await fetchDynamicEntries();
  const all = [...staticEntries, ...dynamic];
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(all));
  console.log(`sitemap.xml written (${all.length} entries)`);
}

main();
