import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Package, ArrowUpRight, ArrowDownLeft, MessageCircle, XCircle, CheckCircle2, Truck, ExternalLink, ShieldAlert, Star, HandCoins, CreditCard, Landmark, X } from 'lucide-react';
import { toast } from 'sonner';

type Dispute = Pick<Tables<'disputes'>, 'id' | 'transaction_id' | 'reason' | 'details' | 'status' | 'opened_by' | 'created_at'>;
type BaseTransaction = Pick<Tables<'transactions'>,
  'id' |
  'product_id' |
  'buyer_id' |
  'seller_id' |
  'amount' |
  'status' |
  'created_at' |
  'completed_at' |
  'payment_provider' |
  'payment_status' |
  'paid_at' |
  'shipping_provider' |
  'shipping_status' |
  'shipping_address' |
  'sendcloud_parcel_id' |
  'sendcloud_tracking_number' |
  'sendcloud_tracking_url' |
  'stripe_payment_intent_id'
> & { offer_id?: string | null };

interface ShippingAddressView {
  fullName?: string;
  phone?: string;
  address?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

interface Transaction extends BaseTransaction {
  dispute?: Dispute | null;
  product?: { id: string; title: string; images: string[] | null } | null;
  seller_profile?: { full_name: string | null } | null;
  buyer_profile?: { full_name: string | null } | null;
}

const DISPUTE_REASONS = ['No he recibido el producto', 'Producto diferente al anunciado', 'Producto dañado', 'El vendedor no responde', 'El comprador no confirma recepción', 'Otro motivo'];
const REVIEWABLE_STATUSES = ['completed', 'paid', 'shipped'];
const OPEN_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'completed', 'disputed', 'under_review'];
const TRANSACTION_SELECT = 'id, product_id, buyer_id, seller_id, amount, status, created_at, completed_at, payment_provider, payment_status, paid_at, shipping_provider, shipping_status, shipping_address, sendcloud_parcel_id, sendcloud_tracking_number, sendcloud_tracking_url, stripe_payment_intent_id, offer_id';
const MAX_REVIEW_COMMENT = 500;
const MAX_DISPUTE_DETAILS = 1000;

const getStatusLabel = (status: string) => ({
  pending: 'Reservado / pendiente',
  pending_payment: 'Pendiente de pago',
  paid: 'Pago confirmado',
  shipped: 'Enviado',
  completed: 'Completada',
  cancelled: 'Cancelada',
  disputed: 'Incidencia abierta',
  under_review: 'En revisión',
} as Record<string, string>)[status] || status;

const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'completed' || status === 'paid') return 'default';
  if (status === 'cancelled' || status === 'disputed' || status === 'under_review') return 'destructive';
  if (status === 'shipped') return 'outline';
  return 'secondary';
};

const getDisputeStatusLabel = (status: string) => ({
  open: 'Abierta',
  under_review: 'En revisión',
  resolved_buyer: 'Resuelta a favor del comprador',
  resolved_seller: 'Resuelta a favor del vendedor',
  closed: 'Cerrada',
} as Record<string, string>)[status] || status;

const normalizeText = (value: string, maxLength: number) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, maxLength);

const isShippingAddressView = (value: Json | null): value is ShippingAddressView => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const getShippingAddressText = (shippingAddress: Json | null) => {
  if (!isShippingAddressView(shippingAddress)) return '';
  return `${shippingAddress.address || ''} ${shippingAddress.houseNumber || ''}, ${shippingAddress.postalCode || ''} ${shippingAddress.city || ''}`.trim();
};

