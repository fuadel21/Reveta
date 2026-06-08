import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Package, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface Transaction {
  id: string;
  product_id: string;
  seller_id: string;
  buyer_id: string;
  amount: number;
  status: string;
  completed_at: string;
  product?: {
    id: string;
    title: string;
    images: string[];
  };
  seller_profile?: {
    full_name: string | null;
  };
  buyer_profile?: {
    full_name: string | null;
  };
}

const Transactions = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Transaction[]>([]);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    // Fetch purchases (where user is buyer)
    const { data: purchasesData } = await supabase
      .from('transactions')
      .select('*')
      .eq('buyer_id', user.id)
      .order('completed_at', { ascending: false });

    // Fetch sales (where user is seller)
    const { data: salesData } = await supabase
      .from('transactions')
      .select('*')
      .eq('seller_id', user.id)
      .order('completed_at', { ascending: false });

    // Fetch product and profile details for purchases
    if (purchasesData) {
      const enrichedPurchases = await Promise.all(
        purchasesData.map(async (t) => {
          const { data: product } = await supabase
            .from('products')
            .select('id, title, images')
            .eq('id', t.product_id)
            .maybeSingle();
          
          const { data: seller } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', t.seller_id)
            .maybeSingle();

          return {
            ...t,
            product,
            seller_profile: seller
          };
        })
      );
      setPurchases(enrichedPurchases);
    }

    // Fetch product and profile details for sales
    if (salesData) {
      const enrichedSales = await Promise.all(
        salesData.map(async (t) => {
          const { data: product } = await supabase
            .from('products')
            .select('id, title, images')
            .eq('id', t.product_id)
            .maybeSingle();
          
          const { data: buyer } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', t.buyer_id)
            .maybeSingle();

          return {
            ...t,
            product,
            buyer_profile: buyer
          };
        })
      );
      setSales(enrichedSales);
    }

    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const TransactionCard = ({ transaction, type }: { transaction: Transaction; type: 'purchase' | 'sale' }) => (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <Link to={`/product/${transaction.product_id}`}>
            <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
              <img
                src={transaction.product?.images?.[0] || '/placeholder.svg'}
                alt={transaction.product?.title}
                className="h-full w-full object-cover"
              />
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link to={`/product/${transaction.product_id}`}>
                  <h3 className="font-medium truncate hover:text-primary">
                    {transaction.product?.title || 'Producto eliminado'}
                  </h3>
                </Link>
                <p className="text-sm text-muted-foreground">
                  {type === 'purchase' 
                    ? `Vendedor: ${transaction.seller_profile?.full_name || 'Usuario'}`
                    : `Comprador: ${transaction.buyer_profile?.full_name || 'Usuario'}`
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(transaction.completed_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">
                  {type === 'purchase' ? '-' : '+'}{transaction.amount.toLocaleString('es-ES')} €
                </p>
                <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                  {transaction.status === 'completed' ? 'Completada' : transaction.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
                    <p className="text-muted-foreground">
                      Aquí aparecerán los productos que compres
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {purchases.map((t) => (
                    <TransactionCard key={t.id} transaction={t} type="purchase" />
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
                    <p className="text-muted-foreground">
                      Aquí aparecerán los productos que vendas
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sales.map((t) => (
                    <TransactionCard key={t.id} transaction={t} type="sale" />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 mt-8">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Compras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {purchases.reduce((sum, t) => sum + t.amount, 0).toLocaleString('es-ES')} €
                </p>
                <p className="text-sm text-muted-foreground">
                  {purchases.length} transacciones
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Ventas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {sales.reduce((sum, t) => sum + t.amount, 0).toLocaleString('es-ES')} €
                </p>
                <p className="text-sm text-muted-foreground">
                  {sales.length} transacciones
                </p>
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
