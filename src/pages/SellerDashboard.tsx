import { getErrorMessage } from '@/lib/errors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  BarChart3,
  Copy,
  Eye,
  Heart,
  ImageOff,
  MessageCircle,
  Package,
  Pencil,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductStatusBadge from '@/components/ProductStatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  loadSellerInventory,
  OPEN_TRANSACTION_STATUSES,
  productAgeDays,
  productAttentionScore,
  productBlocked,
  productInterest,
  productIsStale,
  productNeedsAttention,
  sellerRecommendation,
  type SellerInventoryProduct,
} from '@/lib/sellerInventory';

type StatusFilter = 'all' | 'active' | 'inactive' | 'reserved' | 'sold' | 'attention' | 'stale';
type SortMode = 'attention' | 'interest' | 'newest' | 'oldest';
type InventoryStatus = 'active' | 'inactive';

const getImage = (product: SellerInventoryProduct) => product.images?.[0] || null;
const isBoostActive = (value?: string | null) => Boolean(value && new Date(value).getTime() > Date.now());
const money = (value: number) => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const imageExtension = (mime: string) => mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';

const SellerDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const refreshTimer = useRef<number | null>(null);
  const [products, setProducts] = useState<SellerInventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [partial, setPartial] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('attention');

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [authLoading, navigate, user]);

  const fetchDashboard = useCallback(async (manual = false) => {
    if (!user) return;
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await loadSellerInventory(user.id);
      setProducts(result.products);
      setPartial(result.partial);
      setSelectedIds((current) => new Set([...current].filter((id) => result.products.some((product) => product.id === id))));
      if (manual) toast({ title: 'Inventario actualizado' });
    } catch (error) {
      console.error('Error loading seller inventory:', error);
      toast({ title: 'No se pudo cargar el inventario', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, user]);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    if (!user) return;
    const schedule = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void fetchDashboard(), 500);
    };
    const channels = [
      supabase.channel(`seller-products-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `user_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`seller-conversations-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`seller-offers-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`seller-transactions-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
    ];
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
  }, [fetchDashboard, user]);

  const getServerBlockedIds = async (ids: string[]) => {
    if (ids.length === 0) return new Set<string>();
    const [reservations, transactions] = await Promise.all([
      supabaseUntyped.from('product_reservations').select('product_id').in('product_id', ids).eq('status', 'active'),
      supabase.from('transactions').select('product_id').in('product_id', ids).in('status', OPEN_TRANSACTION_STATUSES),
    ]);
    if (reservations.error || transactions.error) throw reservations.error || transactions.error;
    return new Set([...(reservations.data || []), ...(transactions.data || [])].map((row) => row.product_id));
  };

  const updateProductStatuses = async (ids: string[], nextStatus: InventoryStatus) => {
    if (!user || ids.length === 0) return;
    const expectedStatus = nextStatus === 'active' ? 'inactive' : 'active';
    const candidates = products.filter((product) => ids.includes(product.id) && product.status === expectedStatus);
    if (candidates.length === 0) {
      toast({ title: nextStatus === 'active' ? 'No hay anuncios archivados seleccionados' : 'No hay anuncios activos seleccionados' });
      return;
    }

    const blockedIds = await getServerBlockedIds(candidates.map((product) => product.id));
    const safeIds = candidates.map((product) => product.id).filter((id) => !blockedIds.has(id));
    if (safeIds.length === 0) {
      toast({ title: 'Acción bloqueada', description: 'Los anuncios seleccionados tienen reservas u operaciones abiertas.', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabaseUntyped
      .from('products')
      .update({ status: nextStatus })
      .eq('user_id', user.id)
      .eq('status', expectedStatus)
      .in('id', safeIds)
      .select('id');
    if (error) throw error;
    const changed = new Set((data || []).map((row) => row.id));
    setProducts((current) => current.map((product) => changed.has(product.id) ? { ...product, status: nextStatus } : product));
    setSelectedIds((current) => new Set([...current].filter((id) => !changed.has(id))));

    const skipped = candidates.length - changed.size;
    toast({
      title: nextStatus === 'active' ? `${changed.size} anuncio${changed.size === 1 ? '' : 's'} reactivado${changed.size === 1 ? '' : 's'}` : `${changed.size} anuncio${changed.size === 1 ? '' : 's'} archivado${changed.size === 1 ? '' : 's'}`,
      description: skipped > 0 ? `${skipped} no se modificaron porque cambiaron de estado o tienen actividad abierta.` : undefined,
    });
  };

  const changeProductStatus = async (product: SellerInventoryProduct, nextStatus: InventoryStatus) => {
    if (updatingId || bulkUpdating) return;
    setUpdatingId(product.id);
    try {
      await updateProductStatuses([product.id], nextStatus);
    } catch (error) {
      console.error('Error updating listing status:', error);
      toast({ title: 'No se pudo actualizar el anuncio', description: 'Actualiza el panel e inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const runBulkStatus = async (nextStatus: InventoryStatus) => {
    if (bulkUpdating || selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      await updateProductStatuses([...selectedIds], nextStatus);
    } catch (error) {
      console.error('Error applying bulk seller action:', error);
      toast({ title: 'No se pudo completar la acción múltiple', description: 'Actualiza el panel e inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setBulkUpdating(false);
    }
  };

  const duplicateProduct = async (product: SellerInventoryProduct) => {
    if (!user || updatingId || bulkUpdating) return;
    if (!product.images?.length) {
      toast({ title: 'No se puede duplicar todavía', description: 'Añade al menos una foto al anuncio original.', variant: 'destructive' });
      return;
    }

    setUpdatingId(product.id);
    const uploadedPaths: string[] = [];
    try {
      const duplicatedUrls: string[] = [];
      for (const imageUrl of product.images.slice(0, 5)) {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('No se pudo copiar una de las fotografías');
        const blob = await response.blob();
        const mime = blob.type || 'image/jpeg';
        const path = `${user.id}/${crypto.randomUUID()}.${imageExtension(mime)}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(path, blob, { contentType: mime, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
        duplicatedUrls.push(publicUrl);
      }

      const title = `${product.title.replace(/\s*\(copia\)$/i, '')} (copia)`.slice(0, 100);
      const { data, error } = await supabaseUntyped.from('products').insert({
        user_id: user.id,
        title,
        description: product.description,
        price: product.price,
        location: product.location,
        images: duplicatedUrls,
        status: 'inactive',
        category_id: product.category_id,
        subcategory_id: product.subcategory_id,
        condition: product.condition,
        latitude: product.latitude,
        longitude: product.longitude,
      }).select('id').single();
      if (error || !data?.id) throw error || new Error('No se pudo crear la copia');

      toast({ title: 'Copia creada', description: 'Está archivada para que puedas revisarla antes de publicarla.' });
      navigate(`/edit-product/${data.id}`);
    } catch (error) {
      if (uploadedPaths.length > 0) await supabase.storage.from('products').remove(uploadedPaths);
      console.error('Error duplicating listing:', error);
      toast({ title: 'No se pudo duplicar el anuncio', description: getErrorMessage(error, 'Inténtalo de nuevo.'), variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const summary = useMemo(() => ({
    active: products.filter((product) => product.status === 'active').length,
    archived: products.filter((product) => product.status === 'inactive').length,
    reserved: products.filter((product) => product.status === 'reserved').length,
    sold: products.filter((product) => product.status === 'sold').length,
    favorites: products.reduce((sum, product) => sum + product.metrics.favorites, 0),
    conversations: products.reduce((sum, product) => sum + product.metrics.conversations, 0),
    offers: products.reduce((sum, product) => sum + product.metrics.offers, 0),
    attention: products.filter(productNeedsAttention).length,
    stale: products.filter(productIsStale).length,
  }), [products]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesQuery = !normalized || product.title.toLowerCase().includes(normalized) || (product.location || '').toLowerCase().includes(normalized);
      if (!matchesQuery) return false;
      if (statusFilter === 'attention') return productNeedsAttention(product);
      if (statusFilter === 'stale') return productIsStale(product);
      return statusFilter === 'all' || product.status === statusFilter;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'interest') return productInterest(b) - productInterest(a);
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return productAttentionScore(b) - productAttentionScore(a);
    });
  }, [products, query, sortBy, statusFilter]);

  const selectableVisibleIds = visibleProducts.filter((product) => ['active', 'inactive'].includes(product.status || '')).map((product) => product.id);
  const allVisibleSelected = selectableVisibleIds.length > 0 && selectableVisibleIds.every((id) => selectedIds.has(id));
  const toggleProduct = (id: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleVisible = () => setSelectedIds((current) => {
    const next = new Set(current);
    if (allVisibleSelected) selectableVisibleIds.forEach((id) => next.delete(id));
    else selectableVisibleIds.forEach((id) => next.add(id));
    return next;
  });

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><RefreshCw className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <Helmet><title>Inventario del vendedor | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container flex-1 space-y-6 py-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><Badge variant="secondary" className="mb-2"><BarChart3 className="mr-1 h-3.5 w-3.5" />Centro de inventario</Badge><h1 className="text-2xl font-bold">Gestiona todos tus anuncios</h1><p className="text-sm text-muted-foreground">Publica, revisa, archiva, duplica y atiende compradores desde un solo lugar.</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={refreshing} onClick={() => void fetchDashboard(true)}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button><Button asChild><Link to="/upload">Publicar anuncio</Link></Button></div>
          </div>

          {partial && <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Parte de las métricas no se pudo cargar. Las acciones siguen protegidas con una comprobación directa antes de guardar.</span></div>}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Summary label="Activos" value={summary.active} detail={`${summary.reserved} reservados · ${summary.sold} vendidos`} />
            <Summary label="Archivados" value={summary.archived} detail="Puedes reactivarlos en cualquier momento" />
            <Summary label="Interés" value={summary.favorites + summary.conversations} detail={`${summary.favorites} favoritos · ${summary.conversations} chats`} />
            <Summary label="Ofertas abiertas" value={summary.offers} detail="Respóndelas desde Mensajes" />
            <Summary label="Necesitan atención" value={summary.attention} detail={`${summary.stale} antiguos sin interés`} warn={summary.attention > 0} />
          </div>

          <Card><CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_190px_180px_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por producto o ubicación" className="pl-9" /></div><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="attention">Necesitan atención</SelectItem><SelectItem value="stale">Antiguos sin interés</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Archivados</SelectItem><SelectItem value="reserved">Reservados</SelectItem><SelectItem value="sold">Vendidos</SelectItem></SelectContent></Select><Select value={sortBy} onValueChange={(value) => setSortBy(value as SortMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="attention">Prioridad</SelectItem><SelectItem value="interest">Más interés</SelectItem><SelectItem value="newest">Más recientes</SelectItem><SelectItem value="oldest">Más antiguos</SelectItem></SelectContent></Select><Button type="button" variant="outline" disabled={selectableVisibleIds.length === 0} onClick={toggleVisible}>{allVisibleSelected ? 'Deseleccionar' : 'Seleccionar visibles'}</Button></CardContent></Card>

          {selectedIds.size > 0 && <Card className="border-primary/30 bg-primary/5"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{selectedIds.size} anuncio{selectedIds.size === 1 ? '' : 's'} seleccionado{selectedIds.size === 1 ? '' : 's'}</p><p className="text-xs text-muted-foreground">Las reservas y operaciones se vuelven a comprobar antes de aplicar cambios.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={bulkUpdating} onClick={() => void runBulkStatus('inactive')}><Archive className="mr-2 h-4 w-4" />Archivar activos</Button><Button size="sm" disabled={bulkUpdating} onClick={() => void runBulkStatus('active')}><ArchiveRestore className="mr-2 h-4 w-4" />Reactivar archivados</Button><Button size="sm" variant="ghost" disabled={bulkUpdating} onClick={() => setSelectedIds(new Set())}>Limpiar selección</Button></div></CardContent></Card>}

          {visibleProducts.length === 0 ? <Card><CardContent className="p-10 text-center text-muted-foreground"><Package className="mx-auto mb-3 h-10 w-10 opacity-30" /><p className="font-medium">No hay anuncios que coincidan con estos filtros.</p>{products.length === 0 && <Button asChild className="mt-4"><Link to="/upload">Publicar el primero</Link></Button>}</CardContent></Card> : <div className="space-y-4">{visibleProducts.map((product) => {
            const image = getImage(product);
            const blocked = productBlocked(product);
            const boostActive = isBoostActive(product.boosted_until);
            const canBoost = product.status === 'active' && !boostActive;
            const canEdit = !blocked && !['sold', 'completed'].includes(product.status || '');
            const selectable = ['active', 'inactive'].includes(product.status || '');
            const selected = selectedIds.has(product.id);

            return <Card key={product.id} className={`overflow-hidden ${selected ? 'border-primary ring-1 ring-primary/20' : ''}`}><CardContent className="p-0"><div className="grid md:grid-cols-[200px_1fr]"><div className="relative aspect-video bg-muted md:aspect-auto md:min-h-52">{image ? <img src={image} alt={product.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageOff className="h-8 w-8 text-muted-foreground" /></div>}{selectable && <label className="absolute left-3 top-3 flex cursor-pointer items-center gap-2 rounded-lg bg-background/95 px-2.5 py-1.5 text-xs font-medium shadow"><input type="checkbox" checked={selected} onChange={() => toggleProduct(product.id)} className="h-4 w-4" />Seleccionar</label>}</div><div className="space-y-4 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{product.title}</h2><ProductStatusBadge status={product.status || 'active'} />{boostActive && <Badge variant="secondary"><Sparkles className="mr-1 h-3 w-3" />Destacado activo</Badge>}{productIsStale(product) && <Badge variant="outline">{productAgeDays(product)} días sin interés</Badge>}</div><p className="mt-1 text-lg font-bold text-primary">{money(product.price)} €</p><p className="text-xs text-muted-foreground">{product.location || 'Sin ubicación'} · Publicado {new Date(product.created_at).toLocaleDateString('es-ES')}</p></div>{blocked && <Badge className="bg-amber-600 text-white"><AlertTriangle className="mr-1 h-3 w-3" />Actividad abierta</Badge>}</div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><Metric icon={<Heart className="h-4 w-4" />} value={product.metrics.favorites} label="Favoritos" /><Metric icon={<MessageCircle className="h-4 w-4" />} value={product.metrics.conversations} label="Chats" /><Metric icon={<Tag className="h-4 w-4" />} value={product.metrics.offers} label="Ofertas" /><Metric icon={<ShoppingBag className="h-4 w-4" />} value={product.metrics.reservations} label="Reservas" /><Metric icon={<BarChart3 className="h-4 w-4" />} value={productInterest(product)} label="Interés" /></div>

            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="font-medium">Siguiente recomendación</p><p className="text-muted-foreground">{sellerRecommendation(product)}</p></div></div>

            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link to={`/product/${product.id}`}><Eye className="mr-1 h-4 w-4" />Ver</Link></Button>{canEdit ? <Button size="sm" variant="outline" asChild><Link to={`/edit-product/${product.id}`}><Pencil className="mr-1 h-4 w-4" />Editar</Link></Button> : <Button size="sm" variant="outline" disabled title={blocked ? 'Resuelve la reserva u operación abierta antes de editar' : 'Los productos vendidos no se pueden editar'}><Pencil className="mr-1 h-4 w-4" />Edición bloqueada</Button>}<Button size="sm" variant="outline" disabled={updatingId === product.id} onClick={() => void duplicateProduct(product)}><Copy className="mr-1 h-4 w-4" />Duplicar y revisar</Button>{canBoost ? <Button size="sm" variant="outline" asChild><Link to={`/boost/${product.id}`}><BarChart3 className="mr-1 h-4 w-4" />Destacar</Link></Button> : <Button size="sm" variant="outline" disabled title={boostActive ? 'Este anuncio ya tiene un destacado activo' : 'Solo se pueden destacar anuncios activos'}><BarChart3 className="mr-1 h-4 w-4" />{boostActive ? 'Ya destacado' : 'Solo activos'}</Button>}{product.latestConversationId ? <Button size="sm" variant="outline" asChild><Link to={`/messages?conversation=${product.latestConversationId}`}><MessageCircle className="mr-1 h-4 w-4" />Abrir último chat</Link></Button> : <Button size="sm" variant="outline" asChild><Link to="/messages"><MessageCircle className="mr-1 h-4 w-4" />Mensajes</Link></Button>}{blocked && <Button size="sm" asChild><Link to="/transactions"><ShoppingBag className="mr-1 h-4 w-4" />Gestionar operación</Link></Button>}{product.status === 'inactive' ? <Button size="sm" disabled={updatingId === product.id || blocked} onClick={() => void changeProductStatus(product, 'active')}><ArchiveRestore className="mr-1 h-4 w-4" />Reactivar</Button> : product.status === 'active' ? <Button size="sm" variant="destructive" disabled={updatingId === product.id || blocked} onClick={() => void changeProductStatus(product, 'inactive')}><Archive className="mr-1 h-4 w-4" />Archivar</Button> : null}</div>
          </div></div></CardContent></Card>;
          })}</div>}
        </main>
        <Footer />
      </div>
    </>
  );
};

const Summary = ({ label, value, detail, warn = false }: { label: string; value: number; detail: string; warn?: boolean }) => <Card className={warn ? 'border-amber-300 bg-amber-50/50' : ''}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
const Metric = ({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) => <div className="rounded-lg border p-2 text-center"><div className="mx-auto flex justify-center">{icon}</div><p className="font-bold">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;

export default SellerDashboard;
