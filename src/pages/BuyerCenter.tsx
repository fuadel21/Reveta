import { getErrorMessage } from '@/lib/errors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertCircle,
  Bell,
  Bookmark,
  CheckCircle2,
  Clock3,
  CreditCard,
  Heart,
  Loader2,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import {
  clearRecentProducts,
  EMPTY_BUYER_CENTER,
  loadBuyerCenter,
  type BuyerCenterData,
  type BuyerProduct,
} from '@/lib/buyerCenter';

const ACTIVE_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
const FINISHED_TRANSACTION_STATUSES = ['completed', 'cancelled', 'refunded'];

type FavoriteFilter = 'all' | 'available' | 'price-drops' | 'unavailable';
type FavoriteSort = 'opportunity' | 'recent' | 'price-low' | 'price-high';

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'producto';
const formatDate = (value: string) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const formatPrice = (value: number) => `${Number(value || 0).toLocaleString('es-ES')} €`;
const productPath = (product: BuyerProduct) => `/producto/${product.id}/${slugify(product.title)}`;
const statusLabel = (value: string) => ({
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  pending_payment: 'Pago pendiente',
  paid: 'Pagado',
  shipped: 'Enviado',
  completed: 'Completado',
  disputed: 'En revisión',
  under_review: 'En revisión',
  refunded: 'Reembolsado',
}[value] || value);

