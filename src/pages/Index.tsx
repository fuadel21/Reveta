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

const cityLinks = [
  { label: "Madrid", href: "/segunda-mano/madrid" },
  { label: "Barcelona", href: "/segunda-mano/barcelona" },
  { label: "Valencia", href: "/segunda-mano/valencia" },
  { label: "Sevilla", href: "/segunda-mano/sevilla" },
  { label: "Málaga", href: "/segunda-mano/malaga" },
  { label: "Bilbao", href: "/segunda-mano/bilbao" },
];

const categoryLinks = [
  { label: "Motor en Madrid", href: "/segunda-mano/madrid/motor" },
  { label: "Electrónica en Barcelona", href: "/segunda-mano/barcelona/electronica" },
  { label: "iPhone en Valencia", href: "/segunda-mano/valencia/iphone" },
  { label: "Muebles en Sevilla", href: "/segunda-mano/sevilla/muebles" },
  { label: "Bicicletas en Madrid", href: "/segunda-mano/madrid/bicicletas" },
  { label: "Motor en Málaga", href: "/segunda-mano/malaga/motor" },
];

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Reveta - Compra y vende de segunda mano cerca de ti</title>
        <meta 
          name="description" 
          content="Compra y vende productos de segunda mano en tu ciudad. Miles de ofertas en tecnología, muebles, coches, moda y mucho más. ¡Empieza a ahorrar hoy!" 
        />
        <meta name="keywords" content="segunda mano, comprar, vender, marketplace, usado, ofertas" />
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
                <p className="mt-3 text-muted-foreground">
                  Encuentra productos cerca de ti, descubre ofertas locales y publica anuncios gratis en Reveta.
                </p>
              </div>
              <div className="mt-8 grid gap-8 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 font-semibold">Ciudades populares</h3>
                  <div className="flex flex-wrap gap-2">
                    {cityLinks.map((item) => (
                      <Link key={item.href} to={item.href} className="rounded-full border px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary">
                        Segunda mano en {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 font-semibold">Búsquedas populares</h3>
                  <div className="flex flex-wrap gap-2">
                    {categoryLinks.map((item) => (
                      <Link key={item.href} to={item.href} className="rounded-full border px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <Stats />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
