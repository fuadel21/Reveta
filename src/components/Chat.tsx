import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, HandCoins, Image as ImageIcon, Inbox, Loader2, MessageCircle, PhoneCall, Search, Send, X } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { PendingOffers } from '@/components/chat/PendingOffers';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useToast } from '@/hooks/use-toast';
import {
  hydrateMessagingConversations,
  loadMessagingConversation,
  loadMessagingInbox,
  previewMessage,
  type MessagingConversation,
  type MessagingMessagePreview,
  type MessagingProduct,
} from '@/lib/messaging';

interface ChatProps {
  productId?: string;
  sellerId?: string;
  onClose?: () => void;
  inbox?: MessagingConversation[];
  inboxLoading?: boolean;
  conversationId?: string | null;
  onConversationChange?: (conversationId: string | null) => void;
  onInboxRefresh?: () => void | Promise<void>;
}

type OfferInsert = TablesInsert<'offers'>;
type CallSessionInsert = TablesInsert<'call_sessions'>;
type InboxFilter = 'all' | 'unread' | 'offers' | 'operations';

const MAX_CHAT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CHAT_MESSAGE_LENGTH = 1000;
const MAX_OFFER_NOTE_LENGTH = 300;
const MESSAGE_PAGE_SIZE = 50;
const CONVERSATION_SELECT = 'id, product_id, buyer_id, seller_id, updated_at';
const MESSAGE_SELECT = 'id, conversation_id, sender_id, content, created_at, read';
const ALLOWED_CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const isValidChatImageFile = (file: File) => ALLOWED_CHAT_IMAGE_TYPES.has(file.type) && file.size <= MAX_CHAT_IMAGE_SIZE_BYTES;
const isActiveProduct = (product?: MessagingProduct | null) => product?.status === 'active';
const formatPrice = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'precio indicado';
const normalizeChatText = (value: string, maxLength: number) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{4,}/g, '\n\n\n').slice(0, maxLength);

