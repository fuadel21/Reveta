import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, CreditCard, Megaphone, Shield, Sparkles } from 'lucide-react';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_PAYMENTS_ENABLED = import.meta.env.VITE_ENABLE_STRIPE_PAYMENTS === 'true' && !!STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PAYMENTS_ENABLED ? loadStripe(STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null);

const BOOST_PLANS = [
  { id: '7d', days: 7, price: 2.99, label: '7 días', description: 'Ideal para probar' },
  { id: '14d', days: 14, price: 4.99, label: '14 días', description: 'Más visibilidad' },
  { id: '30d', days: 30, price: 7.99, label: '30 días', description: 'Máxima duración' },
] as const;

type BoostPlan = typeof BOOST_PLANS[number]['id'];

type Product = {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  user_id: string;
  status: string | null;
  boosted_until?: string | null;
};

const getFunctionErrorMessage = async (error: any) => {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const payload = await error.context.json();
      return payload?.error || payload?.message || error.message;
    }
  } catch {
    // Ignore parsing errors.
  }
  return error?.message || 'No se pudo conectar con el servidor.';
};

const addDaysToBoost = (currentBoostedUntil: string | null | undefined, days: number) => {
  const now = new Date();
  const current = currentBoostedUntil ? new Date(currentBoostedUntil) : null;
  const base = current && current > now ? current : now;
  base.setDate(base.getDate() + days);
  return base.toISOString();
};

