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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import PushNotificationToggle from '@/components/PushNotificationToggle';
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
import { AlertTriangle, Bell, Lock, UserX, Save, ShieldCheck, Trash2 } from 'lucide-react';

interface UserSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  message_notifications: boolean;
  offer_notifications: boolean;
  saved_search_notifications: boolean;
  show_online_status: boolean;
  show_last_seen: boolean;
  allow_messages_from: 'everyone' | 'verified' | 'none';
}

const DEFAULT_SETTINGS: UserSettings = {
  email_notifications: true,
  push_notifications: true,
  message_notifications: true,
  offer_notifications: true,
  saved_search_notifications: true,
  show_online_status: true,
  show_last_seen: true,
  allow_messages_from: 'everyone',
};

const allowedMessageScopes = new Set(['everyone', 'verified', 'none']);
const DELETE_CONFIRMATION = 'ELIMINAR';
const normalizeSettings = (data: Partial<UserSettings> | null | undefined): UserSettings => ({
  email_notifications: data?.email_notifications ?? DEFAULT_SETTINGS.email_notifications,
  push_notifications: data?.push_notifications ?? DEFAULT_SETTINGS.push_notifications,
  message_notifications: data?.message_notifications ?? DEFAULT_SETTINGS.message_notifications,
  offer_notifications: data?.offer_notifications ?? DEFAULT_SETTINGS.offer_notifications,
  saved_search_notifications: data?.saved_search_notifications ?? DEFAULT_SETTINGS.saved_search_notifications,
  show_online_status: data?.show_online_status ?? DEFAULT_SETTINGS.show_online_status,
  show_last_seen: data?.show_last_seen ?? DEFAULT_SETTINGS.show_last_seen,
  allow_messages_from: allowedMessageScopes.has(String(data?.allow_messages_from)) ? data?.allow_messages_from as UserSettings['allow_messages_from'] : DEFAULT_SETTINGS.allow_messages_from,
});

const getFunctionErrorMessage = async (error: any) => {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const payload = await error.context.json();
      return payload?.error || payload?.message || error.message;
    }
  } catch {
    // Ignore parser errors.
  }
  return error?.message || 'No se pudo completar la operación.';
};

