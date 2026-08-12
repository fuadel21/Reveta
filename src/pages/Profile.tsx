import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Heart, LogOut, MapPin, Package, Trash2, AlertTriangle, Clock, ImageOff, Megaphone, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ProductStatusBadge from '@/components/ProductStatusBadge';
import VerificationRequest from '@/components/VerificationRequest';
import { ProfileBadge } from '@/components/ProfileBadge';

type ProfileData = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  verified: boolean | null;
  is_premium?: boolean | null;
};

type ProductData = {
  id: string;
  title: string;
  price: number;
  location: string | null;
  images: string[] | null;
  created_at: string;
  status: string | null;
  description: string | null;
  condition: string | null;
  category_id: string | null;
  boosted_until?: string | null;
};

const getProductImage = (product: ProductData) => Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
const isBoosted = (boostedUntil?: string | null) => !!boostedUntil && new Date(boostedUntil).getTime() > Date.now();
const formatBoostDate = (boostedUntil?: string | null) => boostedUntil ? new Date(boostedUntil).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [favorites, setFavorites] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [retireProduct, setRetireProduct] = useState<ProductData | null>(null);

  const activeProductsCount = useMemo(() => products.filter((product) => product.status === 'active').length, [products]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (searchParams.get('edit') === '1') navigate('/settings?section=profile', { replace: true });
  }, [navigate, searchParams]);

  useEffect(() => {
    if (user) void fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchProfileData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: privateProfileData, error: privateProfileError } = await (supabase as any).rpc('get_private_profile');
    if (privateProfileError) {
      console.error('Error fetching private profile:', privateProfileError);
      toast({ title: 'Error', description: 'No se pudo cargar tu perfil privado', variant: 'destructive' });
    }

    const profileData = Array.isArray(privateProfileData) ? privateProfileData[0] : privateProfileData;
    if (profileData) setProfile(profileData as ProfileData);

    const [{ data: productsData, error: productsError }, { data: favoriteRows, error: favoritesError }] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('favorites').select('products(*)').eq('user_id', user.id),
    ]);

    if (productsError) console.error('Error fetching profile products:', productsError);
    if (favoritesError) console.error('Error fetching favorites:', favoritesError);

    setProducts((productsData || []) as ProductData[]);
    setFavorites((favoriteRows || []).map((item: any) => item.products).filter(Boolean) as ProductData[]);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleRetireProduct = async () => {
    if (!retireProduct || !user) return;
    if (retireProduct.status && !['active', 'inactive'].includes(retireProduct.status)) {
      toast({ title: 'No se puede retirar', description: 'Este producto tiene una operación en curso o ya está vendido.', variant: 'destructive' });
      setRetireProduct(null);
      return;
    }

    setUpdatingProductId(retireProduct.id);
    const { error } = await supabase
      .from('products')
      .update({ status: 'inactive' })
      .eq('id', retireProduct.id)
      .eq('user_id', user.id)
      .in('status', ['active', 'inactive']);

    if (error) {
      console.error('Error retiring product:', error);
      toast({ title: 'Error', description: 'No se pudo retirar el anuncio', variant: 'destructive' });
    } else {
      toast({ title: 'Anuncio retirado', description: 'El producto deja de aparecer como disponible, pero conserva historial y conversaciones.' });
      setRetireProduct(null);
      await fetchProfileData();
    }
    setUpdatingProductId(null);
  };

  const handleReactivateProduct = async (product: ProductData) => {
    if (!user) return;
    setUpdatingProductId(product.id);
    const { error } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('id', product.id)
      .eq('user_id', user.id)
      .eq('status', 'inactive');

    if (error) {
      console.error('Error reactivating product:', error);
      toast({ title: 'Error', description: 'No se pudo reactivar el anuncio', variant: 'destructive' });
    } else {
      toast({ title: 'Anuncio reactivado', description: 'El producto vuelve a estar disponible.' });
      await fetchProfileData();
    }
    setUpdatingProductId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const renderProductImage = (product: ProductData) => {
    const image = getProductImage(product);
    if (!image) return <div className="w-full h-full flex items-center justify-center bg-muted"><ImageOff className="h-8 w-8 text-muted-foreground" /></div>;
    return <img src={image} alt={product.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />;
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <Helmet><title>Mi Perfil | Reveta</title><meta name="description" content="Gestiona tus productos y favoritos en Reveta" /><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <Card className="border-border/50">
                <CardHeader className="text-center">
                  <div className="relative mx-auto"><div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl font-bold text-primary-foreground overflow-hidden">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : profile?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}</div></div>
                  <div className="flex flex-col items-center gap-2 mt-4"><CardTitle>{profile?.full_name || user.email?.split('@')[0] || 'Usuario'}</CardTitle><ProfileBadge isVerified={profile?.verified || false} isPremium={profile?.is_premium || false} /></div>
                  {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile?.location && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{profile.location}</div>}
                  {profile?.bio && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border"><div className="text-center"><p className="text-2xl font-bold">{activeProductsCount}</p><p className="text-xs text-muted-foreground">Activos</p></div><div className="text-center"><p className="text-2xl font-bold">{favorites.length}</p><p className="text-xs text-muted-foreground">Favoritos</p></div></div>
                  <div className="space-y-2 pt-4">
                    {!profile?.verified && <VerificationRequest isVerified={false} />}
                    <Button variant="outline" className="w-full justify-start" asChild><Link to="/settings?section=profile"><Edit2 className="h-4 w-4 mr-2" />Editar perfil y avatar</Link></Button>
                    <Button variant="outline" className="w-full justify-start" asChild><Link to="/settings"><SettingsIcon className="h-4 w-4 mr-2" />Cuenta y ajustes</Link></Button>
                    <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />Cerrar sesión</Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Tabs defaultValue="products" className="w-full">
                <TabsList className="mb-6"><TabsTrigger value="products">Mis productos</TabsTrigger><TabsTrigger value="favorites">Favoritos</TabsTrigger></TabsList>
                <TabsContent value="products" className="space-y-4">
                  {products.length === 0 ? <Card><CardContent className="p-8 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="font-medium mb-2">No tienes productos publicados</h3><p className="text-sm text-muted-foreground mb-4">Empieza vendiendo tu primer producto</p><Button asChild><Link to="/upload">Publicar producto</Link></Button></CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2">{products.map((product) => <Card key={product.id} className="overflow-hidden border-border/50 group"><div className="relative aspect-video bg-muted">{renderProductImage(product)}{isBoosted(product.boosted_until) && <Badge className="absolute left-2 top-2 bg-amber-500 text-white"><Megaphone className="mr-1 h-3 w-3" />Destacado hasta {formatBoostDate(product.boosted_until)}</Badge>}<ProductStatusBadge status={product.status || 'active'} className="absolute right-2 top-2" /></div><CardContent className="p-4"><h3 className="font-medium line-clamp-1">{product.title}</h3><p className="text-lg font-bold text-primary">{product.price.toLocaleString('es-ES')} €</p><p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Clock className="h-3 w-3" />{formatDate(product.created_at)}</p><div className="flex flex-wrap gap-2 mt-3"><Button size="sm" variant="outline" asChild><Link to={`/product/${product.id}`}>Ver</Link></Button>{product.status === 'inactive' ? <Button size="sm" variant="outline" disabled={updatingProductId === product.id} onClick={() => void handleReactivateProduct(product)}><RotateCcw className="h-4 w-4 mr-1" />Reactivar</Button> : <Button size="sm" variant="destructive" disabled={updatingProductId === product.id || (product.status !== 'active' && product.status !== 'inactive')} onClick={() => setRetireProduct(product)}><Trash2 className="h-4 w-4 mr-1" />Retirar</Button>}</div></CardContent></Card>)}</div>}
                </TabsContent>
                <TabsContent value="favorites">
                  {favorites.length === 0 ? <Card><CardContent className="p-8 text-center"><Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="font-medium mb-2">No tienes favoritos</h3><p className="text-sm text-muted-foreground">Guarda productos que te interesen</p></CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2">{favorites.map((product) => <Card key={product.id} className="overflow-hidden border-border/50"><div className="aspect-video bg-muted">{renderProductImage(product)}</div><CardContent className="p-4"><h3 className="font-medium line-clamp-1">{product.title}</h3><p className="text-lg font-bold text-primary">{product.price.toLocaleString('es-ES')} €</p><Button size="sm" variant="outline" asChild className="mt-3"><Link to={`/product/${product.id}`}>Ver producto</Link></Button></CardContent></Card>)}</div>}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
        <Footer />

        <AlertDialog open={!!retireProduct} onOpenChange={() => setRetireProduct(null)}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Retirar anuncio</AlertDialogTitle><AlertDialogDescription>¿Seguro que quieres retirar “{retireProduct?.title}”? El producto dejará de estar disponible, pero se conserva el historial, favoritos, chats y enlaces relacionados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleRetireProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Retirar anuncio</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default Profile;
