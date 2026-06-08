import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ProductCard from './ProductCard';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  location: string | null;
  created_at: string;
  condition: string | null;
}

interface Favorite {
  product_id: string;
}

const FeaturedProducts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const fetchFavorites = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('favorites')
      .select('product_id')
      .eq('user_id', user.id);

    if (data) {
      setFavorites(new Set(data.map((f: Favorite) => f.product_id)));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      return diffHours === 0 ? 'Hace unos min' : `Hace ${diffHours}h`;
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return `Hace ${diffDays}d`;
    } else {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  };

  if (loading) {
    return (
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">Productos destacados</h2>
              <p className="mt-1 text-muted-foreground">Las mejores ofertas cerca de ti</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Aún no hay productos</h2>
            <p className="text-muted-foreground mb-6">
              Sé el primero en publicar algo
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-muted/50 to-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-3xl pointer-events-none" />
      
      <div className="container relative">
        <div className="flex items-center justify-between mb-10">
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">Productos destacados</h2>
            <p className="mt-2 text-muted-foreground">Las mejores ofertas cerca de ti</p>
          </div>
          <button 
            onClick={() => navigate('/search')}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group animate-fade-in"
          >
            Ver más
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="animate-fade-in-up cursor-pointer"
              style={{ animationDelay: `${index * 0.08}s` }}
              onClick={() => navigate(`/product/${product.id}`)}
            >
              <ProductCard
                id={product.id}
                title={product.title}
                price={product.price}
                image={product.images?.[0] || '/placeholder.svg'}
                location={product.location || 'Sin ubicación'}
                time={formatDate(product.created_at)}
                isNew={product.condition === 'Nuevo'}
                isFavorite={favorites.has(product.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