const formatAmount = (amount: number | null | undefined) => Number(amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Transactions = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ transaction: Transaction; type: 'purchase' | 'sale' } | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const enrichTransaction = async (transaction: BaseTransaction, type: 'purchase' | 'sale') => {
    const { data: product } = await supabase.from('products').select('id, title, images').eq('id', transaction.product_id).maybeSingle();
    const { data: dispute } = await supabase
      .from('disputes')
      .select('id, transaction_id, reason, details, status, opened_by, created_at')
      .eq('transaction_id', transaction.id)
      .in('status', ['open', 'under_review'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (type === 'purchase') {
      const { data: seller } = await supabase.from('profiles').select('full_name').eq('id', transaction.seller_id).maybeSingle();
      return { ...transaction, product, dispute: dispute || null, seller_profile: seller } as Transaction;
    }

    const { data: buyer } = await supabase.from('profiles').select('full_name').eq('id', transaction.buyer_id).maybeSingle();
    return { ...transaction, product, dispute: dispute || null, buyer_profile: buyer } as Transaction;
  };

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: purchasesData, error: purchasesError }, { data: salesData, error: salesError }] = await Promise.all([
      (supabase as any).from('transactions').select(TRANSACTION_SELECT).eq('buyer_id', user.id).order('created_at', { ascending: false }),
      (supabase as any).from('transactions').select(TRANSACTION_SELECT).eq('seller_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (purchasesError) {
      console.error('Error fetching purchases:', purchasesError);
      toast.error('No se pudieron cargar tus compras');
    }
    if (salesError) {
      console.error('Error fetching sales:', salesError);
      toast.error('No se pudieron cargar tus ventas');
    }

    setPurchases(await Promise.all(((purchasesData || []) as BaseTransaction[]).map((transaction) => enrichTransaction(transaction, 'purchase'))));
    setSales(await Promise.all(((salesData || []) as BaseTransaction[]).map((transaction) => enrichTransaction(transaction, 'sale'))));
    setLoading(false);
  };

  const formatDate = (dateString?: string | null) => new Date(dateString || new Date().toISOString()).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  const getConversationId = async (transaction: Transaction) => {
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('product_id', transaction.product_id)
      .eq('buyer_id', transaction.buyer_id)
      .eq('seller_id', transaction.seller_id)
      .maybeSingle();

    if (existingConversation?.id) return existingConversation.id;

    const { data: createdConversation, error } = await supabase
      .from('conversations')
      .insert({ product_id: transaction.product_id, buyer_id: transaction.buyer_id, seller_id: transaction.seller_id })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating transaction conversation:', error);
      return null;
    }

    return createdConversation?.id || null;
  };

  const sendTransactionMessage = async (transaction: Transaction, content: string) => {
    if (!user) return;
    const conversationId = await getConversationId(transaction);
    if (!conversationId) return;
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, content });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  };

  const reactivateProductIfSafe = async (transaction: Transaction) => {
    const { count, error } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', transaction.product_id)
      .neq('id', transaction.id)
      .in('status', OPEN_TRANSACTION_STATUSES);

    if (error) {
      console.error('Error checking open transactions:', error);
      return;
    }

    if ((count || 0) === 0) {
      await supabase.from('products').update({ status: 'active' }).eq('id', transaction.product_id).in('status', ['reserved']);
    }
  };

  const updateTransactionStatus = async (transaction: Transaction, nextStatus: string) => {
    if (!user) return;

    const isBuyer = user.id === transaction.buyer_id;
    const isSeller = user.id === transaction.seller_id;

    if (nextStatus === 'cancelled' && (!isBuyer || !['pending', 'pending_payment'].includes(transaction.status))) {
      toast.error('Solo el comprador puede cancelar una operación pendiente.');
      return;
    }
    if (nextStatus === 'paid' && (!isSeller || transaction.status !== 'pending')) {
      toast.error('Solo el vendedor puede confirmar el pago de una operación pendiente.');
      return;
    }
    if (nextStatus === 'shipped' && (!isSeller || transaction.status !== 'paid')) {
      toast.error('Solo el vendedor puede marcar como enviado después de confirmar el pago.');
      return;
    }
    if (nextStatus === 'completed' && (!isBuyer || !['paid', 'shipped'].includes(transaction.status))) {
      toast.error('Solo el comprador puede confirmar la recepción.');
      return;
    }

    setUpdatingId(transaction.id);
    const now = new Date().toISOString();
    const updatePayload: any = { status: nextStatus };

    if (nextStatus === 'cancelled') updatePayload.completed_at = now;
    if (nextStatus === 'paid') {
      updatePayload.payment_provider = transaction.payment_provider || 'in_person';
      updatePayload.payment_status = transaction.payment_status || 'paid_in_person';
      updatePayload.paid_at = transaction.paid_at || now;
      updatePayload.completed_at = null;
    }
    if (nextStatus === 'shipped') {
      updatePayload.shipping_status = 'shipped';
      updatePayload.completed_at = null;
    }
    if (nextStatus === 'completed') {
      updatePayload.shipping_status = 'delivered';
      updatePayload.completed_at = now;
    }

    const { error } = await supabase.from('transactions').update(updatePayload).eq('id', transaction.id);
    if (error) {
      console.error('Error updating transaction:', error);
      toast.error('No se pudo actualizar la transacción.');
      setUpdatingId(null);
      return;
    }

    if (nextStatus === 'cancelled') {
      await reactivateProductIfSafe(transaction);
      await sendTransactionMessage(transaction, `Operación cancelada para “${transaction.product?.title || 'este producto'}”.`);
    }
    if (nextStatus === 'paid') {
      await supabase.from('products').update({ status: 'sold' }).eq('id', transaction.product_id).in('status', ['reserved', 'active']);
      await sendTransactionMessage(transaction, `Pago confirmado por el vendedor para “${transaction.product?.title || 'este producto'}”.`);
    }
    if (nextStatus === 'shipped') await sendTransactionMessage(transaction, `El vendedor ha marcado “${transaction.product?.title || 'este producto'}” como enviado.`);
    if (nextStatus === 'completed') await sendTransactionMessage(transaction, `El comprador ha confirmado la recepción de “${transaction.product?.title || 'este producto'}”. Operación completada.`);

    toast.success('Transacción actualizada');
    await fetchTransactions();
    setUpdatingId(null);
  };

  const openReviewPanel = (transaction: Transaction, type: 'purchase' | 'sale') => {
    setReviewTarget({ transaction, type });
    setReviewRating('5');
    setReviewComment('');
  };

  const submitReview = async () => {
    if (!user || !reviewTarget) return;
    const { transaction, type } = reviewTarget;
    const rating = Number(reviewRating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      toast.error('La valoración debe ser un número del 1 al 5.');
      return;
    }

    const reviewedId = type === 'purchase' ? transaction.seller_id : transaction.buyer_id;
    const comment = normalizeText(reviewComment, MAX_REVIEW_COMMENT);
    setUpdatingId(transaction.id);

    const { error } = await supabase.from('reviews').insert({
      reviewer_id: user.id,
      reviewed_id: reviewedId,
      product_id: transaction.product_id,
      transaction_id: transaction.id,
      rating,
      comment,
    });

    if (error) {
      console.error('Error creating review:', error);
      toast.error(error.code === '23505' ? 'Ya has valorado esta operación.' : 'No se pudo guardar la valoración. Ejecuta la migración de reseñas si falta.');
      setUpdatingId(null);
      return;
    }

    toast.success('Valoración publicada');
    setReviewTarget(null);
    setReviewComment('');
    setUpdatingId(null);
  };

  const openDisputePanel = (transaction: Transaction) => {
    if (transaction.dispute || transaction.status === 'disputed') {
      toast.info('Esta transacción ya tiene una incidencia abierta.');
      return;
    }
    setDisputeTarget(transaction);
    setDisputeReason(DISPUTE_REASONS[0]);
    setDisputeDetails('');
  };

  const submitDispute = async () => {
    if (!user || !disputeTarget) return;
    if (!DISPUTE_REASONS.includes(disputeReason)) {
      toast.error('Motivo no válido.');
      return;
    }

    const details = normalizeText(disputeDetails, MAX_DISPUTE_DETAILS);
    if (disputeReason === 'Otro motivo' && details.length < 10) {
      toast.error('Añade una explicación breve para “Otro motivo”.');
      return;
    }

    setUpdatingId(disputeTarget.id);
    const { error: disputeError } = await supabase.from('disputes').insert({
      transaction_id: disputeTarget.id,
      product_id: disputeTarget.product_id,
      buyer_id: disputeTarget.buyer_id,
      seller_id: disputeTarget.seller_id,
      opened_by: user.id,
      reason: disputeReason,
      details: details || null,
      status: 'open',
    });

    if (disputeError) {
      console.error('Error creating dispute:', disputeError);
      toast.error('No se pudo abrir la incidencia.');
      setUpdatingId(null);
      return;
    }

    await supabase.from('transactions').update({ status: 'disputed', completed_at: null }).eq('id', disputeTarget.id);
    await sendTransactionMessage(disputeTarget, `He abierto una incidencia Reveta. Motivo: ${disputeReason}. ${details ? `Detalles: ${details}` : ''}`);

    toast.success('Incidencia abierta');
    setDisputeTarget(null);
    setDisputeDetails('');
    await fetchTransactions();
    setUpdatingId(null);
  };

  const contactOtherUser = async (transaction: Transaction) => {
    await getConversationId(transaction);
    navigate('/messages');
  };

  const totalPurchases = useMemo(() => purchases.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0), [purchases]);
  const totalSales = useMemo(() => sales.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0), [sales]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const TransactionCard = ({ transaction, type }: { transaction: Transaction; type: 'purchase' | 'sale' }) => {
    const isPending = transaction.status === 'pending' || transaction.status === 'pending_payment';
    const canOpenDispute = !transaction.dispute && !['cancelled', 'disputed', 'under_review', 'pending_payment'].includes(transaction.status) && (['paid', 'shipped', 'completed'].includes(transaction.status) || (transaction.status === 'pending' && transaction.payment_provider === 'in_person'));
    const canReview = REVIEWABLE_STATUSES.includes(transaction.status);
    const productImage = transaction.product?.images?.[0] || '/placeholder.svg';
    const hasSendcloudParcel = Boolean(transaction.sendcloud_parcel_id || transaction.sendcloud_tracking_number || transaction.sendcloud_tracking_url);
    const shippingAddressText = getShippingAddressText(transaction.shipping_address);
    const cameFromAcceptedOffer = Boolean(transaction.offer_id);
    const displayAmount = formatAmount(transaction.amount);
    const paymentLabel = transaction.payment_provider === 'stripe' ? 'Stripe' : transaction.payment_provider === 'in_person' ? 'Pago en persona' : transaction.status === 'pending' ? 'Pendiente de pago' : 'Pago no especificado';
    const shippingTitle = hasSendcloudParcel ? 'Envío Sendcloud' : 'Entrega / coordinación';

    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Link to={`/product/${transaction.product_id}`}>
              <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                <img src={productImage} alt={transaction.product?.title || 'Producto'} className="h-full w-full object-cover" />
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/product/${transaction.product_id}`}>
                    <h3 className="font-medium truncate hover:text-primary">{transaction.product?.title || 'Producto eliminado'}</h3>
                  </Link>
                  <p className="text-sm text-muted-foreground truncate">
                    {type === 'purchase' ? `Vendedor: ${transaction.seller_profile?.full_name || 'Usuario'}` : `Comprador: ${transaction.buyer_profile?.full_name || 'Usuario'}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(transaction.completed_at || transaction.created_at)}</p>
                  {cameFromAcceptedOffer && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"><HandCoins className="h-3 w-3" />Oferta aceptada · Precio pactado</div>}
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-lg">{type === 'purchase' ? '-' : '+'}{displayAmount} €</p>
                  <Badge variant={getStatusVariant(transaction.status)}>{getStatusLabel(transaction.status)}</Badge>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <div className="mb-1 flex items-center gap-2 font-medium text-foreground">{transaction.payment_provider === 'stripe' ? <CreditCard className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}<span>Pago</span></div>
                  <p>{paymentLabel}</p>
                  {transaction.payment_status && <p>Estado: {transaction.payment_status}</p>}
                </div>

                {(hasSendcloudParcel || shippingAddressText || transaction.shipping_status) && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2 font-medium text-foreground"><Truck className="h-4 w-4" /><span>{shippingTitle}</span></div>
                    {transaction.sendcloud_parcel_id && <p>ID de envío: {transaction.sendcloud_parcel_id}</p>}
                    {transaction.sendcloud_tracking_number && <p>Seguimiento: {transaction.sendcloud_tracking_number}</p>}
                    {transaction.shipping_status && <p>Estado entrega: {transaction.shipping_status}</p>}
                    {shippingAddressText && <p>Dirección: {shippingAddressText}</p>}
                    {transaction.sendcloud_tracking_url && <a href={transaction.sendcloud_tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary font-medium">Ver seguimiento<ExternalLink className="h-3 w-3" /></a>}
                  </div>
                )}
              </div>

              {cameFromAcceptedOffer && <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground"><p className="font-medium text-foreground">Esta operación viene de una oferta aceptada.</p><p>Precio pactado: <span className="font-semibold text-foreground">{displayAmount} €</span></p></div>}

              {transaction.dispute && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1"><div className="flex items-center gap-2 font-medium text-destructive"><ShieldAlert className="h-4 w-4" /><span>Incidencia Reveta: {getDisputeStatusLabel(transaction.dispute.status)}</span></div><p>Motivo: {transaction.dispute.reason}</p>{transaction.dispute.details && <p>Detalles: {transaction.dispute.details}</p>}</div>}

              <div className="flex flex-wrap gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => contactOtherUser(transaction)}><MessageCircle className="h-4 w-4 mr-2" />Contactar</Button>
                {canReview && <Button size="sm" variant="outline" disabled={updatingId === transaction.id} onClick={() => openReviewPanel(transaction, type)}><Star className="h-4 w-4 mr-2" />Valorar</Button>}
                {canOpenDispute && <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive" disabled={updatingId === transaction.id} onClick={() => openDisputePanel(transaction)}><ShieldAlert className="h-4 w-4 mr-2" />Abrir incidencia</Button>}
                {type === 'purchase' && isPending && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={updatingId === transaction.id} onClick={() => updateTransactionStatus(transaction, 'cancelled')}><XCircle className="h-4 w-4 mr-2" />Cancelar</Button>}
                {type === 'sale' && isPending && <Button size="sm" disabled={updatingId === transaction.id} onClick={() => updateTransactionStatus(transaction, 'paid')}><CheckCircle2 className="h-4 w-4 mr-2" />Confirmar pago recibido</Button>}
                {type === 'sale' && transaction.status === 'paid' && <Button size="sm" variant="outline" disabled={updatingId === transaction.id} onClick={() => updateTransactionStatus(transaction, 'shipped')}><Truck className="h-4 w-4 mr-2" />Marcar como enviado</Button>}
                {type === 'purchase' && ['paid', 'shipped'].includes(transaction.status) && <Button size="sm" disabled={updatingId === transaction.id} onClick={() => updateTransactionStatus(transaction, 'completed')}><CheckCircle2 className="h-4 w-4 mr-2" />Confirmar recibido</Button>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Helmet>
        <title>Mis Transacciones | Reveta</title>
        <meta name="description" content="Historial privado de compras y ventas en Reveta" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <h1 className="text-2xl font-bold mb-6">Mis Transacciones</h1>
          <Tabs defaultValue="purchases">
            <TabsList className="w-full justify-start mb-6">
              <TabsTrigger value="purchases" className="gap-2"><ArrowDownLeft className="h-4 w-4" />Compras ({purchases.length})</TabsTrigger>
              <TabsTrigger value="sales" className="gap-2"><ArrowUpRight className="h-4 w-4" />Ventas ({sales.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="purchases">
              {purchases.length === 0 ? <Card className="border-border/50"><CardContent className="py-12 text-center"><ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">No tienes compras</h3><p className="text-muted-foreground">Aquí aparecerán los productos que compres</p></CardContent></Card> : <div className="space-y-4">{purchases.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} type="purchase" />)}</div>}
            </TabsContent>

            <TabsContent value="sales">
              {sales.length === 0 ? <Card className="border-border/50"><CardContent className="py-12 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">No tienes ventas</h3><p className="text-muted-foreground">Aquí aparecerán los productos que vendas</p></CardContent></Card> : <div className="space-y-4">{sales.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} type="sale" />)}</div>}
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-2 mt-8">
            <Card className="border-border/50"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Compras</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatAmount(totalPurchases)} €</p><p className="text-sm text-muted-foreground">{purchases.length} transacciones</p></CardContent></Card>
            <Card className="border-border/50"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Ventas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{formatAmount(totalSales)} €</p><p className="text-sm text-muted-foreground">{sales.length} transacciones</p></CardContent></Card>
          </div>
        </main>
        <Footer />
      </div>

      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Valorar operación</h2><p className="text-sm text-muted-foreground">Comparte una valoración del 1 al 5.</p></div><Button variant="ghost" size="icon" onClick={() => setReviewTarget(null)} disabled={!!updatingId}><X className="h-4 w-4" /></Button></div>
            <div className="space-y-4">
              <div><label className="mb-2 block text-sm font-medium">Puntuación</label><select value={reviewRating} onChange={(event) => setReviewRating(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="5">5 · Excelente</option><option value="4">4 · Buena</option><option value="3">3 · Correcta</option><option value="2">2 · Mejorable</option><option value="1">1 · Mala</option></select></div>
              <div><label className="mb-2 block text-sm font-medium">Comentario opcional</label><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value.slice(0, MAX_REVIEW_COMMENT))} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Cómo fue la operación..." /><p className="mt-1 text-xs text-muted-foreground">{reviewComment.length}/{MAX_REVIEW_COMMENT}</p></div>
              <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setReviewTarget(null)} disabled={!!updatingId}>Cancelar</Button><Button className="flex-1" onClick={submitReview} disabled={!!updatingId}>{updatingId ? 'Guardando...' : 'Publicar valoración'}</Button></div>
            </div>
          </div>
        </div>
      )}

      {disputeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Abrir incidencia Reveta</h2><p className="text-sm text-muted-foreground">Describe el problema para que el equipo pueda revisarlo.</p></div><Button variant="ghost" size="icon" onClick={() => setDisputeTarget(null)} disabled={!!updatingId}><X className="h-4 w-4" /></Button></div>
            <div className="space-y-4">
              <div><label className="mb-2 block text-sm font-medium">Motivo</label><select value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">{DISPUTE_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></div>
              <div><label className="mb-2 block text-sm font-medium">Detalles</label><textarea value={disputeDetails} onChange={(event) => setDisputeDetails(event.target.value.slice(0, MAX_DISPUTE_DETAILS))} className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Explica brevemente qué ha pasado..." /><p className="mt-1 text-xs text-muted-foreground">{disputeDetails.length}/{MAX_DISPUTE_DETAILS}</p></div>
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-muted-foreground">Al abrir una incidencia, la operación queda marcada como disputada hasta que se revise.</div>
              <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setDisputeTarget(null)} disabled={!!updatingId}>Cancelar</Button><Button className="flex-1" variant="destructive" onClick={submitDispute} disabled={!!updatingId}>{updatingId ? 'Abriendo...' : 'Abrir incidencia'}</Button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Transactions;