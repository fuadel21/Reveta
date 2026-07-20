import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Ban, CheckCircle2, Clock3, Flag, Loader2, RefreshCw, Search, ShieldAlert, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

type SafetyReport = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  product_id: string | null;
  conversation_id: string | null;
  reason: string;
  details: string | null;
  source: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  reporter_name?: string;
  reported_name?: string;
  recurrence?: number;
};

type UserBlock = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  blocker_name?: string;
  blocked_name?: string;
};

const statusLabel: Record<string, string> = {
  open: 'Abierto',
  under_review: 'En revisión',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
};

const sourceLabel: Record<string, string> = {
  public_profile: 'Perfil público',
  product: 'Producto',
  chat: 'Chat',
  transaction: 'Transacción',
  unknown: 'Otro',
};

const formatDate = (value: string) => new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

const AdminSafety = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [blocks, setBlocks] = useState<UserBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!adminLoading && user && !isAdmin) {
      toast.error('No tienes permisos de administrador');
      navigate('/');
    }
  }, [adminLoading, user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const profileName = async (id: string | null) => {
    if (!id) return 'Usuario eliminado';
    const { data } = await supabase.from('profiles').select('full_name, username').eq('id', id).maybeSingle();
    return data?.full_name || data?.username || id.slice(0, 8);
  };

  const fetchData = async () => {
    setLoading(true);
    const [reportResult, blockResult] = await Promise.all([
      (supabase as any).from('safety_reports').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('user_blocks').select('*').order('created_at', { ascending: false }),
    ]);

    if (reportResult.error) {
      console.error('Error loading safety reports:', reportResult.error);
      toast.error('No se pudieron cargar los reportes de seguridad');
    }
    if (blockResult.error) console.error('Error loading blocks:', blockResult.error);

    const rawReports = (reportResult.data || []) as SafetyReport[];
    const recurrence = rawReports.reduce<Record<string, number>>((acc, report) => {
      if (report.reported_user_id) acc[report.reported_user_id] = (acc[report.reported_user_id] || 0) + 1;
      return acc;
    }, {});

    const enrichedReports = await Promise.all(rawReports.map(async (report) => ({
      ...report,
      reporter_name: await profileName(report.reporter_id),
      reported_name: await profileName(report.reported_user_id),
      recurrence: report.reported_user_id ? recurrence[report.reported_user_id] || 1 : 1,
    })));

    const enrichedBlocks = await Promise.all(((blockResult.data || []) as UserBlock[]).map(async (block) => ({
      ...block,
      blocker_name: await profileName(block.blocker_id),
      blocked_name: await profileName(block.blocked_id),
    })));

    setReports(enrichedReports);
    setBlocks(enrichedBlocks);
    setNotes(Object.fromEntries(enrichedReports.map((report) => [report.id, report.resolution_notes || ''])));
    setLoading(false);
  };

  const updateReport = async (report: SafetyReport, status: SafetyReport['status']) => {
    if (!user) return;
    setUpdatingId(report.id);
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from('safety_reports')
      .update({
        status,
        resolution_notes: notes[report.id]?.trim() || null,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq('id', report.id);

    if (error) {
      console.error('Error updating safety report:', error);
      toast.error('No se pudo actualizar el reporte');
    } else {
      toast.success('Reporte actualizado');
      await fetchData();
    }
    setUpdatingId(null);
  };

  const filteredReports = useMemo(() => {
    const term = query.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && ['open', 'under_review'].includes(report.status))
        || report.status === statusFilter;
      const haystack = `${report.reason} ${report.details || ''} ${report.reporter_name || ''} ${report.reported_name || ''} ${report.source}`.toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [reports, query, statusFilter]);

  const openCount = reports.filter((report) => report.status === 'open').length;
  const reviewCount = reports.filter((report) => report.status === 'under_review').length;
  const repeatUsers = new Set(reports.filter((report) => (report.recurrence || 0) > 1).map((report) => report.reported_user_id)).size;

  if (authLoading || adminLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return null;

  return (
    <>
      <Helmet><title>Seguridad administrativa | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <main className="min-h-screen bg-background">
        <div className="container py-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-5 w-5" /></Button>
              <div><h1 className="text-3xl font-bold">Seguridad y moderación</h1><p className="text-muted-foreground">Extensión del centro de control para reportes de usuarios, reincidencias y bloqueos.</p></div>
            </div>
            <Button variant="outline" onClick={fetchData}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualizar</Button>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle>{openCount}</CardTitle><CardDescription className="flex items-center gap-2"><Flag className="h-4 w-4" />Abiertos</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle>{reviewCount}</CardTitle><CardDescription className="flex items-center gap-2"><Clock3 className="h-4 w-4" />En revisión</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle>{repeatUsers}</CardTitle><CardDescription className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Reincidentes</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle>{blocks.length}</CardTitle><CardDescription className="flex items-center gap-2"><Ban className="h-4 w-4" />Bloqueos activos</CardDescription></CardHeader></Card>
          </div>

          <Card className="mb-8">
            <CardHeader><CardTitle>Reportes de seguridad</CardTitle><CardDescription>Reportes creados desde perfiles, productos, chats y transacciones.</CardDescription></CardHeader>
            <CardContent>
              <div className="mb-5 grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar motivo, usuario o contenido..." className="pl-9" /></div>
                <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Pendientes y revisión</SelectItem><SelectItem value="all">Todos</SelectItem><SelectItem value="open">Abiertos</SelectItem><SelectItem value="under_review">En revisión</SelectItem><SelectItem value="resolved">Resueltos</SelectItem><SelectItem value="dismissed">Descartados</SelectItem></SelectContent></Select>
              </div>

              {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : filteredReports.length === 0 ? <div className="py-10 text-center text-muted-foreground">No hay reportes con estos filtros.</div> : (
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Reportado</TableHead><TableHead>Origen</TableHead><TableHead>Motivo</TableHead><TableHead>Estado</TableHead><TableHead>Notas internas</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>
                  {filteredReports.map((report) => <TableRow key={report.id}>
                    <TableCell><div className="font-medium">{report.reported_name}</div><div className="text-xs text-muted-foreground">Reporta: {report.reporter_name}</div>{(report.recurrence || 0) > 1 && <Badge className="mt-1 bg-amber-500">{report.recurrence} reportes</Badge>}</TableCell>
                    <TableCell><Badge variant="outline">{sourceLabel[report.source] || report.source}</Badge><div className="mt-1 text-xs text-muted-foreground">{formatDate(report.created_at)}</div></TableCell>
                    <TableCell><div className="font-medium max-w-[220px]">{report.reason}</div>{report.details && <div className="mt-1 max-w-[260px] text-xs text-muted-foreground">{report.details}</div>}</TableCell>
                    <TableCell><Badge variant={report.status === 'resolved' ? 'default' : report.status === 'dismissed' ? 'secondary' : 'outline'}>{statusLabel[report.status]}</Badge></TableCell>
                    <TableCell><Textarea value={notes[report.id] || ''} onChange={(e) => setNotes((current) => ({ ...current, [report.id]: e.target.value }))} placeholder="Decisión, pruebas o seguimiento..." rows={3} maxLength={2000} className="min-w-[240px]" /></TableCell>
                    <TableCell><div className="flex min-w-[260px] flex-wrap gap-2"><Button size="sm" variant="outline" disabled={updatingId === report.id} onClick={() => updateReport(report, 'under_review')}>Revisar</Button><Button size="sm" disabled={updatingId === report.id} onClick={() => updateReport(report, 'resolved')}><CheckCircle2 className="mr-1 h-4 w-4" />Resolver</Button><Button size="sm" variant="secondary" disabled={updatingId === report.id} onClick={() => updateReport(report, 'dismissed')}>Descartar</Button></div></TableCell>
                  </TableRow>)}
                </TableBody></Table></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Historial de bloqueos</CardTitle><CardDescription>Señal adicional para detectar conflictos repetidos. Los bloqueos solo puede retirarlos quien los creó.</CardDescription></CardHeader>
            <CardContent>{blocks.length === 0 ? <div className="py-8 text-center text-muted-foreground">No hay bloqueos registrados.</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuario que bloquea</TableHead><TableHead>Usuario bloqueado</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader><TableBody>{blocks.map((block) => <TableRow key={`${block.blocker_id}-${block.blocked_id}`}><TableCell>{block.blocker_name}</TableCell><TableCell>{block.blocked_name}</TableCell><TableCell>{formatDate(block.created_at)}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default AdminSafety;
