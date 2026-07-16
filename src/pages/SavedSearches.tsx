import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Bell, BellOff, Trash2, ExternalLink, BookmarkX, Sparkles, Clock, ShieldCheck, Plus, AlertTriangle } from 'lucide-react';

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

const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación',
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

const SavedSearches = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedSearch | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchSearches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchSearches = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('saved_searches')
      .select('id, name, query, category_id, subcategory_id, min_price, max_price, condition, location, radius_km, alerts_enabled, created_at, categories(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved searches:', error);
      toast({ title: 'No se pudieron cargar tus búsquedas', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } else {
      const formattedData = data?.map((item: any) => ({ ...item, category: item.categories })) || [];
      setSearches(formattedData);
    }

    setLoading(false);
  };

  const toggleAlerts = async (searchId: string, enabled: boolean) => {
    if (!user) return;
    setUpdatingId(searchId);
    const { error } = await supabase
      .from('saved_searches')
      .update({ alerts_enabled: enabled })
      .eq('id', searchId)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la alerta', variant: 'destructive' });
    } else {
      setSearches((current) => current.map((item) => item.id === searchId ? { ...item, alerts_enabled: enabled } : item));
      toast({ title: enabled ? 'Alertas activadas' : 'Alertas desactivadas', description: enabled ? 'Te avisaremos cuando haya productos que coincidan con esta búsqueda.' : 'No recibirás más avisos de esta búsqueda.' });
    }
    setUpdatingId(null);
  };

  const deleteSearch = async () => {
    if (!user || !deleteTarget) return;
    setUpdatingId(deleteTarget.id);
    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la búsqueda', variant: 'destructive' });
    } else {
      setSearches((current) => current.filter((item) => item.id !== deleteTarget.id));
      toast({ title: 'Búsqueda eliminada', description: 'La búsqueda guardada se ha eliminado' });
      setDeleteTarget(null);
    }
    setUpdatingId(null);
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

  const enabledAlerts = searches.filter((item) => item.alerts_enabled).length;

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Búsquedas guardadas | Reveta</title>
        <meta name="description" content="Gestiona tus búsquedas guardadas privadas en Reveta." />
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 max-w-4xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div><h1 className="text-3xl font-bold">Búsquedas guardadas</h1><p className="text-muted-foreground mt-1">Vuelve rápido a lo que te interesa y activa alertas para no perder oportunidades.</p></div>
            <Button onClick={() => navigate('/search')}><Plus className="h-4 w-4 mr-2" /> Nueva búsqueda</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{searches.length}</CardTitle><CardDescription className="flex items-center gap-2"><Search className="h-4 w-4" /> Guardadas</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{enabledAlerts}</CardTitle><CardDescription className="flex items-center gap-2"><Bell className="h-4 w-4" /> Alertas activas</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">24/7</CardTitle><CardDescription className="flex items-center gap-2"><Clock className="h-4 w-4" /> Seguimiento</CardDescription></CardHeader></Card>
          </div>

          {searches.length === 0 ? (
            <Card className="border-border/50"><CardContent className="py-12 text-center"><BookmarkX className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">Todavía no tienes búsquedas guardadas</h3><p className="text-muted-foreground mb-6 max-w-md mx-auto">Busca un producto, aplica filtros y pulsa “Guardar búsqueda” para volver más tarde y activar alertas.</p><Button onClick={() => navigate('/search')}><Search className="h-4 w-4 mr-2" /> Explorar productos</Button></CardContent></Card>
          ) : (
            <div className="space-y-4">
              {searches.map((search) => (
                <Card key={search.id} className="border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2"><h3 className="font-semibold text-lg truncate">{search.name}</h3>{search.alerts_enabled ? <Badge>Alerta activa</Badge> : <Badge variant="outline">Sin alerta</Badge>}</div>
                        <div className="flex flex-wrap gap-2 text-sm">{search.query && <Badge variant="secondary">“{search.query}”</Badge>}{search.category && <Badge variant="secondary">{search.category.name}</Badge>}{search.condition && <Badge variant="secondary">{conditionLabels[search.condition] || search.condition}</Badge>}{search.location && <Badge variant="secondary">{search.location}</Badge>}{(search.min_price || search.max_price) && <Badge variant="secondary">{search.min_price || 0}€ - {search.max_price || '∞'}€</Badge>}{search.radius_km && <Badge variant="secondary">Radio {search.radius_km} km</Badge>}</div>
                        <p className="text-xs text-muted-foreground mt-3">Guardada el {formatDate(search.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3 md:justify-end"><div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">{search.alerts_enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}<span className="hidden sm:inline">Alertas</span><Switch checked={search.alerts_enabled} disabled={updatingId === search.id} onCheckedChange={(checked) => toggleAlerts(search.id, checked)} /></div></div>
                    </div>
                    <div className="flex gap-2 mt-5"><Button variant="outline" size="sm" asChild className="flex-1"><Link to={buildSearchUrl(search)}><ExternalLink className="h-4 w-4 mr-2" /> Ver resultados</Link></Button><Button variant="outline" size="sm" disabled={updatingId === search.id} onClick={() => setDeleteTarget(search)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="mt-8 border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" />Cómo usar esta sección</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3"><div className="flex gap-2"><Search className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Guarda búsquedas con filtros concretos.</span></div><div className="flex gap-2"><Bell className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Activa alertas para no perder novedades.</span></div><div className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>Compra y negocia siempre dentro de Reveta.</span></div></CardContent></Card>
        </main>
        <Footer />
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Eliminar búsqueda guardada</AlertDialogTitle><AlertDialogDescription>¿Seguro que quieres eliminar “{deleteTarget?.name}”? Dejarás de recibir alertas de esta búsqueda.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={deleteSearch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default SavedSearches;