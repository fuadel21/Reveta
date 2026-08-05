import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Clock3,
  CreditCard,
  Heart,
  Loader2,
  MessageCircle,
  PackageCheck,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const RECENT_KEY = 'reveta_recent_products_v1';
const ACTIVE_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
const FINISHED_TRANSACTION_STATUSES = ['completed', 'cancelled', 'refunded'];

type Product = {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  location: string | null;
  created_at: string;
  status: string | null;
  condition: string | null;
  category_id: string | null;
  boosted_until?: string | null;
};

type Offer = {
  id: string;
  product_id: string | null;
  conversation_id: string;
  amount: number;
  status: string;
  created_at: string;
};

type Transaction = {
  id: string;
  product_id: string;
  amount: number;
  status: string;
  payment_status: string | null;
  shipping_status: string | null;
  sendcloud_tracking_url: string | null;
  created_at: string;
};

type Conversation = {
  id: string;
  product_id: string;
  updated_at: string;
};

type QueryPayload<T> = { data: T[] | null; error: unknown | null };
type SettledQuery<T> = PromiseSettledResult<QueryPayload<T>>;

type BuyerData = {
  favorites: Product[];
  recent: Product[];
  recommendations: Product[];
  offers: Offer[];
  transactions: Transaction[];
  conversations: Conversation[];
  productsById: Map<string, Product>;
};

