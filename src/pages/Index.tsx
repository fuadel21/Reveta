import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import CategoryNav from "@/components/CategoryNav";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import NearbyCTA from "@/components/NearbyCTA";
import FeaturedProducts from "@/components/FeaturedProducts";
import Stats from "@/components/Stats";
import Footer from "@/components/Footer";

const socialImage = "https://reveta.es/og-image.png?v=20260726";

const cityLinks = [
  { label: "Barcelona", href: "/segunda-mano/barcelona" },
  { label: "Madrid", href: "/segunda-mano/madrid" },
  { label: "Valencia", href: "/segunda-mano/valencia" },
  { label: "Sevilla", href: "/segunda-mano/sevilla" },
  { label: "Málaga", href: "/segunda-mano/malaga" },
  { label: "Girona", href: "/segunda-mano/girona" },
  { label: "Tarragona", href: "/segunda-mano/tarragona" },
  { label: "Lleida", href: "/segunda-mano/lleida" },
  { label: "Badalona", href: "/segunda-mano/badalona" },
  { label: "Hospitalet de Llobregat", href: "/segunda-mano/hospitalet-de-llobregat" },
  { label: "Sabadell", href: "/segunda-mano/sabadell" },
  { label: "Terrassa", href: "/segunda-mano/terrassa" },
  { label: "Mataró", href: "/segunda-mano/mataro" },
  { label: "Pineda de Mar", href: "/segunda-mano/pineda-de-mar" },
  { label: "Lloret de Mar", href: "/segunda-mano/lloret-de-mar" },
  { label: "Blanes", href: "/segunda-mano/blanes" },
  { label: "Malgrat de Mar", href: "/segunda-mano/malgrat-de-mar" },
  { label: "Figueres", href: "/segunda-mano/figueres" },
  { label: "Granollers", href: "/segunda-mano/granollers" },
  { label: "Vic", href: "/segunda-mano/vic" },
];

const categoryLinks = [
  { label: "Electrónica de segunda mano en Barcelona", href: "/segunda-mano/barcelona/electronica" },
  { label: "iPhone de segunda mano en Barcelona", href: "/segunda-mano/barcelona/iphone" },
  { label: "Muebles usados en Barcelona", href: "/segunda-mano/barcelona/muebles" },
  { label: "Motor de segunda mano en Madrid", href: "/segunda-mano/madrid/motor" },
  { label: "Electrónica de segunda mano en Madrid", href: "/segunda-mano/madrid/electronica" },
  { label: "iPhone de segunda mano en Valencia", href: "/segunda-mano/valencia/iphone" },
  { label: "Muebles usados en Sevilla", href: "/segunda-mano/sevilla/muebles" },
  { label: "Motor de segunda mano en Málaga", href: "/segunda-mano/malaga/motor" },
  { label: "Electrónica en Badalona", href: "/segunda-mano/badalona/electronica" },
  { label: "Electrónica en Hospitalet de Llobregat", href: "/segunda-mano/hospitalet-de-llobregat/electronica" },
  { label: "Electrónica en Pineda de Mar", href: "/segunda-mano/pineda-de-mar/electronica" },
  { label: "Muebles en Pineda de Mar", href: "/segunda-mano/pineda-de-mar/muebles" },
];

const cityItemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": "https://reveta.es/#popular-cities",
  name: "Ciudades para comprar y vender segunda mano en Reveta",
  itemListElement: cityLinks.slice(0, 12).map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: `Segunda mano en ${item.label}`,
    url: `https://reveta.es${item.href}`,
  })),
};

const Index = () => (
  <>
    <Helmet>
      <title>Reveta - Compra y vende de segunda mano cerca de ti</title>
      <meta name="description" content="Compra y vende productos de segunda mano en tu ciudad. Encuentra ofertas locales en tecnología, muebles, motor, moda, bicicletas, hogar y mucho más en Reveta." />
      <meta name="robots" content="index,follow,max-image-preview:large" />
      <link rel="canonical" href="https://reveta.es/" />
      <meta property="og:title" content="Reveta - Compra y vende de segunda mano cerca de ti" />
      <meta property="og:description" content="Compra y vende productos de segunda mano en tu ciudad. Encuentra ofertas locales en tecnología, muebles, motor, moda, bicicletas, hogar y mucho más en Reveta." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://reveta.es/" />
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:secure_url" content={socialImage} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Reveta, marketplace de segunda mano cerca de ti" />
      <meta property="og:site_name" content="Reveta" />
      <meta property="og:locale" content="es_ES" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Reveta - Compra y vende de segunda mano cerca de ti" />
      <meta name="twitter:description" content="Compra y vende productos de segunda mano en tu ciudad. Encuentra ofertas locales en tecnología, muebles, motor, moda, bicicletas, hogar y mucho más en Reveta." />
      <meta name="twitter:image" content={socialImage} />
      <meta name="twitter:image:alt" content="Reveta, marketplace de segunda mano cerca de ti" />
      <script type="application/ld+json">{JSON.stringify(cityItemListJsonLd)}</script>
    </Helmet>

    <div className="min-h-screen bg-background">
      <Header />
      <CategoryNav />
      <main>
        <Hero />
        <NearbyCTA />
        <Categories />
        <section className="container mx-auto px-4 py-8">
          <h2 className="text-3xl font-bold text-center mb-8">Productos Destacados</h2>
          <FeaturedProducts limit={8} showViewAll={true} />
        </section>
        <section className="container mx-auto px-4 py-10">
          <div className="rounded-2xl border bg-card p-6 md:p-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold md:text-3xl">Compra y vende segunda mano por ciudad</h2>
              <p className="mt-3 text-muted-foreground">Encuentra productos cerca de ti, descubre ofertas locales y publica anuncios gratis en Reveta. Explora páginas por ciudad y categoría para comprar tecnología, muebles, motor, moda, bicicletas y productos usados cerca de tu zona.</p>
            </div>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-3 font-semibold">Ciudades populares</h3>
                <div className="flex flex-wrap gap-2">
                  {cityLinks.map((item) => (
                    <Link key={item.href} to={item.href} className="rounded-full border px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary">Segunda mano en {item.label}</Link>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-semibold">Búsquedas populares</h3>
                <div className="flex flex-wrap gap-2">
                  {categoryLinks.map((item) => (
                    <Link key={item.href} to={item.href} className="rounded-full border px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary">{item.label}</Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="container mx-auto px-4 pb-10">
          <div className="mx-auto max-w-4xl rounded-2xl bg-muted/40 p-6 md:p-8">
            <h2 className="text-2xl font-bold">Reveta, marketplace de segunda mano en España</h2>
            <div className="mt-4 space-y-3 text-muted-foreground">
              <p>Reveta es una plataforma para comprar y vender productos de segunda mano entre particulares. Puedes publicar anuncios gratis, buscar productos por ubicación, hablar por chat y negociar ofertas antes de comprar.</p>
              <p>Nuestro objetivo es ayudarte a encontrar oportunidades locales: electrónica usada, muebles de segunda mano, productos de motor, bicicletas, ropa, libros, hogar y mucho más en ciudades como Barcelona, Madrid, Valencia, Girona, Badalona, Sabadell, Terrassa, Mataró, Pineda de Mar, Lloret de Mar o Blanes.</p>
            </div>
          </div>
        </section>
        <Stats />
      </main>
      <Footer />
    </div>
  </>
);

export default Index;
