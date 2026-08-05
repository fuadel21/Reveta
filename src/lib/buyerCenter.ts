import { supabase } from '@/integrations/supabase/client';

export type BuyerProduct = {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  location: string | null;
  created_at: string;
  status: string | null;
  condition: string | null;
  category_id: string | null;
  boosted_until?: string | null;
};

export type BuyerOffer = {
  id: string;
  product_id: string | null;
  conversation_id: string;
  amount: number;
  status: string;
  created_at: string;
};

export type BuyerTransaction = {
  id: string;
  product_id: string;
  amount: number;
  status: string;
  payment_status: string | null;
  shipping_status: string | null;
  sendcloud_tracking_url: string | null;
  created_at: string;
};

export type BuyerConversation = {
  id: string;
  product_id: string;
  updated_at: string;
};

export type BuyerSavedSearch = {
  id: string;
  name: string;
  alerts_enabled: boolean;
  created_at: string;
  query: string | null;
  category_id: string | null;
};

export type ProductWatchChange = {
  previousPrice: number | null;
  priceDrop: number;
  becameUnavailable: boolean;
};

export type BuyerCenterData = {
  favorites: BuyerProduct[];
  favoriteIds: string[];
  recent: BuyerProduct[];
  recommendations: BuyerProduct[];
  offers: BuyerOffer[];
  transactions: BuyerTransaction[];
  conversations: BuyerConversation[];
  savedSearches: BuyerSavedSearch[];
  productsById: Map<string, BuyerProduct>;
  watchChanges: Map<string, ProductWatchChange>;
  failedSections: number;
};

type WatchSnapshot = Record<string, { price: number; status: string | null; checkedAt: string }>;

const RECENT_KEY = 'reveta_recent_products_v1';
const WATCH_KEY_PREFIX = 'reveta:buyer-watch:v1';
const PRODUCT_FIELDS = 'id,title,price,images,location,created_at,status,condition,category_id,boosted_until';

export const EMPTY_BUYER_CENTER: BuyerCenterData = {
  favorites: [],
  favoriteIds: [],
  recent: [],
  recommendations: [],
  offers: [],
  transactions: [],
  conversations: [],
  savedSearches: [],
  productsById: new Map(),
  watchChanges: new Map(),
  failedSections: 0,
};

export const getRecentProductIds = () => {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string').slice(0, 20)
      : [];
  } catch {
    return [];
  }
};

export const clearRecentProducts = () => {
  if (typeof window !== 'undefined') localStorage.removeItem(RECENT_KEY);
};

const getWatchKey = (userId: string) => `${WATCH_KEY_PREFIX}:${userId}`;

