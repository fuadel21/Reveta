import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Chat } from '@/components/Chat';
import MessagingCommandCenter from '@/components/chat/MessagingCommandCenter';
import { MessageCircle, ShieldCheck } from 'lucide-react';

const Messages = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

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

          <MessagingCommandCenter />

          <section className="h-[calc(100vh-14rem)] min-h-[620px]">
            <Chat />
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Messages;
