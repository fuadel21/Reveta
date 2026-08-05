import { supabase } from '@/integrations/supabase/client';

export interface MessagingProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface MessagingProduct {
  id: string;
  title: string;
  images: string[] | null;
  status: string | null;
  price: number | null;
  user_id?: string | null;
}

export interface MessagingMessagePreview {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean | null;
}

export interface MessagingConversation {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string | null;
  product: MessagingProduct | null;
  buyer: MessagingProfile | null;
  seller: MessagingProfile | null;
  otherName: string;
  unreadCount: number;
  pendingOffers: number;
  actionableOffers: number;
  transactionId: string | null;
  transactionStatus: string | null;
  hasOpenDispute: boolean;
  lastMessage: MessagingMessagePreview | null;
  lastMessageAt: string | null;
}

export interface MessagingInboxResult {
  conversations: MessagingConversation[];
  partial: boolean;
}

type ConversationRow = Pick<MessagingConversation, 'id' | 'product_id' | 'buyer_id' | 'seller_id' | 'updated_at'>;

const CONVERSATION_SELECT = 'id, product_id, buyer_id, seller_id, updated_at';
const ACTIVE_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
const OPEN_DISPUTE_STATUSES = ['open', 'under_review'];

const unique = (values: Array<string | null | undefined>) => Array.from(new Set(values.filter((value): value is string => Boolean(value))));
const operationKey = (productId: string, buyerId: string, sellerId: string) => `${productId}:${buyerId}:${sellerId}`;
const emptyResult = () => Promise.resolve({ data: [], error: null });

export const previewMessage = (content?: string | null) => {
  const value = String(content || '').trim();
  if (!value) return 'Sin mensajes todavía';
  if (/^https?:\/\/\S+\.(?:jpe?g|png|webp)(?:\?.*)?$/i.test(value)) return '📷 Imagen';
  if (value.includes('/call/')) return '📞 Llamada privada';
  return value.replace(/\s+/g, ' ').slice(0, 90);
};

