import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import CategoryNav from "@/components/CategoryNav";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import NearbyCTA from "@/components/NearbyCTA";
import FeaturedProducts from "@/components/FeaturedProducts";
import Stats from "@/components/Stats";
import Footer from "@/components/Footer";

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
          <Stats />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
