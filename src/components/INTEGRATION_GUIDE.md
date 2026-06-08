# Guía de Integración - 5 Mejoras Estratégicas de Reveta

Este documento explica cómo integrar los 5 componentes nuevos en tu aplicación React.

## 📋 Componentes Creados

1. **Chat.tsx** - Sistema de mensajería en tiempo real
2. **Reviews.tsx** - Sistema de valoraciones y comentarios
3. **ProfileBadge.tsx** - Insignias de verificación y destacados
4. **ShippingInfo.tsx** - Información de envío y logística
5. **FeaturedProducts.tsx** - Productos destacados
6. **useFeaturedProducts.ts** - Hook para gestionar destacados

---

## 🚀 Paso 1: Copiar los Archivos

Copia todos los archivos `.tsx` y `.ts` a tu carpeta `src/components/`:

```
src/components/
├── Chat.tsx
├── Reviews.tsx
├── ProfileBadge.tsx
├── ShippingInfo.tsx
├── FeaturedProducts.tsx
└── useFeaturedProducts.ts
```

---

## 💬 Paso 2: Integrar el Chat en ProductDetail.tsx

En tu página `src/pages/ProductDetail.tsx`, añade el Chat:

```tsx
import { Chat } from '../components/Chat';
import { useState } from 'react';

export const ProductDetail = () => {
  const [showChat, setShowChat] = useState(false);

  return (
    <div>
      {/* Contenido existente del producto */}

      {/* Botón para abrir chat */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
      >
        💬 Contactar Vendedor
      </button>

      {/* Modal o panel del Chat */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl h-96">
            <Chat
              productId={productId}
              sellerId={sellerId}
              onClose={() => setShowChat(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## ⭐ Paso 3: Integrar Valoraciones en ProductDetail.tsx

```tsx
import { Reviews } from '../components/Reviews';

export const ProductDetail = () => {
  return (
    <div>
      {/* Contenido del producto */}

      {/* Sección de valoraciones */}
      <div className="mt-8">
        <Reviews
          userId={product.seller_id}
          productId={productId}
          onReviewSubmitted={() => {
            // Refrescar datos si es necesario
          }}
        />
      </div>
    </div>
  );
};
```

---

## 🛡️ Paso 4: Integrar Insignias de Verificación en Perfiles

En tu componente de perfil (`src/pages/Profile.tsx` o similar):

```tsx
import { ProfileBadge } from '../components/ProfileBadge';

export const SellerProfile = ({ seller }) => {
  return (
    <div>
      <h2>{seller.full_name}</h2>

      {/* Mostrar insignias */}
      <ProfileBadge
        isVerified={seller.is_verified}
        isFeatured={seller.is_premium}
        isPremium={seller.is_premium}
      />
    </div>
  );
};
```

Para productos destacados:

```tsx
import { ProductBadge } from '../components/ProfileBadge';

export const ProductCard = ({ product }) => {
  return (
    <div>
      <ProductBadge
        isFeatured={product.is_featured}
        isNew={isNewProduct(product.created_at)}
        discount={product.discount_percentage}
      />
      {/* Resto del card */}
    </div>
  );
};
```

---

## 📦 Paso 5: Integrar Información de Envío en Checkout

En tu página `src/pages/Checkout.tsx`:

```tsx
import { ShippingInfo } from '../components/ShippingInfo';

