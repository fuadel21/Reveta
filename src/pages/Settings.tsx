import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  User,
  UserX,
} from 'lucide-react';

type SettingsSection = 'profile' | 'notifications' | 'privacy' | 'security';
type MessageScope = 'everyone' | 'verified' | 'none';

interface UserSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  message_notifications: boolean;
  offer_notifications: boolean;
  saved_search_notifications: boolean;
  show_online_status: boolean;
  show_last_seen: boolean;
  allow_messages_from: MessageScope;
}

type ProfileData = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  location: string | null;
  phone: string | null;
  bio: string | null;
  verified: boolean | null;
};

type ProfileForm = {
  full_name: string;
  username: string;
  location: string;
  phone: string;
  bio: string;
};

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

const EMPTY_PROFILE_FORM: ProfileForm = { full_name: '', username: '', location: '', phone: '', bio: '' };
const ALLOWED_SECTIONS = new Set<SettingsSection>(['profile', 'notifications', 'privacy', 'security']);
const ALLOWED_MESSAGE_SCOPES = new Set<MessageScope>(['everyone', 'verified', 'none']);
const DELETE_CONFIRMATION = 'ELIMINAR';
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const PHONE_REGEX = /^\+?[0-9\s-]{9,18}$/;
const MAX_BIO_LENGTH = 500;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const normalizeSettings = (data: Partial<UserSettings> | null | undefined): UserSettings => ({
  email_notifications: data?.email_notifications ?? true,
  push_notifications: data?.push_notifications ?? true,
  message_notifications: data?.message_notifications ?? true,
  offer_notifications: data?.offer_notifications ?? true,
  saved_search_notifications: data?.saved_search_notifications ?? true,
  show_online_status: data?.show_online_status ?? true,
  show_last_seen: data?.show_last_seen ?? true,
  allow_messages_from: ALLOWED_MESSAGE_SCOPES.has(data?.allow_messages_from as MessageScope)
    ? data?.allow_messages_from as MessageScope
    : 'everyone',
});

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeUsername = (value: string) => normalizeText(value).toLowerCase().replace(/^@+/, '');
const normalizePhone = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeBio = (value: string) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
const hasPublicContactText = (value: string) => /\b(whatsapp|telegram|bizum|transferencia|correo|email|gmail|hotmail|tel[eé]fono|tlf|\+34)\b/i.test(value);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { blockedUsers, loading: blockedLoading, unblockUser } = useBlockedUsers();

  const requestedSection = searchParams.get('section') as SettingsSection | null;
  const section: SettingsSection = requestedSection && ALLOWED_SECTIONS.has(requestedSection) ? requestedSection : 'profile';

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [sendingPasswordLink, setSendingPasswordLink] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [blockedProfiles, setBlockedProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  const applyPrivateProfile = (profileData: any) => {
    if (!profileData) return;
    const nextProfile = profileData as ProfileData;
    setProfile(nextProfile);
    setProfileForm({
      full_name: nextProfile.full_name || '',
      username: nextProfile.username || '',
      location: nextProfile.location || '',
      phone: nextProfile.phone || '',
      bio: nextProfile.bio || '',
    });
  };

  const loadPrivateProfile = async () => {
    const { data, error } = await (supabase as any).rpc('get_private_profile');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    applyPrivateProfile(row);
    return row;
  };

  const fetchAccountData = async () => {
    if (!user) return;
    setLoading(true);
    const [profileResult, settingsResult] = await Promise.all([
      (supabase as any).rpc('get_private_profile'),
      supabase
        .from('user_settings')
        .select('email_notifications,push_notifications,message_notifications,offer_notifications,saved_search_notifications,show_online_status,show_last_seen,allow_messages_from')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      console.error('Error fetching private profile:', profileResult.error);
      toast({ title: 'No se pudo cargar el perfil', variant: 'destructive' });
    } else {
      applyPrivateProfile(Array.isArray(profileResult.data) ? profileResult.data[0] : profileResult.data);
    }

    if (settingsResult.error) {
      console.error('Error fetching settings:', settingsResult.error);
      toast({ title: 'No se pudieron cargar las preferencias', description: 'Se muestran valores por defecto.', variant: 'destructive' });
    }
    setSettings(normalizeSettings(settingsResult.data as Partial<UserSettings> | null));
    setLoading(false);
  };

  useEffect(() => {
    if (user) void fetchAccountData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchBlockedProfiles = async () => {
    const ids = Array.from(new Set(blockedUsers.map((blocked) => blocked.blocked_user_id).filter(Boolean)));
    if (ids.length === 0) {
      setBlockedProfiles({});
      return;
    }
    const { data, error } = await supabase.from('profiles').select('id,full_name,avatar_url').in('id', ids);
    if (error) {
      console.error('Error fetching blocked profiles:', error);
      return;
    }
    const profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    (data || []).forEach((row: any) => { profiles[row.id] = { full_name: row.full_name, avatar_url: row.avatar_url }; });
    setBlockedProfiles(profiles);
  };

  useEffect(() => {
    if (!user || blockedUsers.length === 0) {
      setBlockedProfiles({});
      return;
    }
    void fetchBlockedProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, blockedUsers]);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSectionChange = (value: string) => {
    const next = ALLOWED_SECTIONS.has(value as SettingsSection) ? value as SettingsSection : 'profile';
    setSearchParams({ section: next }, { replace: true });
  };

  const handleSaveSettings = async () => {
    if (!user || savingSettings) return;
    const safeSettings = normalizeSettings(settings);
    setSavingSettings(true);
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, ...safeSettings }, { onConflict: 'user_id' });
    if (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'No se pudieron guardar los ajustes', variant: 'destructive' });
    } else {
      setSettings(safeSettings);
      toast({ title: 'Ajustes guardados', description: 'Tus preferencias se han actualizado.' });
    }
    setSavingSettings(false);
  };

  const handlePushPreferenceChange = async (subscribed: boolean) => {
    if (!user) return;
    updateSetting('push_notifications', subscribed);
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, push_notifications: subscribed } as any, { onConflict: 'user_id' });
    if (error) {
      console.error('Error syncing push preference:', error);
      toast({ title: 'Push cambiado en este dispositivo', description: 'No se pudo sincronizar la preferencia con tu cuenta.', variant: 'destructive' });
    }
  };

  const validateProfile = () => {
    const payload = {
      full_name: normalizeText(profileForm.full_name) || null,
      username: normalizeUsername(profileForm.username) || null,
      location: normalizeText(profileForm.location) || null,
      phone: normalizePhone(profileForm.phone) || null,
      bio: normalizeBio(profileForm.bio) || null,
    };
    if (payload.full_name && payload.full_name.length < 2) {
      toast({ title: 'Nombre demasiado corto', variant: 'destructive' });
      return null;
    }
    if (payload.username && !USERNAME_REGEX.test(payload.username)) {
      toast({ title: 'Usuario no válido', description: 'Usa 3-30 caracteres: letras, números, punto, guion o guion bajo.', variant: 'destructive' });
      return null;
    }
    if (payload.phone && !PHONE_REGEX.test(payload.phone)) {
      toast({ title: 'Teléfono no válido', variant: 'destructive' });
      return null;
    }
    if (payload.bio && payload.bio.length > MAX_BIO_LENGTH) {
      toast({ title: 'Biografía demasiado larga', description: `Máximo ${MAX_BIO_LENGTH} caracteres.`, variant: 'destructive' });
      return null;
    }
    if (payload.bio && hasPublicContactText(payload.bio)) {
      toast({ title: 'Evita datos de contacto públicos', description: 'El teléfono privado tiene su propio campo. No lo publiques en la biografía.', variant: 'destructive' });
      return null;
    }
    return payload;
  };

  const handleSaveProfile = async () => {
    if (!user || savingProfile) return;
    const payload = validateProfile();
    if (!payload) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) throw error;
      await loadPrivateProfile();
      toast({ title: 'Perfil actualizado' });
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'No se pudo guardar el perfil',
        description: error?.code === '23505' ? 'Ese nombre de usuario ya está en uso.' : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!user || !file || uploadingAvatar) return;
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast({ title: 'Formato no admitido', description: 'Usa JPG, PNG o WebP.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast({ title: 'Imagen demasiado grande', description: 'El avatar puede ocupar como máximo 5 MB.', variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    const objectPath = `${user.id}/avatar`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(objectPath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    });
    if (uploadError) {
      toast({ title: 'No se pudo subir el avatar', description: uploadError.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }
    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(objectPath);
    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
    const { error: profileError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
    if (profileError) {
      toast({ title: 'La imagen se subió, pero no se pudo guardar en el perfil', variant: 'destructive' });
    } else {
      setProfile((current) => current ? { ...current, avatar_url: avatarUrl } : current);
      toast({ title: 'Avatar actualizado' });
    }
    setUploadingAvatar(false);
  };

  const handleRemoveAvatar = async () => {
    if (!user || removingAvatar || !profile?.avatar_url) return;
    setRemovingAvatar(true);
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    if (error) {
      toast({ title: 'No se pudo quitar el avatar', variant: 'destructive' });
      setRemovingAvatar(false);
      return;
    }
    setProfile((current) => current ? { ...current, avatar_url: null } : current);
    const { error: storageError } = await supabase.storage.from('avatars').remove([`${user.id}/avatar`]);
    if (storageError) console.warn('Avatar object cleanup failed:', storageError);
    toast({ title: 'Avatar eliminado' });
    setRemovingAvatar(false);
  };

  const handleUnblock = async (userId: string) => {
    if (unblockingId) return;
    setUnblockingId(userId);
    const success = await unblockUser(userId);
    if (success) {
      toast({ title: 'Usuario desbloqueado', description: 'Se vuelven a permitir las interacciones según tus preferencias.' });
      setBlockedProfiles((current) => { const next = { ...current }; delete next[userId]; return next; });
    } else {
      toast({ title: 'No se pudo desbloquear', variant: 'destructive' });
    }
    setUnblockingId(null);
  };

  const handlePasswordReset = async () => {
    if (!user?.email || sendingPasswordLink) return;
    setSendingPasswordLink(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast({ title: 'No se pudo enviar el enlace', variant: 'destructive' });
    else toast({ title: 'Enlace enviado', description: 'Revisa tu email para establecer una nueva contraseña.' });
    setSendingPasswordLink(false);
  };

  const handleDeleteAccount = async () => {
    if (!user || deletingAccount || deleteConfirmation !== DELETE_CONFIRMATION) return;
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: { confirmation: DELETE_CONFIRMATION } });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      toast({ title: 'Cuenta eliminada', description: 'Hemos cerrado tu sesión y procesado la eliminación.' });
      await signOut();
      navigate('/', { replace: true });
    } catch (error: any) {
      toast({ title: 'No se pudo eliminar la cuenta', description: error?.message || 'Inténtalo de nuevo más tarde.', variant: 'destructive' });
    } finally {
      setDeletingAccount(false);
      setDeleteConfirmation('');
      setDeleteDialogOpen(false);
    }
  };

  const displayName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'Usuario';
  const accountAge = useMemo(() => user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : null, [user?.created_at]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Cuenta y ajustes | Reveta</title>
        <meta name="description" content="Gestiona tu perfil, privacidad, notificaciones y seguridad de cuenta en Reveta" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8 max-w-5xl">
          <div className="mb-6">
            <p className="text-sm font-medium text-primary">Tu cuenta</p>
            <h1 className="text-3xl font-bold">Cuenta y ajustes</h1>
            <p className="mt-2 text-muted-foreground">Un único sitio para tu identidad, avisos, privacidad y seguridad.</p>
          </div>

          <Tabs value={section} onValueChange={handleSectionChange} className="space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 md:grid-cols-4">
              <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />Perfil</TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Avisos</TabsTrigger>
              <TabsTrigger value="privacy" className="gap-2"><Lock className="h-4 w-4" />Privacidad</TabsTrigger>
              <TabsTrigger value="security" className="gap-2"><ShieldCheck className="h-4 w-4" />Seguridad</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Identidad de la cuenta</CardTitle><CardDescription>Gestiona los datos privados y públicos de tu perfil.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt={`Avatar de ${displayName}`} className="h-full w-full object-cover" /> : displayName[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div><p className="font-semibold">Foto de perfil</p><p className="text-sm text-muted-foreground">JPG, PNG o WebP. Máximo 5 MB.</p></div>
                      <div className="flex flex-wrap gap-2">
                        <Label htmlFor="avatar-file" className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                          {uploadingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}{uploadingAvatar ? 'Subiendo...' : 'Cambiar foto'}
                        </Label>
                        <Input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingAvatar} onChange={(event) => { const file = event.target.files?.[0] || null; void handleAvatarUpload(file); event.currentTarget.value = ''; }} />
                        {profile?.avatar_url && <Button variant="outline" disabled={removingAvatar} onClick={() => void handleRemoveAvatar()}>{removingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Quitar</Button>}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="full_name">Nombre completo</Label><Input id="full_name" value={profileForm.full_name} maxLength={80} onChange={(e) => setProfileForm((c) => ({ ...c, full_name: e.target.value }))} /></div>
                    <div className="space-y-2"><Label htmlFor="username">Nombre de usuario</Label><Input id="username" value={profileForm.username} maxLength={30} autoCapitalize="none" onChange={(e) => setProfileForm((c) => ({ ...c, username: e.target.value }))} /></div>
                    <div className="space-y-2"><Label htmlFor="location">Ubicación</Label><Input id="location" value={profileForm.location} maxLength={120} onChange={(e) => setProfileForm((c) => ({ ...c, location: e.target.value }))} /></div>
                    <div className="space-y-2"><Label htmlFor="phone">Teléfono privado</Label><Input id="phone" value={profileForm.phone} maxLength={18} inputMode="tel" onChange={(e) => setProfileForm((c) => ({ ...c, phone: e.target.value }))} /><p className="text-xs text-muted-foreground">No aparece en tu perfil público.</p></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="bio">Biografía pública</Label><Textarea id="bio" value={profileForm.bio} rows={4} maxLength={MAX_BIO_LENGTH} onChange={(e) => setProfileForm((c) => ({ ...c, bio: e.target.value }))} /><div className="flex justify-between text-xs text-muted-foreground"><span>No publiques datos de contacto.</span><span>{profileForm.bio.length}/{MAX_BIO_LENGTH}</span></div></div>
                  <div className="rounded-xl border bg-muted/30 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Email de acceso</p><p className="text-sm text-muted-foreground">{user.email || 'Sin email disponible'}</p></div><Badge variant={user.email_confirmed_at ? 'default' : 'secondary'}>{user.email_confirmed_at ? 'Email verificado' : 'Pendiente de verificar'}</Badge></div>
                  <div className="flex flex-wrap gap-2"><Button onClick={() => void handleSaveProfile()} disabled={savingProfile}><Save className="mr-2 h-4 w-4" />{savingProfile ? 'Guardando...' : 'Guardar perfil'}</Button><Button variant="outline" asChild><Link to="/profile"><ExternalLink className="mr-2 h-4 w-4" />Ver mi área de perfil</Link></Button></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card><CardHeader><CardTitle>Notificaciones</CardTitle><CardDescription>El navegador solo pedirá permiso cuando actives push.</CardDescription></CardHeader><CardContent className="space-y-5">
                <PushNotificationToggle onSubscriptionChange={handlePushPreferenceChange} /><Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Email</Label><p className="text-sm text-muted-foreground">Avisos relacionados con tu actividad.</p></div><Switch checked={settings.email_notifications} onCheckedChange={(v) => updateSetting('email_notifications', v)} /></div><Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Mensajes</Label><p className="text-sm text-muted-foreground">Avisar cuando recibas un mensaje.</p></div><Switch checked={settings.message_notifications} onCheckedChange={(v) => updateSetting('message_notifications', v)} /></div><Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Ofertas</Label><p className="text-sm text-muted-foreground">Avisar sobre ofertas y cambios relevantes.</p></div><Switch checked={settings.offer_notifications} onCheckedChange={(v) => updateSetting('offer_notifications', v)} /></div><Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Búsquedas guardadas</Label><p className="text-sm text-muted-foreground">Avisar cuando aparezcan coincidencias.</p></div><Switch checked={settings.saved_search_notifications} onCheckedChange={(v) => updateSetting('saved_search_notifications', v)} /></div>
                <div className="flex flex-wrap gap-2"><Button onClick={() => void handleSaveSettings()} disabled={savingSettings}><Save className="mr-2 h-4 w-4" />{savingSettings ? 'Guardando...' : 'Guardar preferencias'}</Button><Button variant="outline" asChild><Link to="/notifications"><Bell className="mr-2 h-4 w-4" />Abrir bandeja</Link></Button></div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="privacy" className="space-y-6">
              <Card><CardHeader><CardTitle>Privacidad y contacto</CardTitle><CardDescription>Decide qué presencia muestras y quién puede iniciar conversaciones contigo.</CardDescription></CardHeader><CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4"><div><Label>Mostrar estado en línea</Label><p className="text-sm text-muted-foreground">Otros usuarios podrán saber si estás conectado.</p></div><Switch checked={settings.show_online_status} onCheckedChange={(v) => updateSetting('show_online_status', v)} /></div><Separator />
                <div className="flex items-center justify-between gap-4"><div><Label>Mostrar última conexión</Label><p className="text-sm text-muted-foreground">Muestra cuándo estuviste activo por última vez.</p></div><Switch checked={settings.show_last_seen} onCheckedChange={(v) => updateSetting('show_last_seen', v)} /></div><Separator />
                <div className="grid gap-2 sm:grid-cols-[1fr_220px] sm:items-center"><div><Label>Quién puede escribirte</Label><p className="text-sm text-muted-foreground">La regla se aplica al crear conversaciones nuevas.</p></div><Select value={settings.allow_messages_from} onValueChange={(v) => updateSetting('allow_messages_from', v as MessageScope)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Todos los usuarios</SelectItem><SelectItem value="verified">Solo verificados</SelectItem><SelectItem value="none">Nadie</SelectItem></SelectContent></Select></div>
                <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Tu teléfono privado no se muestra en perfiles públicos.</span></div>
                <Button onClick={() => void handleSaveSettings()} disabled={savingSettings}><Save className="mr-2 h-4 w-4" />{savingSettings ? 'Guardando...' : 'Guardar privacidad'}</Button>
              </CardContent></Card>

              <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserX className="h-5 w-5" />Usuarios bloqueados</CardTitle><CardDescription>La lista usa el bloqueo canónico que impide interacciones.</CardDescription></CardHeader><CardContent>
                {blockedLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : blockedUsers.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No has bloqueado a ningún usuario.</p> : <div className="space-y-3">{blockedUsers.map((blocked) => { const p = blockedProfiles[blocked.blocked_user_id]; return <div key={blocked.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="flex min-w-0 items-center gap-3"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center">{p?.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : p?.full_name?.[0]?.toUpperCase() || 'U'}</div><div className="min-w-0"><p className="truncate font-medium">{p?.full_name || 'Usuario de Reveta'}</p><Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild><Link to={`/usuario/${encodeURIComponent(blocked.blocked_user_id)}`}>Ver perfil</Link></Button></div></div><Button variant="outline" size="sm" disabled={unblockingId === blocked.blocked_user_id} onClick={() => void handleUnblock(blocked.blocked_user_id)}>Desbloquear</Button></div>; })}</div>}
                <div className="mt-4"><Button variant="outline" asChild><Link to="/mi-proteccion"><ShieldCheck className="mr-2 h-4 w-4" />Abrir Centro de Protección</Link></Button></div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card><CardHeader><CardTitle>Acceso y contraseña</CardTitle><CardDescription>Protege el acceso a tu cuenta.</CardDescription></CardHeader><CardContent className="space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">{user.email || 'Email no disponible'}</p><p className="text-sm text-muted-foreground">{user.email_confirmed_at ? 'Email verificado' : 'Pendiente de verificación'}{accountAge ? ` · Cuenta desde ${accountAge}` : ''}</p></div></div>{user.email_confirmed_at && <CheckCircle2 className="h-5 w-5 text-green-600" />}</div>
                <Button variant="outline" disabled={sendingPasswordLink || !user.email} onClick={() => void handlePasswordReset()}>{sendingPasswordLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}{sendingPasswordLink ? 'Enviando...' : 'Enviar enlace para cambiar contraseña'}</Button>
              </CardContent></Card>
              <Card className="border-destructive/30 bg-destructive/5"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" />Eliminar cuenta</CardTitle><CardDescription>Esta acción es permanente.</CardDescription></CardHeader><CardContent><Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Solicitar eliminación de cuenta</Button></CardContent></Card>
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmation(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Eliminar cuenta permanentemente</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer. Para confirmar, escribe <strong>ELIMINAR</strong>.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-2"><Label htmlFor="delete-confirmation">Confirmación</Label><Input id="delete-confirmation" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value.trim().toUpperCase())} placeholder="ELIMINAR" autoComplete="off" /></div>
          <AlertDialogFooter><AlertDialogCancel disabled={deletingAccount}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deletingAccount || deleteConfirmation !== DELETE_CONFIRMATION} onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deletingAccount ? 'Eliminando...' : 'Eliminar cuenta'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Settings;
