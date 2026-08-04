import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  Loader2,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type NotificationGroup = 'all' | 'unread' | 'messages' | 'offers' | 'operations' | 'alerts';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read: boolean | null;
  created_at: string;
};

const PAGE_SIZE = 25;

const typeGroup = (type: string): Exclude<NotificationGroup, 'all' | 'unread'> => {
  const normalized = type.toLowerCase();
  if (normalized === 'new_message' || normalized.includes('message')) return 'messages';
  if (normalized.includes('offer')) return 'offers';
  if (
    normalized.includes('reservation') ||
    normalized.includes('transaction') ||
    normalized.includes('purchase') ||
    normalized.includes('sale') ||
    normalized.includes('delivery') ||
    normalized.includes('payment') ||
    normalized.includes('shipping')
  ) return 'operations';
  return 'alerts';
};

const isPriority = (notification: NotificationRow) => {
  const type = notification.type.toLowerCase();
  return !notification.read && (
    type.includes('expiry') ||
    type.includes('urgent') ||
    type.includes('dispute') ||
    type.includes('report') ||
    type.includes('accepted') ||
    type.includes('reservation') ||
    type.includes('payment_failed')
  );
};

const resolveDestination = (notification: NotificationRow) => {
  const data = notification.data || {};
  if (typeof data.url === 'string' && data.url.startsWith('/')) return data.url;
  if (data.transaction_id || typeGroup(notification.type) === 'operations') return '/transactions';
  if (data.conversation_id || typeGroup(notification.type) === 'messages' || typeGroup(notification.type) === 'offers') return '/messages';
  if (notification.type.includes('saved_search') || notification.type.includes('new_product')) return '/saved-searches';
  if (data.product_id) return `/product/${data.product_id}`;
  if (notification.type.includes('report') || notification.type.includes('security')) return '/settings';
  return null;
};

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<NotificationGroup>('all');
  const [page, setPage] = useState(1);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user?.id) void fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-page:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        void fetchNotifications(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchNotifications = async (silent = false) => {
    if (!user) return;
    silent ? setRefreshing(true) : setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id,user_id,type,title,message,data,read,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: 'No se pudieron cargar las notificaciones', description: error.message, variant: 'destructive' });
    } else {
      setNotifications((data || []) as NotificationRow[]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return notifications.filter((notification) => {
      const matchesGroup = group === 'all'
        ? true
        : group === 'unread'
          ? !notification.read
          : typeGroup(notification.type) === group;
      const matchesQuery = !normalized || `${notification.title} ${notification.message}`.toLowerCase().includes(normalized);
      return matchesGroup && matchesQuery;
    });
  }, [group, notifications, query]);

  useEffect(() => { setPage(1); }, [group, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = useMemo(() => ({
    unread: notifications.filter((notification) => !notification.read).length,
    priority: notifications.filter(isPriority).length,
    messages: notifications.filter((notification) => typeGroup(notification.type) === 'messages').length,
    offers: notifications.filter((notification) => typeGroup(notification.type) === 'offers').length,
    operations: notifications.filter((notification) => typeGroup(notification.type) === 'operations').length,
  }), [notifications]);

  const updateLocalRead = (ids: string[]) => {
    const idSet = new Set(ids);
    setNotifications((current) => current.map((notification) => idSet.has(notification.id) ? { ...notification, read: true } : notification));
  };

  const markAsRead = async (notification: NotificationRow) => {
    if (!user || notification.read) return;
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notification.id).eq('user_id', user.id);
    if (error) toast({ title: 'No se pudo marcar como leída', variant: 'destructive' });
    else updateLocalRead([notification.id]);
  };

  const markVisibleAsRead = async () => {
    if (!user || working) return;
    const ids = visible.filter((notification) => !notification.read).map((notification) => notification.id);
    if (ids.length === 0) return;
    setWorking(true);
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).in('id', ids);
    if (error) toast({ title: 'No se pudieron marcar las notificaciones', variant: 'destructive' });
    else {
      updateLocalRead(ids);
      toast({ title: `${ids.length} notificaciones marcadas como leídas` });
    }
    setWorking(false);
  };

  const markAllAsRead = async () => {
    if (!user || working || counts.unread === 0) return;
    setWorking(true);
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    if (error) toast({ title: 'No se pudieron marcar todas como leídas', variant: 'destructive' });
    else {
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
      toast({ title: 'Todas las notificaciones están al día' });
    }
    setWorking(false);
  };

  const deleteNotification = async (notification: NotificationRow) => {
    if (!user) return;
    const { error } = await supabase.from('notifications').delete().eq('id', notification.id).eq('user_id', user.id);
    if (error) toast({ title: 'No se pudo eliminar la notificación', variant: 'destructive' });
    else setNotifications((current) => current.filter((item) => item.id !== notification.id));
  };

  const clearRead = async () => {
    if (!user || working) return;
    setWorking(true);
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id).eq('read', true);
    if (error) toast({ title: 'No se pudieron eliminar las notificaciones leídas', variant: 'destructive' });
    else {
      setNotifications((current) => current.filter((notification) => !notification.read));
      setClearDialogOpen(false);
      toast({ title: 'Historial leído eliminado' });
    }
    setWorking(false);
  };

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission === 'granted') toast({ title: 'Avisos del navegador activados' });
    else if (permission === 'denied') toast({ title: 'Permiso bloqueado', description: 'Puedes cambiarlo desde los ajustes del navegador.' });
  };

  const openNotification = async (notification: NotificationRow) => {
    await markAsRead(notification);
    const destination = resolveDestination(notification);
    if (destination) navigate(destination);
  };

  const iconFor = (notification: NotificationRow) => {
    const notificationGroup = typeGroup(notification.type);
    if (isPriority(notification)) return <AlertTriangle className="h-5 w-5 text-destructive" />;
    if (notificationGroup === 'messages') return <MessageCircle className="h-5 w-5 text-primary" />;
    if (notificationGroup === 'offers') return <DollarSign className="h-5 w-5 text-green-600" />;
    if (notificationGroup === 'operations') return <PackageCheck className="h-5 w-5 text-blue-600" />;
    if (notification.type.includes('security') || notification.type.includes('report')) return <ShieldAlert className="h-5 w-5 text-orange-600" />;
    if (notification.type.includes('saved_search') || notification.type.includes('new_product')) return <Search className="h-5 w-5 text-violet-600" />;
    return <Bell className="h-5 w-5 text-muted-foreground" />;
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <Helmet><title>Notificaciones | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><Badge variant="secondary" className="mb-3"><BellRing className="mr-1 h-4 w-4" />Centro de actividad</Badge><h1 className="text-3xl font-bold">Todas tus notificaciones</h1><p className="mt-2 text-muted-foreground">Mensajes, ofertas, operaciones y alertas reunidos en una bandeja completa.</p></div>
            <div className="flex flex-wrap gap-2">
              {browserPermission === 'default' && <Button variant="outline" onClick={requestBrowserPermission}><BellRing className="mr-2 h-4 w-4" />Activar avisos</Button>}
              <Button variant="outline" onClick={() => fetchNotifications(true)} disabled={refreshing}><RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />Actualizar</Button>
              <Button onClick={markAllAsRead} disabled={working || counts.unread === 0}><CheckCheck className="mr-2 h-4 w-4" />Marcar todas</Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{counts.unread}</CardTitle><CardDescription>Nuevas</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{counts.priority}</CardTitle><CardDescription>Prioridad</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{counts.messages}</CardTitle><CardDescription>Mensajes</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{counts.offers}</CardTitle><CardDescription>Ofertas</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{counts.operations}</CardTitle><CardDescription>Operaciones</CardDescription></CardHeader></Card>
          </div>

          <Card>
            <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div><CardTitle>Bandeja</CardTitle><CardDescription>{filtered.length} notificaciones coinciden con los filtros.</CardDescription></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-[240px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en notificaciones" className="pl-9" /></div>
                <Select value={group} onValueChange={(value) => setGroup(value as NotificationGroup)}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="unread">Solo nuevas</SelectItem><SelectItem value="messages">Mensajes</SelectItem><SelectItem value="offers">Ofertas</SelectItem><SelectItem value="operations">Operaciones</SelectItem><SelectItem value="alerts">Alertas</SelectItem></SelectContent></Select>
                <Button variant="outline" onClick={markVisibleAsRead} disabled={working || visible.every((notification) => notification.read)}><Check className="mr-2 h-4 w-4" />Leer página</Button>
                <Button variant="outline" className="text-destructive" onClick={() => setClearDialogOpen(true)} disabled={working || notifications.every((notification) => !notification.read)}><Trash2 className="mr-2 h-4 w-4" />Limpiar leídas</Button>
              </div>
            </CardHeader>
            <CardContent>
              {visible.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground"><Bell className="mx-auto mb-3 h-10 w-10 opacity-30" /><p className="font-medium">No hay notificaciones que mostrar</p><p className="mt-1 text-sm">Prueba con otro filtro o vuelve más tarde.</p></div>
              ) : (
                <div className="divide-y rounded-xl border">
                  {visible.map((notification) => (
                    <div key={notification.id} className={cn('group flex gap-3 p-4 transition-colors hover:bg-muted/40', !notification.read && 'bg-primary/5', isPriority(notification) && 'border-l-4 border-l-destructive')}>
                      <button type="button" onClick={() => openNotification(notification)} className="flex min-w-0 flex-1 gap-3 text-left">
                        <span className="mt-0.5 shrink-0">{iconFor(notification)}</span>
                        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className={cn('text-sm', !notification.read && 'font-semibold')}>{notification.title}</span>{isPriority(notification) && <Badge variant="destructive">Prioridad</Badge>}{!notification.read && <Badge variant="secondary">Nueva</Badge>}</span><span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span><span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}</span></span>
                      </button>
                      <div className="flex shrink-0 items-start gap-1">
                        {!notification.read && <Button variant="ghost" size="icon" onClick={() => markAsRead(notification)} aria-label="Marcar como leída"><Check className="h-4 w-4" /></Button>}
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteNotification(notification)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pageCount > 1 && <div className="mt-5 flex items-center justify-between"><p className="text-sm text-muted-foreground">Página {currentPage} de {pageCount}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button><Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Siguiente<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>}
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar notificaciones leídas</AlertDialogTitle><AlertDialogDescription>Se eliminarán del historial todas las notificaciones que ya hayas leído. Las pendientes se conservarán.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={clearRead} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar leídas</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Notifications;