const BuyerCenter = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const realtimeTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingUnavailable, setRemovingUnavailable] = useState(false);
  const [data, setData] = useState<BuyerCenterData>(EMPTY_BUYER_CENTER);
  const [favoriteQuery, setFavoriteQuery] = useState('');
  const [favoriteFilter, setFavoriteFilter] = useState<FavoriteFilter>('all');
  const [favoriteSort, setFavoriteSort] = useState<FavoriteSort>('opportunity');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const loadData = useCallback(async (manual = false, silent = false) => {
    if (!user) return;
    if (!silent) {
      if (manual) setRefreshing(true);
      else setLoading(true);
    }
    try {
      const next = await loadBuyerCenter(user.id);
      setData(next);
      if (!silent && next.failedSections > 0) {
        toast({ title: 'Centro cargado parcialmente', description: 'Alguna sección no pudo actualizarse. El resto sigue disponible.' });
      } else if (manual) {
        toast({ title: 'Centro actualizado' });
      }
    } catch (error) {
      console.error('Error loading buyer center:', error);
      if (!silent) toast({ title: 'No se pudo cargar el centro del comprador', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [toast, user]);

  useEffect(() => {
    if (user?.id) void loadData();
  }, [loadData, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const scheduleRefresh = () => {
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = window.setTimeout(() => void loadData(false, true), 450);
    };
    const channel = supabaseUntyped
      .channel(`buyer-center-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${user.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `buyer_id=eq.${user.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `buyer_id=eq.${user.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${user.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_searches', filter: `user_id=eq.${user.id}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [loadData, user?.id]);

  const handleFavoriteChange = (product: BuyerProduct, favorite: boolean) => {
    setData((current) => {
      const favorites = favorite
        ? [product, ...current.favorites.filter((item) => item.id !== product.id)]
        : current.favorites.filter((item) => item.id !== product.id);
      const watchChanges = new Map(current.watchChanges);
      if (!favorite) watchChanges.delete(product.id);
      return {
        ...current,
        favorites,
        favoriteIds: favorites.map((item) => item.id),
        watchChanges,
      };
    });
  };

  const removeUnavailableFavorites = async () => {
    if (!user || removingUnavailable) return;
    const ids = data.favorites.filter((product) => product.status !== 'active').map((product) => product.id);
    if (ids.length === 0) return;
    if (!window.confirm(`Se eliminarán ${ids.length} favoritos que ya no están disponibles. ¿Continuar?`)) return;

    setRemovingUnavailable(true);
    try {
      const { error } = await supabaseUntyped.from('favorites').delete().eq('user_id', user.id).in('product_id', ids);
      if (error) throw error;
      setData((current) => {
        const favorites = current.favorites.filter((product) => !ids.includes(product.id));
        const watchChanges = new Map(current.watchChanges);
        ids.forEach((id) => watchChanges.delete(id));
        return { ...current, favorites, favoriteIds: favorites.map((product) => product.id), watchChanges };
      });
      toast({ title: 'Favoritos no disponibles eliminados' });
    } catch (error) {
      toast({ title: 'No se pudieron limpiar los favoritos', description: getErrorMessage(error, 'Inténtalo de nuevo.'), variant: 'destructive' });
    } finally {
      setRemovingUnavailable(false);
    }
  };

  const clearRecentHistory = () => {
    if (data.recent.length > 0 && !window.confirm('¿Quieres borrar el historial de productos vistos recientemente en este dispositivo?')) return;
    clearRecentProducts();
    setData((current) => ({ ...current, recent: [] }));
    toast({ title: 'Historial reciente eliminado' });
  };

  const activeFavorites = useMemo(() => data.favorites.filter((product) => product.status === 'active'), [data.favorites]);
  const unavailableFavorites = useMemo(() => data.favorites.filter((product) => product.status !== 'active'), [data.favorites]);
  const priceDropFavorites = useMemo(() => data.favorites.filter((product) => (data.watchChanges.get(product.id)?.priceDrop || 0) > 0), [data.favorites, data.watchChanges]);
  const openOffers = useMemo(() => data.offers.filter((offer) => ['pending', 'accepted'].includes(offer.status)), [data.offers]);
  const acceptedOffers = openOffers.filter((offer) => offer.status === 'accepted');
  const activeTransactions = useMemo(() => data.transactions.filter((transaction) => ACTIVE_TRANSACTION_STATUSES.includes(transaction.status)), [data.transactions]);
  const finishedTransactions = useMemo(() => data.transactions.filter((transaction) => FINISHED_TRANSACTION_STATUSES.includes(transaction.status)), [data.transactions]);
  const pendingPayments = activeTransactions.filter((transaction) => transaction.status === 'pending_payment' || transaction.payment_status === 'pending');
  const activeSavedAlerts = data.savedSearches.filter((search) => search.alerts_enabled).length;
  const actionCount = acceptedOffers.length + pendingPayments.length;

  const visibleFavorites = useMemo(() => {
    const normalized = favoriteQuery.trim().toLowerCase();
    const filtered = data.favorites.filter((product) => {
      if (normalized && !`${product.title} ${product.location || ''}`.toLowerCase().includes(normalized)) return false;
      if (favoriteFilter === 'available' && product.status !== 'active') return false;
      if (favoriteFilter === 'unavailable' && product.status === 'active') return false;
      if (favoriteFilter === 'price-drops' && (data.watchChanges.get(product.id)?.priceDrop || 0) <= 0) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (favoriteSort === 'price-low') return Number(a.price) - Number(b.price);
      if (favoriteSort === 'price-high') return Number(b.price) - Number(a.price);
      if (favoriteSort === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      const score = (product: BuyerProduct) => (data.watchChanges.get(product.id)?.priceDrop || 0) * 1000 + (product.status === 'active' ? 10 : 0);
      return score(b) - score(a);
    });
  }, [data.favorites, data.watchChanges, favoriteFilter, favoriteQuery, favoriteSort]);

  const ProductGrid = ({ products, emptyText }: { products: BuyerProduct[]; emptyText: string }) => products.length === 0 ? (
    <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{emptyText}</div>
  ) : (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => {
        const change = data.watchChanges.get(product.id);
        const isFavorite = data.favoriteIds.includes(product.id);
        return (
          <div key={product.id} className="relative">
            <Link to={productPath(product)} className="block transition hover:-translate-y-1">
              <ProductCard
                id={product.id}
                title={product.title}
                price={product.price}
                image={product.images?.[0] || '/placeholder.svg'}
                location={product.location || 'Sin ubicación'}
                time={formatDate(product.created_at)}
                isNew={product.condition === 'new'}
                isFavorite={isFavorite}
                isFeatured={Boolean(product.boosted_until && new Date(product.boosted_until).getTime() > Date.now())}
                onFavoriteChange={(favorite) => handleFavoriteChange(product, favorite)}
              />
            </Link>
            {(change?.priceDrop || 0) > 0 && <Badge className="pointer-events-none absolute bottom-3 left-3 z-10 bg-green-600 text-white"><TrendingDown className="mr-1 h-3 w-3" />Bajó {formatPrice(change!.priceDrop)}</Badge>}
            {product.status !== 'active' && <Badge variant="secondary" className="pointer-events-none absolute bottom-3 left-3 z-10">No disponible</Badge>}
          </div>
        );
      })}
    </div>
  );

  const OperationCard = ({ product, title, amount, status, date, children }: {
    product?: BuyerProduct;
    title: string;
    amount?: number;
    status: string;
    date: string;
    children: React.ReactNode;
  }) => (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
      <div className="h-20 w-full overflow-hidden rounded-lg bg-muted sm:w-24">
        {product?.images?.[0] ? <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sin foto</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{product?.title || title}</p><Badge variant="secondary">{statusLabel(status)}</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">{title} · {formatDate(date)}</p>
        {typeof amount === 'number' && <p className="mt-1 font-bold text-primary">{formatPrice(amount)}</p>}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div>
    </div>
  );

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Mi centro de compras | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <Header />
      <main className="container mx-auto space-y-8 px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><Badge variant="secondary" className="mb-3"><ShoppingBag className="mr-1 h-3.5 w-3.5" />Centro del comprador</Badge><h1 className="text-3xl font-bold">Compras y oportunidades</h1><p className="mt-2 text-muted-foreground">Sigue ofertas, pagos, favoritos, bajadas de precio y alertas desde un solo lugar.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing}>{refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Actualizar</Button><Button asChild><Link to="/search"><Search className="mr-2 h-4 w-4" />Buscar productos</Link></Button></div>
        </div>

        {actionCount > 0 && <Card className="border-amber-300 bg-amber-50/60"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" /><div><p className="font-semibold">Tienes {actionCount} {actionCount === 1 ? 'acción pendiente' : 'acciones pendientes'}</p><p className="text-sm text-muted-foreground">Revisa ofertas aceptadas o pagos pendientes desde el Centro de operaciones.</p></div></div><Button asChild size="sm"><Link to="/transactions">Resolver operaciones</Link></Button></CardContent></Card>}

        {priceDropFavorites.length > 0 && <Card className="border-green-300 bg-green-50/60"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><TrendingDown className="mt-0.5 h-5 w-5 text-green-700" /><div><p className="font-semibold">{priceDropFavorites.length} {priceDropFavorites.length === 1 ? 'favorito ha bajado' : 'favoritos han bajado'} de precio</p><p className="text-sm text-muted-foreground">Las bajadas se detectan comparando el precio con tu visita anterior en este dispositivo.</p></div></div><Button size="sm" variant="outline" onClick={() => setFavoriteFilter('price-drops')}>Ver bajadas</Button></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{openOffers.length}</CardTitle><CardDescription className="flex items-center gap-2"><Tag className="h-4 w-4" />Ofertas</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeTransactions.length}</CardTitle><CardDescription className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Compras</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{data.conversations.length}</CardTitle><CardDescription className="flex items-center gap-2"><MessageCircle className="h-4 w-4" />Chats</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeFavorites.length}</CardTitle><CardDescription className="flex items-center gap-2"><Heart className="h-4 w-4" />Favoritos</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{priceDropFavorites.length}</CardTitle><CardDescription className="flex items-center gap-2"><TrendingDown className="h-4 w-4" />Bajadas</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeSavedAlerts}</CardTitle><CardDescription className="flex items-center gap-2"><Bell className="h-4 w-4" />Alertas</CardDescription></CardHeader></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" />Tus ofertas</CardTitle><CardDescription>Ofertas pendientes o aceptadas por el vendedor.</CardDescription></CardHeader><CardContent className="space-y-3">{openOffers.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No tienes ofertas abiertas.</div> : openOffers.slice(0, 6).map((offer) => { const product = offer.product_id ? data.productsById.get(offer.product_id) : undefined; return <OperationCard key={offer.id} product={product} title="Oferta enviada" amount={offer.amount} status={offer.status} date={offer.created_at}><Button size="sm" variant="outline" asChild><Link to={`/messages?conversation=${encodeURIComponent(offer.conversation_id)}`}>Abrir chat</Link></Button>{product && <Button size="sm" asChild><Link to={productPath(product)}>Ver producto</Link></Button>}</OperationCard>; })}</CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-primary" />Compras y envíos</CardTitle><CardDescription>Pagos, entregas y operaciones recientes.</CardDescription></CardHeader><CardContent className="space-y-3">{activeTransactions.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No tienes compras en curso.</div> : activeTransactions.slice(0, 6).map((transaction) => { const product = data.productsById.get(transaction.product_id); return <OperationCard key={transaction.id} product={product} title={transaction.shipping_status ? `Envío: ${transaction.shipping_status}` : 'Compra en curso'} amount={transaction.amount} status={transaction.status} date={transaction.created_at}>{transaction.sendcloud_tracking_url && <Button size="sm" variant="outline" asChild><a href={transaction.sendcloud_tracking_url} target="_blank" rel="noreferrer">Seguimiento</a></Button>}{(transaction.status === 'pending_payment' || transaction.payment_status === 'pending') && <Button size="sm" asChild><Link to="/transactions">Resolver pago</Link></Button>}<Button size="sm" variant="outline" asChild><Link to="/transactions">Detalles</Link></Button></OperationCard>; })}</CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />Conversaciones recientes</CardTitle><CardDescription>Retoma exactamente el chat relacionado con cada producto.</CardDescription></CardHeader><CardContent>{data.conversations.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Todavía no has iniciado conversaciones.</div> : <div className="grid gap-3 md:grid-cols-2">{data.conversations.slice(0, 8).map((conversation) => { const product = data.productsById.get(conversation.product_id); return <div key={conversation.id} className="flex items-center gap-3 rounded-xl border p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">{product?.images?.[0] && <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{product?.title || 'Conversación de producto'}</p><p className="text-xs text-muted-foreground">Actualizada {formatDate(conversation.updated_at)}</p></div><Button size="sm" variant="outline" asChild><Link to={`/messages?conversation=${encodeURIComponent(conversation.id)}`}>Abrir</Link></Button></div>; })}</div>}</CardContent></Card>

        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-destructive" />Seguimiento de favoritos</CardTitle><CardDescription>Filtra oportunidades, bajadas de precio y productos que ya no están disponibles.</CardDescription></div>{unavailableFavorites.length > 0 && <Button variant="outline" size="sm" disabled={removingUnavailable} onClick={() => void removeUnavailableFavorites()}>{removingUnavailable ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Limpiar no disponibles</Button>}</div>
            <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={favoriteQuery} onChange={(event) => setFavoriteQuery(event.target.value)} placeholder="Buscar en favoritos" className="pl-9" /></div><Select value={favoriteFilter} onValueChange={(value) => setFavoriteFilter(value as FavoriteFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="available">Disponibles</SelectItem><SelectItem value="price-drops">Bajadas de precio</SelectItem><SelectItem value="unavailable">No disponibles</SelectItem></SelectContent></Select><Select value={favoriteSort} onValueChange={(value) => setFavoriteSort(value as FavoriteSort)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="opportunity">Mejores oportunidades</SelectItem><SelectItem value="recent">Más recientes</SelectItem><SelectItem value="price-low">Precio más bajo</SelectItem><SelectItem value="price-high">Precio más alto</SelectItem></SelectContent></Select></div>
          </CardHeader>
          <CardContent><ProductGrid products={visibleFavorites} emptyText="No hay favoritos que coincidan con estos filtros." /></CardContent>
        </Card>

        <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Bookmark className="h-5 w-5" />Búsquedas y alertas</CardTitle><CardDescription>{data.savedSearches.length} búsquedas guardadas · {activeSavedAlerts} alertas activas.</CardDescription></div><Button variant="outline" asChild><Link to="/saved-searches">Gestionar todas</Link></Button></div></CardHeader><CardContent>{data.savedSearches.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Guarda una búsqueda para recibir avisos de nuevos productos.</div> : <div className="grid gap-3 md:grid-cols-2">{data.savedSearches.slice(0, 6).map((search) => <div key={search.id} className="flex items-center gap-3 rounded-xl border p-4"><div className="rounded-full bg-primary/10 p-2">{search.alerts_enabled ? <Bell className="h-4 w-4 text-primary" /> : <Search className="h-4 w-4 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{search.name}</p><p className="truncate text-xs text-muted-foreground">{search.query || 'Búsqueda con filtros'} · {formatDate(search.created_at)}</p></div><Badge variant={search.alerts_enabled ? 'default' : 'outline'}>{search.alerts_enabled ? 'Activa' : 'Pausada'}</Badge></div>)}</div>}</CardContent></Card>

        <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Vistos recientemente</CardTitle><CardDescription>Continúa donde lo dejaste en este dispositivo.</CardDescription></div>{data.recent.length > 0 && <Button variant="ghost" size="sm" onClick={clearRecentHistory}><Trash2 className="mr-2 h-4 w-4" />Borrar historial</Button>}</div></CardHeader><CardContent><ProductGrid products={data.recent.slice(0, 8)} emptyText="Los productos que abras desde los resultados aparecerán aquí." /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Recomendados para ti</CardTitle><CardDescription>Productos activos relacionados con favoritos, visitas y búsquedas guardadas.</CardDescription></CardHeader><CardContent><ProductGrid products={data.recommendations.slice(0, 12)} emptyText="No hay recomendaciones disponibles ahora mismo." /></CardContent></Card>

        {finishedTransactions.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" />Historial reciente</CardTitle><CardDescription>Compras finalizadas, canceladas o reembolsadas.</CardDescription></CardHeader><CardContent className="space-y-3">{finishedTransactions.slice(0, 5).map((transaction) => <OperationCard key={transaction.id} product={data.productsById.get(transaction.product_id)} title="Operación finalizada" amount={transaction.amount} status={transaction.status} date={transaction.created_at}><Button size="sm" variant="outline" asChild><Link to="/transactions">Ver historial</Link></Button></OperationCard>)}</CardContent></Card>}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"><span className="flex items-center gap-2"><Bookmark className="h-4 w-4" />Compras, ofertas, favoritos y alertas se sincronizan con tu cuenta. Las bajadas de precio se comparan en este dispositivo.</span><Button variant="ghost" size="sm" asChild><Link to="/notifications">Ver notificaciones</Link></Button></div>
      </main>
      <Footer />
    </div>
  );
};

export default BuyerCenter;
