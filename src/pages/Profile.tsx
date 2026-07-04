import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Heart, LogOut, MapPin, Package, Trash2, AlertTriangle, Clock, ImageOff, Megaphone } from 'lucide-react';
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
  phone: string | null;
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

const emptyForm = { full_name: '', username: '', location: '', phone: '', bio: '' };

const getProductImage = (product: ProductData) => {
  return Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
};

const isBoosted = (boostedUntil?: string | null) => {
  return !!boostedUntil && new Date(boostedUntil).getTime() > Date.now();
};

const formatBoostDate = (boostedUntil?: string | null) => {
  if (!boostedUntil) return '';
  return new Date(boostedUntil).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [favorites, setFavorites] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [deleteProduct, setDeleteProduct] = useState<ProductData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchProfileData();
  }, [user]);

  useEffect(() => {
    if (searchParams.get('edit') === '1') setIsEditing(true);
  }, [searchParams]);

  const fetchProfileData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as ProfileData);
      setFormData({
        full_name: profileData.full_name || '',
        username: profileData.username || '',
        location: profileData.location || '',
        phone: profileData.phone || '',
        bio: profileData.bio || '',
      });
    }

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setProducts((productsData || []) as ProductData[]);

    const { data: favoriteRows } = await supabase
      .from('favorites')
      .select('products(*)')
      .eq('user_id', user.id);

    const favoriteProducts = (favoriteRows || [])
      .map((item: any) => item.products)
      .filter(Boolean) as ProductData[];

    setFavorites(favoriteProducts);
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update(formData)
      .eq('id', user.id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el perfil', variant: 'destructive' });
      return;
    }

    toast({ title: 'Perfil actualizado', description: 'Tus datos se han guardado correctamente' });
    setIsEditing(false);
    fetchProfileData();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteProduct = async () => {
    if (!deleteProduct) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', deleteProduct.id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el producto', variant: 'destructive' });
      return;
    }

    toast({ title: 'Producto eliminado', description: 'El producto se ha eliminado correctamente' });
    setDeleteProduct(null);
    fetchProfileData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const renderProductImage = (product: ProductData) => {
    const image = getProductImage(product);
    if (!image) {
      return <div className="w-full h-full flex items-center justify-center bg-muted"><ImageOff className="h-8 w-8 text-muted-foreground" /></div>;
    }
    return <img src={image} alt={product.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />;
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Mi Perfil | Reveta</title>
        <meta name="description" content="Gestiona tu perfil, productos y favoritos en Reveta" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <Card className="border-border/50">
                <CardHeader className="text-center">
                  <div className="relative mx-auto">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl font-bold text-primary-foreground overflow-hidden">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : profile?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 mt-4">
                    <CardTitle>{profile?.full_name || user.email?.split('@')[0] || 'Usuario'}</CardTitle>
                    <ProfileBadge isVerified={profile?.verified || false} isPremium={profile?.is_premium || false} />
                  </div>

                  {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
                </CardHeader>

                <CardContent className="space-y-4">
                  {profile?.location && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{profile.location}</div>}
                  {profile?.bio && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="text-center"><p className="text-2xl font-bold">{products.length}</p><p className="text-xs text-muted-foreground">Productos</p></div>
                    <div className="text-center"><p className="text-2xl font-bold">{favorites.length}</p><p className="text-xs text-muted-foreground">Favoritos</p></div>
                  </div>

                  <div className="space-y-2 pt-4">
                    {!profile?.verified && <VerificationRequest isVerified={false} />}
                    <Button variant="outline" className="w-full justify-start" onClick={() => setIsEditing(true)}><Edit2 className="h-4 w-4 mr-2" />Editar perfil</Button>
                    <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />Cerrar sesión</Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {isEditing ? (
                <Card className="border-border/50">
                  <CardHeader><CardTitle>Editar perfil</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2"><Label htmlFor="full_name">Nombre completo</Label><Input id="full_name" value={formData.full_name} onChange={(event) => setFormData({ ...formData, full_name: event.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="username">Nombre de usuario</Label><Input id="username" value={formData.username} onChange={(event) => setFormData({ ...formData, username: event.target.value })} placeholder="usuario" /></div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2"><Label htmlFor="location">Ubicación</Label><Input id="location" value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} placeholder="Ciudad, País" /></div>
                      <div className="space-y-2"><Label htmlFor="phone">Teléfono</Label><Input id="phone" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="+34 600 000 000" /></div>
                    </div>

                    <div className="space-y-2"><Label htmlFor="bio">Biografía</Label><Textarea id="bio" value={formData.bio} onChange={(event) => setFormData({ ...formData, bio: event.target.value })} placeholder="Cuéntanos sobre ti..." rows={3} /></div>

                    <div className="flex gap-2"><Button onClick={handleSaveProfile}>Guardar cambios</Button><Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button></div>
                  </CardContent>
                </Card>
              ) : (
                <Tabs defaultValue="products" className="w-full">
                  <TabsList className="mb-6"><TabsTrigger value="products">Mis productos</TabsTrigger><TabsTrigger value="favorites">Favoritos</TabsTrigger></TabsList>

                  <TabsContent value="products" className="space-y-4">
                    {products.length === 0 ? (
                      <Card><CardContent className="p-8 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="font-medium mb-2">No tienes productos publicados</h3><p className="text-sm text-muted-foreground mb-4">Empieza vendiendo tu primer producto</p><Button asChild><Link to="/upload">Publicar producto</Link></Button></CardContent></Card>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {products.map((product) => (
                          <Card key={product.id} className="overflow-hidden border-border/50 group">
                            <div className="relative aspect-video bg-muted">{renderProductImage(product)}{isBoosted(product.boosted_until) && <Badge className="absolute left-2 top-2 bg-amber-500 text-white"><Megaphone className="mr-1 h-3 w-3" />Destacado hasta {formatBoostDate(product.boosted_until)}</Badge>}<ProductStatusBadge status={product.status || 'active'} className="absolute right-2 top-2" /></div>
                            <CardContent className="p-4"><h3 className="font-medium line-clamp-1">{product.title}</h3><p className="text-lg font-bold text-primary mt-1">{product.price.toLocaleString('es-ES')} €</p><p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(product.created_at)}</p><div className="flex gap-2 mt-4"><Button asChild variant="outline" size="sm" className="flex-1"><Link to={`/producto/${product.id}/${product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>Ver</Link></Button><Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteProduct(product)}><Trash2 className="h-4 w-4" /></Button></div></CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="favorites" className="space-y-4">
                    {favorites.length === 0 ? (
                      <Card><CardContent className="p-8 text-center"><Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="font-medium mb-2">No tienes favoritos</h3><p className="text-sm text-muted-foreground mb-4">Guarda productos que te interesen</p><Button asChild><Link to="/search">Explorar productos</Link></Button></CardContent></Card>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {favorites.map((product) => (
                          <Card key={product.id} className="overflow-hidden border-border/50 group"><div className="relative aspect-video bg-muted">{renderProductImage(product)}</div><CardContent className="p-4"><h3 className="font-medium line-clamp-1">{product.title}</h3><p className="text-lg font-bold text-primary mt-1">{product.price.toLocaleString('es-ES')} €</p><Button asChild variant="outline" size="sm" className="w-full mt-4"><Link to={`/producto/${product.id}/${product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>Ver producto</Link></Button></CardContent></Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>

      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Eliminar producto</AlertDialogTitle><AlertDialogDescription>¿Estás seguro de que quieres eliminar "{deleteProduct?.title}"? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Profile;
