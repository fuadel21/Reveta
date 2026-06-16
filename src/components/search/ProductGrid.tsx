import { useNavigate } from 'react-router-dom';
import ProductCard from '@/components/ProductCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

const isFeaturedProduct = (boostedUntil?: string | null) => {
  return !!boostedUntil && new Date(boostedUntil).getTime() > Date.now();
};

const createProductSlug = (title: string) => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';
};

export const ProductGrid = ({
  products,
  favorites,
  useGeoFilter,
  formatDistance,
  formatDate,
  selectedProductId,
  onProductHover,
  compact = false,
  className,
}: ProductGridProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleProductClick = (product: Product) => {
    void (supabase as any).from('product_clicks').insert({
      product_id: product.id,
      user_id: user?.id || null,
      source: 'product_grid',
    });

    navigate(`/producto/${product.id}/${createProductSlug(product.title)}`);
  };

  return (
    <div
      className={cn(
        'grid gap-4',
        compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {products.map((product, index) => (
        <div
          key={product.id}
          onClick={() => handleProductClick(product)}
          onMouseEnter={() => onProductHover?.(product.id)}
          onMouseLeave={() => onProductHover?.(null)}
          className={cn(
            'cursor-pointer transition-all duration-300',
            'animate-fade-in-up',
            selectedProductId === product.id && 'ring-2 ring-primary rounded-xl',
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <ProductCard
            id={product.id}
            title={product.title}
            price={product.price}
            image={product.images?.[0] || '/placeholder.svg'}
            location={
              useGeoFilter && product.distance_km !== undefined
                ? `${formatDistance(product.distance_km)} · ${product.location || ''}`.replace(/ · $/, '')
                : product.location || 'Sin ubicación'
            }
            time={formatDate(product.created_at)}
            isNew={product.condition === 'Nuevo'}
            isFavorite={favorites.has(product.id)}
            isFeatured={isFeaturedProduct(product.boosted_until)}
          />
        </div>
      ))}
    </div>
  );
};