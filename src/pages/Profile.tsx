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
  const [formData, setFormData] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductData | null>(null);

  const activeTab = useMemo(() => (searchParams.get('tab') === 'favorites' ? 'favorites' : 'products'), [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    const loadProfilePage = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchProducts(), fetchFavorites()]);
      setLoading(false);
    };
    loadProfilePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      toast({ title: 'Error', description: 'No se pudo cargar tu perfil', variant: 'destructive' });
      return;
    }

    const fallbackProfile: ProfileData = {
      id: user.id,
      username: null,
      full_name: user.email?.split('@')[0] || 'Usuario',
      avatar_url: null,
      location: null,
      phone: null,
      bio: null,
      verified: false,
      is_premium: false,
    };

    const nextProfile = (data || fallbackProfile) as ProfileData;
    setProfile(nextProfile);
    setFormData({
      full_name: nextProfile.full_name || '',
      username: nextProfile.username || '',
      location: nextProfile.location || '',
      phone: nextProfile.phone || '',
      bio: nextProfile.bio || '',
    });
  };

  const fetchProducts = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching products:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar tus productos', variant: 'destructive' });
      return;
    }
    setProducts((data || []) as ProductData[]);
  };

  const fetchFavorites = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('favorites').select('product_id, products(*)').eq('user_id', user.id);
    if (error) {
      console.error('Error fetching favorites:', error);
      setFavorites([]);
      return;
    }
    const favoriteProducts = (data || []).map((favorite: any) => favorite.products).filter(Boolean) as ProductData[];
    setFavorites(favoriteProducts);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      id: user.id,
      full_name: formData.full_name.trim() || null,
      username: formData.username.trim() || null,
      location: formData.location.trim() || null,
      phone: formData.phone.trim() || null,
      bio: formData.bio.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Error', description: 'No se pudo guardar el perfil', variant: 'destructive' });
    } else {
      toast({ title: 'Perfil actualizado', description: 'Los cambios se han guardado correctamente' });
      setIsEditing(false);
      await fetchProfile();
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    const { error } = await supabase.from('products').delete().eq('id', productToDelete.id);
    if (error) {
      console.error('Error deleting product:', error);
      toast({ title: 'Error', description: 'No se pudo eliminar el producto', variant: 'destructive' });
    } else {
      toast({ title: 'Producto eliminado', description: 'El producto se ha eliminado correctamente' });
      setProducts((current) => current.filter((product) => product.id !== productToDelete.id));
    }
    setProductToDelete(null);
    setDeleteDialogOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const renderProductImage = (product: ProductData) => {
    const image = getProductImage(product);
    if (!image) {
      return (
        <div className="w-full h-full bg-muted flex flex-col items-center justify-center text-muted-foreground">
          <ImageOff className="h-8 w-8 mb-2" />
          <span className="text-sm">Sin imagen</span>
        </div>
      );
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
                    <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button><Button onClick={handleSaveProfile} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button></div>
                  </CardContent>
                </Card>
              ) : (
                <Tabs defaultValue={activeTab}>
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="products" className="gap-2"><Package className="h-4 w-4" />Mis productos</TabsTrigger>
                    <TabsTrigger value="favorites" className="gap-2"><Heart className="h-4 w-4" />Favoritos</TabsTrigger>
                  </TabsList>

                  <TabsContent value="products" className="mt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {products.map((product) => {
                        const boosted = isBoosted(product.boosted_until);
                        return (
                          <Card key={product.id} className="overflow-hidden border-border/50 group">
                            <Link to={`/product/${product.id}`}>
                              <div className="relative aspect-video">
                                {renderProductImage(product)}
                                <div className="absolute top-2 right-2"><ProductStatusBadge status={product.status} /></div>
                                {boosted && <div className="absolute top-2 left-2"><Badge className="gap-1"><Megaphone className="h-3 w-3" />Destacado</Badge></div>}
                              </div>
                            </Link>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <Link to={`/product/${product.id}`} className="min-w-0">
                                  <h3 className="font-semibold truncate">{product.title}</h3>
                                  <p className="text-lg font-bold text-primary">{product.price} €</p>
                                </Link>
                                <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => { setProductToDelete(product); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatDate(product.created_at)}</div>
                              {boosted && <p className="text-xs text-primary font-medium mt-2">Destacado hasta el {formatBoostDate(product.boosted_until)}</p>}
                              {product.status === 'active' && (
                                <Button variant="outline" className="w-full mt-3 gap-2" onClick={() => navigate(`/boost/${product.id}`)}>
                                  <Megaphone className="h-4 w-4" />
                                  {boosted ? 'Ampliar destacado' : 'Destacar'}
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}

                      {products.length === 0 && <div className="sm:col-span-2 text-center py-12 bg-muted/50 rounded-xl"><Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No tienes productos a la venta</p><Button className="mt-4" onClick={() => navigate('/upload')}>Subir mi primer producto</Button></div>}
                    </div>
                  </TabsContent>

                  <TabsContent value="favorites" className="mt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {favorites.map((product) => (
                        <Link to={`/product/${product.id}`} key={product.id}>
                          <Card className="overflow-hidden border-border/50 group">
                            <div className="relative aspect-video">{renderProductImage(product)}</div>
                            <CardContent className="p-4">
                              <h3 className="font-semibold truncate">{product.title}</h3>
                              <p className="text-lg font-bold text-primary">{product.price} €</p>
                              {product.location && <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{product.location}</div>}
                            </CardContent>
                          </Card>
                        </Link>
                      ))}

                      {favorites.length === 0 && <div className="sm:col-span-2 text-center py-12 bg-muted/50 rounded-xl"><Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Aún no tienes productos favoritos</p><Button className="mt-4" variant="outline" onClick={() => navigate('/')}>Explorar productos</Button></div>}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </main>

        <Footer />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />¿Eliminar producto?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no se puede deshacer. El producto “{productToDelete?.title}” se eliminará permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteProduct}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default Profile;
