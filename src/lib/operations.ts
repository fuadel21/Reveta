import { supabase } from '@/integrations/supabase/client';
import { rowsFrom } from '@/lib/query-helpers';
import { supabaseUntyped } from '@/integrations/supabase/untyped';

export type OperationType = 'purchase' | 'sale';
export type OperationFilter = 'all' | 'action' | 'progress' | 'finished' | 'problem';
export type OperationAction = 'paid' | 'shipped' | 'completed';

export type Operation = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  payment_provider: string | null;
  payment_status: string | null;
  paid_at: string | null;
  shipping_status: string | null;
  sendcloud_tracking_number: string | null;
  sendcloud_tracking_url: string | null;
  offer_id?: string | null;
  product: { id: string; title: string; images: string[] | null; status: string | null } | null;
  counterpartyName: string;
  dispute: { id: string; reason: string; details: string | null; status: string } | null;
  reviewed: boolean;
  conversationId: string | null;
};

const SELECT = 'id,product_id,buyer_id,seller_id,amount,status,created_at,completed_at,payment_provider,payment_status,paid_at,shipping_status,sendcloud_tracking_number,sendcloud_tracking_url,offer_id';
export const OPEN_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
export const FINISHED_STATUSES = ['completed', 'cancelled', 'refunded'];
export const PROBLEM_STATUSES = ['disputed', 'under_review'];

const conversationKey = (productId: string, buyerId: string, sellerId: string) => `${productId}:${buyerId}:${sellerId}`;

interface TransactionRow {
  id: string; product_id: string; buyer_id: string; seller_id: string;
  amount: number | null; status: string; created_at: string | null; completed_at: string | null;
  payment_provider: string | null; payment_status: string | null; paid_at: string | null;
  shipping_status: string | null; sendcloud_tracking_number: string | null; sendcloud_tracking_url: string | null; offer_id: string | null;
}
interface ProductLiteRow { id: string; title: string | null; images: string[] | null; status: string }
interface ProfileLiteRow { id: string; full_name: string | null }
interface DisputeLiteRow { id: string; transaction_id: string; reason: string | null; details: string | null; status: string; created_at: string | null }
interface ConversationLiteRow { id: string; product_id: string; buyer_id: string; seller_id: string }

export const loadOperations = async (userId: string) => {
  const [purchaseResult, saleResult] = await Promise.all([
    supabaseUntyped.from('transactions').select(SELECT).eq('buyer_id', userId).order('created_at', { ascending: false }).limit(100),
    supabaseUntyped.from('transactions').select(SELECT).eq('seller_id', userId).order('created_at', { ascending: false }).limit(100),
  ]);

  if (purchaseResult.error && saleResult.error) throw new Error('No se pudieron cargar las operaciones');
  const purchases = (purchaseResult.data || []) as TransactionRow[];
  const sales = (saleResult.data || []) as TransactionRow[];
  const all = [...purchases, ...sales];
  if (all.length === 0) return { purchases: [] as Operation[], sales: [] as Operation[], partial: Boolean(purchaseResult.error || saleResult.error) };

  const transactionIds = [...new Set(all.map((row) => row.id))];
  const productIds = [...new Set(all.map((row) => row.product_id))];
  const profileIds = [...new Set(all.flatMap((row) => [row.buyer_id, row.seller_id]))];

  const supporting = await Promise.allSettled([
    supabase.from('products').select('id,title,images,status').in('id', productIds),
    supabase.from('profiles').select('id,full_name').in('id', profileIds),
    supabase.from('disputes').select('id,transaction_id,reason,details,status,created_at').in('transaction_id', transactionIds).in('status', ['open', 'under_review']).order('created_at', { ascending: false }),
    supabase.from('reviews').select('transaction_id').eq('reviewer_id', userId).in('transaction_id', transactionIds),
    supabase.from('conversations').select('id,product_id,buyer_id,seller_id').in('product_id', productIds).or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
  ]);

  const products = rowsFrom<ProductLiteRow>(supporting[0]);
  const profiles = rowsFrom<ProfileLiteRow>(supporting[1]);
  const disputes = rowsFrom<DisputeLiteRow>(supporting[2]);
  const reviews = rowsFrom<{ transaction_id: string }>(supporting[3]);
  const conversations = rowsFrom<ConversationLiteRow>(supporting[4]);
  const productMap = new Map(products.map((row) => [row.id, row]));
  const profileMap = new Map(profiles.map((row) => [row.id, row]));
  const disputeMap = new Map<string, DisputeLiteRow>();
  disputes.forEach((row) => { if (row.transaction_id && !disputeMap.has(row.transaction_id)) disputeMap.set(row.transaction_id, row); });
  const reviewed = new Set(reviews.map((row) => row.transaction_id).filter(Boolean));
  const conversationMap = new Map(conversations.map((row) => [conversationKey(row.product_id, row.buyer_id, row.seller_id), row.id]));

  const hydrate = (row: TransactionRow, type: OperationType): Operation => ({
    ...row,
    product: productMap.get(row.product_id) || null,
    counterpartyName: profileMap.get(type === 'purchase' ? row.seller_id : row.buyer_id)?.full_name || (type === 'purchase' ? 'Vendedor' : 'Comprador'),
    dispute: disputeMap.get(row.id) || null,
    reviewed: reviewed.has(row.id),
    conversationId: conversationMap.get(conversationKey(row.product_id, row.buyer_id, row.seller_id)) || null,
  });

  return {
    purchases: purchases.map((row) => hydrate(row, 'purchase')),
    sales: sales.map((row) => hydrate(row, 'sale')),
    partial: Boolean(purchaseResult.error || saleResult.error || supporting.some((result) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error))),
  };
};

