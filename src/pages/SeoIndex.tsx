import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';

const POPULAR_CITIES = [
  ['barcelona', 'Barcelona'], ['madrid', 'Madrid'], ['valencia', 'Valencia'],
  ['badalona', 'Badalona'], ['hospitalet-de-llobregat', "L'Hospitalet de Llobregat"],
  ['sabadell', 'Sabadell'], ['terrassa', 'Terrassa'], ['mataro', 'Mataró'],
  ['pineda-de-mar', 'Pineda de Mar'], ['girona', 'Girona'],
  ['lloret-de-mar', 'Lloret de Mar'], ['blanes', 'Blanes'],
] as const;

const POPULAR_CATEGORIES = [
  ['electronica', 'Electrónica'], ['iphone', 'iPhone'], ['muebles', 'Muebles'],
  ['motor', 'Motor'], ['bicicletas', 'Bicicletas'], ['hogar', 'Hogar'],
  ['moda', 'Moda'], ['juegos', 'Juegos'], ['libros', 'Libros'], ['deportes', 'Deportes'],
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
const socialImage = 'https://reveta.es/og-image.png?v=20260726';

const FeatureCard = ({ icon, title: cardTitle, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <Card><CardContent className="pt-6">{icon}<h2 className="font-semibold">{cardTitle}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p></CardContent></Card>
);

const SeoIndex = () => {
  const categoryLinks = POPULAR_CATEGORIES.map(([slug, label]) => ({
    slug,
    label,
    href: `/segunda-mano/barcelona/${slug}`,
    linkLabel: `${label} de segunda mano en Barcelona`,
  }));

  const discoveryItems = [
    ...POPULAR_CITIES.map(([slug, label]) => ({ name: `Segunda mano en ${label}`, url: `${canonicalUrl}/${slug}` })),
    ...categoryLinks.map((item) => ({ name: item.linkLabel, url: `https://reveta.es${item.href}` })),
    ...CATEGORY_HUBS.map((hub) => ({ name: `${hub.categoryLabel} de segunda mano en ${hub.cityLabel}`, url: `${canonicalUrl}/${hub.city}/${hub.category}` })),
  ];

  const structuredData = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description,
      url: canonicalUrl, inLanguage: 'es-ES',
      isPartOf: { '@id': 'https://reveta.es/#website' },
      about: 'Productos de segunda mano por ciudad y categoría',
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Reveta', item: 'https://reveta.es/' },
        { '@type': 'ListItem', position: 2, name: 'Segunda mano', item: canonicalUrl },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: 'Principales páginas de segunda mano en Reveta', numberOfItems: discoveryItems.length,
      itemListElement: discoveryItems.map((item, index) => ({ '@type': 'ListItem', position: index + 1, ...item })),
    },
  ];

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
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:secure_url" content={socialImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Reveta, marketplace de productos de segunda mano por ciudad y categoría" />
        <meta property="og:site_name" content="Reveta" />
        <meta property="og:locale" content="es_ES" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={socialImage} />
        <meta name="twitter:image:alt" content="Reveta, marketplace de productos de segunda mano por ciudad y categoría" />
        {structuredData.map((data, index) => <script key={index} type="application/ld+json">{JSON.stringify(data)}</script>)}
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <section className="container py-12 md:py-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"><MapPin className="h-4 w-4" />Marketplace local</div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Segunda mano cerca de ti</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Busca productos usados por ciudad y categoría, habla con vendedores locales, negocia por chat y publica anuncios gratis en Reveta.</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg"><Link to="/search"><Search className="mr-2 h-5 w-5" />Buscar productos</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/upload">Vender un producto</Link></Button>
              </div>
            </div>
          </section>

          <section className="border-y bg-muted/30">
            <div className="container grid gap-4 py-8 md:grid-cols-3">
              <FeatureCard icon={<Sparkles className="mb-3 h-6 w-6 text-primary" />} title="Anuncios por ciudad" text="Encuentra productos cerca de tu zona y descubre oportunidades locales." />
              <FeatureCard icon={<Search className="mb-3 h-6 w-6 text-primary" />} title="Categorías populares" text="Tecnología, muebles, motor, bicicletas, hogar, moda, libros y mucho más." />
              <FeatureCard icon={<ShieldCheck className="mb-3 h-6 w-6 text-primary" />} title="Chat y registro" text="Usa chat, ofertas y valoraciones para comprar y vender con más claridad." />
            </div>
          </section>

          <section className="container py-10"><div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold">Ciudades populares</h2><p className="mt-2 text-muted-foreground">Explora anuncios activos y vendedores de segunda mano en las zonas más buscadas.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{POPULAR_CITIES.map(([slug, label]) => <Link key={slug} to={`/segunda-mano/${slug}`} className="rounded-xl border bg-card p-4 font-medium transition hover:border-primary hover:text-primary">Segunda mano en {label}</Link>)}</div>
          </div></section>

          <section className="container pb-12"><div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold">Categorías de segunda mano en Barcelona</h2><p className="mt-2 text-muted-foreground">Accede a categorías populares con una ubicación clara y después ajusta precio, estado o cercanía.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{categoryLinks.map((item) => <Link key={item.slug} to={item.href} className="rounded-xl border bg-card p-4 font-medium transition hover:border-primary hover:text-primary">{item.linkLabel}</Link>)}</div>
          </div></section>

          <section className="container pb-12"><div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold">Búsquedas locales destacadas</h2><p className="mt-2 text-muted-foreground">Combinaciones de ciudad y categoría con intención clara de compra y venta local.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{CATEGORY_HUBS.map((hub) => <Link key={`${hub.city}-${hub.category}`} to={`/segunda-mano/${hub.city}/${hub.category}`} className="rounded-xl border bg-card p-4 font-medium transition hover:border-primary hover:text-primary">{hub.categoryLabel} en {hub.cityLabel}</Link>)}</div>
          </div></section>

          <section className="container pb-16"><div className="mx-auto max-w-4xl rounded-2xl border bg-card p-6 md:p-8">
            <h2 className="text-2xl font-bold">Comprar y vender productos usados cerca de ti</h2>
            <div className="mt-4 space-y-3 text-muted-foreground"><p>Reveta organiza los anuncios por ciudad y categoría para encontrar productos relevantes sin filtros interminables.</p><p>Consulta estado, precio, ubicación y perfil del vendedor, habla por chat y compara alternativas antes de cerrar una operación.</p></div>
          </div></section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default SeoIndex;
