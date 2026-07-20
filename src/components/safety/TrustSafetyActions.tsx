import { useEffect, useState } from 'react';
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

interface TrustSafetyActionsProps {
  targetUserId: string;
  targetName: string;
}

const TrustSafetyActions = ({ targetUserId, targetName }: TrustSafetyActionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    if (!user || user.id === targetUserId) return;
    const loadBlockState = async () => {
      const { data, error } = await (supabase as any)
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId)
        .maybeSingle();
      if (!error) setIsBlocked(Boolean(data));
    };
    loadBlockState();
  }, [targetUserId, user]);

  if (!user || user.id === targetUserId) return null;

  const toggleBlock = async () => {
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
        if (error) throw error;
        setIsBlocked(true);
        toast({ title: 'Usuario bloqueado', description: 'No podrá iniciar nuevos chats, ofertas ni mensajes contigo.' });
      }
    } catch (error) {
      console.error('Error changing block state:', error);
      toast({ title: 'No se pudo actualizar el bloqueo', description: 'Ejecuta primero la migración de seguridad o inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setBlockDialogOpen(false);
    }
  };

  const submitReport = async () => {
    const details = reportDetails.trim().replace(/[ \t]+/g, ' ').slice(0, 1000);
    if (reportReason === 'Otro motivo' && details.length < 10) {
      toast({ title: 'Añade más información', description: 'Explica brevemente el motivo del reporte.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase as any).from('safety_reports').insert({
        reporter_id: user.id,
        reported_user_id: targetUserId,
        reason: reportReason,
        details: details || null,
        source: 'public_profile',
      });
      if (error) throw error;
      toast({ title: 'Reporte enviado', description: 'El equipo de Reveta revisará la situación.' });
      setReportDialogOpen(false);
      setReportDetails('');
      setReportReason(REPORT_REASONS[0]);
    } catch (error) {
      console.error('Error reporting user:', error);
      toast({ title: 'No se pudo enviar el reporte', description: 'Ejecuta primero la migración de seguridad o inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setReportDialogOpen(true)}>
          <Flag className="mr-2 h-4 w-4" /> Reportar usuario
        </Button>
        <Button variant={isBlocked ? 'secondary' : 'outline'} size="sm" onClick={() => setBlockDialogOpen(true)}>
          <Ban className="mr-2 h-4 w-4" /> {isBlocked ? 'Desbloquear' : 'Bloquear'}
        </Button>
      </div>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
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
            <AlertDialogAction onClick={toggleBlock} disabled={loading} className={!isBlocked ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
              {loading ? 'Guardando...' : isBlocked ? 'Desbloquear' : 'Bloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Reportar a {targetName}</AlertDialogTitle>
            <AlertDialogDescription>El reporte es privado. Incluye solo información útil y evita datos sensibles innecesarios.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Motivo</label>
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                {REPORT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Detalles opcionales</label>
              <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value.slice(0, 1000))} className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Explica qué ha ocurrido..." />
              <p className="mt-1 text-right text-xs text-muted-foreground">{reportDetails.length}/1000</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={submitReport} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading ? 'Enviando...' : 'Enviar reporte'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TrustSafetyActions;
