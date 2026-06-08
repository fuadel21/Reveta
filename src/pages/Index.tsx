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
          <FeaturedProducts />
          <Stats />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