export const Checkout = ({ product }) => {
  const [selectedShipping, setSelectedShipping] = useState(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        {/* Formulario de pago existente */}

        {/* Información de envío */}
        <ShippingInfo
          productId={product.id}
          productPrice={product.price}
          sellerLocation={product.seller?.location || 'Madrid'}
          shippingInfo={product.shipping_info}
          onSelectShipping={setSelectedShipping}
        />
      </div>

      <div>
        {/* Resumen de orden */}
        <div className="bg-gray-100 p-6 rounded-lg">
          <h3 className="font-bold mb-4">Resumen de Orden</h3>
          <p>Producto: €{product.price.toFixed(2)}</p>
          <p>Envío: €{selectedShipping?.price.toFixed(2) || '0.00'}</p>
          <p className="text-lg font-bold mt-4">
            Total: €
            {(
              product.price + (selectedShipping?.price || 0)
            ).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};
```

---

## 🔥 Paso 6: Integrar Productos Destacados en Home

En tu página `src/pages/Home.tsx`:

```tsx
import { FeaturedProducts } from '../components/FeaturedProducts';

export const Home = () => {
  return (
    <div className="space-y-12">
      {/* Sección Hero */}
      <Hero />

      {/* Productos Destacados */}
      <section className="container mx-auto px-4">
        <FeaturedProducts limit={6} showViewAll={true} />
      </section>

      {/* Otras secciones */}
    </div>
  );
};
```

---

## 🎯 Paso 7: Usar el Hook useFeaturedProducts (Admin)

Para que los vendedores puedan destacar sus productos:

```tsx
import { useFeaturedProducts } from '../components/useFeaturedProducts';

export const ProductActions = ({ productId, isFeatured }) => {
  const { makeFeatured, removeFeatured, loading } = useFeaturedProducts();

  const handleToggleFeatured = async () => {
    try {
      if (isFeatured) {
        await removeFeatured(productId);
      } else {
        // Destacar por 7 días (puedes cambiar este número)
        await makeFeatured(productId, 7);
      }
      // Refrescar datos
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <button
      onClick={handleToggleFeatured}
      disabled={loading}
      className="bg-yellow-400 text-white px-4 py-2 rounded-lg"
    >
      {isFeatured ? '⭐ Remover Destacado' : '⭐ Destacar Producto'}
    </button>
  );
};
```

---

## 📱 Paso 8: Actualizar package.json

Asegúrate de que tienes estas dependencias en `package.json`:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.x.x",
    "@supabase/supabase-js": "^2.x.x",
    "lucide-react": "^0.x.x"
  }
}
```

Si no tienes `lucide-react`, instálalo:

```bash
npm install lucide-react
```

---

## 🔐 Paso 9: Verificar Políticas de Seguridad en Supabase

Asegúrate de que las políticas RLS estén habilitadas en Supabase:

```sql
-- Ya deberían estar creadas del SQL anterior, pero verifica:
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
```

---

## ✅ Checklist de Integración

- [ ] Copiar todos los archivos `.tsx` y `.ts` a `src/components/`
- [ ] Importar Chat en ProductDetail.tsx
- [ ] Importar Reviews en ProductDetail.tsx
- [ ] Importar ProfileBadge en componentes de perfil
- [ ] Importar ShippingInfo en Checkout.tsx
- [ ] Importar FeaturedProducts en Home.tsx
- [ ] Instalar `lucide-react` si no está instalado
- [ ] Verificar que Supabase tiene las tablas y políticas RLS
- [ ] Probar cada componente en desarrollo
- [ ] Hacer commit a GitHub

---

## 🐛 Troubleshooting

### Error: "Cannot find module '@supabase/supabase-js'"

```bash
npm install @supabase/supabase-js
```

### Error: "lucide-react not found"

```bash
npm install lucide-react
```

### El Chat no muestra mensajes

1. Verifica que `supabase_realtime` esté habilitado en Supabase
2. Comprueba que las políticas RLS están correctas
3. Abre la consola del navegador (F12) y busca errores

### Las valoraciones no se guardan

1. Verifica que la tabla `reviews` existe en Supabase
2. Comprueba que el usuario está autenticado
3. Revisa los logs de Supabase

---

## 📞 Soporte

Si tienes problemas, revisa:

1. Los logs de la consola del navegador (F12)
2. Los logs de Supabase (Dashboard > Logs)
3. Verifica que todas las tablas existen: `conversations`, `messages`, `reviews`

---

## 🎉 ¡Listo!

Una vez integrados todos los componentes, tu plataforma Reveta tendrá:

✅ Chat en tiempo real
✅ Sistema de valoraciones
✅ Verificación de usuarios
✅ Información de envío
✅ Productos destacados

¡Ahora es hora de arreglar los errores de Vercel y desplegar! 🚀
