import { useRef, useState } from 'react';
import { AlertTriangle, Flag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ReportProductButtonProps {
  productId: string;
  sellerId: string;
  productTitle: string;
  isOwner: boolean;
}

const REPORT_REASONS = [
  { value: 'possible_fraud', label: 'Posible fraude o estafa' },
  { value: 'fake_product', label: 'Producto falso o sospechoso' },
  { value: 'prohibited_item', label: 'Producto no permitido' },
  { value: 'suspicious_price', label: 'Precio demasiado sospechoso' },
  { value: 'spam', label: 'Spam o anuncio repetido' },
  { value: 'other', label: 'Otro motivo' },
] as const;

type ReportReason = typeof REPORT_REASONS[number]['value'];

const allowedReasons = new Set(REPORT_REASONS.map((reason) => reason.value));
const normalizeDetails = (value: string) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, 800);

const ReportProductButton = ({ productId, sellerId, productTitle, isOwner }: ReportProductButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const submitLockRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('possible_fraud');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);

  if (isOwner) return null;

  const openReportDialog = async () => {
    if (!user) {
      toast({ title: 'Inicia sesión', description: 'Debes iniciar sesión para denunciar un producto.', variant: 'destructive' });
      return;
    }

    if (!productId || !sellerId || user.id === sellerId) {
      toast({ title: 'No permitido', description: 'No puedes denunciar este producto.', variant: 'destructive' });
      return;
    }

    const { data } = await (supabase as any)
      .from('product_reports')
      .select('id')
      .eq('product_id', productId)
      .eq('reporter_id', user.id)
      .maybeSingle();

    setAlreadyReported(!!data?.id);
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (!user) {
      toast({ title: 'Inicia sesión', description: 'Debes iniciar sesión para denunciar un producto.', variant: 'destructive' });
      return;
    }

    if (!productId || !sellerId || user.id === sellerId) {
      toast({ title: 'No permitido', description: 'No puedes denunciar este producto.', variant: 'destructive' });
      return;
    }

    if (!allowedReasons.has(reason)) {
      toast({ title: 'Motivo no válido', description: 'Selecciona un motivo válido.', variant: 'destructive' });
      return;
    }

    const safeDetails = normalizeDetails(details);
    if (reason === 'other' && safeDetails.length < 10) {
      toast({ title: 'Añade algún detalle', description: 'Para “otro motivo”, escribe una breve explicación.', variant: 'destructive' });
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);

    try {
      const { data: existingReport } = await (supabase as any)
        .from('product_reports')
        .select('id')
        .eq('product_id', productId)
        .eq('reporter_id', user.id)
        .maybeSingle();

      if (existingReport?.id) {
        setAlreadyReported(true);
        toast({ title: 'Ya lo has denunciado', description: 'Este producto ya está en revisión por el equipo de Reveta.' });
        return;
      }

      const { error } = await (supabase as any).from('product_reports').insert({
        product_id: productId,
        reporter_id: user.id,
        seller_id: sellerId,
        reason,
        details: safeDetails || null,
        status: 'pending',
      });

      if (error) throw error;

      toast({ title: 'Denuncia enviada', description: 'Gracias. Revisaremos este anuncio para proteger a la comunidad.' });
      setOpen(false);
      setDetails('');
      setReason('possible_fraud');
      setAlreadyReported(true);
    } catch (error: any) {
      console.error('Error reporting product:', error);
      toast({
        title: 'No se pudo enviar',
        description: error?.code === '23505' ? 'Ya has denunciado este producto.' : 'No se pudo registrar la denuncia. Inténtalo más tarde.',
        variant: 'destructive',
      });
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="w-full justify-center border-destructive/30 text-destructive hover:bg-destructive/10" onClick={openReportDialog}>
        <Flag className="mr-2 h-4 w-4" /> Denunciar producto
      </Button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-bold">Denunciar producto</h2><p className="mt-1 text-sm text-muted-foreground">Ayúdanos a detectar fraude, anuncios falsos o contenido no permitido.</p></div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} disabled={submitting}><X className="h-4 w-4" /></Button>
            </div>

            <div className="mb-4 rounded-xl bg-muted/60 p-3 text-sm"><p className="font-medium line-clamp-2">{productTitle}</p></div>

            {alreadyReported ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>Ya has denunciado este producto. El equipo de Reveta lo revisará desde el panel de seguridad.</span>
                </div>
                <Button className="w-full" onClick={() => setOpen(false)}>Cerrar</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Motivo</label>
                  <select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" disabled={submitting}>
                    {REPORT_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Detalles opcionales</label>
                  <textarea value={details} onChange={(event) => setDetails(event.target.value.slice(0, 800))} placeholder="Explica brevemente qué te parece sospechoso..." className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" disabled={submitting} />
                  <p className="mt-1 text-xs text-muted-foreground">{details.length}/800</p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">No envíes pagos fuera de Reveta si tienes dudas. Evita transferencias anticipadas, enlaces externos o vendedores que presionan para cerrar rápido.</div>

                <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button><Button className="flex-1" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Enviando...' : 'Enviar denuncia'}</Button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ReportProductButton;
