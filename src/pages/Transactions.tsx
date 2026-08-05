import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, ExternalLink, Filter, HandCoins, Landmark, MessageCircle, Package, RefreshCw, Search, ShieldAlert, Star, Truck, X, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { dateText, FINISHED_STATUSES, getAvailableAction, getStep, loadOperations, money, nextTask, OPEN_STATUSES, type Operation, type OperationFilter, type OperationType, PROBLEM_STATUSES, safeText, statusLabel, statusVariant } from '@/lib/operations';

const PAGE_SIZE = 20;
const DISPUTE_REASONS = ['No he recibido el producto', 'Producto diferente al anunciado', 'Producto dañado', 'El vendedor no responde', 'El comprador no confirma recepción', 'Otro motivo'];

const Transactions = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const refreshTimer = useRef<number | null>(null);
  const [purchases, setPurchases] = useState<Operation[]>([]);
  const [sales, setSales] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OperationFilter>('all');
  const [activeTab, setActiveTab] = useState<OperationType>('purchase');
  const [page, setPage] = useState(1);
  const [reviewTarget, setReviewTarget] = useState<{ operation: Operation; type: OperationType } | null>(null);
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [disputeTarget, setDisputeTarget] = useState<Operation | null>(null);
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeDetails, setDisputeDetails] = useState('');

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [authLoading, navigate, user]);

  const fetchOperations = useCallback(async (manual = false) => {
    if (!user) return;
    manual ? setRefreshing(true) : setLoading(true);
    try {
      const result = await loadOperations(user.id);
      setPurchases(result.purchases);
      setSales(result.sales);
      if (result.partial) toast.warning('El Centro se cargó parcialmente. Puedes actualizarlo de nuevo.');
      else if (manual) toast.success('Operaciones actualizadas');
    } catch (error) {
      console.error('Error loading operations:', error);
      toast.error('No se pudo cargar el Centro de operaciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { void fetchOperations(); }, [fetchOperations]);
  useEffect(() => {
    if (!user) return;
    const schedule = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void fetchOperations(), 450);
    };
    const channels = [
      supabase.channel(`tx-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`tx-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`dispute-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`dispute-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
    ];
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
  }, [fetchOperations, user]);
  useEffect(() => { setPage(1); }, [activeTab, filter, query]);

  const ensureConversation = async (operation: Operation) => {
    if (operation.conversationId) return operation.conversationId;
    const { data: existing } = await supabase.from('conversations').select('id').eq('product_id', operation.product_id).eq('buyer_id', operation.buyer_id).eq('seller_id', operation.seller_id).maybeSingle();
    if (existing?.id) return existing.id;
    const { data, error } = await supabase.from('conversations').insert({ product_id: operation.product_id, buyer_id: operation.buyer_id, seller_id: operation.seller_id }).select('id').single();
    if (error) toast.error('No se pudo abrir la conversación.');
    return data?.id || null;
  };

  const sendMessage = async (operation: Operation, content: string) => {
    if (!user) return;
    const conversationId = await ensureConversation(operation);
    if (!conversationId) return;
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, content });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  };

  const updateStatus = async (operation: Operation, nextStatus: string) => {
    if (!user || updatingId) return;
    const isBuyer = user.id === operation.buyer_id;
    const isSeller = user.id === operation.seller_id;
    if (PROBLEM_STATUSES.includes(operation.status)) return toast.error('La operación está bloqueada por una incidencia.');
    if (nextStatus === 'cancelled' && (!isBuyer || !['pending', 'pending_payment'].includes(operation.status))) return toast.error('Solo el comprador puede cancelar una operación pendiente.');
    if (nextStatus === 'paid' && (!isSeller || operation.status !== 'pending')) return toast.error('Solo el vendedor puede confirmar el pago.');
    if (nextStatus === 'shipped' && (!isSeller || operation.status !== 'paid')) return toast.error('Confirma primero el pago.');
    if (nextStatus === 'completed' && (!isBuyer || !['paid', 'shipped'].includes(operation.status))) return toast.error('Solo el comprador puede confirmar la recepción.');
    setUpdatingId(operation.id);
    try {
      const now = new Date().toISOString();
      const payload: any = { status: nextStatus };
      if (['cancelled', 'completed'].includes(nextStatus)) payload.completed_at = now;
      if (nextStatus === 'paid') Object.assign(payload, { payment_provider: operation.payment_provider || 'in_person', payment_status: operation.payment_status || 'paid_in_person', paid_at: operation.paid_at || now, completed_at: null });
      if (nextStatus === 'shipped') Object.assign(payload, { shipping_status: 'shipped', completed_at: null });
      if (nextStatus === 'completed') payload.shipping_status = 'delivered';
      let request = supabase.from('transactions').update(payload).eq('id', operation.id);
      if (nextStatus === 'cancelled') request = request.eq('buyer_id', user.id).in('status', ['pending', 'pending_payment']);
      if (nextStatus === 'paid') request = request.eq('seller_id', user.id).eq('status', 'pending');
      if (nextStatus === 'shipped') request = request.eq('seller_id', user.id).eq('status', 'paid');
      if (nextStatus === 'completed') request = request.eq('buyer_id', user.id).in('status', ['paid', 'shipped']);
      const { data, error } = await request.select('id').maybeSingle();
      if (error || !data) throw error || new Error('La operación cambió de estado. Actualiza la página.');
      if (nextStatus === 'cancelled') {
        const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('product_id', operation.product_id).neq('id', operation.id).in('status', OPEN_STATUSES);
        if ((count || 0) === 0) await supabase.from('products').update({ status: 'active' }).eq('id', operation.product_id).eq('status', 'reserved');
      }
      if (nextStatus === 'paid') await supabase.from('products').update({ status: 'sold' }).eq('id', operation.product_id).in('status', ['reserved', 'active']);
      const text = nextStatus === 'cancelled' ? 'Operación cancelada.' : nextStatus === 'paid' ? 'Pago confirmado por el vendedor.' : nextStatus === 'shipped' ? 'Producto marcado como enviado.' : 'Recepción confirmada por el comprador.';
      await sendMessage(operation, `${text} Producto: “${operation.product?.title || 'producto'}”.`);
      toast.success('Operación actualizada');
      await fetchOperations();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar la operación.');
    } finally { setUpdatingId(null); }
  };

  const submitReview = async () => {
    if (!user || !reviewTarget || updatingId) return;
    if (reviewTarget.operation.reviewed) return toast.info('Ya has valorado esta operación.');
    const reviewedId = reviewTarget.type === 'purchase' ? reviewTarget.operation.seller_id : reviewTarget.operation.buyer_id;
    setUpdatingId(reviewTarget.operation.id);
    const { error } = await supabase.from('reviews').insert({ reviewer_id: user.id, reviewed_id: reviewedId, product_id: reviewTarget.operation.product_id, transaction_id: reviewTarget.operation.id, rating: Number(reviewRating), comment: safeText(reviewComment, 500) });
    if (error) toast.error(error.code === '23505' ? 'Ya has valorado esta operación.' : 'No se pudo guardar la valoración.');
    else { toast.success('Valoración publicada'); setReviewTarget(null); setReviewComment(''); await fetchOperations(); }
    setUpdatingId(null);
  };

  const submitDispute = async () => {
    if (!user || !disputeTarget || updatingId) return;
    const details = safeText(disputeDetails, 1000);
    if (disputeReason === 'Otro motivo' && details.length < 10) return toast.error('Añade una explicación breve.');
    setUpdatingId(disputeTarget.id);
    try {
      const { error } = await supabase.from('disputes').insert({ transaction_id: disputeTarget.id, product_id: disputeTarget.product_id, buyer_id: disputeTarget.buyer_id, seller_id: disputeTarget.seller_id, opened_by: user.id, reason: disputeReason, details: details || null, status: 'open' });
      if (error) throw error;
      await supabase.from('transactions').update({ status: 'disputed', completed_at: null }).eq('id', disputeTarget.id).or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
      await sendMessage(disputeTarget, `Incidencia abierta. Motivo: ${disputeReason}.`);
      toast.success('Incidencia abierta');
      setDisputeTarget(null); setDisputeDetails(''); await fetchOperations();
    } catch { toast.error('No se pudo abrir la incidencia.'); }
    setUpdatingId(null);
  };

  const visible = useCallback((items: Operation[], type: OperationType) => items.filter((item) => {
    const text = `${item.product?.title || ''} ${item.counterpartyName}`.toLowerCase();
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    if (filter === 'action') return Boolean(getAvailableAction(item, type));
    if (filter === 'progress') return ['pending', 'pending_payment', 'paid', 'shipped'].includes(item.status);
    if (filter === 'finished') return FINISHED_STATUSES.includes(item.status);
    if (filter === 'problem') return PROBLEM_STATUSES.includes(item.status);
    return true;
  }), [filter, query]);

  const purchaseItems = useMemo(() => visible(purchases, 'purchase'), [purchases, visible]);
  const saleItems = useMemo(() => visible(sales, 'sale'), [sales, visible]);
  const activeItems = activeTab === 'purchase' ? purchaseItems : saleItems;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / PAGE_SIZE));
  const pagedItems = activeItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const all = [...purchases, ...sales];
  const stats = useMemo(() => ({
    active: all.filter((item) => ['pending', 'pending_payment', 'paid', 'shipped'].includes(item.status)).length,
    action: all.filter((item) => getAvailableAction(item, user?.id === item.buyer_id ? 'purchase' : 'sale')).length,
    problems: all.filter((item) => PROBLEM_STATUSES.includes(item.status)).length,
    completed: all.filter((item) => item.status === 'completed').length,
    spent: purchases.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    earned: sales.filter((item) => item.status === 'completed').reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }), [all, purchases, sales, user?.id]);

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>;
  if (!user) return null;

  return <><Helmet><title>Centro de operaciones | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet><div className="min-h-screen flex flex-col bg-background"><Header /><main className="container flex-1 py-8">
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold">Centro de operaciones</h1><p className="text-muted-foreground">Controla pagos, entregas, incidencias y valoraciones desde un único lugar.</p></div><Button variant="outline" disabled={refreshing} onClick={() => void fetchOperations(true)}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button></div>
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="En curso" value={stats.active} /><Stat label="Requieren tu acción" value={stats.action} warn /><Stat label="Con incidencia" value={stats.problems} danger /><Stat label="Completadas" value={stats.completed} detail={`Gastado ${money(stats.spent)} € · Ingresado ${money(stats.earned)} €`} /></div>
    <div className="mb-6 flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por producto o persona" className="pl-9" /></div><div className="flex items-center gap-2 overflow-x-auto"><Filter className="h-4 w-4 shrink-0 text-muted-foreground" />{(['all', 'action', 'progress', 'finished', 'problem'] as OperationFilter[]).map((value) => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{({ all: 'Todas', action: 'Mi acción', progress: 'En curso', finished: 'Finalizadas', problem: 'Incidencias' } as Record<OperationFilter, string>)[value]}</Button>)}</div></div>
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OperationType)}><TabsList className="mb-6 w-full justify-start"><TabsTrigger value="purchase" className="gap-2"><ArrowDownLeft className="h-4 w-4" />Compras ({purchases.length})</TabsTrigger><TabsTrigger value="sale" className="gap-2"><ArrowUpRight className="h-4 w-4" />Ventas ({sales.length})</TabsTrigger></TabsList><TabsContent value="purchase"><OperationList items={activeTab === 'purchase' ? pagedItems : []} type="purchase" updatingId={updatingId} onStatus={updateStatus} onReview={(operation) => setReviewTarget({ operation, type: 'purchase' })} onDispute={setDisputeTarget} onMessages={async (operation) => { await ensureConversation(operation); navigate('/messages'); }} /></TabsContent><TabsContent value="sale"><OperationList items={activeTab === 'sale' ? pagedItems : []} type="sale" updatingId={updatingId} onStatus={updateStatus} onReview={(operation) => setReviewTarget({ operation, type: 'sale' })} onDispute={setDisputeTarget} onMessages={async (operation) => { await ensureConversation(operation); navigate('/messages'); }} /></TabsContent></Tabs>
    {activeItems.length > PAGE_SIZE && <div className="mt-6 flex items-center justify-between"><p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button><Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>}
  </main><Footer /></div>
  {reviewTarget && <Modal title="Valorar operación" onClose={() => setReviewTarget(null)}><select value={reviewRating} onChange={(event) => setReviewRating(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} estrellas</option>)}</select><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value.slice(0, 500))} placeholder="Cómo fue la operación..." className="min-h-28 w-full rounded-md border bg-background p-3" /><Button onClick={() => void submitReview()}>Publicar valoración</Button></Modal>}
  {disputeTarget && <Modal title="Abrir incidencia" onClose={() => setDisputeTarget(null)}><select value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3">{DISPUTE_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select><textarea value={disputeDetails} onChange={(event) => setDisputeDetails(event.target.value.slice(0, 1000))} placeholder="Explica lo ocurrido..." className="min-h-32 w-full rounded-md border bg-background p-3" /><Button variant="destructive" onClick={() => void submitDispute()}>Abrir incidencia</Button></Modal>}</>;
};

