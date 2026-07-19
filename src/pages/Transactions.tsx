import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Filter,
  HandCoins,
  Landmark,
  MessageCircle,
  Package,
  Search,
  ShieldAlert,
  ShoppingBag,
  Star,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type OperationType = 'purchase' | 'sale';
type OperationFilter = 'all' | 'action' | 'progress' | 'finished' | 'problem';

type Transaction = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  payment_provider: string | null;
  payment_status: string | null;
  paid_at: string | null;
  shipping_provider: string | null;
  shipping_status: string | null;
  shipping_address: any;
  sendcloud_parcel_id: string | null;
  sendcloud_tracking_number: string | null;
  sendcloud_tracking_url: string | null;
  stripe_payment_intent_id: string | null;
  offer_id?: string | null;
  product?: { id: string; title: string; images: string[] | null } | null;
  seller_profile?: { full_name: string | null } | null;
  buyer_profile?: { full_name: string | null } | null;
  dispute?: { id: string; reason: string; details: string | null; status: string } | null;
};

const TRANSACTION_SELECT = 'id, product_id, buyer_id, seller_id, amount, status, created_at, completed_at, payment_provider, payment_status, paid_at, shipping_provider, shipping_status, shipping_address, sendcloud_parcel_id, sendcloud_tracking_number, sendcloud_tracking_url, stripe_payment_intent_id, offer_id';
const OPEN_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
const FINISHED_STATUSES = ['completed', 'cancelled'];
const PROBLEM_STATUSES = ['disputed', 'under_review'];
const REVIEWABLE_STATUSES = ['completed'];
const DISPUTE_REASONS = ['No he recibido el producto', 'Producto diferente al anunciado', 'Producto dañado', 'El vendedor no responde', 'El comprador no confirma recepción', 'Otro motivo'];

const statusLabel = (status: string) => ({
  pending: 'Reservado / pendiente',
  pending_payment: 'Pendiente de pago',
  paid: 'Pago confirmado',
  shipped: 'Enviado',
  completed: 'Completada',
  cancelled: 'Cancelada',
  disputed: 'Incidencia abierta',
  under_review: 'En revisión',
}[status] || status);

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'completed' || status === 'paid') return 'default';
  if (PROBLEM_STATUSES.includes(status) || status === 'cancelled') return 'destructive';
  if (status === 'shipped') return 'outline';
  return 'secondary';
};

