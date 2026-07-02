import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
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
import { Chat } from '@/components/Chat';

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  images: string[];
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
  if (!url) return 'https://reveta.es/og-image.png';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://reveta.es${url.startsWith('/') ? url : `/${url}`}`;
};

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
  }, [id]);

  useEffect(() => {
    if (product && user) checkFavorite();
  }, [product, user]);

  useEffect(() => {
    if (!product) return;

    const canonicalPath = `/producto/${product.id}/${createProductSlug(product.title)}`;
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [product, location.pathname, navigate]);

  const fetchProduct = async () => {
    if (!id) return;

    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();

    if (error || !data) {
      console.error('Error fetching product:', error);
      navigate('/');
      return;
    }

    setProduct(data);
    await supabase.from('products').update({ views: (data.views || 0) + 1 }).eq('id', id);

    const { data: sellerData } = await supabase.from('profiles').select('*').eq('id', data.user_id).maybeSingle();
    if (sellerData) setSeller(sellerData);

    const { count: activeCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', data.user_id)
      .eq('status', 'active');
    setSellerActiveProductsCount(activeCount || 0);

    if (data.category_id) {
      const { data: categoryData } = await supabase.from('categories').select('*').eq('id', data.category_id).maybeSingle();
      if (categoryData) setCategory(categoryData);
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

    if (isFavorite) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', product.id);
      setIsFavorite(false);
      toast({ title: 'Eliminado de favoritos', description: 'El producto se ha eliminado de tus favoritos' });
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, product_id: product.id });
      setIsFavorite(true);
      toast({ title: 'Añadido a favoritos', description: 'El producto se ha añadido a tus favoritos' });
    }
  };

  const handleContactSeller = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setShowChat(true);
  };

  const getOrCreateConversation = async () => {
    if (!user || !product || !seller) return null;

    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('*')
      .eq('product_id', product.id)
      .eq('buyer_id', user.id)
      .eq('seller_id', seller.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
      .from('conversations')
      .insert({ product_id: product.id, buyer_id: user.id, seller_id: seller.id })
      .select('*')
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
    setRequestingCall(true);

    try {
      const conversation = await getOrCreateConversation();
      if (!conversation?.id) throw new Error('No se pudo crear la conversación');

      const { data: callSession, error: callError } = await (supabase as any)
        .from('call_sessions')
        .insert({ conversation_id: conversation.id, product_id: product.id, caller_id: user.id, callee_id: seller.id, status: 'requested' })
        .select('*')
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
      toast({ title: 'No se pudo crear la llamada', description: 'Ejecuta la migración de llamadas o inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setRequestingCall(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) return 'Hace unos minutos';
      return `Hace ${diffHours}h`;
    }
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  };

  const nextImage = () => {
    if (product && product.images.length > 1) setCurrentImageIndex((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    if (product && product.images.length > 1) setCurrentImageIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!product) return null;

  const isOwner = user?.id === product.user_id;
  const productSlug = createProductSlug(product.title);
  const canonicalUrl = `https://reveta.es/producto/${product.id}/${productSlug}`;
  const cleanDescription = (product.description || `${product.title} de segunda mano por ${product.price}€${product.location ? ` en ${product.location}` : ''}. Compra y vende en Reveta.`).replace(/\s+/g, ' ').trim().slice(0, 160);
  const rawTitle = `${product.title} · ${product.price}€${product.location ? ` en ${product.location}` : ''} | Reveta`;
  const seoTitle = rawTitle.length > 60 ? `${product.title.slice(0, 40)} · ${product.price}€ | Reveta` : rawTitle;
  const primaryImage = product.images?.[0];
  const socialImage = absoluteUrl(primaryImage);
  const schemaImages = product.images && product.images.length > 0 ? product.images.map((image) => absoluteUrl(image)) : [socialImage];
  const shouldIndex = product.status === 'active';
  const availability = product.status === 'sold' ? 'https://schema.org/SoldOut' : product.status === 'reserved' ? 'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock';
  const itemCondition = ['nuevo', 'new'].includes((product.condition || '').toLowerCase()) ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition';

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: cleanDescription,
    image: schemaImages,
    ...(category && { category: category.name }),
    itemCondition,
    sku: product.id,
    offers: { '@type': 'Offer', url: canonicalUrl, priceCurrency: 'EUR', price: product.price, availability, itemCondition, ...(seller?.full_name && { seller: { '@type': 'Person', name: seller.full_name } }) },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://reveta.es/' },
      { '@type': 'ListItem', position: 2, name: 'Buscar', item: 'https://reveta.es/search' },
      ...(category ? [{ '@type': 'ListItem', position: 3, name: category.name, item: `https://reveta.es/search?category=${category.id}` }] : []),
      { '@type': 'ListItem', position: category ? 4 : 3, name: product.title, item: canonicalUrl },
    ],
  };

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={cleanDescription} />
        <meta name="robots" content={shouldIndex ? 'index,follow,max-image-preview:large' : 'noindex,follow'} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={product.title} />
        <meta property="og:description" content={cleanDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Reveta" />
        <meta property="og:locale" content="es_ES" />
        <meta property="og:image" content={socialImage} />
        <meta property="og:image:secure_url" content={socialImage} />
        <meta property="og:image:alt" content={product.title} />
        <meta property="product:price:amount" content={String(product.price)} />
        <meta property="product:price:currency" content="EUR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={product.title} />
        <meta name="twitter:description" content={cleanDescription} />
        <meta name="twitter:image" content={socialImage} />
        <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ChevronLeft className="h-4 w-4" />Volver</Link>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                {product.images && product.images.length > 0 ? (
                  <>
                    <img src={product.images[currentImageIndex]} alt={product.title} className="h-full w-full object-cover" />
                    {product.images.length > 1 && (
                      <>
                        <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                        <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors"><ChevronRight className="h-5 w-5" /></button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">{product.images.map((_, index) => <button key={index} onClick={() => setCurrentImageIndex(index)} className={`h-2 w-2 rounded-full transition-colors ${index === currentImageIndex ? 'bg-primary' : 'bg-card/80'}`} />)}</div>
                      </>
                    )}
                  </>
                ) : <div className="h-full w-full flex items-center justify-center"><span className="text-muted-foreground">Sin imagen</span></div>}
              </div>

              {product.images && product.images.length > 1 && <div className="flex gap-2 mt-4 overflow-x-auto pb-2">{product.images.map((img, index) => <button key={index} onClick={() => setCurrentImageIndex(index)} className={`shrink-0 h-20 w-20 rounded-lg overflow-hidden border-2 transition-colors ${index === currentImageIndex ? 'border-primary' : 'border-transparent hover:border-border'}`}><img src={img} alt="" className="h-full w-full object-cover" /></button>)}</div>}

              <div className="mt-8"><h2 className="text-lg font-semibold mb-4">Descripción</h2><p className="text-muted-foreground whitespace-pre-wrap">{product.description || 'Sin descripción'}</p></div>
              <div className="mt-6"><ProductBuyerConfidence /></div>
            </div>

            <div className="space-y-6">
              <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
                <div className="flex items-start justify-between mb-4">
                  <div><div className="flex items-center gap-2 mb-2"><p className="text-3xl font-bold text-foreground">{product.price.toLocaleString('es-ES')} €</p><ProductStatusBadge status={product.status} /></div>{product.condition && <Badge variant="secondary" className="font-medium">{product.condition}</Badge>}</div>
                  <div className="flex gap-2"><Button variant="outline" size="icon" onClick={toggleFavorite} className={isFavorite ? 'text-destructive' : ''}><Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} /></Button><SocialShareButtons title={product.title} description={`${product.title} por ${product.price}€ en Reveta`} compact /></div>
                </div>

                <h1 className="text-xl font-semibold mb-4">{product.title}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">{product.location && <div className="flex items-center gap-1"><MapPin className="h-4 w-4" />{product.location}</div>}<div className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatDate(product.created_at)}</div><div className="flex items-center gap-1"><Eye className="h-4 w-4" />{product.views || 0} visitas</div></div>
                {category && <Link to={`/search?category=${category.id}`} className="inline-block text-sm text-primary hover:underline mb-6">{category.name}</Link>}

                {!isOwner && product.status === 'active' && (
                  <div className="space-y-3">
                    <Button className="w-full h-14 text-lg font-bold" onClick={handleContactSeller}><MessageCircle className="h-5 w-5 mr-2" />Hacer oferta / Chat</Button>
                    <Button variant="secondary" className="w-full h-14 text-lg font-bold border-2 border-primary/20" onClick={() => navigate(`/checkout/${product.id}`)}>Comprar ahora</Button>
                    <Button variant="outline" className="w-full h-12 text-base font-bold border-primary/30" onClick={handleRequestPrivateCall} disabled={requestingCall}><Phone className="h-5 w-5 mr-2" />{requestingCall ? 'Creando...' : 'Solicitar llamada privada'}</Button>
                    <p className="text-xs text-muted-foreground text-center">Negocia por chat, envía una oferta o compra directamente con Protección Reveta.</p>
                    <PurchaseDecisionGuide />
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mt-4"><div className="flex items-start gap-3"><Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" /><div><p className="text-sm font-bold text-foreground">Compra Protegida</p><p className="text-xs text-muted-foreground mt-1">Paga a través de Reveta y protegemos tu dinero hasta que recibas el producto.</p></div></div></div>
                  </div>
                )}

                {!isOwner && product.status !== 'active' && <div className="text-center p-4 bg-muted rounded-lg"><p className="text-muted-foreground">{product.status === 'sold' ? 'Este producto ya ha sido vendido' : 'Este producto está reservado'}</p></div>}
                {isOwner && <div className="space-y-3"><Button variant="outline" className="w-full h-12" onClick={() => navigate('/profile')}>Gestionar producto</Button><p className="text-xs text-center text-muted-foreground italic">Eres el vendedor de este producto</p></div>}
              </div>

              {seller && (
                <SellerTrustCard
                  seller={seller}
                  productId={product.id}
                  isOwner={isOwner}
                  activeProductsCount={sellerActiveProductsCount}
                  onContactSeller={handleContactSeller}
                />
              )}
              {seller && <div className="bg-card rounded-xl p-6 shadow-card border border-border/50"><Reviews userId={seller.id} productId={product.id} /></div>}
              <div className="bg-muted/50 rounded-xl p-6"><h3 className="font-medium mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Consejos de seguridad</h3><ul className="text-sm text-muted-foreground space-y-2"><li>• Queda en lugares públicos</li><li>• Verifica el producto antes de pagar</li><li>• Nunca envíes dinero por adelantado</li><li>• Usa el chat de la plataforma</li></ul></div>
            </div>
          </div>

          <RelatedProducts currentProductId={product.id} categoryId={product.category_id} location={product.location} />
        </main>

        <Footer />
      </div>

      {showChat && seller && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl w-full max-w-2xl h-[600px] flex flex-col relative overflow-hidden"><Chat productId={product.id} sellerId={seller.id} onClose={() => setShowChat(false)} /></div></div>}
    </>
  );
};

export default ProductDetail;