const Stat = ({ label, value, detail, warn, danger }: { label: string; value: number; detail?: string; warn?: boolean; danger?: boolean }) => <Card className={danger && value ? 'border-destructive/40' : warn && value ? 'border-amber-300' : ''}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>;

const OperationList = ({ items, type, updatingId, onStatus, onReview, onDispute, onMessages }: { items: Operation[]; type: OperationType; updatingId: string | null; onStatus: (operation: Operation, status: string) => Promise<void>; onReview: (operation: Operation) => void; onDispute: (operation: Operation) => void; onMessages: (operation: Operation) => Promise<void> }) => items.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="mx-auto mb-3 h-10 w-10 opacity-40" />No hay operaciones que coincidan.</CardContent></Card> : <div className="space-y-4">{items.map((operation) => <OperationCard key={operation.id} operation={operation} type={type} updating={updatingId === operation.id} onStatus={onStatus} onReview={onReview} onDispute={onDispute} onMessages={onMessages} />)}</div>;

const OperationCard = ({ operation, type, updating, onStatus, onReview, onDispute, onMessages }: { operation: Operation; type: OperationType; updating: boolean; onStatus: (operation: Operation, status: string) => Promise<void>; onReview: (operation: Operation) => void; onDispute: (operation: Operation) => void; onMessages: (operation: Operation) => Promise<void> }) => {
  const action = getAvailableAction(operation, type); const step = getStep(operation.status); const blocked = PROBLEM_STATUSES.includes(operation.status); const image = operation.product?.images?.[0] || '/placeholder.svg'; const canDispute = !operation.dispute && ['pending', 'paid', 'shipped', 'completed'].includes(operation.status);
  return <Card className={blocked ? 'border-destructive/40' : ''}><CardContent className="p-4"><div className="flex flex-col gap-4 sm:flex-row"><Link to={`/product/${operation.product_id}`}><img src={image} alt="" loading="lazy" className="h-24 w-full rounded-lg object-cover sm:h-20 sm:w-20" /></Link><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-3"><div><Link to={`/product/${operation.product_id}`} className="font-semibold hover:text-primary">{operation.product?.title || 'Producto eliminado'}</Link><p className="text-sm text-muted-foreground">{type === 'purchase' ? 'Vendedor' : 'Comprador'}: {operation.counterpartyName}</p><p className="text-xs text-muted-foreground">{dateText(operation.created_at)}</p></div><div className="text-right"><p className="text-lg font-bold">{type === 'purchase' ? '-' : '+'}{money(operation.amount)} €</p><Badge variant={statusVariant(operation.status)}>{statusLabel(operation.status)}</Badge></div></div>
  {!blocked && !FINISHED_STATUSES.includes(operation.status) && <div className="mt-4 grid grid-cols-4 gap-1">{[1,2,3,4].map((value) => <div key={value} className={`h-2 rounded-full ${value <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div>}
  <div className={`mt-4 rounded-lg border p-3 text-sm ${blocked ? 'bg-destructive/10' : action ? 'bg-amber-50 text-amber-950' : 'bg-muted/30'}`}><div className="flex gap-2">{blocked ? <ShieldAlert className="h-4 w-4" /> : action ? <AlertTriangle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}<div><p className="font-medium">Siguiente paso</p><p>{nextTask(operation, type)}</p></div></div></div>
  <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg border p-3 text-xs"><p className="flex items-center gap-2 font-medium">{operation.payment_provider === 'stripe' ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}Pago</p><p className="text-muted-foreground">{operation.payment_provider || 'Pendiente'} · {operation.payment_status || 'sin estado'}</p></div><div className="rounded-lg border p-3 text-xs"><p className="flex items-center gap-2 font-medium"><Truck className="h-4 w-4" />Entrega</p><p className="text-muted-foreground">{operation.shipping_status || 'Por coordinar'}</p>{operation.sendcloud_tracking_url && <a href={operation.sendcloud_tracking_url} target="_blank" rel="noreferrer" className="text-primary">Seguimiento <ExternalLink className="inline h-3 w-3" /></a>}</div></div>
  {operation.offer_id && <Badge className="mt-3" variant="secondary"><HandCoins className="mr-1 h-3 w-3" />Oferta aceptada</Badge>}{operation.reviewed && <Badge className="mt-3 ml-2" variant="outline"><Star className="mr-1 h-3 w-3" />Valorada</Badge>}{operation.dispute && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs"><b>Incidencia: {operation.dispute.reason}</b>{operation.dispute.details && <p>{operation.dispute.details}</p>}</div>}
  <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void onMessages(operation)}><MessageCircle className="mr-2 h-4 w-4" />Contactar</Button>{action && <Button size="sm" disabled={updating} onClick={() => void onStatus(operation, action)}><CheckCircle2 className="mr-2 h-4 w-4" />{action === 'paid' ? 'Confirmar pago' : action === 'shipped' ? 'Marcar enviado' : 'Confirmar recibido'}</Button>}{type === 'purchase' && ['pending','pending_payment'].includes(operation.status) && <Button size="sm" variant="ghost" className="text-destructive" disabled={updating} onClick={() => void onStatus(operation, 'cancelled')}><XCircle className="mr-2 h-4 w-4" />Cancelar</Button>}{operation.status === 'completed' && !operation.reviewed && <Button size="sm" variant="outline" onClick={() => onReview(operation)}><Star className="mr-2 h-4 w-4" />Valorar</Button>}{canDispute && <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDispute(operation)}><ShieldAlert className="mr-2 h-4 w-4" />Incidencia</Button>}</div></div></div></CardContent></Card>;
};

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-xl border bg-background p-5"><div className="mb-4 flex justify-between"><h2 className="font-semibold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button></div><div className="space-y-4">{children}</div></div></div>;

export default Transactions;
