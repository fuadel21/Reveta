import { supabase } from '@/integrations/supabase/client';

export type SellerProductMetrics = {
  favorites: number;
  conversations: number;
  offers: number;
  reservations: number;
  openTransactions: number;
};

export type SellerInventoryProduct = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  location: string | null;
  images: string[] | null;
  status: string | null;
  created_at: string;
  boosted_until: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  condition: string | null;
  latitude: number | null;
  longitude: number | null;
  metrics: SellerProductMetrics;
  latestConversationId: string | null;
  latestConversationAt: string | null;
};

export const OPEN_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
export const SELLER_PRODUCT_LIMIT = 200;
const PAGE_SIZE = 1000;
const EMPTY_METRICS: SellerProductMetrics = { favorites: 0, conversations: 0, offers: 0, reservations: 0, openTransactions: 0 };

const rowsFrom = <T,>(result: PromiseSettledResult<any>): T[] => result.status === 'fulfilled' && !result.value.error ? (result.value.data || []) as T[] : [];

const fetchRows = async (
  table: string,
  productIds: string[],
  select: string,
  configure?: (query: any) => any,
) => {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = (supabase as any).from(table).select(select).in('product_id', productIds).range(from, from + PAGE_SIZE - 1);
    if (configure) query = configure(query);
    const { data, error } = await query;
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
};

const countByProduct = (rows: Array<{ product_id: string }>) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.product_id, (counts.get(row.product_id) || 0) + 1));
  return counts;
};

export const loadSellerInventory = async (userId: string) => {
  const { data, error } = await (supabase as any)
    .from('products')
    .select('id,title,description,price,location,images,status,created_at,boosted_until,category_id,subcategory_id,condition,latitude,longitude')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(SELLER_PRODUCT_LIMIT);

  if (error) throw error;
  const products = data || [];
  if (products.length === 0) return { products: [] as SellerInventoryProduct[], partial: false };

  const productIds = products.map((product: any) => product.id);
  const supporting = await Promise.allSettled([
    fetchRows('favorites', productIds, 'product_id'),
    fetchRows('conversations', productIds, 'id,product_id,updated_at', (query) => query.order('updated_at', { ascending: false })),
    fetchRows('offers', productIds, 'product_id,status', (query) => query.in('status', ['pending', 'accepted'])),
    fetchRows('product_reservations', productIds, 'product_id,status', (query) => query.eq('status', 'active')),
    fetchRows('transactions', productIds, 'product_id,status', (query) => query.in('status', OPEN_TRANSACTION_STATUSES)),
  ]);

  const favorites = rowsFrom<Array<{ product_id: string }>[number]>(supporting[0]);
  const conversations = rowsFrom<Array<{ id: string; product_id: string; updated_at: string | null }>[number]>(supporting[1]);
  const offers = rowsFrom<Array<{ product_id: string }>[number]>(supporting[2]);
  const reservations = rowsFrom<Array<{ product_id: string }>[number]>(supporting[3]);
  const transactions = rowsFrom<Array<{ product_id: string }>[number]>(supporting[4]);

  const favoriteCounts = countByProduct(favorites);
  const conversationCounts = countByProduct(conversations);
  const offerCounts = countByProduct(offers);
  const reservationCounts = countByProduct(reservations);
  const transactionCounts = countByProduct(transactions);
  const latestConversation = new Map<string, { id: string; updated_at: string | null }>();
  conversations.forEach((row) => {
    const current = latestConversation.get(row.product_id);
    if (!current || new Date(row.updated_at || 0).getTime() > new Date(current.updated_at || 0).getTime()) {
      latestConversation.set(row.product_id, { id: row.id, updated_at: row.updated_at });
    }
  });

  return {
    products: products.map((product: any): SellerInventoryProduct => ({
      ...product,
      metrics: {
        ...EMPTY_METRICS,
        favorites: favoriteCounts.get(product.id) || 0,
        conversations: conversationCounts.get(product.id) || 0,
        offers: offerCounts.get(product.id) || 0,
        reservations: reservationCounts.get(product.id) || 0,
        openTransactions: transactionCounts.get(product.id) || 0,
      },
      latestConversationId: latestConversation.get(product.id)?.id || null,
      latestConversationAt: latestConversation.get(product.id)?.updated_at || null,
    })),
    partial: supporting.some((result) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error)),
  };
};

export const productInterest = (product: SellerInventoryProduct) => product.metrics.favorites + product.metrics.conversations + product.metrics.offers + product.metrics.reservations;
export const productBlocked = (product: SellerInventoryProduct) => product.metrics.openTransactions > 0 || product.metrics.reservations > 0;
export const productAgeDays = (product: SellerInventoryProduct) => Math.max(0, Math.floor((Date.now() - new Date(product.created_at).getTime()) / 86400000));
export const productIsStale = (product: SellerInventoryProduct) => product.status === 'active' && productAgeDays(product) >= 30 && productInterest(product) === 0;
export const productNeedsAttention = (product: SellerInventoryProduct) => productBlocked(product) || product.metrics.offers > 0 || productIsStale(product);
export const productAttentionScore = (product: SellerInventoryProduct) => product.metrics.openTransactions * 20 + product.metrics.reservations * 15 + product.metrics.offers * 8 + product.metrics.conversations * 2 + Number(productIsStale(product)) * 5;

export const sellerRecommendation = (product: SellerInventoryProduct) => {
  const imageCount = product.images?.length || 0;
  if (product.metrics.openTransactions > 0) return 'Gestiona la operación abierta antes de cambiar o archivar el anuncio.';
  if (product.metrics.reservations > 0) return 'Hay una reserva activa. Revisa la operación o contacta con el comprador.';
  if (product.metrics.offers > 0) return 'Tienes ofertas pendientes: respóndelas pronto para no perder compradores.';
  if (imageCount < 2) return 'Añade varias fotos claras para generar más confianza.';
  if ((product.description || '').trim().length < 80) return 'Amplía la descripción con marca, estado, medidas y accesorios.';
  if (!product.location) return 'Añade una ubicación para aparecer en búsquedas cercanas.';
  if (productIsStale(product)) return 'Lleva más de 30 días sin interés. Duplica el anuncio para revisar precio, título y foto principal.';
  if (product.metrics.favorites >= 3 && product.metrics.conversations === 0) return 'Tiene favoritos pero pocos mensajes: prueba una pequeña bajada de precio.';
  if (product.metrics.conversations > 0 && product.metrics.offers === 0) return 'Hay conversaciones abiertas: responde rápido y facilita la negociación.';
  return 'El anuncio está bien preparado. Mantén respuestas rápidas y los datos actualizados.';
};
