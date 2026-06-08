import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Send, ArrowLeft, MessageCircle, Tag, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import OfferDialog from '@/components/OfferDialog';
import OfferCard from '@/components/OfferCard';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';

interface Conversation {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string;
  products: {
    id: string;
    title: string;
    images: string[];
    price: number;
  };
  buyer_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  seller_profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface Offer {
  id: string;
  conversation_id: string;
  buyer_id: string;
  amount: number;
  status: string;
  created_at: string;
}

const Messages = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Typing indicator hook
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(
    selectedConversation?.id,
    user?.id
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      fetchOffers(selectedConversation.id);
      
      // Subscribe to new messages and offers
      const channel = supabase
        .channel(`chat:${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => [...prev, newMsg]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'offers',
            filter: `conversation_id=eq.${selectedConversation.id}`
          },
          () => {
            fetchOffers(selectedConversation.id);
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        products (id, title, images, price)
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching conversations:', error);
    } else {
      // Fetch profiles for each conversation
      const conversationsWithProfiles = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUserId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', otherUserId)
            .maybeSingle();
          
          return {
            ...conv,
            other_profile: profile
          };
        })
      );
      
      setConversations(conversationsWithProfiles);
    }
    setLoading(false);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
      
      // Mark messages as read
      if (user) {
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id);
      }
    }
  };

  const fetchOffers = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching offers:', error);
    } else {
      setOffers(data || []);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !selectedConversation || !newMessage.trim()) return;
    
    setSending(true);
    await stopTyping();
    
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: newMessage.trim()
      });
    
    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive'
      });
    } else {
      setNewMessage('');
      
      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);
    }
    
    setSending(false);
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

      // Send image URL as message
      await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          content: publicUrl
        });

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'No se pudo subir la imagen',
        variant: 'destructive'
      });
    }

    setUploadingImage(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    startTyping();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es-ES', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  };

  const getOtherUserName = (conv: any) => {
    return conv.other_profile?.full_name || 'Usuario';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Mensajes | Reveta</title>
        <meta name="description" content="Gestiona tus conversaciones con compradores y vendedores" />
      </Helmet>
      
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-1 container py-4">
          <div className="h-[calc(100vh-8rem)] flex border border-border rounded-lg overflow-hidden">
            {/* Conversations List */}
            <div className={cn(
              "w-full md:w-80 border-r border-border bg-card flex flex-col",
              selectedConversation && "hidden md:flex"
            )}>
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold">Mensajes</h2>
              </div>
              
              <ScrollArea className="flex-1">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tienes conversaciones</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className={cn(
                          "w-full p-4 flex gap-3 hover:bg-muted/50 transition-colors text-left",
                          selectedConversation?.id === conv.id && "bg-muted"
                        )}
                      >
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold shrink-0">
                          {getOtherUserName(conv)[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium truncate">{getOtherUserName(conv)}</span>
                            <span className="text-xs text-muted-foreground">{formatTime(conv.updated_at)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.products?.title}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
            
            {/* Chat Area */}
            <div className={cn(
              "flex-1 flex flex-col",
              !selectedConversation && "hidden md:flex"
            )}>
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-border flex items-center gap-3 bg-card">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setSelectedConversation(null)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold">
                      {getOtherUserName(selectedConversation)[0]?.toUpperCase() || 'U'}
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-medium">{getOtherUserName(selectedConversation)}</p>
                      <p className="text-sm text-muted-foreground">{selectedConversation.products?.title}</p>
                    </div>
                    
                    {selectedConversation.products?.images?.[0] && (
                      <img
                        src={selectedConversation.products.images[0]}
                        alt={selectedConversation.products.title}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    )}

                    {/* Offer button - only for buyers */}
                    {user?.id === selectedConversation.buyer_id && (
                      <OfferDialog
                        conversationId={selectedConversation.id}
                        productPrice={selectedConversation.products?.price || 0}
                        productTitle={selectedConversation.products?.title || ''}
                        onOfferSent={() => fetchOffers(selectedConversation.id)}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Tag className="h-4 w-4 mr-2" />
                            Oferta
                          </Button>
                        }
                      />
                    )}
                  </div>
                  
                  {/* Active Offers */}
                  {offers.length > 0 && (
                    <div className="px-4 py-2 border-b border-border space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Ofertas activas
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {offers.filter(o => o.status === 'pending').map((offer) => (
                          <OfferCard
                            key={offer.id}
                            offer={offer}
                            isSeller={user?.id === selectedConversation.seller_id}
                            productTitle={selectedConversation.products?.title || ''}
                            onStatusChange={() => fetchOffers(selectedConversation.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          content={msg.content}
                          isOwn={msg.sender_id === user?.id}
                          isRead={msg.read}
                          timestamp={formatTime(msg.created_at)}
                        />
                      ))}
                      
                      {/* Typing indicator */}
                      {typingUsers.length > 0 && (
                        <TypingIndicator users={typingUsers} />
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  {/* Input */}
                  <form onSubmit={sendMessage} className="p-4 border-t border-border bg-card">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="shrink-0"
                      >
                        <ImageIcon className={cn("h-5 w-5", uploadingImage && "animate-pulse")} />
                      </Button>
                      <Input
                        value={newMessage}
                        onChange={handleInputChange}
                        onBlur={() => stopTyping()}
                        placeholder="Escribe un mensaje..."
                        className="flex-1"
                      />
                      <Button type="submit" disabled={!newMessage.trim() || sending}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Tus mensajes</h3>
                    <p className="text-muted-foreground">
                      Selecciona una conversación para ver los mensajes
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Messages;
