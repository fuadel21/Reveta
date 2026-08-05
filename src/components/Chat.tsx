import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, BellRing, HandCoins, Image as ImageIcon, MessageCircle, PhoneCall, RefreshCw, Search, Send, ShieldAlert, X } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { PendingOffers } from '@/components/chat/PendingOffers';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useToast } from '@/hooks/use-toast';
import { loadMessagingConversations, type MessagingConversation, type MessagingProduct } from '@/lib/messaging';

interface Message {
  id: string;
  conversation_id?: string;
  sender_id: string;
  content: string;
  created_at: string;
  read?: boolean | null;
}

interface ChatProps {
  productId?: string;
  sellerId?: string;
  conversationId?: string;
  onConversationChange?: (conversationId: string | null) => void;
  onClose?: () => void;
}

type OfferInsert = TablesInsert<'offers'>;
type CallSessionInsert = TablesInsert<'call_sessions'>;

const MAX_CHAT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CHAT_MESSAGE_LENGTH = 1000;
const MAX_OFFER_NOTE_LENGTH = 300;
const MESSAGE_PAGE_SIZE = 100;
const CONVERSATION_SELECT = 'id, product_id, buyer_id, seller_id, updated_at';
const MESSAGE_SELECT = 'id, conversation_id, sender_id, content, created_at, read';
const ALLOWED_CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const isValidChatImageFile = (file: File) => ALLOWED_CHAT_IMAGE_TYPES.has(file.type) && file.size <= MAX_CHAT_IMAGE_SIZE_BYTES;
const isActiveProduct = (product?: MessagingProduct | null) => product?.status === 'active';
const formatPrice = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'precio indicado';
const normalizeChatText = (value: string, maxLength: number) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{4,}/g, '\n\n\n').slice(0, maxLength);
const transactionLabel = (status?: string | null) => ({ pending: 'Operación pendiente', pending_payment: 'Pendiente de pago', paid: 'Pago confirmado', shipped: 'Enviado', disputed: 'Incidencia', under_review: 'En revisión' } as Record<string, string>)[status || ''] || null;

