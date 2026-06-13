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
import { ShoppingBag, Package, ArrowUpRight, ArrowDownLeft, MessageCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  product_id: string;
  seller_id: string;
  buyer_id: string;
  amount: number;
  status: string;
  completed_at: string;
  created_at?: string;
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
      return 'Incidencia';
    default:
      return status;
  }
};

const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'completed' || status === 'paid') return 'default';
  if (status === 'cancelled' || status === 'disputed') return 'destructive';
  if (status === 'shipped') return 'outline';
  return 'secondary';
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

    if (type === 'purchase') {
      const { data: seller } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', transaction.seller_id)
        .maybeSingle();

      return {
        ...transaction,
        product,
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

    const { error } = await supabase
      .from('transactions')
      .update({
        status: nextStatus,
        completed_at: new Date().toISOString(),
      })
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
    const productImage = transaction.product?.images?.[0] || '/placeholder.svg';

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

              <div className="flex flex-wrap gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => contactOtherUser(transaction)}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contactar
                </Button>

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
                  <Button
                    size="sm"
                    disabled={updatingId === transaction.id}
                    onClick={() => updateTransactionStatus(transaction, 'paid')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmar pago recibido
                  </Button>
                )}

                {type === 'purchase' && transaction.status === 'paid' && (
                  <Button
                    size="sm"
                    disabled={updatingId === transaction.id}
                    onClick={() => updateTransactionStatus(transaction, 'completed')}
                  >
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
