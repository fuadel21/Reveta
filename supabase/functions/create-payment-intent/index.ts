import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('Falta la variable de entorno STRIPE_SECRET_KEY');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const body = await req.json();
    const { productId, amount, currency = 'eur' } = body;

    if (!amount || amount <= 0) {
      throw new Error('El importe debe ser mayor que cero');
    }

    console.log(`Intentando crear PaymentIntent: ${amount} ${currency} para producto ${productId}`);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        productId: productId || 'unknown',
      },
    })

    console.log(`PaymentIntent creado con éxito: ${paymentIntent.id}`);

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('ERROR DETECTADO EN EDGE FUNCTION:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Revisa los logs de Supabase para más información'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
