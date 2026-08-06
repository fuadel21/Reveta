import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Flag, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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

const REPORT_REASONS = [
  'Posible fraude o estafa',
  'Comportamiento ofensivo o acoso',
  'Intento de pago fuera de Reveta',
  'Identidad o información sospechosa',
  'Productos prohibidos o engañosos',
  'Otro motivo',
];

type SafetySource = 'public_profile' | 'product' | 'chat' | 'transaction';

interface TrustSafetyActionsProps {
  targetUserId: string;
  targetName: string;
  source?: SafetySource;
  productId?: string | null;
  conversationId?: string | null;
}

const TrustSafetyActions = ({
  targetUserId,
  targetName,
  source = 'public_profile',
  productId = null,
  conversationId = null,
}: TrustSafetyActionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBlocked, setIsBlocked] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    if (!user || user.id === targetUserId) return;

    const loadState = async () => {
      const [blockResult, reportResult] = await Promise.all([
        (supabase as any)
          .from('user_blocks')
          .select('blocked_id')
          .eq('blocker_id', user.id)
          .eq('blocked_id', targetUserId)
          .maybeSingle(),
        findActiveReport(),
      ]);
      if (!blockResult.error) setIsBlocked(Boolean(blockResult.data));
      setAlreadyReported(Boolean(reportResult));
    };

    void loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, productId, source, targetUserId, user?.id]);

  if (!user || user.id === targetUserId) return null;

  const notifySafetyChange = () => window.dispatchEvent(new CustomEvent('reveta:safety-changed'));

  async function findActiveReport() {
    if (!user) return null;
    let query = (supabase as any)
      .from('safety_reports')
      .select('id,status')
      .eq('reporter_id', user.id)
      .eq('reported_user_id', targetUserId)
      .eq('source', source)
      .in('status', ['open', 'under_review'])
      .limit(1);

    query = productId ? query.eq('product_id', productId) : query.is('product_id', null);
    query = conversationId ? query.eq('conversation_id', conversationId) : query.is('conversation_id', null);
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('Error checking active safety report:', error);
      return null;
    }
    return data || null;
  }

  const toggleBlock = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isBlocked) {
        const { error } = await (supabase as any)
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', targetUserId);
        if (error) throw error;
        setIsBlocked(false);
        toast({ title: 'Usuario desbloqueado', description: 'Podrá volver a iniciar interacciones contigo.' });
      } else {
        const { error } = await (supabase as any)
          .from('user_blocks')
          .insert({ blocker_id: user.id, blocked_id: targetUserId });
        if (error && error.code !== '23505') throw error;
        setIsBlocked(true);
        toast({ title: 'Usuario bloqueado', description: 'No podrá iniciar nuevos chats, ofertas ni mensajes contigo.' });
      }
      notifySafetyChange();
    } catch (error) {
      console.error('Error changing block state:', error);
      toast({ title: 'No se pudo actualizar el bloqueo', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setBlockDialogOpen(false);
    }
  };

  const submitReport = async () => {
    if (loading) return;
    const details = reportDetails.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, 1000);
    if (reportReason === 'Otro motivo' && details.length < 10) {
      toast({ title: 'Añade más información', description: 'Explica brevemente el motivo del reporte.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const existing = await findActiveReport();
      if (existing) {
        setAlreadyReported(true);
        toast({ title: 'Este reporte ya está activo', description: 'Puedes seguir su estado desde Mi Centro de Protección.' });
        return;
      }

      const { error } = await (supabase as any).from('safety_reports').insert({
        reporter_id: user.id,
        reported_user_id: targetUserId,
        product_id: productId,
        conversation_id: conversationId,
        reason: reportReason,
        details: details || null,
        source,
        status: 'open',
      });
      if (error) throw error;
      setAlreadyReported(true);
      toast({ title: 'Reporte enviado', description: 'El equipo de Reveta revisará la situación.' });
      setReportDetails('');
      setReportReason(REPORT_REASONS[0]);
      notifySafetyChange();
    } catch (error) {
      console.error('Error reporting user:', error);
      toast({ title: 'No se pudo enviar el reporte', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={loading} onClick={() => setReportDialogOpen(true)}>
          <Flag className="mr-2 h-4 w-4" /> {alreadyReported ? 'Reporte activo' : 'Reportar usuario'}
        </Button>
        <Button variant={isBlocked ? 'secondary' : 'outline'} size="sm" disabled={loading} onClick={() => setBlockDialogOpen(true)}>
          <Ban className="mr-2 h-4 w-4" /> {isBlocked ? 'Desbloquear' : 'Bloquear'}
        </Button>
      </div>

      <AlertDialog open={blockDialogOpen} onOpenChange={(open) => { if (!loading) setBlockDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isBlocked ? 'Desbloquear usuario' : 'Bloquear usuario'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isBlocked
                ? `${targetName} podrá volver a iniciar conversaciones, mensajes y ofertas contigo.`
                : `${targetName} no podrá iniciar nuevos chats, mensajes ni ofertas contigo. Las operaciones ya abiertas se conservan para evitar perder pruebas o historial.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void toggleBlock()} disabled={loading} className={!isBlocked ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
              {loading ? 'Guardando...' : isBlocked ? 'Desbloquear' : 'Bloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reportDialogOpen} onOpenChange={(open) => { if (!loading) setReportDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Reportar a {targetName}</AlertDialogTitle>
            <AlertDialogDescription>El reporte es privado y queda vinculado al contexto desde el que se envía.</AlertDialogDescription>
          </AlertDialogHeader>

          {alreadyReported ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Ya existe un reporte abierto o en revisión para este usuario y contexto. No hace falta enviarlo de nuevo.</div>
              <Button asChild className="w-full"><Link to="/mi-proteccion">Ver estado en Mi protección</Link></Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Motivo</label>
                <select value={reportReason} disabled={loading} onChange={(event) => setReportReason(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {REPORT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Detalles opcionales</label>
                <textarea value={reportDetails} disabled={loading} onChange={(event) => setReportDetails(event.target.value.slice(0, 1000))} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Explica qué ha ocurrido..." />
                <p className="mt-1 text-right text-xs text-muted-foreground">{reportDetails.length}/1000</p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void submitReport()} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {loading ? 'Enviando...' : 'Enviar reporte'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TrustSafetyActions;
