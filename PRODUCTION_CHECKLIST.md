# Reveta - checklist final de producción

## Decisión de lanzamiento

Estado recomendado: **producción controlada / soft launch**.

Reveta puede estar publicada en la web y recibir pruebas reales controladas, pero antes de una campaña grande o entrada fuerte de usuarios hay que completar los puntos marcados como **OBLIGATORIO**.

### Veredicto rápido

- Código frontend: **OK si Frontend Build Check o Vercel están en verde**.
- Edge Functions: **OK si el workflow Deploy Supabase Edge Functions está en verde después de los últimos cambios**.
- Base de datos: **pendiente confirmar/aplicar migraciones nuevas**.
- Pagos reales: **pendiente prueba completa con Stripe webhook**.
- Envíos: **pendiente prueba real/test con Sendcloud**.
- Legal: **suficiente para soft launch si ya hay textos básicos; pendiente revisar antes de campaña grande**.

---

## 0. Bloqueos antes de abrir al público fuerte

### OBLIGATORIO 1 — Aplicar migraciones Supabase

Hay migraciones nuevas que protegen compras/reservas duplicadas del mismo producto.

Desde móvil:

1. Entra en GitHub.
2. Abre repo `fuadel21/Reveta`.
3. Ve a **Actions**.
4. Abre **Apply Supabase DB Migrations**.
5. Pulsa **Run workflow**.
6. Selecciona:

```text
mode: apply
confirm: APPLY_MIGRATIONS
```

7. Espera a que salga verde.

Migraciones críticas recientes:

- `20260715123000_guard_single_open_transaction_per_product.sql`
- `20260716090000_unique_open_transaction_per_product.sql`

Estas crean el índice:

```sql
transactions_one_open_per_product_idx
```

Objetivo: impedir que dos compradores puedan reservar/comprar el mismo producto al mismo tiempo.

### OBLIGATORIO 2 — Confirmar Edge Functions desplegadas

Desde móvil:

1. GitHub → repo `fuadel21/Reveta`.
2. Actions.
3. Abre **Deploy Supabase Edge Functions**.
4. Confirma que el último run después de los cambios está en verde.

Funciones obligatorias:

```text
create-payment-intent
create-boost-payment-intent
create-sendcloud-parcel
delete-account
geocode-location
stripe-webhook
```

Si no se ha ejecutado o está fallando, lanza manualmente el workflow.

### OBLIGATORIO 3 — Probar compra con tarjeta completa

Prueba mínima:

```text
1. Usuario A publica producto.
2. Usuario B compra con tarjeta test/live controlada.
3. Stripe confirma PaymentIntent succeeded.
4. Stripe llama al webhook.
5. transactions.status pasa a completed.
6. products.status pasa a sold.
7. No se crea una segunda transacción abierta del mismo producto.
8. El comprador ve la compra en /transactions.
9. El vendedor ve la venta en /transactions.
```

No abrir campaña grande hasta que esta prueba pase.

### OBLIGATORIO 4 — Probar Sendcloud

Prueba mínima:

```text
1. Tras una compra pagada, crear envío Sendcloud.
2. Confirmar que se guarda sendcloud_parcel_id.
3. Confirmar que se guarda tracking_number o tracking_url si Sendcloud lo devuelve.
4. Reintentar creación de envío y verificar que NO crea duplicado.
5. Confirmar que /transactions muestra datos de envío.
```

La función ya usa `sendcloud_creating` y lock temporal, pero hay que validar secretos y configuración real.

---

## 1. Estado técnico verificado

- Frontend Build Check en GitHub Actions: OK.
- Último estado revisado de Vercel: OK/success en el commit escaneado.
- Supabase Edge Functions: workflow preparado para desplegar funciones críticas.
- Pagos con tarjeta: `create-payment-intent` crea transacción `pending_payment` y Stripe metadata incluye `transactionId`.
- Stripe webhook: reforzado para no devolver éxito si falla una operación crítica de Supabase.
- Sendcloud: reforzado con estado `sendcloud_creating` para reducir riesgo de duplicados por reintentos.
- Transacciones: incidencias limitadas; no se permite abrir incidencia en `pending_payment`.
- Usuarios bloqueados: ya no depende de `upsert onConflict` frágil.
- `window.prompt`: limpio en escaneo reciente.
- `window.confirm`: limpio en escaneo reciente.
- `select('*')`: limpio en escaneo reciente.

