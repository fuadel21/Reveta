import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  ChevronUp,
  HandCoins,
  Image as ImageIcon,
  MessageCircle,
  PackageCheck,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { PendingOffers } from '@/components/chat/PendingOffers';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import {
  conversationNeedsAttention,
  formatConversationTime,
  loadMessagingOverview,
  messagePreview,
  otherParticipant,
  productStatusLabel,
  transactionStatusLabel,
  type MessagingConversation,
} from '@/lib/messaging';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean | null;
}

type ConversationFilter = 'all' | 'unread' | 'offers' | 'operations' | 'problems' | 'buying' | 'selling';

const MESSAGE_PAGE_SIZE = 100;
const MAX_CHAT_MESSAGE_LENGTH = 1000;
const MAX_OFFER_NOTE_LENGTH = 300;
const MAX_CHAT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MESSAGE_SELECT = 'id,conversation_id,sender_id,content,created_at,read';
const normalizeText = (value: string, max: number) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{4,}/g, '\n\n\n').slice(0, max);
const isActiveProduct = (conversation?: MessagingConversation | null) => conversation?.product?.status === 'active';
const money = (value?: number | null) => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const MessagingWorkspace = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedConversationId = searchParams.get('conversation');
  const [conversations, setConversations] = useState<MessagingConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(requestedConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [partial, setPartial] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [creatingCall, setCreatingCall] = useState(false);
  const [offerPanelOpen, setOfferPanelOpen] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const refreshTimer = useRef<number | null>(null);
  const conversationIdsRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId],
  );
  const selectedOther = selectedConversation ? otherParticipant(selectedConversation, user?.id) : null;
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(selectedConversation?.id, user?.id);

  const loadOverview = useCallback(async (manual = false) => {
    if (!user) return;
    if (manual) setRefreshing(true);
    else setLoadingOverview(true);
    try {
      const result = await loadMessagingOverview(user.id, 100);
      conversationIdsRef.current = new Set(result.conversations.map((conversation) => conversation.id));
      setConversations(result.conversations);
      setPartial(result.partial);
      const targetId = requestedConversationId || selectedId;
      if (targetId && !result.conversations.some((conversation) => conversation.id === targetId)) {
        setSelectedId(null);
        const next = new URLSearchParams(searchParams);
        next.delete('conversation');
        setSearchParams(next, { replace: true });
      } else if (targetId) {
        setSelectedId(targetId);
      }
      if (manual) toast({ title: 'Mensajería actualizada' });
    } catch (error) {
      console.error('Error loading messaging workspace:', error);
      toast({ title: 'No se pudo cargar la mensajería', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setLoadingOverview(false);
      setRefreshing(false);
    }
  }, [requestedConversationId, searchParams, selectedId, setSearchParams, toast, user]);

  useEffect(() => { void loadOverview(); }, [user?.id]);

  useEffect(() => {
    if (!requestedConversationId) return;
    setSelectedId(requestedConversationId);
  }, [requestedConversationId]);

  useEffect(() => {
    if (!user) return;
    const schedule = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void loadOverview(), 500);
    };
    const relevantConversationEvent = (payload: { new?: { conversation_id?: string }; old?: { conversation_id?: string } }) => {
      const id = payload.new?.conversation_id || payload.old?.conversation_id;
      if (!id || conversationIdsRef.current.has(id)) schedule();
    };
    const channels = [
      supabase.channel(`workspace-conversations-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`workspace-conversations-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`workspace-transactions-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`workspace-transactions-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`workspace-disputes-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `buyer_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`workspace-disputes-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `seller_id=eq.${user.id}` }, schedule).subscribe(),
      supabase.channel(`workspace-message-events-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, relevantConversationEvent).subscribe(),
      supabase.channel(`workspace-offer-events-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, relevantConversationEvent).subscribe(),
    ];
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
  }, [loadOverview, user?.id]);

  const markSelectedRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    const { error } = await supabase.from('messages').update({ read: true }).eq('conversation_id', conversationId).neq('sender_id', user.id).eq('read', false);
    if (error) console.warn('Could not mark messages as read:', error.message);
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation));
  }, [user]);

  const fetchMessagePage = useCallback(async (conversationId: string, offset = 0) => {
    const { data, error } = await supabaseUntyped
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + MESSAGE_PAGE_SIZE - 1);
    if (error) throw error;
    return (data || []) as ChatMessage[];
  }, []);

  useEffect(() => {
    if (!selectedConversation || !user) {
      setMessages([]);
      return;
    }
    let active = true;
    setLoadingMessages(true);
    setOfferPanelOpen(false);
    setOfferAmount('');
    setOfferNote('');
    void fetchMessagePage(selectedConversation.id, 0)
      .then(async (rows) => {
        if (!active) return;
        setMessages([...rows].reverse());
        setMessageOffset(rows.length);
        setHasOlderMessages(rows.length === MESSAGE_PAGE_SIZE);
        await markSelectedRead(selectedConversation.id);
      })
      .catch((error) => {
        console.error('Error loading messages:', error);
        toast({ title: 'No se pudieron cargar los mensajes', variant: 'destructive' });
      })
      .finally(() => { if (active) setLoadingMessages(false); });

    const channel = supabase
      .channel(`workspace-selected-${selectedConversation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = payload.new as ChatMessage;
          setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
          if (incoming.sender_id !== user.id) void markSelectedRead(selectedConversation.id);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as ChatMessage;
          setMessages((current) => current.map((message) => message.id === updated.id ? { ...message, ...updated } : message));
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as ChatMessage;
          setMessages((current) => current.filter((message) => message.id !== deleted.id));
        }
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [fetchMessagePage, markSelectedRead, selectedConversation?.id, toast, user?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, selectedConversation?.id]);

  const loadOlderMessages = async () => {
    if (!selectedConversation || loadingOlder || !hasOlderMessages) return;
    setLoadingOlder(true);
    try {
      const rows = await fetchMessagePage(selectedConversation.id, messageOffset);
      const ordered = [...rows].reverse();
      setMessages((current) => [...ordered.filter((row) => !current.some((message) => message.id === row.id)), ...current]);
      setMessageOffset((current) => current + rows.length);
      setHasOlderMessages(rows.length === MESSAGE_PAGE_SIZE);
    } catch (error) {
      console.error('Error loading older messages:', error);
      toast({ title: 'No se pudieron cargar mensajes anteriores', variant: 'destructive' });
    } finally {
      setLoadingOlder(false);
    }
  };

  const selectConversation = (conversationId: string | null) => {
    setSelectedId(conversationId);
    const next = new URLSearchParams(searchParams);
    if (conversationId) next.set('conversation', conversationId);
    else next.delete('conversation');
    setSearchParams(next, { replace: true });
  };

  const updateConversationActivity = async (content: string) => {
    if (!selectedConversation || !user) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('conversations').update({ updated_at: now }).eq('id', selectedConversation.id);
    if (error) console.warn('Could not update conversation timestamp:', error.message);
    setConversations((current) => current
      .map((conversation) => conversation.id === selectedConversation.id ? {
        ...conversation,
        updated_at: now,
        lastMessage: { id: `local-${now}`, sender_id: user.id, content, created_at: now },
      } : conversation)
      .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()));
  };

  const refreshSelectedProduct = async () => {
    if (!selectedConversation) return null;
    const { data, error } = await supabase.from('products').select('id,title,images,status,price,user_id').eq('id', selectedConversation.product_id).maybeSingle();
    if (error) throw error;
    if (data) setConversations((current) => current.map((conversation) => conversation.id === selectedConversation.id ? { ...conversation, product: data } : conversation));
    return data || null;
  };

  const ensureCanOffer = async () => {
    if (!user || !selectedConversation) return false;
    if (selectedConversation.buyer_id !== user.id) {
      toast({ title: 'Solo el comprador puede iniciar una oferta' });
      return false;
    }
    const product = await refreshSelectedProduct();
    if (product?.status !== 'active') {
      toast({ title: 'Producto no disponible', description: 'Ya no acepta nuevas ofertas.', variant: 'destructive' });
      return false;
    }
    const { data, error } = await supabaseUntyped.from('offers').select('id,created_by,buyer_id').eq('conversation_id', selectedConversation.id).eq('status', 'pending');
    if (error) throw error;
    const ownPending = (data || []).some((offer) => offer.created_by === user.id || (!offer.created_by && offer.buyer_id === user.id));
    if (ownPending) {
      toast({ title: 'Ya tienes una oferta pendiente', description: 'Espera la respuesta de la otra persona.' });
      return false;
    }
    return true;
  };

  const openOfferPanel = async () => {
    try {
      if (await ensureCanOffer()) setOfferPanelOpen(true);
    } catch (error) {
      console.error('Error checking offers:', error);
      toast({ title: 'No se pudo comprobar la oferta', variant: 'destructive' });
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedConversation || sendingMessage) return;
    const content = normalizeText(newMessage, MAX_CHAT_MESSAGE_LENGTH);
    if (!content) return;
    if (newMessage.trim().length > MAX_CHAT_MESSAGE_LENGTH) return;
    setSendingMessage(true);
    setNewMessage('');
    await stopTyping();
    const { error } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content });
    if (error) {
      setNewMessage(content);
      toast({ title: 'No se pudo enviar el mensaje', variant: 'destructive' });
    } else {
      await updateConversationActivity(content);
    }
    setSendingMessage(false);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !selectedConversation) return;
    if (!ALLOWED_CHAT_IMAGE_TYPES.has(file.type) || file.size > MAX_CHAT_IMAGE_SIZE_BYTES) {
      toast({ title: 'Imagen no válida', description: 'Usa JPG, PNG o WEBP de hasta 5 MB.', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploadingImage(true);
    let fileName: string | null = null;
    try {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      fileName = `${user.id}/chat/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(fileName, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
      const { error: messageError } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content: publicUrl });
      if (messageError) {
        await supabase.storage.from('products').remove([fileName]);
        throw messageError;
      }
      await updateConversationActivity(publicUrl);
    } catch (error) {
      console.error('Error uploading chat image:', error);
      toast({ title: 'No se pudo subir la imagen', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateCall = async () => {
    if (!user || !selectedConversation || creatingCall) return;
    const calleeId = selectedConversation.buyer_id === user.id ? selectedConversation.seller_id : selectedConversation.buyer_id;
    setCreatingCall(true);
    try {
      const { data, error } = await supabaseUntyped.from('call_sessions').insert({
        conversation_id: selectedConversation.id,
        product_id: selectedConversation.product_id,
        caller_id: user.id,
        callee_id: calleeId,
        status: 'requested',
      }).select('id').single();
      if (error || !data?.id) throw error || new Error('No se creó la llamada');
      const content = `📞 Llamada privada creada\n/call/${data.id}`;
      const { error: messageError } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content });
      if (messageError) throw messageError;
      await updateConversationActivity(content);
      toast({ title: 'Llamada creada', description: 'El enlace privado está en el chat.' });
    } catch (error) {
      console.error('Error creating call:', error);
      toast({ title: 'No se pudo crear la llamada', variant: 'destructive' });
    } finally {
      setCreatingCall(false);
    }
  };

  const handleSubmitOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedConversation || sendingOffer) return;
    try {
      if (!(await ensureCanOffer())) return;
      const amount = Number(offerAmount.replace(',', '.'));
      if (!Number.isFinite(amount) || amount <= 0) {
        toast({ title: 'Oferta no válida', description: 'Introduce una cantidad mayor que 0.', variant: 'destructive' });
        return;
      }
      const note = normalizeText(offerNote, MAX_OFFER_NOTE_LENGTH);
      setSendingOffer(true);
      const { error } = await supabaseUntyped.from('offers').insert({
        product_id: selectedConversation.product_id,
        conversation_id: selectedConversation.id,
        buyer_id: selectedConversation.buyer_id,
        seller_id: selectedConversation.seller_id,
        created_by: user.id,
        amount,
        message: note || null,
        status: 'pending',
      });
      if (error) throw error;
      const content = `💶 Oferta enviada: ${amount.toFixed(2)} €${note ? `\nMensaje: ${note}` : ''}`;
      const { error: messageError } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: user.id, content });
      if (messageError) throw messageError;
      await updateConversationActivity(content);
      setOfferPanelOpen(false);
      setOfferAmount('');
      setOfferNote('');
      toast({ title: 'Oferta enviada' });
      void loadOverview();
    } catch (error) {
      console.error('Error sending offer:', error);
      toast({ title: 'No se pudo enviar la oferta', variant: 'destructive' });
    } finally {
      setSendingOffer(false);
    }
  };

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const other = otherParticipant(conversation, user?.id);
      const haystack = `${conversation.product?.title || ''} ${other?.full_name || ''} ${conversation.lastMessage?.content || ''}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (filter === 'unread') return conversation.unreadCount > 0;
      if (filter === 'offers') return conversation.pendingOffers > 0;
      if (filter === 'operations') return Boolean(conversation.transactionStatus);
      if (filter === 'problems') return conversation.hasOpenDispute;
      if (filter === 'buying') return conversation.buyer_id === user?.id;
      if (filter === 'selling') return conversation.seller_id === user?.id;
      return true;
    });
  }, [conversations, filter, query, user?.id]);

  const totals = useMemo(() => ({
    conversations: conversations.length,
    unread: conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
    offers: conversations.reduce((sum, conversation) => sum + conversation.pendingOffers, 0),
    attention: conversations.filter(conversationNeedsAttention).length,
  }), [conversations]);

  const canSendOffer = Boolean(selectedConversation && selectedConversation.buyer_id === user?.id && isActiveProduct(selectedConversation));

  if (loadingOverview) {
    return <div className="flex min-h-[620px] items-center justify-center rounded-2xl border bg-card"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Conversaciones" value={totals.conversations} icon={<MessageCircle className="h-4 w-4" />} />
        <SummaryCard label="Sin leer" value={totals.unread} icon={<BellRing className="h-4 w-4" />} />
        <SummaryCard label="Ofertas pendientes" value={totals.offers} icon={<HandCoins className="h-4 w-4" />} />
        <SummaryCard label="Necesitan atención" value={totals.attention} icon={<ShieldAlert className="h-4 w-4" />} />
      </div>

      {partial && <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Parte del resumen no se pudo cargar. Los chats siguen disponibles y puedes actualizar la bandeja.</span></div>}

      <div className="grid min-h-[650px] overflow-hidden rounded-2xl border bg-card shadow-sm lg:h-[calc(100vh-15rem)] lg:grid-cols-[370px_1fr]">
        <aside className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r`}>
          <div className="space-y-3 border-b p-4">
            <div className="flex gap-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar chats" className="pl-9" /></div>
              <Button type="button" size="icon" variant="outline" disabled={refreshing} onClick={() => void loadOverview(true)} aria-label="Actualizar conversaciones"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['all', 'unread', 'offers', 'operations', 'problems', 'buying', 'selling'] as ConversationFilter[]).map((value) => (
                <Button key={value} type="button" size="sm" variant={filter === value ? 'default' : 'outline'} className="shrink-0" onClick={() => setFilter(value)}>
                  {({ all: 'Todos', unread: 'Nuevos', offers: 'Ofertas', operations: 'Operaciones', problems: 'Incidencias', buying: 'Compras', selling: 'Ventas' } as Record<ConversationFilter, string>)[value]}
                </Button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-2">
            {filteredConversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground"><MessageCircle className="mb-3 h-10 w-10 opacity-30" /><p className="font-medium">No hay conversaciones en este filtro</p></div>
            ) : filteredConversations.map((conversation) => {
              const other = otherParticipant(conversation, user?.id);
              const active = selectedConversation?.id === conversation.id;
              return (
                <button key={conversation.id} type="button" onClick={() => selectConversation(conversation.id)} className={`mb-2 w-full rounded-xl border p-3 text-left transition ${active ? 'border-primary bg-primary/5' : 'border-transparent bg-card hover:border-primary/20'}`}>
                  <div className="flex gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {conversation.product?.images?.[0] ? <img src={conversation.product.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><PackageCheck className="h-5 w-5 text-muted-foreground" /></div>}
                      {conversation.hasOpenDispute && <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-card bg-destructive" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold">{other?.full_name || 'Usuario Reveta'}</p><span className="shrink-0 text-[11px] text-muted-foreground">{formatConversationTime(conversation.lastMessage?.created_at || conversation.updated_at)}</span></div>
                      <p className="truncate text-xs font-medium text-muted-foreground">{conversation.product?.title || 'Producto eliminado'}</p>
                      <div className="mt-1 flex items-center gap-2"><p className={`min-w-0 flex-1 truncate text-xs ${conversation.unreadCount ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{messagePreview(conversation.lastMessage?.content)}</p>{conversation.unreadCount > 0 && <Badge className="h-5 min-w-5 justify-center px-1.5 text-[10px]">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</Badge>}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {conversation.pendingOffers > 0 && <Badge variant="secondary" className="text-[10px]">{conversation.pendingOffers} oferta{conversation.pendingOffers === 1 ? '' : 's'}</Badge>}
                        {conversation.transactionStatus && <Badge variant="outline" className="text-[10px]">{transactionStatusLabel(conversation.transactionStatus)}</Badge>}
                        {conversation.hasOpenDispute && <Badge variant="destructive" className="text-[10px]">Incidencia</Badge>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={`${selectedConversation ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col`}>
          {!selectedConversation ? (
            <div className="flex h-full flex-col items-center justify-center p-10 text-center text-muted-foreground"><MessageCircle className="mb-4 h-14 w-14 opacity-25" /><h2 className="text-lg font-semibold text-foreground">Selecciona una conversación</h2><p className="mt-1 max-w-sm text-sm">Revisa mensajes, ofertas y operaciones sin salir de esta pantalla.</p></div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b bg-primary p-3 text-primary-foreground sm:p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button type="button" className="rounded-lg p-2 hover:bg-primary-foreground/10 lg:hidden" onClick={() => selectConversation(null)} aria-label="Volver a conversaciones"><ArrowLeft className="h-5 w-5" /></button>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary-foreground/15">{selectedOther?.avatar_url ? <img src={selectedOther.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center font-bold">{(selectedOther?.full_name || 'U')[0].toUpperCase()}</div>}</div>
                  <div className="min-w-0"><h2 className="truncate font-semibold">{selectedOther?.full_name || 'Usuario Reveta'}</h2><p className="truncate text-xs text-primary-foreground/80">{selectedConversation.product?.title || 'Producto eliminado'} · {productStatusLabel(selectedConversation.product?.status)}</p></div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" disabled={creatingCall} onClick={handleCreateCall} aria-label="Crear llamada privada"><PhoneCall className="h-5 w-5" /></Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4">
                {selectedConversation.product && !isActiveProduct(selectedConversation) && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">El producto ya no está disponible para nuevas ofertas. El historial y la gestión de la operación siguen accesibles.</div>}
                {hasOlderMessages && <div className="mb-4 text-center"><Button type="button" size="sm" variant="outline" disabled={loadingOlder} onClick={loadOlderMessages}><ChevronUp className="mr-2 h-4 w-4" />{loadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores'}</Button></div>}
                {offerPanelOpen && (
                  <form onSubmit={handleSubmitOffer} className="mb-4 space-y-3 rounded-xl border border-primary/20 bg-card p-4">
                    <div><p className="font-semibold">Enviar oferta</p><p className="text-xs text-muted-foreground">Precio publicado: {money(selectedConversation.product?.price)} €</p></div>
                    <div className="grid gap-2 sm:grid-cols-[140px_1fr]"><Input type="number" min="0.01" step="0.01" inputMode="decimal" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Importe €" disabled={sendingOffer} /><Input value={offerNote} maxLength={MAX_OFFER_NOTE_LENGTH} onChange={(event) => setOfferNote(event.target.value.slice(0, MAX_OFFER_NOTE_LENGTH))} placeholder="Mensaje opcional" disabled={sendingOffer} /></div>
                    <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={sendingOffer}>{sendingOffer ? 'Enviando...' : 'Enviar oferta'}</Button><Button type="button" size="sm" variant="outline" disabled={sendingOffer} onClick={() => setOfferPanelOpen(false)}>Cancelar</Button></div>
                  </form>
                )}
                {user && <PendingOffers conversationId={selectedConversation.id} currentUserId={user.id} sellerId={selectedConversation.seller_id} productTitle={selectedConversation.product?.title} />}
                <div className="mt-4 space-y-3">
                  {loadingMessages ? <div className="flex min-h-48 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div> : messages.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center text-center text-muted-foreground"><MessageCircle className="mb-3 h-10 w-10 opacity-25" /><p className="font-medium">Inicia la conversación</p></div> : messages.map((message) => <MessageBubble key={message.id} content={message.content} isOwn={message.sender_id === user?.id} isRead={Boolean(message.read)} timestamp={new Date(message.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} />)}
                  {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2 border-t bg-card p-3 sm:p-4">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="hidden" />
                <Button type="button" size="icon" variant="ghost" disabled={!canSendOffer || sendingOffer} onClick={openOfferPanel} aria-label="Hacer oferta"><HandCoins className="h-5 w-5" /></Button>
                <Button type="button" size="icon" variant="ghost" disabled={uploadingImage} onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar imagen"><ImageIcon className="h-5 w-5" /></Button>
                <Input value={newMessage} maxLength={MAX_CHAT_MESSAGE_LENGTH} onChange={(event) => { setNewMessage(event.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH)); if (selectedOther?.full_name) startTyping(selectedOther.full_name); }} onBlur={() => void stopTyping()} placeholder="Escribe un mensaje..." disabled={sendingMessage} className="flex-1" />
                <Button type="submit" size="icon" disabled={sendingMessage || !newMessage.trim()} aria-label="Enviar mensaje"><Send className="h-5 w-5" /></Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <div className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><span className="text-primary">{icon}</span></div><p className="mt-2 text-2xl font-bold">{value}</p></div>
);

export default MessagingWorkspace;
