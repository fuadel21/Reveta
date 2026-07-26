import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const failures = [];
const warnings = [];

const read = (path) => {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    failures.push(`Falta el archivo obligatorio: ${path}`);
    return '';
  }
  return readFileSync(absolutePath, 'utf8');
};

const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const warn = (condition, message) => {
  if (!condition) warnings.push(message);
};

const indexHtml = read('index.html');
const robots = read('public/robots.txt');
const sitemap = read('public/sitemap.xml');
const vercelRaw = read('vercel.json');
const app = read('src/App.tsx');
const homepage = read('src/pages/Index.tsx');
const searchPage = read('src/pages/Search.tsx');
const searchProductGrid = read('src/components/search/ProductGrid.tsx');
const globalJsonLd = read('src/components/seo/GlobalJsonLd.tsx');
const productDetail = read('src/pages/ProductDetail.tsx');
const publicSellerProfile = read('src/pages/PublicSellerProfile.tsx');
const seoLanding = read('src/pages/SeoLanding.tsx');
const sitemapGenerator = read('scripts/generate-sitemap.mjs');

expect(/<html\s+lang=["']es["']/.test(indexHtml), 'index.html debe declarar lang="es".');
expect(/name=["']description["']/.test(indexHtml), 'Falta la meta description base.');
expect(/rel=["']canonical["']/.test(indexHtml), 'Falta la canonical base.');
expect(/google-site-verification/.test(indexHtml), 'Falta la verificación de Google Search Console.');
expect(/property=["']og:title["']/.test(indexHtml), 'Falta og:title en la plantilla base.');
expect(/name=["']twitter:card["']/.test(indexHtml), 'Falta twitter:card en la plantilla base.');
expect(/https:\/\/reveta\.es\/og-image\.png/.test(indexHtml), 'La plantilla base debe usar la imagen social PNG.');
expect(/property=["']og:image:type["'][^>]+image\/png/.test(indexHtml), 'La plantilla base debe declarar og:image:type image/png.');
expect(/property=["']og:image:width["'][^>]+1200/.test(indexHtml), 'La imagen social debe declarar 1200 px de ancho.');
expect(/property=["']og:image:height["'][^>]+630/.test(indexHtml), 'La imagen social debe declarar 630 px de alto.');
expect(existsSync(resolve('public/og-image.png')), 'Falta public/og-image.png.');

expect(/Sitemap:\s*https:\/\/reveta\.es\/sitemap\.xml/.test(robots), 'robots.txt debe declarar el sitemap absoluto.');
expect(/Disallow:\s*\/search/.test(robots), 'robots.txt debe bloquear los filtros de búsqueda.');
expect(/Disallow:\s*\/admin/.test(robots), 'robots.txt debe bloquear administración.');
expect(/Allow:\s*\/producto\//.test(robots), 'robots.txt debe permitir productos canónicos.');
expect(/Allow:\s*\/usuario\//.test(robots), 'robots.txt debe permitir perfiles públicos de vendedor.');

expect(/<urlset\s+xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']>/.test(sitemap), 'sitemap.xml no tiene un urlset válido.');
expect(/<loc>https:\/\/reveta\.es\/<\/loc>/.test(sitemap), 'El sitemap debe incluir la portada canónica.');
expect(!/[?&](utm_|page=|sort=|filter=)/i.test(sitemap), 'El sitemap contiene parámetros o filtros que pueden generar duplicados.');
expect(!/<loc>https:\/\/reveta\.es\/search/i.test(sitemap), 'El sitemap no debe incluir búsquedas internas.');

let vercel;
try {
  vercel = JSON.parse(vercelRaw);
} catch (error) {
  failures.push(`vercel.json no es JSON válido: ${error.message}`);
}

if (vercel) {
  const serializedHeaders = JSON.stringify(vercel.headers || []);
  const serializedRedirects = JSON.stringify(vercel.redirects || []);
  expect(serializedHeaders.includes('X-Robots-Tag'), 'Vercel debe enviar X-Robots-Tag en rutas privadas.');
  expect(serializedHeaders.includes('/search/:path*'), 'Vercel debe marcar /search como noindex.');
  expect(serializedHeaders.includes('/sitemap.xml'), 'Vercel debe definir cabeceras para sitemap.xml.');
  expect(serializedHeaders.includes('immutable'), 'Los assets versionados deben tener caché immutable.');
  expect(!serializedRedirects.includes('og-image.png'), 'Vercel no debe redirigir la imagen social PNG.');
}

expect(/<HelmetProvider>/.test(app), 'La aplicación debe mantener HelmetProvider.');
expect(/GlobalJsonLd/.test(app), 'La aplicación debe mantener los datos estructurados globales.');
expect(/\/producto\/:id\/:slug/.test(app), 'Falta la ruta canónica de producto con slug.');
expect(/\/usuario\/:id/.test(app), 'Falta la ruta pública de vendedor.');
expect(/\/segunda-mano\/:city\/:category/.test(app), 'Falta la landing SEO de ciudad y categoría.');

expect(/@graph/.test(globalJsonLd), 'GlobalJsonLd debe publicar Organization y WebSite dentro de un único @graph.');
expect(/SearchAction/.test(globalJsonLd) && /urlTemplate/.test(globalJsonLd), 'GlobalJsonLd debe conectar el buscador real mediante SearchAction y EntryPoint.');
expect(/og-image\.png/.test(globalJsonLd), 'La identidad global debe usar la imagen social PNG.');
expect(/og-image\.png/.test(homepage), 'La portada debe usar la imagen social PNG.');
expect(/og:image:type[^\n]+image\/png/.test(homepage), 'La portada debe declarar image/png para Open Graph.');
expect(!/meta\s+name=["']keywords["']/.test(homepage), 'La portada no debe incluir meta keywords.');
expect(!/const\s+organizationJsonLd/.test(homepage), 'La portada no debe duplicar Organization; debe usar GlobalJsonLd.');
expect(!/const\s+websiteJsonLd/.test(homepage), 'La portada no debe duplicar WebSite; debe usar GlobalJsonLd.');

expect(/name=["']robots["']\s+content=["']noindex,follow/.test(searchPage), 'Search debe mantener noindex,follow.');
expect(/rel=["']canonical["']/.test(searchPage) && /https:\/\/reveta\.es\/search/.test(searchPage), 'Search debe mantener canonical limpia sin parámetros.');
expect(/og-image\.png/.test(searchPage), 'Search debe usar la imagen social PNG.');
expect(/imagePriority=\{!compact\s*&&\s*index\s*<\s*2\}/.test(searchProductGrid), 'ProductGrid debe priorizar solo las primeras imágenes visibles.');
expect(/role=["']link["']/.test(searchProductGrid) && /tabIndex=\{0\}/.test(searchProductGrid), 'ProductGrid debe permitir abrir productos con teclado.');
expect(/toLocaleString\(["']es-ES["']\)/.test(searchProductGrid), 'ProductGrid debe anunciar precios con formato español.');
warn(!/from\(["']products["']\)\.select\(["']\*["']/.test(searchPage), 'Search todavía usa select("*") y conviene limitar las columnas en un bloque posterior con pruebas del mapa y filtros.');

expect(/@type['"]?:\s*['"]Product['"]/.test(productDetail), 'ProductDetail debe publicar JSON-LD Product.');
expect(/BreadcrumbList/.test(productDetail), 'ProductDetail debe publicar breadcrumbs estructurados.');
expect(/name=["']robots["']/.test(productDetail), 'ProductDetail debe controlar index/noindex según disponibilidad.');
expect(/rel=["']canonical["']/.test(productDetail), 'ProductDetail debe publicar canonical.');
expect(/priceCurrency:\s*['"]EUR['"]/.test(productDetail), 'ProductDetail debe declarar el precio en EUR.');

expect(/@type['"]?:\s*['"]Person['"]/.test(publicSellerProfile), 'PublicSellerProfile debe publicar JSON-LD Person.');
expect(/ItemList/.test(publicSellerProfile), 'PublicSellerProfile debe publicar los anuncios activos como ItemList.');
expect(/shouldIndexProfile/.test(publicSellerProfile), 'PublicSellerProfile debe evitar indexar perfiles sin inventario.');
expect(/rel=["']canonical["']/.test(publicSellerProfile), 'PublicSellerProfile debe publicar canonical.');
expect(/profile\.username\s*\|\|\s*profile\.id/.test(sitemapGenerator), 'El sitemap debe usar username y recurrir al ID solo cuando no exista.');
expect(/sellerPriority/.test(sitemapGenerator), 'El sitemap debe priorizar perfiles según inventario activo.');
expect(/productPriority/.test(sitemapGenerator), 'El sitemap debe priorizar productos según actualidad.');

expect(/FAQPage/.test(seoLanding), 'SeoLanding debe publicar FAQPage.');
expect(/CollectionPage/.test(seoLanding), 'SeoLanding debe publicar CollectionPage.');
expect(/BreadcrumbList/.test(seoLanding), 'SeoLanding debe publicar BreadcrumbList.');
expect(/shouldIndex/.test(seoLanding), 'SeoLanding debe impedir indexar ciudades o categorías no aprobadas.');

warn(/meta\s+name=["']keywords["']/.test(seoLanding), 'La etiqueta meta keywords no ayuda al posicionamiento y puede eliminarse en una limpieza futura.');

for (const message of warnings) console.warn(`SEO warning: ${message}`);

if (failures.length) {
  for (const message of failures) console.error(`SEO error: ${message}`);
  console.error(`\nSEO check failed with ${failures.length} error(s).`);
  process.exit(1);
}

console.log(`SEO check passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.`);
