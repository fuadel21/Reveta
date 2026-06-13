import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CreditCard, ImageOff, Landmark, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ShippingInfo } from '@/components/ShippingInfo';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_PAYMENTS_ENABLED = import.meta.env.VITE_ENABLE_STRIPE_PAYMENTS === 'true' && !!STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PAYMENTS_ENABLED ? loadStripe(STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null);

type PaymentMethod = 'card' | 'in_person';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  user_id: string;
  location: string | null;
  status: string | null;
}

interface Seller {
  full_name: string | null;
  avatar_url: string | null;
}

const OPEN_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped'];

const getFunctionErrorMessage = async (error: any) => {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const payload = await error.context.json();
      return payload?.error || payload?.message || error.message;
    }
  } catch {
    // Ignore JSON parsing errors and return the generic message below.
  }

  return error?.message || 'No se pudo conectar con el servidor de pagos.';
};

const CheckoutForm = ({ product, seller }: { product: Product; seller: Seller | null }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user } = useAuth();
  const submitLockRef = useRef(false);

  const [processingPayment, setProcessingPayment] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(STRIPE_PAYMENTS_ENABLED ? 'card' : 'in_person');
  const [selectedShipping, setSelectedShipping] = useState<any>(null);

  const productImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
  const totalAmount = useMemo(() => product.price + (selectedShipping?.price || 0), [product.price, selectedShipping]);

  const handleCardChange = (event: any) => {
    setCardError(event.error?.message || null);
  };

  const ensureConversation = async () => {
    if (!user) return null;

    const { data: existingConversation, error: findError } = await supabase
      .from('conversations')
      .select('id')
      .eq('product_id', product.id)
      .eq('buyer_id', user.id)
      .eq('seller_id', product.user_id)
      .maybeSingle();

    if (findError) {
      console.error('Error finding checkout conversation:', findError);
    }

    if (existingConversation?.id) {
      return existingConversation.id;
    }

    const { data: createdConversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.user_id,
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating checkout conversation:', createError);
      return null;
    }

    return createdConversation?.id || null;
  };

  const sendTransactionMessage = async (conversationId: string, content: string) => {
    if (!user) return;

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    });

    if (error) {
      console.error('Error sending transaction message:', error);
    }
  };

  const findExistingOpenTransaction = async () => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('transactions')
      .select('id, status')
      .eq('product_id', product.id)
      .eq('buyer_id', user.id)
      .in('status', OPEN_TRANSACTION_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error checking existing transaction:', error);
      return null;
    }

    return data;
  };

  const recordTransaction = async (status: 'completed' | 'pending') => {
    if (!user) throw new Error('Debes iniciar sesión para comprar.');

    const existingTransaction = await findExistingOpenTransaction();
    if (existingTransaction?.id) {
      return { created: false, transactionId: existingTransaction.id };
    }

    const { data: insertedTransaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.user_id,
        amount: totalAmount,
        status,
      })
      .select('id')
      .single();

    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
      throw new Error('No se pudo registrar la compra. Revisa los permisos de la tabla transactions.');
    }

    const { error: productError } = await supabase
      .from('products')
      .update({ status: status === 'completed' ? 'sold' : 'reserved' })
      .eq('id', product.id);

    if (productError) {
      console.error('Error updating product status:', productError);
    }

    return { created: true, transactionId: insertedTransaction?.id || null };
  };

  const completeCardPayment = async () => {
    await recordTransaction('completed');

    const conversationId = await ensureConversation();
    if (conversationId) {
      await sendTransactionMessage(
        conversationId,
        `He pagado “${product.title}” con tarjeta por ${totalAmount.toFixed(2)} €.`,
      );
    }

    toast.success('Pago con tarjeta completado');
    navigate('/transactions', { replace: true });
  };

  const handleCardPayment = async () => {
    if (!STRIPE_PAYMENTS_ENABLED) {
      throw new Error('El pago con tarjeta todavía no está activo. Usa pago en persona.');
    }

    if (!stripe || !elements) {
      throw new Error('Stripe no está cargado. Recarga la página o usa pago en persona.');
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      throw new Error('No se pudo leer la tarjeta. Recarga la página e inténtalo de nuevo.');
    }

    const { data, error: functionError } = await supabase.functions.invoke('create-payment-intent', {
      body: {
        productId: product.id,
        amount: Math.round(totalAmount * 100),
        currency: 'eur',
      },
    });

    if (functionError) {
      const message = await getFunctionErrorMessage(functionError);
      console.error('Payment function error:', functionError);
      throw new Error(`${message} Puedes continuar con pago en persona.`);
    }

    const clientSecret = data?.clientSecret;
    if (!clientSecret) {
      throw new Error('La función de pagos no devolvió el secreto de Stripe.');
    }

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card,
        billing_details: {
          name: user?.email || 'Usuario de Reveta',
        },
      },
    });

    if (result.error) {
      setCardError(result.error.message || 'Error en el pago');
      throw new Error(result.error.message || 'Error al procesar el pago');
    }

    if (result.paymentIntent?.status !== 'succeeded') {
      throw new Error('El pago no se ha completado. Inténtalo de nuevo.');
    }

    await completeCardPayment();
  };

  const handleInPersonPayment = async () => {
    const transactionResult = await recordTransaction('pending');

    if (!transactionResult.created) {
      toast.info('Ya tienes una compra pendiente para este producto.');
      navigate('/transactions', { replace: true });
      return;
    }

    const conversationId = await ensureConversation();
    if (conversationId) {
      await sendTransactionMessage(
        conversationId,
        `He reservado “${product.title}” para pagar en persona por ${totalAmount.toFixed(2)} €.`,
      );
    }

    toast.success('Reserva registrada para pago en persona.');
    navigate('/transactions', { replace: true });
  };

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (submitLockRef.current || processingPayment) {
      return;
    }

    if (!selectedShipping) {
      toast.error('Selecciona un método de entrega antes de confirmar.');
      return;
    }

    const existingTransaction = await findExistingOpenTransaction();
    if (existingTransaction?.id) {
      toast.info('Ya tienes una compra pendiente para este producto.');
      navigate('/transactions', { replace: true });
      return;
    }

    if (product.status && product.status !== 'active') {
      toast.error('Este producto ya no está disponible.');
      return;
    }

    submitLockRef.current = true;
    setProcessingPayment(true);

    try {
      if (paymentMethod === 'card') {
        await handleCardPayment();
      } else {
        await handleInPersonPayment();
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Error al procesar la compra');
      if (paymentMethod === 'card') {
        setPaymentMethod('in_person');
      }
    } finally {
      setProcessingPayment(false);
      submitLockRef.current = false;
    }
  };

  const isCardUnavailable = !STRIPE_PAYMENTS_ENABLED || !stripe || !elements;
  const buttonDisabled = processingPayment || !selectedShipping || (paymentMethod === 'card' && isCardUnavailable);

  return (
    <form onSubmit={handlePayment} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen de la compra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded overflow-hidden bg-muted shrink-0">
                  {productImage ? (
                    <img src={productImage} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImageOff className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{product.title}</h3>
                  {product.location && <p className="text-sm text-muted-foreground">{product.location}</p>}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Precio</span>
                  <span className="font-semibold">{product.price.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Entrega ({selectedShipping?.name || 'Selecciona una opción'})</span>
                  <span className="font-semibold">{(selectedShipping?.price || 0).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Comisión Reveta</span>
                  <span className="font-semibold text-green-600">Gratis</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{totalAmount.toFixed(2)} €</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {seller && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {seller.avatar_url ? (
                      <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary font-bold">{seller.full_name?.[0]?.toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{seller.full_name || 'Usuario'}</p>
                    <p className="text-sm text-muted-foreground">Vendedor en Reveta</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <ShippingInfo
            productId={product.id}
            productPrice={product.price}
            sellerLocation={product.location || 'España'}
            onSelectShipping={setSelectedShipping}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Método de pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'hover:bg-accent'} ${!STRIPE_PAYMENTS_ENABLED ? 'cursor-not-allowed opacity-50 bg-muted/20' : 'cursor-pointer'}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    disabled={!STRIPE_PAYMENTS_ENABLED}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    className="w-4 h-4 text-primary"
                  />
                  <CreditCard className="h-5 w-5" />
                  <span className="font-medium">
                    {STRIPE_PAYMENTS_ENABLED ? 'Tarjeta de Crédito/Débito' : 'Tarjeta de Crédito/Débito (pendiente de activar)'}
                  </span>
                </label>

                {STRIPE_PAYMENTS_ENABLED && paymentMethod === 'card' && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3 border border-border">
                    <div className="bg-white p-3 rounded border border-input shadow-sm">
                      <CardElement
                        options={{
                          style: {
                            base: {
                              fontSize: '16px',
                              color: '#1a1a1a',
                              fontFamily: 'system-ui, sans-serif',
                              '::placeholder': { color: '#a1a1aa' },
                            },
                            invalid: { color: '#ef4444' },
                          },
                        }}
                        onChange={handleCardChange}
                      />
                    </div>
                    {cardError && (
                      <div className="flex gap-2 text-destructive text-sm font-medium">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{cardError}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Pago seguro procesado por Stripe.</p>
                  </div>
                )}

                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'in_person' ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="in_person"
                    checked={paymentMethod === 'in_person'}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    className="w-4 h-4 text-primary"
                  />
                  <Landmark className="h-5 w-5" />
                  <span className="font-medium">Pago en persona</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20 shadow-none">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-primary">
                    {paymentMethod === 'card' ? 'Pago seguro con tarjeta' : 'Reserva para pago en persona'}
                  </p>
                  <p className="text-muted-foreground">
                    {paymentMethod === 'card'
                      ? 'El pago se procesa con Stripe y la compra queda registrada al confirmarse correctamente.'
                      : 'La operación queda pendiente hasta que comprador y vendedor coordinen entrega y pago en persona.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={buttonDisabled} className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" size="lg">
            {processingPayment ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Procesando...
              </div>
            ) : paymentMethod === 'in_person' ? (
              `Reservar para pago en persona - ${totalAmount.toFixed(2)} €`
            ) : (
              `Pagar con tarjeta - ${totalAmount.toFixed(2)} €`
            )}
          </Button>

          <div className="flex gap-2 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              {paymentMethod === 'card'
                ? 'Usa una tarjeta válida. En modo pruebas de Stripe puedes usar 4242 4242 4242 4242.'
                : 'El pago en persona se gestiona fuera de Reveta. Usa el chat para coordinar entrega, lugar y forma de pago.'}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
};

const Checkout = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    fetchProductAndSeller();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, productId, user?.id]);

  const fetchProductAndSeller = async () => {
    if (!productId) return;

    setLoading(true);

    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      if (productError) throw productError;
      if (!productData) throw new Error('Producto no encontrado');

      if (productData.user_id === user?.id) {
        toast.error('No puedes comprar tu propio producto.');
        navigate(`/product/${productData.id}`);
        return;
      }

      setProduct(productData as Product);

      const { data: sellerData, error: sellerError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', productData.user_id)
        .maybeSingle();

      if (sellerError) console.error('Error fetching seller:', sellerError);
      setSeller((sellerData || null) as Seller | null);
    } catch (error) {
      console.error('Error fetching checkout data:', error);
      toast.error('Error al cargar el producto');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl font-semibold mb-4">Producto no encontrado</p>
          <Button onClick={() => navigate('/')}>Volver al inicio</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Checkout - Reveta</title>
        <meta name="description" content="Completa tu compra en Reveta" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container max-w-6xl mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-8">Confirmar compra</h1>

          <Elements stripe={stripePromise}>
            <CheckoutForm product={product} seller={seller} />
          </Elements>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Checkout;
