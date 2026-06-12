import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { useToast } from '@/hooks/use-toast';
import { User, MapPin, Phone, Edit2, Package, Heart, LogOut, Camera, Trash2, MoreVertical, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ProductStatusBadge from '@/components/ProductStatusBadge';
import EditProductDialog from '@/components/EditProductDialog';
import SellerRating from '@/components/SellerRating';
import VerifiedBadge from '@/components/VerifiedBadge';
import VerificationRequest from '@/components/VerificationRequest';
import { ProfileBadge } from '@/components/ProfileBadge';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  location: string | null;
  phone: string | null;
  bio: string | null;
  verified: boolean | null;
  is_premium?: boolean;
}

interface Product {
  id: string;
  title: string;
  price: number;
  location: string | null;
  images: string[];
  created_at: string;
  status: string | null;
  description: string | null;
  condition: string | null;
  category_id: string | null;
}

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    location: '',
    phone: '',
    bio: ''
  });

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchProducts();
      fetchFavorites();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        username: data.username || '',
        location: data.location || '',
        phone: data.phone || '',
        bio: data.bio || ''
      });
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('favorites')
      .select('product_id, products(*)')
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error fetching favorites:', error);
    } else {
      const favoriteProducts = data?.map((f: any) => f.products).filter(Boolean) || [];
      setFavorites(favoriteProducts);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        username: formData.username || null,
        location: formData.location || null,
        phone: formData.phone || null,
        bio: formData.bio || null
      })
      .eq('id', user.id);
    
    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el perfil',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Perfil actualizado',
        description: 'Los cambios se han guardado correctamente'
      });
      setIsEditing(false);
      fetchProfile();
    }
    
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setDeletingAccount(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('delete-account');
      
      if (error) {
        throw error;
      }
      
      toast({
        title: 'Cuenta eliminada',
        description: 'Tu cuenta y todos tus datos han sido eliminados correctamente'
      });
      
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
        variant: 'destructive'
      });
    } finally {
      setDeletingAccount(false);
      setDeleteAccountDialogOpen(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
            {/* Profile Card */}
            <div className="lg:col-span-1">
              <Card className="border-border/50">
                <CardHeader className="text-center">
                  <div className="relative mx-auto">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl font-bold text-primary-foreground">
                      {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-2 mt-4">
                    <CardTitle>{profile?.full_name || 'Usuario'}</CardTitle>
                    <ProfileBadge 
                      isVerified={profile?.verified || false} 
                      isPremium={profile?.is_premium || false}
                    />
                  </div>
                  {profile?.username && (
                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile?.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {profile.location}
                    </div>
                  )}
                  {profile?.bio && (
                    <p className="text-sm text-muted-foreground">{profile.bio}</p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{products.length}</p>
                      <p className="text-xs text-muted-foreground">Productos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{favorites.length}</p>
                      <p className="text-xs text-muted-foreground">Favoritos</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-4">
                    {!profile?.verified && (
                      <VerificationRequest isVerified={profile?.verified || false} />
                    )}
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar perfil
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-destructive hover:text-destructive/80"
                      onClick={() => setDeleteAccountDialogOpen(true)}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Eliminar cuenta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Content */}
            <div className="lg:col-span-2">
              {isEditing ? (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Editar Perfil</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Nombre completo</Label>
                        <Input
                          id="full_name"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Nombre de usuario</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="@usuario"
                        />
                      </div>
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="location">Ubicación</Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          placeholder="Ciudad, País"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+34 600 000 000"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="bio">Biografía</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        placeholder="Cuéntanos sobre ti..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveProfile} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Tabs defaultValue="products">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="products" className="gap-2">
                      <Package className="h-4 w-4" />
                      Mis productos
                    </TabsTrigger>
                    <TabsTrigger value="favorites" className="gap-2">
                      <Heart className="h-4 w-4" />
                      Favoritos
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="products" className="mt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {products.map((product) => (
                        <Card key={product.id} className="overflow-hidden border-border/50 group">
                          <div className="relative aspect-video">
                            <img 
                              src={product.images[0]} 
                              alt={product.title}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute top-2 right-2">
                              <ProductStatusBadge status={product.status} />
                            </div>
                          </div>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold truncate">{product.title}</h3>
                                <p className="text-lg font-bold text-primary">{product.price} €</p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingProduct(product);
                                    setEditDialogOpen(true);
                                  }}>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => {
                                      setProductToDelete(product.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(product.created_at)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {products.length === 0 && (
                        <div className="sm:col-span-2 text-center py-12 bg-muted/50 rounded-xl">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No tienes productos a la venta</p>
                          <Button className="mt-4" onClick={() => navigate('/upload')}>
                            Subir mi primer producto
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="favorites" className="mt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {favorites.map((product) => (
                        <Link to={`/product/${product.id}`} key={product.id}>
                          <Card className="overflow-hidden border-border/50 group">
                            <div className="relative aspect-video">
                              <img 
                                src={product.images[0]} 
                                alt={product.title}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-semibold truncate">{product.title}</h3>
                              <p className="text-lg font-bold text-primary">{product.price} €</p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {product.location}
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                      {favorites.length === 0 && (
                        <div className="sm:col-span-2 text-center py-12 bg-muted/50 rounded-xl">
                          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">Aún no tienes productos favoritos</p>
                          <Button className="mt-4" variant="outline" onClick={() => navigate('/')}>
                            Explorar productos
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </main>
        
        <Footer />
        
        <EditProductDialog
          product={editingProduct}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchProducts}
        />
        
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El producto se eliminará permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  if (productToDelete) {
                    const { error } = await supabase
                      .from('products')
                      .delete()
                      .eq('id', productToDelete);
                    
                    if (error) {
                      toast({
                        title: 'Error',
                        description: 'No se pudo eliminar el producto',
                        variant: 'destructive'
                      });
                    } else {
                      toast({
                        title: 'Producto eliminado',
                        description: 'El producto se ha eliminado correctamente'
                      });
                      fetchProducts();
                    }
                  }
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                ¿Eliminar cuenta permanentemente?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>Esta acción es irreversible y tendrá las siguientes consecuencias:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Se eliminará tu perfil y datos personales.</li>
                  <li>Se eliminarán todos tus productos publicados.</li>
                  <li>Se eliminarán tus mensajes y conversaciones.</li>
                  <li>Perderás el acceso a tu cuenta de forma definitiva.</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingAccount}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? 'Eliminando...' : 'Sí, eliminar mi cuenta'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default Profile;