---

## 2. Variables de Vercel

Configura en Vercel, solo para el frontend:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_publishable_key
VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_publishable_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_ENABLE_STRIPE_PAYMENTS=true
VITE_STRIPE_TEST_MODE=false
```

No pongas claves secretas de Stripe, Sendcloud ni `SUPABASE_SERVICE_ROLE_KEY` en Vercel como variables públicas.

### Comprobación rápida

- Si quieres activar pagos reales: `VITE_ENABLE_STRIPE_PAYMENTS=true`.
- Si todavía no quieres cobrar tarjeta: `VITE_ENABLE_STRIPE_PAYMENTS=false` y deja pago en persona activo.
- El frontend nunca debe tener `STRIPE_SECRET_KEY`, `SENDCLOUD_SECRET_KEY` ni service role.

---

## 3. Secrets de Supabase Edge Functions

Configura en Supabase o mediante GitHub Actions:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
supabase secrets set SENDCLOUD_PUBLIC_KEY=xxx
supabase secrets set SENDCLOUD_SECRET_KEY=xxx
supabase secrets set SENDCLOUD_SHIPPING_METHOD_ID=0
supabase secrets set ALLOWED_ORIGIN=https://reveta.es
```

### Comprobación rápida

- Sin `STRIPE_SECRET_KEY`, `create-payment-intent` fallará.
- Sin `STRIPE_WEBHOOK_SECRET`, `stripe-webhook` fallará.
- Sin `SENDCLOUD_PUBLIC_KEY` y `SENDCLOUD_SECRET_KEY`, `create-sendcloud-parcel` fallará.
- `ALLOWED_ORIGIN` debe ser `https://reveta.es` en producción.

---

## 4. Stripe webhook

En Stripe Dashboard, crea/verifica un endpoint hacia:

```text
https://TU_PROYECTO.supabase.co/functions/v1/stripe-webhook
```

Eventos mínimos:

```text
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
```

El webhook es obligatorio para que las compras y los destacados se sincronicen de forma segura.

### Prueba obligatoria

En Stripe → Developers → Webhooks:

```text
1. Hacer compra test.
2. Abrir evento payment_intent.succeeded.
3. Confirmar respuesta 200 desde Supabase.
4. Confirmar que la transacción se actualiza en Reveta.
```

---

## 5. Prueba funcional antes de abrir fuerte

### Usuario y perfil

- [ ] Registro de usuario nuevo.
- [ ] Login/logout.
- [ ] Recuperar contraseña.
- [ ] Editar perfil.
- [ ] Confirmar que el propio usuario puede guardar/ver su teléfono.
- [ ] Confirmar que un anónimo o tercero no puede leer la columna `phone` de `profiles`.

### Publicación y búsqueda

- [ ] Publicar producto con JPG/PNG/WEBP menor de 5 MB.
- [ ] Publicar producto con ciudad escrita.
- [ ] Confirmar que `geocode-location` responde sin sesión.
- [ ] Buscar productos por texto.
- [ ] Buscar productos por categoría.
- [ ] Abrir ficha SEO de producto.
- [ ] Ver perfil público de vendedor.

### Chat y ofertas

- [ ] Crear chat entre comprador y vendedor.
- [ ] Adjuntar imagen menor de 5 MB.
- [ ] Enviar oferta desde comprador.
- [ ] Rechazar oferta.
- [ ] Hacer contraoferta.
- [ ] Aceptar oferta desde vendedor.
- [ ] Confirmar que se crea una sola transacción.
- [ ] Confirmar que el producto queda reservado.

### Compra con tarjeta

- [ ] Comprar con tarjeta.
- [ ] Confirmar PaymentIntent succeeded.
- [ ] Confirmar webhook recibido.
- [ ] Confirmar `transactions.status = completed`.
- [ ] Confirmar `products.status = sold`.
- [ ] Confirmar que el comprador ve la compra.
- [ ] Confirmar que el vendedor ve la venta.

### Envío Sendcloud

- [ ] Crear envío tras compra.
- [ ] Confirmar `sendcloud_parcel_id`.
- [ ] Confirmar `sendcloud_tracking_number` o `sendcloud_tracking_url` si existe.
- [ ] Reintentar crear envío y confirmar que no duplica.
- [ ] Confirmar visualización en `/transactions`.

