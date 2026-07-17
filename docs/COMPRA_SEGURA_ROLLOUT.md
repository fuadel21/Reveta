# Reveta Compra Segura - rollout

## Objetivo

Convertir Reveta en una plataforma de segunda mano que compita por confianza, no solo por catálogo.

El mensaje principal para el comprador debe ser:

```text
Compra con más seguridad: pago protegido, chat privado, llamada privada, envío con seguimiento e incidencias Reveta.
```

## Implementado

- Tarjeta `ProductBuyerConfidence` reforzada como **Reveta Compra Segura**.
- Tarjeta `SellerTrustCard` reforzada como **Vendedor verificado / vendedor recomendado / vendedor fiable**.
- Componente `CheckoutTrustCard` creado para mostrar confianza justo antes de pagar.

## Señales visibles de confianza

- Pago protegido.
- Envío con seguimiento.
- Chat privado.
- Llamada privada.
- Incidencias Reveta.
- Vendedor valorado.
- Alerta antifraude.
- Reputación del vendedor.
- Verificación del vendedor.
- Historial de ventas y anuncios activos.

## Pendiente próximo bloque

- Integrar `CheckoutTrustCard` en `src/pages/Checkout.tsx`.
- Probar ficha de producto en móvil.
- Probar checkout en móvil.
- Revisar que los textos de “compra segura” no prometen más de lo que Reveta cubre realmente.

## Prueba visual rápida

1. Abrir un producto activo.
2. Confirmar que aparece la tarjeta **Reveta Compra Segura**.
3. Confirmar que aparece la tarjeta del vendedor con reputación.
4. Abrir checkout.
5. Confirmar, tras la integración pendiente, que aparece una tarjeta de confianza antes del botón de pago.

## Siguiente mejora competitiva recomendada

Después de cerrar esta integración:

```text
Reservar 24h + alerta de bajada de precio + vendedor top local
```
