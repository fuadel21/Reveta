import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, BarChart3, CheckCircle2, Eye, Flag, Grid3X3, Loader2, Package, Search, ShieldAlert, ShieldCheck, Users, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
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

interface Profile { id: string; username: string | null; full_name: string | null; verified: boolean | null; created_at: string; hasAdminRole?: boolean; }
interface Product { id: string; title: string; price: number; status: string | null; created_at: string; user_id: string; profiles?: { username: string | null; full_name: string | null } | null; }
interface Report { id: string; source: 'legacy' | 'product'; reason: string; description: string | null; status: string; created_at: string; product_id?: string | null; product_title?: string | null; reporter_id?: string | null; seller_id?: string | null; }
interface Category { id: string; name: string; icon: string | null; created_at: string; }
interface Dispute { id: string; transaction_id: string; product_id: string; buyer_id: string; seller_id: string; opened_by: string; reason: string; details: string | null; status: string; resolution: string | null; created_at: string; closed_at: string | null; product_title?: string; buyer_name?: string | null; seller_name?: string | null; transaction_status?: string | null; amount?: number | null; }

const productPath = (id: string, title?: string | null) => {
  const slug = (title || 'producto').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'producto';
  return `/producto/${id}/${slug}`;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('es-ES');
const formatMoney = (value?: number | null) => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TERMINAL_DISPUTES = ['resolved_buyer', 'resolved_seller', 'closed'];
const REPORT_STATUSES = ['pending', 'reviewing', 'resolved', 'dismissed'];
const disputeSelect = 'id, transaction_id, product_id, buyer_id, seller_id, opened_by, reason, details, status, resolution, created_at, closed_at';

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
  const [activeTab, setActiveTab] = useState('disputes');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { if (!adminLoading && !isAdmin && user) { toast.error('No tienes permisos de administrador'); navigate('/'); } }, [isAdmin, adminLoading, user, navigate]);
  useEffect(() => { if (isAdmin) fetchAllData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isAdmin]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchProfiles(), fetchProducts(), fetchReports(), fetchCategories(), fetchDisputes()]);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('id, username, full_name, verified, created_at').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching profiles:', error); toast.error('No se pudieron cargar los usuarios'); return; }
    const { data: rolesData, error: rolesError } = await supabase.from('user_roles').select('user_id, role').eq('role', 'admin');
    if (rolesError) console.error('Error fetching roles:', rolesError);
    const adminUserIds = new Set((rolesData || []).map((role) => role.user_id));
    setProfiles((data || []).map((profile) => ({ ...profile, hasAdminRole: adminUserIds.has(profile.id) })));
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('id, title, price, status, created_at, user_id').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching products:', error); toast.error('No se pudieron cargar los productos'); return; }
    const productsWithProfiles = await Promise.all((data || []).map(async (product) => {
      const { data: profileData } = await supabase.from('profiles').select('username, full_name').eq('id', product.user_id).maybeSingle();
      return { ...product, profiles: profileData || null };
    }));
    setProducts(productsWithProfiles);
  };

  const fetchReports = async () => {
    const [legacyResult, productReportsResult] = await Promise.all([
      supabase.from('reports').select('id, reason, description, status, created_at').order('created_at', { ascending: false }),
      supabaseUntyped.from('product_reports').select('id, product_id, seller_id, reporter_id, reason, details, status, created_at').order('created_at', { ascending: false }),
    ]);
    if (legacyResult.error) console.error('Error fetching legacy reports:', legacyResult.error);
    if (productReportsResult.error) console.error('Error fetching product reports:', productReportsResult.error);
    if (legacyResult.error && productReportsResult.error) { toast.error('No se pudieron cargar los reportes'); setReports([]); return; }

    const legacyReports: Report[] = (legacyResult.data || []).map((report) => ({ id: report.id, source: 'legacy', reason: report.reason, description: report.description || null, status: report.status || 'pending', created_at: report.created_at }));
    const productReports: Report[] = await Promise.all((productReportsResult.data || []).map(async (report) => {
      let productTitle: string | null = null;
      if (report.product_id) {
        const { data: product } = await supabase.from('products').select('title').eq('id', report.product_id).maybeSingle();
        productTitle = product?.title || null;
      }
      return { id: report.id, source: 'product', reason: report.reason, description: report.details || null, status: report.status || 'pending', created_at: report.created_at, product_id: report.product_id || null, product_title: productTitle, reporter_id: report.reporter_id || null, seller_id: report.seller_id || null };
    }));
    setReports([...productReports, ...legacyReports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('id, name, icon, created_at').order('name', { ascending: true });
    if (error) { console.error('Error fetching categories:', error); toast.error('No se pudieron cargar las categorías'); return; }
    setCategories(data || []);
  };

  const fetchDisputes = async () => {
    const { data, error } = await supabaseUntyped.from('disputes').select(disputeSelect).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching disputes:', error); toast.error('No se pudieron cargar las incidencias'); return; }
    const enrichedDisputes = await Promise.all((data || []).map(async (dispute) => {
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

  const handleVerifyUser = async (profile: Profile, verified: boolean) => {
    if (profile.hasAdminRole && !verified) { toast.error('No se puede quitar la verificación a un administrador desde esta acción.'); return; }
    setUpdatingKey(`verify-${profile.id}`);
    const { error } = await supabaseUntyped.from('profiles').update({ verified, verified_at: verified ? new Date().toISOString() : null }).eq('id', profile.id);
    if (error) { toast.error('Error al actualizar verificación'); setUpdatingKey(null); return; }
    toast.success(verified ? 'Usuario verificado' : 'Verificación removida');
    await fetchProfiles();
    setUpdatingKey(null);
  };

  const handleMakeAdmin = async (profile: Profile) => {
    if (profile.hasAdminRole) { toast.info('Este usuario ya es administrador'); return; }
    setUpdatingKey(`admin-${profile.id}`);

    const { data: existingRole, error: checkError } = await supabaseUntyped
      .from('user_roles')
      .select('user_id')
      .eq('user_id', profile.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (checkError) {
      console.error('Error checking admin role:', checkError);
      toast.error('No se pudo comprobar el permiso admin');
      setUpdatingKey(null);
      return;
    }

    if (!existingRole) {
      const { error } = await supabaseUntyped.from('user_roles').insert({ user_id: profile.id, role: 'admin' });
      if (error) {
        console.error('Error making admin:', error);
        toast.error('Error al actualizar permisos');
        setUpdatingKey(null);
        return;
      }
    }

    toast.success('Usuario ahora es admin');
    await fetchProfiles();
    setUpdatingKey(null);
  };

  const handleUpdateProductStatus = async (product: Product, status: string) => {
    if (!['active', 'inactive'].includes(status)) { toast.error('Desde admin solo se permite activar o inactivar. Vendido/reservado lo gestiona la compra.'); return; }
    if (['sold', 'reserved'].includes(product.status || '')) { toast.error('No se puede cambiar manualmente un producto vendido o reservado. Revisa transacciones.'); return; }
    setUpdatingKey(`product-${product.id}`);
    const { error } = await supabase.from('products').update({ status }).eq('id', product.id);
    if (error) { toast.error('Error al actualizar estado'); setUpdatingKey(null); return; }
    toast.success(status === 'active' ? 'Producto activado' : 'Producto inactivado');
    await fetchProducts();
    setUpdatingKey(null);
  };

  const handleUpdateReportStatus = async (report: Report, status: string) => {
    if (!REPORT_STATUSES.includes(status)) { toast.error('Estado de reporte no válido'); return; }
    setUpdatingKey(`report-${report.source}-${report.id}`);
    const table = report.source === 'product' ? 'product_reports' : 'reports';
    const { error } = await supabaseUntyped.from(table).update({ status }).eq('id', report.id);
    if (error) { console.error('Error updating report:', error); toast.error('Error al actualizar reporte'); setUpdatingKey(null); return; }
    toast.success('Reporte actualizado');
    await fetchReports();
    setUpdatingKey(null);
  };

  const handleResolveDispute = async (dispute: Dispute, nextStatus: string) => {
    if (TERMINAL_DISPUTES.includes(dispute.status) && dispute.status !== nextStatus) { toast.error('Esta incidencia ya está cerrada. Usa el detalle si necesitas revisarla.'); return; }
    setUpdatingKey(`dispute-${dispute.id}`);
    const now = new Date().toISOString();
    const resolutionMap: Record<string, string | null> = { open: null, under_review: 'En revisión por Reveta', resolved_buyer: 'Resuelta a favor del comprador', resolved_seller: 'Resuelta a favor del vendedor', closed: 'Cerrada por Reveta' };
    const { error } = await supabaseUntyped.from('disputes').update({ status: nextStatus, resolution: resolutionMap[nextStatus] || null, updated_at: now, closed_at: TERMINAL_DISPUTES.includes(nextStatus) ? now : null }).eq('id', dispute.id);
    if (error) { toast.error('No se pudo actualizar la incidencia'); setUpdatingKey(null); return; }
    if (nextStatus === 'under_review') await supabaseUntyped.from('transactions').update({ status: 'under_review' }).eq('id', dispute.transaction_id);
    if (nextStatus === 'resolved_seller') await supabaseUntyped.from('transactions').update({ status: 'completed', completed_at: now }).eq('id', dispute.transaction_id);
    if (nextStatus === 'resolved_buyer' || nextStatus === 'closed') await supabaseUntyped.from('transactions').update({ status: 'disputed', completed_at: now }).eq('id', dispute.transaction_id);
    toast.success('Incidencia actualizada');
    await fetchDisputes();
    setUpdatingKey(null);
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

  const filteredProfiles = useMemo(() => profiles.filter((profile) => `${profile.username || ''} ${profile.full_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())), [profiles, searchTerm]);
  const filteredProducts = useMemo(() => products.filter((product) => `${product.title} ${product.profiles?.username || ''} ${product.profiles?.full_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())), [products, searchTerm]);
  const filteredReports = useMemo(() => reports.filter((report) => `${report.reason} ${report.description || ''} ${report.status} ${report.product_title || ''} ${report.source}`.toLowerCase().includes(searchTerm.toLowerCase())), [reports, searchTerm]);
  const filteredDisputes = useMemo(() => disputes.filter((dispute) => `${dispute.reason} ${dispute.product_title || ''} ${dispute.buyer_name || ''} ${dispute.seller_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())), [disputes, searchTerm]);

  if (authLoading || adminLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return null;

  const pendingReports = reports.filter((report) => report.status === 'pending').length;
  const activeDisputes = disputes.filter((dispute) => ['open', 'under_review'].includes(dispute.status)).length;
  const activeProducts = products.filter((product) => product.status === 'active').length;

  return (
    <>
      <Helmet><title>Centro de Control Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 mb-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-5 w-5" /></Button><div><h1 className="text-3xl font-bold">Centro de Control Reveta</h1><p className="text-muted-foreground">Gestiona usuarios, productos, crecimiento, reportes e incidencias.</p></div></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate('/admin/growth')}><BarChart3 className="h-4 w-4 mr-2" /> Crecimiento</Button><Button variant="outline" onClick={fetchAllData}><Loader2 className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar</Button></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{profiles.length}</CardTitle><CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" /> Usuarios</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeProducts}</CardTitle><CardDescription className="flex items-center gap-2"><Package className="h-4 w-4" /> Activos</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{pendingReports}</CardTitle><CardDescription className="flex items-center gap-2"><Flag className="h-4 w-4" /> Reportes</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeDisputes}</CardTitle><CardDescription className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Incidencias</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{categories.length}</CardTitle><CardDescription className="flex items-center gap-2"><Grid3X3 className="h-4 w-4" /> Categorías</CardDescription></CardHeader></Card>
          </div>

          <div className="grid gap-4 mb-8 md:grid-cols-4">
            <Card className="cursor-pointer transition hover:shadow-md" onClick={() => navigate('/admin/growth')}><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Crecimiento</CardTitle><CardDescription>Búsquedas, ciudades y productos clicados.</CardDescription></CardHeader></Card>
            <Card className="cursor-pointer transition hover:shadow-md" onClick={() => setActiveTab('disputes')}><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Incidencias</CardTitle><CardDescription>Revisa conflictos de compras.</CardDescription></CardHeader></Card>
            <Card className="cursor-pointer transition hover:shadow-md" onClick={() => setActiveTab('reports')}><CardHeader><CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5" /> Reportes</CardTitle><CardDescription>Denuncias de productos y reportes antiguos.</CardDescription></CardHeader></Card>
            <Card className="cursor-pointer transition hover:shadow-md" onClick={fetchAllData}><CardHeader><CardTitle className="flex items-center gap-2"><Loader2 className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /> Actualizar</CardTitle><CardDescription>Recarga todos los datos del panel.</CardDescription></CardHeader></Card>
          </div>

          <div className="relative mb-6"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" /><Input id="admin-search" placeholder="Buscar usuarios, productos, reportes o incidencias..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" /></div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="disputes" className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /><span className="hidden sm:inline">Protección</span></TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Usuarios</span></TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2"><Package className="h-4 w-4" /><span className="hidden sm:inline">Productos</span></TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2"><Flag className="h-4 w-4" /><span className="hidden sm:inline">Reportes</span></TabsTrigger>
              <TabsTrigger value="categories" className="flex items-center gap-2"><Grid3X3 className="h-4 w-4" /><span className="hidden sm:inline">Categorías</span></TabsTrigger>
            </TabsList>

            <TabsContent value="disputes">
              <Card><CardHeader><CardTitle>Centro de seguridad / Incidencias</CardTitle><CardDescription>Revisa incidencias entre comprador y vendedor. Usa “Ver detalle” para revisar mensajes antes de resolver.</CardDescription></CardHeader><CardContent>{loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : filteredDisputes.length === 0 ? <div className="text-center py-8 text-muted-foreground">No hay incidencias.</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Comprador</TableHead><TableHead>Vendedor</TableHead><TableHead>Motivo</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{filteredDisputes.map((dispute) => { const isTerminal = TERMINAL_DISPUTES.includes(dispute.status); return <TableRow key={dispute.id}><TableCell><div className="font-medium max-w-[180px] truncate">{dispute.product_title}</div>{dispute.amount !== null && dispute.amount !== undefined && <div className="text-xs text-muted-foreground">{formatMoney(dispute.amount)} €</div>}</TableCell><TableCell>{dispute.buyer_name}</TableCell><TableCell>{dispute.seller_name}</TableCell><TableCell><div className="font-medium max-w-[220px] truncate">{dispute.reason}</div>{dispute.details && <div className="text-xs text-muted-foreground max-w-[260px] truncate">{dispute.details}</div>}</TableCell><TableCell>{getDisputeStatusBadge(dispute.status)}</TableCell><TableCell>{formatDate(dispute.created_at)}</TableCell><TableCell><div className="flex flex-wrap gap-2 min-w-[330px]"><Button size="sm" variant="outline" onClick={() => navigate(`/admin/disputes/${dispute.id}`)}><Eye className="h-4 w-4 mr-1" /> Ver detalle</Button><Button size="sm" variant="outline" disabled={updatingKey === `dispute-${dispute.id}` || isTerminal} onClick={() => handleResolveDispute(dispute, 'under_review')}>En revisión</Button><Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={updatingKey === `dispute-${dispute.id}` || isTerminal} onClick={() => handleResolveDispute(dispute, 'resolved_buyer')}><CheckCircle2 className="h-4 w-4 mr-1" /> Comprador</Button><Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={updatingKey === `dispute-${dispute.id}` || isTerminal} onClick={() => handleResolveDispute(dispute, 'resolved_seller')}><CheckCircle2 className="h-4 w-4 mr-1" /> Vendedor</Button><Button size="sm" variant="secondary" disabled={updatingKey === `dispute-${dispute.id}` || isTerminal} onClick={() => handleResolveDispute(dispute, 'closed')}><XCircle className="h-4 w-4 mr-1" /> Cerrar</Button></div></TableCell></TableRow>; })}</TableBody></Table></div>}</CardContent></Card>
            </TabsContent>

            <TabsContent value="users">
              <Card><CardHeader><CardTitle>Gestión de Usuarios</CardTitle><CardDescription>Administra verificaciones y permisos sin exponer teléfono ni datos privados.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Nombre</TableHead><TableHead>Fecha registro</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{filteredProfiles.map((profile) => <TableRow key={profile.id}><TableCell className="font-medium">{profile.username || 'Sin username'}</TableCell><TableCell>{profile.full_name || '-'}</TableCell><TableCell>{formatDate(profile.created_at)}</TableCell><TableCell><div className="flex gap-1">{profile.verified && <Badge className="bg-blue-500">Verificado</Badge>}{profile.hasAdminRole && <Badge className="bg-purple-500">Admin</Badge>}</div></TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant={profile.verified ? 'outline' : 'default'} disabled={updatingKey === `verify-${profile.id}`} onClick={() => handleVerifyUser(profile, !profile.verified)}><ShieldCheck className="h-4 w-4" /></Button>{!profile.hasAdminRole && <Button size="sm" variant="secondary" disabled={updatingKey === `admin-${profile.id}`} onClick={() => handleMakeAdmin(profile)}>Hacer Admin</Button>}</div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
            </TabsContent>

            <TabsContent value="products">
              <Card><CardHeader><CardTitle>Gestión de Productos</CardTitle><CardDescription>Modera productos. Estados de venta/reserva se gestionan por transacciones, no manualmente.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Precio</TableHead><TableHead>Vendedor</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{filteredProducts.map((product) => { const lockedByTransaction = ['sold', 'reserved'].includes(product.status || ''); const safeSelectValue = product.status === 'inactive' ? 'inactive' : 'active'; return <TableRow key={product.id}><TableCell className="font-medium max-w-[220px] truncate">{product.title}</TableCell><TableCell>{formatMoney(product.price)} €</TableCell><TableCell>{product.profiles?.username || product.profiles?.full_name || 'Desconocido'}</TableCell><TableCell>{getStatusBadge(product.status)}</TableCell><TableCell>{formatDate(product.created_at)}</TableCell><TableCell><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => navigate(productPath(product.id, product.title))}><Eye className="h-4 w-4" /></Button>{lockedByTransaction ? <Button size="sm" variant="secondary" disabled>Gestionado</Button> : <Select value={safeSelectValue} onValueChange={(value) => handleUpdateProductStatus(product, value)} disabled={updatingKey === `product-${product.id}`}><SelectTrigger className="w-[125px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activo</SelectItem><SelectItem value="inactive">Inactivo</SelectItem></SelectContent></Select>}</div></TableCell></TableRow>; })}</TableBody></Table></div></CardContent></Card>
            </TabsContent>

            <TabsContent value="reports">
              <Card><CardHeader><CardTitle>Gestión de Reportes</CardTitle><CardDescription>Incluye denuncias de productos y reportes antiguos.</CardDescription></CardHeader><CardContent>{filteredReports.length === 0 ? <div className="py-8 text-center text-muted-foreground">No hay reportes.</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Producto</TableHead><TableHead>Razón</TableHead><TableHead>Descripción</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{filteredReports.map((report) => <TableRow key={`${report.source}-${report.id}`}><TableCell><Badge variant={report.source === 'product' ? 'default' : 'secondary'}>{report.source === 'product' ? 'Producto' : 'General'}</Badge></TableCell><TableCell>{report.product_id ? <Button size="sm" variant="link" className="h-auto p-0" onClick={() => navigate(productPath(report.product_id!, report.product_title || 'producto'))}>{report.product_title || 'Ver producto'}</Button> : '-'}</TableCell><TableCell className="font-medium max-w-[180px] truncate">{report.reason}</TableCell><TableCell className="max-w-[300px] truncate">{report.description || '-'}</TableCell><TableCell>{getReportStatusBadge(report.status)}</TableCell><TableCell>{formatDate(report.created_at)}</TableCell><TableCell><Select value={report.status} onValueChange={(value) => handleUpdateReportStatus(report, value)} disabled={updatingKey === `report-${report.source}-${report.id}`}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendiente</SelectItem><SelectItem value="reviewing">En revisión</SelectItem><SelectItem value="resolved">Resuelto</SelectItem><SelectItem value="dismissed">Descartado</SelectItem></SelectContent></Select></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
            </TabsContent>

            <TabsContent value="categories">
              <Card><CardHeader><CardTitle>Gestión de Categorías</CardTitle><CardDescription>Consulta las categorías de productos.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Icono</TableHead><TableHead>Nombre</TableHead><TableHead>Fecha creación</TableHead></TableRow></TableHeader><TableBody>{categories.map((category) => <TableRow key={category.id}><TableCell className="text-2xl">{category.icon || '📦'}</TableCell><TableCell className="font-medium">{category.name}</TableCell><TableCell>{formatDate(category.created_at)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default Admin;
