import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { Send, X, Image as ImageIcon, ArrowLeft, MessageCircle, HandCoins } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { PendingOffers } from '@/components/chat/PendingOffers';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useToast } from '@/hooks/use-toast';

interface Profile { id: string; full_name: string | null; avatar_url: string | null; }
interface ProductSummary { id: string; title: string; images: string[] | null; status: string | null; price: number | null; user_id?: string | null; }
interface Message { id: string; conversation_id?: string; sender_id: string; content: string; created_at: string; read?: boolean | null; }
interface Conversation { id: string; product_id: string; buyer_id: string; seller_id: string; updated_at?: string; product?: ProductSummary | null; buyer?: Profile | null; seller?: Profile | null; }
interface ChatProps { productId?: string; sellerId?: string; onClose?: () => void; }

type OfferInsert = TablesInsert<'offers'>;

const MAX_CHAT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const isValidChatImageFile = (file: File) => ALLOWED_CHAT_IMAGE_TYPES.has(file.type) && file.size <= MAX_CHAT_IMAGE_SIZE_BYTES;
const isActiveProduct = (product?: ProductSummary | null) => product?.status === 'active';
const formatPrice = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'precio indicado';

export const Chat: React.FC<ChatProps> = ({ productId, sellerId, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(selectedConversation?.id, user?.id);

  const hydrateConversation = useCallback(async (conversation: Conversation): Promise<Conversation> => {
    const [productResult, buyerResult, sellerResult] = await Promise.all([
      supabase.from('products').select('id, title, images, status, price, user_id').eq('id', conversation.product_id).maybeSingle(),
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', conversation.buyer_id).maybeSingle(),
      supabase.from('profiles').select('id, full_name, avatar_url').eq('id', conversation.seller_id).maybeSingle(),
    ]);
    if (productResult.error) console.error('Error fetching chat product:', productResult.error);
    if (buyerResult.error) console.error('Error fetching chat buyer:', buyerResult.error);
    if (sellerResult.error) console.error('Error fetching chat seller:', sellerResult.error);
    return { ...conversation, product: productResult.data || null, buyer: buyerResult.data || null, seller: sellerResult.data || null };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('conversations').select('*').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('updated_at', { ascending: false });
      if (error) throw error;
      setConversations(await Promise.all((data || []).map((conversation) => hydrateConversation(conversation))));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar tus conversaciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [hydrateConversation, toast, user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const getOrCreateConversation = useCallback(async (targetProductId: string, buyerId: string, targetSellerId: string) => {
    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, title, images, status, price, user_id')
        .eq('id', targetProductId)
        .maybeSingle();

      if (productError) throw productError;
      if (!productData) {
        toast({ title: 'Producto no disponible', description: 'Este producto ya no existe o no está disponible.', variant: 'destructive' });
        return null;
      }
      if (productData.user_id !== targetSellerId) {
        toast({ title: 'Producto no válido', description: 'El vendedor no coincide con este producto.', variant: 'destructive' });
        return null;
      }
      if (productData.status !== 'active') {
        toast({ title: 'Producto no disponible', description: 'Este producto ya no acepta nuevas conversaciones ni ofertas.', variant: 'destructive' });
        return null;
      }

      const { data: existing, error: existingError } = await supabase.from('conversations').select('*').eq('product_id', targetProductId).eq('buyer_id', buyerId).eq('seller_id', targetSellerId).maybeSingle();
      if (existingError) throw existingError;
      if (existing) return hydrateConversation(existing);
      const { data: created, error: createError } = await supabase.from('conversations').insert({ product_id: targetProductId, buyer_id: buyerId, seller_id: targetSellerId }).select('*').single();
      if (createError) {
        console.error('Error creating conversation:', createError);
        const { data: fallback, error: fallbackError } = await supabase.from('conversations').select('*').eq('product_id', targetProductId).eq('buyer_id', buyerId).eq('seller_id', targetSellerId).maybeSingle();
        if (fallbackError) throw fallbackError;
        return fallback ? hydrateConversation(fallback) : null;
      }
      return created ? hydrateConversation(created) : null;
    } catch (err) {
      console.error('Exception in getOrCreateConversation:', err);
      toast({ title: 'No se pudo abrir el chat', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
      return null;
    }
  }, [hydrateConversation, toast]);

  useEffect(() => {
    if (!user || !productId || !sellerId) return;
    if (sellerId === user.id) {
      toast({ title: 'Este producto es tuyo', description: 'No puedes abrir un chat contigo mismo.' });
      onClose?.();
      return;
    }
    const initChat = async () => {
      setInitLoading(true);
      try {
        const conversation = await getOrCreateConversation(productId, user.id, sellerId);
        if (conversation) {
          setSelectedConversation(conversation);
          setConversations((prev) => [conversation, ...prev.filter((item) => item.id !== conversation.id)]);
        } else {
          onClose?.();
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        toast({ title: 'Error', description: 'No se pudo iniciar la conversación', variant: 'destructive' });
      } finally {
        setInitLoading(false);
      }
    };
    initChat();
  }, [getOrCreateConversation, onClose, productId, sellerId, toast, user]);

  useEffect(() => {
    if (!selectedConversation) return;
    const fetchMessages = async () => {
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', selectedConversation.id).order('created_at', { ascending: true });
      if (error) {
        console.error('Error fetching messages:', error);
        toast({ title: 'Error', description: 'No se pudieron cargar los mensajes', variant: 'destructive' });
        return;
      }
      setMessages(data || []);
      if (user) await supabase.from('messages').update({ read: true }).eq('conversation_id', selectedConversation.id).neq('sender_id', user.id);
    };
    fetchMessages();
    const subscription = supabase.channel(`messages:${selectedConversation.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, (payload) => {
      if (payload.eventType === 'INSERT') {
        const incoming = payload.new as Message;
        setMessages((prev) => (prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]));
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((message) => (message.id === updated.id ? { ...message, ...updated } : message)));
      }
    }).subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [selectedConversation, toast, user]);

  const updateConversationTimestamp = async (conversationId: string) => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from('conversations').update({ updated_at: updatedAt }).eq('id', conversationId);
    if (error) console.warn('Conversation timestamp not updated:', error.message);
    setSelectedConversation((prev) => (prev ? { ...prev, updated_at: updatedAt } : prev));
    setConversations((prev) => prev.map((conversation) => conversation.id === conversationId ? { ...conversation, updated_at: updatedAt } : conversation));
  };

  const refreshSelectedProduct = async () => {
    if (!selectedConversation) return selectedConversation?.product || null;
    const { data, error } = await supabase
      .from('products')
      .select('id, title, images, status, price, user_id')
      .eq('id', selectedConversation.product_id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      setSelectedConversation((prev) => (prev ? { ...prev, product: data } : prev));
      setConversations((prev) => prev.map((conversation) => conversation.id === selectedConversation.id ? { ...conversation, product: data } : conversation));
    }
    return data || null;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user) return;
    const content = newMessage.trim();
    setNewMessage('');
    setLoading(true);
    await stopTyping();
    const { error } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content });
    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(content);
      toast({ title: 'No se pudo enviar el mensaje', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } else {
      await updateConversationTimestamp(selectedConversation.id);
    }
    setLoading(false);
  };

  const handleSendOffer = async () => {
    if (!user || !selectedConversation) return;
    if (user.id !== selectedConversation.buyer_id) {
      toast({ title: 'Solo el comprador puede hacer una oferta', description: 'El vendedor podrá responder en el siguiente paso.' });
      return;
    }

    try {
      const latestProduct = await refreshSelectedProduct();
      if (!isActiveProduct(latestProduct)) {
        toast({ title: 'Producto no disponible', description: 'Este producto ya no acepta nuevas ofertas.', variant: 'destructive' });
        return;
      }

      const { data: pendingOffers, error: pendingError } = await (supabase as any)
        .from('offers')
        .select('id, created_by, buyer_id, status')
        .eq('conversation_id', selectedConversation.id)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;
      const hasOwnPendingOffer = (pendingOffers || []).some((offer: any) => offer.created_by === user.id || (!offer.created_by && offer.buyer_id === user.id));
      if (hasOwnPendingOffer) {
        toast({ title: 'Ya tienes una oferta pendiente', description: 'Espera respuesta o envía una contraoferta cuando te respondan.' });
        return;
      }
    } catch (error) {
      console.error('Error checking offer availability:', error);
      toast({ title: 'No se pudo comprobar la oferta', description: 'Inténtalo de nuevo.', variant: 'destructive' });
      return;
    }

    const amountText = window.prompt(`Introduce tu oferta en euros${selectedConversation.product?.price ? ` (precio: ${formatPrice(selectedConversation.product.price)})` : ''}:`);
    if (!amountText) return;
    const normalizedAmount = Number(amountText.replace(',', '.'));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast({ title: 'Oferta no válida', description: 'Introduce una cantidad mayor que 0.', variant: 'destructive' });
      return;
    }
    const note = window.prompt('Mensaje opcional para el vendedor:') || '';
    setSendingOffer(true);
    try {
      const offerPayload: OfferInsert = {
        product_id: selectedConversation.product_id,
        conversation_id: selectedConversation.id,
        buyer_id: selectedConversation.buyer_id,
        seller_id: selectedConversation.seller_id,
        amount: normalizedAmount,
        message: note,
        status: 'pending',
      };
      const { error: offerError } = await supabase.from('offers').insert(offerPayload);
      if (offerError) throw offerError;
      const content = `💶 Oferta enviada: ${normalizedAmount.toFixed(2)} €${note ? `\nMensaje: ${note}` : ''}`;
      const { error: messageError } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content });
      if (messageError) throw messageError;
      await updateConversationTimestamp(selectedConversation.id);
      toast({ title: 'Oferta enviada', description: 'El vendedor la verá en el chat.' });
    } catch (error) {
      console.error('Error sending offer:', error);
      toast({ title: 'No se pudo enviar la oferta', description: 'Revisa que el sistema de ofertas esté activo.', variant: 'destructive' });
    } finally {
      setSendingOffer(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedConversation) return;

    if (!isValidChatImageFile(file)) {
      toast({ title: 'Imagen no válida', description: 'Solo se permiten JPG, PNG o WEBP de hasta 5 MB.', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `${user.id}/chat/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(fileName, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
      const { error: msgError } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content: publicUrl });
      if (msgError) throw msgError;
      await updateConversationTimestamp(selectedConversation.id);
    } catch (err) {
      console.error('Error uploading image:', err);
      toast({ title: 'Error', description: 'No se pudo subir la imagen', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const otherUser = selectedConversation && (selectedConversation.buyer_id === user?.id ? selectedConversation.seller : selectedConversation.buyer);
  const canSendOffer = !!selectedConversation && user?.id === selectedConversation.buyer_id && isActiveProduct(selectedConversation.product);

  if (initLoading) return <div className="flex flex-col h-full items-center justify-center bg-white p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div><p className="text-muted-foreground">Iniciando chat...</p></div>;

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          {selectedConversation && !productId && <button onClick={() => setSelectedConversation(null)} className="hover:bg-primary-foreground/10 p-2 rounded-lg transition" aria-label="Volver"><ArrowLeft size={20} /></button>}
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg overflow-hidden">{otherUser?.avatar_url ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" /> : (otherUser?.full_name || 'U')[0].toUpperCase()}</div>
          <div><h3 className="font-semibold leading-none">{otherUser?.full_name || 'Chat'}</h3>{selectedConversation?.product && <p className="text-xs text-primary-foreground/80 mt-1 truncate max-w-[200px]">{selectedConversation.product.title}{!isActiveProduct(selectedConversation.product) ? ' · no disponible' : ''}</p>}</div>
        </div>
        {onClose && <button onClick={onClose} className="hover:bg-primary-foreground/10 p-2 rounded-lg transition" aria-label="Cerrar chat"><X size={20} /></button>}
      </div>

      {!selectedConversation ? (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {loading ? <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div> : conversations.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-8"><MessageCircle className="h-12 w-12 mb-4 opacity-20" /><p className="font-medium">No hay conversaciones aún</p><p className="text-sm">Contacta con un vendedor para empezar</p></div> : <div className="space-y-2">{conversations.map((conv) => { const other = conv.buyer_id === user?.id ? conv.seller : conv.buyer; return <button key={conv.id} onClick={() => setSelectedConversation(conv)} className="w-full flex items-center gap-3 p-3 bg-white hover:bg-primary/5 border border-transparent hover:border-primary/20 rounded-xl transition-all text-left shadow-sm"><div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 overflow-hidden shrink-0">{other?.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" /> : (other?.full_name || 'U')[0].toUpperCase()}</div><div className="flex-1 min-w-0"><p className="font-semibold text-foreground truncate">{other?.full_name || 'Usuario'}</p><p className="text-sm text-muted-foreground truncate">{conv.product?.title}{!isActiveProduct(conv.product) ? ' · no disponible' : ''}</p></div></button>; })}</div>}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {selectedConversation.product && !isActiveProduct(selectedConversation.product) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                Este producto ya no está activo. Puedes seguir leyendo el historial, pero no se permiten nuevas ofertas.
              </div>
            )}
            {user && <PendingOffers conversationId={selectedConversation.id} currentUserId={user.id} sellerId={selectedConversation.seller_id} productTitle={selectedConversation.product?.title} />}
            {messages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-8"><MessageCircle className="h-12 w-12 mb-4 opacity-20" /><p className="font-medium">Inicia la conversación</p><p className="text-sm">Pregunta al vendedor sobre el producto</p></div> : messages.map((msg) => <MessageBubble key={msg.id} content={msg.content} isOwn={msg.sender_id === user?.id} isRead={!!msg.read} timestamp={new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} />)}
            {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2 bg-white">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="hidden" />
            <button type="button" onClick={handleSendOffer} disabled={sendingOffer || loading || !canSendOffer} className="p-2 rounded-lg text-muted-foreground hover:bg-slate-100 disabled:opacity-50 transition" aria-label="Hacer oferta" title={canSendOffer ? 'Hacer oferta' : 'Las ofertas no están disponibles'}><HandCoins size={22} /></button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="p-2 rounded-lg text-muted-foreground hover:bg-slate-100 disabled:opacity-50 transition" aria-label="Adjuntar imagen"><ImageIcon size={22} /></button>
            <input type="text" value={newMessage} onChange={(e) => { setNewMessage(e.target.value); if (otherUser?.full_name) startTyping(otherUser.full_name); }} onBlur={() => stopTyping()} placeholder="Escribe un mensaje..." className="flex-1 px-4 py-2 bg-slate-100 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20" disabled={loading} />
            <button type="submit" disabled={loading || !newMessage.trim()} className="bg-primary text-primary-foreground p-2 rounded-full hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center w-10 h-10"><Send size={20} /></button>
          </form>
        </>
      )}
    </div>
  );
};