const readWatchSnapshot = (userId: string): WatchSnapshot => {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(getWatchKey(userId)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveWatchSnapshot = (userId: string, products: BuyerProduct[], previous: WatchSnapshot) => {
  if (typeof window === 'undefined') return;
  const checkedAt = new Date().toISOString();
  const next = Object.fromEntries(products.map((product) => {
    const currentPrice = Number(product.price || 0);
    const oldPrice = Number(previous[product.id]?.price);
    const referencePrice = Number.isFinite(oldPrice) && currentPrice < oldPrice ? oldPrice : currentPrice;
    return [product.id, { price: referencePrice, status: product.status, checkedAt }];
  }));
  try {
    localStorage.setItem(getWatchKey(userId), JSON.stringify(next));
  } catch {
    // Tracking is an enhancement; a storage quota error must not block the buyer center.
  }
};

const calculateWatchChanges = (previous: WatchSnapshot, products: BuyerProduct[]) => {
  const changes = new Map<string, ProductWatchChange>();
  products.forEach((product) => {
    const old = previous[product.id];
    const currentPrice = Number(product.price || 0);
    const previousPrice = old && Number.isFinite(Number(old.price)) ? Number(old.price) : null;
    const priceDrop = previousPrice !== null && currentPrice < previousPrice ? previousPrice - currentPrice : 0;
    const becameUnavailable = Boolean(old?.status === 'active' && product.status !== 'active');
    changes.set(product.id, { previousPrice, priceDrop, becameUnavailable });
  });
  return changes;
};

const settledData = <T,>(result: PromiseSettledResult<{ data?: T | null; error?: unknown }>, fallback: T): T => {
  if (result.status !== 'fulfilled' || result.value.error) return fallback;
  return (result.value.data ?? fallback) as T;
};

export const loadBuyerCenter = async (userId: string): Promise<BuyerCenterData> => {
  const recentIds = getRecentProductIds();
  const results = await Promise.allSettled([
    (supabase as any).from('favorites').select('product_id,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
    (supabase as any).from('offers').select('id,product_id,conversation_id,amount,status,created_at').eq('buyer_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('transactions').select('id,product_id,amount,status,payment_status,shipping_status,sendcloud_tracking_url,created_at').eq('buyer_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('conversations').select('id,product_id,updated_at').eq('buyer_id', userId).order('updated_at', { ascending: false }).limit(50),
    (supabase as any).from('saved_searches').select('id,name,alerts_enabled,created_at,query,category_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  const favoriteRows = settledData<any[]>(results[0] as any, []);
  const offers = settledData<BuyerOffer[]>(results[1] as any, []);
  const transactions = settledData<BuyerTransaction[]>(results[2] as any, []);
  const conversations = settledData<BuyerConversation[]>(results[3] as any, []);
  const savedSearches = settledData<BuyerSavedSearch[]>(results[4] as any, []);
  const favoriteIds = favoriteRows.map((row) => String(row.product_id || '')).filter(Boolean);

  const relatedIds = Array.from(new Set([
    ...favoriteIds,
    ...recentIds,
    ...offers.map((offer) => offer.product_id).filter((id): id is string => Boolean(id)),
    ...transactions.map((transaction) => transaction.product_id).filter(Boolean),
    ...conversations.map((conversation) => conversation.product_id).filter(Boolean),
  ]));

  let relatedProducts: BuyerProduct[] = [];
  if (relatedIds.length > 0) {
    const { data, error } = await supabase.from('products').select(PRODUCT_FIELDS).in('id', relatedIds);
    if (error) throw error;
    relatedProducts = (data || []) as BuyerProduct[];
  }

  const productsById = new Map(relatedProducts.map((product) => [product.id, product]));
  const favorites = favoriteIds.map((id) => productsById.get(id)).filter((product): product is BuyerProduct => Boolean(product));
  const recent = recentIds.map((id) => productsById.get(id)).filter((product): product is BuyerProduct => Boolean(product));

  const excludedIds = Array.from(new Set([...favorites, ...recent].map((product) => product.id)));
  const categoryIds = Array.from(new Set([
    ...favorites.map((product) => product.category_id),
    ...recent.map((product) => product.category_id),
    ...savedSearches.map((search) => search.category_id),
  ].filter((id): id is string => Boolean(id))));

  let recommendationQuery: any = supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(16);
  if (categoryIds.length > 0) recommendationQuery = recommendationQuery.in('category_id', categoryIds);
  if (excludedIds.length > 0) recommendationQuery = recommendationQuery.not('id', 'in', `(${excludedIds.join(',')})`);

  let recommendationResult = await recommendationQuery;
  if (recommendationResult.error && categoryIds.length > 0) {
    recommendationResult = await supabase.from('products').select(PRODUCT_FIELDS).eq('status', 'active').order('created_at', { ascending: false }).limit(16);
  }

  const previousSnapshot = readWatchSnapshot(userId);
  const watchChanges = calculateWatchChanges(previousSnapshot, favorites);
  saveWatchSnapshot(userId, favorites, previousSnapshot);

  const failedSections = results.filter((result) => result.status === 'rejected' || (result.status === 'fulfilled' && Boolean((result.value as any)?.error))).length;

  return {
    favorites,
    favoriteIds,
    recent,
    recommendations: (recommendationResult.data || []) as BuyerProduct[],
    offers,
    transactions,
    conversations,
    savedSearches,
    productsById,
    watchChanges,
    failedSections,
  };
};
