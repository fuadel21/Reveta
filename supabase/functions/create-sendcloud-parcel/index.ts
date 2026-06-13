import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SENDCLOUD_API_BASE_URL = 'https://panel.sendcloud.sc/api/v2'

const getAuthHeader = () => {
  const publicKey = Deno.env.get('SENDCLOUD_PUBLIC_KEY')
  const secretKey = Deno.env.get('SENDCLOUD_SECRET_KEY')

  if (!publicKey || !secretKey) {
    throw new Error('Faltan SENDCLOUD_PUBLIC_KEY o SENDCLOUD_SECRET_KEY')
  }

  return `Basic ${btoa(`${publicKey}:${secretKey}`)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      transactionId,
      productTitle,
      buyerName,
      buyerEmail,
      buyerPhone,
      address,
      houseNumber,
      postalCode,
      city,
      country = 'ES',
      weight = '0.5',
      requestLabel = false,
    } = body

    if (!buyerName || !address || !houseNumber || !postalCode || !city) {
      throw new Error('Faltan datos obligatorios de dirección para crear el envío')
    }

    const payload = {
      parcel: {
        name: buyerName,
        company_name: '',
        address,
        house_number: String(houseNumber),
        city,
        postal_code: String(postalCode),
        country,
        telephone: buyerPhone || '',
        email: buyerEmail || '',
        weight: String(weight),
        order_number: transactionId || crypto.randomUUID(),
        request_label: Boolean(requestLabel),
        shipment: {
          id: Number(Deno.env.get('SENDCLOUD_SHIPPING_METHOD_ID') || 0) || undefined,
        },
        parcel_items: [
          {
            description: productTitle || 'Producto Reveta',
            quantity: 1,
            weight: String(weight),
            value: '1.00',
          },
        ],
      },
    }

    if (!payload.parcel.shipment.id) {
      delete payload.parcel.shipment
    }

    const response = await fetch(`${SENDCLOUD_API_BASE_URL}/parcels`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || 'No se pudo crear el envío en Sendcloud')
    }

    return new Response(
      JSON.stringify({ parcel: data.parcel || data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    console.error('ERROR CREATE SENDCLOUD PARCEL:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
