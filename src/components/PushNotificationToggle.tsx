import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface PushNotificationToggleProps {
  variant?: 'switch' | 'button';
  className?: string;
}

const PushNotificationToggle = ({ 
  variant = 'switch',
  className 
}: PushNotificationToggleProps) => {
  const { 
    isSupported, 
    isSubscribed, 
    isLoading, 
    permission,
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  if (!isSupported) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        <BellOff className="h-4 w-4 inline mr-2" />
        Tu navegador no soporta notificaciones push
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className={cn("text-sm text-destructive", className)}>
        <BellOff className="h-4 w-4 inline mr-2" />
        Notificaciones bloqueadas en el navegador
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        variant={isSubscribed ? "secondary" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : isSubscribed ? (
          <BellOff className="h-4 w-4 mr-2" />
        ) : (
          <Bell className="h-4 w-4 mr-2" />
        )}
        {isSubscribed ? 'Desactivar push' : 'Activar push'}
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="h-5 w-5 text-primary" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <Label htmlFor="push-toggle" className="font-medium cursor-pointer">
            Notificaciones push
          </Label>
          <p className="text-sm text-muted-foreground">
            {isSubscribed 
              ? 'Recibirás alertas aunque no estés en la app' 
              : 'Activa para recibir alertas en tiempo real'}
          </p>
        </div>
      </div>
      
      <Switch
        id="push-toggle"
        checked={isSubscribed}
        onCheckedChange={handleToggle}
        disabled={isLoading}
      />
    </div>
  );
};

export default PushNotificationToggle;
