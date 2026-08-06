import { supabase } from '@/integrations/supabase/client';

export type UnifiedSafetyStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
export type UnifiedSafetyKind = 'user' | 'product';

export type UnifiedSafetyReport = {
  id: string;
  kind: UnifiedSafetyKind;
  reporterId: string;
  reporterName: string;
  reportedUserId: string | null;
  reportedName: string;
  productId: string | null;
  productTitle: string | null;
  productStatus: string | null;
  conversationId: string | null;
  reason: string;
  details: string | null;
  source: string;
  status: UnifiedSafetyStatus;
  rawStatus: string;
  createdAt: string;
  reviewedAt: string | null;
  resolutionNotes: string | null;
  recurrence: number;
};

export type UnifiedUserBlock = {
  blockerId: string;
  blockerName: string;
  blockedId: string;
  blockedName: string;
  createdAt: string;
};

export type SafetyCenterData = {
  reports: UnifiedSafetyReport[];
  blocks: UnifiedUserBlock[];
  verified: boolean;
  failedSections: number;
};

export type AdminSafetyData = {
  reports: UnifiedSafetyReport[];
  blocks: UnifiedUserBlock[];
  failedSections: number;
};

type ProfileRow = { id: string; full_name: string | null; username: string | null; verified?: boolean | null };
type ProductRow = { id: string; title: string; status: string | null; user_id?: string | null };

type RawSafetyReport = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  product_id: string | null;
  conversation_id: string | null;
  reason: string;
  details: string | null;
  source: string | null;
  status: string | null;
  reviewed_at: string | null;
  resolution_notes?: string | null;
  created_at: string;
};

type RawProductReport = {
  id: string;
  product_id: string;
  seller_id: string | null;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: string | null;
  created_at: string;
};

type RawBlock = { blocker_id: string; blocked_id: string; created_at: string };

const ACTIVE_STATUSES = new Set<UnifiedSafetyStatus>(['open', 'under_review']);
const IN_QUERY_CHUNK = 150;

export const SAFETY_STATUS_LABELS: Record<UnifiedSafetyStatus, string> = {
  open: 'Abierto',
  under_review: 'En revisión',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
};

export const SAFETY_SOURCE_LABELS: Record<string, string> = {
  public_profile: 'Perfil público',
  product: 'Producto',
  chat: 'Conversación',
  transaction: 'Operación',
  unknown: 'Otro',
};

export const PRODUCT_REPORT_REASON_LABELS: Record<string, string> = {
  possible_fraud: 'Posible fraude o estafa',
  fake_product: 'Producto falso o sospechoso',
  prohibited_item: 'Producto no permitido',
  suspicious_price: 'Precio sospechoso',
  spam: 'Spam o anuncio repetido',
  other: 'Otro motivo',
};

export const normalizeSafetyStatus = (value?: string | null): UnifiedSafetyStatus => {
  if (value === 'reviewing' || value === 'under_review') return 'under_review';
  if (value === 'resolved') return 'resolved';
  if (value === 'dismissed') return 'dismissed';
  return 'open';
};

export const isActiveSafetyStatus = (status: UnifiedSafetyStatus) => ACTIVE_STATUSES.has(status);

