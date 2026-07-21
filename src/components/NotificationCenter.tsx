import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, Bell, Check, CheckCheck, Clock3, DollarSign, MessageCircle, PackageCheck, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { notifyWithFeedback } from '@/lib/notification-sounds';
import { toast } from 'sonner';

interface NotificationData {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read: boolean | null;
  created_at: string;
}

type NotificationGroup = 'all' | 'unread' | 'messages' | 'offers' | 'operations' | 'alerts';

const typeGroup = (type: string): Exclude<NotificationGroup, 'all' | 'unread'> => {
  if (type === 'new_message' || type.includes('message')) return 'messages';
  if (type.includes('offer')) return 'offers';
  if (type.includes('reservation') || type.includes('transaction') || type.includes('purchase') || type.includes('sale') || type.includes('delivery')) return 'operations';
  return 'alerts';
};

const isPriority = (notification: NotificationData) => {
  const type = notification.type.toLowerCase();
  return !notification.read && (
    type.includes('expiry') ||
    type.includes('urgent') ||
    type.includes('dispute') ||
    type.includes('report') ||
    type.includes('accepted') ||
    type.includes('reservation')
  );
};

const NotificationCenter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<NotificationGroup>('all');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        const newNotification = payload.new as NotificationData;
        setNotifications((current) => [newNotification, ...current].slice(0, 100));
        setUnreadCount((current) => current + 1);
        const soundType = newNotification.type === 'new_message' ? 'message' : newNotification.type.includes('offer') ? 'offer' : 'default';
        notifyWithFeedback(soundType);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newNotification.title, { body: newNotification.message, icon: '/favicon.ico' });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }
    const rows = (data || []) as NotificationData[];
    setNotifications(rows);
    setUnreadCount(rows.filter((notification) => !notification.read).length);
  };

  const filteredNotifications = useMemo(() => {
    const filtered = notifications.filter((notification) => {
      if (activeGroup === 'all') return true;
      if (activeGroup === 'unread') return !notification.read;
      return typeGroup(notification.type) === activeGroup;
    });

    return [...filtered].sort((a, b) => {
      const priorityDifference = Number(isPriority(b)) - Number(isPriority(a));
      if (priorityDifference !== 0) return priorityDifference;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [notifications, activeGroup]);

  const groupCounts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter((notification) => !notification.read).length,
    messages: notifications.filter((notification) => typeGroup(notification.type) === 'messages').length,
    offers: notifications.filter((notification) => typeGroup(notification.type) === 'offers').length,
    operations: notifications.filter((notification) => typeGroup(notification.type) === 'operations').length,
    alerts: notifications.filter((notification) => typeGroup(notification.type) === 'alerts').length,
  }), [notifications]);

  const markAsRead = async (notificationId: string) => {
    const target = notifications.find((notification) => notification.id === notificationId);
    if (!target || target.read) return;
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId).eq('user_id', user?.id);
    if (error) return;
    setNotifications((current) => current.map((notification) => notification.id === notificationId ? { ...notification, read: true } : notification));
    setUnreadCount((current) => Math.max(0, current - 1));
  };

  const markVisibleAsRead = async () => {
    if (!user || working) return;
    const ids = filteredNotifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (ids.length === 0) return;
    setWorking(true);
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).in('id', ids);
    if (error) toast.error('No se pudieron marcar las notificaciones');
    else {
      const idSet = new Set(ids);
      setNotifications((current) => current.map((notification) => idSet.has(notification.id) ? { ...notification, read: true } : notification));
      setUnreadCount((current) => Math.max(0, current - ids.length));
      toast.success(ids.length === 1 ? 'Notificación marcada como leída' : `${ids.length} notificaciones marcadas como leídas`);
    }
    setWorking(false);
  };

  const deleteNotification = async (notificationId: string) => {
    const target = notifications.find((notification) => notification.id === notificationId);
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId).eq('user_id', user?.id);
    if (error) return;
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    if (target && !target.read) setUnreadCount((current) => Math.max(0, current - 1));
  };

  const clearReadNotifications = async () => {
    if (!user || working) return;
    const readIds = notifications.filter((notification) => notification.read).map((notification) => notification.id);
    if (readIds.length === 0) {
      toast.info('No hay notificaciones leídas para limpiar');
      return;
    }
    setWorking(true);
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id).in('id', readIds);
    if (error) toast.error('No se pudieron limpiar las notificaciones');
    else {
      setNotifications((current) => current.filter((notification) => !notification.read));
      toast.success(`${readIds.length} notificaciones eliminadas`);
    }
    setWorking(false);
  };

  const resolveDestination = (notification: NotificationData) => {
    const data = notification.data || {};
    if (data.url && typeof data.url === 'string' && data.url.startsWith('/')) return data.url;
    if (data.product_id) return `/product/${data.product_id}`;
    if (data.transaction_id || typeGroup(notification.type) === 'operations') return '/transactions';
    if (data.conversation_id || typeGroup(notification.type) === 'messages' || typeGroup(notification.type) === 'offers') return '/messages';
    if (notification.type.includes('saved_search') || notification.type.includes('new_product')) return '/saved-searches';
    if (notification.type.includes('report') || notification.type.includes('security')) return '/settings';
    return null;
  };

  const handleNotificationClick = async (notification: NotificationData) => {
    await markAsRead(notification.id);
    setOpen(false);
    const destination = resolveDestination(notification);
    if (destination) navigate(destination);
  };

  const getNotificationIcon = (notification: NotificationData) => {
    const group = typeGroup(notification.type);
    if (isPriority(notification)) return <AlertTriangle className="h-5 w-5 text-destructive" />;
    if (group === 'messages') return <MessageCircle className="h-5 w-5 text-primary" />;
    if (group === 'offers') return <DollarSign className="h-5 w-5 text-green-500" />;
    if (group === 'operations') return <PackageCheck className="h-5 w-5 text-blue-500" />;
    if (notification.type.includes('saved_search')) return <Search className="h-5 w-5 text-violet-500" />;
    if (notification.type.includes('security') || notification.type.includes('report')) return <ShieldAlert className="h-5 w-5 text-orange-500" />;
    return <Bell className="h-5 w-5 text-muted-foreground" />;
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group" aria-label={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : 'Notificaciones'}>
          <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-destructive px-1 text-destructive-foreground text-xs flex items-center justify-center animate-notification-pop">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(94vw,430px)] p-0" align="end">
        <div className="border-b p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-semibold">Centro de notificaciones</h3><p className="text-xs text-muted-foreground">{unreadCount > 0 ? `${unreadCount} pendientes de revisar` : 'Todo al día'}</p></div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={working || groupCounts.unread === 0} onClick={markVisibleAsRead}><CheckCheck className="h-4 w-4 mr-1" />Leídas</Button>
              <Button variant="ghost" size="icon" disabled={working} onClick={clearReadNotifications} aria-label="Eliminar notificaciones leídas"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <Tabs value={activeGroup} onValueChange={(value) => setActiveGroup(value as NotificationGroup)}>
            <TabsList className="grid h-auto grid-cols-3 gap-1 bg-muted/60 p-1 sm:grid-cols-6">
              {(['all', 'unread', 'messages', 'offers', 'operations', 'alerts'] as NotificationGroup[]).map((group) => (
                <TabsTrigger key={group} value={group} className="px-2 py-1.5 text-xs">
                  {group === 'all' ? 'Todas' : group === 'unread' ? 'Nuevas' : group === 'messages' ? 'Chats' : group === 'offers' ? 'Ofertas' : group === 'operations' ? 'Operaciones' : 'Avisos'}
                  {groupCounts[group] > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{groupCounts[group]}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="max-h-[480px]">
          {filteredNotifications.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground"><Bell className="h-9 w-9 mx-auto mb-3 opacity-40" /><p className="text-sm font-medium">No hay notificaciones en esta categoría</p><p className="mt-1 text-xs">Cuando haya novedades aparecerán aquí.</p></div>
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => (
                <div key={notification.id} className={cn('group flex cursor-pointer gap-3 p-4 transition-colors hover:bg-muted/50', !notification.read && 'bg-primary/5', isPriority(notification) && 'border-l-4 border-l-destructive')} onClick={() => handleNotificationClick(notification)}>
                  <div className="shrink-0 mt-0.5">{getNotificationIcon(notification)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2"><p className={cn('text-sm leading-snug', !notification.read && 'font-semibold')}>{notification.title}</p>{isPriority(notification) && <Badge variant="destructive" className="shrink-0 text-[10px]">Prioridad</Badge>}</div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                    {!notification.read && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); markAsRead(notification.id); }} aria-label="Marcar como leída"><Check className="h-3.5 w-3.5" /></Button>}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(event) => { event.stopPropagation(); deleteNotification(notification.id); }} aria-label="Eliminar notificación"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
