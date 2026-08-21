import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type ConversationRow = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string | null;
};

type ProductRow = {
  id: string;
  title: string;
  images: string[] | null;
  status: string | null;
  price: number | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean | null;
};

type ReviewData = {
  conversation: ConversationRow;
  product: ProductRow | null;
  profiles: Map<string, ProfileRow>;
  messages: MessageRow[];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_URL_PATTERN = /^https?:\/\/\S+\.(?:jpg|jpeg|png|webp)(?:\?.*)?$/i;
const MESSAGE_LIMIT = 300;

const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  : 'Sin fecha';

const displayName = (profile?: ProfileRow | null) => profile?.full_name || profile?.username || 'Usuario de Reveta';

const AdminConversationReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!adminLoading && user && !isAdmin) {
      toast.error('No tienes permisos para revisar conversaciones');
      navigate('/');
    }
  }, [adminLoading, isAdmin, navigate, user]);

  const loadConversation = async (manual = false) => {
    if (!isAdmin || !id) return;
    if (!UUID_PATTERN.test(id)) {
      setErrorMessage('El identificador de conversación no es válido.');
      setLoading(false);
      return;
    }

    if (manual) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const { data: conversation, error: conversationError } = await supabaseUntyped
        .from('conversations')
        .select('id,product_id,buyer_id,seller_id,updated_at')
        .eq('id', id)
        .maybeSingle();

      if (conversationError) throw conversationError;
      if (!conversation) throw new Error('La conversación no existe o no está disponible para moderación.');

      const related = await Promise.allSettled([
        supabase.from('products').select('id,title,images,status,price').eq('id', conversation.product_id).maybeSingle(),
        supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', [conversation.buyer_id, conversation.seller_id]),
        supabaseUntyped
          .from('messages')
          .select('id,conversation_id,sender_id,content,created_at,read')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(MESSAGE_LIMIT),
      ]);

      const productResult = related[0];
      const profilesResult = related[1];
      const messagesResult = related[2];
      const product = productResult.status === 'fulfilled' && !productResult.value.error
        ? (productResult.value.data as ProductRow | null)
        : null;
      const profiles = profilesResult.status === 'fulfilled' && !profilesResult.value.error
        ? (profilesResult.value.data || []) as ProfileRow[]
        : [];
      const messages = messagesResult.status === 'fulfilled' && !messagesResult.value.error
        ? ((messagesResult.value.data || []) as MessageRow[]).reverse()
        : [];

      setData({
        conversation: conversation as ConversationRow,
        product,
        profiles: new Map(profiles.map((profile) => [profile.id, profile])),
        messages,
      });

      if (manual) toast.success('Conversación actualizada');
      if (related.some((result) => result.status === 'rejected' || (result.status === 'fulfilled' && Boolean(result.value.error)))) {
        toast.warning('Parte del contexto no pudo cargarse');
      }
    } catch (error) {
      console.error('Error loading moderation conversation:', error);
      setData(null);
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar la conversación.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin && id) void loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdmin]);

  const buyer = data?.profiles.get(data.conversation.buyer_id) || null;
  const seller = data?.profiles.get(data.conversation.seller_id) || null;
  const participantNames = useMemo(() => ({
    buyer: displayName(buyer),
    seller: displayName(seller),
  }), [buyer, seller]);

  if (authLoading || adminLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <>
      <Helmet><title>Revisión de conversación | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <main className="min-h-screen bg-background">
        <div className="container max-w-5xl py-8 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin/safety')}><ArrowLeft className="h-5 w-5" /></Button>
              <div><Badge variant="secondary" className="mb-2"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Solo lectura</Badge><h1 className="text-3xl font-bold">Contexto de conversación</h1><p className="text-muted-foreground">Vista administrativa para revisar pruebas sin participar en el chat.</p></div>
            </div>
            <Button variant="outline" disabled={refreshing} onClick={() => void loadConversation(true)}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Actualizar</Button>
          </div>

          {errorMessage ? (
            <Card className="border-destructive/40"><CardContent className="flex gap-3 py-8 text-destructive"><AlertTriangle className="h-5 w-5 shrink-0" /><div><p className="font-semibold">No se pudo abrir la conversación</p><p className="mt-1 text-sm">{errorMessage}</p><Button className="mt-4" variant="outline" onClick={() => navigate('/admin/safety')}>Volver a moderación</Button></div></CardContent></Card>
          ) : data ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" />Producto</CardTitle></CardHeader><CardContent>{data.product ? <div className="space-y-2"><p className="font-semibold">{data.product.title}</p><p className="text-sm text-muted-foreground">{Number(data.product.price || 0).toLocaleString('es-ES')} € · {data.product.status || 'Sin estado'}</p><Button size="sm" variant="outline" asChild><Link to={`/product/${data.product.id}`}><ExternalLink className="mr-1 h-4 w-4" />Abrir producto</Link></Button></div> : <p className="text-sm text-muted-foreground">Producto eliminado o no disponible.</p>}</CardContent></Card>
                <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" />Comprador</CardTitle></CardHeader><CardContent><p className="font-semibold">{participantNames.buyer}</p><Button className="mt-3" size="sm" variant="outline" asChild><Link to={`/usuario/${encodeURIComponent(data.conversation.buyer_id)}`}>Ver perfil</Link></Button></CardContent></Card>
                <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" />Vendedor</CardTitle></CardHeader><CardContent><p className="font-semibold">{participantNames.seller}</p><Button className="mt-3" size="sm" variant="outline" asChild><Link to={`/usuario/${encodeURIComponent(data.conversation.seller_id)}`}>Ver perfil</Link></Button></CardContent></Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />Historial reciente</CardTitle><CardDescription>Hasta {MESSAGE_LIMIT} mensajes, ordenados del más antiguo al más reciente. Esta vista no marca mensajes como leídos y no permite enviar contenido.</CardDescription></CardHeader>
                <CardContent>
                  {data.messages.length === 0 ? <div className="py-12 text-center text-muted-foreground">No hay mensajes visibles en esta conversación.</div> : <div className="space-y-3">{data.messages.map((message) => {
                    const sender = data.profiles.get(message.sender_id);
                    const senderName = displayName(sender);
                    const isBuyer = message.sender_id === data.conversation.buyer_id;
                    const isImage = IMAGE_URL_PATTERN.test(message.content.trim());
                    return (
                      <div key={message.id} className={`rounded-xl border p-4 ${isBuyer ? 'bg-muted/30' : 'bg-primary/5 border-primary/20'}`}>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant={isBuyer ? 'secondary' : 'outline'}>{isBuyer ? 'Comprador' : 'Vendedor'}</Badge><span className="text-sm font-medium">{senderName}</span></div><span className="text-xs text-muted-foreground">{formatDate(message.created_at)}</span></div>
                        {isImage ? <a href={message.content.trim()} target="_blank" rel="noreferrer" className="block max-w-md"><img src={message.content.trim()} alt="Imagen compartida en la conversación" className="max-h-80 rounded-lg border object-contain" loading="lazy" /><span className="mt-2 inline-flex items-center text-xs text-primary"><ImageIcon className="mr-1 h-3.5 w-3.5" />Abrir imagen original</span></a> : <p className="whitespace-pre-wrap break-words text-sm">{message.content || 'Mensaje vacío'}</p>}
                      </div>
                    );
                  })}</div>}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
};

export default AdminConversationReview;
