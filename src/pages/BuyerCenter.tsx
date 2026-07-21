import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Bookmark, Clock3, Heart, Loader2, Search, ShoppingBag, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const RECENT_KEY = 'reveta_recent_products_v1';

type Product = {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  location: string | null;
  created_at: string;
  status: string | null;
  condition: string | null;
  category_id: string | null;
  boosted_until?: string | null;
};

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'producto';
const formatDate = (value: string) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const productPath = (product: Product) => `/producto/${product.id}/${slugify(product.title)}`;

const BuyerCenter = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) void loadBuyerData();
  }, [user?.id]);

  const loadBuyerData = async () => {
    if (!user) return;
    setLoading(true);

    const storedRecentIds = (() => {
      try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, 12) : [];
      } catch {
        return [];
      }
    })();

    const favoritesResult = await (supabase as any)
      .from('favorites')
      .select('products(id,title,price,images,location,created_at,status,condition,category_id,boosted_until)')
      .eq('user_id', user.id);

    const favoriteProducts = (favoritesResult.data || []).map((row: any) => row.products).filter(Boolean) as Product[];
    setFavorites(favoriteProducts);

    let recentProducts: Product[] = [];
    if (storedRecentIds.length > 0) {
      const recentResult = await supabase
        .from('products')
        .select('id,title,price,images,location,created_at,status,condition,category_id,boosted_until')
        .in('id', storedRecentIds);
      const byId = new Map(((recentResult.data || []) as Product[]).map((product) => [product.id, product]));
      recentProducts = storedRecentIds.map((id) => byId.get(id)).filter(Boolean) as Product[];
    }
    setRecent(recentProducts);

    const excludedIds = Array.from(new Set([...favoriteProducts, ...recentProducts].map((product) => product.id)));
    const categoryIds = Array.from(new Set([...favoriteProducts, ...recentProducts].map((product) => product.category_id).filter(Boolean))) as string[];

    let recommendationQuery = supabase
      .from('products')
      .select('id,title,price,images,location,created_at,status,condition,category_id,boosted_until')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(12);

    if (categoryIds.length > 0) recommendationQuery = recommendationQuery.in('category_id', categoryIds);
    if (excludedIds.length > 0) recommendationQuery = recommendationQuery.not('id', 'in', `(${excludedIds.join(',')})`);

    let recommendationResult = await recommendationQuery;
    if (recommendationResult.error && categoryIds.length > 0) {
      recommendationResult = await supabase
        .from('products')
        .select('id,title,price,images,location,created_at,status,condition,category_id,boosted_until')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12);
    }

    setRecommendations((recommendationResult.data || []) as Product[]);
    setLoading(false);
  };

  const activeFavorites = useMemo(() => favorites.filter((product) => product.status === 'active'), [favorites]);
  const unavailableFavorites = favorites.length - activeFavorites.length;

  const ProductRow = ({ products, emptyText }: { products: Product[]; emptyText: string }) => products.length === 0 ? (
    <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{emptyText}</div>
  ) : (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <Link key={product.id} to={productPath(product)} className="block transition hover:-translate-y-1">
          <ProductCard
            id={product.id}
            title={product.title}
            price={product.price}
            image={product.images?.[0] || '/placeholder.svg'}
            location={product.location || 'Sin ubicación'}
            time={formatDate(product.created_at)}
            isNew={product.condition === 'Nuevo'}
            isFavorite={favorites.some((favorite) => favorite.id === product.id)}
            isFeatured={!!product.boosted_until && new Date(product.boosted_until).getTime() > Date.now()}
          />
        </Link>
      ))}
    </div>
  );

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Mi centro de compras | Reveta</title></Helmet>
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><Badge variant="secondary" className="mb-3"><ShoppingBag className="mr-1 h-3.5 w-3.5" />Centro del comprador</Badge><h1 className="text-3xl font-bold">Retoma lo que estabas buscando</h1><p className="mt-2 text-muted-foreground">Favoritos, anuncios vistos y recomendaciones reunidos en un solo sitio.</p></div>
          <Button asChild><Link to="/search"><Search className="mr-2 h-4 w-4" />Buscar productos</Link></Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeFavorites.length}</CardTitle><CardDescription className="flex items-center gap-2"><Heart className="h-4 w-4" />Favoritos disponibles</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{recent.length}</CardTitle><CardDescription className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Vistos recientemente</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{unavailableFavorites}</CardTitle><CardDescription className="flex items-center gap-2"><Bookmark className="h-4 w-4" />Ya no disponibles</CardDescription></CardHeader></Card>
        </div>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-destructive" />Tus favoritos activos</CardTitle><CardDescription>Los anuncios que todavía puedes comprar o consultar.</CardDescription></CardHeader><CardContent><ProductRow products={activeFavorites.slice(0, 8)} emptyText="Todavía no tienes favoritos disponibles." /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" />Vistos recientemente</CardTitle><CardDescription>Continúa donde lo dejaste, sin volver a buscar desde cero.</CardDescription></CardHeader><CardContent><ProductRow products={recent.slice(0, 8)} emptyText="Los productos que abras desde los resultados aparecerán aquí." /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Recomendados para ti</CardTitle><CardDescription>Productos activos relacionados con las categorías que te interesan.</CardDescription></CardHeader><CardContent><ProductRow products={recommendations.slice(0, 8)} emptyText="No hay recomendaciones disponibles ahora mismo." /></CardContent></Card>
      </main>
      <Footer />
    </div>
  );
};

export default BuyerCenter;