const Settings = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { blockedUsers, unblockUser } = useBlockedUsers();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [blockedProfiles, setBlockedProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (blockedUsers.length > 0) fetchBlockedProfiles();
    else setBlockedProfiles({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedUsers.length]);

  const fetchSettings = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('user_settings')
      .select('email_notifications, push_notifications, message_notifications, offer_notifications, saved_search_notifications, show_online_status, show_last_seen, allow_messages_from')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      toast({ title: 'No se pudieron cargar los ajustes', description: 'Usaremos los valores por defecto.', variant: 'destructive' });
    }

    setSettings(normalizeSettings(data as Partial<UserSettings> | null));
    setLoading(false);
  };

  const fetchBlockedProfiles = async () => {
    const profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    await Promise.all(blockedUsers.map(async (blocked) => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', blocked.blocked_user_id)
        .maybeSingle();
      if (data) profiles[blocked.blocked_user_id] = data;
    }));
    setBlockedProfiles(profiles);
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSaveSettings = async () => {
    if (!user || saving) return;
    const safeSettings = normalizeSettings(settings);
    setSaving(true);

    const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, ...safeSettings });

    if (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Error', description: 'No se pudieron guardar los ajustes', variant: 'destructive' });
    } else {
      setSettings(safeSettings);
      toast({ title: 'Ajustes guardados', description: 'Tus preferencias se han actualizado' });
    }

    setSaving(false);
  };

  const handleUnblock = async (userId: string) => {
    setUnblockingId(userId);
    const success = await unblockUser(userId);
    if (success) {
      toast({ title: 'Usuario desbloqueado', description: 'Ahora puedes ver sus productos y mensajes' });
      setBlockedProfiles((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
    }
    setUnblockingId(null);
  };

  const handleDeleteAccount = async () => {
    if (!user || deletingAccount || deleteConfirmation !== DELETE_CONFIRMATION) return;
    setDeletingAccount(true);

    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: { confirmation: DELETE_CONFIRMATION } });
      if (error) {
        const message = await getFunctionErrorMessage(error);
        throw new Error(message);
      }

      toast({ title: 'Cuenta eliminada', description: 'Hemos cerrado tu sesión y eliminado tu cuenta.' });
      await signOut();
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({ title: 'No se pudo eliminar la cuenta', description: error?.message || 'Inténtalo de nuevo más tarde.', variant: 'destructive' });
    } finally {
      setDeletingAccount(false);
      setDeleteConfirmation('');
      setDeleteDialogOpen(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Ajustes | Reveta</title>
        <meta name="description" content="Configura tus preferencias privadas de notificaciones y privacidad en Reveta" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 max-w-2xl">
          <h1 className="text-2xl font-bold mb-2">Ajustes</h1>
          <p className="text-sm text-muted-foreground mb-6">Controla notificaciones, privacidad, usuarios bloqueados y seguridad de tu cuenta.</p>

          <div className="space-y-6">
            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notificaciones</CardTitle><CardDescription>Configura cómo quieres recibir notificaciones</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4"><div><Label>Notificaciones por email</Label><p className="text-sm text-muted-foreground">Recibe un resumen de actividad por email</p></div><Switch checked={settings.email_notifications} onCheckedChange={(checked) => updateSetting('email_notifications', checked)} /></div>
                <Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Notificaciones push</Label><p className="text-sm text-muted-foreground">Recibe alertas en tiempo real</p></div><PushNotificationToggle /></div>
                <Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Mensajes nuevos</Label><p className="text-sm text-muted-foreground">Notificar cuando recibas mensajes</p></div><Switch checked={settings.message_notifications} onCheckedChange={(checked) => updateSetting('message_notifications', checked)} /></div>
                <Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Ofertas recibidas</Label><p className="text-sm text-muted-foreground">Notificar cuando recibas ofertas</p></div><Switch checked={settings.offer_notifications} onCheckedChange={(checked) => updateSetting('offer_notifications', checked)} /></div>
                <Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Búsquedas guardadas</Label><p className="text-sm text-muted-foreground">Notificar cuando haya nuevos productos</p></div><Switch checked={settings.saved_search_notifications} onCheckedChange={(checked) => updateSetting('saved_search_notifications', checked)} /></div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Privacidad</CardTitle><CardDescription>Controla quién puede ver tu información</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4"><div><Label>Mostrar estado en línea</Label><p className="text-sm text-muted-foreground">Otros usuarios verán si estás conectado</p></div><Switch checked={settings.show_online_status} onCheckedChange={(checked) => updateSetting('show_online_status', checked)} /></div>
                <Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Mostrar última conexión</Label><p className="text-sm text-muted-foreground">Otros verán cuándo estuviste activo</p></div><Switch checked={settings.show_last_seen} onCheckedChange={(checked) => updateSetting('show_last_seen', checked)} /></div>
                <Separator />
                <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground flex gap-2"><ShieldCheck className="h-4 w-4 text-primary mt-0.5" /><span>Tu teléfono privado no se muestra en perfiles públicos. Usa el chat de Reveta para negociar de forma segura.</span></div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader><CardTitle className="flex items-center gap-2"><UserX className="h-5 w-5" />Usuarios bloqueados</CardTitle><CardDescription>Gestiona los usuarios que has bloqueado</CardDescription></CardHeader>
              <CardContent>
                {blockedUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No has bloqueado a ningún usuario</p>
                ) : (
                  <div className="space-y-3">
                    {blockedUsers.map((blocked) => {
                      const profile = blockedProfiles[blocked.blocked_user_id];
                      return (
                        <div key={blocked.id} className="flex items-center justify-between gap-3 p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile?.full_name?.[0]?.toUpperCase() || 'U'}</div>
                            <span className="font-medium truncate">{profile?.full_name || 'Usuario'}</span>
                          </div>
                          <Button variant="outline" size="sm" disabled={unblockingId === blocked.blocked_user_id} onClick={() => handleUnblock(blocked.blocked_user_id)}>Desbloquear</Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" />Eliminar cuenta</CardTitle>
                <CardDescription>Esta acción es permanente y puede eliminar o anonimizar tus datos según la política de Reveta.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="w-full" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Solicitar eliminación de cuenta
                </Button>
              </CardContent>
            </Card>

            <Button onClick={handleSaveSettings} disabled={saving} className="w-full"><Save className="h-4 w-4 mr-2" />{saving ? 'Guardando...' : 'Guardar ajustes'}</Button>
          </div>
        </main>
        <Footer />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmation(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Eliminar cuenta permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se cerrará tu sesión y se procesará la eliminación de tu cuenta. Para confirmar, escribe <strong>ELIMINAR</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">Confirmación</Label>
            <Input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.trim().toUpperCase())} placeholder="ELIMINAR" autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={deletingAccount || deleteConfirmation !== DELETE_CONFIRMATION} onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingAccount ? 'Eliminando...' : 'Eliminar cuenta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Settings;
