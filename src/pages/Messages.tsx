import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Chat } from '@/components/Chat';
import MessagingCommandCenter from '@/components/chat/MessagingCommandCenter';
import { MessageCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { loadMessagingInbox, type MessagingConversation } from '@/lib/messaging';
import { toast } from 'sonner';

const Messages = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const refreshTimer = useRef<number | null>(null);
  const inboxIdsRef = useRef<Set<string>>(new Set());
  const [inbox, setInbox] = useState<MessagingConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    inboxIdsRef.current = new Set(inbox.map((conversation) => conversation.id));
  }, [inbox]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const loadInbox = useCallback(async (manual = false) => {
    if (!user) return;
    manual ? setRefreshing(true) : setLoading(true);
    setError(false);

    try {
      const result = await loadMessagingInbox(user.id, 100);
      setInbox(result.conversations);
      if (result.partial) toast.warning('El buzón se cargó parcialmente. Puedes actualizarlo de nuevo.');
      else if (manual) toast.success('Mensajes actualizados');
    } catch (loadError) {
      console.error('Error loading messaging inbox:', loadError);
      setError(true);
      toast.error('No se pudo cargar el buzón de mensajes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void loadInbox();
  }, [loadInbox, user]);

  useEffect(() => {
    if (!user) return;

    const scheduleRefresh = () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void loadInbox(), 500);
    };

    const messageRefresh = (payload: any) => {
      const conversationId = payload.new?.conversation_id || payload.old?.conversation_id;
      if (!conversationId || inboxIdsRef.current.has(conversationId)) scheduleRefresh();
    };

    const channels = [
      supabase.channel(`messages-conversations-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${user.id}` }, scheduleRefresh).subscribe(),
      supabase.channel(`messages-conversations-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${user.id}` }, scheduleRefresh).subscribe(),
      supabase.channel(`messages-offers-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `buyer_id=eq.${user.id}` }, scheduleRefresh).subscribe(),
      supabase.channel(`messages-offers-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `seller_id=eq.${user.id}` }, scheduleRefresh).subscribe(),
      supabase.channel(`messages-transactions-buyer-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `buyer_id=eq.${user.id}` }, scheduleRefresh).subscribe(),
      supabase.channel(`messages-transactions-seller-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `seller_id=eq.${user.id}` }, scheduleRefresh).subscribe(),
      supabase.channel(`messages-inbox-events-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, messageRefresh).subscribe(),
    ];

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
  }, [loadInbox, user]);

  const selectedConversationId = searchParams.get('conversation');
  const handleConversationChange = useCallback((conversationId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (conversationId) params.set('conversation', conversationId);
    else params.delete('conversation');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Mensajes y negociaciones | Reveta</title>
        <meta name="description" content="Gestiona conversaciones, ofertas y operaciones privadas con compradores y vendedores en Reveta" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <MessageCircle className="h-3.5 w-3.5" />
                Mensajería y negociación
              </div>
              <h1 className="text-2xl font-bold">Mensajes</h1>
              <p className="text-sm text-muted-foreground">Controla conversaciones, ofertas pendientes y operaciones asociadas a cada producto.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Usa el chat de Reveta y evita compartir datos sensibles innecesarios.
            </div>
          </div>

          <MessagingCommandCenter
            items={inbox}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={() => void loadInbox(true)}
          />

          <section className="h-[calc(100vh-14rem)] min-h-[620px]">
            <Chat
              inbox={inbox}
              inboxLoading={loading}
              conversationId={selectedConversationId}
              onConversationChange={handleConversationChange}
              onInboxRefresh={() => void loadInbox()}
            />
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Messages;
