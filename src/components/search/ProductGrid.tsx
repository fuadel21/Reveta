import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { COMPARISON_EVENT, getComparedProductIds, toggleComparedProduct } from '@/lib/productComparison';
import { toast } from 'sonner';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  location: string | null;
  created_at: string;
  condition: string | null;
  distance_km?: number;
  boosted_until?: string | null;
}

interface ProductGridProps {
  products: Product[];
  favorites: Set<string>;
  useGeoFilter: boolean;
  formatDistance: (km: number | undefined) => string;
  formatDate: (dateString: string) => string;
  selectedProductId?: string | null;
  onProductHover?: (productId: string | null) => void;
  compact?: boolean;
  className?: string;
}

const RECENT_KEY = 'reveta_recent_products_v1';
const isFeaturedProduct = (boostedUntil?: string | null) => !!boostedUntil && new Date(boostedUntil).getTime() > Date.now();
const createProductSlug = (title: string) => title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'producto';

const rememberRecentlyViewed = (productId: string) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const current = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    localStorage.setItem(RECENT_KEY, JSON.stringify([productId, ...current.filter((id) => id !== productId)].slice(0, 20)));
  } catch {
    localStorage.setItem(RECENT_KEY, JSON.stringify([productId]));
  }
};

export const ProductGrid = ({ products, favorites, useGeoFilter, formatDistance, formatDate, selectedProductId, onProductHover, compact = false, className }: ProductGridProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comparedIds, setComparedIds] = useState<string[]>(() => getComparedProductIds());

  useEffect(() => {
    const sync = () => setComparedIds(getComparedProductIds());
    window.addEventListener(COMPARISON_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(COMPARISON_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const handleProductClick = (product: Product) => {
    rememberRecentlyViewed(product.id);
    void supabaseUntyped.from('product_clicks').insert({ product_id: product.id, user_id: user?.id || null, source: 'product_grid' });
    navigate(`/producto/${product.id}/${createProductSlug(product.title)}`);
  };

  const handleProductKeyDown = (event: React.KeyboardEvent, product: Product) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleProductClick(product);
  };

  const handleCompare = (event: React.MouseEvent, productId: string) => {
    event.stopPropagation();
    const result = toggleComparedProduct(productId);
    setComparedIds(result.ids);
    if (result.limitReached) toast.error('Puedes comparar hasta 4 productos');
    else toast.success(result.added ? 'Producto añadido al comparador' : 'Producto retirado del comparador');
  };

  return <>
    <div className={cn('grid gap-4', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4', className)}>
      {products.map((product, index) => {
        const isCompared = comparedIds.includes(product.id);
        const productLabel = `Ver ${product.title}, ${product.price.toLocaleString('es-ES')} €`;
        return <div
          key={product.id}
          role="link"
          tabIndex={0}
          aria-label={productLabel}
          onClick={() => handleProductClick(product)}
          onKeyDown={(event) => handleProductKeyDown(event, product)}
          onMouseEnter={() => onProductHover?.(product.id)}
          onMouseLeave={() => onProductHover?.(null)}
          className={cn('relative cursor-pointer rounded-xl transition-all duration-300 animate-fade-in-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2', selectedProductId === product.id && 'ring-2 ring-primary')}
          style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
        >
          <button onClick={(event) => handleCompare(event, product.id)} className={cn('absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium shadow backdrop-blur', isCompared ? 'bg-primary text-primary-foreground' : 'bg-background/90 text-foreground')} aria-label={isCompared ? `Quitar ${product.title} del comparador` : `Añadir ${product.title} al comparador`}>
            <Scale className="h-3.5 w-3.5" /><span className="hidden sm:inline">{isCompared ? 'Añadido' : 'Comparar'}</span>
          </button>
          <ProductCard
            id={product.id}
            title={product.title}
            price={product.price}
            image={product.images?.[0] || '/placeholder.svg'}
            location={useGeoFilter && product.distance_km !== undefined ? `${formatDistance(product.distance_km)} · ${product.location || ''}`.replace(/ · $/, '') : product.location || 'Sin ubicación'}
            time={formatDate(product.created_at)}
            isNew={product.condition === 'Nuevo'}
            isFavorite={favorites.has(product.id)}
            isFeatured={isFeaturedProduct(product.boosted_until)}
            imagePriority={!compact && index < 2}
          />
        </div>;
      })}
    </div>
    {comparedIds.length > 0 && <div className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-background/95 px-4 py-3 shadow-xl backdrop-blur md:bottom-6">
      <div className="text-sm"><strong>{comparedIds.length}</strong> de 4 seleccionados</div>
      <Button size="sm" asChild><Link to="/comparar"><Scale className="mr-2 h-4 w-4" />Comparar ahora</Link></Button>
    </div>}
  </>;
};
