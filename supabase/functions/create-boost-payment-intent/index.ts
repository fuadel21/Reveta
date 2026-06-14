import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOOST_PLANS: Record<string, { days: number; amount: number; label: string }> = {
  "7d": { days: 7, amount: 299, label: "Destacar producto 7 días" },
  "14d": { days: 14, amount: 499, label: "Destacar producto 14 días" },
  "30d": { days: 30, amount: 799, label: "Destacar producto 30 días" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!stripeKey) throw new Error("Falta STRIPE_SECRET_KEY");
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Faltan variables de Supabase");

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) throw new Error("Debes iniciar sesión");

    const { productId, plan } = await req.json();
    const selectedPlan = BOOST_PLANS[plan];
    if (!productId) throw new Error("Falta productId");
    if (!selectedPlan) throw new Error("Plan de destacado no válido");

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, user_id, status")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) throw new Error("Producto no encontrado");
    if (product.user_id !== userResult.user.id) throw new Error("Solo puedes destacar tus propios productos");
    if (product.status !== "active") throw new Error("Solo se pueden destacar productos activos");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: selectedPlan.amount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      description: selectedPlan.label,
      metadata: {
        type: "product_boost",
        productId: product.id,
        userId: userResult.user.id,
        plan,
        days: String(selectedPlan.days),
      },
    });

    const { data: boost, error: boostError } = await supabase
      .from("product_boosts")
      .insert({
        product_id: product.id,
        user_id: userResult.user.id,
        plan,
        amount_cents: selectedPlan.amount,
        currency: "eur",
        stripe_payment_intent_id: paymentIntent.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (boostError) throw boostError;

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        boostId: boost.id,
        amount: selectedPlan.amount,
        days: selectedPlan.days,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Boost payment error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "No se pudo crear el pago del destacado" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
