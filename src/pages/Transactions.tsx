import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Package, ArrowUpRight, ArrowDownLeft, MessageCircle, XCircle, CheckCircle2, Truck, ExternalLink, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface Dispute {
  id: string;
  transaction_id: string;
  reason: string;
  details: string | null;
  status: string;
  opened_by: string;
  created_at: string;
}

interface Transaction {
  id: string;
  product_id: string;
  seller_id: string;
  buyer_id: string;
  amount: number;
  status: string;
  completed_at: string;
  created_at?: string;
  shipping_provider?: string | null;
  shipping_status?: string | null;
  sendcloud_parcel_id?: string | null;
  sendcloud_tracking_number?: string | null;
  sendcloud_tracking_url?: string | null;
  shipping_address?: {
    fullName?: string;
    phone?: string;
    address?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  } | null;
  dispute?: Dispute | null;
  product?: {
    id: string;
    title: string;
    images: string[] | null;
  } | null;
  seller_profile?: {
    full_name: string | null;
  } | null;
  buyer_profile?: {
    full_name: string | null;
  } | null;
}

const DISPUTE_REASONS = [
  'No he recibido el producto',
  'Producto diferente al anunciado',
  'Producto dañado',
  'El vendedor no responde',
  'El comprador no confirma recepción',
  'Otro motivo',
];

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
    case 'pending_payment':
      return 'Pendiente de pago';
    case 'paid':
      return 'Pago confirmado';
    case 'shipped':
      return 'Enviado';
    case 'completed':
      return 'Completada';
    case 'cancelled':
      return 'Cancelada';
    case 'disputed':
      return 'Incidencia abierta';
    case 'under_review':
      return 'En revisión';
    default:
      return status;
  }
};

const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'completed' || status === 'paid') return 'default';
  if (status === 'cancelled' || status === 'disputed' || status === 'under_review') return 'destructive';
  if (status === 'shipped') return 'outline';
  return 'secondary';
};

const getDisputeStatusLabel = (status: string) => {
  switch (status) {
    case 'open':
      return 'Abierta';
    case 'under_review':
      return 'En revisión';
    case 'resolved_buyer':
      return 'Resuelta a favor del comprador';
    case 'resolved_seller':
      return 'Resuelta a favor del vendedor';
    case 'closed':
      return 'Cerrada';
    default:
      return status;
  }
};