export const hydrateMessagingConversations = async (rows: ConversationRow[], userId: string): Promise<MessagingInboxResult> => {
  if (rows.length === 0) return { conversations: [], partial: false };

  const conversationIds = unique(rows.map((row) => row.id));
  const productIds = unique(rows.map((row) => row.product_id));
  const profileIds = unique(rows.flatMap((row) => [row.buyer_id, row.seller_id]));
  const recentMessageLimit = Math.min(Math.max(conversationIds.length * 8, 100), 1500);

  const [productsResult, profilesResult, unreadResult, recentMessagesResult, offersResult, transactionsResult] = await Promise.all([
    productIds.length
      ? (supabase as any).from('products').select('id, title, images, status, price, user_id').in('id', productIds)
      : emptyResult(),
    profileIds.length
      ? (supabase as any).from('profiles').select('id, full_name, avatar_url').in('id', profileIds)
      : emptyResult(),
    conversationIds.length
      ? (supabase as any).from('messages').select('id, conversation_id').in('conversation_id', conversationIds).eq('read', false).neq('sender_id', userId).limit(2500)
      : emptyResult(),
    conversationIds.length
      ? (supabase as any).from('messages').select('id, conversation_id, sender_id, content, created_at, read').in('conversation_id', conversationIds).order('created_at', { ascending: false }).limit(recentMessageLimit)
      : emptyResult(),
    conversationIds.length
      ? (supabase as any).from('offers').select('id, conversation_id, buyer_id, seller_id, created_by, status').in('conversation_id', conversationIds).eq('status', 'pending').limit(1000)
      : emptyResult(),
    (supabase as any).from('transactions').select('id, product_id, buyer_id, seller_id, status, created_at').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).in('status', ACTIVE_TRANSACTION_STATUSES).order('created_at', { ascending: false }).limit(500),
  ]);

  const transactions = transactionsResult.data || [];
  const transactionIds = unique(transactions.map((row: any) => row.id));
  const disputesResult = transactionIds.length
    ? await (supabase as any).from('disputes').select('id, transaction_id, status').in('transaction_id', transactionIds).in('status', OPEN_DISPUTE_STATUSES).limit(500)
    : { data: [], error: null };

  const allResults = [productsResult, profilesResult, unreadResult, recentMessagesResult, offersResult, transactionsResult, disputesResult];
  const partial = allResults.some((result: any) => Boolean(result?.error));
  allResults.forEach((result: any) => {
    if (result?.error) console.warn('Messaging inbox section could not be loaded:', result.error.message || result.error);
  });

  const productsById = new Map<string, MessagingProduct>((productsResult.data || []).map((row: MessagingProduct) => [row.id, row]));
  const profilesById = new Map<string, MessagingProfile>((profilesResult.data || []).map((row: MessagingProfile) => [row.id, row]));

  const unreadByConversation = new Map<string, number>();
  for (const row of unreadResult.data || []) {
    unreadByConversation.set(row.conversation_id, (unreadByConversation.get(row.conversation_id) || 0) + 1);
  }

  const lastMessageByConversation = new Map<string, MessagingMessagePreview>();
  for (const row of recentMessagesResult.data || []) {
    if (!lastMessageByConversation.has(row.conversation_id)) lastMessageByConversation.set(row.conversation_id, row as MessagingMessagePreview);
  }

  const pendingOffersByConversation = new Map<string, number>();
  const actionableOffersByConversation = new Map<string, number>();
  for (const offer of offersResult.data || []) {
    pendingOffersByConversation.set(offer.conversation_id, (pendingOffersByConversation.get(offer.conversation_id) || 0) + 1);
    const createdBy = offer.created_by || offer.buyer_id;
    if (createdBy !== userId) actionableOffersByConversation.set(offer.conversation_id, (actionableOffersByConversation.get(offer.conversation_id) || 0) + 1);
  }

  const transactionByOperation = new Map<string, any>();
  for (const transaction of transactions) {
    const key = operationKey(transaction.product_id, transaction.buyer_id, transaction.seller_id);
    if (!transactionByOperation.has(key)) transactionByOperation.set(key, transaction);
  }

  const disputedTransactionIds = new Set<string>((disputesResult.data || []).map((row: any) => row.transaction_id));

  const conversations = rows.map((row) => {
    const buyer = profilesById.get(row.buyer_id) || null;
    const seller = profilesById.get(row.seller_id) || null;
    const other = row.buyer_id === userId ? seller : buyer;
    const transaction = transactionByOperation.get(operationKey(row.product_id, row.buyer_id, row.seller_id));
    const lastMessage = lastMessageByConversation.get(row.id) || null;

    return {
      ...row,
      product: productsById.get(row.product_id) || null,
      buyer,
      seller,
      otherName: other?.full_name || 'Usuario Reveta',
      unreadCount: unreadByConversation.get(row.id) || 0,
      pendingOffers: pendingOffersByConversation.get(row.id) || 0,
      actionableOffers: actionableOffersByConversation.get(row.id) || 0,
      transactionId: transaction?.id || null,
      transactionStatus: transaction?.status || null,
      hasOpenDispute: Boolean(transaction?.id && disputedTransactionIds.has(transaction.id)),
      lastMessage,
      lastMessageAt: lastMessage?.created_at || row.updated_at || null,
    } satisfies MessagingConversation;
  }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

  return { conversations, partial };
};

export const loadMessagingInbox = async (userId: string, limit = 100): Promise<MessagingInboxResult> => {
  const { data, error } = await (supabase as any)
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return hydrateMessagingConversations((data || []) as ConversationRow[], userId);
};

export const loadMessagingConversation = async (conversationId: string, userId: string): Promise<MessagingConversation | null> => {
  const { data, error } = await (supabase as any)
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('id', conversationId)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const result = await hydrateMessagingConversations([data as ConversationRow], userId);
  return result.conversations[0] || null;
};
