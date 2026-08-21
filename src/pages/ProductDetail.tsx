import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Heart, MapPin, Clock, MessageCircle, Phone, ChevronLeft, ChevronRight, Shield, Eye } from 'lucide-react';
import { Reviews } from '@/components/Reviews';
import ProductStatusBadge from '@/components/ProductStatusBadge';
import SocialShareButtons from '@/components/SocialShareButtons';
import ProductBuyerConfidence from '@/components/product/ProductBuyerConfidence';
import PurchaseDecisionGuide from '@/components/product/PurchaseDecisionGuide';
import RelatedProducts from '@/components/product/RelatedProducts';
import SellerTrustCard from '@/components/product/SellerTrustCard';
import ReportProductButton from '@/components/product/ReportProductButton';
import { Chat } from '@/components/Chat';

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  images: string[] | null;
  location: string | null;
  condition: string | null;
  status: string | null;
  views: number | null;
  created_at: string;
  user_id: string;
  category_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  verified: boolean | null;
}

interface Category {
  id: string;
  name: string;
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

const absoluteUrl = (url?: string | null) => {
  if (!url) return 'https://reveta.es/og-image.svg?v=20260710';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://reveta.es${url.startsWith('/') ? url : `/${url}`}`;
};

const schemaAvailability = (status?: string | null) => {
  if (status === 'sold' || status === 'completed') return 'https://schema.org/SoldOut';
  if (status === 'reserved' || status === 'pending') return 'https://schema.org/LimitedAvailability';
  if (status === 'inactive' || status === 'cancelled') return 'https://schema.org/OutOfStock';
  return 'https://schema.org/InStock';
};

const schemaCondition = (condition?: string | null) => {
  const normalized = (condition || '').toLowerCase();
  if (normalized.includes('nuevo') || normalized.includes('new')) return 'https://schema.org/NewCondition';
  if (normalized.includes('reacondicionado') || normalized.includes('refurbished')) return 'https://schema.org/RefurbishedCondition';
  if (normalized.includes('dañado') || normalized.includes('defecto') || normalized.includes('for parts')) return 'https://schema.org/DamagedCondition';
  return 'https://schema.org/UsedCondition';
};

const conversationSelect = 'id, product_id, buyer_id, seller_id, updated_at';
const productSelect = 'id, title, description, price, images, location, condition, status, views, created_at, user_id, category_id';

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [sellerActiveProductsCount, setSellerActiveProductsCount] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [requestingCall, setRequestingCall] = useState(false);

  useEffect(() => {
    if (id) fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (product && user) checkFavorite();
    else setIsFavorite(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, user?.id]);

  useEffect(() => {
    if (!product) return;
    const canonicalPath = `/producto/${product.id}/${createProductSlug(product.title)}`;
    if (location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true });
  }, [product, location.pathname, navigate]);

  const fetchProduct = async () => {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase.from('products').select(productSelect).eq('id', id).maybeSingle();

    if (error || !data) {
      console.error('Error fetching product:', error);
      navigate('/');
      return;
    }

    setProduct(data as Product);
    setCurrentImageIndex(0);

    await supabase.from('products').update({ views: (data.views || 0) + 1 }).eq('id', id);

    const { data: sellerData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at, verified')
      .eq('id', data.user_id)
      .maybeSingle();
    if (sellerData) setSeller(sellerData);

    const { count: activeCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', data.user_id)
      .eq('status', 'active');
    setSellerActiveProductsCount(activeCount || 0);

    if (data.category_id) {
      const { data: categoryData } = await supabase.from('categories').select('id, name').eq('id', data.category_id).maybeSingle();
      if (categoryData) setCategory(categoryData);
    } else {
      setCategory(null);
    }

    setLoading(false);
  };

  const checkFavorite = async () => {
    if (!user || !product) return;
    const { data } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('product_id', product.id).maybeSingle();
    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!product) return;

    if (product.user_id === user.id) {
      toast({ title: 'Es tu producto', description: 'No necesitas guardar tu propio anuncio en favoritos.' });
      return;
    }

    if (isFavorite) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', product.id);
      if (error) {
        toast({ title: 'Error', description: 'No se pudo eliminar de favoritos', variant: 'destructive' });
        return;
      }
      setIsFavorite(false);
      toast({ title: 'Eliminado de favoritos', description: 'El producto se ha eliminado de tus favoritos' });
    } else {
      const { error } = await supabaseUntyped.from('favorites').upsert({ user_id: user.id, product_id: product.id }, { onConflict: 'user_id,product_id' });
      if (error) {
        toast({ title: 'Error', description: 'No se pudo añadir a favoritos', variant: 'destructive' });
        return;
      }
      setIsFavorite(true);
      toast({ title: 'Añadido a favoritos', description: 'El producto se ha añadido a tus favoritos' });
    }
  };

