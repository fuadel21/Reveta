import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, HandCoins, MessageCircle, PackageCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { previewMessage, type MessagingConversation } from '@/lib/messaging';

interface MessagingCommandCenterProps {
  items: MessagingConversation[];
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  onRefresh: () => void;
}

const productStatusLabel = (status?: string | null) => ({
  active: 'Disponible',
  reserved: 'Reservado',
  sold: 'Vendido',
  inactive: 'Retirado',
} as Record<string, string>)[status || ''] || 'Sin estado';

const transactionStatusLabel = (status?: string | null) => ({
  pending: 'Operación pendiente',
  pending_payment: 'Pendiente de pago',
  paid: 'Pago confirmado',
  shipped: 'Enviado',
  completed: 'Completada',
  disputed: 'Con incidencia',
  under_review: 'En revisión',
  cancelled: 'Cancelada',
} as Record<string, string>)[status || ''] || '';

const relativeTime = (value?: string | null) => {
  if (!value) return '';
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export const MessagingCommandCenter = ({ items, loading, refreshing, error, onRefresh }: MessagingCommandCenterProps) => {
  const totals = useMemo(() => ({
    conversations: items.length,
    unread: items.reduce((sum, item) => sum + item.unreadCount, 0),
    offers: items.reduce((sum, item) => sum + item.pendingOffers, 0),
    attention: items.filter((item) => item.hasOpenDispute || item.unreadCount > 0 || item.actionableOffers > 0 || item.transactionStatus).length,
  }), [items]);

  const attentionItems = useMemo(() => items
    .filter((item) => item.hasOpenDispute || item.unreadCount > 0 || item.actionableOffers > 0 || item.transactionStatus)
    .sort((a, b) => {
      const aPriority = Number(a.hasOpenDispute) * 100 + a.unreadCount * 10 + a.actionableOffers * 7 + Number(Boolean(a.transactionStatus)) * 2;
      const bPriority = Number(b.hasOpenDispute) * 100 + b.unreadCount * 10 + b.actionableOffers * 7 + Number(Boolean(b.transactionStatus)) * 2;
      return bPriority - aPriority;
    })
    .slice(0, 6), [items]);

  if (loading) {
    return (
      <Card className="mb-5 border-border/50">
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-5 border-destructive/30">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <span>No se pudo cargar el resumen de mensajería. El chat sigue disponible debajo.</span>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={onRefresh}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-5 space-y-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={onRefresh}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar buzón
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Conversaciones</span><MessageCircle className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{totals.conversations}</p></CardContent></Card>
        <Card className={totals.unread ? 'border-primary/40' : 'border-border/50'}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Sin leer</span><BellRing className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{totals.unread}</p></CardContent></Card>
        <Card className={totals.offers ? 'border-primary/40' : 'border-border/50'}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Ofertas pendientes</span><HandCoins className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{totals.offers}</p></CardContent></Card>
        <Card className={totals.attention ? 'border-amber-300' : 'border-border/50'}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Necesitan atención</span><ShieldAlert className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{totals.attention}</p></CardContent></Card>
      </div>

      {attentionItems.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Conversaciones que requieren atención</h2>
                <p className="text-xs text-muted-foreground">Prioridad por incidencias, mensajes sin leer, ofertas y operaciones activas.</p>
              </div>
              <Button asChild size="sm" variant="outline"><Link to="/transactions">Ver operaciones</Link></Button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {attentionItems.map((item) => (
                <div key={item.id} className={`rounded-xl border p-3 ${item.hasOpenDispute ? 'border-destructive/30 bg-destructive/5' : 'border-border/60 bg-muted/20'}`}>
                  <div className="flex gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.product?.images?.[0] ? <img src={item.product.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><PackageCheck className="h-5 w-5 text-muted-foreground" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.product?.title || 'Producto eliminado'}</p>
                          <p className="truncate text-xs text-muted-foreground">Con {item.otherName}</p>
                        </div>
                        {item.unreadCount > 0 && <Badge>{item.unreadCount} sin leer</Badge>}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <p className="min-w-0 truncate">{previewMessage(item.lastMessage?.content)}</p>
                        <span className="shrink-0">{relativeTime(item.lastMessageAt)}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{productStatusLabel(item.product?.status)}</Badge>
                        {item.pendingOffers > 0 && <Badge variant="secondary">{item.pendingOffers} oferta{item.pendingOffers === 1 ? '' : 's'}</Badge>}
                        {item.actionableOffers > 0 && <Badge>{item.actionableOffers} por responder</Badge>}
                        {item.transactionStatus && <Badge variant="outline">{transactionStatusLabel(item.transactionStatus)}</Badge>}
                        {item.hasOpenDispute && <Badge variant="destructive">Incidencia abierta</Badge>}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm"><Link to={`/messages?conversation=${item.id}`}><MessageCircle className="mr-2 h-4 w-4" />Abrir chat</Link></Button>
                        {item.transactionStatus && <Button asChild size="sm" variant="outline"><Link to="/transactions">Gestionar operación</Link></Button>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MessagingCommandCenter;
