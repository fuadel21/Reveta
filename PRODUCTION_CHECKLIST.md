# Reveta - checklist de producción

## 1. Variables de Vercel

Configura en Vercel, solo para el frontend:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_publishable_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_ENABLE_STRIPE_PAYMENTS=true
VITE_STRIPE_TEST_MODE=false
```

No pongas claves secretas de Stripe, Sendcloud ni `SUPABASE_SERVICE_ROLE_KEY` en Vercel como variables públicas.

## 2. Migraciones de Supabase

Antes de probar pagos, envíos, destacados, disputas, llamadas privadas y valoraciones, aplica las migraciones:

```bash
supabase db push
```

Migraciones críticas añadidas:

- `20260708183000_harden_production_rls.sql`
- `20260708184000_ensure_marketplace_runtime_schema.sql`
- `20260708185000_private_call_sessions.sql`
- `20260708190000_reviews_runtime_compatibility.sql`

Estas migraciones crean/refuerzan RLS, columnas de Stripe, columnas de Sendcloud, tabla `product_boosts`, tabla `disputes`, columnas de ofertas, bucket `products`, `call_sessions`, `call_signals` y compatibilidad de `reviews` con `reviewed_id`/`transaction_id`.

## 3. Secrets de Supabase Edge Functions

Configura en Supabase:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
supabase secrets set SENDCLOUD_PUBLIC_KEY=xxx
supabase secrets set SENDCLOUD_SECRET_KEY=xxx
supabase secrets set SENDCLOUD_SHIPPING_METHOD_ID=0
supabase secrets set ALLOWED_ORIGIN=https://reveta.es
```

## 4. Funciones obligatorias a desplegar

```bash
supabase functions deploy create-payment-intent
supabase functions deploy create-boost-payment-intent
supabase functions deploy create-sendcloud-parcel
supabase functions deploy geocode-location
supabase functions deploy delete-account
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 5. Stripe webhook

En Stripe Dashboard, crea un endpoint hacia:

```text
https://TU_PROYECTO.supabase.co/functions/v1/stripe-webhook
```

Eventos mínimos:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`

El webhook es obligatorio para que las compras y los destacados se sincronicen de forma segura.

## 6. Prueba antes de abrir al público

- Registro de usuario nuevo.
- Publicar producto con JPG/PNG/WEBP menor de 5 MB.
- Crear chat y adjuntar imagen menor de 5 MB.
- Comprar con tarjeta.
- Verificar que Stripe llama al webhook.
- Verificar que la transacción queda completada.
- Verificar que Sendcloud crea un solo envío para la transacción.
- Destacar producto y comprobar que `boosted_until` cambia desde el webhook.
- Probar pago en persona: comprador reserva, vendedor confirma cobro, vendedor marca envío, comprador confirma recepción.
- Abrir una incidencia y resolverla desde admin.
- Valorar una operación completada.
- Crear una llamada privada entre comprador y vendedor.
- Confirmar que un tercer usuario no puede leer chats, transacciones ni señales de llamada ajenas.

## 7. Pendiente legal antes de campaña grande

Revisar con texto legal definitivo:

- Aviso legal del titular del servicio.
- Política de privacidad con proveedores reales: Supabase, Stripe, Sendcloud, Vercel y analítica si se activa.
- Condiciones de pago, envío, reembolso, disputas y productos prohibidos.
- Política de cookies si se usa analítica o marketing.
