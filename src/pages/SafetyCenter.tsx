import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  Ban,
  BellRing,
  CheckCircle2,
  ExternalLink,
  FileWarning,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldQuestion,
  UserCheck,
  Users,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  formatSafetyDate,
  isActiveSafetyStatus,
  loadSafetyCenter,
  SAFETY_SOURCE_LABELS,
  SAFETY_STATUS_LABELS,
  safetyContextHref,
  type SafetyCenterData,
  type UnifiedSafetyReport,
  type UnifiedUserBlock,
} from '@/lib/trustSafety';

const EMPTY_DATA: SafetyCenterData = { reports: [], blocks: [], verified: false, failedSections: 0 };
const POLL_INTERVAL_MS = 30_000;

const SafetyCenter = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const requestInFlight = useRef(false);
  const [data, setData] = useState<SafetyCenterData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [unblockTarget, setUnblockTarget] = useState<UnifiedUserBlock | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  const refreshData = useCallback(async (manual = false, silent = false) => {
    if (!user || requestInFlight.current) return;
    requestInFlight.current = true;
    if (manual) setRefreshing(true);
    else if (!silent) setLoading(true);

    try {
      const next = await loadSafetyCenter(user.id);
      setData(next);
      if (manual && next.failedSections === 0) toast({ title: 'Centro de Protección actualizado' });
      if (!silent && next.failedSections > 0) {
        toast({ title: 'Información cargada parcialmente', description: 'Alguna sección no pudo actualizarse. Puedes volver a intentarlo.' });
      }
    } catch (error) {
      console.error('Error loading protection center:', error);
      if (!silent) toast({ title: 'No se pudo cargar tu protección', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (user?.id) void refreshData();
  }, [refreshData, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshData(false, true);
    };
    const intervalId = window.setInterval(refreshWhenVisible, POLL_INTERVAL_MS);

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('reveta:safety-changed', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('reveta:safety-changed', refreshWhenVisible);
    };
  }, [refreshData, user?.id]);

  const filteredReports = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.reports.filter((report) => {
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && isActiveSafetyStatus(report.status))
        || report.status === statusFilter;
      const matchesKind = kindFilter === 'all' || report.kind === kindFilter;
      const haystack = `${report.reason} ${report.details || ''} ${report.reportedName} ${report.productTitle || ''} ${SAFETY_SOURCE_LABELS[report.source] || report.source}`.toLowerCase();
      return matchesStatus && matchesKind && (!term || haystack.includes(term));
    });
  }, [data.reports, kindFilter, query, statusFilter]);

  const activeReports = data.reports.filter((report) => isActiveSafetyStatus(report.status)).length;
  const resolvedReports = data.reports.filter((report) => report.status === 'resolved').length;

  const unblock = async () => {
    if (!user || !unblockTarget || unblocking) return;
    setUnblocking(true);
    try {
      const { error } = await supabaseUntyped
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', unblockTarget.blockedId);
      if (error) throw error;
      setData((current) => ({ ...current, blocks: current.blocks.filter((block) => block.blockedId !== unblockTarget.blockedId) }));
      toast({ title: 'Usuario desbloqueado', description: 'Podrá volver a iniciar nuevas interacciones contigo.' });
      window.dispatchEvent(new CustomEvent('reveta:safety-changed'));
      setUnblockTarget(null);
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast({ title: 'No se pudo desbloquear', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setUnblocking(false);
    }
  };

  const ReportCard = ({ report }: { report: UnifiedSafetyReport }) => {
    const href = safetyContextHref(report);
    const active = isActiveSafetyStatus(report.status);
    return (
      <div className={`rounded-xl border p-4 ${active ? 'border-amber-300 bg-amber-50/40' : ''}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={report.kind === 'product' ? 'secondary' : 'outline'}>{report.kind === 'product' ? 'Producto' : 'Usuario'}</Badge>
              <Badge variant={report.status === 'resolved' ? 'default' : report.status === 'dismissed' ? 'secondary' : 'outline'}>{SAFETY_STATUS_LABELS[report.status]}</Badge>
              {report.reviewedAt && <Badge variant="outline">Revisado {formatSafetyDate(report.reviewedAt)}</Badge>}
            </div>
            <p className="mt-3 font-semibold">{report.reason}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {report.productTitle || report.reportedName} · {SAFETY_SOURCE_LABELS[report.source] || report.source} · {formatSafetyDate(report.createdAt)}
            </p>
            {report.details && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{report.details}</p>}
            <p className="mt-3 text-xs text-muted-foreground">
              {active ? 'El equipo puede cambiar el estado cuando empiece o termine la revisión.' : 'Este reporte ya no requiere ninguna acción por tu parte.'}
            </p>
          </div>
          {href && <Button variant="outline" size="sm" asChild><Link to={href}><ExternalLink className="mr-2 h-4 w-4" />Abrir contexto</Link></Button>}
        </div>
      </div>
    );
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <Helmet><title>Mi Centro de Protección | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div><Badge variant="secondary" className="mb-3"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Cuenta protegida</Badge><h1 className="text-3xl font-bold">Mi Centro de Protección</h1><p className="mt-2 text-muted-foreground">Consulta tus reportes, gestiona bloqueos y revisa las señales de confianza de tu cuenta.</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={refreshing} onClick={() => void refreshData(true)}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button><Button asChild><Link to="/seguridad">Consejos de seguridad</Link></Button></div>
          </div>

          {data.failedSections > 0 && <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Algunos datos no se pudieron actualizar</p><p>El resto del centro sigue disponible. Pulsa Actualizar dentro de unos segundos.</p></div></div>}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{activeReports}</CardTitle><CardDescription className="flex items-center gap-2"><Flag className="h-4 w-4" />Reportes activos</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{resolvedReports}</CardTitle><CardDescription className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Resueltos</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{data.blocks.length}</CardTitle><CardDescription className="flex items-center gap-2"><Ban className="h-4 w-4" />Usuarios bloqueados</CardDescription></CardHeader></Card>
            <Card className={data.verified ? 'border-green-300 bg-green-50/40' : ''}><CardHeader className="pb-2"><CardTitle className="text-2xl">{data.verified ? 'Verificada' : 'Pendiente'}</CardTitle><CardDescription className="flex items-center gap-2"><UserCheck className="h-4 w-4" />Identidad de cuenta</CardDescription></CardHeader></Card>
          </div>

          <Tabs defaultValue="reports" className="space-y-5">
            <TabsList className="grid w-full max-w-xl grid-cols-3"><TabsTrigger value="reports">Reportes</TabsTrigger><TabsTrigger value="blocks">Bloqueos</TabsTrigger><TabsTrigger value="trust">Confianza</TabsTrigger></TabsList>

            <TabsContent value="reports" className="space-y-4">
              <Card><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_190px_190px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar reporte, usuario o producto" className="pl-9" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="active">Abiertos y revisión</SelectItem><SelectItem value="resolved">Resueltos</SelectItem><SelectItem value="dismissed">Descartados</SelectItem></SelectContent></Select><Select value={kindFilter} onValueChange={setKindFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Productos y usuarios</SelectItem><SelectItem value="product">Solo productos</SelectItem><SelectItem value="user">Solo usuarios</SelectItem></SelectContent></Select></CardContent></Card>
              {filteredReports.length === 0 ? <Card><CardContent className="py-12 text-center"><ShieldQuestion className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-medium">No hay reportes con estos filtros</p><p className="mt-1 text-sm text-muted-foreground">Los reportes enviados desde productos o perfiles aparecerán aquí.</p></CardContent></Card> : <div className="space-y-3">{filteredReports.map((report) => <ReportCard key={`${report.kind}-${report.id}`} report={report} />)}</div>}
            </TabsContent>

            <TabsContent value="blocks">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Usuarios bloqueados</CardTitle><CardDescription>Un bloqueo impide nuevas conversaciones, mensajes y ofertas. El historial existente se conserva.</CardDescription></CardHeader><CardContent>{data.blocks.length === 0 ? <div className="py-10 text-center text-muted-foreground">No tienes usuarios bloqueados.</div> : <div className="space-y-3">{data.blocks.map((block) => <div key={block.blockedId} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{block.blockedName}</p><p className="text-sm text-muted-foreground">Bloqueado {formatSafetyDate(block.createdAt)}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" asChild><Link to={`/usuario/${encodeURIComponent(block.blockedId)}`}>Ver perfil</Link></Button><Button size="sm" variant="secondary" onClick={() => setUnblockTarget(block)}>Desbloquear</Button></div></div>)}</div>}</CardContent></Card>
            </TabsContent>

            <TabsContent value="trust" className="grid gap-5 lg:grid-cols-2">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Estado de tu cuenta</CardTitle><CardDescription>Completa estas señales para transmitir más confianza al comprar y vender.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex gap-3 rounded-xl border p-3"><UserCheck className={`mt-0.5 h-5 w-5 ${data.verified ? 'text-green-600' : 'text-muted-foreground'}`} /><div><p className="font-medium">{data.verified ? 'Cuenta verificada' : 'Verificación pendiente'}</p><p className="text-sm text-muted-foreground">La insignia de verificación aparece en tu perfil público.</p></div></div><div className="flex gap-3 rounded-xl border p-3"><BellRing className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Avisos de seguridad</p><p className="text-sm text-muted-foreground">Revisa notificaciones y mensajes cuando una operación requiera atención.</p></div></div><div className="flex gap-3 rounded-xl border p-3"><FileWarning className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Pruebas dentro de Reveta</p><p className="text-sm text-muted-foreground">Mantén acuerdos, imágenes y conversaciones dentro de la plataforma.</p></div></div><Button asChild className="w-full"><Link to="/profile?edit=1">{data.verified ? 'Revisar perfil' : 'Completar perfil y verificación'}</Link></Button></CardContent></Card>
              <Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle>Qué hacer ante un problema</CardTitle><CardDescription>Una ruta sencilla para proteger pruebas y recibir ayuda.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">1</span><p>Detén pagos o envíos si detectas una señal de fraude.</p></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">2</span><p>Conserva mensajes, fotos, seguimiento y comprobantes dentro de Reveta.</p></div><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">3</span><p>Reporta el producto o usuario y abre una incidencia desde la operación si existe una compra.</p></div><Button variant="outline" asChild className="w-full"><Link to="/transactions">Abrir Centro de operaciones</Link></Button></CardContent></Card>
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>

      <AlertDialog open={Boolean(unblockTarget)} onOpenChange={(open) => { if (!open && !unblocking) setUnblockTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desbloquear a {unblockTarget?.blockedName}</AlertDialogTitle><AlertDialogDescription>Esta persona podrá volver a iniciar conversaciones, mensajes y ofertas contigo. Las interacciones anteriores no se eliminan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={unblocking}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={unblocking} onClick={() => void unblock()}>{unblocking ? 'Desbloqueando...' : 'Desbloquear'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SafetyCenter;