const EMPTY_DATA: BuyerData = {
  favorites: [],
  recent: [],
  recommendations: [],
  offers: [],
  transactions: [],
  conversations: [],
  productsById: new Map(),
};

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'producto';
const formatDate = (value: string) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const formatPrice = (value: number) => `${Number(value || 0).toLocaleString('es-ES')} €`;
const productPath = (product: Product) => `/producto/${product.id}/${slugify(product.title)}`;
const hasQueryFailed = <T,>(result: SettledQuery<T>) => result.status === 'rejected' || !!result.value.error;
const getQueryData = <T,>(result: SettledQuery<T>): T[] => result.status === 'fulfilled' && !result.value.error ? (result.value.data || []) : [];
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<BuyerData>(EMPTY_DATA);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user?.id) void loadBuyerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const getStoredRecentIds = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, 12) : [];
    } catch {
      return [];
    }
  };

  const loadBuyerData = async (manual = false) => {
    if (!user) return;
    manual ? setRefreshing(true) : setLoading(true);

    try {
      const recentIds = getStoredRecentIds();
      const [favoritesResult, offersResult, transactionsResult, conversationsResult] = await Promise.allSettled([
        (supabase as any).from('favorites').select('product_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('offers').select('id,product_id,conversation_id,amount,status,created_at').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('transactions').select('id,product_id,amount,status,payment_status,shipping_status,sendcloud_tracking_url,created_at').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('conversations').select('id,product_id,updated_at').eq('buyer_id', user.id).order('updated_at', { ascending: false }).limit(20),
      ]) as [SettledQuery<{ product_id: string }>, SettledQuery<Offer>, SettledQuery<Transaction>, SettledQuery<Conversation>];

      const favoriteIds = getQueryData(favoritesResult).map((row) => row.product_id).filter(Boolean);
      const offers = getQueryData(offersResult);
      const transactions = getQueryData(transactionsResult);
      const conversations = getQueryData(conversationsResult);

      const relatedIds = Array.from(new Set([
        ...favoriteIds,
        ...recentIds,
        ...offers.map((offer) => offer.product_id).filter((id): id is string => !!id),
        ...transactions.map((transaction) => transaction.product_id),
        ...conversations.map((conversation) => conversation.product_id),
      ]));

      let relatedProducts: Product[] = [];
      if (relatedIds.length > 0) {
        const { data: productRows, error } = await supabase
          .from('products')
          .select('id,title,price,images,location,created_at,status,condition,category_id,boosted_until')
          .in('id', relatedIds);
        if (error) throw error;
        relatedProducts = (productRows || []) as Product[];
      }

      const productsById = new Map(relatedProducts.map((product) => [product.id, product]));
      const favorites = favoriteIds.map((id) => productsById.get(id)).filter(Boolean) as Product[];
      const recent = recentIds.map((id) => productsById.get(id)).filter(Boolean) as Product[];
      const excludedIds = Array.from(new Set([...favorites, ...recent].map((product) => product.id)));
      const categoryIds = Array.from(new Set([...favorites, ...recent].map((product) => product.category_id).filter(Boolean))) as string[];

      let recommendationQuery = supabase
        .from('products')
        .select('id,title,price,images,location,created_at,status,condition,category_id,boosted_until')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12);

      if (categoryIds.length > 0) recommendationQuery = recommendationQuery.in('category_id', categoryIds);
      if (excludedIds.length > 0) recommendationQuery = recommendationQuery.not('id', 'in', `(${excludedIds.join(',')})`);

      let recommendationResult = await recommendationQuery;
      if (recommendationResult.error && categoryIds.length > 0) {
        recommendationResult = await supabase
          .from('products')
          .select('id,title,price,images,location,created_at,status,condition,category_id,boosted_until')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(12);
      }

      setData({
        favorites,
        recent,
        recommendations: recommendationResult.error ? [] : (recommendationResult.data || []) as Product[],
        offers,
        transactions,
        conversations,
        productsById,
      });

      const failedSections = [favoritesResult, offersResult, transactionsResult, conversationsResult].filter(hasQueryFailed).length + (recommendationResult.error ? 1 : 0);
      if (failedSections > 0) toast({ title: 'Panel cargado parcialmente', description: 'Alguna sección no pudo actualizarse. Puedes volver a intentarlo.' });
      if (manual && failedSections === 0) toast({ title: 'Centro actualizado' });
    } catch (error) {
      console.error('Error loading buyer center:', error);
      toast({ title: 'No se pudo cargar el centro del comprador', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const activeFavorites = useMemo(() => data.favorites.filter((product) => product.status === 'active'), [data.favorites]);
  const unavailableFavorites = data.favorites.length - activeFavorites.length;
  const openOffers = useMemo(() => data.offers.filter((offer) => ['pending', 'accepted'].includes(offer.status)), [data.offers]);
  const acceptedOffers = openOffers.filter((offer) => offer.status === 'accepted');
  const activeTransactions = useMemo(() => data.transactions.filter((transaction) => ACTIVE_TRANSACTION_STATUSES.includes(transaction.status)), [data.transactions]);
  const finishedTransactions = useMemo(() => data.transactions.filter((transaction) => FINISHED_TRANSACTION_STATUSES.includes(transaction.status)), [data.transactions]);
  const pendingPayments = activeTransactions.filter((transaction) => transaction.status === 'pending_payment' || transaction.payment_status === 'pending');
  const actionCount = acceptedOffers.length + pendingPayments.length;

  const ProductGrid = ({ products, emptyText }: { products: Product[]; emptyText: string }) => products.length === 0 ? (
    <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{emptyText}</div>
  ) : (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <Link key={product.id} to={productPath(product)} className="block transition hover:-translate-y-1">
          <ProductCard
            id={product.id}
            title={product.title}
            price={product.price}
            image={product.images?.[0] || '/placeholder.svg'}
            location={product.location || 'Sin ubicación'}
            time={formatDate(product.created_at)}
            isNew={product.condition === 'new'}
            isFavorite={data.favorites.some((favorite) => favorite.id === product.id)}
            isFeatured={!!product.boosted_until && new Date(product.boosted_until).getTime() > Date.now()}
          />
        </Link>
      ))}
    </div>
  );

  const OperationCard = ({
    product,
    title,
    amount,
    status,
    date,
    children,
  }: {
    product?: Product;
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
          <div><Badge variant="secondary" className="mb-3"><ShoppingBag className="mr-1 h-3.5 w-3.5" />Centro del comprador</Badge><h1 className="text-3xl font-bold">Tus compras, ofertas y productos guardados</h1><p className="mt-2 text-muted-foreground">Continúa negociaciones, revisa pagos y retoma productos desde un solo lugar.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadBuyerData(true)} disabled={refreshing}>{refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Actualizar</Button><Button asChild><Link to="/search"><Search className="mr-2 h-4 w-4" />Buscar productos</Link></Button></div>
        </div>

        {actionCount > 0 && <Card className="border-amber-300 bg-amber-50/60"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" /><div><p className="font-semibold">Tienes {actionCount} {actionCount === 1 ? 'acción pendiente' : 'acciones pendientes'}</p><p className="text-sm text-muted-foreground">Revisa ofertas aceptadas o pagos que aún no se han completado.</p></div></div><Button asChild size="sm"><Link to="/transactions">Revisar operaciones</Link></Button></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{openOffers.length}</CardTitle><CardDescription className="flex items-center gap-2"><Tag className="h-4 w-4" />Ofertas abiertas</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeTransactions.length}</CardTitle><CardDescription className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Compras en curso</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{data.conversations.length}</CardTitle><CardDescription className="flex items-center gap-2"><MessageCircle className="h-4 w-4" />Conversaciones</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeFavorites.length}</CardTitle><CardDescription className="flex items-center gap-2"><Heart className="h-4 w-4" />Favoritos disponibles</CardDescription></CardHeader></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" />Tus ofertas</CardTitle><CardDescription>Ofertas pendientes o ya aceptadas por el vendedor.</CardDescription></CardHeader><CardContent className="space-y-3">{openOffers.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No tienes ofertas abiertas.</div> : openOffers.slice(0, 6).map((offer) => { const product = offer.product_id ? data.productsById.get(offer.product_id) : undefined; return <OperationCard key={offer.id} product={product} title="Oferta enviada" amount={offer.amount} status={offer.status} date={offer.created_at}><Button size="sm" variant="outline" asChild><Link to="/messages">Abrir chat</Link></Button>{product && <Button size="sm" asChild><Link to={productPath(product)}>Ver producto</Link></Button>}</OperationCard>; })}</CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-primary" />Compras y envíos</CardTitle><CardDescription>Pagos, entregas y operaciones recientes.</CardDescription></CardHeader><CardContent className="space-y-3">{activeTransactions.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No tienes compras en curso.</div> : activeTransactions.slice(0, 6).map((transaction) => { const product = data.productsById.get(transaction.product_id); return <OperationCard key={transaction.id} product={product} title={transaction.shipping_status ? `Envío: ${transaction.shipping_status}` : 'Compra en curso'} amount={transaction.amount} status={transaction.status} date={transaction.created_at}>{transaction.sendcloud_tracking_url && <Button size="sm" variant="outline" asChild><a href={transaction.sendcloud_tracking_url} target="_blank" rel="noreferrer">Seguimiento</a></Button>}<Button size="sm" variant="outline" asChild><Link to="/transactions">{transaction.status === 'pending_payment' ? 'Revisar pago' : 'Detalles'}</Link></Button></OperationCard>; })}</CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />Conversaciones recientes</CardTitle><CardDescription>Retoma una negociación sin buscar otra vez el anuncio.</CardDescription></CardHeader><CardContent>{data.conversations.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Todavía no has iniciado conversaciones.</div> : <div className="grid gap-3 md:grid-cols-2">{data.conversations.slice(0, 8).map((conversation) => { const product = data.productsById.get(conversation.product_id); return <div key={conversation.id} className="flex items-center gap-3 rounded-xl border p-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">{product?.images?.[0] && <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{product?.title || 'Conversación de producto'}</p><p className="text-xs text-muted-foreground">Actualizada {formatDate(conversation.updated_at)}</p></div><Button size="sm" variant="outline" asChild><Link to="/messages">Abrir</Link></Button></div>; })}</div>}</CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-destructive" />Tus favoritos activos</CardTitle><CardDescription>{unavailableFavorites > 0 ? `${unavailableFavorites} favoritos ya no están disponibles.` : 'Los anuncios que todavía puedes comprar o consultar.'}</CardDescription></CardHeader><CardContent><ProductGrid products={activeFavorites.slice(0, 8)} emptyText="Todavía no tienes favoritos disponibles." /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Vistos recientemente</CardTitle><CardDescription>Continúa donde lo dejaste, sin volver a buscar desde cero.</CardDescription></CardHeader><CardContent><ProductGrid products={data.recent.slice(0, 8)} emptyText="Los productos que abras desde los resultados aparecerán aquí." /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Recomendados para ti</CardTitle><CardDescription>Productos activos relacionados con las categorías que te interesan.</CardDescription></CardHeader><CardContent><ProductGrid products={data.recommendations.slice(0, 8)} emptyText="No hay recomendaciones disponibles ahora mismo." /></CardContent></Card>

        {finishedTransactions.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" />Historial reciente</CardTitle><CardDescription>Compras finalizadas, canceladas o reembolsadas.</CardDescription></CardHeader><CardContent className="space-y-3">{finishedTransactions.slice(0, 5).map((transaction) => <OperationCard key={transaction.id} product={data.productsById.get(transaction.product_id)} title="Operación finalizada" amount={transaction.amount} status={transaction.status} date={transaction.created_at}><Button size="sm" variant="outline" asChild><Link to="/transactions">Ver historial</Link></Button></OperationCard>)}</CardContent></Card>}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"><span className="flex items-center gap-2"><Bookmark className="h-4 w-4" />Tus favoritos, ofertas y compras se sincronizan con tu cuenta.</span><Button variant="ghost" size="sm" asChild><Link to="/saved-searches">Búsquedas guardadas</Link></Button></div>
      </main>
      <Footer />
    </div>
  );
};

export default BuyerCenter;
