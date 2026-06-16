import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const markProductPurchaseSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
  if (!supabase) throw new Error("Faltan variables de Supabase");

  const metadata = paymentIntent.metadata || {};
  if (metadata.type !== "product_purchase") return;

  const productId = metadata.productId;
  const buyerId = metadata.buyerId;
  const sellerId = metadata.sellerId;

  if (!productId || !buyerId || !sellerId) {
    throw new Error("Faltan metadatos del pago");
  }

  const amount = paymentIntent.amount_received > 0
    ? paymentIntent.amount_received / 100
    : paymentIntent.amount / 100;

  const now = new Date().toISOString();

  const { data: existingByStripe } = await supabase
    .from("transactions")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (existingByStripe?.id) {
    await supabase
      .from("transactions")
      .update({
        status: "completed",
        payment_provider: "stripe",
        payment_status: paymentIntent.status,
        amount,
        paid_at: now,
        completed_at: now,
      })
      .eq("id", existingByStripe.id);
  } else {
    const { data: existingOpen } = await supabase
      .from("transactions")
      .select("id")
      .eq("product_id", productId)
      .eq("buyer_id", buyerId)
      .in("status", ["pending", "pending_payment", "paid", "shipped", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOpen?.id) {
      await supabase
        .from("transactions")
        .update({
          status: "completed",
          payment_provider: "stripe",
          payment_status: paymentIntent.status,
          stripe_payment_intent_id: paymentIntent.id,
          amount,
          paid_at: now,
          completed_at: now,
        })
        .eq("id", existingOpen.id);
    } else {
      await supabase.from("transactions").insert({
        product_id: productId,
        buyer_id: buyerId,
        seller_id: sellerId,
        amount,
        status: "completed",
        payment_provider: "stripe",
        payment_status: paymentIntent.status,
        stripe_payment_intent_id: paymentIntent.id,
        paid_at: now,
        completed_at: now,
      });
    }
  }

  await supabase
    .from("products")
    .update({ status: "sold" })
    .eq("id", productId)
    .in("status", ["active", "reserved"]);
};

const markProductPurchaseFailed = async (paymentIntent: Stripe.PaymentIntent) => {
  if (!supabase) throw new Error("Faltan variables de Supabase");

  const metadata = paymentIntent.metadata || {};
  if (metadata.type !== "product_purchase") return;

  await supabase
    .from("transactions")
    .update({
      payment_provider: "stripe",
      payment_status: paymentIntent.status,
      stripe_payment_intent_id: paymentIntent.id,
    })
    .eq("stripe_payment_intent_id", paymentIntent.id);
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!stripeKey || !stripe || !webhookSecret) throw new Error("Faltan variables de Stripe");
    if (!supabase) throw new Error("Faltan variables de Supabase");

    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("Falta stripe-signature");

    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    if (event.type === "payment_intent.succeeded") {
      await markProductPurchaseSucceeded(event.data.object as Stripe.PaymentIntent);
    }

    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      await markProductPurchaseFailed(event.data.object as Stripe.PaymentIntent);
    }

    return json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error?.message || error);
    return json({ error: error?.message || "Webhook error" }, 400);
  }
});
