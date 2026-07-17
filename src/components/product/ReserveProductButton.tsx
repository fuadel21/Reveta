import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ReserveProductButtonProps {
  productId: string;
  sellerId: string;
  disabled?: boolean;
}

interface ReservationResult {
  id: string;
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

  return message || 'No se pudo reservar el producto. Inténtalo de nuevo.';
};

export const ReserveProductButton = ({ productId, sellerId, disabled = false }: ReserveProductButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reserving, setReserving] = useState(false);
  const [reservation, setReservation] = useState<ReservationResult | null>(null);

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
      const { data, error } = await (supabase as any).rpc('reserve_product_for_24h', {
        target_product_id: productId,
      });

      if (error) throw error;

      const result = (Array.isArray(data) ? data[0] : data) as ReservationResult | null;
      if (!result?.id || !result.expires_at) throw new Error('Supabase no devolvió los datos de la reserva.');

      setReservation(result);
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

      window.setTimeout(() => window.location.reload(), 900);
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

  const expiryLabel = reservation?.expires_at
    ? new Date(reservation.expires_at).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleReserve}
        disabled={disabled || reserving || !!reservation}
      >
        <CalendarClock className="mr-2 h-4 w-4" />
        {reservation ? 'Reservado durante 24h' : reserving ? 'Reservando...' : 'Reservar durante 24h'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {expiryLabel
          ? `Reserva activa hasta ${expiryLabel}`
          : 'Bloquea temporalmente el producto mientras completas la compra o acuerdas la entrega.'}
      </p>
    </div>
  );
};

export default ReserveProductButton;
