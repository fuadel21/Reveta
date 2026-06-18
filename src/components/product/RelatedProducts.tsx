import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';

interface RelatedProduct {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  location: string | null;
  condition: string | null;
  created_at: string;
  category_id: string | null;
}

interface RelatedProductsProps {
  currentProductId: string;
  categoryId?: string | null;
  location?: string | null;
}

const createProductSlug = (title: string) => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';
};

const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `${diffDays} días`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const RelatedProducts = ({ currentProductId, categoryId, location }: RelatedProductsProps) => {
  const [products, setProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelatedProducts = async () => {
      setLoading(true);

      let query = supabase
        .from('products')
        .select('id,title,price,images,location,condition,created_at,category_id')
        .neq('id', currentProductId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(8);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Related products not loaded:', error.message);
        setProducts([]);
        setLoading(false);
        return;
      }

      const sameLocationFirst = [...(data || [])].sort((a, b) => {
        const aLocal = location && a.location?.toLowerCase().includes(location.toLowerCase()) ? 1 : 0;
        const bLocal = location && b.location?.toLowerCase().includes(location.toLowerCase()) ? 1 : 0;
        return bLocal - aLocal;
      });

      setProducts(sameLocationFirst);
      setLoading(false);
    };

    fetchRelatedProducts();
  }, [currentProductId, categoryId, location]);

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Productos similares</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Productos similares</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Más anuncios relacionados que pueden interesarte.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={categoryId ? `/search?category=${categoryId}` : '/search'}>Ver más productos</Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((item) => (
          <Link key={item.id} to={`/producto/${item.id}/${createProductSlug(item.title)}`} className="block">
            <ProductCard
              id={item.id}
              title={item.title}
              price={item.price}
              image={item.images?.[0] || '/placeholder.svg'}
              location={item.location || 'Sin ubicación'}
              time={getRelativeTime(item.created_at)}
              isNegotiable={item.condition !== 'Nuevo'}
            />
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RelatedProducts;
