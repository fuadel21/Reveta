import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, HandCoins, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Offer {
  id: string;
  product_id: string;
  conversation_id: string | null;
  buyer_id: string;
  seller_id: string;
  amount: number;
  message: string | null;
  status: string;
  created_at: string;
}

interface PendingOffersProps {
  conversationId: string;
  currentUserId: string;
  sellerId: string;
  productTitle?: string | null;
}

export const PendingOffers = ({ conversationId, currentUserId, sellerId, productTitle }: PendingOffersProps) => {
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('offers')
      .select('id, product_id, conversation_id, buyer_id, seller_id, amount, message, status, created_at')
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending offers:', error);
      setOffers([]);
      return;
    }

    setOffers(data || []);
  }, [conversationId]);

  useEffect(() => {
    fetchOffers();

    const channel = supabase
      .channel(`pending-offers-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `conversation_id=eq.${conversationId}` }, () => {
        fetchOffers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchOffers]);

  const sendChatMessage = async (content: string) => {
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: currentUserId, content });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  };

  const reserveProductForAcceptedOffer = async (offer: Offer) => {
    const { data: existingTransaction, error: existingError } = await supabase
      .from('transactions')
      .select('id')
      .eq('product_id', offer.product_id)
      .in('status', ['pending', 'pending_payment', 'paid', 'shipped', 'completed'])
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingTransaction?.id) throw new Error('Este producto ya tiene una compra o reserva activa.');

    const { error: transactionError } = await supabase.from('transactions').insert({
      product_id: offer.product_id,
      buyer_id: offer.buyer_id,
      seller_id: offer.seller_id,
      amount: offer.amount,
      status: 'pending',
    });

    if (transactionError) throw transactionError;

    const { data: updatedProduct, error: productError } = await supabase
      .from('products')
      .update({ status: 'reserved' })
      .eq('id', offer.product_id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();

    if (productError) throw productError;
    if (!updatedProduct) throw new Error('No se pudo reservar el producto porque ya no está activo.');
  };

  const respondToOffer = async (offer: Offer, status: 'accepted' | 'rejected') => {
    if (currentUserId !== sellerId) {
      toast({ title: 'Solo el vendedor puede responder a la oferta.' });
      return;
    }

    setUpdatingId(offer.id);

    try {
      if (status === 'accepted') await reserveProductForAcceptedOffer(offer);

      const { error } = await (supabase as any)
        .from('offers')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', offer.id)
        .eq('seller_id', currentUserId);

      if (error) throw error;

      const amount = Number(offer.amount).toFixed(2);
      const content = status === 'accepted'
        ? `✅ Oferta aceptada: ${amount} €${productTitle ? ` por “${productTitle}”` : ''}. El producto queda reservado para el comprador.`
        : `❌ Oferta rechazada: ${amount} €${productTitle ? ` por “${productTitle}”` : ''}`;

      await sendChatMessage(content);
      await fetchOffers();
      toast({ title: status === 'accepted' ? 'Oferta aceptada y producto reservado' : 'Oferta rechazada' });
    } catch (error: any) {
      console.error('Error updating offer:', error);
      toast({ title: 'No se pudo actualizar la oferta', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  if (offers.length === 0) return null;

  const isSeller = currentUserId === sellerId;

  return (
    <div className="space-y-2">
      {offers.map((offer) => (
        <div key={offer.id} className="rounded-xl border border-primary/20 bg-white p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
              <HandCoins className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Oferta pendiente: {Number(offer.amount).toFixed(2)} €</p>
              {offer.message && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{offer.message}</p>}
              {!isSeller && <p className="mt-2 text-xs text-muted-foreground">Esperando respuesta del vendedor.</p>}
            </div>
            {isSeller && (
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={updatingId === offer.id}
                  onClick={() => respondToOffer(offer, 'accepted')}
                  className="inline-flex items-center justify-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Aceptar
                </button>
                <button
                  type="button"
                  disabled={updatingId === offer.id}
                  onClick={() => respondToOffer(offer, 'rejected')}
                  className="inline-flex items-center justify-center gap-1 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground disabled:opacity-50"
                >
                  <XCircle className="h-3 w-3" />
                  Rechazar
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
