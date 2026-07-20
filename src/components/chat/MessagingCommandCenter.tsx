import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, HandCoins, MessageCircle, PackageCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ConversationSummary {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string | null;
  product?: { id: string; title: string; status: string | null; images: string[] | null } | null;
  otherName: string;
  unreadCount: number;
  pendingOffers: number;
  transactionStatus: string | null;
  hasOpenDispute: boolean;
}

const ACTIVE_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];

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
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);

    try {
      const { data: conversations, error: conversationsError } = await (supabase as any)
        .from('conversations')
        .select('id, product_id, buyer_id, seller_id, updated_at')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (conversationsError) throw conversationsError;

      const hydrated = await Promise.all((conversations || []).map(async (conversation: any) => {
        const otherUserId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;

        const [productResult, profileResult, unreadResult, offersResult, transactionResult] = await Promise.all([
          (supabase as any).from('products').select('id, title, status, images').eq('id', conversation.product_id).maybeSingle(),
          (supabase as any).from('profiles').select('full_name').eq('id', otherUserId).maybeSingle(),
          (supabase as any).from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversation.id).eq('read', false).neq('sender_id', user.id),
          (supabase as any).from('offers').select('id', { count: 'exact', head: true }).eq('conversation_id', conversation.id).eq('status', 'pending'),
          (supabase as any).from('transactions').select('id, status').eq('product_id', conversation.product_id).eq('buyer_id', conversation.buyer_id).eq('seller_id', conversation.seller_id).in('status', ACTIVE_TRANSACTION_STATUSES).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        let hasOpenDispute = false;
        if (transactionResult.data?.id) {
          const { count } = await (supabase as any)
            .from('disputes')
            .select('id', { count: 'exact', head: true })
            .eq('transaction_id', transactionResult.data.id)
            .in('status', ['open', 'under_review']);
          hasOpenDispute = Number(count || 0) > 0;
        }

        return {
          ...conversation,
          product: productResult.data || null,
          otherName: profileResult.data?.full_name || 'Usuario Reveta',
          unreadCount: Number(unreadResult.count || 0),
          pendingOffers: Number(offersResult.count || 0),
          transactionStatus: transactionResult.data?.status || null,
          hasOpenDispute,
        } as ConversationSummary;
      }));

      setItems(hydrated);
    } catch (loadError) {
      console.error('Error loading messaging command center:', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => ({
    conversations: items.length,
    unread: items.reduce((sum, item) => sum + item.unreadCount, 0),
    offers: items.reduce((sum, item) => sum + item.pendingOffers, 0),
    attention: items.filter((item) => item.hasOpenDispute || item.unreadCount > 0 || item.pendingOffers > 0 || ['reserved', 'sold'].includes(item.product?.status || '')).length,
  }), [items]);

  const attentionItems = useMemo(() => items
    .filter((item) => item.hasOpenDispute || item.unreadCount > 0 || item.pendingOffers > 0 || item.transactionStatus)
    .sort((a, b) => {
      const aPriority = Number(a.hasOpenDispute) * 100 + a.unreadCount * 10 + a.pendingOffers * 5;
      const bPriority = Number(b.hasOpenDispute) * 100 + b.unreadCount * 10 + b.pendingOffers * 5;
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
          <Button type="button" size="sm" variant="outline" onClick={load}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-5 space-y-4">
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
                      {item.product?.images?.[0] ? <img src={item.product.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><PackageCheck className="h-5 w-5 text-muted-foreground" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.product?.title || 'Producto eliminado'}</p>
                          <p className="truncate text-xs text-muted-foreground">Con {item.otherName}</p>
                        </div>
                        {item.unreadCount > 0 && <Badge>{item.unreadCount} sin leer</Badge>}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{productStatusLabel(item.product?.status)}</Badge>
                        {item.pendingOffers > 0 && <Badge variant="secondary">{item.pendingOffers} oferta{item.pendingOffers === 1 ? '' : 's'}</Badge>}
                        {item.transactionStatus && <Badge variant="outline">{transactionStatusLabel(item.transactionStatus)}</Badge>}
                        {item.hasOpenDispute && <Badge variant="destructive">Incidencia abierta</Badge>}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline"><Link to={`/product/${item.product_id}`}>Ver producto</Link></Button>
                        {item.transactionStatus && <Button asChild size="sm"><Link to="/transactions">Gestionar operación</Link></Button>}
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
