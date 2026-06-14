import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Package, Flag, ShieldAlert, Grid3X3, ShieldCheck, Eye, Search, Loader2, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Profile { id: string; username: string | null; full_name: string | null; verified: boolean | null; created_at: string; hasAdminRole?: boolean; }
interface Product { id: string; title: string; price: number; status: string | null; created_at: string; user_id: string; profiles?: { username: string | null; full_name: string | null } | null; }
interface Report { id: string; reason: string; description: string | null; status: string; created_at: string; }
interface Category { id: string; name: string; icon: string | null; created_at: string; }
interface Dispute { id: string; transaction_id: string; product_id: string; buyer_id: string; seller_id: string; opened_by: string; reason: string; details: string | null; status: string; resolution: string | null; created_at: string; closed_at: string | null; product_title?: string; buyer_name?: string | null; seller_name?: string | null; transaction_status?: string | null; amount?: number | null; }

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { if (!adminLoading && !isAdmin && user) { toast.error('No tienes permisos de administrador'); navigate('/'); } }, [isAdmin, adminLoading, user, navigate]);
  useEffect(() => { if (isAdmin) fetchAllData(); }, [isAdmin]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchProfiles(), fetchProducts(), fetchReports(), fetchCategories(), fetchDisputes()]);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching profiles:', error); return; }
    const { data: rolesData } = await supabase.from('user_roles').select('user_id, role').eq('role', 'admin');
    const adminUserIds = new Set((rolesData || []).map((role: any) => role.user_id));
    setProfiles((data || []).map((profile: any) => ({ ...profile, hasAdminRole: adminUserIds.has(profile.id) })));
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching products:', error); return; }
    const productsWithProfiles = await Promise.all((data || []).map(async (product: any) => {
      const { data: profileData } = await supabase.from('profiles').select('username, full_name').eq('id', product.user_id).maybeSingle();
      return { ...product, profiles: profileData || null };
    }));
    setProducts(productsWithProfiles);
  };

  const fetchReports = async () => {
    const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching reports:', error); return; }
    setReports(data || []);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (error) { console.error('Error fetching categories:', error); return; }
    setCategories(data || []);
  };

  const fetchDisputes = async () => {
    const { data, error } = await (supabase as any).from('disputes').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching disputes:', error); return; }
    const enrichedDisputes = await Promise.all((data || []).map(async (dispute: any) => {
      const [{ data: product }, { data: buyer }, { data: seller }, { data: transaction }] = await Promise.all([
        supabase.from('products').select('title').eq('id', dispute.product_id).maybeSingle(),
        supabase.from('profiles').select('full_name, username').eq('id', dispute.buyer_id).maybeSingle(),
        supabase.from('profiles').select('full_name, username').eq('id', dispute.seller_id).maybeSingle(),
        supabase.from('transactions').select('status, amount').eq('id', dispute.transaction_id).maybeSingle(),
      ]);
      return { ...dispute, product_title: product?.title || 'Producto eliminado', buyer_name: buyer?.full_name || buyer?.username || 'Comprador', seller_name: seller?.full_name || seller?.username || 'Vendedor', transaction_status: transaction?.status || null, amount: transaction?.amount || null } as Dispute;
    }));
    setDisputes(enrichedDisputes);
  };

  const handleVerifyUser = async (userId: string, verified: boolean) => {
    const { error } = await supabase.from('profiles').update({ verified, verified_at: verified ? new Date().toISOString() : null } as any).eq('id', userId);
    if (error) { toast.error('Error al actualizar verificación'); return; }
    toast.success(verified ? 'Usuario verificado' : 'Verificación removida');
    fetchProfiles();
  };

  const handleMakeAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
    if (error) { toast.error('Error al actualizar permisos'); return; }
    toast.success('Usuario ahora es admin');
    fetchProfiles();
  };

  const handleUpdateProductStatus = async (productId: string, status: string) => {
    const { error } = await supabase.from('products').update({ status }).eq('id', productId);
    if (error) { toast.error('Error al actualizar estado'); return; }
    toast.success('Estado actualizado');
    fetchProducts();
  };

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
    if (error) { toast.error('Error al actualizar reporte'); return; }
    toast.success('Reporte actualizado');
    fetchReports();
  };

  const handleResolveDispute = async (dispute: Dispute, nextStatus: string) => {
    const now = new Date().toISOString();
    const resolutionMap: Record<string, string | null> = { open: null, under_review: 'En revisión por Reveta', resolved_buyer: 'Resuelta a favor del comprador', resolved_seller: 'Resuelta a favor del vendedor', closed: 'Cerrada por Reveta' };
    const { error } = await (supabase as any).from('disputes').update({ status: nextStatus, resolution: resolutionMap[nextStatus] || null, updated_at: now, closed_at: ['resolved_buyer', 'resolved_seller', 'closed'].includes(nextStatus) ? now : null }).eq('id', dispute.id);
    if (error) { toast.error('No se pudo actualizar la incidencia'); return; }
    if (nextStatus === 'under_review') await supabase.from('transactions').update({ status: 'under_review' } as any).eq('id', dispute.transaction_id);
    if (nextStatus === 'resolved_seller') await supabase.from('transactions').update({ status: 'completed', completed_at: now } as any).eq('id', dispute.transaction_id);
    if (nextStatus === 'resolved_buyer' || nextStatus === 'closed') await supabase.from('transactions').update({ status: 'disputed', completed_at: now } as any).eq('id', dispute.transaction_id);
    toast.success('Incidencia actualizada');
    fetchDisputes();
  };

  const getStatusBadge = (status: string | null) => {
    if (status === 'active') return <Badge className="bg-green-500">Activo</Badge>;
    if (status === 'sold') return <Badge className="bg-blue-500">Vendido</Badge>;
    if (status === 'reserved') return <Badge className="bg-yellow-500">Reservado</Badge>;
    if (status === 'inactive') return <Badge variant="secondary">Inactivo</Badge>;
    return <Badge variant="outline">{status || 'Sin estado'}</Badge>;
  };

  const getReportStatusBadge = (status: string) => {
    if (status === 'pending') return <Badge className="bg-yellow-500">Pendiente</Badge>;
    if (status === 'reviewing') return <Badge className="bg-blue-500">En revisión</Badge>;
    if (status === 'resolved') return <Badge className="bg-green-500">Resuelto</Badge>;
    if (status === 'dismissed') return <Badge variant="secondary">Descartado</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const getDisputeStatusBadge = (status: string) => {
    if (status === 'open') return <Badge className="bg-yellow-500">Abierta</Badge>;
    if (status === 'under_review') return <Badge className="bg-blue-500">En revisión</Badge>;
    if (status === 'resolved_buyer') return <Badge className="bg-green-500">A favor comprador</Badge>;
    if (status === 'resolved_seller') return <Badge className="bg-green-500">A favor vendedor</Badge>;
    if (status === 'closed') return <Badge variant="secondary">Cerrada</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (authLoading || adminLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return null;

  const filteredProfiles = profiles.filter((profile) => profile.username?.toLowerCase().includes(searchTerm.toLowerCase()) || profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredProducts = products.filter((product) => product.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredDisputes = disputes.filter((dispute) => dispute.reason.toLowerCase().includes(searchTerm.toLowerCase()) || dispute.product_title?.toLowerCase().includes(searchTerm.toLowerCase()) || dispute.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || dispute.seller_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
      <Helmet><title>Centro de Control Reveta</title></Helmet>
      <div className="min-h-screen bg-background"><div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8"><Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-5 w-5" /></Button><div><h1 className="text-3xl font-bold">Centro de Control Reveta</h1><p className="text-muted-foreground">Gestiona usuarios, productos, reportes e incidencias</p></div></div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{profiles.length}</CardTitle><CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" /> Usuarios</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{products.length}</CardTitle><CardDescription className="flex items-center gap-2"><Package className="h-4 w-4" /> Productos</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{reports.filter((report) => report.status === 'pending').length}</CardTitle><CardDescription className="flex items-center gap-2"><Flag className="h-4 w-4" /> Reportes</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{disputes.filter((dispute) => ['open', 'under_review'].includes(dispute.status)).length}</CardTitle><CardDescription className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Incidencias</CardDescription></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{categories.length}</CardTitle><CardDescription className="flex items-center gap-2"><Grid3X3 className="h-4 w-4" /> Categorías</CardDescription></CardHeader></Card>
        </div>
        <div className="relative mb-6"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" /><Input placeholder="Buscar..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" /></div>
        <Tabs defaultValue="disputes" className="space-y-4"><TabsList className="grid w-full grid-cols-5"><TabsTrigger value="disputes" className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /><span className="hidden sm:inline">Protección</span></TabsTrigger><TabsTrigger value="users" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Usuarios</span></TabsTrigger><TabsTrigger value="products" className="flex items-center gap-2"><Package className="h-4 w-4" /><span className="hidden sm:inline">Productos</span></TabsTrigger><TabsTrigger value="reports" className="flex items-center gap-2"><Flag className="h-4 w-4" /><span className="hidden sm:inline">Reportes</span></TabsTrigger><TabsTrigger value="categories" className="flex items-center gap-2"><Grid3X3 className="h-4 w-4" /><span className="hidden sm:inline">Categorías</span></TabsTrigger></TabsList>
          <TabsContent value="disputes"><Card><CardHeader><CardTitle>Protección Reveta / Incidencias</CardTitle><CardDescription>Revisa incidencias entre comprador y vendedor</CardDescription></CardHeader><CardContent>{loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : filteredDisputes.length === 0 ? <div className="text-center py-8 text-muted-foreground">No hay incidencias.</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Comprador</TableHead><TableHead>Vendedor</TableHead><TableHead>Motivo</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{filteredDisputes.map((dispute) => <TableRow key={dispute.id}><TableCell><div className="font-medium max-w-[180px] truncate">{dispute.product_title}</div>{dispute.amount !== null && dispute.amount !== undefined && <div className="text-xs text-muted-foreground">{dispute.amount.toLocaleString('es-ES')} €</div>}</TableCell><TableCell>{dispute.buyer_name}</TableCell><TableCell>{dispute.seller_name}</TableCell><TableCell><div className="font-medium max-w-[220px] truncate">{dispute.reason}</div>{dispute.details && <div className="text-xs text-muted-foreground max-w-[260px] truncate">{dispute.details}</div>}</TableCell><TableCell>{getDisputeStatusBadge(dispute.status)}</TableCell><TableCell>{format(new Date(dispute.created_at), 'dd/MM/yyyy', { locale: es })}</TableCell><TableCell><div className="flex flex-wrap gap-2 min-w-[330px]"><Button size="sm" variant="outline" onClick={() => navigate(`/admin/disputes/${dispute.id}`)}><Eye className="h-4 w-4 mr-1" /> Ver detalle</Button><Button size="sm" variant="outline" onClick={() => handleResolveDispute(dispute, 'under_review')}>En revisión</Button><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleResolveDispute(dispute, 'resolved_buyer')}><CheckCircle2 className="h-4 w-4 mr-1" /> Comprador</Button><Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleResolveDispute(dispute, 'resolved_seller')}><CheckCircle2 className="h-4 w-4 mr-1" /> Vendedor</Button><Button size="sm" variant="secondary" onClick={() => handleResolveDispute(dispute, 'closed')}><XCircle className="h-4 w-4 mr-1" /> Cerrar</Button></div></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card></TabsContent>
          <TabsContent value="users"><Card><CardHeader><CardTitle>Gestión de Usuarios</CardTitle><CardDescription>Administra verificaciones y permisos</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Nombre</TableHead><TableHead>Fecha registro</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{filteredProfiles.map((profile) => <TableRow key={profile.id}><TableCell className="font-medium">{profile.username || 'Sin username'}</TableCell><TableCell>{profile.full_name || '-'}</TableCell><TableCell>{format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: es })}</TableCell><TableCell><div className="flex gap-1">{profile.verified && <Badge className="bg-blue-500">Verificado</Badge>}{profile.hasAdminRole && <Badge className="bg-purple-500">Admin</Badge>}</div></TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant={profile.verified ? 'outline' : 'default'} onClick={() => handleVerifyUser(profile.id, !profile.verified)}><ShieldCheck className="h-4 w-4" /></Button>{!profile.hasAdminRole && <Button size="sm" variant="secondary" onClick={() => handleMakeAdmin(profile.id)}>Hacer Admin</Button>}</div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
          <TabsContent value="products"><Card><CardHeader><CardTitle>Gestión de Productos</CardTitle><CardDescription>Modera y administra productos</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Precio</TableHead><TableHead>Vendedor</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{filteredProducts.map((product) => <TableRow key={product.id}><TableCell className="font-medium max-w-[220px] truncate">{product.title}</TableCell><TableCell>{product.price.toFixed(2)} €</TableCell><TableCell>{product.profiles?.username || product.profiles?.full_name || 'Desconocido'}</TableCell><TableCell>{getStatusBadge(product.status)}</TableCell><TableCell>{format(new Date(product.created_at), 'dd/MM/yyyy', { locale: es })}</TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => navigate(`/product/${product.id}`)}><Eye className="h-4 w-4" /></Button><Select value={product.status || 'active'} onValueChange={(value) => handleUpdateProductStatus(product.id, value)}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activo</SelectItem><SelectItem value="sold">Vendido</SelectItem><SelectItem value="reserved">Reservado</SelectItem><SelectItem value="inactive">Inactivo</SelectItem></SelectContent></Select></div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
          <TabsContent value="reports"><Card><CardHeader><CardTitle>Gestión de Reportes</CardTitle><CardDescription>Revisa y resuelve reportes de usuarios</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Razón</TableHead><TableHead>Descripción</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{reports.map((report) => <TableRow key={report.id}><TableCell className="font-medium">{report.reason}</TableCell><TableCell className="max-w-[300px] truncate">{report.description || '-'}</TableCell><TableCell>{getReportStatusBadge(report.status)}</TableCell><TableCell>{format(new Date(report.created_at), 'dd/MM/yyyy', { locale: es })}</TableCell><TableCell><Select value={report.status} onValueChange={(value) => handleUpdateReportStatus(report.id, value)}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="reviewing">En revisión</SelectItem><SelectItem value="resolved">Resuelto</SelectItem><SelectItem value="dismissed">Descartado</SelectItem></SelectContent></Select></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
          <TabsContent value="categories"><Card><CardHeader><CardTitle>Gestión de Categorías</CardTitle><CardDescription>Administra las categorías de productos</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Icono</TableHead><TableHead>Nombre</TableHead><TableHead>Fecha creación</TableHead></TableRow></TableHeader><TableBody>{categories.map((category) => <TableRow key={category.id}><TableCell className="text-2xl">{category.icon || '📦'}</TableCell><TableCell className="font-medium">{category.name}</TableCell><TableCell>{format(new Date(category.created_at), 'dd/MM/yyyy', { locale: es })}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
        </Tabs>
      </div></div>
    </>
  );
};

export default Admin;