export const statusLabel = (status: string) => ({ pending: 'Reservado / pendiente', pending_payment: 'Pago pendiente', paid: 'Pago confirmado', shipped: 'Enviado', completed: 'Completada', cancelled: 'Cancelada', refunded: 'Reembolsada', disputed: 'Incidencia abierta', under_review: 'En revisión' }[status] || status);
export const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => status === 'completed' || status === 'paid' ? 'default' : PROBLEM_STATUSES.includes(status) || ['cancelled', 'refunded'].includes(status) ? 'destructive' : status === 'shipped' ? 'outline' : 'secondary';
export const money = (amount: number | null) => Number(amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dateText = (value?: string | null) => new Date(value || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
export const safeText = (value: string, max: number) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, max);
export const getStep = (status: string) => status === 'pending' || status === 'pending_payment' ? 1 : status === 'paid' ? 2 : status === 'shipped' ? 3 : status === 'completed' ? 4 : 0;
export const getAvailableAction = (operation: Operation, type: OperationType): OperationAction | null => PROBLEM_STATUSES.includes(operation.status) ? null : type === 'sale' && operation.status === 'pending' ? 'paid' : type === 'sale' && operation.status === 'paid' ? 'shipped' : type === 'purchase' && ['paid', 'shipped'].includes(operation.status) ? 'completed' : null;
export const nextTask = (operation: Operation, type: OperationType) => operation.status === 'pending_payment' ? (type === 'purchase' ? 'Cancela este intento si falló y vuelve al producto para iniciar un pago nuevo.' : 'El comprador todavía no ha completado el pago.') : operation.status === 'pending' ? (type === 'sale' ? 'Confirma el pago cuando lo recibas.' : 'Espera la confirmación del vendedor.') : operation.status === 'paid' ? (type === 'sale' ? 'Prepara la entrega o marca el producto como enviado.' : 'El vendedor debe entregar o enviar el producto.') : operation.status === 'shipped' ? (type === 'purchase' ? 'Confirma la recepción cuando llegue.' : 'Esperando que el comprador confirme la recepción.') : operation.status === 'completed' ? (operation.reviewed ? 'Operación finalizada y valorada.' : 'Operación finalizada. Ya puedes valorar.') : PROBLEM_STATUSES.includes(operation.status) ? 'Operación bloqueada mientras se revisa la incidencia.' : operation.status === 'refunded' ? 'El importe ha sido reembolsado.' : 'No hay acciones pendientes.';
