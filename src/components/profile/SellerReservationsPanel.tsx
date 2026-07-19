import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ExternalLink, RefreshCw, UserRound, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type ReservationRow = {
  id: string;
  product_id: string;
  buyer_id: string;
  expires_at: string;
  status: string;
  product?: {
    id: string;
    title: string;
    images: string[] | null;
    status: string | null;
  } | null;
  buyer?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const formatRemaining = (expiresAt: string, now: number) => {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now);
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (remainingMs <= 0) return 'Caducada';
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${Math.max(1, minutes)} min`;
};

const getProductImage = (reservation: ReservationRow) => {
  const images = reservation.product?.images;
  return Array.isArray(images) && images.length > 0 ? images[0] : null;
};

export const SellerReservationsPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.id) fetchReservations();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchReservations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      await (supabase as any).rpc('release_expired_product_reservations');

      const { data, error } = await (supabase as any)
        .from('product_reservations')
        .select('id, product_id, buyer_id, expires_at, status, product:products(id, title, images, status), buyer:profiles!product_reservations_buyer_id_fkey(id, full_name, avatar_url)')
        .eq('seller_id', user.id)
        .eq('status', 'active')
        .order('expires_at', { ascending: true });

      if (error) throw error;
      setReservations((data || []) as ReservationRow[]);
    } catch (error: any) {
      console.error('Error fetching seller reservations:', error);
      const message = String(error?.message || '');
      toast({
        title: 'No se pudieron cargar las reservas',
        description: message.includes('does not exist') || message.includes('schema cache')
          ? 'La función Reserva 24h todavía no está activa en Supabase. Ejecuta las migraciones pendientes.'
          : 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (reservationId: string) => {
    if (!user || cancellingId) return;
    setCancellingId(reservationId);

    try {
      const { error } = await (supabase as any).rpc('cancel_product_reservation', {
        target_reservation_id: reservationId,
      });
      if (error) throw error;

      setReservations((current) => current.filter((item) => item.id !== reservationId));
      toast({
        title: 'Reserva cancelada',
        description: 'El producto vuelve a estar disponible si no tiene ninguna compra abierta.',
      });
    } catch (error) {
      console.error('Error cancelling seller reservation:', error);
      toast({
        title: 'No se pudo cancelar la reserva',
        description: 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const activeReservations = useMemo(
    () => reservations.filter((reservation) => new Date(reservation.expires_at).getTime() > now),
    [reservations, now],
  );

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" /> Reservas activas de 24h
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Controla quién tiene reservado cada producto y cuánto tiempo queda.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={fetchReservations}>
          <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
        </Button>
      </CardHeader>

      <CardContent>
        {activeReservations.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No tienes reservas activas ahora mismo.
          </div>
        ) : (
          <div className="space-y-3">
            {activeReservations.map((reservation) => {
              const image = getProductImage(reservation);
              const buyerName = reservation.buyer?.full_name || 'Comprador Reveta';
              const productTitle = reservation.product?.title || 'Producto reservado';
              const remainingMs = new Date(reservation.expires_at).getTime() - now;
              const isUrgent = remainingMs > 0 && remainingMs <= TWO_HOURS_MS;
              const remaining = formatRemaining(reservation.expires_at, now);

              return (
                <div
                  key={reservation.id}
                  className={`rounded-xl border p-4 ${
                    isUrgent ? 'border-red-300 bg-red-50/70' : 'border-border/60 bg-card'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <CalendarClock className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{productTitle}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted">
                              {reservation.buyer?.avatar_url ? (
                                <img src={reservation.buyer.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <UserRound className="h-4 w-4" />
                              )}
                            </div>
                            <span>{buyerName}</span>
                          </div>
                        </div>
                        <Badge className={isUrgent ? 'bg-red-600 text-white hover:bg-red-600' : ''} variant={isUrgent ? 'default' : 'secondary'}>
                          {isUrgent ? 'Urgente: ' : 'Quedan '}{remaining}
                        </Badge>
                      </div>

                      {isUrgent && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-white/70 p-2 text-xs font-medium text-red-800">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          La reserva está a punto de caducar. Comprueba si el comprador completará la operación.
                        </div>
                      )}

                      <p className="mt-2 text-xs text-muted-foreground">
                        Caduca el {new Date(reservation.expires_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/product/${reservation.product_id}`}>
                            <ExternalLink className="mr-1 h-4 w-4" /> Ver producto
                          </Link>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={cancellingId === reservation.id}
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              {cancellingId === reservation.id ? 'Cancelando...' : 'Cancelar reserva'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Cancelar esta reserva?</AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div className="space-y-3 text-left">
                                  <p>
                                    Vas a cancelar la reserva de <strong>{productTitle}</strong> realizada por <strong>{buyerName}</strong>.
                                  </p>
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                                    <p className="font-semibold">Al confirmar:</p>
                                    <p className="mt-1">• El comprador perderá su reserva.</p>
                                    <p>• El producto volverá a estar disponible si no existe una compra abierta.</p>
                                    <p>• Esta acción no se puede deshacer desde este panel.</p>
                                  </div>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Mantener reserva</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleCancel(reservation.id)}
                              >
                                Sí, cancelar reserva
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SellerReservationsPanel;