const relativeTime = (value?: string | null) => {
  if (!value) return '';
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const sortConversations = (items: MessagingConversation[]) => [...items].sort((a, b) => new Date(b.lastMessageAt || b.updated_at || 0).getTime() - new Date(a.lastMessageAt || a.updated_at || 0).getTime());

export const Chat: React.FC<ChatProps> = ({
  productId,
  sellerId,
  onClose,
  inbox,
  inboxLoading = false,
  conversationId,
  onConversationChange,
  onInboxRefresh,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const controlledInbox = inbox !== undefined;
  const [conversations, setConversations] = useState<MessagingConversation[]>(inbox || []);
  const [selectedConversation, setSelectedConversation] = useState<MessagingConversation | null>(null);
  const [messages, setMessages] = useState<MessagingMessagePreview[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [creatingCall, setCreatingCall] = useState(false);
  const [offerPanelOpen, setOfferPanelOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [inboxQuery, setInboxQuery] = useState('');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(selectedConversation?.id, user?.id);

  const replaceConversation = useCallback((updated: MessagingConversation) => {
    setConversations((current) => sortConversations([updated, ...current.filter((item) => item.id !== updated.id)]));
    setSelectedConversation((current) => current?.id === updated.id ? updated : current);
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    if (controlledInbox) {
      await onInboxRefresh?.();
      return;
    }

    setLoadingInbox(true);
    try {
      const result = await loadMessagingInbox(user.id, 100);
      setConversations(result.conversations);
      if (result.partial) toast({ title: 'Buzón cargado parcialmente', description: 'Alguna sección no pudo actualizarse.' });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar tus conversaciones', variant: 'destructive' });
    } finally {
      setLoadingInbox(false);
    }
  }, [controlledInbox, onInboxRefresh, toast, user]);

  useEffect(() => {
    if (!controlledInbox) return;
    const next = inbox || [];
    setConversations(next);
    setSelectedConversation((current) => current ? next.find((item) => item.id === current.id) || current : current);
  }, [controlledInbox, inbox]);

  useEffect(() => {
    if (!controlledInbox && user) void refreshConversations();
  }, [controlledInbox, refreshConversations, user]);

  const getOrCreateConversation = useCallback(async (targetProductId: string, buyerId: string, targetSellerId: string) => {
    if (!user) return null;
    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, title, images, status, price, user_id')
        .eq('id', targetProductId)
        .maybeSingle();

      if (productError) throw productError;
      if (!productData) {
        toast({ title: 'Producto no disponible', description: 'Este producto ya no existe.', variant: 'destructive' });
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

      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select(CONVERSATION_SELECT)
        .eq('product_id', targetProductId)
        .eq('buyer_id', buyerId)
        .eq('seller_id', targetSellerId)
        .maybeSingle();
      if (existingError) throw existingError;

      let row = existing;
      if (!row) {
        const { data: created, error: createError } = await supabase
          .from('conversations')
          .insert({ product_id: targetProductId, buyer_id: buyerId, seller_id: targetSellerId })
          .select(CONVERSATION_SELECT)
          .single();

        if (createError) {
          const { data: fallback, error: fallbackError } = await supabase
            .from('conversations')
            .select(CONVERSATION_SELECT)
            .eq('product_id', targetProductId)
            .eq('buyer_id', buyerId)
            .eq('seller_id', targetSellerId)
            .maybeSingle();
          if (fallbackError) throw fallbackError;
          row = fallback;
        } else row = created;
      }

      if (!row) return null;
      const hydrated = await hydrateMessagingConversations([row as any], user.id);
      return hydrated.conversations[0] || null;
    } catch (error) {
      console.error('Exception in getOrCreateConversation:', error);
      toast({ title: 'No se pudo abrir el chat', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
      return null;
    }
  }, [toast, user]);

  useEffect(() => {
    if (!user || !productId || !sellerId) return;
    if (sellerId === user.id) {
      toast({ title: 'Este producto es tuyo', description: 'No puedes abrir un chat contigo mismo.' });
      onClose?.();
      return;
    }

    const initChat = async () => {
      setInitLoading(true);
      const conversation = await getOrCreateConversation(productId, user.id, sellerId);
      if (conversation) {
        replaceConversation(conversation);
        setSelectedConversation(conversation);
      } else onClose?.();
      setInitLoading(false);
    };

    void initChat();
  }, [getOrCreateConversation, onClose, productId, replaceConversation, sellerId, toast, user]);

  useEffect(() => {
    if (!user || !conversationId || selectedConversation?.id === conversationId) return;
    if (controlledInbox && inboxLoading) return;

    const existing = conversations.find((item) => item.id === conversationId);
    if (existing) {
      setSelectedConversation(existing);
      return;
    }

    const loadDirectConversation = async () => {
      setInitLoading(true);
      try {
        const conversation = await loadMessagingConversation(conversationId, user.id);
        if (!conversation) {
          toast({ title: 'Conversación no disponible', description: 'No existe o no tienes acceso.', variant: 'destructive' });
          onConversationChange?.(null);
          return;
        }
        replaceConversation(conversation);
        setSelectedConversation(conversation);
      } catch (error) {
        console.error('Error opening direct conversation:', error);
        toast({ title: 'No se pudo abrir la conversación', variant: 'destructive' });
      } finally {
        setInitLoading(false);
      }
    };

    void loadDirectConversation();
  }, [controlledInbox, conversationId, conversations, inboxLoading, onConversationChange, replaceConversation, selectedConversation?.id, toast, user]);

  useEffect(() => {
    if (!selectedConversation) return;
    setOfferPanelOpen(false);
    setOfferAmount('');
    setOfferNote('');
  }, [selectedConversation?.id]);

  const markConversationRead = useCallback(async (targetConversationId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', targetConversationId)
      .eq('read', false)
      .neq('sender_id', user.id);

    if (error) {
      console.warn('Messages read status not updated:', error.message);
      return;
    }

    setConversations((current) => current.map((conversation) => conversation.id === targetConversationId ? { ...conversation, unreadCount: 0 } : conversation));
    setSelectedConversation((current) => current?.id === targetConversationId ? { ...current, unreadCount: 0 } : current);
    await onInboxRefresh?.();
  }, [onInboxRefresh, user]);

  const loadMessagePage = useCallback(async (targetConversationId: string, before?: string) => {
    before ? setLoadingOlder(true) : setLoadingMessages(true);
    try {
      let request = supabase
        .from('messages')
        .select(MESSAGE_SELECT)
        .eq('conversation_id', targetConversationId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_PAGE_SIZE + 1);
      if (before) request = request.lt('created_at', before);

      const { data, error } = await request;
      if (error) throw error;
      const rows = (data || []) as MessagingMessagePreview[];
      const page = rows.slice(0, MESSAGE_PAGE_SIZE).reverse();
      setHasOlderMessages(rows.length > MESSAGE_PAGE_SIZE);

      if (before) {
        setMessages((current) => {
          const currentIds = new Set(current.map((message) => message.id));
          return [...page.filter((message) => !currentIds.has(message.id)), ...current];
        });
      } else {
        setMessages(page);
        await markConversationRead(targetConversationId);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los mensajes', variant: 'destructive' });
    } finally {
      setLoadingMessages(false);
      setLoadingOlder(false);
    }
  }, [markConversationRead, toast]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }
    setMessages([]);
    setHasOlderMessages(false);
    void loadMessagePage(selectedConversation.id);
  }, [loadMessagePage, selectedConversation?.id]);

  const appendMessage = useCallback((message: MessagingMessagePreview) => {
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    setConversations((current) => sortConversations(current.map((conversation) => conversation.id === message.conversation_id ? {
      ...conversation,
      lastMessage: message,
      lastMessageAt: message.created_at,
      updated_at: message.created_at,
      unreadCount: 0,
    } : conversation)));
    setSelectedConversation((current) => current?.id === message.conversation_id ? {
      ...current,
      lastMessage: message,
      lastMessageAt: message.created_at,
      updated_at: message.created_at,
      unreadCount: 0,
    } : current);
  }, []);

  useEffect(() => {
    if (!selectedConversation || !user) return;
    const subscription = supabase
      .channel(`messages-selected-${selectedConversation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = payload.new as MessagingMessagePreview;
          appendMessage(incoming);
          if (incoming.sender_id !== user.id && !incoming.read) {
            void supabase.from('messages').update({ read: true }).eq('id', incoming.id).neq('sender_id', user.id);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as MessagingMessagePreview;
          setMessages((current) => current.map((message) => message.id === updated.id ? { ...message, ...updated } : message));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          setMessages((current) => current.filter((message) => message.id !== deletedId));
        }
      })
      .subscribe();

    return () => { void supabase.removeChannel(subscription); };
  }, [appendMessage, selectedConversation?.id, user]);

  useEffect(() => {
    if (!loadingMessages && !loadingOlder) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [loadingMessages, messages.length]);

  const updateConversationTimestamp = async (targetConversationId: string, message?: MessagingMessagePreview) => {
    const updatedAt = message?.created_at || new Date().toISOString();
    const { error } = await supabase.from('conversations').update({ updated_at: updatedAt }).eq('id', targetConversationId);
    if (error) console.warn('Conversation timestamp not updated:', error.message);

    setConversations((current) => sortConversations(current.map((conversation) => conversation.id === targetConversationId ? {
      ...conversation,
      updated_at: updatedAt,
      lastMessage: message || conversation.lastMessage,
      lastMessageAt: message?.created_at || conversation.lastMessageAt || updatedAt,
    } : conversation)));
  };

  const insertChatMessage = async (content: string) => {
    if (!selectedConversation || !user) throw new Error('No hay una conversación activa.');
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: selectedConversation.id, sender_id: user.id, content })
      .select(MESSAGE_SELECT)
      .single();
    if (error || !data) throw error || new Error('No se pudo guardar el mensaje.');
    const message = data as MessagingMessagePreview;
    appendMessage(message);
    await updateConversationTimestamp(selectedConversation.id, message);
    return message;
  };

  const refreshSelectedProduct = async () => {
    if (!selectedConversation) return selectedConversation?.product || null;
    const { data, error } = await supabase
      .from('products')
      .select('id, title, images, status, price, user_id')
      .eq('id', selectedConversation.product_id)
      .maybeSingle();
    if (error) throw error;
    if (data) replaceConversation({ ...selectedConversation, product: data });
    return data || null;
  };

  const ensureCanOffer = async () => {
    if (!user || !selectedConversation) return false;
    if (user.id !== selectedConversation.buyer_id) {
      toast({ title: 'Solo el comprador puede hacer una oferta', description: 'El vendedor podrá responder en el siguiente paso.' });
      return false;
    }

    const latestProduct = await refreshSelectedProduct();
    if (!isActiveProduct(latestProduct)) {
      toast({ title: 'Producto no disponible', description: 'Este producto ya no acepta nuevas ofertas.', variant: 'destructive' });
      return false;
    }

    const { data: pendingOffers, error } = await (supabase as any)
      .from('offers')
      .select('id, created_by, buyer_id, status')
      .eq('conversation_id', selectedConversation.id)
      .eq('status', 'pending');
    if (error) throw error;

    const hasOwnPendingOffer = (pendingOffers || []).some((offer: any) => offer.created_by === user.id || (!offer.created_by && offer.buyer_id === user.id));
    if (hasOwnPendingOffer) {
      toast({ title: 'Ya tienes una oferta pendiente', description: 'Espera respuesta o envía una contraoferta cuando te respondan.' });
      return false;
    }
    return true;
  };

  const openOfferPanel = async () => {
    try {
      if (!await ensureCanOffer()) return;
      setOfferPanelOpen(true);
      setOfferAmount('');
      setOfferNote('');
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
    if (newMessage.trim().length > MAX_CHAT_MESSAGE_LENGTH) {
      toast({ title: 'Mensaje demasiado largo', description: `Máximo ${MAX_CHAT_MESSAGE_LENGTH} caracteres.`, variant: 'destructive' });
      return;
    }

    setNewMessage('');
    setSendingMessage(true);
    await stopTyping();
    try {
      await insertChatMessage(content);
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(content);
      toast({ title: 'No se pudo enviar el mensaje', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreatePrivateCall = async () => {
    if (!user || !selectedConversation || creatingCall) return;
    const calleeId = selectedConversation.buyer_id === user.id ? selectedConversation.seller_id : selectedConversation.buyer_id;
    if (!calleeId || calleeId === user.id) {
      toast({ title: 'No se pudo crear la llamada', description: 'No hemos encontrado al otro participante.', variant: 'destructive' });
      return;
    }

    setCreatingCall(true);
    try {
      const callPayload: CallSessionInsert = {
        conversation_id: selectedConversation.id,
        product_id: selectedConversation.product_id,
        caller_id: user.id,
        callee_id: calleeId,
        status: 'requested',
      };
      const { data: callSession, error: callError } = await supabase.from('call_sessions').insert(callPayload).select('id').single();
      if (callError || !callSession?.id) throw callError || new Error('No se recibió el ID de la llamada');
      await insertChatMessage(`📞 Llamada privada creada\n/call/${callSession.id}`);
      toast({ title: 'Llamada creada', description: 'El enlace privado ya está en el chat.' });
    } catch (error) {
      console.error('Error creating private call:', error);
      toast({ title: 'No se pudo crear la llamada', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      setCreatingCall(false);
    }
  };

  const handleSubmitOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedConversation || sendingOffer) return;

    try {
      if (!await ensureCanOffer()) return;
    } catch (error) {
      console.error('Error checking offer availability:', error);
      toast({ title: 'No se pudo comprobar la oferta', description: 'Inténtalo de nuevo.', variant: 'destructive' });
      return;
    }

    const normalizedAmount = Number(offerAmount.replace(',', '.'));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast({ title: 'Oferta no válida', description: 'Introduce una cantidad mayor que 0.', variant: 'destructive' });
      return;
    }

    const note = normalizeChatText(offerNote, MAX_OFFER_NOTE_LENGTH);
    if (offerNote.trim().length > MAX_OFFER_NOTE_LENGTH) {
      toast({ title: 'Nota demasiado larga', description: `Máximo ${MAX_OFFER_NOTE_LENGTH} caracteres.`, variant: 'destructive' });
      return;
    }

    setSendingOffer(true);
    try {
      const offerPayload: OfferInsert = {
        product_id: selectedConversation.product_id,
        conversation_id: selectedConversation.id,
        buyer_id: selectedConversation.buyer_id,
        seller_id: selectedConversation.seller_id,
        amount: normalizedAmount,
        message: note || null,
        status: 'pending',
      };
      (offerPayload as any).created_by = user.id;
      const { error: offerError } = await supabase.from('offers').insert(offerPayload);
      if (offerError) throw offerError;
      await insertChatMessage(`💶 Oferta enviada: ${normalizedAmount.toFixed(2)} €${note ? `\nMensaje: ${note}` : ''}`);
      setOfferPanelOpen(false);
      setOfferAmount('');
      setOfferNote('');
      await onInboxRefresh?.();
      toast({ title: 'Oferta enviada', description: 'El vendedor la verá en el chat.' });
    } catch (error) {
      console.error('Error sending offer:', error);
      toast({ title: 'No se pudo enviar la oferta', description: 'Revisa que el sistema de ofertas esté activo.', variant: 'destructive' });
    } finally {
      setSendingOffer(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !selectedConversation) return;

    if (!isValidChatImageFile(file)) {
      toast({ title: 'Imagen no válida', description: 'Solo se permiten JPG, PNG o WEBP de hasta 5 MB.', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingImage(true);
    let fileName: string | null = null;
    try {
      const fileExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      fileName = `${user.id}/chat/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(fileName, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
      try {
        await insertChatMessage(publicUrl);
      } catch (messageError) {
        await supabase.storage.from('products').remove([fileName]);
        throw messageError;
      }
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
    const normalizedQuery = inboxQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesQuery = !normalizedQuery || `${conversation.otherName} ${conversation.product?.title || ''} ${conversation.lastMessage?.content || ''}`.toLowerCase().includes(normalizedQuery);
      if (!matchesQuery) return false;
      if (inboxFilter === 'unread') return conversation.unreadCount > 0;
      if (inboxFilter === 'offers') return conversation.pendingOffers > 0;
      if (inboxFilter === 'operations') return Boolean(conversation.transactionStatus || conversation.hasOpenDispute);
      return true;
    });
  }, [conversations, inboxFilter, inboxQuery]);

  const inboxTotals = useMemo(() => ({
    unread: conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
    offers: conversations.reduce((sum, conversation) => sum + conversation.pendingOffers, 0),
    operations: conversations.filter((conversation) => conversation.transactionStatus || conversation.hasOpenDispute).length,
  }), [conversations]);

  const otherUser = selectedConversation && (selectedConversation.buyer_id === user?.id ? selectedConversation.seller : selectedConversation.buyer);
  const canSendOffer = Boolean(selectedConversation && user?.id === selectedConversation.buyer_id && isActiveProduct(selectedConversation.product));
  const canCreateCall = Boolean(selectedConversation && user && !creatingCall);
  const effectiveInboxLoading = inboxLoading || loadingInbox;

  if (initLoading) return <div className="flex h-full flex-col items-center justify-center bg-card p-8"><Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" /><p className="text-muted-foreground">Abriendo conversación...</p></div>;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b bg-primary p-4 text-primary-foreground">
        <div className="flex min-w-0 items-center gap-3">
          {selectedConversation && !productId && <button onClick={closeConversation} className="rounded-lg p-2 transition hover:bg-primary-foreground/10" aria-label="Volver"><ArrowLeft size={20} /></button>}
          {selectedConversation ? (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-lg font-bold">{otherUser?.avatar_url ? <img src={otherUser.avatar_url} alt="" className="h-full w-full object-cover" /> : (otherUser?.full_name || 'U')[0].toUpperCase()}</div>
              <div className="min-w-0"><h3 className="truncate font-semibold leading-none">{otherUser?.full_name || 'Chat'}</h3>{selectedConversation.product && <p className="mt-1 max-w-[220px] truncate text-xs text-primary-foreground/80">{selectedConversation.product.title}{!isActiveProduct(selectedConversation.product) ? ' · no disponible' : ''}</p>}</div>
            </>
          ) : (
            <><Inbox className="h-6 w-6" /><div><h3 className="font-semibold leading-none">Buzón de mensajes</h3><p className="mt-1 text-xs text-primary-foreground/80">{inboxTotals.unread > 0 ? `${inboxTotals.unread} mensajes sin leer` : 'Todo al día'}</p></div></>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedConversation && <button onClick={handleCreatePrivateCall} disabled={!canCreateCall} className="rounded-lg p-2 transition hover:bg-primary-foreground/10 disabled:opacity-50" aria-label="Crear llamada privada" title="Crear llamada privada"><PhoneCall size={20} /></button>}
          {onClose && <button onClick={onClose} className="rounded-lg p-2 transition hover:bg-primary-foreground/10" aria-label="Cerrar chat"><X size={20} /></button>}
        </div>
      </div>

      {!selectedConversation ? (
        <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
          <div className="space-y-3 border-b bg-card p-3">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={inboxQuery} onChange={(event) => setInboxQuery(event.target.value)} placeholder="Buscar persona, producto o mensaje" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm" /></div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['all', 'unread', 'offers', 'operations'] as InboxFilter[]).map((filter) => {
                const label = filter === 'all' ? 'Todos' : filter === 'unread' ? `Sin leer (${inboxTotals.unread})` : filter === 'offers' ? `Ofertas (${inboxTotals.offers})` : `Operaciones (${inboxTotals.operations})`;
                return <button key={filter} onClick={() => setInboxFilter(filter)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${inboxFilter === filter ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}>{label}</button>;
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {effectiveInboxLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : filteredConversations.length === 0 ? <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground"><MessageCircle className="mb-4 h-12 w-12 opacity-20" /><p className="font-medium">No hay conversaciones que coincidan</p><p className="text-sm">Prueba otro filtro o contacta con un vendedor.</p></div> : <div className="space-y-2">{filteredConversations.map((conversation) => {
              const other = conversation.buyer_id === user?.id ? conversation.seller : conversation.buyer;
              return (
                <button key={conversation.id} onClick={() => selectConversation(conversation)} className={`w-full rounded-xl border p-3 text-left shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 ${conversation.unreadCount > 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-bold text-muted-foreground">{other?.avatar_url ? <img src={other.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : (other?.full_name || 'U')[0].toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2"><p className={`truncate ${conversation.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>{other?.full_name || 'Usuario'}</p><span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(conversation.lastMessageAt)}</span></div>
                      <p className="truncate text-xs text-muted-foreground">{conversation.product?.title || 'Producto eliminado'}{!isActiveProduct(conversation.product) ? ' · no disponible' : ''}</p>
                      <div className="mt-1 flex items-center gap-2"><p className={`min-w-0 flex-1 truncate text-sm ${conversation.unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{previewMessage(conversation.lastMessage?.content)}</p>{conversation.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}</div>
                      <div className="mt-2 flex flex-wrap gap-1">{conversation.actionableOffers > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Oferta por responder</span>}{conversation.transactionStatus && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">Operación {conversation.transactionStatus}</span>}{conversation.hasOpenDispute && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Incidencia</span>}</div>
                    </div>
                  </div>
                </button>
              );
            })}</div>}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
            {hasOlderMessages && <div className="text-center"><button type="button" disabled={loadingOlder} onClick={() => messages[0]?.created_at && void loadMessagePage(selectedConversation.id, messages[0].created_at)} className="rounded-full border bg-card px-4 py-2 text-xs font-medium disabled:opacity-50">{loadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores'}</button></div>}
            {selectedConversation.product && !isActiveProduct(selectedConversation.product) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Este producto ya no está activo. Puedes seguir usando el historial y gestionar la operación, pero no se permiten nuevas ofertas.</div>}
            {offerPanelOpen && <form onSubmit={handleSubmitOffer} className="space-y-3 rounded-xl border border-primary/20 bg-card p-3 shadow-sm"><div><p className="text-sm font-bold">Enviar oferta</p><p className="text-xs text-muted-foreground">Precio publicado: {formatPrice(selectedConversation.product?.price)}</p></div><div className="grid gap-2 sm:grid-cols-[140px_1fr]"><input type="number" min="0.01" step="0.01" inputMode="decimal" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Importe €" className="rounded-lg border bg-background px-3 py-2 text-sm" disabled={sendingOffer} /><input type="text" value={offerNote} maxLength={MAX_OFFER_NOTE_LENGTH} onChange={(event) => setOfferNote(event.target.value.slice(0, MAX_OFFER_NOTE_LENGTH))} placeholder="Mensaje opcional" className="rounded-lg border bg-background px-3 py-2 text-sm" disabled={sendingOffer} /></div><p className="text-right text-[11px] text-muted-foreground">{offerNote.length}/{MAX_OFFER_NOTE_LENGTH}</p><div className="flex gap-2"><button type="submit" disabled={sendingOffer} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{sendingOffer ? 'Enviando...' : 'Enviar oferta'}</button><button type="button" disabled={sendingOffer} onClick={() => setOfferPanelOpen(false)} className="rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-50">Cancelar</button></div></form>}
            {user && <PendingOffers conversationId={selectedConversation.id} currentUserId={user.id} sellerId={selectedConversation.seller_id} productTitle={selectedConversation.product?.title} />}
            {loadingMessages ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : messages.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center text-muted-foreground"><MessageCircle className="mb-4 h-12 w-12 opacity-20" /><p className="font-medium">Inicia la conversación</p><p className="text-sm">Pregunta sobre el producto o coordina la operación.</p></div> : messages.map((message) => <MessageBubble key={message.id} content={message.content} isOwn={message.sender_id === user?.id} isRead={Boolean(message.read)} timestamp={new Date(message.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} />)}
            {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2 border-t bg-card p-4">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="hidden" />
            <button type="button" onClick={openOfferPanel} disabled={sendingOffer || sendingMessage || !canSendOffer} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-50" aria-label="Hacer oferta" title={canSendOffer ? 'Hacer oferta' : 'Las ofertas no están disponibles'}><HandCoins size={22} /></button>
            <button type="button" onClick={handleCreatePrivateCall} disabled={!canCreateCall} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-50" aria-label="Crear llamada privada" title="Crear llamada privada"><PhoneCall size={22} /></button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-50" aria-label="Adjuntar imagen"><ImageIcon size={22} /></button>
            <input type="text" value={newMessage} maxLength={MAX_CHAT_MESSAGE_LENGTH} onChange={(event) => { setNewMessage(event.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH)); if (otherUser?.full_name) startTyping(otherUser.full_name); }} onBlur={() => stopTyping()} placeholder="Escribe un mensaje..." className="flex-1 rounded-full border bg-muted/50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20" disabled={sendingMessage} />
            <button type="submit" disabled={sendingMessage || !newMessage.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary p-2 text-primary-foreground transition hover:opacity-90 disabled:opacity-50">{sendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send size={20} />}</button>
          </form>
        </>
      )}
    </div>
  );
};