export const Chat: React.FC<ChatProps> = ({ productId, sellerId, conversationId, onConversationChange, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<MessagingConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<MessagingConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [refreshingConversations, setRefreshingConversations] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [creatingCall, setCreatingCall] = useState(false);
  const [offerPanelOpen, setOfferPanelOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refreshTimer = useRef<number | null>(null);
  const conversationIdsRef = useRef(new Set<string>());
  const invalidTargetRef = useRef<string | null>(null);

  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(selectedConversation?.id, user?.id);

  const fetchConversations = useCallback(async (preferredId?: string, silent = false) => {
    if (!user) return [] as MessagingConversation[];
    silent ? setRefreshingConversations(true) : setLoadingConversations(true);

    try {
      const result = await loadMessagingConversations(user.id, 100);
      setConversations(result.items);
      conversationIdsRef.current = new Set(result.items.map((item) => item.id));

      const targetId = preferredId || conversationId;
      const target = targetId ? result.items.find((item) => item.id === targetId) || null : null;
      setSelectedConversation((current) => target || (current ? result.items.find((item) => item.id === current.id) || current : null));

      if (targetId && !target && invalidTargetRef.current !== targetId) {
        invalidTargetRef.current = targetId;
        toast({ title: 'Conversación no disponible', description: 'No existe o no pertenece a tu cuenta.', variant: 'destructive' });
        onConversationChange?.(null);
      } else if (target) {
        invalidTargetRef.current = null;
      }

      if (result.partial) toast({ title: 'Resumen parcial', description: 'El chat funciona, pero algún contador no pudo actualizarse.' });
      return result.items;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar tus conversaciones', variant: 'destructive' });
      return [] as MessagingConversation[];
    } finally {
      setLoadingConversations(false);
      setRefreshingConversations(false);
    }
  }, [conversationId, onConversationChange, toast, user]);

  useEffect(() => { void fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;
    const schedule = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void fetchConversations(undefined, true), 450);
    };
    const scheduleConversationEvent = (payload: any) => {
      const id = payload.new?.conversation_id || payload.old?.conversation_id;
      if (!id || conversationIdsRef.current.has(id)) schedule();
    };

    const channels = [
      supabase.channel(`chat-list-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`chat-list-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`chat-list-messages-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleConversationEvent).subscribe(),
      supabase.channel(`chat-list-offers-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`chat-list-offers-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`chat-list-transactions-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`chat-list-transactions-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
    ];

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
  }, [fetchConversations, user]);

  const getOrCreateConversation = useCallback(async (targetProductId: string, buyerId: string, targetSellerId: string) => {
    try {
      const { data: existing, error: existingError } = await supabase.from('conversations').select(CONVERSATION_SELECT).eq('product_id', targetProductId).eq('buyer_id', buyerId).eq('seller_id', targetSellerId).maybeSingle();
      if (existingError) throw existingError;
      if (existing?.id) return existing.id;

      const { data: productData, error: productError } = await supabase.from('products').select('id, status, user_id').eq('id', targetProductId).maybeSingle();
      if (productError) throw productError;
      if (!productData) throw new Error('El producto ya no existe.');
      if (productData.user_id !== targetSellerId) throw new Error('El vendedor no coincide con este producto.');
      if (productData.status !== 'active') throw new Error('Este producto ya no acepta conversaciones nuevas.');

      const { data: created, error: createError } = await supabase.from('conversations').insert({ product_id: targetProductId, buyer_id: buyerId, seller_id: targetSellerId }).select('id').single();
      if (!createError && created?.id) return created.id;

      const { data: fallback, error: fallbackError } = await supabase.from('conversations').select('id').eq('product_id', targetProductId).eq('buyer_id', buyerId).eq('seller_id', targetSellerId).maybeSingle();
      if (fallbackError || !fallback?.id) throw createError || fallbackError || new Error('No se pudo crear la conversación.');
      return fallback.id;
    } catch (error: any) {
      console.error('Error opening conversation:', error);
      toast({ title: 'No se pudo abrir el chat', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    if (!user || !productId || !sellerId) return;
    if (sellerId === user.id) {
      toast({ title: 'Este producto es tuyo', description: 'No puedes abrir un chat contigo mismo.' });
      onClose?.();
      return;
    }

    const initChat = async () => {
      setInitLoading(true);
      const id = await getOrCreateConversation(productId, user.id, sellerId);
      if (id) {
        await fetchConversations(id, true);
        onConversationChange?.(id);
      } else {
        onClose?.();
      }
      setInitLoading(false);
    };

    void initChat();
  }, [fetchConversations, getOrCreateConversation, onClose, onConversationChange, productId, sellerId, toast, user]);

  const markConversationReadLocally = useCallback((id: string) => {
    setConversations((current) => current.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item));
    setSelectedConversation((current) => current?.id === id ? { ...current, unreadCount: 0 } : current);
  }, []);

  const fetchMessages = useCallback(async (conversation: MessagingConversation) => {
    const { data, error } = await (supabase as any).from('messages').select(MESSAGE_SELECT).eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(MESSAGE_PAGE_SIZE + 1);
    if (error) {
      console.error('Error fetching messages:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los mensajes', variant: 'destructive' });
      return;
    }

    const rows = (data || []) as Message[];
    setHasOlderMessages(rows.length > MESSAGE_PAGE_SIZE);
    setMessages(rows.slice(0, MESSAGE_PAGE_SIZE).reverse());

    if (user) {
      const { error: readError } = await supabase.from('messages').update({ read: true }).eq('conversation_id', conversation.id).neq('sender_id', user.id).eq('read', false);
      if (!readError) markConversationReadLocally(conversation.id);
    }
  }, [markConversationReadLocally, toast, user]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    setOfferPanelOpen(false);
    setOfferAmount('');
    setOfferNote('');
    void fetchMessages(selectedConversation);

    const subscription = supabase.channel(`messages:${selectedConversation.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, (payload) => {
      if (payload.eventType === 'INSERT') {
        const incoming = payload.new as Message;
        setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
        if (user && incoming.sender_id !== user.id) {
          void supabase.from('messages').update({ read: true }).eq('id', incoming.id);
          markConversationReadLocally(selectedConversation.id);
        }
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as Message;
        setMessages((current) => current.map((message) => message.id === updated.id ? { ...message, ...updated } : message));
      } else if (payload.eventType === 'DELETE') {
        const deleted = payload.old as Message;
        setMessages((current) => current.filter((message) => message.id !== deleted.id));
      }
    }).subscribe();

    return () => { void supabase.removeChannel(subscription); };
  }, [fetchMessages, markConversationReadLocally, selectedConversation?.id, user]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, selectedConversation?.id]);

  const loadOlderMessages = async () => {
    if (!selectedConversation || messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    const oldest = messages[0].created_at;
    const { data, error } = await (supabase as any).from('messages').select(MESSAGE_SELECT).eq('conversation_id', selectedConversation.id).lt('created_at', oldest).order('created_at', { ascending: false }).limit(MESSAGE_PAGE_SIZE + 1);
    if (error) toast({ title: 'No se pudo cargar el historial', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    else {
      const rows = (data || []) as Message[];
      setHasOlderMessages(rows.length > MESSAGE_PAGE_SIZE);
      setMessages((current) => [...rows.slice(0, MESSAGE_PAGE_SIZE).reverse(), ...current]);
    }
    setLoadingOlder(false);
  };

  const updateConversationTimestamp = async (id: string) => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from('conversations').update({ updated_at: updatedAt }).eq('id', id);
    if (error) console.warn('Conversation timestamp not updated:', error.message);
    setSelectedConversation((current) => current?.id === id ? { ...current, updated_at: updatedAt } : current);
    setConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, updated_at: updatedAt } : conversation).sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()));
  };

  const refreshSelectedProduct = async () => {
    if (!selectedConversation) return null;
    const { data, error } = await supabase.from('products').select('id, title, images, status, price, user_id').eq('id', selectedConversation.product_id).maybeSingle();
    if (error) throw error;
    if (data) {
      setSelectedConversation((current) => current ? { ...current, product: data } : current);
      setConversations((current) => current.map((conversation) => conversation.id === selectedConversation.id ? { ...conversation, product: data } : conversation));
    }
    return data || null;
  };

  const ensureCanOffer = async () => {
    if (!user || !selectedConversation) return false;
    if (user.id !== selectedConversation.buyer_id) {
      toast({ title: 'Solo el comprador puede hacer una oferta', description: 'El vendedor puede responder desde las ofertas pendientes.' });
      return false;
    }

    const latestProduct = await refreshSelectedProduct();
    if (!isActiveProduct(latestProduct)) {
      toast({ title: 'Producto no disponible', description: 'Este producto ya no acepta nuevas ofertas.', variant: 'destructive' });
      return false;
    }

    const { data: pendingOffers, error } = await (supabase as any).from('offers').select('id, created_by, buyer_id').eq('conversation_id', selectedConversation.id).eq('status', 'pending');
    if (error) throw error;
    const hasOwnPendingOffer = (pendingOffers || []).some((offer: any) => offer.created_by === user.id || (!offer.created_by && offer.buyer_id === user.id));
    if (hasOwnPendingOffer) {
      toast({ title: 'Ya tienes una oferta pendiente', description: 'Espera respuesta antes de enviar otra.' });
      return false;
    }
    return true;
  };

  const openOfferPanel = async () => {
    try {
      if (await ensureCanOffer()) {
        setOfferPanelOpen(true);
        setOfferAmount('');
        setOfferNote('');
      }
    } catch (error) {
      console.error('Error checking offer availability:', error);
      toast({ title: 'No se pudo comprobar la oferta', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user || sendingMessage) return;
    const content = normalizeChatText(newMessage, MAX_CHAT_MESSAGE_LENGTH);
    if (!content) return;

    setNewMessage('');
    setSendingMessage(true);
    await stopTyping();
    const { error } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content });
    if (error) {
      setNewMessage(content);
      toast({ title: 'No se pudo enviar el mensaje', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } else {
      await updateConversationTimestamp(selectedConversation.id);
    }
    setSendingMessage(false);
  };

  const handleCreatePrivateCall = async () => {
    if (!user || !selectedConversation || creatingCall) return;
    const calleeId = selectedConversation.buyer_id === user.id ? selectedConversation.seller_id : selectedConversation.buyer_id;
    if (!calleeId || calleeId === user.id) return;

    setCreatingCall(true);
    try {
      const payload: CallSessionInsert = { conversation_id: selectedConversation.id, product_id: selectedConversation.product_id, caller_id: user.id, callee_id: calleeId, status: 'requested' };
      const { data, error } = await supabase.from('call_sessions').insert(payload).select('id').single();
      if (error || !data?.id) throw error || new Error('No se recibió el ID de la llamada');
      const { error: messageError } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content: `📞 Llamada privada creada\n/call/${data.id}` });
      if (messageError) throw messageError;
      await updateConversationTimestamp(selectedConversation.id);
      toast({ title: 'Llamada creada', description: 'El enlace privado ya está en el chat.' });
    } catch (error) {
      console.error('Error creating private call:', error);
      toast({ title: 'No se pudo crear la llamada', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setCreatingCall(false);
    }
  };

  const handleSubmitOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedConversation) return;
    try { if (!(await ensureCanOffer())) return; } catch { return; }

    const amount = Number(offerAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Oferta no válida', description: 'Introduce una cantidad mayor que 0.', variant: 'destructive' });
      return;
    }
    const note = normalizeChatText(offerNote, MAX_OFFER_NOTE_LENGTH);

    setSendingOffer(true);
    try {
      const payload: OfferInsert = { product_id: selectedConversation.product_id, conversation_id: selectedConversation.id, buyer_id: selectedConversation.buyer_id, seller_id: selectedConversation.seller_id, amount, message: note || null, status: 'pending' };
      const { error } = await supabase.from('offers').insert(payload);
      if (error) throw error;
      const { error: messageError } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content: `💶 Oferta enviada: ${amount.toFixed(2)} €${note ? `\nMensaje: ${note}` : ''}` });
      if (messageError) throw messageError;
      await updateConversationTimestamp(selectedConversation.id);
      setOfferPanelOpen(false);
      setOfferAmount('');
      setOfferNote('');
      toast({ title: 'Oferta enviada', description: 'El vendedor la verá en el chat.' });
    } catch (error) {
      console.error('Error sending offer:', error);
      toast({ title: 'No se pudo enviar la oferta', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setSendingOffer(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !selectedConversation) return;
    if (!isValidChatImageFile(file)) {
      toast({ title: 'Imagen no válida', description: 'Solo JPG, PNG o WEBP de hasta 5 MB.', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingImage(true);
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${user.id}/chat/${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('products').upload(fileName, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
      const { error: messageError } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content: publicUrl });
      if (messageError) {
        await supabase.storage.from('products').remove([fileName]);
        throw messageError;
      }
      await updateConversationTimestamp(selectedConversation.id);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ title: 'Error', description: 'No se pudo subir la imagen', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectConversation = (conversation: MessagingConversation) => {
    setSelectedConversation(conversation);
    onConversationChange?.(conversation.id);
  };
  const closeConversation = () => {
    setSelectedConversation(null);
    setMessages([]);
    onConversationChange?.(null);
  };

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => `${conversation.otherName} ${conversation.product?.title || ''}`.toLowerCase().includes(query));
  }, [conversationSearch, conversations]);

  const otherUser = selectedConversation && (selectedConversation.buyer_id === user?.id ? selectedConversation.seller : selectedConversation.buyer);
  const canSendOffer = Boolean(selectedConversation && user?.id === selectedConversation.buyer_id && isActiveProduct(selectedConversation.product));

  if (initLoading) return <div className="flex h-full flex-col items-center justify-center bg-white p-8"><div className="mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /><p className="text-muted-foreground">Iniciando chat...</p></div>;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white shadow-lg">
      <div className="flex items-center justify-between border-b bg-primary p-4 text-primary-foreground">
        <div className="flex min-w-0 items-center gap-3">
          {selectedConversation && !productId && <button onClick={closeConversation} className="rounded-lg p-2 transition hover:bg-primary-foreground/10" aria-label="Volver"><ArrowLeft size={20} /></button>}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-lg font-bold">{otherUser?.avatar_url ? <img src={otherUser.avatar_url} alt="" className="h-full w-full object-cover" /> : (otherUser?.full_name || 'R')[0].toUpperCase()}</div>
          <div className="min-w-0"><h3 className="truncate font-semibold leading-none">{otherUser?.full_name || (selectedConversation ? 'Chat' : 'Conversaciones')}</h3>{selectedConversation?.product && <p className="mt-1 max-w-[220px] truncate text-xs text-primary-foreground/80">{selectedConversation.product.title}{!isActiveProduct(selectedConversation.product) ? ' · no disponible' : ''}</p>}</div>
        </div>
        <div className="flex items-center gap-1">{selectedConversation && <button onClick={handleCreatePrivateCall} disabled={creatingCall} className="rounded-lg p-2 transition hover:bg-primary-foreground/10 disabled:opacity-50" aria-label="Crear llamada privada"><PhoneCall size={20} /></button>}{onClose && <button onClick={onClose} className="rounded-lg p-2 transition hover:bg-primary-foreground/10" aria-label="Cerrar chat"><X size={20} /></button>}</div>
      </div>

      {!selectedConversation ? (
        <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
          <div className="flex gap-2 border-b bg-white p-3"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Buscar persona o producto" className="h-9 w-full rounded-full border bg-slate-50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" /></div><button type="button" onClick={() => void fetchConversations(undefined, true)} disabled={refreshingConversations} className="rounded-full border p-2 text-muted-foreground hover:bg-slate-50 disabled:opacity-50" aria-label="Actualizar conversaciones"><RefreshCw className={`h-4 w-4 ${refreshingConversations ? 'animate-spin' : ''}`} /></button></div>
          <div className="flex-1 overflow-y-auto p-4">
            {loadingConversations ? <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" /></div> : filteredConversations.length === 0 ? <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground"><MessageCircle className="mb-4 h-12 w-12 opacity-20" /><p className="font-medium">{conversationSearch ? 'No hay coincidencias' : 'No hay conversaciones aún'}</p><p className="text-sm">{conversationSearch ? 'Prueba con otro nombre o producto' : 'Contacta con un vendedor para empezar'}</p></div> : <div className="space-y-2">{filteredConversations.map((conversation) => { const other = conversation.buyer_id === user?.id ? conversation.seller : conversation.buyer; const operation = transactionLabel(conversation.transactionStatus); return <button key={conversation.id} onClick={() => selectConversation(conversation)} className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:border-primary/20 hover:bg-primary/5 ${conversation.hasOpenDispute ? 'border-destructive/30' : 'border-transparent'}`}><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-bold text-slate-500">{other?.avatar_url ? <img src={other.avatar_url} alt="" className="h-full w-full object-cover" /> : (other?.full_name || 'U')[0].toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-semibold text-foreground">{other?.full_name || 'Usuario'}</p>{conversation.unreadCount > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}</div><p className="truncate text-sm text-muted-foreground">{conversation.product?.title || 'Producto eliminado'}</p><div className="mt-1 flex flex-wrap gap-1 text-[11px]">{conversation.pendingOffers > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{conversation.pendingOffers} oferta{conversation.pendingOffers === 1 ? '' : 's'}</span>}{operation && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{operation}</span>}{conversation.hasOpenDispute && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive"><ShieldAlert className="h-3 w-3" />Incidencia</span>}</div></div></button>; })}</div>}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {selectedConversation.product && !isActiveProduct(selectedConversation.product) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Este producto ya no está activo. Puedes seguir usando el historial y coordinar la operación, pero no enviar ofertas nuevas.</div>}
            {selectedConversation.hasOpenDispute && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>Esta operación tiene una incidencia abierta. Conserva la conversación dentro de Reveta.</span></div>}
            {hasOlderMessages && <div className="text-center"><button type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlder} className="rounded-full border bg-white px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">{loadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores'}</button></div>}
            {offerPanelOpen && <form onSubmit={handleSubmitOffer} className="space-y-3 rounded-xl border border-primary/20 bg-white p-3 shadow-sm"><div><p className="text-sm font-bold">Enviar oferta</p><p className="text-xs text-muted-foreground">Precio publicado: {formatPrice(selectedConversation.product?.price)}</p></div><div className="grid gap-2 sm:grid-cols-[140px_1fr]"><input type="number" min="0.01" step="0.01" inputMode="decimal" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Importe €" className="rounded-lg border px-3 py-2 text-sm" disabled={sendingOffer} /><input type="text" value={offerNote} maxLength={MAX_OFFER_NOTE_LENGTH} onChange={(event) => setOfferNote(event.target.value.slice(0, MAX_OFFER_NOTE_LENGTH))} placeholder="Mensaje opcional" className="rounded-lg border px-3 py-2 text-sm" disabled={sendingOffer} /></div><div className="flex gap-2"><button type="submit" disabled={sendingOffer} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{sendingOffer ? 'Enviando...' : 'Enviar oferta'}</button><button type="button" disabled={sendingOffer} onClick={() => setOfferPanelOpen(false)} className="rounded-full border px-4 py-2 text-xs font-bold">Cancelar</button></div></form>}
            {user && <PendingOffers conversationId={selectedConversation.id} currentUserId={user.id} sellerId={selectedConversation.seller_id} productTitle={selectedConversation.product?.title} />}
            {messages.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center text-muted-foreground"><MessageCircle className="mb-4 h-12 w-12 opacity-20" /><p className="font-medium">Inicia la conversación</p><p className="text-sm">Pregunta o coordina la operación con la otra persona</p></div> : messages.map((message) => <MessageBubble key={message.id} content={message.content} isOwn={message.sender_id === user?.id} isRead={Boolean(message.read)} timestamp={new Date(message.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} />)}
            {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2 border-t bg-white p-4">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="hidden" />
            <button type="button" onClick={openOfferPanel} disabled={sendingOffer || sendingMessage || !canSendOffer} className="rounded-lg p-2 text-muted-foreground transition hover:bg-slate-100 disabled:opacity-50" aria-label="Hacer oferta"><HandCoins size={22} /></button>
            <button type="button" onClick={handleCreatePrivateCall} disabled={creatingCall} className="rounded-lg p-2 text-muted-foreground transition hover:bg-slate-100 disabled:opacity-50" aria-label="Crear llamada privada"><PhoneCall size={22} /></button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="rounded-lg p-2 text-muted-foreground transition hover:bg-slate-100 disabled:opacity-50" aria-label="Adjuntar imagen"><ImageIcon size={22} /></button>
            <input type="text" value={newMessage} maxLength={MAX_CHAT_MESSAGE_LENGTH} onChange={(event) => { setNewMessage(event.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH)); if (otherUser?.full_name) startTyping(otherUser.full_name); }} onBlur={() => stopTyping()} placeholder="Escribe un mensaje..." className="flex-1 rounded-full border-none bg-slate-100 px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20" disabled={sendingMessage} />
            <button type="submit" disabled={sendingMessage || !newMessage.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary p-2 text-primary-foreground transition hover:opacity-90 disabled:opacity-50"><Send size={20} /></button>
          </form>
        </>
      )}
    </div>
  );
};
