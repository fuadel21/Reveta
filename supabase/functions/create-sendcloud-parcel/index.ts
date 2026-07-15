import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://reveta.es",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDCLOUD_API_BASE_URL = "https://panel.sendcloud.sc/api/v2";
const ALLOWED_TRANSACTION_STATUSES = new Set(["pending", "pending_payment", "paid", "completed"]);

const getAuthHeader = () => {
  const publicKey = Deno.env.get("SENDCLOUD_PUBLIC_KEY");
  const secretKey = Deno.env.get("SENDCLOUD_SECRET_KEY");

  if (!publicKey || !secretKey) {
    throw new Error("Faltan SENDCLOUD_PUBLIC_KEY o SENDCLOUD_SECRET_KEY");
  }

  return `Basic ${btoa(`${publicKey}:${secretKey}`)}`;
};

const requiredText = (value: unknown, label: string) => {
  const text = String(value || "").trim();
  if (!text) throw new Error(`Falta ${label}`);
  if (text.length > 180) throw new Error(`${label} es demasiado largo`);
  return text;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Faltan variables de Supabase");
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Debes iniciar sesión para crear un envío");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) throw new Error("Sesión no válida");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const transactionId = requiredText(body.transactionId, "transactionId");
    const address = requiredText(body.address, "la dirección");
    const houseNumber = requiredText(body.houseNumber, "el número de calle");
    const postalCode = requiredText(body.postalCode, "el código postal");
    const city = requiredText(body.city, "la ciudad");
    const country = String(body.country || "ES").trim().toUpperCase();
    const weight = String(body.weight || "0.5").trim();
    const requestLabel = Boolean(body.requestLabel);

    if (country !== "ES") throw new Error("Por ahora solo se permiten envíos nacionales en España");
    if (!/^\d{5}$/.test(postalCode)) throw new Error("Código postal no válido");
    if (!/^\d+(\.\d+)?$/.test(weight) || Number(weight) <= 0 || Number(weight) > 30) {
      throw new Error("Peso del paquete no válido");
    }

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from("transactions")
      .select("id,buyer_id,seller_id,product_id,status,sendcloud_parcel_id,sendcloud_tracking_number,sendcloud_tracking_url")
      .eq("id", transactionId)
      .maybeSingle();

    if (transactionError || !transaction) throw new Error("Transacción no encontrada");
    if (transaction.buyer_id !== user.id) throw new Error("No puedes crear envíos para compras de otro usuario");
    if (!ALLOWED_TRANSACTION_STATUSES.has(String(transaction.status))) {
      throw new Error("La transacción no está en un estado válido para crear envío");
    }

    if (transaction.sendcloud_parcel_id) {
      return new Response(
        JSON.stringify({
          parcel: {
            id: transaction.sendcloud_parcel_id,
            tracking_number: transaction.sendcloud_tracking_number,
            tracking_url: transaction.sendcloud_tracking_url,
            alreadyCreated: true,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id,title,user_id")
      .eq("id", transaction.product_id)
      .maybeSingle();

    if (productError || !product) throw new Error("Producto de la transacción no encontrado");
    if (product.user_id !== transaction.seller_id) throw new Error("La transacción no coincide con el vendedor del producto");

    const { data: buyerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name,phone")
      .eq("id", user.id)
      .maybeSingle();

    const buyerName = requiredText(buyerProfile?.full_name || body.buyerName || user.email, "el nombre del comprador");
    const buyerPhone = String(body.buyerPhone || buyerProfile?.phone || "").trim();

    const shipmentMethodId = Number(Deno.env.get("SENDCLOUD_SHIPPING_METHOD_ID") || 0);
    const parcel: Record<string, unknown> = {
      name: buyerName,
      company_name: "",
      address,
      house_number: houseNumber,
      city,
      postal_code: postalCode,
      country,
      telephone: buyerPhone,
      email: user.email || "",
      weight,
      order_number: transaction.id,
      request_label: requestLabel,
      parcel_items: [
        {
          description: product.title || "Producto Reveta",
          quantity: 1,
          weight,
          value: "1.00",
        },
      ],
    };

    if (Number.isFinite(shipmentMethodId) && shipmentMethodId > 0) {
      parcel.shipment = { id: shipmentMethodId };
    }

    const response = await fetch(`${SENDCLOUD_API_BASE_URL}/parcels`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ parcel }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || "No se pudo crear el envío en Sendcloud");
    }

    const createdParcel = data.parcel || data;
    const parcelStatus = typeof createdParcel?.status === "object" ? createdParcel?.status?.message : createdParcel?.status;
    const { error: saveError } = await supabaseAdmin
      .from("transactions")
      .update({
        shipping_provider: "sendcloud",
        shipping_status: parcelStatus || "pending_coordination",
        sendcloud_parcel_id: createdParcel?.id ? String(createdParcel.id) : null,
        sendcloud_tracking_number: createdParcel?.tracking_number || createdParcel?.tracking_code || null,
        sendcloud_tracking_url: createdParcel?.tracking_url || createdParcel?.tracking_url_provider || null,
        shipping_address: {
          fullName: buyerName,
          phone: buyerPhone,
          address,
          houseNumber,
          postalCode,
          city,
          country,
        },
      })
      .eq("id", transaction.id)
      .eq("buyer_id", user.id);

    if (saveError) {
      console.error("ERROR SAVING SENDCLOUD TRACKING:", saveError.message);
      throw new Error("El envío se creó en Sendcloud, pero no se pudo guardar el seguimiento en Reveta");
    }

    return new Response(JSON.stringify({ parcel: createdParcel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el envío en Sendcloud";
    console.error("ERROR CREATE SENDCLOUD PARCEL:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
