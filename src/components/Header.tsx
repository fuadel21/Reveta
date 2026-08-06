import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, User, Heart, MessageCircle, Search, Shield, ShieldAlert, ShieldCheck, Settings, BookMarked, Receipt, MapPin, BarChart3, ShoppingBag, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import NotificationCenter from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

  const fetchUnreadMessages = async () => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }

    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    if (conversationsError) {
      console.error('Error fetching conversations for unread badge:', conversationsError);
      return;
    }

    const conversationIds = (conversations || []).map((conversation) => conversation.id);
    if (conversationIds.length === 0) {
      setUnreadMessages(0);
      return;
    }

    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .neq('sender_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error fetching unread messages:', error);
      return;
    }

    setUnreadMessages(count || 0);
  };

  useEffect(() => {
    fetchUnreadMessages();

    if (!user) return;

    const channel = supabase
      .channel(`header-unread-messages-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnreadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const MessagesIcon = ({ compact = false }: { compact?: boolean }) => (
    <span className="relative inline-flex">
      <MessageCircle className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      {unreadMessages > 0 && (
        <span className="absolute -right-2 -top-2 min-w-4 h-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground text-center">
          {unreadMessages > 9 ? '9+' : unreadMessages}
        </span>
      )}
    </span>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0 group" aria-label="Ir al inicio de Reveta">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background shadow-md transition-transform duration-300 group-hover:scale-105">
            <img src="/favicon.svg" alt="Reveta" className="h-full w-full object-cover" />
          </div>
          <span className="text-xl font-bold text-primary hidden sm:block transition-colors group-hover:text-primary/80">Reveta</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Navegación principal">
          <Button variant="ghost" className="rounded-full px-4 text-muted-foreground hover:text-primary" asChild>
            <Link to="/segunda-mano"><MapPin className="mr-2 h-4 w-4" />Segunda mano</Link>
          </Button>
        </nav>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Busca lo que quieras..." className="w-full h-11 pl-11 pr-4 rounded-full border-2 border-border bg-background focus:border-primary/50 transition-all duration-300 hover:border-primary/30" />
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all" onClick={() => navigate('/search')}><Search className="h-5 w-5" /></Button>

          {user ? (
            <>
              {isAdmin && <Button variant="ghost" size="icon" className="hidden sm:flex text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 transition-all" asChild><Link to="/admin"><Shield className="h-5 w-5" /></Link></Button>}
              <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" asChild><Link to="/comprador" aria-label="Centro del comprador"><ShoppingBag className="h-5 w-5" /></Link></Button>
              <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" asChild><Link to="/profile?tab=favorites"><Heart className="h-5 w-5" /></Link></Button>
              <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" asChild><Link to="/messages" aria-label={unreadMessages > 0 ? `${unreadMessages} mensajes sin leer` : 'Mensajes'}><MessagesIcon /></Link></Button>
              <NotificationCenter />

              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"><User className="h-5 w-5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild><Link to="/segunda-mano" className="flex items-center gap-2"><MapPin className="h-4 w-4" />Segunda mano</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/comprador" className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Centro del comprador</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/profile" className="flex items-center gap-2"><User className="h-4 w-4" />Mi Perfil</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/seller-dashboard" className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />Panel del vendedor</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/transactions" className="flex items-center gap-2"><Receipt className="h-4 w-4" />Transacciones</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/notifications" className="flex items-center gap-2"><Bell className="h-4 w-4" />Notificaciones</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/messages" className="flex items-center gap-2"><MessagesIcon compact />Mensajes{unreadMessages > 0 && <span className="ml-auto text-xs font-bold text-destructive">{unreadMessages > 9 ? '9+' : unreadMessages}</span>}</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/saved-searches" className="flex items-center gap-2"><BookMarked className="h-4 w-4" />Búsquedas guardadas</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/mi-proteccion" className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Mi protección</Link></DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild><Link to="/admin" className="flex items-center gap-2"><Shield className="h-4 w-4" />Centro de control</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link to="/admin/safety" className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Seguridad y reportes</Link></DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/settings" className="flex items-center gap-2"><Settings className="h-4 w-4" />Ajustes</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button className="h-10 px-4 sm:px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5" asChild><Link to="/upload"><Plus className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Vender</span></Link></Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="hidden sm:inline-flex h-10 px-4 rounded-full border-2 border-border text-foreground hover:bg-muted hover:border-primary/30 font-medium transition-all duration-300" asChild><Link to="/segunda-mano">Segunda mano</Link></Button>
              <Button variant="outline" className="h-10 px-4 sm:px-6 rounded-full border-2 border-border text-foreground hover:bg-muted hover:border-primary/30 font-medium transition-all duration-300" asChild><Link to="/auth"><span className="hidden sm:inline">Regístrate o inicia sesión</span><span className="sm:hidden">Entrar</span></Link></Button>
              <Button className="h-10 px-4 sm:px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5" asChild><Link to="/upload"><Plus className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Vender</span></Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
