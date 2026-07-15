import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://reveta.es",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPEN_TRANSACTION_STATUSES = ["pending", "pending_payment", "paid", "shipped", "completed"];
const PENDING_PAYMENT_TTL_MINUTES = 30;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let createdTransactionId: string | null = null;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) throw new Error("Falta STRIPE_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Faltan variables de Supabase");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Debes iniciar sesión para comprar");

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) throw new Error("Sesión no válida");

    const body = await req.json();
    const { productId, shippingAmount = 0 } = body;
    const currency = "eur";

    if (!productId) throw new Error("Falta productId");

    const staleCutoff = new Date(Date.now() - PENDING_PAYMENT_TTL_MINUTES * 60 * 1000).toISOString();
    await supabase
      .from("transactions")
      .update({ status: "cancelled", completed_at: new Date().toISOString(), payment_status: "expired" })
      .eq("product_id", productId)
      .eq("status", "pending_payment")
      .lt("created_at", staleCutoff);

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, price, user_id, status")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) throw productError || new Error("Producto no encontrado");
    if (product.user_id === user.id) throw new Error("No puedes comprar tu propio producto");
    if (product.status !== "active") throw new Error("Este producto ya no está disponible");

    const { data: existingOpenTransaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id")
      .eq("product_id", productId)
      .in("status", OPEN_TRANSACTION_STATUSES)
      .limit(1)
      .maybeSingle();

    if (transactionError) throw transactionError;
    if (existingOpenTransaction?.id) throw new Error("Este producto ya está reservado, pendiente de pago o vendido");

    const parsedShippingAmount = Number(shippingAmount || 0);
    if (!Number.isFinite(parsedShippingAmount) || parsedShippingAmount < 0 || parsedShippingAmount > 20000) {
      throw new Error("Importe de envío no válido");
    }

    const productAmountCents = Math.round(Number(product.price) * 100);
    const shippingAmountCents = Math.round(parsedShippingAmount);
    const totalAmount = productAmountCents + shippingAmountCents;

    if (totalAmount <= 0) throw new Error("El importe debe ser mayor que cero");
    if (totalAmount > 999999) throw new Error("El importe supera el límite permitido");

    const { data: transaction, error: insertTransactionError } = await supabase
      .from("transactions")
      .insert({
        product_id: productId,
        buyer_id: user.id,
        seller_id: product.user_id,
        amount: totalAmount / 100,
        status: "pending_payment",
        payment_provider: "stripe",
        payment_status: "creating",
      })
      .select("id")
      .single();

    if (insertTransactionError || !transaction?.id) {
      throw insertTransactionError || new Error("No se pudo reservar la operación de pago");
    }

    createdTransactionId = transaction.id;

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: "product_purchase",
        transactionId: transaction.id,
        productId,
        buyerId: user.id,
        sellerId: product.user_id,
        productAmountCents: String(productAmountCents),
        shippingAmountCents: String(shippingAmountCents),
      },
    });

    const { error: updateTransactionError } = await supabase
      .from("transactions")
      .update({ stripe_payment_intent_id: paymentIntent.id, payment_status: paymentIntent.status })
      .eq("id", transaction.id)
      .eq("buyer_id", user.id);

    if (updateTransactionError) throw updateTransactionError;

    return json({ clientSecret: paymentIntent.client_secret, amount: totalAmount, transactionId: transaction.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear el pago";
    console.error("ERROR DETECTADO EN EDGE FUNCTION:", message);

    if (createdTransactionId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceRoleKey) {
          const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
          await supabase
            .from("transactions")
            .update({ status: "cancelled", payment_status: "setup_failed", completed_at: new Date().toISOString() })
            .eq("id", createdTransactionId);
        }
      } catch (cleanupError) {
        console.error("No se pudo cancelar la transacción creada:", cleanupError);
      }
    }

    return json({ error: message, details: "Revisa los logs de Supabase para más información" }, 400);
  }
});
