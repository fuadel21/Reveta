import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import SellerRating from '@/components/SellerRating';
import VerifiedBadge from '@/components/VerifiedBadge';
import FollowSellerButton from '@/components/seller/FollowSellerButton';
import SocialShareButtons from '@/components/SocialShareButtons';
import RecentReviews from '@/components/reviews/RecentReviews';
import TrustSafetyActions from '@/components/safety/TrustSafetyActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CalendarDays, CheckCircle2, MessageCircle, Package, ShieldCheck, ShoppingBag, Star, Store, Users } from 'lucide-react';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  verified: boolean | null;
}

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  location: string | null;
  condition: string | null;
  status: string | null;
  views: number | null;
  created_at: string;
}

const createProductSlug = (title: string) =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

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

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const absoluteUrl = (url?: string | null) => {
  if (!url) return 'https://reveta.es/og-image.svg?v=20260710';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://reveta.es${url.startsWith('/') ? url : `/${url}`}`;
};

const PublicSellerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [soldCount, setSoldCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    fetchSellerProfile();
  }, [id]);

  const fetchSellerProfile = async () => {
    if (!id) return;
    setLoading(true);

    const identifier = decodeURIComponent(id).trim().toLowerCase();
    const profileQuery = supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url,created_at,verified');

    const { data: profileData, error: profileError } = isUuid(identifier)
      ? await profileQuery.eq('id', identifier).maybeSingle()
      : await profileQuery.eq('username', identifier).maybeSingle();

    if (profileError || !profileData) {
      navigate('/');
      return;
    }

    setSeller(profileData);

    const { data: activeProducts } = await supabase
      .from('products')
      .select('id,title,price,images,location,condition,status,views,created_at')
      .eq('user_id', profileData.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    const { count: soldProductsCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileData.id)
      .eq('status', 'sold');

    setProducts((activeProducts || []) as Product[]);
    setSoldCount(soldProductsCount || 0);
    setLoading(false);
  };

  const updateFollowersCount = (value: number) => {
    setFollowersCount((previous) => (value < 0 ? Math.max(0, previous + value) : value === 1 ? previous + 1 : value));
  };

  const sortedProducts = useMemo(() => {
    const items = [...products];
    switch (sortBy) {
      case 'views':
        return items.sort((a, b) => (b.views || 0) - (a.views || 0));
      case 'price_asc':
        return items.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return items.sort((a, b) => b.price - a.price);
      default:
        return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [products, sortBy]);

  const totalViews = products.reduce((sum, item) => sum + (item.views || 0), 0);
  const displayName = seller?.full_name || seller?.username || 'Vendedor de Reveta';
  const profilePath = seller?.username || seller?.id || '';
  const profileUrl = `https://reveta.es/usuario/${profilePath}`;
  const socialImage = absoluteUrl(seller?.avatar_url);
  const pageTitle = `${displayName} | Vendedor en Reveta`;
  const pageDescription = `Perfil de ${displayName} en Reveta: ${products.length} anuncios activos, ${soldCount} productos vendidos, valoraciones y señales de confianza para comprar segunda mano.`;
  const shouldIndexProfile = products.length > 0;

  const personJsonLd = seller
    ? {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: displayName,
        url: profileUrl,
        image: socialImage,
        identifier: seller.id,
        memberOf: {
          '@type': 'Organization',
          name: 'Reveta',
          url: 'https://reveta.es/',
        },
        ...(seller.username && { alternateName: `@${seller.username}` }),
      }
    : null;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Reveta',
        item: 'https://reveta.es/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: displayName,
        item: profileUrl,
      },
    ],
  };

  const productItemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Anuncios activos de ${displayName} en Reveta`,
    itemListElement: sortedProducts.slice(0, 12).map((item, index) => {
      const productUrl = `https://reveta.es/producto/${item.id}/${createProductSlug(item.title)}`;
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: productUrl,
        item: {
          '@type': 'Product',
          name: item.title,
          url: productUrl,
          image: absoluteUrl(item.images?.[0]),
          offers: {
            '@type': 'Offer',
            price: item.price,
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
          },
        },
      };
    }),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!seller) return null;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content={shouldIndexProfile ? 'index,follow,max-image-preview:large' : 'noindex,follow'} />
        <link rel="canonical" href={profileUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={profileUrl} />
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content="Reveta" />
        <meta property="og:locale" content="es_ES" />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:secure_url" content={socialImage} />
        <meta property="og:image:alt" content={displayName} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={socialImage} />
        {personJsonLd && <script type="application/ld+json">{JSON.stringify(personJsonLd)}</script>}
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        {sortedProducts.length > 0 && <script type="application/ld+json">{JSON.stringify(productItemListJsonLd)}</script>}
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5">
                <div className="h-24 w-24 overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground">
                  {seller.avatar_url ? <img src={seller.avatar_url} alt={displayName} className="h-full w-full object-cover" /> : displayName[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold">{displayName}</h1>
                    {seller.verified ? <VerifiedBadge /> : <Badge variant="outline">Sin verificar</Badge>}
                  </div>
                  {seller.username && <p className="mb-2 text-sm text-muted-foreground">@{seller.username}</p>}
                  <SellerRating sellerId={seller.id} size="md" />
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" /> Miembro desde {formatDate(seller.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
                <FollowSellerButton sellerId={seller.id} onFollowersChange={updateFollowersCount} />
                <SocialShareButtons url={profileUrl} title={`Descubre los productos de ${displayName} en Reveta`} description={`Perfil con ${products.length} anuncios activos en Reveta.`} compact />
                <Button asChild variant="outline">
                  <Link to={`/search?seller=${seller.id}`}>
                    <Store className="mr-2 h-4 w-4" /> Ver todos sus anuncios
                  </Link>
                </Button>
                <TrustSafetyActions targetUserId={seller.id} targetName={displayName} />
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-5">
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Package className="h-4 w-4" /> Anuncios activos</p>
              </div>
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-2xl font-bold">{soldCount}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><ShoppingBag className="h-4 w-4" /> Vendidos</p>
              </div>
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-2xl font-bold">{followersCount}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Seguidores</p>
              </div>
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-2xl font-bold">{totalViews}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Star className="h-4 w-4" /> Visitas</p>
              </div>
              <div className="rounded-2xl border border-border/60 p-4">
                <p className="text-2xl font-bold">{seller.verified ? 'Sí' : 'Pendiente'}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Verificación</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-primary/5 border border-primary/10 p-4">
              <h2 className="mb-3 font-semibold">Señales de confianza</h2>
              <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Valoraciones visibles del vendedor</div>
                <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Chat seguro dentro de Reveta</div>
                <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Compra protegida en productos activos</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Cómo comprar con confianza</h2>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Revisa valoraciones, antigüedad, productos vendidos y anuncios activos.</div>
                  <div className="flex gap-2"><MessageCircle className="h-4 w-4 shrink-0 text-primary" /> Pregunta por fotos reales, estado, accesorios y forma de entrega.</div>
                  <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Mantén acuerdos y pagos dentro de Reveta siempre que sea posible.</div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <h2 className="font-semibold">Señales de alerta</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <p>Desconfía si el vendedor pide pago externo, envía enlaces raros, evita responder preguntas o presiona para cerrar rápido.</p>
                  <p>Si algo no cuadra, usa el chat de Reveta, guarda pruebas y reporta el producto o usuario.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <RecentReviews userId={seller.id} />
          </section>

          <section className="mt-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Anuncios activos</h2>
                <p className="text-sm text-muted-foreground">Productos publicados actualmente por este vendedor.</p>
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Más recientes</SelectItem>
                  <SelectItem value="views">Más vistos</SelectItem>
                  <SelectItem value="price_asc">Precio ascendente</SelectItem>
                  <SelectItem value="price_desc">Precio descendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sortedProducts.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-muted-foreground">
                Este vendedor no tiene anuncios activos ahora mismo.
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {sortedProducts.map((item) => (
                  <Link key={item.id} to={`/producto/${item.id}/${createProductSlug(item.title)}`}>
                    <ProductCard
                      id={item.id}
                      title={item.title}
                      price={item.price}
                      image={item.images?.[0] || '/placeholder.svg'}
                      location={item.location || 'Sin ubicación'}
                      time={getRelativeTime(item.created_at)}
                      isNegotiable={item.condition !== 'new'}
                    />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default PublicSellerProfile;
