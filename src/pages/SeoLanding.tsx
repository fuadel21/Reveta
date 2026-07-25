import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
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

const POPULAR_CITIES = ['barcelona', 'madrid', 'valencia', 'badalona', 'hospitalet-de-llobregat', 'sabadell', 'terrassa', 'mataro', 'girona', 'tarragona', 'lleida', 'reus', 'pineda-de-mar', 'lloret-de-mar', 'blanes', 'malgrat-de-mar', 'figueres', 'granollers', 'vic'];
const POPULAR_CATEGORIES = ['motor', 'electronica', 'iphone', 'muebles', 'bicicletas', 'moda', 'hogar', 'juegos', 'libros', 'deportes'];

interface LandingProduct {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  location: string | null;
  condition: string | null;
  created_at: string;
}

const slugToLabel = (slug?: string) => (slug || '')
  .split('-')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const createProductSlug = (title: string) => title
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'producto';

const absoluteUrl = (url?: string | null) => {
  if (!url) return 'https://reveta.es/og-image.svg?v=20260710';
  if (/^https?:\/\//.test(url)) return url;
  return `https://reveta.es${url.startsWith('/') ? url : `/${url}`}`;
};

const SeoLanding = () => {
  const { city = '', category = '' } = useParams();
  const [products, setProducts] = useState<LandingProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [inventoryError, setInventoryError] = useState(false);

  const cityName = CITY_NAMES[city] || slugToLabel(city);
  const categoryName = CATEGORY_NAMES[category] || slugToLabel(category);
  const categoryIntent = CATEGORY_INTENTS[category] || `${categoryName.toLowerCase()} de segunda mano`;
  const isGenericCity = Boolean(cityName) && !categoryName;
  const isKnownCity = Boolean(CITY_NAMES[city]);
  const isKnownCategory = !category || Boolean(CATEGORY_NAMES[category]);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      if (!isKnownCity || !isKnownCategory) {
        setProducts([]);
        setLoadingProducts(false);
        return;
      }

      setLoadingProducts(true);
      setInventoryError(false);

      try {
        let categoryId: string | null = null;
        if (categoryName) {
          const { data: categoryData, error: categoryError } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', categoryName)
            .maybeSingle();
          if (categoryError) throw categoryError;
          categoryId = categoryData?.id || null;
          if (!categoryId) {
            if (!cancelled) setProducts([]);
            return;
          }
        }

        let query = supabase
          .from('products')
          .select('id, title, price, images, location, condition, created_at')
          .eq('status', 'active')
          .ilike('location', `%${cityName}%`)
          .order('created_at', { ascending: false })
          .limit(12);

        if (categoryId) query = query.eq('category_id', categoryId);

        const { data, error } = await query;
        if (error) throw error;
        if (!cancelled) setProducts((data || []) as LandingProduct[]);
      } catch (error) {
        console.error('Error loading SEO landing inventory:', error);
        if (!cancelled) {
          setProducts([]);
          setInventoryError(true);
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    };

    loadProducts();
    return () => { cancelled = true; };
  }, [categoryName, cityName, isKnownCategory, isKnownCity]);

  const searchParams = new URLSearchParams();
  if (categoryName) searchParams.set('q', categoryName);
  if (cityName) searchParams.set('location', cityName);

  const searchUrl = `/search?${searchParams.toString()}`;
  const canonicalUrl = `https://reveta.es/segunda-mano/${city}${category ? `/${category}` : ''}`;
  const title = categoryName
    ? `${categoryName} de segunda mano en ${cityName} | Reveta`
    : `Segunda mano en ${cityName} | Compra y vende en Reveta`;
  const description = categoryName
    ? `Compra y vende ${categoryName.toLowerCase()} de segunda mano en ${cityName}. Consulta anuncios activos, compara precios y contacta con vendedores locales en Reveta.`
    : `Compra y vende productos de segunda mano en ${cityName}. Consulta anuncios activos, encuentra ofertas locales y publica gratis en Reveta.`;

  const shouldIndex = isKnownCity && isKnownCategory && !inventoryError && (loadingProducts || products.length > 0);
  const ogImage = products[0]?.images?.[0] ? absoluteUrl(products[0].images[0]) : 'https://reveta.es/og-image.svg?v=20260710';

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
    .map((item) => ({ label: `${CATEGORY_NAMES[item]} en ${cityName}`, href: `/segunda-mano/${city}/${item}` }));

  const faqs = [
    {
      question: categoryName ? `¿Dónde comprar ${categoryName.toLowerCase()} de segunda mano en ${cityName}?` : `¿Dónde comprar productos de segunda mano en ${cityName}?`,
      answer: categoryName
        ? `En Reveta puedes consultar anuncios activos de ${categoryName.toLowerCase()} en ${cityName}, comparar precios y contactar por chat con vendedores locales.`
        : `En Reveta puedes consultar anuncios activos en ${cityName}, comparar productos y hablar directamente con vendedores cercanos.`,
    },
    {
      question: categoryName ? `¿Puedo vender ${categoryName.toLowerCase()} en ${cityName}?` : `¿Puedo vender productos usados en ${cityName}?`,
      answer: `Sí. Puedes publicar gratis con fotografías, precio, descripción y ubicación para llegar a compradores de ${cityName} y alrededores.`,
    },
    { question: '¿Reveta permite negociar precios?', answer: 'Sí. Reveta incluye chat, ofertas y contraofertas para que comprador y vendedor puedan acordar un precio.' },
    { question: '¿Cómo puedo comprar con más confianza?', answer: 'Revisa las fotografías, descripción, estado, valoraciones del vendedor y mantén la comunicación y la operación dentro de Reveta.' },
  ];

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: 'es-ES',
    isPartOf: { '@type': 'WebSite', name: 'Reveta', url: 'https://reveta.es/' },
    about: categoryName ? `${categoryName} de segunda mano en ${cityName}` : `Productos de segunda mano en ${cityName}`,
  };

  const itemListJsonLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: categoryName ? `${categoryName} disponibles en ${cityName}` : `Productos disponibles en ${cityName}`,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => {
      const url = `https://reveta.es/producto/${product.id}/${createProductSlug(product.title)}`;
      return {
        '@type': 'ListItem',
        position: index + 1,
        url,
        item: {
          '@type': 'Product',
          name: product.title,
          image: product.images?.[0] ? absoluteUrl(product.images[0]) : undefined,
          url,
          offers: { '@type': 'Offer', priceCurrency: 'EUR', price: Number(product.price).toFixed(2), availability: 'https://schema.org/InStock' },
        },
      };
    }),
  }), [categoryName, cityName, products]);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Reveta', item: 'https://reveta.es/' },
      { '@type': 'ListItem', position: 2, name: 'Segunda mano', item: 'https://reveta.es/segunda-mano' },
      { '@type': 'ListItem', position: 3, name: `Segunda mano en ${cityName}`, item: `https://reveta.es/segunda-mano/${city}` },
      ...(categoryName ? [{ '@type': 'ListItem', position: 4, name: `${categoryName} en ${cityName}`, item: canonicalUrl }] : []),
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } })),
  };

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content={shouldIndex ? 'index,follow,max-image-preview:large' : 'noindex,follow'} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content="Reveta" />
        <meta property="og:locale" content="es_ES" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json">{JSON.stringify(collectionPageJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        {products.length > 0 && <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>}
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <section className="container py-12 md:py-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"><MapPin className="h-4 w-4" />{cityName}</div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{categoryName ? `${categoryName} de segunda mano en ${cityName}` : `Segunda mano en ${cityName}`}</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
                {categoryName ? `Encuentra ${categoryIntent}, compara precios y contacta con vendedores de ${cityName}.` : `Descubre anuncios locales, compara productos y compra o vende cerca de ti en ${cityName}.`}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg"><Link to={searchUrl}><Search className="mr-2 h-5 w-5" />Ver todos los resultados</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/upload">Vender un producto</Link></Button>
              </div>
            </div>
          </section>

          <section className="border-y bg-muted/30">
            <div className="container grid gap-4 py-8 md:grid-cols-3">
              <Card><CardContent className="pt-6"><Sparkles className="mb-3 h-6 w-6 text-primary" /><h2 className="font-semibold">Ofertas cerca de ti</h2><p className="mt-2 text-sm text-muted-foreground">Anuncios activos y recientes publicados en {cityName}.</p></CardContent></Card>
              <Card><CardContent className="pt-6"><Search className="mb-3 h-6 w-6 text-primary" /><h2 className="font-semibold">Chat y negociación</h2><p className="mt-2 text-sm text-muted-foreground">Pregunta, negocia y acuerda la operación directamente con el vendedor.</p></CardContent></Card>
              <Card><CardContent className="pt-6"><ShieldCheck className="mb-3 h-6 w-6 text-primary" /><h2 className="font-semibold">Compra con criterio</h2><p className="mt-2 text-sm text-muted-foreground">Revisa estado, fotografías, descripción y valoraciones antes de decidir.</p></CardContent></Card>
            </div>
          </section>

          <section className="container py-12">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-2xl font-bold">{categoryName ? `${categoryName} disponibles en ${cityName}` : `Productos disponibles en ${cityName}`}</h2><p className="mt-1 text-sm text-muted-foreground">Mostramos primero los anuncios activos más recientes.</p></div>
              {!loadingProducts && products.length > 0 && <span className="text-sm font-medium">{products.length} anuncios destacados</span>}
            </div>

            {loadingProducts ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : products.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((product) => {
                  const productUrl = `/producto/${product.id}/${createProductSlug(product.title)}`;
                  const image = product.images?.[0];
                  return (
                    <Card key={product.id} className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                      <Link to={productUrl} aria-label={`Ver ${product.title}`}>
                        <div className="aspect-square bg-muted">{image ? <img src={image} alt={product.title} loading="lazy" width="480" height="480" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin imagen</div>}</div>
                        <CardContent className="space-y-2 p-4">
                          <h3 className="line-clamp-2 font-semibold">{product.title}</h3>
                          <p className="text-xl font-bold text-primary">{Number(product.price).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                          <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{product.location || cityName}</p>
                          {product.condition && <p className="text-xs text-muted-foreground">Estado: {product.condition}</p>}
                        </CardContent>
                      </Link>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card><CardContent className="py-10 text-center"><h3 className="text-lg font-semibold">Todavía no hay anuncios activos en esta búsqueda</h3><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">La página seguirá enlazando otras categorías y ciudades, pero no se enviará a Google para indexación hasta que tenga inventario real.</p><Button asChild className="mt-5"><Link to="/upload">Publicar el primer anuncio</Link></Button></CardContent></Card>
            )}
          </section>

          <section className="container pb-12">
            <div className="mx-auto max-w-3xl space-y-4 text-muted-foreground">
              <h2 className="text-2xl font-bold text-foreground">{categoryName ? `Comprar ${categoryName.toLowerCase()} usado en ${cityName}` : `Comprar y vender en ${cityName}`}</h2>
              <p>Reveta conecta compradores y vendedores locales. Puedes revisar anuncios activos, comparar precios, contactar por chat y encontrar productos publicados en tu zona.</p>
              <p>{isGenericCity ? `En ${cityName} puedes encontrar tecnología, motor, hogar, moda, deportes, libros, bicicletas, muebles y otros artículos usados.` : `Esta selección reúne anuncios relacionados con ${categoryIntent} publicados en ${cityName}.`}</p>
            </div>
          </section>

          <section className="container pb-12">
            <div className="mx-auto max-w-3xl"><h2 className="text-2xl font-bold">Búsquedas relacionadas</h2><div className="mt-5 grid gap-5 md:grid-cols-2">
              <Card><CardContent className="pt-6"><h3 className="font-semibold">Otras categorías en {cityName}</h3><div className="mt-4 flex flex-wrap gap-2">{relatedCategoryLinks.map((item) => <Link key={item.href} to={item.href} className="rounded-full border px-3 py-1.5 text-sm font-medium transition hover:border-primary hover:text-primary">{item.label}</Link>)}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><h3 className="font-semibold">También en otras ciudades</h3><div className="mt-4 flex flex-wrap gap-2">{relatedCityLinks.map((item) => <Link key={item.href} to={item.href} className="rounded-full border px-3 py-1.5 text-sm font-medium transition hover:border-primary hover:text-primary">{item.label}</Link>)}</div></CardContent></Card>
            </div></div>
          </section>

          <section className="container pb-12"><div className="mx-auto max-w-3xl"><h2 className="text-2xl font-bold">Preguntas frecuentes</h2><div className="mt-5 space-y-4">{faqs.map((faq) => <Card key={faq.question}><CardContent className="pt-6"><h3 className="font-semibold">{faq.question}</h3><p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p></CardContent></Card>)}</div></div></section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default SeoLanding;
