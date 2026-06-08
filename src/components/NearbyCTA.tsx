import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useGeolocation } from '@/hooks/useGeolocation';
import { toast } from 'sonner';

const NearbyCTA = () => {
  const navigate = useNavigate();
  const geolocation = useGeolocation();
  const [radius, setRadius] = useState(10);

  const handleSearch = async () => {
    if (!geolocation.hasLocation) {
      geolocation.requestLocation();
      toast.info('Solicitando tu ubicación...');
      return;
    }
    navigate(`/search?geo=true&radius=${radius}`);
  };

  return (
    <section className="container py-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/5 to-background border border-primary/10 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-start gap-4 flex-1">
            <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Navigation className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Productos cerca de ti</h2>
              <p className="text-muted-foreground mt-1">
                Encuentra ofertas a pocos minutos de donde estás.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:min-w-[380px]">
            <div className="flex-1 bg-card/60 backdrop-blur-sm rounded-2xl px-4 py-3 border border-border/50">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Radio</span>
                <span className="font-semibold text-foreground">{radius} km</span>
              </div>
              <Slider
                value={[radius]}
                onValueChange={(v) => setRadius(v[0])}
                min={1}
                max={100}
                step={1}
              />
            </div>
            <Button
              onClick={handleSearch}
              size="lg"
              disabled={geolocation.loading}
              className="h-14 px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
            >
              {geolocation.loading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <MapPin className="h-5 w-5 mr-2" />
              )}
              Cerca de mí
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NearbyCTA;
