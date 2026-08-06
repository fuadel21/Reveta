import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  Loader2,
  PackageX,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  adminSafetyContextHref,
  formatSafetyDate,
  isActiveSafetyStatus,
  loadAdminSafety,
  SAFETY_SOURCE_LABELS,
  SAFETY_STATUS_LABELS,
  type AdminSafetyData,
  type UnifiedSafetyReport,
  type UnifiedSafetyStatus,
} from '@/lib/trustSafety';

const EMPTY_DATA: AdminSafetyData = { reports: [], blocks: [], failedSections: 0 };
const POLL_INTERVAL_MS = 30_000;
const PRODUCT_STATUS_MAP: Record<UnifiedSafetyStatus, string> = {
  open: 'pending',
  under_review: 'reviewing',
  resolved: 'resolved',
  dismissed: 'dismissed',
};

const AdminSafety = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const requestInFlight = useRef(false);
  const writeInFlight = useRef(false);
  const dirtyNotes = useRef(new Set<string>());
  const [data, setData] = useState<AdminSafetyData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [kindFilter, setKindFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState('all');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!adminLoading && user && !isAdmin) {
      toast.error('No tienes permisos de administrador');
      navigate('/');
    }
  }, [adminLoading, isAdmin, navigate, user]);

  const fetchData = useCallback(async (manual = false, silent = false, bypassWriteLock = false) => {
    if (!isAdmin || (!bypassWriteLock && writeInFlight.current) || requestInFlight.current) return;
    requestInFlight.current = true;
    if (manual) setRefreshing(true);
    else if (!silent) setLoading(true);

    try {
      const centerData = await loadAdminSafety();
      setData(centerData);
      setNotes((current) => {
        const next = { ...current };
        centerData.reports.forEach((report) => {
          if (report.kind === 'user' && !dirtyNotes.current.has(report.id)) {
            next[report.id] = report.resolutionNotes || '';
          }
        });
        return next;
      });
      if (manual && centerData.failedSections === 0) toast.success('Seguridad actualizada');
      if (!silent && centerData.failedSections > 0) toast.warning('La cola se cargó parcialmente');
    } catch (error) {
      console.error('Error loading admin safety center:', error);
      if (!silent) toast.error('No se pudo cargar la cola de seguridad');
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) void fetchData();
  }, [fetchData, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchData(false, true);
    };
    const intervalId = window.setInterval(refreshWhenVisible, POLL_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchData, isAdmin]);

  const waitForRefreshIdle = async () => {
    while (requestInFlight.current) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
    }
  };

  const updateReport = async (report: UnifiedSafetyReport, status: UnifiedSafetyStatus) => {
    if (!user || updatingKey) return;
    const key = `${report.kind}-${report.id}`;
    setUpdatingKey(key);
    writeInFlight.current = true;

    try {
      await waitForRefreshIdle();

      if (report.kind === 'user') {
        const cleanNotes = (notes[report.id] || '').trim().slice(0, 2000) || null;
        const { error } = await (supabase as any).rpc('admin_update_safety_report', {
          p_report_id: report.id,
          p_status: status,
          p_notes: cleanNotes,
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('product_reports')
          .update({ status: PRODUCT_STATUS_MAP[status] })
          .eq('id', report.id);
        if (error) throw error;
      }

      await fetchData(false, true, true);
      if (report.kind === 'user') dirtyNotes.current.delete(report.id);
      toast.success('Reporte actualizado');
    } catch (error) {
      console.error('Error updating safety report:', error);
      toast.error('No se pudo actualizar el reporte');
    } finally {
      writeInFlight.current = false;
      setUpdatingKey(null);
    }
  };

  const retireProduct = async (report: UnifiedSafetyReport) => {
    if (!report.productId || report.productStatus !== 'active' || updatingKey) return;
    const key = `retire-${report.productId}`;
    setUpdatingKey(key);

    try {
      const { data: updated, error } = await supabase
        .from('products')
        .update({ status: 'inactive' })
        .eq('id', report.productId)
        .eq('status', 'active')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!updated?.id) throw new Error('El anuncio ya había cambiado de estado');
      toast.success('Anuncio retirado de la publicación');
      await fetchData(false, true);
    } catch (error) {
      console.error('Error retiring reported product:', error);
      toast.error('No se pudo retirar el anuncio');
    } finally {
      setUpdatingKey(null);
    }
  };

  const filteredReports = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.reports.filter((report) => {
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && isActiveSafetyStatus(report.status))
        || report.status === statusFilter;
      const matchesKind = kindFilter === 'all' || report.kind === kindFilter;
      const matchesSource = sourceFilter === 'all' || report.source === sourceFilter;
      const matchesRecurrence = recurrenceFilter === 'all' || report.recurrence > 1;
      const haystack = `${report.reason} ${report.details || ''} ${report.reporterName} ${report.reportedName} ${report.productTitle || ''} ${SAFETY_SOURCE_LABELS[report.source] || report.source}`.toLowerCase();
      return matchesStatus && matchesKind && matchesSource && matchesRecurrence && (!term || haystack.includes(term));
    });
  }, [data.reports, kindFilter, query, recurrenceFilter, sourceFilter, statusFilter]);

  const openCount = data.reports.filter((report) => report.status === 'open').length;
  const reviewCount = data.reports.filter((report) => report.status === 'under_review').length;
  const repeatTargets = new Set(data.reports.filter((report) => report.recurrence > 1).map((report) => report.reportedUserId || report.productId)).size;
  const activeProductReports = data.reports.filter((report) => report.kind === 'product' && isActiveSafetyStatus(report.status) && report.productStatus === 'active').length;

  if (authLoading || adminLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return null;

  return (
    <>
      <Helmet><title>Seguridad administrativa | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <main className="min-h-screen bg-background">
        <div className="container py-8 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-5 w-5" /></Button>
              <div><h1 className="text-3xl font-bold">Centro de Protección y moderación</h1><p className="text-muted-foreground">Una cola única para denuncias de productos, usuarios, contextos y bloqueos.</p></div>
            </div>
            <Button variant="outline" disabled={refreshing} onClick={() => void fetchData(true)}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button>
          </div>

          {data.failedSections > 0 && <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">La cola se cargó parcialmente</p><p>Algunas tablas no respondieron. El resto de la moderación permanece disponible.</p></div></div>}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card><CardHeader className="pb-2"><CardTitle>{openCount}</CardTitle><CardDescription className="flex items-center gap-2"><Flag className="h-4 w-4" />Abiertos</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle>{reviewCount}</CardTitle><CardDescription className="flex items-center gap-2"><Clock3 className="h-4 w-4" />En revisión</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle>{repeatTargets}</CardTitle><CardDescription className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Reincidencias</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle>{activeProductReports}</CardTitle><CardDescription className="flex items-center gap-2"><PackageX className="h-4 w-4" />Anuncios activos reportados</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle>{data.blocks.length}</CardTitle><CardDescription className="flex items-center gap-2"><Ban className="h-4 w-4" />Bloqueos</CardDescription></CardHeader></Card>
          </div>

          <Tabs defaultValue="reports" className="space-y-5">
            <TabsList className="grid w-full max-w-md grid-cols-2"><TabsTrigger value="reports">Reportes</TabsTrigger><TabsTrigger value="blocks">Bloqueos</TabsTrigger></TabsList>

            <TabsContent value="reports" className="space-y-4">
              <Card><CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px_180px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario, producto o motivo" className="pl-9" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Pendientes y revisión</SelectItem><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="open">Abiertos</SelectItem><SelectItem value="under_review">En revisión</SelectItem><SelectItem value="resolved">Resueltos</SelectItem><SelectItem value="dismissed">Descartados</SelectItem></SelectContent></Select><Select value={kindFilter} onValueChange={setKindFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Productos y usuarios</SelectItem><SelectItem value="product">Productos</SelectItem><SelectItem value="user">Usuarios</SelectItem></SelectContent></Select><Select value={sourceFilter} onValueChange={setSourceFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los orígenes</SelectItem><SelectItem value="product">Producto</SelectItem><SelectItem value="public_profile">Perfil público</SelectItem><SelectItem value="chat">Conversación</SelectItem><SelectItem value="transaction">Operación</SelectItem></SelectContent></Select><Select value={recurrenceFilter} onValueChange={setRecurrenceFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="repeat">Solo reincidencias</SelectItem></SelectContent></Select></CardContent></Card>

              {loading ? <Card><CardContent className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></CardContent></Card> : filteredReports.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">No hay reportes con estos filtros.</CardContent></Card> : <div className="space-y-4">{filteredReports.map((report) => {
                const key = `${report.kind}-${report.id}`;
                const href = adminSafetyContextHref(report);
                const isUpdating = updatingKey === key || updatingKey === `retire-${report.productId}`;
                return (
                  <Card key={key} className={report.recurrence > 1 ? 'border-amber-300' : ''}>
                    <CardContent className="p-5">
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2"><Badge variant={report.kind === 'product' ? 'secondary' : 'outline'}>{report.kind === 'product' ? 'Producto' : 'Usuario'}</Badge><Badge variant={report.status === 'resolved' ? 'default' : report.status === 'dismissed' ? 'secondary' : 'outline'}>{SAFETY_STATUS_LABELS[report.status]}</Badge><Badge variant="outline">{SAFETY_SOURCE_LABELS[report.source] || report.source}</Badge>{report.recurrence > 1 && <Badge className="bg-amber-500">{report.recurrence} coincidencias</Badge>}</div>
                          <div><h2 className="text-lg font-semibold">{report.productTitle || report.reportedName}</h2><p className="text-sm text-muted-foreground">Reporta: {report.reporterName} · Reportado: {report.reportedName} · {formatSafetyDate(report.createdAt)}</p></div>
                          <div><p className="font-medium">{report.reason}</p>{report.details && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{report.details}</p>}</div>
                          <div className="flex flex-wrap gap-2">{href && <Button size="sm" variant="outline" asChild><Link to={href}><ExternalLink className="mr-1 h-4 w-4" />Abrir contexto</Link></Button>}{report.reportedUserId && <Button size="sm" variant="outline" asChild><Link to={`/usuario/${encodeURIComponent(report.reportedUserId)}`}>Ver perfil</Link></Button>}{report.kind === 'product' && report.productStatus === 'active' && <Button size="sm" variant="destructive" disabled={isUpdating} onClick={() => void retireProduct(report)}><PackageX className="mr-1 h-4 w-4" />Retirar anuncio</Button>}</div>
                        </div>

                        <div className="space-y-3">
                          {report.kind === 'user' ? <Textarea value={notes[report.id] || ''} onChange={(event) => { dirtyNotes.current.add(report.id); setNotes((current) => ({ ...current, [report.id]: event.target.value.slice(0, 2000) })); }} placeholder="Notas internas, pruebas y decisión..." rows={4} disabled={isUpdating} /> : <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">Las denuncias de producto conservan estado y contexto. Las notas internas se guardan en los reportes de usuario.</div>}
                          <div className="grid grid-cols-3 gap-2"><Button size="sm" variant="outline" disabled={isUpdating} onClick={() => void updateReport(report, 'under_review')}>Revisar</Button><Button size="sm" disabled={isUpdating} onClick={() => void updateReport(report, 'resolved')}><CheckCircle2 className="mr-1 h-4 w-4" />Resolver</Button><Button size="sm" variant="secondary" disabled={isUpdating} onClick={() => void updateReport(report, 'dismissed')}>Descartar</Button></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}</div>}
            </TabsContent>

            <TabsContent value="blocks">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Historial de bloqueos</CardTitle><CardDescription>Señal de conflictos repetidos. Solo la persona que creó el bloqueo puede retirarlo.</CardDescription></CardHeader><CardContent>{data.blocks.length === 0 ? <div className="py-10 text-center text-muted-foreground">No hay bloqueos registrados.</div> : <div className="space-y-3">{data.blocks.map((block) => <div key={`${block.blockerId}-${block.blockedId}`} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center"><div><p className="text-xs text-muted-foreground">Bloquea</p><p className="font-medium">{block.blockerName}</p></div><span className="hidden text-muted-foreground sm:block">→</span><div><p className="text-xs text-muted-foreground">Bloqueado</p><p className="font-medium">{block.blockedName}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{formatSafetyDate(block.createdAt)}</Badge><Button size="sm" variant="outline" asChild><Link to={`/usuario/${encodeURIComponent(block.blockedId)}`}>Perfil</Link></Button></div></div>)}</div>}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
};

export default AdminSafety;
