import { supabase } from '@/integrations/supabase/client';

export type MessagingProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type MessagingProduct = {
  id: string;
  title: string;
  images: string[] | null;
  status: string | null;
  price: number | null;
  user_id: string | null;
};

export type MessagingPreview = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type MessagingConversation = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string | null;
  product: MessagingProduct | null;
  buyer: MessagingProfile | null;
  seller: MessagingProfile | null;
  unreadCount: number;
  pendingOffers: number;
  transactionId: string | null;
  transactionStatus: string | null;
  hasOpenDispute: boolean;
  lastMessage: MessagingPreview | null;
};

const ACTIVE_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
const conversationKey = (productId: string, buyerId: string, sellerId: string) => `${productId}:${buyerId}:${sellerId}`;
const rowsFrom = <T,>(result: PromiseSettledResult<any>): T[] =>
  result.status === 'fulfilled' && !result.value.error ? (result.value.data || []) as T[] : [];
const failed = (result: PromiseSettledResult<any>) =>
  result.status === 'rejected' || (result.status === 'fulfilled' && Boolean(result.value.error));

export const otherParticipant = (conversation: MessagingConversation, userId?: string | null) =>
  conversation.buyer_id === userId ? conversation.seller : conversation.buyer;

export const conversationNeedsAttention = (conversation: MessagingConversation) =>
  conversation.hasOpenDispute ||
  conversation.unreadCount > 0 ||
  conversation.pendingOffers > 0 ||
  Boolean(conversation.transactionStatus);

export const loadMessagingOverview = async (userId: string, limit = 100) => {
  const { data: conversationRows, error: conversationError } = await (supabase as any)
    .from('conversations')
    .select('id,product_id,buyer_id,seller_id,updated_at')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (conversationError) throw conversationError;
  const conversations = (conversationRows || []) as Array<{
    id: string;
    product_id: string;
    buyer_id: string;
    seller_id: string;
    updated_at: string | null;
  }>;

  if (conversations.length === 0) {
    return { conversations: [] as MessagingConversation[], partial: false };
  }

  const conversationIds = [...new Set(conversations.map((row) => row.id))];
  const productIds = [...new Set(conversations.map((row) => row.product_id))];
  const profileIds = [...new Set(conversations.flatMap((row) => [row.buyer_id, row.seller_id]))];
  const recentMessageLimit = Math.min(Math.max(conversationIds.length * 8, 200), 1500);

  const supporting = await Promise.allSettled([
    supabase.from('products').select('id,title,images,status,price,user_id').in('id', productIds),
    supabase.from('profiles').select('id,full_name,avatar_url').in('id', profileIds),
    (supabase as any).from('messages').select('id,conversation_id,sender_id,content,created_at').in('conversation_id', conversationIds).order('created_at', { ascending: false }).limit(recentMessageLimit),
    (supabase as any).from('messages').select('id,conversation_id').in('conversation_id', conversationIds).eq('read', false).neq('sender_id', userId).limit(5000),
    (supabase as any).from('offers').select('id,conversation_id').in('conversation_id', conversationIds).eq('status', 'pending').limit(2000),
    (supabase as any).from('transactions').select('id,product_id,buyer_id,seller_id,status,created_at').in('product_id', productIds).or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).in('status', ACTIVE_TRANSACTION_STATUSES).order('created_at', { ascending: false }).limit(500),
  ]);

  const products = rowsFrom<any>(supporting[0]);
  const profiles = rowsFrom<any>(supporting[1]);
  const recentMessages = rowsFrom<any>(supporting[2]);
  const unreadMessages = rowsFrom<any>(supporting[3]);
  const pendingOffers = rowsFrom<any>(supporting[4]);
  const transactions = rowsFrom<any>(supporting[5]);

  const transactionIds = [...new Set(transactions.map((row) => row.id).filter(Boolean))];
  const disputeResult = transactionIds.length > 0
    ? await Promise.allSettled([
      (supabase as any).from('disputes').select('id,transaction_id,status').in('transaction_id', transactionIds).in('status', ['open', 'under_review']).limit(500),
    ])
    : [];
  const disputes = disputeResult.length > 0 ? rowsFrom<any>(disputeResult[0]) : [];

  const productMap = new Map(products.map((row) => [row.id, row]));
  const profileMap = new Map(profiles.map((row) => [row.id, row]));
  const unreadMap = new Map<string, number>();
  const offerMap = new Map<string, number>();
  const lastMessageMap = new Map<string, MessagingPreview>();
  const transactionMap = new Map<string, any>();
  const disputedTransactions = new Set(disputes.map((row) => row.transaction_id).filter(Boolean));

  unreadMessages.forEach((row) => unreadMap.set(row.conversation_id, (unreadMap.get(row.conversation_id) || 0) + 1));
  pendingOffers.forEach((row) => offerMap.set(row.conversation_id, (offerMap.get(row.conversation_id) || 0) + 1));
  recentMessages.forEach((row) => {
    if (!lastMessageMap.has(row.conversation_id)) {
      lastMessageMap.set(row.conversation_id, {
        id: row.id,
        sender_id: row.sender_id,
        content: row.content,
        created_at: row.created_at,
      });
    }
  });
  transactions.forEach((row) => {
    const key = conversationKey(row.product_id, row.buyer_id, row.seller_id);
    if (!transactionMap.has(key)) transactionMap.set(key, row);
  });

  const hydrated = conversations.map((row): MessagingConversation => {
    const transaction = transactionMap.get(conversationKey(row.product_id, row.buyer_id, row.seller_id));
    return {
      ...row,
      product: productMap.get(row.product_id) || null,
      buyer: profileMap.get(row.buyer_id) || null,
      seller: profileMap.get(row.seller_id) || null,
      unreadCount: unreadMap.get(row.id) || 0,
      pendingOffers: offerMap.get(row.id) || 0,
      transactionId: transaction?.id || null,
      transactionStatus: transaction?.status || null,
      hasOpenDispute: Boolean(transaction?.id && disputedTransactions.has(transaction.id)),
      lastMessage: lastMessageMap.get(row.id) || null,
    };
  });

  return {
    conversations: hydrated,
    partial: supporting.some(failed) || disputeResult.some(failed),
  };
};

export const productStatusLabel = (status?: string | null) => ({
  active: 'Disponible',
  reserved: 'Reservado',
  sold: 'Vendido',
  inactive: 'Retirado',
} as Record<string, string>)[status || ''] || 'Sin estado';

export const transactionStatusLabel = (status?: string | null) => ({
  pending: 'Operación pendiente',
  pending_payment: 'Pendiente de pago',
  paid: 'Pago confirmado',
  shipped: 'Enviado',
  disputed: 'Con incidencia',
  under_review: 'En revisión',
} as Record<string, string>)[status || ''] || '';

export const formatConversationTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export const messagePreview = (content?: string | null) => {
  if (!content) return 'Sin mensajes todavía';
  if (/^https?:\/\/\S+\.(?:jpg|jpeg|png|webp)(?:\?.*)?$/i.test(content)) return '📷 Imagen';
  if (content.includes('/call/')) return '📞 Llamada privada';
  return content.replace(/\s+/g, ' ').trim().slice(0, 90);
};