### Pago en persona

- [ ] Comprador reserva con pago en persona.
- [ ] Producto queda reservado.
- [ ] Vendedor confirma cobro.
- [ ] Producto pasa a vendido.
- [ ] Vendedor marca enviado.
- [ ] Comprador confirma recibido.

### Incidencias y valoraciones

- [ ] En `pending_payment` no aparece botón de incidencia.
- [ ] En pago en persona pendiente sí se puede abrir incidencia si procede.
- [ ] En `paid`, `shipped` o `completed` se puede abrir incidencia.
- [ ] Admin puede ver incidencia.
- [ ] Admin puede resolver incidencia.
- [ ] Usuario puede valorar operación completada.
- [ ] No se puede duplicar valoración si hay constraint activa.

### Privacidad y seguridad

- [ ] Un tercer usuario no puede leer chats ajenos.
- [ ] Un tercer usuario no puede leer transacciones ajenas.
- [ ] Un tercer usuario no puede leer señales de llamada ajenas.
- [ ] Un usuario no puede subir imágenes fuera de su carpeta `auth.uid()` en bucket `products`.
- [ ] Un usuario bloqueado no puede molestar según flujo previsto.

### Admin

- [ ] Admin puede ver reportes.
- [ ] Admin puede ver product_reports.
- [ ] Admin puede cambiar estado de producto si procede.
- [ ] Admin puede gestionar disputas.
- [ ] Admin no rompe productos en estado sold/reserved.

---

## 6. SEO y páginas públicas

Antes de campaña fuerte:

- [ ] Home indexable.
- [ ] Página de producto indexable solo si producto activo/válido.
- [ ] Perfil público indexable solo si tiene productos públicos.
- [ ] Rutas privadas con `noindex,nofollow,noarchive`.
- [ ] `robots.txt` correcto.
- [ ] Sitemap enviado en Google Search Console.
- [ ] OG image correcta al compartir en WhatsApp/Facebook.
- [ ] Favicon correcto.

---

## 7. Legal y confianza

Para soft launch puede bastar con textos básicos visibles. Para campaña grande, revisar definitivo:

- [ ] Aviso legal del titular del servicio.
- [ ] Política de privacidad con proveedores reales: Supabase, Stripe, Sendcloud, Vercel y analítica si se activa.
- [ ] Condiciones de uso.
- [ ] Condiciones de pago.
- [ ] Condiciones de envío.
- [ ] Política de reembolso/cancelación.
- [ ] Política de disputas.
- [ ] Productos prohibidos.
- [ ] Política de cookies si se usa analítica o marketing.
- [ ] Enlaces visibles en footer.

---

## 8. Plan de lanzamiento recomendado

### Fase 1 — Soft launch controlado

Permitido cuando estén hechos:

```text
- Vercel o Frontend Build Check en verde.
- Edge Functions en verde.
- Migraciones aplicadas.
- Registro/login probado.
- Publicar producto probado.
- Pago en persona probado.
```

En esta fase puedes invitar amigos, conocidos y vendedores cercanos.

### Fase 2 — Pagos y envíos reales

Activar cuando estén hechos:

```text
- Stripe webhook probado con compra real/test.
- Sendcloud probado.
- Incidencias probadas.
- Admin probado.
```

### Fase 3 — Campaña grande

Activar cuando estén hechos:

```text
- Legal revisado.
- SEO revisado.
- Google Search Console sin errores graves.
- Flujo completo comprador/vendedor probado varias veces.
- Plan de soporte preparado.
```

---

## 9. Checklist rápido desde móvil

Orden recomendado antes de anunciar:

```text
1. GitHub Actions → Apply Supabase DB Migrations → apply / APPLY_MIGRATIONS.
2. GitHub Actions → Deploy Supabase Edge Functions → verde.
3. GitHub Actions → Frontend Build Check → verde.
4. Vercel → último deploy success.
5. Supabase → revisar tabla transactions tras una prueba.
6. Stripe → webhook con respuesta 200.
7. Sendcloud → envío creado sin duplicar.
8. Reveta.es → probar registro, publicar, comprar, incidencia.
```

Si los 8 puntos pasan, Reveta está lista para abrir públicamente con mucha más seguridad.
