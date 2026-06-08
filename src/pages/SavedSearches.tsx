import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Bell, 
  BellOff, 
  Trash2, 
  ExternalLink,
  BookmarkX
} from 'lucide-react';

interface SavedSearch {
  id: string;
  name: string;
  query: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  min_price: number | null;
  max_price: number | null;
  condition: string | null;
  location: string | null;
  radius_km: number | null;
  alerts_enabled: boolean;
  created_at: string;
  category?: { name: string } | null;
}

const SavedSearches = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSearches();
    }
  }, [user]);

  const fetchSearches = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('saved_searches')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved searches:', error);
    } else {
      const formattedData = data?.map(s => ({
        ...s,
        category: s.categories
      })) || [];
      setSearches(formattedData);
    }

    setLoading(false);
  };

  const toggleAlerts = async (searchId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('saved_searches')
      .update({ alerts_enabled: enabled })
      .eq('id', searchId);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la alerta',
        variant: 'destructive'
      });
    } else {
      setSearches(searches.map(s => 
        s.id === searchId ? { ...s, alerts_enabled: enabled } : s
      ));
      toast({
        title: enabled ? 'Alertas activadas' : 'Alertas desactivadas',
        description: enabled 
          ? 'Recibirás notificaciones de nuevos productos'
          : 'No recibirás más notificaciones de esta búsqueda'
      });
    }
  };

  const deleteSearch = async (searchId: string) => {
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', searchId);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la búsqueda',
        variant: 'destructive'
      });
    } else {
      setSearches(searches.filter(s => s.id !== searchId));
      toast({
        title: 'Búsqueda eliminada',
        description: 'La búsqueda guardada se ha eliminado'
      });
    }
  };

  const buildSearchUrl = (search: SavedSearch) => {
    const params = new URLSearchParams();
    if (search.query) params.set('q', search.query);
    if (search.category_id) params.set('category', search.category_id);
    if (search.subcategory_id) params.set('subcategory', search.subcategory_id);
    if (search.min_price) params.set('minPrice', search.min_price.toString());
    if (search.max_price) params.set('maxPrice', search.max_price.toString());
    if (search.condition) params.set('condition', search.condition);
    if (search.location) params.set('location', search.location);
    if (search.radius_km) {
      params.set('geo', 'true');
      params.set('radius', search.radius_km.toString());
    }
    return `/search?${params.toString()}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Búsquedas Guardadas | Reveta</title>
        <meta name="description" content="Gestiona tus búsquedas guardadas y alertas" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container py-8 max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Búsquedas Guardadas</h1>

          {searches.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <BookmarkX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No tienes búsquedas guardadas</h3>
                <p className="text-muted-foreground mb-4">
                  Guarda búsquedas para acceder rápidamente y recibir alertas
                </p>
                <Button onClick={() => navigate('/search')}>
                  <Search className="h-4 w-4 mr-2" />
                  Explorar productos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {searches.map((search) => (
                <Card key={search.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{search.name}</h3>
                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          {search.query && (
                            <p>Búsqueda: "{search.query}"</p>
                          )}
                          {search.category && (
                            <p>Categoría: {search.category.name}</p>
                          )}
                          {search.condition && (
                            <p>Condición: {search.condition}</p>
                          )}
                          {(search.min_price || search.max_price) && (
                            <p>
                              Precio: {search.min_price || 0}€ - {search.max_price || '∞'}€
                            </p>
                          )}
                          {search.radius_km && (
                            <p>Radio: {search.radius_km} km</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          {search.alerts_enabled ? (
                            <Bell className="h-4 w-4 text-primary" />
                          ) : (
                            <BellOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Switch
                            checked={search.alerts_enabled}
                            onCheckedChange={(checked) => toggleAlerts(search.id, checked)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="flex-1"
                      >
                        <Link to={buildSearchUrl(search)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Ver resultados
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteSearch(search.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
};

export default SavedSearches;
