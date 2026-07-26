import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';

const POPULAR_CITIES = [
  ['barcelona', 'Barcelona'],
  ['madrid', 'Madrid'],
  ['valencia', 'Valencia'],
  ['badalona', 'Badalona'],
  ['hospitalet-de-llobregat', "L'Hospitalet de Llobregat"],
  ['sabadell', 'Sabadell'],
  ['terrassa', 'Terrassa'],
  ['mataro', 'Mataró'],
  ['pineda-de-mar', 'Pineda de Mar'],
  ['girona', 'Girona'],
  ['lloret-de-mar', 'Lloret de Mar'],
  ['blanes', 'Blanes'],
] as const;

const POPULAR_CATEGORIES = [
  ['electronica', 'Electrónica'],
  ['iphone', 'iPhone'],
  ['muebles', 'Muebles'],
  ['motor', 'Motor'],
  ['bicicletas', 'Bicicletas'],
  ['hogar', 'Hogar'],
  ['moda', 'Moda'],
  ['juegos', 'Juegos'],
  ['libros', 'Libros'],
  ['deportes', 'Deportes'],
] as const;

const CATEGORY_HUBS = [
  { city: 'barcelona', cityLabel: 'Barcelona', category: 'electronica', categoryLabel: 'Electrónica' },
  { city: 'barcelona', cityLabel: 'Barcelona', category: 'muebles', categoryLabel: 'Muebles' },
  { city: 'barcelona', cityLabel: 'Barcelona', category: 'motor', categoryLabel: 'Motor' },
  { city: 'madrid', cityLabel: 'Madrid', category: 'electronica', categoryLabel: 'Electrónica' },
  { city: 'madrid', cityLabel: 'Madrid', category: 'motor', categoryLabel: 'Motor' },
  { city: 'valencia', cityLabel: 'Valencia', category: 'iphone', categoryLabel: 'iPhone' },
  { city: 'valencia', cityLabel: 'Valencia', category: 'muebles', categoryLabel: 'Muebles' },
  { city: 'girona', cityLabel: 'Girona', category: 'electronica', categoryLabel: 'Electrónica' },
  { city: 'tarragona', cityLabel: 'Tarragona', category: 'muebles', categoryLabel: 'Muebles' },
  { city: 'pineda-de-mar', cityLabel: 'Pineda de Mar', category: 'electronica', categoryLabel: 'Electrónica' },
  { city: 'blanes', cityLabel: 'Blanes', category: 'hogar', categoryLabel: 'Hogar' },
  { city: 'mataro', cityLabel: 'Mataró', category: 'bicicletas', categoryLabel: 'Bicicletas' },
] as const;

const title = 'Segunda mano cerca de ti | Comprar y vender usado en Reveta';
const description = 'Encuentra productos de segunda mano por ciudad y categoría en Reveta. Compra, vende, negocia por chat y publica anuncios gratis cerca de ti.';
const canonicalUrl = 'https://reveta.es/segunda-mano';
const ogImage = 'https://reveta.es/og-image.svg?v=20260710';

const SeoIndex = () => {
  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: 'es-ES',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Reveta',
      url: 'https://reveta.es/',
    },
    about: 'Productos de segunda mano por ciudad y categoría',
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Reveta',
        item: 'https://reveta.es/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Segunda mano',
        item: canonicalUrl,
      },
    ],
  };

  const hubItemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Principales páginas de segunda mano en Reveta',
    numberOfItems: POPULAR_CITIES.length + CATEGORY_HUBS.length,
    itemListElement: [
      ...POPULAR_CITIES.map(([slug, label], index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `Segunda mano en ${label}`,
        url: `https://reveta.es/segunda-mano/${slug}`,
      })),
      ...CATEGORY_HUBS.map((hub, index) => ({
        '@type': 'ListItem',
        position: POPULAR_CITIES.length + index + 1,
        name: `${hub.categoryLabel} de segunda mano en ${hub.cityLabel}`,
        url: `https://reveta.es/segunda-mano/${hub.city}/${hub.category}`,
      })),
    ],
  };

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index,follow,max-image-preview:large" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:type" content="image/svg+xml" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Reveta" />
        <meta property="og:locale" content="es_ES" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(collectionPageJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(hubItemListJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <section className="container py-12 md:py-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <MapPin className="h-4 w-4" />
                Marketplace local
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                Segunda mano cerca de ti
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
                Busca productos usados por ciudad y categoría, habla con vendedores locales, negocia por chat y publica anuncios gratis en Reveta.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/search">
                    <Search className="mr-2 h-5 w-5" />
                    Buscar productos
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/upload">Vender un producto</Link>
                </Button>
              </div>
            </div>
          </section>

          <section className="border-y bg-muted/30">
            <div className="container grid gap-4 py-8 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <Sparkles className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-semibold">Anuncios por ciudad</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Encuentra productos cerca de tu zona y descubre oportunidades locales sin desplazarte demasiado.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Search className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-semibold">Categorías populares</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Tecnología, muebles, motor, bicicletas, hogar, moda, libros y mucho más.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <ShieldCheck className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-semibold">Chat y registro</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Usa el chat, ofertas, valoraciones y operaciones registradas para comprar y vender con más claridad.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="container py-10">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-2xl font-bold">Ciudades populares</h2>
              <p className="mt-2 text-muted-foreground">Explora anuncios activos y vendedores de segunda mano en las zonas con más búsquedas dentro de Reveta.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {POPULAR_CITIES.map(([slug, label]) => (
                  <Link key={slug} to={`/segunda-mano/${slug}`} className="rounded-xl border bg-card p-4 font-medium transition hover:border-primary hover:text-primary">
                    Segunda mano en {label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="container pb-12">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-2xl font-bold">Categorías de segunda mano</h2>
              <p className="mt-2 text-muted-foreground">Accede a las categorías más consultadas y después filtra por ciudad, precio, estado y cercanía.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {POPULAR_CATEGORIES.map(([slug, label]) => (
                  <Link key={slug} to={`/segunda-mano/barcelona/${slug}`} className="rounded-xl border bg-card p-4 font-medium transition hover:border-primary hover:text-primary">
                    {label} de segunda mano
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="container pb-12">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-2xl font-bold">Búsquedas locales destacadas</h2>
              <p className="mt-2 text-muted-foreground">Combinaciones de ciudad y categoría con intención clara de compra y venta local.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CATEGORY_HUBS.map((hub) => (
                  <Link
                    key={`${hub.city}-${hub.category}`}
                    to={`/segunda-mano/${hub.city}/${hub.category}`}
                    className="rounded-xl border bg-card p-4 font-medium transition hover:border-primary hover:text-primary"
                  >
                    {hub.categoryLabel} en {hub.cityLabel}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="container pb-16">
            <div className="mx-auto max-w-4xl rounded-2xl border bg-card p-6 md:p-8">
              <h2 className="text-2xl font-bold">Comprar y vender productos usados cerca de ti</h2>
              <div className="mt-4 space-y-3 text-muted-foreground">
                <p>Reveta organiza los anuncios por ciudad y categoría para que puedas encontrar productos relevantes sin navegar entre filtros interminables.</p>
                <p>Consulta el estado, precio, ubicación y perfil del vendedor, habla por chat y compara alternativas antes de cerrar una operación.</p>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default SeoIndex;
