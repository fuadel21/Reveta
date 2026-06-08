import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { loadStripe } from '@stripe/js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Clock, AlertCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { ShippingInfo } from '@/components/ShippingInfo';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51TfUZ9IDV23j4dXBoD8XkOEm2tZlC65pF2KB0dWIGI0Y6lAAGAidVtwRwTpJ9hd63h8mvLWH9TuYIhAEQjCY2vyT009pV7MXcP');

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  user_id: string;
  location: string | null;
}

interface Seller {
  full_name: string;
  avatar_url: string | null;
}

const CheckoutForm = ({ product, seller, onSuccess }: { product: Product; seller: Seller | null; onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [processingPayment, setProcessingPayment] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal' | 'transfer'>('card');
  const [selectedShipping, setSelectedShipping] = useState<any>(null);

  const handleCardChange = (event: any) => {
    if (event.error) {
      setCardError(event.error.message);
    } else {
      setCardError(null);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      toast.error('Stripe no está cargado. Por favor, recarga la página.');
      return;
    }

    if (!selectedShipping) {
      toast.error('Por favor, selecciona un método de envío.');
      return;
    }

    const totalAmount = product.price + (selectedShipping?.price || 0);

    if (paymentMethod === 'card') {
      setProcessingPayment(true);

      try {
        // Invocar la Edge Function de Supabase para crear el Payment Intent
        const { data, error: functionError } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            productId: product.id,
            amount: Math.round(totalAmount * 100), // En céntimos
            currency: 'eur'
          }
        });

        if (functionError) {
          console.error('Function error:', functionError);
          throw new Error('Error al conectar con el servidor de pagos. Verifica que la Edge Function esté activa.');
        }

        const { clientSecret } = data;

        if (!clientSecret) {
          throw new Error('No se pudo obtener el secreto de pago de Stripe.');
        }

        const result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: {
              name: user?.email || 'Usuario de Reveta',
            },
          },
        });

        if (result.error) {
          setCardError(result.error.message || 'Error en el pago');
          toast.error(result.error.message || 'Error al procesar el pago');
        } else if (result.paymentIntent?.status === 'succeeded') {
          toast.success('¡Compra realizada con éxito!');
          
          // Registrar la compra en la tabla 'transactions' (según Database Types)
          const { error: insertError } = await supabase.from('transactions').insert({
            product_id: product.id,
            buyer_id: user?.id,
            seller_id: product.user_id,
            amount: totalAmount,
            status: 'completed',
          });

          if (insertError) {
            console.error('Error recording transaction:', insertError);
          }

          // Actualizar estado del producto a vendido
          await supabase.from('products').update({ status: 'sold' }).eq('id', product.id);

          setTimeout(() => {
            navigate('/');
          }, 2000);
        }
      } catch (error: any) {
        toast.error(error.message || 'Error al procesar el pago');
        console.error('Payment error:', error);
      } finally {
        setProcessingPayment(false);
      }
    } else if (paymentMethod === 'transfer') {
      setProcessingPayment(true);
      try {
        toast.success('Se ha registrado tu solicitud de compra por transferencia.');
        
        await supabase.from('transactions').insert({
          product_id: product.id,
          buyer_id: user?.id,
          seller_id: product.user_id,
          amount: totalAmount,
          status: 'pending',
        });

        setTimeout(() => {
          navigate('/');
        }, 2000);
      } catch (error) {
        toast.error('Error al registrar la transferencia');
      } finally {
        setProcessingPayment(false);
      }
    } else {
      toast.info('PayPal será integrado próximamente');
    }
  };

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
                {product.images && product.images[0] && (
                  <img 
                    src={product.images[0]} 
                    alt={product.title}
                    className="w-20 h-20 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{product.title}</h3>
                  <p className="text-sm text-muted-foreground">{product.location}</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Precio</span>
                  <span className="font-semibold">{product.price.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Envío ({selectedShipping?.name || 'Selecciona uno'})</span>
                  <span className="font-semibold">{selectedShipping?.price ? `${selectedShipping.price.toFixed(2)} €` : '0.00 €'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Comisión Reveta</span>
                  <span className="font-semibold text-green-600">Gratis</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{(product.price + (selectedShipping?.price || 0)).toFixed(2)} €</span>
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
                      <img 
                        src={seller.avatar_url} 
                        alt={seller.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-primary font-bold">{seller.full_name[0]}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{seller.full_name}</p>
                    <p className="text-sm text-muted-foreground">Vendedor verificado en Reveta</p>
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
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'paypal' | 'transfer')}
                    className="w-4 h-4 text-primary"
                  />
                  <CreditCard className="h-5 w-5" />
                  <span className="font-medium">Tarjeta de Crédito/Débito</span>
                </label>

                {paymentMethod === 'card' && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3 border border-border">
                    <div className="bg-white p-3 rounded border border-input shadow-sm">
                      <CardElement
                        options={{
                          style: {
                            base: {
                              fontSize: '16px',
                              color: '#1a1a1a',
                              fontFamily: 'system-ui, sans-serif',
                              '::placeholder': {
                                color: '#a1a1aa',
                              },
                            },
                            invalid: {
                              color: '#ef4444',
                            },
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
                  </div>
                )}

                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'transfer' ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}>
                  <input
                    type="radio"
                    name="payment"
                    value="transfer"
                    checked={paymentMethod === 'transfer'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'paypal' | 'transfer')}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="font-medium">Transferencia Bancaria</span>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-not-allowed opacity-50 bg-muted/20">
                  <input
                    type="radio"
                    name="payment"
                    value="paypal"
                    disabled
                    className="w-4 h-4"
                  />
                  <span className="font-medium">PayPal (Próximamente)</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20 shadow-none">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-primary">Compra Protegida</p>
                  <p className="text-muted-foreground">Tu dinero está protegido hasta que recibas el producto en perfecto estado.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={processingPayment || !stripe || !elements || !selectedShipping}
            className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20"
            size="lg"
          >
            {processingPayment ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Procesando...
              </div>
            ) : `Confirmar compra - ${(product.price + (selectedShipping?.price || 0)).toFixed(2)} €`}
          </Button>

          <div className="flex gap-2 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>Al confirmar, aceptas los términos de compra y protección de Reveta.</p>
          </div>
        </div>
      </div>
    </form>
  );
};

const Checkout = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchProductAndSeller();
  }, [productId, user]);

  const fetchProductAndSeller = async () => {
    if (!productId) return;

    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      setProduct(productData);

      if (productData.user_id) {
        const { data: sellerData, error: sellerError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', productData.user_id)
          .single();

        if (!sellerError && sellerData) {
          setSeller(sellerData);
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Error al cargar el producto');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
            <CheckoutForm 
              product={product} 
              seller={seller}
              onSuccess={() => navigate('/')}
            />
          </Elements>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Checkout;
