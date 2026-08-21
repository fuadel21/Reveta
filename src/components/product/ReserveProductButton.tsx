import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2, ShoppingCart, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ReserveProductButtonProps {
  productId: string;
  sellerId: string;
  disabled?: boolean;
}

interface ReservationResult {
  id: string;
  buyer_id?: string;
  seller_id?: string;
  expires_at: string;
  status: string;
}

const getReservationErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || '');

  if (message.includes('already reserved') || message.includes('reservado temporalmente')) {
    return 'Este producto acaba de ser reservado por otra persona.';
  }
  if (message.includes('compra o reserva abierta')) {
    return 'Este producto ya tiene una compra o reserva abierta.';
  }
  if (message.includes('No puedes reservar tu propio producto')) {
    return 'No puedes reservar tu propio producto.';
  }
  if (message.includes('does not exist') || message.includes('function') || message.includes('schema cache')) {
    return 'La función Reserva 24h todavía no está activa en Supabase. Ejecuta las migraciones pendientes.';
  }

  return message || 'No se pudo completar la operación. Inténtalo de nuevo.';
};

const formatRemainingTime = (expiresAt: string, now: number) => {
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) return 'Reserva caducada';

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} min restantes`;
  return `${hours} h ${minutes} min restantes`;
};

export const ReserveProductButton = ({ productId, sellerId, disabled = false }: ReserveProductButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reserving, setReserving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loadingReservation, setLoadingReservation] = useState(false);
  const [reservation, setReservation] = useState<ReservationResult | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchActiveReservation = useCallback(async () => {
    if (!user || !productId || user.id === sellerId) {
      setReservation(null);
      return;
    }

    setLoadingReservation(true);
    try {
      const { data, error } = await supabaseUntyped
        .from('product_reservations')
        .select('id, buyer_id, seller_id, expires_at, status')
        .eq('product_id', productId)
        .eq('buyer_id', user.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        const message = String(error.message || '');
        if (message.includes('does not exist') || message.includes('schema cache')) return;
        throw error;
      }

      setReservation((data || null) as ReservationResult | null);
    } catch (error) {
      console.error('Error loading active product reservation:', error);
    } finally {
      setLoadingReservation(false);
    }
  }, [productId, sellerId, user]);

  useEffect(() => {
    fetchActiveReservation();
  }, [fetchActiveReservation]);

  useEffect(() => {
    if (!reservation?.expires_at) return;

    const intervalId = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      if (new Date(reservation.expires_at).getTime() <= currentTime) {
        setReservation(null);
      }
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [reservation?.expires_at]);

  const handleReserve = async () => {
    if (!user) {
      toast({ title: 'Inicia sesión', description: 'Debes iniciar sesión para reservar un producto.' });
      return;
    }

    if (user.id === sellerId) {
      toast({ title: 'Es tu producto', description: 'No puedes reservar tu propio anuncio.' });
      return;
    }

    if (reserving || reservation) return;
    setReserving(true);

    try {
      const { data, error } = await supabaseUntyped.rpc('reserve_product_for_24h', {
        target_product_id: productId,
      });

      if (error) throw error;

      const result = (Array.isArray(data) ? data[0] : data) as ReservationResult | null;
      if (!result?.id || !result.expires_at) throw new Error('Supabase no devolvió los datos de la reserva.');

      setReservation(result);
      setNow(Date.now());
      const expiryLabel = new Date(result.expires_at).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      toast({
        title: 'Producto reservado durante 24 horas',
        description: `La reserva estará activa hasta ${expiryLabel}. Completa la compra o coordina la entrega desde el chat.`,
      });
    } catch (error) {
      console.error('Error reserving product for 24h:', error);
      toast({
        title: 'No se pudo reservar',
        description: getReservationErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setReserving(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!reservation?.id || cancelling) return;

    setCancelling(true);
    try {
      const { error } = await supabaseUntyped.rpc('cancel_product_reservation', {
        target_reservation_id: reservation.id,
      });

      if (error) throw error;

      setReservation(null);
      toast({
        title: 'Reserva cancelada',
        description: 'El producto vuelve a estar disponible para otros compradores.',
      });
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      console.error('Error cancelling product reservation:', error);
      toast({
        title: 'No se pudo cancelar la reserva',
        description: getReservationErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleContinueCheckout = () => {
    if (!reservation?.id) return;
    window.location.assign(`/checkout/${productId}?reservation=${reservation.id}`);
  };

  const expiryLabel = reservation?.expires_at
    ? new Date(reservation.expires_at).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const remainingMs = reservation?.expires_at ? new Date(reservation.expires_at).getTime() - now : null;
  const isUrgent = remainingMs !== null && remainingMs > 0 && remainingMs <= 2 * 60 * 60 * 1000;

  const remainingLabel = useMemo(
    () => (reservation?.expires_at ? formatRemainingTime(reservation.expires_at, now) : null),
    [now, reservation?.expires_at],
  );

  if (loadingReservation) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Comprobando reserva...
      </div>
    );
  }

  if (reservation) {
    return (
      <div
        className={`space-y-3 rounded-xl border p-4 ${
          isUrgent
            ? 'border-red-300 bg-red-50 text-red-950'
            : 'border-amber-200 bg-amber-50 text-amber-950'
        }`}
      >
        <div className="flex items-start gap-3">
          {isUrgent ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{isUrgent ? 'Tu reserva caduca muy pronto' : 'Reservado para ti durante 24h'}</p>
            <p className="mt-1 text-xs font-medium">{remainingLabel} · hasta {expiryLabel}</p>
            <p className="mt-2 text-xs opacity-80">
              {isUrgent
                ? 'Completa la compra ahora para no perder la reserva.'
                : 'Completa la compra o coordina la entrega desde el chat antes de que venza.'}
            </p>
          </div>
        </div>
        <Button type="button" className="w-full" onClick={handleContinueCheckout}>
          <ShoppingCart className="mr-2 h-4 w-4" /> {isUrgent ? 'Completar compra ahora' : 'Continuar con la compra'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={`w-full bg-white/70 hover:bg-white ${isUrgent ? 'border-red-300' : 'border-amber-300'}`}
          onClick={handleCancelReservation}
          disabled={cancelling}
        >
          {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
          {cancelling ? 'Cancelando...' : 'Cancelar reserva'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleReserve}
        disabled={disabled || reserving}
      >
        {reserving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
        {reserving ? 'Reservando...' : 'Reservar durante 24h'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Bloquea temporalmente el producto mientras completas la compra o acuerdas la entrega.
      </p>
    </div>
  );
};

export default ReserveProductButton;
