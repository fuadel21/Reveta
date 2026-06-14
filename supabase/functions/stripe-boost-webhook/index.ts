import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const addDaysToBoost = (currentBoostedUntil: string | null | undefined, days: number) => {
  const now = new Date();
  const current = currentBoostedUntil ? new Date(currentBoostedUntil) : null;
  const base = current && current > now ? current : now;
  base.setDate(base.getDate() + days);
  return base.toISOString();
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_BOOST_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) throw new Error("Falta STRIPE_SECRET_KEY");
    if (!webhookSecret) throw new Error("Falta STRIPE_BOOST_WEBHOOK_SECRET");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Faltan variables de Supabase");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("Falta stripe-signature");

    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    if (event.type !== "payment_intent.succeeded") {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    if (paymentIntent.metadata?.type !== "product_boost") {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const productId = paymentIntent.metadata.productId;
    const userId = paymentIntent.metadata.userId;
    const plan = paymentIntent.metadata.plan;
    const days = Number(paymentIntent.metadata.days || 0);

    if (!productId || !userId || !plan || !days) {
      throw new Error("Metadata incompleta en PaymentIntent");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, user_id, boosted_until")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) throw productError || new Error("Producto no encontrado");
    if (product.user_id !== userId) throw new Error("El producto no pertenece al usuario del pago");

    const endsAt = addDaysToBoost(product.boosted_until, days);
    const now = new Date().toISOString();

    const { error: boostError } = await supabase
      .from("product_boosts")
      .update({
        status: "paid",
        starts_at: now,
        ends_at: endsAt,
        updated_at: now,
      })
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .eq("user_id", userId)
      .eq("product_id", productId);

    if (boostError) throw boostError;

    const { error: updateProductError } = await supabase
      .from("products")
      .update({ boosted_until: endsAt })
      .eq("id", productId)
      .eq("user_id", userId);

    if (updateProductError) throw updateProductError;

    return new Response(JSON.stringify({ received: true, productId, plan, endsAt }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe boost webhook error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Webhook error" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