const BoostPaymentForm = ({ product }: { product: Product }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const submitLockRef = useRef(false);

  const [selectedPlan, setSelectedPlan] = useState<BoostPlan>('7d');
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const plan = useMemo(() => BOOST_PLANS.find((item) => item.id === selectedPlan) || BOOST_PLANS[0], [selectedPlan]);
  const productImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;

  const activateBoost = async (boostId: string) => {
    if (!user) throw new Error('Debes iniciar sesión.');

    const endsAt = addDaysToBoost(product.boosted_until, plan.days);
    const now = new Date().toISOString();

    const { error: boostError } = await (supabase as any)
      .from('product_boosts')
      .update({ status: 'paid', starts_at: now, ends_at: endsAt, updated_at: now })
      .eq('id', boostId)
      .eq('user_id', user.id);

    if (boostError) throw boostError;

    const { error: productError } = await supabase
      .from('products')
      .update({ boosted_until: endsAt } as any)
      .eq('id', product.id)
      .eq('user_id', user.id);

    if (productError) throw productError;
  };

  const handlePayment = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setProcessing(true);

    try {
      if (!STRIPE_PAYMENTS_ENABLED) throw new Error('Los pagos con tarjeta no están activos todavía.');
      if (!stripe || !elements) throw new Error('Stripe no está cargado. Recarga la página.');
      if (!user) throw new Error('Debes iniciar sesión para destacar un producto.');

      const card = elements.getElement(CardElement);
      if (!card) throw new Error('No se pudo leer la tarjeta.');

      const { data, error: functionError } = await supabase.functions.invoke('create-boost-payment-intent', {
        body: { productId: product.id, plan: selectedPlan },
      });

      if (functionError) {
        const message = await getFunctionErrorMessage(functionError);
        throw new Error(message);
      }

      const clientSecret = data?.clientSecret;
      const boostId = data?.boostId;
      if (!clientSecret || !boostId) throw new Error('No se pudo preparar el pago del destacado.');

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });

      if (result.error) throw new Error(result.error.message || 'El pago no se pudo completar.');
      if (result.paymentIntent?.status !== 'succeeded') throw new Error('El pago no se ha confirmado todavía.');

      await activateBoost(boostId);

      toast({
        title: 'Producto destacado',
        description: `Tu producto se destacará durante ${plan.days} días.`,
      });
      navigate('/profile', { replace: true });
    } catch (error: any) {
      console.error('Boost payment error:', error);
      toast({
        title: 'No se pudo destacar el producto',
        description: error?.message || 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
      submitLockRef.current = false;
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Elige cuánto tiempo quieres destacar tu producto
            </CardTitle>
            <CardDescription>Los productos destacados aparecen por encima de los productos normales en búsquedas y listados.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {BOOST_PLANS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedPlan(item.id)}
                className={`rounded-xl border p-4 text-left transition hover:border-primary ${selectedPlan === item.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`}
              >
                <p className="font-bold">{item.label}</p>
                <p className="text-2xl font-bold text-primary mt-2">{item.price.toFixed(2)} €</p>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                {selectedPlan === item.id && <Badge className="mt-3">Seleccionado</Badge>}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pago con tarjeta
            </CardTitle>
            <CardDescription>Pago seguro con Stripe. Reveta no guarda los datos de tu tarjeta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!STRIPE_PAYMENTS_ENABLED ? (
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                Los pagos con tarjeta no están activos. Revisa VITE_STRIPE_PUBLISHABLE_KEY y VITE_ENABLE_STRIPE_PAYMENTS.
              </div>
            ) : (
              <div className="rounded-lg border bg-background p-4">
                <CardElement onChange={(event) => setCardError(event.error?.message || null)} options={{ hidePostalCode: true }} />
              </div>
            )}
            {cardError && <p className="text-sm text-destructive">{cardError}</p>}
            <Button className="w-full h-12 text-base font-bold" onClick={handlePayment} disabled={processing || !STRIPE_PAYMENTS_ENABLED}>
              {processing ? 'Procesando...' : `Pagar ${plan.price.toFixed(2)} € y destacar`}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-xl bg-muted aspect-video">
              {productImage ? <img src={productImage} alt={product.title} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-muted-foreground">Sin imagen</div>}
            </div>
            <div>
              <p className="font-semibold">{product.title}</p>
              <p className="text-sm text-muted-foreground">Precio del producto: {product.price.toLocaleString('es-ES')} €</p>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm">
              <p className="font-bold">Plan: {plan.label}</p>
              <p>Importe: {plan.price.toFixed(2)} €</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-6 space-y-3 text-sm">
            <div className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" /><span>Aparece antes en búsquedas.</span></div>
            <div className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" /><span>Etiqueta visual de destacado.</span></div>
            <div className="flex gap-2"><Shield className="h-4 w-4 text-primary shrink-0" /><span>Se activa solo cuando el pago se completa.</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const BoostProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user && productId) fetchProduct();
  }, [user, productId]);

  const fetchProduct = async () => {
    if (!productId || !user) return;

    const { data, error } = await supabase
      .from('products')
      .select('id, title, price, images, user_id, status, boosted_until')
      .eq('id', productId)
      .maybeSingle();

    if (error || !data) {
      toast({ title: 'Producto no encontrado', description: 'No se pudo cargar el producto.', variant: 'destructive' });
      navigate('/profile');
      return;
    }

    if (data.user_id !== user.id) {
      toast({ title: 'Acceso no permitido', description: 'Solo puedes destacar tus propios productos.', variant: 'destructive' });
      navigate('/profile');
      return;
    }

    if (data.status !== 'active') {
      toast({ title: 'Producto no activo', description: 'Solo puedes destacar productos activos.', variant: 'destructive' });
      navigate('/profile');
      return;
    }

    setProduct(data as Product);
    setLoading(false);
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!product) return null;

  return (
    <>
      <Helmet>
        <title>Destacar producto | Reveta</title>
        <meta name="description" content="Destaca tu producto en Reveta para conseguir más visibilidad" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <Button variant="ghost" className="mb-6" onClick={() => navigate('/profile')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al perfil
          </Button>
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2"><Megaphone className="h-7 w-7 text-primary" />Destacar producto</h1>
            <p className="text-muted-foreground mt-2">Paga una vez y aumenta la visibilidad de tu anuncio.</p>
          </div>
          <Elements stripe={stripePromise}>
            <BoostPaymentForm product={product} />
          </Elements>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default BoostProduct;
