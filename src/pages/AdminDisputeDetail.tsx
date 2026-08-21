import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, MessageCircle, Package, ShieldAlert, User, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DisputeDetail {
  id: string;
  transaction_id: string | null;
  product_id: string | null;
  buyer_id: string;
  seller_id: string;
  opened_by: string;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at?: string | null;
  closed_at: string | null;
}

interface ProductInfo {
  id: string;
  title: string;
  price: number;
  status: string | null;
  images: string[] | null;
}

interface TransactionInfo {
  id: string;
  status: string;
  amount: number;
  created_at: string;
  completed_at: string | null;
  shipping_status: string | null;
  sendcloud_parcel_id: string | null;
  sendcloud_tracking_number: string | null;
  sendcloud_tracking_url: string | null;
}

interface ProfileInfo {
  full_name: string | null;
  username: string | null;
}

interface MessageInfo {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string | null;
}

const TERMINAL_DISPUTES = ['resolved_buyer', 'resolved_seller', 'closed'];
const ALLOWED_DISPUTE_STATUSES = ['open', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed'];

const productPath = (id: string, title?: string | null) => {
  const slug = (title || 'producto')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';

  return `/producto/${id}/${slug}`;
};

const formatMoney = (value?: number | null) => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortId = (value?: string | null) => value ? `${value.slice(0, 8)}…${value.slice(-4)}` : '-';

const getDisputeStatusBadge = (status: string) => {
  switch (status) {
    case 'open':
      return <Badge className="bg-yellow-500">Abierta</Badge>;
    case 'under_review':
      return <Badge className="bg-blue-500">En revisión</Badge>;
    case 'resolved_buyer':
      return <Badge className="bg-green-500">A favor del comprador</Badge>;
    case 'resolved_seller':
      return <Badge className="bg-green-500">A favor del vendedor</Badge>;
    case 'closed':
      return <Badge variant="secondary">Cerrada</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const transactionUpdateForResolution = (nextStatus: string, now: string) => {
  if (nextStatus === 'under_review') return { status: 'under_review', completed_at: null, updated_at: now };
  if (nextStatus === 'resolved_seller') return { status: 'completed', completed_at: now, updated_at: now };
  if (nextStatus === 'resolved_buyer' || nextStatus === 'closed') return { status: 'disputed', completed_at: now, updated_at: now };
  return null;
};

const AdminDisputeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [buyer, setBuyer] = useState<ProfileInfo | null>(null);
  const [seller, setSeller] = useState<ProfileInfo | null>(null);
  const [transaction, setTransaction] = useState<TransactionInfo | null>(null);
  const [messages, setMessages] = useState<MessageInfo[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && user && !isAdmin) {
      toast.error('No tienes permisos de administrador');
      navigate('/');
    }
  }, [isAdmin, adminLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin && id) fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, id]);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);

    const { data: disputeData, error: disputeError } = await supabaseUntyped
      .from('disputes')
      .select('id, transaction_id, product_id, buyer_id, seller_id, opened_by, reason, details, status, resolution, created_at, updated_at, closed_at')
      .eq('id', id)
      .maybeSingle();

    if (disputeError || !disputeData) {
      console.error('Error fetching dispute:', disputeError);
      toast.error('No se pudo cargar la incidencia');
      setLoading(false);
      navigate('/admin');
      return;
    }

    setDispute(disputeData as DisputeDetail);

    const [productResult, buyerResult, sellerResult, transactionResult] = await Promise.all([
      disputeData.product_id
        ? supabase.from('products').select('id, title, price, status, images').eq('id', disputeData.product_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from('profiles').select('full_name, username').eq('id', disputeData.buyer_id).maybeSingle(),
      supabase.from('profiles').select('full_name, username').eq('id', disputeData.seller_id).maybeSingle(),
      disputeData.transaction_id
        ? supabase.from('transactions').select('id, status, amount, created_at, completed_at, shipping_status, sendcloud_parcel_id, sendcloud_tracking_number, sendcloud_tracking_url').eq('id', disputeData.transaction_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (productResult.error) console.error('Error fetching dispute product:', productResult.error);
    if (buyerResult.error) console.error('Error fetching dispute buyer:', buyerResult.error);
    if (sellerResult.error) console.error('Error fetching dispute seller:', sellerResult.error);
    if (transactionResult.error) console.error('Error fetching dispute transaction:', transactionResult.error);

    setProduct((productResult.data || null) as ProductInfo | null);
    setBuyer((buyerResult.data || null) as ProfileInfo | null);
    setSeller((sellerResult.data || null) as ProfileInfo | null);
    setTransaction((transactionResult.data || null) as TransactionInfo | null);

    await fetchConversationMessages(disputeData.product_id, disputeData.buyer_id, disputeData.seller_id);
    setLoading(false);
  };

  const fetchConversationMessages = async (productId: string | null, buyerId: string, sellerId: string) => {
    if (!productId) {
      setMessages([]);
      return;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('product_id', productId)
      .eq('buyer_id', buyerId)
      .eq('seller_id', sellerId)
      .maybeSingle();

    if (conversationError || !conversation?.id) {
      if (conversationError) console.error('Error fetching dispute conversation:', conversationError);
      setMessages([]);
      return;
    }

    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (messageError) {
      console.error('Error fetching messages:', messageError);
      setMessages([]);
      return;
    }

    const enrichedMessages = await Promise.all(
      (messageData || []).map(async (message) => {
        const { data: sender } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', message.sender_id)
          .maybeSingle();

        return {
          ...message,
          sender_name: sender?.full_name || sender?.username || 'Usuario',
        };
      }),
    );

    setMessages(enrichedMessages);
  };

  const resolveDispute = async (nextStatus: string) => {
    if (!dispute || !ALLOWED_DISPUTE_STATUSES.includes(nextStatus)) return;

    if (TERMINAL_DISPUTES.includes(dispute.status) && dispute.status !== nextStatus) {
      toast.error('Esta incidencia ya está cerrada. No se puede cambiar desde acción rápida.');
      return;
    }

    setUpdating(true);
    const now = new Date().toISOString();
    const resolutionMap: Record<string, string | null> = {
      open: null,
      under_review: 'En revisión por Reveta',
      resolved_buyer: 'Resuelta a favor del comprador',
      resolved_seller: 'Resuelta a favor del vendedor',
      closed: 'Cerrada por Reveta',
    };

    const { error: disputeError } = await supabaseUntyped
      .from('disputes')
      .update({
        status: nextStatus,
        resolution: resolutionMap[nextStatus] || null,
        updated_at: now,
        closed_at: TERMINAL_DISPUTES.includes(nextStatus) ? now : null,
      })
      .eq('id', dispute.id);

    if (disputeError) {
      console.error('Error updating dispute:', disputeError);
      toast.error('No se pudo actualizar la incidencia');
      setUpdating(false);
      return;
    }

    const transactionUpdate = transactionUpdateForResolution(nextStatus, now);
    if (transactionUpdate && dispute.transaction_id) {
      const { error: transactionError } = await supabaseUntyped
        .from('transactions')
        .update(transactionUpdate)
        .eq('id', dispute.transaction_id);

      if (transactionError) {
        console.error('Error updating disputed transaction:', transactionError);
        toast.warning('Incidencia actualizada, pero no se pudo sincronizar la transacción. Revísala manualmente.');
      }
    }

    toast.success('Incidencia actualizada');
    await fetchDetail();
    setUpdating(false);
  };

  if (authLoading || adminLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAdmin || !dispute) return null;

  const productImage = product?.images?.[0] || '/placeholder.svg';
  const isTerminal = TERMINAL_DISPUTES.includes(dispute.status);

  return (
    <>
      <Helmet>
        <title>Detalle de incidencia | Reveta Admin</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Detalle de incidencia</h1>
              <p className="text-muted-foreground">Centro de seguridad Reveta</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-destructive" />
                    Incidencia Reveta
                  </CardTitle>
                  <CardDescription>{format(new Date(dispute.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</CardDescription>
                </div>
                {getDisputeStatusBadge(dispute.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded-lg border bg-muted/30 p-3"><span className="text-muted-foreground">Incidencia:</span> <span className="font-medium">{shortId(dispute.id)}</span></div>
                <div className="rounded-lg border bg-muted/30 p-3"><span className="text-muted-foreground">Transacción:</span> <span className="font-medium">{shortId(dispute.transaction_id)}</span></div>
                <div className="rounded-lg border bg-muted/30 p-3"><span className="text-muted-foreground">Estado:</span> <span className="font-medium">{dispute.status}</span></div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Motivo</p>
                <p className="font-medium">{dispute.reason}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Detalles del usuario</p>
                <p className="whitespace-pre-wrap">{dispute.details || 'Sin detalles adicionales'}</p>
              </div>
              {dispute.resolution && (
                <div>
                  <p className="text-sm text-muted-foreground">Resolución</p>
                  <p className="font-medium">{dispute.resolution}</p>
                </div>
              )}

              {isTerminal && (
                <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Esta incidencia ya está cerrada. Para cambiar el criterio habría que revisar manualmente la operación y dejar trazabilidad.
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" disabled={updating || isTerminal} onClick={() => resolveDispute('under_review')}>En revisión</Button>
                <Button className="bg-green-600 hover:bg-green-700" disabled={updating || isTerminal} onClick={() => resolveDispute('resolved_buyer')}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Resolver comprador
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700" disabled={updating || isTerminal} onClick={() => resolveDispute('resolved_seller')}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Resolver vendedor
                </Button>
                <Button variant="secondary" disabled={updating || isTerminal} onClick={() => resolveDispute('closed')}>
                  <XCircle className="h-4 w-4 mr-2" /> Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Producto</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <img src={productImage} alt={product?.title || 'Producto'} className="h-40 w-full rounded-lg object-cover bg-muted" />
                <div>
                  <p className="font-medium">{product?.title || 'Producto eliminado'}</p>
                  <p className="text-sm text-muted-foreground">Estado: {product?.status || '-'}</p>
                  {product?.price !== undefined && <p className="font-bold">{formatMoney(product.price)} €</p>}
                </div>
                {product?.id && <Button variant="outline" className="w-full" onClick={() => navigate(productPath(product.id, product.title))}>Ver producto</Button>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Comprador</CardTitle></CardHeader>
              <CardContent>
                <p className="font-medium">{buyer?.full_name || buyer?.username || 'Comprador'}</p>
                <p className="text-xs text-muted-foreground">ID: {shortId(dispute.buyer_id)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Vendedor</CardTitle></CardHeader>
              <CardContent>
                <p className="font-medium">{seller?.full_name || seller?.username || 'Vendedor'}</p>
                <p className="text-xs text-muted-foreground">ID: {shortId(dispute.seller_id)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transacción y envío</CardTitle>
              <CardDescription>Información económica y logística del caso</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Estado transacción:</span> <span className="font-medium">{transaction?.status || '-'}</span></div>
              <div><span className="text-muted-foreground">Importe:</span> <span className="font-medium">{formatMoney(transaction?.amount)} €</span></div>
              <div><span className="text-muted-foreground">Estado envío:</span> <span className="font-medium">{transaction?.shipping_status || '-'}</span></div>
              <div><span className="text-muted-foreground">ID Sendcloud:</span> <span className="font-medium">{transaction?.sendcloud_parcel_id || '-'}</span></div>
              <div><span className="text-muted-foreground">Tracking:</span> <span className="font-medium">{transaction?.sendcloud_tracking_number || '-'}</span></div>
              {transaction?.sendcloud_tracking_url && (
                <div><a href={transaction.sendcloud_tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary font-medium">Ver seguimiento<ExternalLink className="h-3 w-3" /></a></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Conversación</CardTitle>
              <CardDescription>Mensajes asociados a esta compraventa. Revisa el contexto antes de resolver.</CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay mensajes asociados.</p>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <p className="font-medium text-sm">{message.sender_name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(message.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                      </div>
                      <Separator className="mb-2" />
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default AdminDisputeDetail;
