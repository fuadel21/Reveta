import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getPayPalBaseUrl = () => {
  const environment = Deno.env.get('PAYPAL_ENVIRONMENT') || 'sandbox'
  return environment === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

const getAccessToken = async () => {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Faltan PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET')
  }

  const credentials = btoa(`${clientId}:${clientSecret}`)
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`No se pudo autenticar con PayPal: ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, currency = 'EUR', productId } = await req.json()
    const numericAmount = Number(amount)

    if (!numericAmount || numericAmount <= 0) {
      throw new Error('El importe debe ser mayor que cero')
    }

    const accessToken = await getAccessToken()
    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: productId || 'reveta-product',
            amount: {
              currency_code: currency,
              value: numericAmount.toFixed(2),
            },
          },
        ],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data?.message || data?.details?.[0]?.description || 'No se pudo crear la orden de PayPal')
    }

    return new Response(
      JSON.stringify({ orderID: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    console.error('ERROR CREATE PAYPAL ORDER:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