  const handleContactSeller = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!product || product.status !== 'active') {
      toast({ title: 'Producto no disponible', description: 'Este producto ya no acepta nuevas conversaciones ni ofertas.', variant: 'destructive' });
      return;
    }
    if (product.user_id === user.id) {
      toast({ title: 'Es tu producto', description: 'No puedes abrir chat como comprador de tu propio anuncio.' });
      return;
    }
    setShowChat(true);
  };

  const getOrCreateConversation = async () => {
    if (!user || !product || !seller) return null;

    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select(conversationSelect)
      .eq('product_id', product.id)
      .eq('buyer_id', user.id)
      .eq('seller_id', seller.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
      .from('conversations')
      .insert({ product_id: product.id, buyer_id: user.id, seller_id: seller.id })
      .select(conversationSelect)
      .single();

    if (createError) throw createError;
    return created;
  };

  const handleRequestPrivateCall = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!product || !seller) return;
    if (product.status !== 'active') {
      toast({ title: 'Producto no disponible', description: 'No se pueden crear llamadas nuevas para productos no activos.', variant: 'destructive' });
      return;
    }
    if (product.user_id === user.id) {
      toast({ title: 'Es tu producto', description: 'No puedes solicitar una llamada privada sobre tu propio anuncio.' });
      return;
    }

    setRequestingCall(true);

    try {
      const conversation = await getOrCreateConversation();
      if (!conversation?.id) throw new Error('No se pudo crear la conversación');

      const { data: callSession, error: callError } = await supabase
        .from('call_sessions')
        .insert({ conversation_id: conversation.id, product_id: product.id, caller_id: user.id, callee_id: seller.id, status: 'requested' })
        .select('id')
        .single();

      if (callError || !callSession?.id) throw callError || new Error('No se pudo crear la sala de llamada');

      const callUrl = `${window.location.origin}/call/${callSession.id}`;
      const content = `📞 Solicitud de llamada privada\n\nHola, me interesa tu producto "${product.title}". Te envío una sala de llamada privada de Reveta. No compartiremos números de teléfono.\n\nEntrar en la llamada: ${callUrl}`;

      const { error: messageError } = await supabase.from('messages').insert({ conversation_id: conversation.id, sender_id: user.id, content });
      if (messageError) throw messageError;

      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation.id);

      toast({ title: 'Sala de llamada creada', description: 'Se ha enviado el enlace privado por el chat de Reveta.' });
      navigate(`/call/${callSession.id}`);
    } catch (error) {
      console.error('Error requesting private call:', error);
      toast({ title: 'No se pudo crear la llamada', description: 'Inténtalo de nuevo desde el chat.', variant: 'destructive' });
    } finally {
      setRequestingCall(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!product) return null;

  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const productImage = images[currentImageIndex] || images[0];
  const productImageUrl = absoluteUrl(productImage);
  const structuredImages = [...new Set(images.map((image) => absoluteUrl(image)))];
  const imageUrls = structuredImages.length > 0 ? structuredImages : [productImageUrl];
  const canonicalUrl = `https://reveta.es/producto/${product.id}/${createProductSlug(product.title)}`;
  const isProductAvailable = product.status === 'active';
  const isOwner = product.user_id === user?.id;
  const shouldIndexProduct = isProductAvailable;
  const metaDescription = (product.description || `${product.title} en venta en Reveta`).slice(0, 155);
  const imageAlt = `${product.title}${product.location ? ` en ${product.location}` : ''} - segunda mano en Reveta`;

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    sku: product.id,
    name: product.title,
    description: product.description || `${product.title} en venta en Reveta`,
    image: imageUrls,
    category: category?.name,
    itemCondition: schemaCondition(product.condition),
    url: canonicalUrl,
    brand: { '@type': 'Brand', name: 'Reveta' },
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'EUR',
      price: product.price.toFixed(2),
      availability: schemaAvailability(product.status),
      itemCondition: schemaCondition(product.condition),
      seller: { '@type': 'Person', name: seller?.full_name || 'Vendedor Reveta' },
      areaServed: product.location || 'España',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Reveta', item: 'https://reveta.es/' },
      { '@type': 'ListItem', position: 2, name: 'Segunda mano', item: 'https://reveta.es/segunda-mano' },
      { '@type': 'ListItem', position: 3, name: product.title, item: canonicalUrl },
    ],
  };

  return (
    <>
      <Helmet>
        <title>{product.title} | Reveta</title>
        <meta name="description" content={metaDescription} />
        <meta name="robots" content={shouldIndexProduct ? 'index,follow,max-image-preview:large' : 'noindex,follow'} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={`${product.title} | Reveta`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Reveta" />
        <meta property="og:locale" content="es_ES" />
        <meta property="og:image" content={productImageUrl} />
        <meta property="og:image:secure_url" content={productImageUrl} />
        <meta property="og:image:alt" content={imageAlt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${product.title} | Reveta`} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={productImageUrl} />
        <meta name="twitter:image:alt" content={imageAlt} />
        <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ChevronLeft className="h-4 w-4 mr-2" />Volver</Button>
          {!isProductAvailable && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Este producto ya no está activo. Puedes consultar la información, pero no acepta nuevas conversaciones, llamadas ni ofertas.</div>}
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={imageAlt}
                    width={1200}
                    height={1200}
                    sizes="(max-width: 1024px) 100vw, 760px"
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">Sin imagen</div>
                )}
                {images.length > 1 && <><Button size="icon" variant="secondary" aria-label="Mostrar imagen anterior" className="absolute left-2 top-1/2 -translate-y-1/2" onClick={() => setCurrentImageIndex((i) => Math.max(0, i - 1))}><ChevronLeft /></Button><Button size="icon" variant="secondary" aria-label="Mostrar imagen siguiente" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setCurrentImageIndex((i) => Math.min(images.length - 1, i + 1))}><ChevronRight /></Button></>}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto" aria-label={`Galería de imágenes de ${product.title}`}>
                  {images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setCurrentImageIndex(index)}
                      aria-label={`Mostrar imagen ${index + 1} de ${images.length}: ${product.title}`}
                      aria-current={index === currentImageIndex ? 'true' : undefined}
                      className={`h-20 w-20 shrink-0 rounded-lg overflow-hidden border-2 ${index === currentImageIndex ? 'border-primary' : 'border-transparent'}`}
                    >
                      <img
                        src={image}
                        alt={`${product.title}, imagen ${index + 1} de ${images.length}`}
                        width={160}
                        height={160}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <div className="rounded-xl border p-5 bg-card">
                <div className="flex items-start justify-between gap-3"><h1 className="text-2xl font-bold">{product.title}</h1><ProductStatusBadge status={product.status || 'active'} /></div>
                <p className="text-3xl font-bold text-primary mt-3">{product.price.toLocaleString('es-ES')} €</p>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-3">{product.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{product.location}</span>}<span className="flex items-center gap-1"><Eye className="h-4 w-4" />{product.views || 0} vistas</span><span className="flex items-center gap-1"><Clock className="h-4 w-4" />{new Date(product.created_at).toLocaleDateString('es-ES')}</span></div>
                {isOwner ? (
                  <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="font-semibold">Este anuncio es tuyo</p>
                    <p className="mt-1 text-sm text-muted-foreground">Gestiona su estado y revisa el interés recibido desde tu panel de vendedor.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Button onClick={() => navigate('/seller-dashboard')}>Gestionar anuncio</Button>
                      <Button variant="outline" onClick={() => navigate(`/boost/${product.id}`)} disabled={!isProductAvailable}>Destacar producto</Button>
                    </div>
                    <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate('/upload')}>Publicar otro producto</Button>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 flex gap-2"><Button className="flex-1" onClick={handleContactSeller} disabled={!isProductAvailable}><MessageCircle className="h-4 w-4 mr-2" />Chat</Button><Button variant="outline" onClick={toggleFavorite} aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}><Heart className={`h-4 w-4 ${isFavorite ? 'fill-current text-red-500' : ''}`} /></Button></div>
                    <Button variant="secondary" className="w-full mt-2" onClick={handleRequestPrivateCall} disabled={requestingCall || !user || !isProductAvailable}><Phone className="h-4 w-4 mr-2" />Llamada privada</Button>
                  </>
                )}
              </div>

              <SellerTrustCard seller={seller} activeProductsCount={sellerActiveProductsCount} />
              <ProductBuyerConfidence />
              <PurchaseDecisionGuide />
              <ReportProductButton productId={product.id} sellerId={product.user_id} productTitle={product.title} isOwner={isOwner} />
              <SocialShareButtons title={product.title} url={canonicalUrl} />
            </aside>
          </div>

          <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="rounded-xl border p-5 bg-card"><h2 className="font-bold text-xl mb-3">Descripción</h2><p className="whitespace-pre-wrap text-muted-foreground">{product.description || 'Sin descripción.'}</p>{category && <Badge variant="outline" className="mt-4">{category.name}</Badge>}</div>
            <div className="rounded-xl border p-5 bg-card"><div className="flex items-center gap-2 mb-4"><Shield className="h-5 w-5 text-primary" /><h2 className="font-bold text-xl">Valoraciones</h2></div><Reviews userId={product.user_id} sellerName={seller?.full_name || 'Vendedor'} /></div>
          </section>

          <RelatedProducts currentProductId={product.id} categoryId={product.category_id} />
        </main>
        <Footer />
        {showChat && product && <div className="fixed bottom-4 right-4 z-50 h-[600px] max-h-[80vh] w-[420px] max-w-[calc(100vw-2rem)]"><Chat productId={product.id} sellerId={product.user_id} onClose={() => setShowChat(false)} /></div>}
      </div>
    </>
  );
};

export default ProductDetail;