const Transactions = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const enrichTransaction = async (transaction: any, type: 'purchase' | 'sale') => {
    const { data: product } = await supabase
      .from('products')
      .select('id, title, images')
      .eq('id', transaction.product_id)
      .maybeSingle();

    const { data: dispute } = await (supabase as any)
      .from('disputes')
      .select('id, transaction_id, reason, details, status, opened_by, created_at')
      .eq('transaction_id', transaction.id)
      .in('status', ['open', 'under_review'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (type === 'purchase') {
      const { data: seller } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', transaction.seller_id)
        .maybeSingle();

      return {
        ...transaction,
        product,
        dispute: dispute || null,
        seller_profile: seller,
      } as Transaction;
    }

    const { data: buyer } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', transaction.buyer_id)
      .maybeSingle();

    return {
      ...transaction,
      product,
      dispute: dispute || null,
      buyer_profile: buyer,
    } as Transaction;
  };

  const fetchTransactions = async () => {
    if (!user) return;

    setLoading(true);

    const [{ data: purchasesData, error: purchasesError }, { data: salesData, error: salesError }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('buyer_id', user.id)
        .order('completed_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('*')
        .eq('seller_id', user.id)
        .order('completed_at', { ascending: false }),
    ]);

    if (purchasesError) {
      console.error('Error fetching purchases:', purchasesError);
      toast.error('No se pudieron cargar tus compras');
    }

    if (salesError) {
      console.error('Error fetching sales:', salesError);
      toast.error('No se pudieron cargar tus ventas');
    }

    const enrichedPurchases = await Promise.all((purchasesData || []).map((transaction) => enrichTransaction(transaction, 'purchase')));
    const enrichedSales = await Promise.all((salesData || []).map((transaction) => enrichTransaction(transaction, 'sale')));

    setPurchases(enrichedPurchases);
    setSales(enrichedSales);
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const updateTransactionStatus = async (transaction: Transaction, nextStatus: string) => {
    setUpdatingId(transaction.id);

    const updatePayload: any = {
      status: nextStatus,
      completed_at: new Date().toISOString(),
    };

    if (nextStatus === 'shipped') updatePayload.shipping_status = 'shipped';
    if (nextStatus === 'completed') updatePayload.shipping_status = 'delivered';

    const { error } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', transaction.id);

    if (error) {
      console.error('Error updating transaction:', error);
      toast.error('No se pudo actualizar la transacción. Revisa las políticas RLS de transactions.');
      setUpdatingId(null);
      return;
    }

    if (nextStatus === 'cancelled') {
      await supabase.from('products').update({ status: 'active' }).eq('id', transaction.product_id);
    }

    if (nextStatus === 'paid' || nextStatus === 'completed') {
      await supabase.from('products').update({ status: 'sold' }).eq('id', transaction.product_id);
    }

    toast.success('Transacción actualizada');
    await fetchTransactions();
    setUpdatingId(null);
  };

  const openDispute = async (transaction: Transaction) => {
    if (!user) return;

    if (transaction.dispute || transaction.status === 'disputed') {
      toast.info('Esta transacción ya tiene una incidencia abierta.');
      return;
    }

    const reasonList = DISPUTE_REASONS.map((reason, index) => `${index + 1}. ${reason}`).join('\n');
    const selection = window.prompt(`Selecciona el motivo de la incidencia:\n\n${reasonList}\n\nEscribe un número del 1 al ${DISPUTE_REASONS.length}:`);
    if (!selection) return;

    const selectedIndex = Number(selection.trim()) - 1;
    const reason = DISPUTE_REASONS[selectedIndex];

    if (!reason) {
      toast.error('Motivo no válido.');
      return;
    }

    const details = window.prompt('Describe brevemente qué ha pasado. Este texto ayudará a revisar la incidencia:') || '';

    setUpdatingId(transaction.id);

    const { error: disputeError } = await (supabase as any).from('disputes').insert({
      transaction_id: transaction.id,
      product_id: transaction.product_id,
      buyer_id: transaction.buyer_id,
      seller_id: transaction.seller_id,
      opened_by: user.id,
      reason,
      details,
      status: 'open',
    });

    if (disputeError) {
      console.error('Error creating dispute:', disputeError);
      toast.error('No se pudo abrir la incidencia. Revisa la tabla disputes y sus políticas RLS.');
      setUpdatingId(null);
      return;
    }

    const { error: transactionError } = await supabase
      .from('transactions')
      .update({ status: 'disputed', completed_at: new Date().toISOString() })
      .eq('id', transaction.id);

    if (transactionError) {
      console.error('Error marking transaction disputed:', transactionError);
      toast.warning('Incidencia creada, pero no se pudo actualizar el estado de la transacción.');
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('product_id', transaction.product_id)
      .eq('buyer_id', transaction.buyer_id)
      .eq('seller_id', transaction.seller_id)
      .maybeSingle();

    if (conversation?.id) {
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: `He abierto una incidencia de Protección Reveta. Motivo: ${reason}. ${details ? `Detalles: ${details}` : ''}`,
      });
    }

    toast.success('Incidencia abierta');
    await fetchTransactions();
    setUpdatingId(null);
  };

  const contactOtherUser = async (transaction: Transaction) => {
    if (!user) return;

    const buyerId = transaction.buyer_id;
    const sellerId = transaction.seller_id;

    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('product_id', transaction.product_id)
      .eq('buyer_id', buyerId)
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (!existingConversation) {
      await supabase.from('conversations').insert({
        product_id: transaction.product_id,
        buyer_id: buyerId,
        seller_id: sellerId,
      });
    }

    navigate('/messages');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const TransactionCard = ({ transaction, type }: { transaction: Transaction; type: 'purchase' | 'sale' }) => {
    const isPending = transaction.status === 'pending' || transaction.status === 'pending_payment';
    const canOpenDispute = !['cancelled', 'completed', 'disputed'].includes(transaction.status) && !transaction.dispute;
    const productImage = transaction.product?.images?.[0] || '/placeholder.svg';
    const hasSendcloudParcel = Boolean(transaction.sendcloud_parcel_id || transaction.sendcloud_tracking_number || transaction.sendcloud_tracking_url);
    const shippingAddressText = transaction.shipping_address
      ? `${transaction.shipping_address.address || ''} ${transaction.shipping_address.houseNumber || ''}, ${transaction.shipping_address.postalCode || ''} ${transaction.shipping_address.city || ''}`.trim()
      : '';

    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Link to={`/product/${transaction.product_id}`}>
              <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                <img
                  src={productImage}
                  alt={transaction.product?.title || 'Producto'}
                  className="h-full w-full object-cover"
                />
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/product/${transaction.product_id}`}>
                    <h3 className="font-medium truncate hover:text-primary">
                      {transaction.product?.title || 'Producto eliminado'}
                    </h3>
                  </Link>
                  <p className="text-sm text-muted-foreground truncate">
                    {type === 'purchase'
                      ? `Vendedor: ${transaction.seller_profile?.full_name || 'Usuario'}`
                      : `Comprador: ${transaction.buyer_profile?.full_name || 'Usuario'}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(transaction.completed_at || transaction.created_at || new Date().toISOString())}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-lg">
                    {type === 'purchase' ? '-' : '+'}
                    {transaction.amount.toLocaleString('es-ES')} €
                  </p>
                  <Badge variant={getStatusVariant(transaction.status)}>
                    {getStatusLabel(transaction.status)}
                  </Badge>
                </div>
              </div>

              {transaction.dispute && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-medium text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Protección Reveta: {getDisputeStatusLabel(transaction.dispute.status)}</span>
                  </div>
                  <p>Motivo: {transaction.dispute.reason}</p>
                  {transaction.dispute.details && <p>Detalles: {transaction.dispute.details}</p>}
                </div>
              )}

              {(hasSendcloudParcel || shippingAddressText) && (
                <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Truck className="h-4 w-4" />
                    <span>Envío Sendcloud</span>
                  </div>

                  {transaction.sendcloud_parcel_id && <p>ID de envío: {transaction.sendcloud_parcel_id}</p>}
                  {transaction.sendcloud_tracking_number && <p>Seguimiento: {transaction.sendcloud_tracking_number}</p>}
                  {transaction.shipping_status && <p>Estado envío: {transaction.shipping_status}</p>}
                  {shippingAddressText && <p>Dirección: {shippingAddressText}</p>}

                  {transaction.sendcloud_tracking_url && (
                    <a
                      href={transaction.sendcloud_tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary font-medium"
                    >
                      Ver seguimiento
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => contactOtherUser(transaction)}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contactar
                </Button>

                {canOpenDispute && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:text-destructive"
                    disabled={updatingId === transaction.id}
                    onClick={() => openDispute(transaction)}
                  >
                    <ShieldAlert className="h-4 w-4 mr-2" />
                    Abrir incidencia
                  </Button>
                )}

                {type === 'purchase' && isPending && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={updatingId === transaction.id}
                    onClick={() => updateTransactionStatus(transaction, 'cancelled')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                )}

                {type === 'sale' && isPending && (
                  <Button size="sm" disabled={updatingId === transaction.id} onClick={() => updateTransactionStatus(transaction, 'paid')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar pago recibido
                  </Button>
                )}

                {type === 'sale' && ['paid', 'pending'].includes(transaction.status) && (
                  <Button size="sm" variant="outline" disabled={updatingId === transaction.id} onClick={() => updateTransactionStatus(transaction, 'shipped')}>
                    <Truck className="h-4 w-4 mr-2" />
                    Marcar como enviado
                  </Button>
                )}

                {type === 'purchase' && ['paid', 'shipped'].includes(transaction.status) && (
                  <Button size="sm" disabled={updatingId === transaction.id} onClick={() => updateTransactionStatus(transaction, 'completed')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar recibido
                  </Button>
                )}
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
        <meta name="description" content="Historial de compras y ventas en Reveta" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container py-8">
          <h1 className="text-2xl font-bold mb-6">Mis Transacciones</h1>

          <Tabs defaultValue="purchases">
            <TabsList className="w-full justify-start mb-6">
              <TabsTrigger value="purchases" className="gap-2">
                <ArrowDownLeft className="h-4 w-4" />
                Compras ({purchases.length})
              </TabsTrigger>
              <TabsTrigger value="sales" className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Ventas ({sales.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="purchases">
              {purchases.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center">
                    <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No tienes compras</h3>
                    <p className="text-muted-foreground">Aquí aparecerán los productos que compres</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {purchases.map((transaction) => (
                    <TransactionCard key={transaction.id} transaction={transaction} type="purchase" />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sales">
              {sales.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No tienes ventas</h3>
                    <p className="text-muted-foreground">Aquí aparecerán los productos que vendas</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sales.map((transaction) => (
                    <TransactionCard key={transaction.id} transaction={transaction} type="sale" />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-2 mt-8">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Compras</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {purchases.reduce((sum, transaction) => sum + transaction.amount, 0).toLocaleString('es-ES')} €
                </p>
                <p className="text-sm text-muted-foreground">{purchases.length} transacciones</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {sales.reduce((sum, transaction) => sum + transaction.amount, 0).toLocaleString('es-ES')} €
                </p>
                <p className="text-sm text-muted-foreground">{sales.length} transacciones</p>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Transactions;
