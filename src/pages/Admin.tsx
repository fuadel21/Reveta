import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Users, 
  Package, 
  Flag, 
  Star, 
  Grid3X3,
  Shield,
  ShieldCheck,
  Trash2,
  Eye,
  Search,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  email?: string;
  verified: boolean | null;
  created_at: string;
  hasAdminRole?: boolean;
}

interface Product {
  id: string;
  title: string;
  price: number;
  status: string | null;
  created_at: string;
  user_id: string;
  profiles?: { username: string | null; full_name: string | null };
}

interface Report {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_product_id: string | null;
  reporter?: { username: string | null };
  reported_user?: { username: string | null };
  reported_product?: { title: string };
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
  seller_id: string;
  reviewer?: { username: string | null };
  seller?: { username: string | null };
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'product' | 'review' | 'category' | null;
    id: string | null;
    title: string;
  }>({ open: false, type: null, id: null, title: '' });

  const [newCategory, setNewCategory] = useState({ name: '', icon: '' });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      toast.error('No tienes permisos de administrador');
      navigate('/');
    }
  }, [isAdmin, adminLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProfiles(),
      fetchProducts(),
      fetchReports(),
      fetchReviews(),
      fetchCategories()
    ]);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    // Fetch admin roles for all users
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'admin');
    
    const adminUserIds = new Set((rolesData || []).map(r => r.user_id));
    
    const profilesWithRoles = (data || []).map(p => ({
      ...p,
      hasAdminRole: adminUserIds.has(p.id)
    }));
    
    setProfiles(profilesWithRoles);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching products:', error);
      return;
    }
    
    // Fetch seller info separately
    const productsWithProfiles = await Promise.all(
      (data || []).map(async (product) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', product.user_id)
          .single();
        return {
          ...product,
          profiles: profileData || undefined
        };
      })
    );
    
    setProducts(productsWithProfiles);
  };

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching reports:', error);
      return;
    }
    setReports(data || []);
  };

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching reviews:', error);
      return;
    }
    setReviews(data || []);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }
    setCategories(data || []);
  };

  const handleVerifyUser = async (userId: string, verified: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ verified, verified_at: verified ? new Date().toISOString() : null })
      .eq('id', userId);

    if (error) {
      toast.error('Error al actualizar verificación');
      return;
    }

    toast.success(verified ? 'Usuario verificado' : 'Verificación removida');
    fetchProfiles();
  };

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      // Add admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });

      if (error) {
        toast.error('Error al actualizar permisos');
        return;
      }
    } else {
      // Remove admin role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) {
        toast.error('Error al actualizar permisos');
        return;
      }
    }

    toast.success(makeAdmin ? 'Usuario ahora es admin' : 'Permisos de admin removidos');
    fetchProfiles();
  };

  const handleUpdateProductStatus = async (productId: string, status: string) => {
    const { error } = await supabase
      .from('products')
      .update({ status })
      .eq('id', productId);

    if (error) {
      toast.error('Error al actualizar estado');
      return;
    }

    toast.success('Estado actualizado');
    fetchProducts();
  };

  const handleDeleteProduct = async () => {
    if (!deleteDialog.id) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', deleteDialog.id);

    if (error) {
      toast.error('Error al eliminar producto');
      return;
    }

    toast.success('Producto eliminado');
    setDeleteDialog({ open: false, type: null, id: null, title: '' });
    fetchProducts();
  };

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    const { error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', reportId);

    if (error) {
      toast.error('Error al actualizar reporte');
      return;
    }

    toast.success('Reporte actualizado');
    fetchReports();
  };

  const handleDeleteReview = async () => {
    if (!deleteDialog.id) return;

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', deleteDialog.id);

    if (error) {
      toast.error('Error al eliminar reseña');
      return;
    }

    toast.success('Reseña eliminada');
    setDeleteDialog({ open: false, type: null, id: null, title: '' });
    fetchReviews();
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    const { error } = await supabase
      .from('categories')
      .insert({ name: newCategory.name, icon: newCategory.icon || null });

    if (error) {
      toast.error('Error al crear categoría');
      return;
    }

    toast.success('Categoría creada');
    setNewCategory({ name: '', icon: '' });
    fetchCategories();
  };

  const handleDeleteCategory = async () => {
    if (!deleteDialog.id) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', deleteDialog.id);

    if (error) {
      toast.error('Error al eliminar categoría');
      return;
    }

    toast.success('Categoría eliminada');
    setDeleteDialog({ open: false, type: null, id: null, title: '' });
    fetchCategories();
  };

  const handleDelete = () => {
    switch (deleteDialog.type) {
      case 'product':
        handleDeleteProduct();
        break;
      case 'review':
        handleDeleteReview();
        break;
      case 'category':
        handleDeleteCategory();
        break;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Activo</Badge>;
      case 'sold':
        return <Badge className="bg-blue-500">Vendido</Badge>;
      case 'reserved':
        return <Badge className="bg-yellow-500">Reservado</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactivo</Badge>;
      default:
        return <Badge variant="outline">{status || 'Sin estado'}</Badge>;
    }
  };

  const getReportStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500">Pendiente</Badge>;
      case 'reviewing':
        return <Badge className="bg-blue-500">En revisión</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500">Resuelto</Badge>;
      case 'dismissed':
        return <Badge variant="secondary">Descartado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const filteredProfiles = profiles.filter(p => 
    p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Panel de Administración</h1>
            <p className="text-muted-foreground">Gestiona usuarios, productos y contenido</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{profiles.length}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Usuarios
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{products.length}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" /> Productos
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{reports.filter(r => r.status === 'pending').length}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Flag className="h-4 w-4" /> Reportes pendientes
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{reviews.length}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Star className="h-4 w-4" /> Reseñas
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{categories.length}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" /> Categorías
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Productos</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              <span className="hidden sm:inline">Reportes</span>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Reseñas</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">Categorías</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Usuarios</CardTitle>
                <CardDescription>Administra verificaciones y permisos</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Fecha registro</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProfiles.map((profile) => (
                          <TableRow key={profile.id}>
                            <TableCell className="font-medium">
                              {profile.username || 'Sin username'}
                            </TableCell>
                            <TableCell>{profile.full_name || '-'}</TableCell>
                            <TableCell>
                              {format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {profile.verified && (
                                  <Badge className="bg-blue-500">Verificado</Badge>
                                )}
                                {profile.hasAdminRole && (
                                  <Badge className="bg-purple-500">Admin</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={profile.verified ? "outline" : "default"}
                                  onClick={() => handleVerifyUser(profile.id, !profile.verified)}
                                >
                                  {profile.verified ? (
                                    <Shield className="h-4 w-4" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={profile.hasAdminRole ? "destructive" : "secondary"}
                                  onClick={() => handleToggleAdmin(profile.id, !profile.hasAdminRole)}
                                  disabled={profile.id === user?.id}
                                >
                                  {profile.hasAdminRole ? 'Quitar Admin' : 'Hacer Admin'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Productos</CardTitle>
                <CardDescription>Modera y administra productos</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Precio</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {product.title}
                            </TableCell>
                            <TableCell>{product.price.toFixed(2)}€</TableCell>
                            <TableCell>
                              {product.profiles?.username || product.profiles?.full_name || 'Desconocido'}
                            </TableCell>
                            <TableCell>{getStatusBadge(product.status)}</TableCell>
                            <TableCell>
                              {format(new Date(product.created_at), 'dd/MM/yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/product/${product.id}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Select
                                  value={product.status || 'active'}
                                  onValueChange={(value) => handleUpdateProductStatus(product.id, value)}
                                >
                                  <SelectTrigger className="w-[120px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">Activo</SelectItem>
                                    <SelectItem value="sold">Vendido</SelectItem>
                                    <SelectItem value="reserved">Reservado</SelectItem>
                                    <SelectItem value="inactive">Inactivo</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setDeleteDialog({
                                    open: true,
                                    type: 'product',
                                    id: product.id,
                                    title: product.title
                                  })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Reportes</CardTitle>
                <CardDescription>Revisa y resuelve reportes de usuarios</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Razón</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">{report.reason}</TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {report.description || '-'}
                            </TableCell>
                            <TableCell>{getReportStatusBadge(report.status)}</TableCell>
                            <TableCell>
                              {format(new Date(report.created_at), 'dd/MM/yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={report.status}
                                onValueChange={(value) => handleUpdateReportStatus(report.id, value)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pendiente</SelectItem>
                                  <SelectItem value="reviewing">En revisión</SelectItem>
                                  <SelectItem value="resolved">Resuelto</SelectItem>
                                  <SelectItem value="dismissed">Descartado</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Reseñas</CardTitle>
                <CardDescription>Modera las reseñas de usuarios</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rating</TableHead>
                          <TableHead>Comentario</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviews.map((review) => (
                          <TableRow key={review.id}>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${
                                      i < review.rating 
                                        ? 'text-yellow-400 fill-yellow-400' 
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[400px] truncate">
                              {review.comment || '-'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(review.created_at), 'dd/MM/yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteDialog({
                                  open: true,
                                  type: 'review',
                                  id: review.id,
                                  title: 'esta reseña'
                                })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Categorías</CardTitle>
                <CardDescription>Administra las categorías de productos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <Input
                    placeholder="Nombre de categoría"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  />
                  <Input
                    placeholder="Icono (emoji o código)"
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                    className="w-40"
                  />
                  <Button onClick={handleAddCategory}>Añadir</Button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Icono</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Fecha creación</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="text-2xl">
                              {category.icon || '📦'}
                            </TableCell>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell>
                              {format(new Date(category.created_at), 'dd/MM/yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteDialog({
                                  open: true,
                                  type: 'category',
                                  id: category.id,
                                  title: category.name
                                })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente "{deleteDialog.title}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Admin;
