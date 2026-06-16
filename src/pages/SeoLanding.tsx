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
  'pineda-de-mar': 'Pineda de Mar',
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

const POPULAR_CITIES = ['madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'bilbao'];
const POPULAR_CATEGORIES = ['motor', 'electronica', 'iphone', 'muebles', 'bicicletas', 'moda'];

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
  const isGenericCity = Boolean(cityName) && !categoryName;
  const searchParams = new URLSearchParams();

  if (categoryName) searchParams.set('q', categoryName);
  if (cityName) searchParams.set('location', cityName);

  const searchUrl = `/search?${searchParams.toString()}`;
  const title = categoryName
    ? `${categoryName} de segunda mano en ${cityName} | Reveta`
    : `Comprar y vender segunda mano en ${cityName} | Reveta`;
  const description = categoryName
    ? `Encuentra ${categoryName.toLowerCase()} de segunda mano en ${cityName}. Compra, vende y negocia con chat, ofertas, valoraciones y Protección Reveta.`
    : `Compra y vende productos de segunda mano en ${cityName}. Encuentra ofertas cerca de ti con chat, valoraciones y Protección Reveta.`;

  const relatedCityLinks = POPULAR_CITIES
    .filter((item) => item !== city)
    .slice(0, 5)
    .map((item) => ({
      label: categoryName ? `${categoryName} en ${CITY_NAMES[item] || slugToLabel(item)}` : `Segunda mano en ${CITY_NAMES[item] || slugToLabel(item)}`,
      href: categoryName ? `/segunda-mano/${item}/${category}` : `/segunda-mano/${item}`,
    }));

  const relatedCategoryLinks = POPULAR_CATEGORIES
    .filter((item) => item !== category)
    .slice(0, 6)
    .map((item) => ({
      label: `${CATEGORY_NAMES[item] || slugToLabel(item)} en ${cityName}`,
      href: `/segunda-mano/${city}/${item}`,
    }));

  const faqs = [
    {
      question: categoryName ? `¿Dónde comprar ${categoryName.toLowerCase()} de segunda mano en ${cityName}?` : `¿Dónde comprar productos de segunda mano en ${cityName}?`,
      answer: categoryName
        ? `En Reveta puedes buscar ${categoryName.toLowerCase()} de segunda mano en ${cityName}, contactar con vendedores por chat y negociar ofertas antes de comprar.`
        : `En Reveta puedes encontrar productos de segunda mano en ${cityName}, filtrar por ubicación y hablar directamente con vendedores locales.`,
    },
    {
      question: '¿Puedo vender gratis en Reveta?',
      answer: 'Sí. Puedes publicar productos en Reveta, añadir fotos, descripción, precio y ubicación para llegar a compradores cercanos.',
    },
    {
      question: '¿Reveta permite negociar precios?',
      answer: 'Sí. Reveta incluye chat, ofertas y contraofertas para que comprador y vendedor puedan acordar un precio antes de reservar una operación.',
    },
    {
      question: '¿Cómo puedo comprar con más confianza?',
      answer: 'Puedes revisar valoraciones, hablar por chat, consultar la información del producto y usar Protección Reveta cuando esté disponible.',
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

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`https://reveta.es/segunda-mano/${city}${category ? `/${category}` : ''}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
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
                  ? `Busca ${categoryName.toLowerCase()} cerca de ${cityName}, compara precios, habla con vendedores y negocia directamente desde Reveta.`
                  : `Encuentra productos cerca de ${cityName}, publica gratis, negocia por chat y compra con más confianza dentro de Reveta.`}
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
                  <p className="mt-2 text-sm text-muted-foreground">Filtra por ciudad, categoría, precio y estado para encontrar productos relevantes.</p>
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
                  <p className="mt-2 text-sm text-muted-foreground">Consulta valoraciones, historial de operaciones y usa Protección Reveta en tus compras.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="container py-10">
            <div className="mx-auto max-w-3xl space-y-4 text-muted-foreground">
              <h2 className="text-2xl font-bold text-foreground">
                {categoryName ? `Comprar ${categoryName.toLowerCase()} en ${cityName}` : `Comprar y vender en ${cityName}`}
              </h2>
              <p>
                Reveta conecta compradores y vendedores para encontrar productos de segunda mano de forma local. Puedes buscar por ubicación, contactar por chat y negociar precios antes de reservar una compra.
              </p>
              <p>
                {isGenericCity
                  ? `En ${cityName} puedes encontrar tecnología, motor, hogar, moda, deportes, libros y otros productos publicados por usuarios cercanos.`
                  : `Si buscas ${categoryName.toLowerCase()} en ${cityName}, esta página reúne una ruta rápida para acceder a productos relacionados y publicar tus propios anuncios.`}
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