export const formatSafetyDate = (value: string) => new Date(value).toLocaleString('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const profileName = (profile?: ProfileRow | null) => profile?.full_name || profile?.username || 'Usuario de Reveta';

const productSlug = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'producto';

export const safetyContextHref = (report: UnifiedSafetyReport) => {
  if (report.conversationId) return `/messages?conversation=${encodeURIComponent(report.conversationId)}`;
  if (report.productId && report.productTitle) return `/producto/${report.productId}/${productSlug(report.productTitle)}`;
  if (report.reportedUserId) return `/usuario/${encodeURIComponent(report.reportedUserId)}`;
  return null;
};

export const adminSafetyContextHref = (report: UnifiedSafetyReport) => {
  if (report.conversationId) return `/admin/safety/conversations/${encodeURIComponent(report.conversationId)}`;
  if (report.productId && report.productTitle) return `/producto/${report.productId}/${productSlug(report.productTitle)}`;
  if (report.reportedUserId) return `/usuario/${encodeURIComponent(report.reportedUserId)}`;
  return null;
};

const settledRows = <T,>(result: PromiseSettledResult<{ data?: T[] | null; error?: unknown }>): T[] => {
  if (result.status !== 'fulfilled' || result.value.error) return [];
  return (result.value.data || []) as T[];
};

const chunksOf = <T,>(items: T[], size = IN_QUERY_CHUNK) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const loadProfilesAndProducts = async (profileIds: string[], productIds: string[]) => {
  const uniqueProfiles = Array.from(new Set(profileIds.filter(Boolean)));
  const uniqueProducts = Array.from(new Set(productIds.filter(Boolean)));

  const fetchProfiles = async () => {
    const rows: ProfileRow[] = [];
    let failures = 0;
    for (const ids of chunksOf(uniqueProfiles)) {
      const { data, error } = await supabase.from('profiles').select('id,full_name,username,verified').in('id', ids);
      if (error) failures += 1;
      else rows.push(...((data || []) as ProfileRow[]));
    }
    return { rows, failures };
  };

  const fetchProducts = async () => {
    const rows: ProductRow[] = [];
    let failures = 0;
    for (const ids of chunksOf(uniqueProducts)) {
      const { data, error } = await supabase.from('products').select('id,title,status,user_id').in('id', ids);
      if (error) failures += 1;
      else rows.push(...((data || []) as ProductRow[]));
    }
    return { rows, failures };
  };

  const [profiles, products] = await Promise.all([fetchProfiles(), fetchProducts()]);
  return {
    profilesById: new Map(profiles.rows.map((row) => [row.id, row])),
    productsById: new Map(products.rows.map((row) => [row.id, row])),
    failures: profiles.failures + products.failures,
  };
};

const normalizeReports = (
  safetyRows: RawSafetyReport[],
  productRows: RawProductReport[],
  profilesById: Map<string, ProfileRow>,
  productsById: Map<string, ProductRow>,
) => {
  const recurrenceByUser = new Map<string, number>();
  const recurrenceByProduct = new Map<string, number>();

  safetyRows.forEach((row) => {
    if (row.reported_user_id) recurrenceByUser.set(row.reported_user_id, (recurrenceByUser.get(row.reported_user_id) || 0) + 1);
    if (row.product_id) recurrenceByProduct.set(row.product_id, (recurrenceByProduct.get(row.product_id) || 0) + 1);
  });
  productRows.forEach((row) => {
    if (row.seller_id) recurrenceByUser.set(row.seller_id, (recurrenceByUser.get(row.seller_id) || 0) + 1);
    if (row.product_id) recurrenceByProduct.set(row.product_id, (recurrenceByProduct.get(row.product_id) || 0) + 1);
  });

  const userReports: UnifiedSafetyReport[] = safetyRows.map((row) => {
    const product = row.product_id ? productsById.get(row.product_id) : null;
    const status = normalizeSafetyStatus(row.status);
    return {
      id: row.id,
      kind: 'user',
      reporterId: row.reporter_id,
      reporterName: profileName(profilesById.get(row.reporter_id)),
      reportedUserId: row.reported_user_id,
      reportedName: profileName(row.reported_user_id ? profilesById.get(row.reported_user_id) : null),
      productId: row.product_id,
      productTitle: product?.title || null,
      productStatus: product?.status || null,
      conversationId: row.conversation_id,
      reason: row.reason,
      details: row.details,
      source: row.source || 'unknown',
      status,
      rawStatus: row.status || 'open',
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      resolutionNotes: row.resolution_notes ?? null,
      recurrence: row.reported_user_id
        ? recurrenceByUser.get(row.reported_user_id) || 1
        : row.product_id
          ? recurrenceByProduct.get(row.product_id) || 1
          : 1,
    };
  });

  const normalizedProductReports: UnifiedSafetyReport[] = productRows.map((row) => {
    const product = productsById.get(row.product_id);
    const status = normalizeSafetyStatus(row.status);
    return {
      id: row.id,
      kind: 'product',
      reporterId: row.reporter_id,
      reporterName: profileName(profilesById.get(row.reporter_id)),
      reportedUserId: row.seller_id,
      reportedName: profileName(row.seller_id ? profilesById.get(row.seller_id) : null),
      productId: row.product_id,
      productTitle: product?.title || 'Producto eliminado',
      productStatus: product?.status || null,
      conversationId: null,
      reason: PRODUCT_REPORT_REASON_LABELS[row.reason] || row.reason,
      details: row.details,
      source: 'product',
      status,
      rawStatus: row.status || 'pending',
      createdAt: row.created_at,
      reviewedAt: null,
      resolutionNotes: null,
      recurrence: Math.max(
        recurrenceByProduct.get(row.product_id) || 1,
        row.seller_id ? recurrenceByUser.get(row.seller_id) || 1 : 1,
      ),
    };
  });

  return [...userReports, ...normalizedProductReports]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const normalizeBlocks = (rows: RawBlock[], profilesById: Map<string, ProfileRow>): UnifiedUserBlock[] => rows.map((row) => ({
  blockerId: row.blocker_id,
  blockerName: profileName(profilesById.get(row.blocker_id)),
  blockedId: row.blocked_id,
  blockedName: profileName(profilesById.get(row.blocked_id)),
  createdAt: row.created_at,
}));

const PUBLIC_SAFETY_SELECT = 'id,reporter_id,reported_user_id,product_id,conversation_id,reason,details,source,status,reviewed_at,created_at';
const ADMIN_SAFETY_SELECT = `${PUBLIC_SAFETY_SELECT},resolution_notes`;
const PRODUCT_REPORT_SELECT = 'id,product_id,seller_id,reporter_id,reason,details,status,created_at';
const BLOCK_SELECT = 'blocker_id,blocked_id,created_at';

export const loadSafetyCenter = async (userId: string): Promise<SafetyCenterData> => {
  const results = await Promise.allSettled([
    (supabase as any).from('safety_reports').select(PUBLIC_SAFETY_SELECT).eq('reporter_id', userId).order('created_at', { ascending: false }).limit(100),
    (supabase as any).from('product_reports').select(PRODUCT_REPORT_SELECT).eq('reporter_id', userId).order('created_at', { ascending: false }).limit(100),
    (supabase as any).from('user_blocks').select(BLOCK_SELECT).eq('blocker_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('id,verified').eq('id', userId).maybeSingle(),
  ]);

  const safetyRows = settledRows<RawSafetyReport>(results[0] as any);
  const productReportRows = settledRows<RawProductReport>(results[1] as any);
  const blockRows = settledRows<RawBlock>(results[2] as any);
  const profileResult = results[3];
  const verified = profileResult.status === 'fulfilled' && !profileResult.value.error
    ? Boolean((profileResult.value.data as any)?.verified)
    : false;

  const profileIds = Array.from(new Set([
    userId,
    ...safetyRows.flatMap((row) => [row.reporter_id, ...(row.reported_user_id ? [row.reported_user_id] : [])]),
    ...productReportRows.flatMap((row) => [row.reporter_id, ...(row.seller_id ? [row.seller_id] : [])]),
    ...blockRows.flatMap((row) => [row.blocker_id, row.blocked_id]),
  ]));
  const productIds = Array.from(new Set([
    ...safetyRows.flatMap((row) => row.product_id ? [row.product_id] : []),
    ...productReportRows.map((row) => row.product_id),
  ]));

  const related = await loadProfilesAndProducts(profileIds, productIds);
  const failedSections = results.filter((result) => result.status !== 'fulfilled' || Boolean((result as any).value?.error)).length + related.failures;

  return {
    reports: normalizeReports(safetyRows, productReportRows, related.profilesById, related.productsById),
    blocks: normalizeBlocks(blockRows, related.profilesById),
    verified,
    failedSections,
  };
};

export const loadAdminSafety = async (): Promise<AdminSafetyData> => {
  const results = await Promise.allSettled([
    (supabase as any).from('safety_reports').select(ADMIN_SAFETY_SELECT).order('created_at', { ascending: false }).limit(1000),
    (supabase as any).from('product_reports').select(PRODUCT_REPORT_SELECT).order('created_at', { ascending: false }).limit(1000),
    (supabase as any).from('user_blocks').select(BLOCK_SELECT).order('created_at', { ascending: false }).limit(1000),
  ]);

  const safetyRows = settledRows<RawSafetyReport>(results[0] as any);
  const productReportRows = settledRows<RawProductReport>(results[1] as any);
  const blockRows = settledRows<RawBlock>(results[2] as any);

  const profileIds = Array.from(new Set([
    ...safetyRows.flatMap((row) => [row.reporter_id, ...(row.reported_user_id ? [row.reported_user_id] : [])]),
    ...productReportRows.flatMap((row) => [row.reporter_id, ...(row.seller_id ? [row.seller_id] : [])]),
    ...blockRows.flatMap((row) => [row.blocker_id, row.blocked_id]),
  ]));
  const productIds = Array.from(new Set([
    ...safetyRows.flatMap((row) => row.product_id ? [row.product_id] : []),
    ...productReportRows.map((row) => row.product_id),
  ]));

  const related = await loadProfilesAndProducts(profileIds, productIds);
  const failedSections = results.filter((result) => result.status !== 'fulfilled' || Boolean((result as any).value?.error)).length + related.failures;

  return {
    reports: normalizeReports(safetyRows, productReportRows, related.profilesById, related.productsById),
    blocks: normalizeBlocks(blockRows, related.profilesById),
    failedSections,
  };
};
