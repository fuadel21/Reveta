import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, HandCoins, MessageCircle, PackageCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { loadMessagingConversations, type MessagingConversation } from '@/lib/messaging';

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

export const MessagingCommandCenter = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<MessagingConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const conversationIds = useRef(new Set<string>());

  const load = useCallback(async (manual = false) => {
    if (!user) return;
    manual ? setRefreshing(true) : setLoading(true);
    setError(false);

    try {
      const result = await loadMessagingConversations(user.id, 50);
      setItems(result.items);
      conversationIds.current = new Set(result.items.map((item) => item.id));
      setError(result.partial);
    } catch (loadError) {
      console.error('Error loading messaging command center:', loadError);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const schedule = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void load(), 450);
    };
    const scheduleConversationEvent = (payload: any) => {
      const id = payload.new?.conversation_id || payload.old?.conversation_id;
      if (!id || conversationIds.current.has(id)) schedule();
    };

    const channels = [
      supabase.channel(`message-center-conversations-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`message-center-conversations-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`message-center-messages-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleConversationEvent).subscribe(),
      supabase.channel(`message-center-offers-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`message-center-offers-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`message-center-transactions-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`message-center-transactions-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
    ];

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
  }, [load, user]);

  const totals = useMemo(() => ({
    conversations: items.length,
    unread: items.reduce((sum, item) => sum + item.unreadCount, 0),
    offers: items.reduce((sum, item) => sum + item.pendingOffers, 0),
    attention: items.filter((item) => item.hasOpenDispute || item.unreadCount > 0 || item.pendingOffers > 0 || item.transactionStatus).length,
  }), [items]);

  const attentionItems = useMemo(() => items
    .filter((item) => item.hasOpenDispute || item.unreadCount > 0 || item.pendingOffers > 0 || item.transactionStatus)
    .sort((a, b) => {
      const aPriority = Number(a.hasOpenDispute) * 100 + a.unreadCount * 10 + a.pendingOffers * 5 + Number(Boolean(a.transactionStatus));
      const bPriority = Number(b.hasOpenDispute) * 100 + b.unreadCount * 10 + b.pendingOffers * 5 + Number(Boolean(b.transactionStatus));
      return bPriority - aPriority;
    })
    .slice(0, 6), [items]);

  if (loading) {
    return <Card className="mb-5 border-border/50"><CardContent className="flex items-center justify-center p-6"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <div className="mb-5 space-y-4">
      {error && (
        <Card className="border-amber-300/60 bg-amber-50/50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" /><span>Parte del resumen no pudo actualizarse. El chat sigue disponible y puedes reintentar.</span></div>
            <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void load(true)}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Reintentar</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Conversaciones</span><MessageCircle className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{totals.conversations}</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Sin leer</span><BellRing className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{totals.unread}</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Ofertas pendientes</span><HandCoins className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{totals.offers}</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Necesitan atención</span><ShieldAlert className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{totals.attention}</p></CardContent></Card>
      </div>

      {attentionItems.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-semibold">Conversaciones que requieren atención</h2><p className="text-xs text-muted-foreground">Prioridad por incidencias, mensajes sin leer, ofertas y operaciones activas.</p></div>
              <div className="flex gap-2"><Button type="button" size="sm" variant="ghost" disabled={refreshing} onClick={() => void load(true)}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button><Button asChild size="sm" variant="outline"><Link to="/transactions">Ver operaciones</Link></Button></div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {attentionItems.map((item) => (
                <div key={item.id} className={`rounded-xl border p-3 ${item.hasOpenDispute ? 'border-destructive/30 bg-destructive/5' : 'border-border/60 bg-muted/20'}`}>
                  <div className="flex gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">{item.product?.images?.[0] ? <img src={item.product.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><PackageCheck className="h-5 w-5 text-muted-foreground" /></div>}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.product?.title || 'Producto eliminado'}</p><p className="truncate text-xs text-muted-foreground">Con {item.otherName}</p></div>{item.unreadCount > 0 && <Badge>{item.unreadCount} sin leer</Badge>}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="outline">{productStatusLabel(item.product?.status)}</Badge>{item.pendingOffers > 0 && <Badge variant="secondary">{item.pendingOffers} oferta{item.pendingOffers === 1 ? '' : 's'}</Badge>}{item.transactionStatus && <Badge variant="outline">{transactionStatusLabel(item.transactionStatus)}</Badge>}{item.hasOpenDispute && <Badge variant="destructive">Incidencia abierta</Badge>}</div>
                      <div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm"><Link to={`/messages?conversation=${encodeURIComponent(item.id)}`}>Abrir chat</Link></Button><Button asChild size="sm" variant="outline"><Link to={`/product/${item.product_id}`}>Ver producto</Link></Button>{item.transactionStatus && <Button asChild size="sm" variant="outline"><Link to="/transactions">Gestionar</Link></Button>}</div>
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
