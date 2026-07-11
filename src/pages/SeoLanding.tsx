import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';

const CITY_NAMES: Record<string, string> = {
  madrid: 'Madrid',
  barcelona: 'Barcelona',
  valencia: 'Valencia',
  sevilla: 'Sevilla',
  malaga: 'Málaga',
  zaragoza: 'Zaragoza',
  bilbao: 'Bilbao',
  alicante: 'Alicante',
  murcia: 'Murcia',
  granada: 'Granada',
  girona: 'Girona',
  tarragona: 'Tarragona',
  cordoba: 'Córdoba',
  valladolid: 'Valladolid',
  'pineda-de-mar': 'Pineda de Mar',
  badalona: 'Badalona',
  'hospitalet-de-llobregat': "L'Hospitalet de Llobregat",
  sabadell: 'Sabadell',
  terrassa: 'Terrassa',
  mataro: 'Mataró',
  'santa-coloma-de-gramenet': 'Santa Coloma de Gramenet',
  'lloret-de-mar': 'Lloret de Mar',
  blanes: 'Blanes',
  'malgrat-de-mar': 'Malgrat de Mar',
  figueres: 'Figueres',
  reus: 'Reus',
  lleida: 'Lleida',
  granollers: 'Granollers',
  vic: 'Vic',
};

const CATEGORY_NAMES: Record<string, string> = {
  motor: 'Motor',
  electronica: 'Electrónica',
  hogar: 'Hogar',
  muebles: 'Muebles',
  moda: 'Moda',
  bicicletas: 'Bicicletas',
  iphone: 'iPhone',
  juegos: 'Juegos',
  libros: 'Libros',
  mascotas: 'Mascotas',
  deportes: 'Deportes',
  belleza: 'Belleza',
  oficina: 'Oficina',
  instrumentos: 'Instrumentos',
  coleccionismo: 'Coleccionismo',
};

const CATEGORY_INTENTS: Record<string, string> = {
  motor: 'coches, motos, recambios, accesorios y productos relacionados con vehículos',
  electronica: 'móviles, ordenadores, tablets, consolas, televisores y pequeños dispositivos electrónicos',
  hogar: 'artículos para casa, decoración, pequeños electrodomésticos y productos útiles para el día a día',
  muebles: 'sofás, mesas, sillas, armarios, estanterías y muebles usados cerca de ti',
  moda: 'ropa, calzado, bolsos, accesorios y prendas de segunda mano',
  bicicletas: 'bicicletas urbanas, de montaña, eléctricas, piezas y accesorios',
  iphone: 'iPhone de segunda mano, accesorios Apple, cargadores y móviles usados',
  juegos: 'videojuegos, consolas, juegos de mesa y accesorios gaming',
  libros: 'libros usados, novelas, libros de texto, cómics y material de lectura',
  mascotas: 'accesorios, productos y artículos para mascotas',
  deportes: 'material deportivo, bicicletas, accesorios fitness y equipamiento usado',
  belleza: 'productos de belleza, cuidado personal y accesorios',
  oficina: 'material de oficina, escritorios, sillas, monitores y accesorios de trabajo',
  instrumentos: 'instrumentos musicales, accesorios de audio y material para músicos',
  coleccionismo: 'objetos de colección, antigüedades, figuras y artículos especiales',
};

const POPULAR_CITIES = [
  'barcelona',
  'madrid',
  'valencia',
  'badalona',
  'hospitalet-de-llobregat',
  'sabadell',
  'terrassa',
  'mataro',
  'girona',
  'tarragona',
  'lleida',
  'reus',
  'pineda-de-mar',
  'lloret-de-mar',
  'blanes',
  'malgrat-de-mar',
  'figueres',
  'granollers',
  'vic',
];
const POPULAR_CATEGORIES = ['motor', 'electronica', 'iphone', 'muebles', 'bicicletas', 'moda', 'hogar', 'juegos', 'libros', 'deportes'];