const money = (amount: number | null) => Number(amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (value?: string | null) => new Date(value || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const safeText = (value: string, max: number) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, max);

const getStep = (status: string) => {
  if (status === 'pending' || status === 'pending_payment') return 1;
  if (status === 'paid') return 2;
  if (status === 'shipped') return 3;
  if (status === 'completed') return 4;
  return 0;
};

const nextTask = (transaction: Transaction, type: OperationType) => {
  if (transaction.status === 'pending_payment') return type === 'purchase' ? 'Completa el pago para continuar.' : 'Esperando el pago del comprador.';
  if (transaction.status === 'pending') return type === 'sale' ? 'Confirma el pago cuando lo recibas.' : 'Espera la confirmación del vendedor.';
  if (transaction.status === 'paid') return type === 'sale' ? 'Prepara la entrega o marca el producto como enviado.' : 'El vendedor debe entregar o enviar el producto.';
  if (transaction.status === 'shipped') return type === 'purchase' ? 'Confirma la recepción cuando llegue.' : 'Esperando que el comprador confirme la recepción.';
  if (transaction.status === 'completed') return 'Operación finalizada. Ya puedes valorar.';
  if (transaction.status === 'cancelled') return 'Operación cancelada. No hay acciones pendientes.';
  if (PROBLEM_STATUSES.includes(transaction.status)) return 'Operación bloqueada mientras se revisa la incidencia.';
  return 'Revisa el estado de la operación.';
};

const Transactions = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OperationFilter>('all');
  const [reviewTarget, setReviewTarget] = useState<{ transaction: Transaction; type: OperationType } | null>(null);
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [disputeTarget, setDisputeTarget] = useState<Transaction | null>(null);
  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeDetails, setDisputeDetails] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchTransactions();
  }, [user?.id]);

  const enrich = async (row: any, type: OperationType): Promise<Transaction> => {
    const [{ data: product }, { data: dispute }, { data: profile }] = await Promise.all([
      supabase.from('products').select('id, title, images').eq('id', row.product_id).maybeSingle(),
      supabase.from('disputes').select('id, reason, details, status').eq('transaction_id', row.id).in('status', ['open', 'under_review']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', type === 'purchase' ? row.seller_id : row.buyer_id).maybeSingle(),
    ]);
    return {
      ...row,
      product,
      dispute: dispute || null,
      ...(type === 'purchase' ? { seller_profile: profile } : { buyer_profile: profile }),
    } as Transaction;
  };

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    const [purchaseResult, saleResult] = await Promise.all([
      (supabase as any).from('transactions').select(TRANSACTION_SELECT).eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(100),
      (supabase as any).from('transactions').select(TRANSACTION_SELECT).eq('seller_id', user.id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (purchaseResult.error) toast.error('No se pudieron cargar tus compras');
    if (saleResult.error) toast.error('No se pudieron cargar tus ventas');
    setPurchases(await Promise.all((purchaseResult.data || []).map((row: any) => enrich(row, 'purchase'))));
    setSales(await Promise.all((saleResult.data || []).map((row: any) => enrich(row, 'sale'))));
    setLoading(false);
  };

  const conversationId = async (transaction: Transaction) => {
    const { data: existing } = await supabase.from('conversations').select('id').eq('product_id', transaction.product_id).eq('buyer_id', transaction.buyer_id).eq('seller_id', transaction.seller_id).maybeSingle();
    if (existing?.id) return existing.id;
    const { data, error } = await supabase.from('conversations').insert({ product_id: transaction.product_id, buyer_id: transaction.buyer_id, seller_id: transaction.seller_id }).select('id').single();
    if (error) return null;
    return data?.id || null;
  };

  const sendMessage = async (transaction: Transaction, content: string) => {
    if (!user) return;
    const id = await conversationId(transaction);
    if (!id) return;
    await supabase.from('messages').insert({ conversation_id: id, sender_id: user.id, content });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);
  };

  const updateStatus = async (transaction: Transaction, nextStatus: string) => {
    if (!user) return;
    const isBuyer = user.id === transaction.buyer_id;
    const isSeller = user.id === transaction.seller_id;
    if (PROBLEM_STATUSES.includes(transaction.status)) return toast.error('La operación está bloqueada por una incidencia.');
    if (nextStatus === 'cancelled' && (!isBuyer || !['pending', 'pending_payment'].includes(transaction.status))) return toast.error('Solo el comprador puede cancelar una operación pendiente.');
    if (nextStatus === 'paid' && (!isSeller || transaction.status !== 'pending')) return toast.error('Solo el vendedor puede confirmar un pago pendiente.');
    if (nextStatus === 'shipped' && (!isSeller || transaction.status !== 'paid')) return toast.error('Solo puedes marcar como enviado después de confirmar el pago.');
    if (nextStatus === 'completed' && (!isBuyer || !['paid', 'shipped'].includes(transaction.status))) return toast.error('Solo el comprador puede confirmar la recepción.');

    setUpdatingId(transaction.id);
    const now = new Date().toISOString();
    const payload: any = { status: nextStatus };
    if (nextStatus === 'cancelled' || nextStatus === 'completed') payload.completed_at = now;
    if (nextStatus === 'paid') Object.assign(payload, { payment_provider: transaction.payment_provider || 'in_person', payment_status: transaction.payment_status || 'paid_in_person', paid_at: transaction.paid_at || now, completed_at: null });
    if (nextStatus === 'shipped') Object.assign(payload, { shipping_status: 'shipped', completed_at: null });
    if (nextStatus === 'completed') payload.shipping_status = 'delivered';

    const { error } = await supabase.from('transactions').update(payload).eq('id', transaction.id);
    if (error) {
      toast.error('No se pudo actualizar la operación.');
      setUpdatingId(null);
      return;
    }

    if (nextStatus === 'cancelled') {
      const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('product_id', transaction.product_id).neq('id', transaction.id).in('status', OPEN_STATUSES);
      if ((count || 0) === 0) await supabase.from('products').update({ status: 'active' }).eq('id', transaction.product_id).eq('status', 'reserved');
      await sendMessage(transaction, `Operación cancelada para “${transaction.product?.title || 'este producto'}”.`);
    }
    if (nextStatus === 'paid') {
      await supabase.from('products').update({ status: 'sold' }).eq('id', transaction.product_id).in('status', ['reserved', 'active']);
      await sendMessage(transaction, `Pago confirmado para “${transaction.product?.title || 'este producto'}”.`);
    }
    if (nextStatus === 'shipped') await sendMessage(transaction, `El vendedor ha marcado “${transaction.product?.title || 'este producto'}” como enviado.`);
    if (nextStatus === 'completed') await sendMessage(transaction, `El comprador ha confirmado la recepción de “${transaction.product?.title || 'este producto'}”.`);
    toast.success('Operación actualizada');
    await fetchTransactions();
    setUpdatingId(null);
  };

  const submitReview = async () => {
    if (!user || !reviewTarget) return;
    const rating = Number(reviewRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return toast.error('La valoración debe estar entre 1 y 5.');
    const reviewedId = reviewTarget.type === 'purchase' ? reviewTarget.transaction.seller_id : reviewTarget.transaction.buyer_id;
    setUpdatingId(reviewTarget.transaction.id);
    const { error } = await supabase.from('reviews').insert({ reviewer_id: user.id, reviewed_id: reviewedId, product_id: reviewTarget.transaction.product_id, transaction_id: reviewTarget.transaction.id, rating, comment: safeText(reviewComment, 500) });
    if (error) toast.error(error.code === '23505' ? 'Ya has valorado esta operación.' : 'No se pudo guardar la valoración.');
    else {
      toast.success('Valoración publicada');
      setReviewTarget(null);
    }
    setUpdatingId(null);
  };

  const submitDispute = async () => {
    if (!user || !disputeTarget) return;
    const details = safeText(disputeDetails, 1000);
    if (disputeReason === 'Otro motivo' && details.length < 10) return toast.error('Añade una explicación breve.');
    setUpdatingId(disputeTarget.id);
    const { error } = await supabase.from('disputes').insert({ transaction_id: disputeTarget.id, product_id: disputeTarget.product_id, buyer_id: disputeTarget.buyer_id, seller_id: disputeTarget.seller_id, opened_by: user.id, reason: disputeReason, details: details || null, status: 'open' });
    if (error) toast.error('No se pudo abrir la incidencia.');
    else {
      await supabase.from('transactions').update({ status: 'disputed', completed_at: null }).eq('id', disputeTarget.id);
      await sendMessage(disputeTarget, `Incidencia abierta. Motivo: ${disputeReason}.`);
      toast.success('Incidencia abierta');
      setDisputeTarget(null);
      await fetchTransactions();
    }
    setUpdatingId(null);
  };

  const visible = (items: Transaction[], type: OperationType) => items.filter((item) => {
    const searchText = `${item.product?.title || ''} ${type === 'purchase' ? item.seller_profile?.full_name || '' : item.buyer_profile?.full_name || ''}`.toLowerCase();
    if (query && !searchText.includes(query.toLowerCase())) return false;
    if (filter === 'action') return Boolean(getAvailableAction(item, type));
    if (filter === 'progress') return ['pending', 'pending_payment', 'paid', 'shipped'].includes(item.status);
    if (filter === 'finished') return FINISHED_STATUSES.includes(item.status);
    if (filter === 'problem') return PROBLEM_STATUSES.includes(item.status);
    return true;
  });

  const getAvailableAction = (transaction: Transaction, type: OperationType) => {
    if (PROBLEM_STATUSES.includes(transaction.status)) return null;
    if (type === 'sale' && transaction.status === 'pending') return 'paid';
    if (type === 'sale' && transaction.status === 'paid') return 'shipped';
    if (type === 'purchase' && ['paid', 'shipped'].includes(transaction.status)) return 'completed';
    return null;
  };

  const allOperations = [...purchases, ...sales];
  const stats = useMemo(() => ({
    active: allOperations.filter((item) => ['pending', 'pending_payment', 'paid', 'shipped'].includes(item.status)).length,
    action: allOperations.filter((item) => getAvailableAction(item, user?.id === item.buyer_id ? 'purchase' : 'sale')).length,
    problems: allOperations.filter((item) => PROBLEM_STATUSES.includes(item.status)).length,
    completed: allOperations.filter((item) => item.status === 'completed').length,
  }), [purchases, sales, user?.id]);

  const TransactionCard = ({ transaction, type }: { transaction: Transaction; type: OperationType }) => {
    const step = getStep(transaction.status);
    const availableAction = getAvailableAction(transaction, type);
    const person = type === 'purchase' ? transaction.seller_profile?.full_name || 'Vendedor' : transaction.buyer_profile?.full_name || 'Comprador';
    const image = transaction.product?.images?.[0] || '/placeholder.svg';
    const isBlocked = PROBLEM_STATUSES.includes(transaction.status);
    const canDispute = !transaction.dispute && !['cancelled', 'pending_payment', 'disputed', 'under_review'].includes(transaction.status);
    const actionLabel = availableAction === 'paid' ? 'Confirmar pago recibido' : availableAction === 'shipped' ? 'Marcar como enviado' : 'Confirmar recibido';

    return (
      <Card className={isBlocked ? 'border-destructive/40' : 'border-border/50'}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Link to={`/product/${transaction.product_id}`} className="shrink-0"><img src={image} alt="" className="h-20 w-20 rounded-lg object-cover bg-muted" /></Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/product/${transaction.product_id}`} className="font-semibold hover:text-primary line-clamp-1">{transaction.product?.title || 'Producto eliminado'}</Link>
                  <p className="text-sm text-muted-foreground">{type === 'purchase' ? 'Vendedor' : 'Comprador'}: {person}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Iniciada el {dateText(transaction.created_at)}</p>
                </div>
                <div className="text-right"><p className="text-lg font-bold">{type === 'purchase' ? '-' : '+'}{money(transaction.amount)} €</p><Badge variant={statusVariant(transaction.status)}>{statusLabel(transaction.status)}</Badge></div>
              </div>

              {!isBlocked && !FINISHED_STATUSES.includes(transaction.status) && (
                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-1 text-[11px] text-muted-foreground">
                    {['Pago', 'Preparación', 'Entrega', 'Finalizada'].map((label, index) => <div key={label} className={index + 1 <= step ? 'font-medium text-primary' : ''}>{label}</div>)}
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1">{[1, 2, 3, 4].map((value) => <div key={value} className={`h-2 rounded-full ${value <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div>
                </div>
              )}

              <div className={`mt-4 rounded-lg border p-3 text-sm ${isBlocked ? 'border-destructive/30 bg-destructive/10' : availableAction ? 'border-amber-200 bg-amber-50 text-amber-950' : 'bg-muted/30'}`}>
                <div className="flex items-start gap-2">{isBlocked ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> : availableAction ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />}<div><p className="font-medium">Siguiente paso</p><p>{nextTask(transaction, type)}</p></div></div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border p-3 text-xs text-muted-foreground"><div className="mb-1 flex items-center gap-2 font-medium text-foreground">{transaction.payment_provider === 'stripe' ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}Pago</div><p>{transaction.payment_provider === 'stripe' ? 'Stripe' : transaction.payment_provider === 'in_person' ? 'Pago en persona' : 'Pendiente de definir'}</p>{transaction.payment_status && <p>Estado: {transaction.payment_status}</p>}</div>
                <div className="rounded-lg border p-3 text-xs text-muted-foreground"><div className="mb-1 flex items-center gap-2 font-medium text-foreground"><Truck className="h-4 w-4" />Entrega</div><p>{transaction.shipping_status || (transaction.sendcloud_tracking_number ? 'En seguimiento' : 'Por coordinar')}</p>{transaction.sendcloud_tracking_url && <a href={transaction.sendcloud_tracking_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-primary">Ver seguimiento<ExternalLink className="h-3 w-3" /></a>}</div>
              </div>

              {transaction.offer_id && <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"><HandCoins className="h-3 w-3" />Oferta aceptada</div>}
              {transaction.dispute && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs"><p className="font-medium text-destructive">Incidencia: {transaction.dispute.reason}</p>{transaction.dispute.details && <p className="mt-1">{transaction.dispute.details}</p>}</div>}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await conversationId(transaction); navigate('/messages'); }}><MessageCircle className="mr-2 h-4 w-4" />Contactar</Button>
                {availableAction && <Button size="sm" disabled={updatingId === transaction.id} onClick={() => updateStatus(transaction, availableAction)}><CheckCircle2 className="mr-2 h-4 w-4" />{actionLabel}</Button>}
                {type === 'purchase' && ['pending', 'pending_payment'].includes(transaction.status) && <Button size="sm" variant="ghost" className="text-destructive" disabled={updatingId === transaction.id} onClick={() => updateStatus(transaction, 'cancelled')}><XCircle className="mr-2 h-4 w-4" />Cancelar</Button>}
                {REVIEWABLE_STATUSES.includes(transaction.status) && <Button size="sm" variant="outline" onClick={() => setReviewTarget({ transaction, type })}><Star className="mr-2 h-4 w-4" />Valorar</Button>}
                {canDispute && <Button size="sm" variant="outline" className="border-destructive/40 text-destructive" onClick={() => setDisputeTarget(transaction)}><ShieldAlert className="mr-2 h-4 w-4" />Incidencia</Button>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>;

  return (
    <>
      <Helmet><title>Centro de operaciones | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8">
          <div className="mb-6"><h1 className="text-2xl font-bold">Centro de operaciones</h1><p className="text-muted-foreground">Controla pagos, entregas, incidencias y valoraciones desde un único lugar.</p></div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">En curso</p><p className="text-2xl font-bold">{stats.active}</p></CardContent></Card>
            <Card className={stats.action ? 'border-amber-300' : ''}><CardContent className="p-4"><p className="text-sm text-muted-foreground">Requieren tu acción</p><p className="text-2xl font-bold">{stats.action}</p></CardContent></Card>
            <Card className={stats.problems ? 'border-destructive/40' : ''}><CardContent className="p-4"><p className="text-sm text-muted-foreground">Con incidencia</p><p className="text-2xl font-bold">{stats.problems}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Completadas</p><p className="text-2xl font-bold">{stats.completed}</p></CardContent></Card>
          </div>

          <div className="mb-6 flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por producto o persona" className="pl-9" /></div>
            <div className="flex items-center gap-2 overflow-x-auto"><Filter className="h-4 w-4 text-muted-foreground" />{(['all', 'action', 'progress', 'finished', 'problem'] as OperationFilter[]).map((value) => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{({ all: 'Todas', action: 'Mi acción', progress: 'En curso', finished: 'Finalizadas', problem: 'Incidencias' } as any)[value]}</Button>)}</div>
          </div>

          <Tabs defaultValue="purchases">
            <TabsList className="mb-6 w-full justify-start"><TabsTrigger value="purchases" className="gap-2"><ArrowDownLeft className="h-4 w-4" />Compras ({purchases.length})</TabsTrigger><TabsTrigger value="sales" className="gap-2"><ArrowUpRight className="h-4 w-4" />Ventas ({sales.length})</TabsTrigger></TabsList>
            <TabsContent value="purchases"><OperationList items={visible(purchases, 'purchase')} type="purchase" card={TransactionCard} /></TabsContent>
            <TabsContent value="sales"><OperationList items={visible(sales, 'sale')} type="sale" card={TransactionCard} /></TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>

      {reviewTarget && <Modal title="Valorar operación" onClose={() => setReviewTarget(null)}><select value={reviewRating} onChange={(event) => setReviewRating(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3"><option value="5">5 · Excelente</option><option value="4">4 · Buena</option><option value="3">3 · Correcta</option><option value="2">2 · Mejorable</option><option value="1">1 · Mala</option></select><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value.slice(0, 500))} placeholder="Cómo fue la operación..." className="min-h-28 w-full rounded-md border bg-background p-3" /><Button onClick={submitReview} disabled={!!updatingId}>Publicar valoración</Button></Modal>}
      {disputeTarget && <Modal title="Abrir incidencia Reveta" onClose={() => setDisputeTarget(null)}><select value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3">{DISPUTE_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select><textarea value={disputeDetails} onChange={(event) => setDisputeDetails(event.target.value.slice(0, 1000))} placeholder="Explica qué ha pasado..." className="min-h-32 w-full rounded-md border bg-background p-3" /><Button variant="destructive" onClick={submitDispute} disabled={!!updatingId}>Abrir incidencia</Button></Modal>}
    </>
  );
};

const OperationList = ({ items, type, card: CardComponent }: { items: Transaction[]; type: OperationType; card: any }) => {
  if (items.length === 0) return <Card><CardContent className="py-12 text-center">{type === 'purchase' ? <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-muted-foreground" /> : <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />}<h3 className="font-medium">No hay operaciones con estos filtros</h3><p className="text-sm text-muted-foreground">Prueba con otro estado o término de búsqueda.</p></CardContent></Card>;
  return <div className="space-y-4">{items.map((transaction) => <CardComponent key={transaction.id} transaction={transaction} type={type} />)}</div>;
};

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button></div>{children}</div></div>;

export default Transactions;
