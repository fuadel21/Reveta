import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Send, X, Image as ImageIcon, ArrowLeft, MessageCircle } from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ProductSummary {
  id: string;
  title: string;
  images: string[] | null;
}

interface Message {
  id: string;
  conversation_id?: string;
  sender_id: string;
  content: string;
  created_at: string;
  read?: boolean | null;
}

interface Conversation {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at?: string;
  product?: ProductSummary | null;
  buyer?: Profile | null;
  seller?: Profile | null;
}

interface ChatProps {
  productId?: string;
  sellerId?: string;
  onClose?: () => void;
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    selectedConversation?.id,
    user?.id
  );

  const hydrateConversation = useCallback(async (conversation: Conversation): Promise<Conversation> => {
    const [productResult, buyerResult, sellerResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, title, images')
        .eq('id', conversation.product_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', conversation.buyer_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', conversation.seller_id)
        .maybeSingle(),
    ]);

    if (productResult.error) console.error('Error fetching chat product:', productResult.error);
    if (buyerResult.error) console.error('Error fetching chat buyer:', buyerResult.error);
    if (sellerResult.error) console.error('Error fetching chat seller:', sellerResult.error);

    return {
      ...conversation,
      product: productResult.data || null,
      buyer: buyerResult.data || null,
      seller: sellerResult.data || null,
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const hydrated = await Promise.all((data || []).map((conversation) => hydrateConversation(conversation)));
      setConversations(hydrated);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar tus conversaciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [hydrateConversation, toast, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch conversations
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const getOrCreateConversation = useCallback(async (targetProductId: string, buyerId: string, targetSellerId: string) => {
    try {
      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('*')
        .eq('product_id', targetProductId)
        .eq('buyer_id', buyerId)
        .eq('seller_id', targetSellerId)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return hydrateConversation(existing);

      const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({ product_id: targetProductId, buyer_id: buyerId, seller_id: targetSellerId })
        .select('*')
        .single();

      if (createError) {
        console.error('Error creating conversation:', createError);

        // Fallback: if another request created the conversation at the same time, read it again.
        const { data: fallback, error: fallbackError } = await supabase
          .from('conversations')
          .select('*')
          .eq('product_id', targetProductId)
          .eq('buyer_id', buyerId)
          .eq('seller_id', targetSellerId)
          .maybeSingle();

        if (fallbackError) throw fallbackError;
        return fallback ? hydrateConversation(fallback) : null;
      }

      return created ? hydrateConversation(created) : null;
    } catch (err) {
      console.error('Exception in getOrCreateConversation:', err);
      return null;
    }
  }, [hydrateConversation]);

  // Si se abre desde un producto, seleccionar/crear conversación automáticamente.
  useEffect(() => {
    if (!user || !productId || !sellerId) return;

    if (sellerId === user.id) {
      toast({
        title: 'Este producto es tuyo',
        description: 'No puedes abrir un chat contigo mismo.',
      });
      onClose?.();
      return;
    }

    const initChat = async () => {
      setInitLoading(true);
      try {
        const conversation = await getOrCreateConversation(productId, user.id, sellerId);
        if (conversation) {
          setSelectedConversation(conversation);
          setConversations((prev) => {
            const withoutDuplicate = prev.filter((item) => item.id !== conversation.id);
            return [conversation, ...withoutDuplicate];
          });
        } else {
          toast({
            title: 'Error',
            description: 'No se pudo iniciar la conversación',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        toast({
          title: 'Error',
          description: 'No se pudo iniciar la conversación',
          variant: 'destructive',
        });
      } finally {
        setInitLoading(false);
      }
    };

    initChat();
  }, [getOrCreateConversation, onClose, productId, sellerId, toast, user]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los mensajes',
          variant: 'destructive',
        });
        return;
      }

      setMessages(data || []);

      // Marcar como leídos
      if (user) {
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('conversation_id', selectedConversation.id)
          .neq('sender_id', user.id);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = payload.new as Message;
            setMessages((prev) => (prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Message;
            setMessages((prev) => prev.map((message) => (message.id === updated.id ? { ...message, ...updated } : message)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedConversation, toast, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const content = newMessage.trim();
    setNewMessage('');
    setLoading(true);
    await stopTyping();

    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      content,
    });

    if (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive',
      });
      setNewMessage(content);
    } else {
      const updatedAt = new Date().toISOString();
      await supabase
        .from('conversations')
        .update({ updated_at: updatedAt })
        .eq('id', selectedConversation.id);

      setSelectedConversation((prev) => (prev ? { ...prev, updated_at: updatedAt } : prev));
      setConversations((prev) => prev.map((conversation) => (
        conversation.id === selectedConversation.id ? { ...conversation, updated_at: updatedAt } : conversation
      )));
    }

    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedConversation) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: publicUrl,
      });
      if (msgError) throw msgError;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);
    } catch (err) {
      console.error('Error uploading image:', err);
      toast({
        title: 'Error',
        description: 'No se pudo subir la imagen',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const otherUser =
    selectedConversation &&
    (selectedConversation.buyer_id === user?.id
      ? selectedConversation.seller
      : selectedConversation.buyer);

  if (initLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-white p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">Iniciando chat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          {selectedConversation && !productId && (
            <button
              onClick={() => setSelectedConversation(null)}
              className="hover:bg-primary-foreground/10 p-2 rounded-lg transition"
              aria-label="Volver"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg overflow-hidden">
            {otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              (otherUser?.full_name || 'U')[0].toUpperCase()
            )}
          </div>
          <div>
            <h3 className="font-semibold leading-none">
              {otherUser?.full_name || 'Chat'}
            </h3>
            {selectedConversation?.product && (
              <p className="text-xs text-primary-foreground/80 mt-1 truncate max-w-[200px]">
                {selectedConversation.product.title}
              </p>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="hover:bg-primary-foreground/10 p-2 rounded-lg transition"
            aria-label="Cerrar chat"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Conversations List or Messages */}
      {!selectedConversation ? (
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-8">
              <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">No hay conversaciones aún</p>
              <p className="text-sm">Contacta con un vendedor para empezar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => {
                const other = conv.buyer_id === user?.id ? conv.seller : conv.buyer;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className="w-full flex items-center gap-3 p-3 bg-white hover:bg-primary/5 border border-transparent hover:border-primary/20 rounded-xl transition-all text-left shadow-sm"
                  >
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 overflow-hidden shrink-0">
                      {other?.avatar_url ? (
                        <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (other?.full_name || 'U')[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {other?.full_name || 'Usuario'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.product?.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-8">
                <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-medium">Inicia la conversación</p>
                <p className="text-sm">Pregunta al vendedor sobre el producto</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  content={msg.content}
                  isOwn={msg.sender_id === user?.id}
                  isRead={!!msg.read}
                  timestamp={new Date(msg.created_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              ))
            )}
            {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="border-t p-4 flex gap-2 bg-white"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="p-2 rounded-lg text-muted-foreground hover:bg-slate-100 disabled:opacity-50 transition"
              aria-label="Adjuntar imagen"
            >
              <ImageIcon size={22} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (otherUser?.full_name) startTyping(otherUser.full_name);
              }}
              onBlur={() => stopTyping()}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-2 bg-slate-100 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newMessage.trim()}
              className="bg-primary text-primary-foreground p-2 rounded-full hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center w-10 h-10"
            >
              <Send size={20} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