const slugToLabel = (slug?: string) => {
  if (!slug) return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const SeoLanding = () => {
  const { city = '', category = '' } = useParams();
  const cityName = CITY_NAMES[city] || slugToLabel(city);
  const categoryName = CATEGORY_NAMES[category] || slugToLabel(category);
  const categoryIntent = CATEGORY_INTENTS[category] || `${categoryName.toLowerCase()} de segunda mano`;
  const isGenericCity = Boolean(cityName) && !categoryName;
  const isKnownCity = Boolean(CITY_NAMES[city]);
  const isKnownCategory = !category || Boolean(CATEGORY_NAMES[category]);
  const shouldIndex = isKnownCity && isKnownCategory;
  const searchParams = new URLSearchParams();

  if (categoryName) searchParams.set('q', categoryName);
  if (cityName) searchParams.set('location', cityName);

  const searchUrl = `/search?${searchParams.toString()}`;
  const canonicalUrl = `https://reveta.es/segunda-mano/${city}${category ? `/${category}` : ''}`;
  const title = categoryName
    ? `${categoryName} de segunda mano en ${cityName} | Compra y vende en Reveta`
    : `Segunda mano en ${cityName} | Comprar y vender cerca de ti | Reveta`;
  const description = categoryName
    ? `Compra y vende ${categoryName.toLowerCase()} de segunda mano en ${cityName}. Encuentra anuncios cerca de ti, negocia por chat y publica gratis en Reveta.`
    : `Compra y vende productos de segunda mano en ${cityName}. Encuentra ofertas locales, publica anuncios gratis y negocia por chat en Reveta.`;
  const keywords = categoryName
    ? `${categoryName.toLowerCase()} segunda mano ${cityName.toLowerCase()}, comprar ${categoryName.toLowerCase()} usado, vender ${categoryName.toLowerCase()} ${cityName.toLowerCase()}, anuncios ${categoryName.toLowerCase()} ${cityName.toLowerCase()}, Reveta`
    : `segunda mano ${cityName.toLowerCase()}, comprar usado ${cityName.toLowerCase()}, vender segunda mano ${cityName.toLowerCase()}, anuncios gratis ${cityName.toLowerCase()}, marketplace local, Reveta`;
  const ogImage = 'https://reveta.es/og-image.svg?v=20260710';

  const relatedCityLinks = POPULAR_CITIES
    .filter((item) => item !== city)
    .slice(0, 10)
    .map((item) => ({
      label: categoryName ? `${categoryName} en ${CITY_NAMES[item] || slugToLabel(item)}` : `Segunda mano en ${CITY_NAMES[item] || slugToLabel(item)}`,
      href: categoryName ? `/segunda-mano/${item}/${category}` : `/segunda-mano/${item}`,
    }));

  const relatedCategoryLinks = POPULAR_CATEGORIES
    .filter((item) => item !== category)
    .slice(0, 8)
    .map((item) => ({
      label: `${CATEGORY_NAMES[item] || slugToLabel(item)} en ${cityName}`,
      href: `/segunda-mano/${city}/${item}`,
    }));

  const faqs = [
    {
      question: categoryName ? `¿Dónde comprar ${categoryName.toLowerCase()} de segunda mano en ${cityName}?` : `¿Dónde comprar productos de segunda mano en ${cityName}?`,
      answer: categoryName
        ? `En Reveta puedes buscar ${categoryName.toLowerCase()} de segunda mano en ${cityName}, comparar anuncios cercanos, contactar con vendedores por chat y negociar ofertas antes de comprar.`
        : `En Reveta puedes encontrar productos de segunda mano en ${cityName}, filtrar por ubicación, revisar anuncios locales y hablar directamente con vendedores cercanos.`,
    },
    {
      question: categoryName ? `¿Puedo vender ${categoryName.toLowerCase()} en ${cityName}?` : `¿Puedo vender productos usados en ${cityName}?`,
      answer: categoryName
        ? `Sí. Puedes publicar ${categoryName.toLowerCase()} en Reveta, añadir fotos, precio, descripción y ubicación para llegar a compradores de ${cityName} y alrededores.`
        : `Sí. Puedes publicar anuncios gratis en Reveta con fotos, precio, descripción y ubicación para llegar a compradores de ${cityName} y zonas cercanas.`,
    },
    {
      question: '¿Reveta permite negociar precios?',
      answer: 'Sí. Reveta incluye chat, ofertas y contraofertas para que comprador y vendedor puedan acordar un precio antes de reservar una operación.',
    },
    {
      question: '¿Cómo puedo comprar con más confianza?',
      answer: 'Puedes revisar valoraciones, hablar por chat, consultar la información del producto y priorizar operaciones con pago y comunicación registrados dentro de Reveta cuando estén disponibles.',
    },
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
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
        item: 'https://reveta.es/segunda-mano',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `Segunda mano en ${cityName}`,
        item: `https://reveta.es/segunda-mano/${city}`,
      },
      ...(categoryName
        ? [
            {
              '@type': 'ListItem',
              position: 4,
              name: `${categoryName} en ${cityName}`,
              item: canonicalUrl,
            },
          ]
        : []),
    ],
  };

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
    about: categoryName
      ? `${categoryName} de segunda mano en ${cityName}`
      : `Productos de segunda mano en ${cityName}`,
  };

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <meta name="robots" content={shouldIndex ? 'index,follow,max-image-preview:large' : 'noindex,follow'} />
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
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <section className="container py-12 md:py-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <MapPin className="h-4 w-4" />
                {cityName}
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                {categoryName ? `${categoryName} de segunda mano en ${cityName}` : `Segunda mano en ${cityName}`}
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
                {categoryName
                  ? `Compra y vende ${categoryName.toLowerCase()} en ${cityName}. Encuentra ${categoryIntent}, compara precios, habla con vendedores locales y negocia directamente desde Reveta.`
                  : `Compra y vende productos de segunda mano en ${cityName}. Encuentra anuncios locales, publica gratis, negocia por chat y descubre oportunidades cerca de ti.`}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to={searchUrl}>
                    <Search className="mr-2 h-5 w-5" />
                    Ver productos
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
                  <h2 className="font-semibold">Ofertas cerca de ti</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Filtra por ciudad, categoría, precio y estado para encontrar productos relevantes cerca de {cityName}.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Search className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-semibold">Chat y negociación</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Haz ofertas, responde contraofertas y reserva productos directamente desde el chat.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <ShieldCheck className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-semibold">Más confianza</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Consulta valoraciones, historial de operaciones y usa chat, pago y registro de operación dentro de Reveta cuando estén disponibles.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="container py-10">
            <div className="mx-auto max-w-3xl space-y-4 text-muted-foreground">
              <h2 className="text-2xl font-bold text-foreground">
                {categoryName ? `Comprar ${categoryName.toLowerCase()} usado en ${cityName}` : `Comprar y vender en ${cityName}`}
              </h2>
              <p>
                Reveta conecta compradores y vendedores para encontrar productos de segunda mano de forma local. Puedes buscar por ubicación, contactar por chat, negociar precios y descubrir anuncios publicados por personas cercanas.
              </p>
              <p>
                {isGenericCity
                  ? `En ${cityName} puedes encontrar tecnología, motor, hogar, moda, deportes, libros, bicicletas, muebles y otros productos publicados por usuarios de la zona.`
                  : `Si buscas ${categoryName.toLowerCase()} en ${cityName}, esta página te ayuda a encontrar anuncios relacionados con ${categoryIntent}. También puedes publicar tus propios productos para llegar a compradores locales.`}
              </p>
              <p>
                El objetivo de Reveta es facilitar una compraventa local más clara y rápida: productos cerca de ti, comunicación directa, valoraciones y herramientas para acordar operaciones con confianza.
              </p>
            </div>
          </section>

          <section className="container pb-12">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-bold">Búsquedas relacionadas</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold">Otras categorías en {cityName}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {relatedCategoryLinks.map((item) => (
                        <Link key={item.href} to={item.href} className="rounded-full border px-3 py-1.5 text-sm font-medium transition hover:border-primary hover:text-primary">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold">También en otras ciudades</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {relatedCityLinks.map((item) => (
                        <Link key={item.href} to={item.href} className="rounded-full border px-3 py-1.5 text-sm font-medium transition hover:border-primary hover:text-primary">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <section className="container pb-12">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-bold">Preguntas frecuentes</h2>
              <div className="mt-5 space-y-4">
                {faqs.map((faq) => (
                  <Card key={faq.question}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold">{faq.question}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default SeoLanding;
