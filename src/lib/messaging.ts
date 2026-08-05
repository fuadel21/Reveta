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
  transactionId: string | null;
  transactionStatus: string | null;
  hasOpenDispute: boolean;
}

export const ACTIVE_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];

const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter(Boolean) as string[])];
const increment = (map: Map<string, number>, key?: string | null) => {
  if (key) map.set(key, (map.get(key) || 0) + 1);
};
const operationKey = (productId: string, buyerId: string, sellerId: string) => `${productId}:${buyerId}:${sellerId}`;

export const loadMessagingConversations = async (userId: string, limit = 100) => {
  const { data: conversationRows, error: conversationError } = await (supabase as any)
    .from('conversations')
    .select('id, product_id, buyer_id, seller_id, updated_at')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (conversationError) throw conversationError;

  const rows = conversationRows || [];
  if (rows.length === 0) return { items: [] as MessagingConversation[], partial: false };

  const conversationIds = unique(rows.map((row: any) => row.id));
  const productIds = unique(rows.map((row: any) => row.product_id));
  const profileIds = unique(rows.flatMap((row: any) => [row.buyer_id, row.seller_id]));

  const [productsResult, profilesResult, unreadResult, offersResult, transactionsResult] = await Promise.all([
    (supabase as any).from('products').select('id, title, images, status, price, user_id').in('id', productIds),
    (supabase as any).from('profiles').select('id, full_name, avatar_url').in('id', profileIds),
    (supabase as any).from('messages').select('conversation_id').in('conversation_id', conversationIds).eq('read', false).neq('sender_id', userId),
    (supabase as any).from('offers').select('conversation_id').in('conversation_id', conversationIds).eq('status', 'pending'),
    (supabase as any)
      .from('transactions')
      .select('id, product_id, buyer_id, seller_id, status, created_at')
      .in('product_id', productIds)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .in('status', ACTIVE_TRANSACTION_STATUSES)
      .order('created_at', { ascending: false })
      .limit(Math.max(200, rows.length * 3)),
  ]);

  const transactionRows = transactionsResult.data || [];
  const transactionIds = unique(transactionRows.map((row: any) => row.id));
  const disputesResult = transactionIds.length > 0
    ? await (supabase as any).from('disputes').select('transaction_id').in('transaction_id', transactionIds).in('status', ['open', 'under_review'])
    : { data: [], error: null };

  const partial = [productsResult, profilesResult, unreadResult, offersResult, transactionsResult, disputesResult]
    .some((result: any) => Boolean(result.error));

  const products = new Map<string, MessagingProduct>((productsResult.data || []).map((item: MessagingProduct) => [item.id, item]));
  const profiles = new Map<string, MessagingProfile>((profilesResult.data || []).map((item: MessagingProfile) => [item.id, item]));
  const unreadCounts = new Map<string, number>();
  const offerCounts = new Map<string, number>();
  const transactions = new Map<string, any>();
  const disputedTransactionIds = new Set<string>((disputesResult.data || []).map((item: any) => item.transaction_id));

  (unreadResult.data || []).forEach((item: any) => increment(unreadCounts, item.conversation_id));
  (offersResult.data || []).forEach((item: any) => increment(offerCounts, item.conversation_id));
  transactionRows.forEach((item: any) => {
    const key = operationKey(item.product_id, item.buyer_id, item.seller_id);
    if (!transactions.has(key)) transactions.set(key, item);
  });

  const items = rows.map((row: any) => {
    const buyer = profiles.get(row.buyer_id) || null;
    const seller = profiles.get(row.seller_id) || null;
    const other = row.buyer_id === userId ? seller : buyer;
    const transaction = transactions.get(operationKey(row.product_id, row.buyer_id, row.seller_id)) || null;

    return {
      ...row,
      product: products.get(row.product_id) || null,
      buyer,
      seller,
      otherName: other?.full_name || 'Usuario Reveta',
      unreadCount: unreadCounts.get(row.id) || 0,
      pendingOffers: offerCounts.get(row.id) || 0,
      transactionId: transaction?.id || null,
      transactionStatus: transaction?.status || null,
      hasOpenDispute: Boolean(transaction?.id && disputedTransactionIds.has(transaction.id)),
    } as MessagingConversation;
  });

  return { items, partial };
};
