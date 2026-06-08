import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-lifestyle.jpg";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative bg-background overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="container relative">
        <div className="flex flex-col lg:flex-row items-center min-h-[450px] lg:min-h-[550px]">
          {/* Left side - Text content */}
          <div className="w-full lg:w-2/5 py-12 lg:py-16 z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-6 animate-fade-in">
              <Sparkles className="h-4 w-4" />
              <span>+2M usuarios activos</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Compra y vende</span>
              <br />
              <span className="text-foreground">artículos de</span>
              <br />
              <span className="text-foreground">segunda mano.</span>
            </h1>
            
            <p className="mt-4 text-lg text-muted-foreground max-w-md animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              La forma más fácil de dar una segunda vida a tus cosas y encontrar ofertas increíbles cerca de ti.
            </p>
            
            <div className="mt-8 flex flex-wrap gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Button 
                onClick={() => navigate('/upload')}
                size="lg"
                className="h-14 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 group"
              >
                <Plus className="h-5 w-5 mr-2" />
                Vender ahora
                <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
              
              <Button 
                onClick={() => navigate('/search')}
                variant="outline"
                size="lg"
                className="h-14 px-8 rounded-full border-2 border-primary/20 hover:border-primary/40 text-foreground font-semibold transition-all duration-300 hover:-translate-y-0.5"
              >
                Explorar productos
              </Button>
            </div>
          </div>
          
          {/* Right side - Hero image */}
          <div className="w-full lg:w-3/5 lg:absolute lg:right-0 lg:top-0 lg:bottom-0 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="relative h-full">
              <img 
                src={heroImage}
                alt="Persona usando la app de segunda mano"
                className="w-full h-full object-cover lg:rounded-l-[2.5rem] shadow-2xl"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent lg:rounded-l-[2.5rem]" />
              
              {/* Floating stats card */}
              <div className="absolute bottom-8 left-8 bg-card/95 backdrop-blur-sm rounded-2xl p-4 shadow-card-hover animate-fade-in-up hidden lg:block" style={{ animationDelay: '0.6s' }}>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">+5M productos</p>
                    <p className="text-sm text-muted-foreground">publicados este mes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
