import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, X } from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

interface Conversation {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  product?: {
    id: string;
    title: string;
    image_url: string;
  };
  buyer?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
  seller?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

interface ChatProps {
  productId?: string;
  sellerId?: string;
  onClose?: () => void;
}

export const Chat: React.FC<ChatProps> = ({ productId, sellerId, onClose }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          product:products(id, title, image_url),
          buyer:profiles!buyer_id(id, full_name, avatar_url),
          seller:profiles!seller_id(id, full_name, avatar_url)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (error) {
        console.error('Error fetching conversations:', error);
        return;
      }

      setConversations(data || []);
    };

    fetchConversations();
  }, [user]);

  // Subscribe to new conversations
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`conversations:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `buyer_id=eq.${user.id},seller_id=eq.${user.id}`,
        },
        (payload) => {
          setConversations((prev) => [...prev, payload.new as Conversation]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(id, full_name, avatar_url)
        `)
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
    };

    fetchMessages();
  }, [selectedConversation]);

  // Subscribe to new messages
  useEffect(() => {
    if (!selectedConversation) return;

    const subscription = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedConversation]);

  // Create or get conversation
  const startChat = async (product: any, otherUserId: string) => {
    if (!user) return;

    const buyerId = user.id;
    const seller = otherUserId;

    // Check if conversation exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('product_id', product.id)
      .eq('buyer_id', buyerId)
      .eq('seller_id', seller)
      .single();

    if (existing) {
      setSelectedConversation(existing);
      return;
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        product_id: product.id,
        buyer_id: buyerId,
        seller_id: seller,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return;
    }

    setSelectedConversation(newConv);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedConversation || !user) return;

    setLoading(true);

    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      content: newMessage,
    });

    if (error) {
      console.error('Error sending message:', error);
    } else {
      setNewMessage('');
    }

    setLoading(false);
  };

  const otherUser =
    selectedConversation &&
    (selectedConversation.buyer_id === user?.id
      ? selectedConversation.seller
      : selectedConversation.buyer);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="flex items-center gap-3">
          {otherUser?.avatar_url && (
            <img
              src={otherUser.avatar_url}
              alt={otherUser.full_name}
              className="w-10 h-10 rounded-full object-cover"
            />
          )}
          <div>
            <h3 className="font-semibold text-white">
              {otherUser?.full_name || 'Chat'}
            </h3>
            {selectedConversation?.product && (
              <p className="text-xs text-blue-100">
                {selectedConversation.product.title}
              </p>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-600 p-2 rounded-lg transition"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Conversations List or Messages */}
      {!selectedConversation ? (
        <div className="flex-1 overflow-y-auto p-4">
          {conversations.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No hay conversaciones aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => {
                const otherUser =
                  conv.buyer_id === user?.id ? conv.seller : conv.buyer;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg transition text-left"
                  >
                    {otherUser?.avatar_url && (
                      <img
                        src={otherUser.avatar_url}
                        alt={otherUser?.full_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {otherUser?.full_name}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Inicia la conversación</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.sender_id === user?.id
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-200 text-gray-900 rounded-bl-none'
                    }`}
                  >
                    <p className="break-words">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.sender_id === user?.id
                          ? 'text-blue-100'
                          : 'text-gray-600'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="border-t p-4 flex gap-2"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newMessage.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              <Send size={18} />
            </button>
          </form>

          {/* Back Button */}
          <button
            onClick={() => setSelectedConversation(null)}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 py-2 border-t"
          >
            ← Volver a conversaciones
          </button>
        </>
      )}
    </div>
  );
};
