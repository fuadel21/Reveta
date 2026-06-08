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

    const totalAmount = product.price + (selectedShipping?.price || 0);

    if (paymentMethod === 'card') {
      setProcessingPayment(true);

      try {
        // Crear Payment Intent en el backend
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: product.id,
            amount: Math.round(totalAmount * 100),
            userId: user?.id,
          }),
        });

        if (!response.ok) {
          throw new Error('Error al crear el Payment Intent');
        }

        const { clientSecret } = await response.json();

        const result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: {
              name: user?.email || 'Usuario',
            },
          },
        });

        if (result.error) {
          setCardError(result.error.message || 'Error en el pago');
          toast.error(result.error.message || 'Error al procesar el pago');
        } else if (result.paymentIntent?.status === 'succeeded') {
          toast.success('¡Compra realizada con éxito!');
          
          await supabase.from('purchases').insert({
            product_id: product.id,
            buyer_id: user?.id,
            seller_id: product.user_id,
            amount: totalAmount,
            payment_method: 'stripe',
            status: 'completed',
            shipping_method: selectedShipping?.name || 'standard',
          });

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
      toast.success('Se ha registrado tu compra. El vendedor se pondrá en contacto para coordinar la transferencia.');
      
      await supabase.from('purchases').insert({
        product_id: product.id,
        buyer_id: user?.id,
        seller_id: product.user_id,
        amount: totalAmount,
        payment_method: 'transfer',
        status: 'pending',
        shipping_method: selectedShipping?.name || 'standard',
      });

      setTimeout(() => {
        navigate('/');
      }, 2000);
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
                  <span className="font-semibold">Gratis</span>
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
                  {seller.avatar_url && (
                    <img 
                      src={seller.avatar_url} 
                      alt={seller.full_name}
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-semibold">{seller.full_name}</p>
                    <p className="text-sm text-muted-foreground">⭐ 4.8 (124 valoraciones)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <ShippingInfo
            productId={product.id}
            productPrice={product.price}
            sellerLocation={product.location || 'Madrid'}
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
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'paypal' | 'transfer')}
                    className="w-4 h-4"
                  />
                  <CreditCard className="h-5 w-5" />
                  <span className="font-medium">Tarjeta de Crédito/Débito</span>
                </label>

                {paymentMethod === 'card' && (
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    <div className="bg-white p-3 rounded border">
                      <CardElement
                        options={{
                          style: {
                            base: {
                              fontSize: '16px',
                              color: '#424770',
                              '::placeholder': {
                                color: '#aab7c4',
                              },
                            },
                            invalid: {
                              color: '#9e2146',
                            },
                          },
                        }}
                        onChange={handleCardChange}
                      />
                    </div>
                    {cardError && (
                      <div className="flex gap-2 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{cardError}</span>
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                  <input
                    type="radio"
                    name="payment"
                    value="transfer"
                    checked={paymentMethod === 'transfer'}
                    onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'paypal' | 'transfer')}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">Transferencia Bancaria</span>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent opacity-50">
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

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900">Compra Protegida</p>
                  <p className="text-blue-800">Tu dinero está protegido hasta que recibas el producto en perfecto estado.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handlePayment}
            disabled={processingPayment || !stripe || !elements || !selectedShipping}
            className="w-full h-12 text-base"
            size="lg"
          >
            {processingPayment ? 'Procesando...' : `Confirmar compra - ${(product.price + (selectedShipping?.price || 0)).toFixed(2)} €`}
          </Button>

          <div className="flex gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin">⏳</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Producto no encontrado</p>
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
