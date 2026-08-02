import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, BarChart3, Eye, Heart, ImageOff, MessageCircle, Package, RefreshCw, RotateCcw, Search, ShoppingBag, Sparkles, Tag, Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductStatusBadge from '@/components/ProductStatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  location: string | null;
  images: string[] | null;
  status: string | null;
  created_at: string;
  boosted_until?: string | null;
};

type ProductMetrics = {
  favorites: number;
  conversations: number;
  offers: number;
  reservations: number;
  openTransactions: number;
};

type DashboardProduct = ProductRow & { metrics: ProductMetrics };

const EMPTY_METRICS: ProductMetrics = { favorites: 0, conversations: 0, offers: 0, reservations: 0, openTransactions: 0 };
const OPEN_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];

const getImage = (product: ProductRow) => Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
const totalInterest = (product: DashboardProduct) => product.metrics.favorites + product.metrics.conversations + product.metrics.offers + product.metrics.reservations;
const isBoostActive = (value?: string | null) => !!value && new Date(value).getTime() > Date.now();

const getRecommendation = (product: DashboardProduct) => {
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(product.created_at).getTime()) / 86400000));
  if (!getImage(product) || (product.images?.length || 0) < 2) return 'Añade varias fotos claras para generar más confianza.';
  if ((product.description || '').trim().length < 80) return 'Amplía la descripción con marca, estado, medidas y accesorios.';
  if (!product.location) return 'Añade una ubicación para aparecer en búsquedas cercanas.';
  if (product.status === 'active' && ageDays >= 14 && totalInterest(product) === 0) return 'Lleva dos semanas sin interés: revisa precio, título y foto principal.';
  if (product.metrics.favorites >= 3 && product.metrics.conversations === 0) return 'Tiene favoritos pero pocos mensajes: prueba una pequeña bajada de precio.';
  if (product.metrics.conversations > 0 && product.metrics.offers === 0) return 'Hay conversaciones abiertas: responde rápido y facilita la negociación.';
  if (product.metrics.offers > 0) return 'Tienes ofertas: revísalas pronto para no perder compradores.';
  return 'El anuncio está bien preparado. Mantén respuestas rápidas y datos actualizados.';
};

const SellerDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('attention');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user?.id) fetchDashboard();
  }, [user?.id]);

  const fetchDashboard = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: productRows, error } = await supabase
        .from('products')
        .select('id, title, description, price, location, images, status, created_at, boosted_until')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const hydrated = await Promise.all(((productRows || []) as ProductRow[]).map(async (product) => {
        const [favorites, conversations, offers, reservations, transactions] = await Promise.all([
          supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('product_id', product.id),
          supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('product_id', product.id),
          (supabase as any).from('offers').select('id', { count: 'exact', head: true }).eq('product_id', product.id).in('status', ['pending', 'accepted']),
          (supabase as any).from('product_reservations').select('id', { count: 'exact', head: true }).eq('product_id', product.id).eq('status', 'active'),
          supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('product_id', product.id).in('status', OPEN_TRANSACTION_STATUSES),
        ]);

        return {
          ...product,
          metrics: {
            favorites: favorites.count || 0,
            conversations: conversations.count || 0,
            offers: offers.count || 0,
            reservations: reservations.count || 0,
            openTransactions: transactions.count || 0,
          },
        } as DashboardProduct;
      }));
      setProducts(hydrated);
    } catch (error) {
      console.error('Error loading seller dashboard:', error);
      toast({ title: 'No se pudo cargar el panel', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const changeProductStatus = async (product: DashboardProduct, nextStatus: 'active' | 'inactive') => {
    if (!user || updatingId) return;
    if (product.metrics.openTransactions > 0 || product.metrics.reservations > 0) {
      toast({ title: 'Acción bloqueada', description: 'Este anuncio tiene una reserva u operación abierta. Resuélvela antes de cambiar su estado.', variant: 'destructive' });
      return;
    }
    setUpdatingId(product.id);
    const { error } = await supabase.from('products').update({ status: nextStatus }).eq('id', product.id).eq('user_id', user.id);
    if (error) {
      toast({ title: 'No se pudo actualizar', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } else {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, status: nextStatus } : item));
      toast({ title: nextStatus === 'active' ? 'Anuncio reactivado' : 'Anuncio retirado' });
    }
    setUpdatingId(null);
  };

  const summary = useMemo(() => ({
    active: products.filter((product) => product.status === 'active').length,
    reserved: products.filter((product) => product.status === 'reserved').length,
    sold: products.filter((product) => product.status === 'sold').length,
    inactive: products.filter((product) => product.status === 'inactive').length,
    favorites: products.reduce((sum, product) => sum + product.metrics.favorites, 0),
    conversations: products.reduce((sum, product) => sum + product.metrics.conversations, 0),
    offers: products.reduce((sum, product) => sum + product.metrics.offers, 0),
    attention: products.filter((product) => product.metrics.offers > 0 || product.metrics.reservations > 0 || product.metrics.openTransactions > 0).length,
  }), [products]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesQuery = !normalized || product.title.toLowerCase().includes(normalized) || (product.location || '').toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'interest') return totalInterest(b) - totalInterest(a);
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      const attentionA = a.metrics.openTransactions * 10 + a.metrics.reservations * 8 + a.metrics.offers * 5 + a.metrics.conversations;
      const attentionB = b.metrics.openTransactions * 10 + b.metrics.reservations * 8 + b.metrics.offers * 5 + b.metrics.conversations;
      return attentionB - attentionA;
    });
  }, [products, query, sortBy, statusFilter]);

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><RefreshCw className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <Helmet><title>Panel del vendedor | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><Badge variant="secondary" className="mb-2"><BarChart3 className="mr-1 h-3.5 w-3.5" />Panel profesional</Badge><h1 className="text-2xl font-bold">Rendimiento de tus anuncios</h1><p className="text-sm text-muted-foreground">Detecta qué necesita atención y toma decisiones rápidas desde un solo lugar.</p></div>
            <div className="flex gap-2"><Button variant="outline" onClick={fetchDashboard}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button><Button asChild><Link to="/upload">Publicar anuncio</Link></Button></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Activos</p><p className="text-2xl font-bold">{summary.active}</p><p className="text-xs text-muted-foreground">{summary.reserved} reservados · {summary.sold} vendidos</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Interés total</p><p className="text-2xl font-bold">{summary.favorites + summary.conversations}</p><p className="text-xs text-muted-foreground">{summary.favorites} favoritos · {summary.conversations} chats</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ofertas abiertas</p><p className="text-2xl font-bold">{summary.offers}</p><p className="text-xs text-muted-foreground">Revísalas para vender antes</p></CardContent></Card>
            <Card className={summary.attention > 0 ? 'border-amber-300 bg-amber-50/50' : ''}><CardContent className="p-4"><p className="text-xs text-muted-foreground">Necesitan atención</p><p className="text-2xl font-bold">{summary.attention}</p><p className="text-xs text-muted-foreground">Ofertas, reservas u operaciones</p></CardContent></Card>
          </div>

          <Card><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por producto o ubicación" className="pl-9" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="reserved">Reservados</SelectItem><SelectItem value="sold">Vendidos</SelectItem><SelectItem value="inactive">Retirados</SelectItem></SelectContent></Select><Select value={sortBy} onValueChange={setSortBy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="attention">Prioridad</SelectItem><SelectItem value="interest">Más interés</SelectItem><SelectItem value="newest">Más recientes</SelectItem><SelectItem value="oldest">Más antiguos</SelectItem></SelectContent></Select></CardContent></Card>

          {visibleProducts.length === 0 ? <Card><CardContent className="p-10 text-center text-muted-foreground"><Package className="mx-auto mb-3 h-10 w-10 opacity-30" />No hay anuncios que coincidan con estos filtros.</CardContent></Card> : <div className="space-y-4">{visibleProducts.map((product) => {
            const image = getImage(product);
            const blocked = product.metrics.openTransactions > 0 || product.metrics.reservations > 0;
            const boostActive = isBoostActive(product.boosted_until);
            const canBoost = product.status === 'active' && !boostActive;
            return <Card key={product.id} className="overflow-hidden"><CardContent className="p-0"><div className="grid md:grid-cols-[180px_1fr]"><div className="aspect-video bg-muted md:aspect-auto md:min-h-48">{image ? <img src={image} alt={product.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageOff className="h-8 w-8 text-muted-foreground" /></div>}</div><div className="p-4 space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{product.title}</h2><ProductStatusBadge status={product.status || 'active'} />{boostActive && <Badge variant="secondary"><Sparkles className="mr-1 h-3 w-3" />Destacado activo</Badge>}</div><p className="mt-1 text-lg font-bold text-primary">{Number(product.price).toLocaleString('es-ES')} €</p><p className="text-xs text-muted-foreground">{product.location || 'Sin ubicación'} · Publicado {new Date(product.created_at).toLocaleDateString('es-ES')}</p></div>{blocked && <Badge className="bg-amber-600 text-white"><AlertTriangle className="mr-1 h-3 w-3" />Operación abierta</Badge>}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><div className="rounded-lg border p-2 text-center"><Heart className="mx-auto h-4 w-4" /><p className="font-bold">{product.metrics.favorites}</p><p className="text-[11px] text-muted-foreground">Favoritos</p></div><div className="rounded-lg border p-2 text-center"><MessageCircle className="mx-auto h-4 w-4" /><p className="font-bold">{product.metrics.conversations}</p><p className="text-[11px] text-muted-foreground">Chats</p></div><div className="rounded-lg border p-2 text-center"><Tag className="mx-auto h-4 w-4" /><p className="font-bold">{product.metrics.offers}</p><p className="text-[11px] text-muted-foreground">Ofertas</p></div><div className="rounded-lg border p-2 text-center"><ShoppingBag className="mx-auto h-4 w-4" /><p className="font-bold">{product.metrics.reservations}</p><p className="text-[11px] text-muted-foreground">Reservas</p></div><div className="rounded-lg border p-2 text-center"><BarChart3 className="mx-auto h-4 w-4" /><p className="font-bold">{totalInterest(product)}</p><p className="text-[11px] text-muted-foreground">Interés</p></div></div>
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="font-medium">Recomendación</p><p className="text-muted-foreground">{getRecommendation(product)}</p></div></div>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link to={`/product/${product.id}`}><Eye className="mr-1 h-4 w-4" />Ver</Link></Button>{canBoost ? <Button size="sm" variant="outline" asChild><Link to={`/boost/${product.id}`}><BarChart3 className="mr-1 h-4 w-4" />Destacar</Link></Button> : <Button size="sm" variant="outline" disabled title={boostActive ? 'Este anuncio ya tiene un destacado activo' : 'Solo se pueden destacar anuncios activos'}><BarChart3 className="mr-1 h-4 w-4" />{boostActive ? 'Ya destacado' : 'Solo anuncios activos'}</Button>}<Button size="sm" variant="outline" asChild><Link to="/messages"><MessageCircle className="mr-1 h-4 w-4" />Mensajes</Link></Button>{product.status === 'inactive' ? <Button size="sm" disabled={updatingId === product.id || blocked} onClick={() => changeProductStatus(product, 'active')}><RotateCcw className="mr-1 h-4 w-4" />Reactivar</Button> : product.status === 'active' ? <Button size="sm" variant="destructive" disabled={updatingId === product.id || blocked} onClick={() => changeProductStatus(product, 'inactive')}><Trash2 className="mr-1 h-4 w-4" />Retirar</Button> : null}</div>
          </div></div></CardContent></Card>;
          })}</div>}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default SellerDashboard;
