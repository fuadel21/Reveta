import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://reveta.es",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey) throw new Error("Falta STRIPE_SECRET_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Faltan variables de Supabase");

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Debes iniciar sesión para comprar");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) throw new Error("Sesión no válida");

    const body = await req.json();
    const { productId, shippingAmount = 0 } = body;
    const currency = "eur";

    if (!productId) throw new Error("Falta productId");

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
      .in("status", ["pending", "pending_payment", "paid", "shipped", "completed"])
      .limit(1)
      .maybeSingle();

    if (transactionError) throw transactionError;
    if (existingOpenTransaction?.id) throw new Error("Este producto ya está reservado o vendido");

    const parsedShippingAmount = Number(shippingAmount || 0);
    if (!Number.isFinite(parsedShippingAmount) || parsedShippingAmount < 0 || parsedShippingAmount > 20000) {
      throw new Error("Importe de envío no válido");
    }

    const productAmountCents = Math.round(Number(product.price) * 100);
    const shippingAmountCents = Math.round(parsedShippingAmount);
    const totalAmount = productAmountCents + shippingAmountCents;

    if (totalAmount <= 0) throw new Error("El importe debe ser mayor que cero");
    if (totalAmount > 999999) throw new Error("El importe supera el límite permitido");

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
        productId,
        buyerId: user.id,
        sellerId: product.user_id,
        productAmountCents: String(productAmountCents),
        shippingAmountCents: String(shippingAmountCents),
      },
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret, amount: totalAmount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear el pago";
    console.error("ERROR DETECTADO EN EDGE FUNCTION:", message);
    return new Response(
      JSON.stringify({
        error: message,
        details: "Revisa los logs de Supabase para más información",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
