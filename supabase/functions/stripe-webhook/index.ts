import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2023-10-16", httpClient: Stripe.createFetchHttpClient() }) : null;
const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }) : null;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const addBoostDays = (currentBoostedUntil: string | null | undefined, days: number) => {
  const now = new Date();
  const current = currentBoostedUntil ? new Date(currentBoostedUntil) : null;
  const base = current && current > now ? current : now;
  base.setDate(base.getDate() + days);
  return base.toISOString();
};

const findPurchaseTransaction = async (paymentIntent: Stripe.PaymentIntent, metadata: Stripe.Metadata) => {
  if (!supabase) throw new Error("Faltan variables de Supabase");

  if (metadata.transactionId) {
    const { data } = await supabase
      .from("transactions")
      .select("id,product_id,buyer_id,seller_id,status")
      .eq("id", metadata.transactionId)
      .maybeSingle();
    if (data) return data;
  }

  const { data: existingByStripe } = await supabase
    .from("transactions")
    .select("id,product_id,buyer_id,seller_id,status")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  if (existingByStripe) return existingByStripe;

  if (metadata.productId && metadata.buyerId) {
    const { data: existingOpen } = await supabase
      .from("transactions")
      .select("id,product_id,buyer_id,seller_id,status")
      .eq("product_id", metadata.productId)
      .eq("buyer_id", metadata.buyerId)
      .in("status", ["pending", "pending_payment", "paid", "shipped", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOpen) return existingOpen;
  }

  return null;
};

const markProductPurchaseSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
  if (!supabase) throw new Error("Faltan variables de Supabase");
  const metadata = paymentIntent.metadata || {};
  if (metadata.type !== "product_purchase") return;

  const productId = metadata.productId;
  const buyerId = metadata.buyerId;
  const sellerId = metadata.sellerId;
  if (!productId || !buyerId || !sellerId) throw new Error("Faltan metadatos del pago");

  const amount = (paymentIntent.amount_received > 0 ? paymentIntent.amount_received : paymentIntent.amount) / 100;
  const now = new Date().toISOString();
  const transaction = await findPurchaseTransaction(paymentIntent, metadata);

  if (transaction?.id) {
    if (transaction.product_id !== productId || transaction.buyer_id !== buyerId || transaction.seller_id !== sellerId) {
      throw new Error("La transacción no coincide con los metadatos de Stripe");
    }

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
      .eq("id", transaction.id);
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

  await supabase.from("products").update({ status: "sold" }).eq("id", productId).in("status", ["active", "reserved"]);
};

const markProductPurchaseFailed = async (paymentIntent: Stripe.PaymentIntent) => {
  if (!supabase) throw new Error("Faltan variables de Supabase");
  const metadata = paymentIntent.metadata || {};
  if (metadata.type !== "product_purchase") return;

  const productId = metadata.productId;
  const now = new Date().toISOString();
  const transaction = await findPurchaseTransaction(paymentIntent, metadata);

  if (transaction?.id) {
    await supabase
      .from("transactions")
      .update({
        status: "cancelled",
        payment_provider: "stripe",
        payment_status: paymentIntent.status,
        stripe_payment_intent_id: paymentIntent.id,
        completed_at: now,
      })
      .eq("id", transaction.id)
      .in("status", ["pending_payment", "pending"]);
  }

  if (productId) await supabase.from("products").update({ status: "active" }).eq("id", productId).eq("status", "reserved");
};

const markProductBoostSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
  if (!supabase) throw new Error("Faltan variables de Supabase");
  const metadata = paymentIntent.metadata || {};
  if (metadata.type !== "product_boost") return;

  const days = Number(metadata.days || 0);
  if (!Number.isFinite(days) || days <= 0 || days > 60) throw new Error("Duración de destacado no válida");

  const { data: existingBoost } = await supabase
    .from("product_boosts")
    .select("id,product_id,user_id,plan")
    .eq("stripe_payment_intent_id", paymentIntent.id)
    .maybeSingle();

  const productId = existingBoost?.product_id || metadata.productId;
  const userId = existingBoost?.user_id || metadata.userId;
  const plan = existingBoost?.plan || metadata.plan || `${days}d`;
  if (!productId || !userId) throw new Error("Faltan metadatos del destacado");

  const { data: product, error: productError } = await supabase.from("products").select("id,user_id,boosted_until,status").eq("id", productId).maybeSingle();
  if (productError || !product) throw new Error("Producto del destacado no encontrado");
  if (product.user_id !== userId) throw new Error("El destacado no coincide con el propietario");

  const now = new Date().toISOString();
  const endsAt = addBoostDays(product.boosted_until, days);
  const amountCents = paymentIntent.amount_received > 0 ? paymentIntent.amount_received : paymentIntent.amount;

  if (existingBoost?.id) {
    await supabase.from("product_boosts").update({ status: "paid", starts_at: now, ends_at: endsAt, updated_at: now }).eq("id", existingBoost.id);
  } else {
    await supabase.from("product_boosts").insert({ product_id: productId, user_id: userId, plan, amount_cents: amountCents, currency: paymentIntent.currency || "eur", stripe_payment_intent_id: paymentIntent.id, status: "paid", starts_at: now, ends_at: endsAt });
  }

  await supabase.from("products").update({ boosted_until: endsAt }).eq("id", productId).eq("user_id", userId);
};

const markProductBoostFailed = async (paymentIntent: Stripe.PaymentIntent) => {
  if (!supabase) throw new Error("Faltan variables de Supabase");
  const metadata = paymentIntent.metadata || {};
  if (metadata.type !== "product_boost") return;
  await supabase.from("product_boosts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("stripe_payment_intent_id", paymentIntent.id);
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
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    if (event.type === "payment_intent.succeeded") {
      await markProductPurchaseSucceeded(paymentIntent);
      await markProductBoostSucceeded(paymentIntent);
    }

    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      await markProductPurchaseFailed(paymentIntent);
      await markProductBoostFailed(paymentIntent);
    }

    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    console.error("Stripe webhook error:", message);
    return json({ error: message }, 400);
  }
});
