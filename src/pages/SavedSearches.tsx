import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  AlertTriangle,
  Bell,
  BellOff,
  BookmarkX,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

type SavedSearch = {
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
};

type PreviewProduct = {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  location: string | null;
  created_at: string;
};

type SearchInsight = {
  loading: boolean;
  count: number | null;
  products: PreviewProduct[];
  error: boolean;
  geoDependent: boolean;
};

const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación',
};

const PREVIEW_LIMIT = 3;
const CONCURRENT_INSIGHTS = 4;
const MAX_NAME_LENGTH = 80;

const formatDate = (value: string) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const formatPrice = (value: number) => `${Number(value || 0).toLocaleString('es-ES')} €`;
const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'producto';

const SavedSearches = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [insights, setInsights] = useState<Record<string, SearchInsight>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedSearch | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.id) void fetchSearches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const buildSearchUrl = (search: SavedSearch) => {
    const params = new URLSearchParams();
    if (search.query) params.set('q', search.query);
    if (search.category_id) params.set('category', search.category_id);
    if (search.subcategory_id) params.set('subcategory', search.subcategory_id);
    if (search.min_price !== null) params.set('minPrice', search.min_price.toString());
    if (search.max_price !== null) params.set('maxPrice', search.max_price.toString());
    if (search.condition) params.set('condition', search.condition);
    if (search.location) params.set('location', search.location);
    if (search.radius_km) {
      params.set('geo', 'true');
      params.set('radius', search.radius_km.toString());
    }
    return `/search?${params.toString()}`;
  };

  const fetchInsight = async (search: SavedSearch): Promise<SearchInsight> => {
    if (search.radius_km) return { loading: false, count: null, products: [], error: false, geoDependent: true };

    try {
      let query = supabase
        .from('products')
        .select('id,title,price,images,location,created_at', { count: 'exact' })
        .eq('status', 'active');
      if (search.query) query = query.ilike('title', `%${search.query}%`);
      if (search.category_id) query = query.eq('category_id', search.category_id);
      if (search.subcategory_id) query = query.eq('subcategory_id', search.subcategory_id);
      if (search.min_price !== null) query = query.gte('price', search.min_price);
      if (search.max_price !== null) query = query.lte('price', search.max_price);
      if (search.condition) query = query.eq('condition', search.condition);
      if (search.location) query = query.ilike('location', `%${search.location}%`);

      const { data, count, error } = await query.order('created_at', { ascending: false }).limit(PREVIEW_LIMIT);
      if (error) throw error;
      return { loading: false, count: count || 0, products: (data || []) as PreviewProduct[], error: false, geoDependent: false };
    } catch (error) {
      console.error('Error loading saved-search insight:', error);
      return { loading: false, count: null, products: [], error: true, geoDependent: false };
    }
  };

  const loadInsights = async (items: SavedSearch[]) => {
    setInsights(Object.fromEntries(items.map((item) => [item.id, { loading: true, count: null, products: [], error: false, geoDependent: !!item.radius_km }])));

    for (let index = 0; index < items.length; index += CONCURRENT_INSIGHTS) {
      const batch = items.slice(index, index + CONCURRENT_INSIGHTS);
      const results = await Promise.all(batch.map(async (item) => [item.id, await fetchInsight(item)] as const));
      setInsights((current) => ({ ...current, ...Object.fromEntries(results) }));
    }
  };

  const fetchSearches = async (manual = false) => {
    if (!user) return;
    if (manual) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('id,name,query,category_id,subcategory_id,min_price,max_price,condition,location,radius_km,alerts_enabled,created_at,categories(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const formatted = (data || []).map((item) => ({ ...item, category: item.categories })) as SavedSearch[];
      setSearches(formatted);
      await loadInsights(formatted);
      if (manual) toast({ title: 'Búsquedas actualizadas' });
    } catch (error) {
      console.error('Error fetching saved searches:', error);
      toast({ title: 'No se pudieron cargar tus búsquedas', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleAlerts = async (searchId: string, enabled: boolean) => {
    if (!user || updatingId) return;
    setUpdatingId(searchId);
    const { error } = await supabase.from('saved_searches').update({ alerts_enabled: enabled }).eq('id', searchId).eq('user_id', user.id);
    if (error) {
      toast({ title: 'No se pudo actualizar la alerta', variant: 'destructive' });
    } else {
      setSearches((current) => current.map((item) => item.id === searchId ? { ...item, alerts_enabled: enabled } : item));
      toast({ title: enabled ? 'Alertas activadas' : 'Alertas desactivadas' });
    }
    setUpdatingId(null);
  };

  const startRename = (search: SavedSearch) => {
    setEditingId(search.id);
    setEditingName(search.name);
  };

  const saveRename = async (searchId: string) => {
    if (!user || updatingId) return;
    const cleanName = editingName.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 3 || cleanName.length > MAX_NAME_LENGTH) {
      toast({ title: 'Revisa el nombre', description: `Escribe entre 3 y ${MAX_NAME_LENGTH} caracteres.`, variant: 'destructive' });
      return;
    }

    setUpdatingId(searchId);
    const { error } = await supabase.from('saved_searches').update({ name: cleanName }).eq('id', searchId).eq('user_id', user.id);
    if (error) {
      toast({ title: 'No se pudo renombrar', variant: 'destructive' });
    } else {
      setSearches((current) => current.map((item) => item.id === searchId ? { ...item, name: cleanName } : item));
      setEditingId(null);
      setEditingName('');
      toast({ title: 'Nombre actualizado' });
    }
    setUpdatingId(null);
  };

  const deleteSearch = async () => {
    if (!user || !deleteTarget || updatingId) return;
    setUpdatingId(deleteTarget.id);
    const { error } = await supabase.from('saved_searches').delete().eq('id', deleteTarget.id).eq('user_id', user.id);
    if (error) {
      toast({ title: 'No se pudo eliminar la búsqueda', variant: 'destructive' });
    } else {
      setSearches((current) => current.filter((item) => item.id !== deleteTarget.id));
      setInsights((current) => { const next = { ...current }; delete next[deleteTarget.id]; return next; });
      toast({ title: 'Búsqueda eliminada' });
      setDeleteTarget(null);
    }
    setUpdatingId(null);
  };

  const enabledAlerts = useMemo(() => searches.filter((item) => item.alerts_enabled).length, [searches]);
  const totalMatches = useMemo(() => Object.values(insights).reduce((sum, insight) => sum + (insight.count || 0), 0), [insights]);

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <Helmet><title>Búsquedas guardadas | Reveta</title><meta name="description" content="Gestiona tus búsquedas guardadas privadas en Reveta." /><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 max-w-5xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h1 className="text-3xl font-bold">Búsquedas guardadas</h1><p className="mt-1 text-muted-foreground">Revisa coincidencias, controla alertas y vuelve a tus filtros sin empezar de cero.</p></div>
            <div className="flex gap-2"><Button variant="outline" disabled={refreshing} onClick={() => fetchSearches(true)}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button><Button onClick={() => navigate('/search')}><Plus className="mr-2 h-4 w-4" />Nueva búsqueda</Button></div>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{searches.length}</CardTitle><CardDescription className="flex items-center gap-2"><Search className="h-4 w-4" />Guardadas</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{enabledAlerts}</CardTitle><CardDescription className="flex items-center gap-2"><Bell className="h-4 w-4" />Alertas activas</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{totalMatches}</CardTitle><CardDescription className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Coincidencias actuales</CardDescription></CardHeader></Card>
          </div>

          {searches.length === 0 ? (
            <Card className="border-border/50"><CardContent className="py-12 text-center"><BookmarkX className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><h3 className="mb-2 text-lg font-medium">Todavía no tienes búsquedas guardadas</h3><p className="mx-auto mb-6 max-w-md text-muted-foreground">Busca un producto, aplica filtros y pulsa “Guardar búsqueda” para volver más tarde y activar alertas.</p><Button onClick={() => navigate('/search')}><Search className="mr-2 h-4 w-4" />Explorar productos</Button></CardContent></Card>
          ) : (
            <div className="space-y-5">
              {searches.map((search) => {
                const insight = insights[search.id];
                const isEditing = editingId === search.id;
                return (
                  <Card key={search.id} className="overflow-hidden border-border/50">
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {isEditing ? <div className="flex w-full max-w-md gap-2"><Input autoFocus value={editingName} maxLength={MAX_NAME_LENGTH} disabled={updatingId === search.id} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveRename(search.id); if (event.key === 'Escape') setEditingId(null); }} /><Button size="icon" disabled={updatingId === search.id} onClick={() => saveRename(search.id)}><Save className="h-4 w-4" /></Button><Button size="icon" variant="outline" disabled={updatingId === search.id} onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button></div> : <><h2 className="truncate text-lg font-semibold">{search.name}</h2><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startRename(search)} aria-label="Renombrar búsqueda"><Pencil className="h-4 w-4" /></Button></>}
                            {search.alerts_enabled ? <Badge>Alerta activa</Badge> : <Badge variant="outline">Sin alerta</Badge>}
                            {insight?.loading ? <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Calculando</Badge> : insight?.geoDependent ? <Badge variant="secondary"><MapPin className="mr-1 h-3 w-3" />Se calcula al abrir</Badge> : insight?.error ? <Badge variant="destructive">Sin datos</Badge> : <Badge variant="secondary">{insight?.count || 0} coincidencias</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm">{search.query && <Badge variant="secondary">“{search.query}”</Badge>}{search.category && <Badge variant="secondary">{search.category.name}</Badge>}{search.condition && <Badge variant="secondary">{conditionLabels[search.condition] || search.condition}</Badge>}{search.location && <Badge variant="secondary">{search.location}</Badge>}{(search.min_price !== null || search.max_price !== null) && <Badge variant="secondary">{search.min_price || 0} € – {search.max_price || '∞'} €</Badge>}{search.radius_km && <Badge variant="secondary">Radio {search.radius_km} km</Badge>}</div>
                          <p className="mt-3 text-xs text-muted-foreground">Guardada el {formatDate(search.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">{search.alerts_enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}<span className="hidden sm:inline">Alertas</span><Switch checked={search.alerts_enabled} disabled={updatingId === search.id} onCheckedChange={(checked) => toggleAlerts(search.id, checked)} /></div>
                      </div>

                      {insight?.geoDependent ? (
                        <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><MapPin className="mr-2 inline h-4 w-4" />Esta búsqueda depende de tu ubicación actual. Ábrela para recalcular resultados dentro de {search.radius_km} km.</div>
                      ) : insight?.products.length ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          {insight.products.map((product) => <Link key={product.id} to={`/producto/${product.id}/${slugify(product.title)}`} className="flex gap-3 rounded-xl border p-3 transition hover:bg-muted/50"><img src={product.images?.[0] || '/placeholder.svg'} alt="" className="h-16 w-16 rounded-lg object-cover" /><div className="min-w-0"><p className="line-clamp-2 text-sm font-medium">{product.title}</p><p className="mt-1 font-semibold text-primary">{formatPrice(product.price)}</p><p className="truncate text-xs text-muted-foreground">{product.location || 'Sin ubicación'}</p></div></Link>)}
                        </div>
                      ) : insight && !insight.loading && !insight.error ? (
                        <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Ahora mismo no hay productos activos que coincidan. Mantén la alerta encendida para no perder los siguientes.</div>
                      ) : null}

                      <div className="mt-5 flex gap-2"><Button variant="outline" size="sm" asChild className="flex-1"><Link to={buildSearchUrl(search)}><ExternalLink className="mr-2 h-4 w-4" />Ver resultados</Link></Button><Button variant="outline" size="sm" disabled={updatingId === search.id} onClick={() => setDeleteTarget(search)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="mt-8 border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" />Alertas que ayudan de verdad</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3"><div className="flex gap-2"><Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Usa filtros concretos para reducir ruido.</span></div><div className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Actualiza para ver las coincidencias más recientes.</span></div><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Compra y negocia siempre dentro de Reveta.</span></div></CardContent></Card>
        </main>
        <Footer />
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !updatingId) setDeleteTarget(null); }}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Eliminar búsqueda guardada</AlertDialogTitle><AlertDialogDescription>¿Seguro que quieres eliminar “{deleteTarget?.name}”? Dejarás de recibir sus alertas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={!!updatingId}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={!!updatingId} onClick={deleteSearch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default SavedSearches;
