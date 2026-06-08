import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { 
  Bell, 
  Lock, 
  Shield, 
  UserX, 
  Trash2,
  Save
} from 'lucide-react';

interface UserSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  message_notifications: boolean;
  offer_notifications: boolean;
  saved_search_notifications: boolean;
  show_online_status: boolean;
  show_last_seen: boolean;
  allow_messages_from: string;
}

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { blockedUsers, unblockUser } = useBlockedUsers();
  
  const [settings, setSettings] = useState<UserSettings>({
    email_notifications: true,
    push_notifications: true,
    message_notifications: true,
    offer_notifications: true,
    saved_search_notifications: true,
    show_online_status: true,
    show_last_seen: true,
    allow_messages_from: 'everyone'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedProfiles, setBlockedProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  useEffect(() => {
    if (blockedUsers.length > 0) {
      fetchBlockedProfiles();
    }
  }, [blockedUsers]);

  const fetchSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setSettings({
        email_notifications: data.email_notifications ?? true,
        push_notifications: data.push_notifications ?? true,
        message_notifications: data.message_notifications ?? true,
        offer_notifications: data.offer_notifications ?? true,
        saved_search_notifications: data.saved_search_notifications ?? true,
        show_online_status: data.show_online_status ?? true,
        show_last_seen: data.show_last_seen ?? true,
        allow_messages_from: data.allow_messages_from ?? 'everyone'
      });
    }

    setLoading(false);
  };

  const fetchBlockedProfiles = async () => {
    const profiles: Record<string, any> = {};
    
    for (const blocked of blockedUsers) {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', blocked.blocked_user_id)
        .maybeSingle();
      
      if (data) {
        profiles[blocked.blocked_user_id] = data;
      }
    }
    
    setBlockedProfiles(profiles);
  };

  const handleSaveSettings = async () => {
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...settings
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los ajustes',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Ajustes guardados',
        description: 'Tus preferencias se han actualizado'
      });
    }

    setSaving(false);
  };

  const handleUnblock = async (userId: string) => {
    const success = await unblockUser(userId);
    if (success) {
      toast({
        title: 'Usuario desbloqueado',
        description: 'Ahora puedes ver sus productos y mensajes'
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Ajustes | Reveta</title>
        <meta name="description" content="Configura tus preferencias de notificaciones y privacidad" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 container py-8 max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Ajustes</h1>

          <div className="space-y-6">
            {/* Notifications */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notificaciones
                </CardTitle>
                <CardDescription>
                  Configura cómo quieres recibir notificaciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificaciones por email</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe un resumen de actividad por email
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_notifications}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, email_notifications: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificaciones push</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe alertas en tiempo real
                    </p>
                  </div>
                  <PushNotificationToggle />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mensajes nuevos</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificar cuando recibas mensajes
                    </p>
                  </div>
                  <Switch
                    checked={settings.message_notifications}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, message_notifications: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ofertas recibidas</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificar cuando recibas ofertas
                    </p>
                  </div>
                  <Switch
                    checked={settings.offer_notifications}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, offer_notifications: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Búsquedas guardadas</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificar cuando haya nuevos productos
                    </p>
                  </div>
                  <Switch
                    checked={settings.saved_search_notifications}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, saved_search_notifications: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privacy */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Privacidad
                </CardTitle>
                <CardDescription>
                  Controla quién puede ver tu información
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar estado en línea</Label>
                    <p className="text-sm text-muted-foreground">
                      Otros usuarios verán si estás conectado
                    </p>
                  </div>
                  <Switch
                    checked={settings.show_online_status}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, show_online_status: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar última conexión</Label>
                    <p className="text-sm text-muted-foreground">
                      Otros verán cuándo estuviste activo
                    </p>
                  </div>
                  <Switch
                    checked={settings.show_last_seen}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, show_last_seen: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Blocked Users */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5" />
                  Usuarios bloqueados
                </CardTitle>
                <CardDescription>
                  Gestiona los usuarios que has bloqueado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {blockedUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No has bloqueado a ningún usuario
                  </p>
                ) : (
                  <div className="space-y-3">
                    {blockedUsers.map((blocked) => (
                      <div 
                        key={blocked.id} 
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                            {blockedProfiles[blocked.blocked_user_id]?.full_name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <span className="font-medium">
                            {blockedProfiles[blocked.blocked_user_id]?.full_name || 'Usuario'}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnblock(blocked.blocked_user_id)}
                        >
                          Desbloquear
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button 
              onClick={handleSaveSettings} 
              disabled={saving}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar ajustes'}
            </Button>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Settings;
