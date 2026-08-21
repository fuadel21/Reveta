import { getErrorMessage } from '@/lib/errors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, CheckCircle2, Clock3, Eye, Locate, MapPin, Save, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AIListingAssistant from '@/components/upload/AIListingAssistant';
import ListingImageManager from '@/components/listing/ListingImageManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import {
  clearListingDraft,
  CONDITION_LABELS,
  EMPTY_LISTING_FORM,
  formatListingPrice,
  getOwnedStoragePath,
  listingQualityChecks,
  listingStateSignature,
  loadListingDraft,
  MAX_LISTING_DESCRIPTION,
  resolveListingImageUrls,
  saveListingDraft,
  type ListingFormData,
  type ListingImage,
  uploadListingImages,
  validateListing,
} from '@/lib/listingEditor';

type Category = { id: string; name: string; icon?: string | null };
type Subcategory = { id: string; category_id: string; name: string; icon?: string | null };
type Mode = 'create' | 'edit';

type Props = {
  mode: Mode;
  productId?: string;
};

const OPEN_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];

export const ListingEditor = ({ mode, productId }: Props) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const geolocation = useGeolocation();
  const imagesRef = useRef<ListingImage[]>([]);
  const draftTimerRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [form, setForm] = useState<ListingFormData>(EMPTY_LISTING_FORM);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedSignature, setSavedSignature] = useState('');

  const signature = useMemo(() => listingStateSignature(form, images), [form, images]);
  const dirty = Boolean(savedSignature && signature !== savedSignature);
  const checks = useMemo(() => listingQualityChecks(form, images.length), [form, images.length]);
  const qualityScore = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
  const selectedCategory = categories.find((category) => category.id === form.category_id)?.name;

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [authLoading, navigate, user]);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => {
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    imagesRef.current.filter((image) => !image.original).forEach((image) => URL.revokeObjectURL(image.url));
  }, []);

  useEffect(() => {
    if (!user || authLoading) return;
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, productId, mode, authLoading]);

  useEffect(() => {
    if (!form.category_id) {
      setSubcategories([]);
      if (form.subcategory_id) setForm((current) => ({ ...current, subcategory_id: '' }));
      return;
    }
    void loadSubcategories(form.category_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category_id]);

  useEffect(() => {
    if (mode !== 'create' || loading || submittedRef.current) return;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      void saveListingDraft(form, images).then((savedAt) => {
        setLastSavedAt(new Date(savedAt));
        setSavedSignature(listingStateSignature(form, images));
      });
    }, 1000);
    return () => { if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current); };
  }, [form, images, loading, mode]);

  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);

  useEffect(() => {
    if (!locating || geolocation.latitude == null || geolocation.longitude == null) return;
    void reverseGeocode(geolocation.latitude, geolocation.longitude).finally(() => setLocating(false));
  }, [geolocation.latitude, geolocation.longitude, locating]);

  useEffect(() => {
    if (!locating || !geolocation.error) return;
    toast({ title: 'No se pudo obtener la ubicación', description: geolocation.error, variant: 'destructive' });
    setLocating(false);
  }, [geolocation.error, locating, toast]);

  const initialize = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: categoryRows, error: categoryError } = await supabase.from('categories').select('id,name,icon').order('name');
      if (categoryError) throw categoryError;
      setCategories(categoryRows || []);

      if (mode === 'create') {
        const draft = await loadListingDraft();
        if (draft) {
          const restoredImages = draft.files.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), original: false }));
          setForm(draft.form);
          setImages(restoredImages);
          setDraftRestored(true);
          setLastSavedAt(new Date(draft.savedAt));
          setSavedSignature(listingStateSignature(draft.form, restoredImages));
        } else {
          setSavedSignature(listingStateSignature(EMPTY_LISTING_FORM, []));
        }
      } else {
        if (!productId) throw new Error('Falta el anuncio que quieres editar');
        const { data, error } = await supabaseUntyped
          .from('products')
          .select('id,user_id,title,description,price,category_id,subcategory_id,condition,location,latitude,longitude,status,images')
          .eq('id', productId)
          .maybeSingle();
        if (error || !data) throw error || new Error('Producto no encontrado');
        if (data.user_id !== user.id) throw new Error('Solo puedes editar tus propios anuncios');
        if (['sold', 'completed'].includes(data.status)) throw new Error('Los productos vendidos no se pueden editar');
        await assertProductEditable(data.id);

        const loadedForm: ListingFormData = {
          title: data.title || '',
          description: data.description || '',
          price: String(data.price ?? ''),
          category_id: data.category_id || '',
          subcategory_id: data.subcategory_id || '',
          condition: data.condition || '',
          location: data.location || '',
          latitude: data.latitude == null ? null : Number(data.latitude),
          longitude: data.longitude == null ? null : Number(data.longitude),
        };
        const currentUrls = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 5) : [];
        const loadedImages = currentUrls.map((url: string, index: number) => ({ id: `original-${index}`, url, original: true }));
        setForm(loadedForm);
        setImages(loadedImages);
        setOriginalImageUrls(currentUrls);
        setSavedSignature(listingStateSignature(loadedForm, loadedImages));
      }
    } catch (error) {
      toast({ title: mode === 'create' ? 'No se pudo preparar el anuncio' : 'No se puede editar este anuncio', description: getErrorMessage(error, 'Inténtalo de nuevo.'), variant: 'destructive' });
      if (mode === 'edit') navigate('/seller-dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const loadSubcategories = async (categoryId: string) => {
    const { data, error } = await supabase.from('subcategories').select('id,category_id,name,icon').eq('category_id', categoryId).order('name');
    if (error) {
      setSubcategories([]);
      return;
    }
    const rows = data || [];
    setSubcategories(rows);
    setForm((current) => rows.some((row) => row.id === current.subcategory_id) ? current : { ...current, subcategory_id: '' });
  };

  const assertProductEditable = async (id: string) => {
    const [{ count: reservations }, { count: transactions }] = await Promise.all([
      supabaseUntyped.from('product_reservations').select('id', { count: 'exact', head: true }).eq('product_id', id).eq('status', 'active'),
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('product_id', id).in('status', OPEN_TRANSACTION_STATUSES),
    ]);
    if ((reservations || 0) > 0 || (transactions || 0) > 0) throw new Error('Este anuncio tiene una reserva u operación abierta y no se puede editar todavía');
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`);
      if (!response.ok) throw new Error('No se pudo consultar la ubicación');
      const data = await response.json();
      const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.suburb || data?.address?.state;
      setForm((current) => ({ ...current, location: city || current.location, latitude, longitude }));
      toast({ title: 'Ubicación detectada', description: city ? `Tu anuncio aparecerá cerca de ${city}.` : 'Se han guardado las coordenadas.' });
    } catch {
      setForm((current) => ({ ...current, latitude, longitude }));
      toast({ title: 'Coordenadas guardadas', description: 'Escribe también la ciudad para que el anuncio sea fácil de encontrar.' });
    }
  };

  const geocodeTypedLocation = async () => {
    if (form.latitude != null && form.longitude != null) return { latitude: form.latitude, longitude: form.longitude, displayName: form.location };
    try {
      const { data, error } = await supabase.functions.invoke('geocode-location', { body: { location: form.location.trim() } });
      if (error || data?.latitude == null || data?.longitude == null) return null;
      return { latitude: Number(data.latitude), longitude: Number(data.longitude), displayName: data.displayName || form.location.trim() };
    } catch {
      return null;
    }
  };

  const requestCurrentLocation = () => {
    setLocating(true);
    geolocation.requestLocation();
  };

  const clearDraft = async () => {
    await clearListingDraft();
    images.filter((image) => !image.original).forEach((image) => URL.revokeObjectURL(image.url));
    setForm(EMPTY_LISTING_FORM);
    setImages([]);
    setDraftRestored(false);
    setLastSavedAt(null);
    setSavedSignature(listingStateSignature(EMPTY_LISTING_FORM, []));
    toast({ title: 'Borrador eliminado' });
  };

  const leaveEditor = () => {
    if (dirty && !window.confirm('Hay cambios que todavía no se han guardado. ¿Quieres salir?')) return;
    navigate(mode === 'edit' ? '/seller-dashboard' : '/');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || saving) return;
    const validation = validateListing(form, images.length);
    if (!validation.value) {
      toast({ title: 'Revisa el anuncio', description: validation.error, variant: 'destructive' });
      return;
    }

    setSaving(true);
    let uploadedPaths: string[] = [];
    try {
      if (mode === 'edit' && productId) await assertProductEditable(productId);
      const uploaded = await uploadListingImages(user.id, images);
      uploadedPaths = uploaded.uploadedPaths;
      const finalUrls = resolveListingImageUrls(images, uploaded.urlsById);
      if (finalUrls.length !== images.length) throw new Error('No se pudieron preparar todas las fotografías');
      const location = await geocodeTypedLocation();
      const payload = {
        title: validation.value.title,
        description: validation.value.description,
        price: validation.value.price,
        category_id: form.category_id,
        subcategory_id: form.subcategory_id || null,
        condition: form.condition,
        location: location?.displayName || validation.value.location,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        images: finalUrls,
      };

      let savedId = productId || '';
      if (mode === 'create') {
        const { data, error } = await supabaseUntyped.from('products').insert({ ...payload, user_id: user.id, status: 'active' }).select('id').single();
        if (error || !data?.id) throw error || new Error('El producto se guardó, pero no se pudo abrir su ficha');
        savedId = data.id;
        submittedRef.current = true;
        await clearListingDraft();
      } else {
        const { data, error } = await supabaseUntyped.from('products').update(payload).eq('id', productId).eq('user_id', user.id).select('id').maybeSingle();
        if (error || !data?.id) throw error || new Error('El anuncio cambió mientras lo editabas. Actualiza e inténtalo de nuevo.');
        const keptOriginals = new Set(images.filter((image) => image.original).map((image) => image.url));
        const removedPaths = originalImageUrls
          .filter((url) => !keptOriginals.has(url))
          .map((url) => getOwnedStoragePath(url, user.id))
          .filter((path): path is string => Boolean(path));
        if (removedPaths.length > 0) {
          const { error: cleanupError } = await supabase.storage.from('products').remove(removedPaths);
          if (cleanupError) toast({ title: 'Anuncio guardado', description: 'Algunas fotos antiguas no se pudieron retirar del almacenamiento.' });
        }
      }

      setSavedSignature(signature);
      toast({ title: mode === 'create' ? 'Producto publicado' : 'Anuncio actualizado', description: 'Abriendo la ficha del producto.' });
      navigate(`/product/${savedId}`, { replace: true });
    } catch (error) {
      if (uploadedPaths.length > 0) await supabase.storage.from('products').remove(uploadedPaths);
      toast({ title: mode === 'create' ? 'No se pudo publicar' : 'No se pudo guardar', description: getErrorMessage(error, 'Inténtalo de nuevo.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>;
  if (!user) return null;

  return (
    <>
      <Helmet><title>{mode === 'create' ? 'Publicar anuncio' : 'Editar anuncio'} | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Button type="button" variant="ghost" className="mb-3 -ml-3" onClick={leaveEditor}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
              <h1 className="text-3xl font-bold">{mode === 'create' ? 'Publicar un producto' : 'Editar anuncio'}</h1>
              <p className="text-muted-foreground">{mode === 'create' ? 'Añade fotos reales y completa los datos para empezar a recibir compradores.' : 'Actualiza información, categoría, ubicación y fotografías desde el mismo editor.'}</p>
            </div>
            {mode === 'create' && lastSavedAt && <Badge variant="secondary" className="w-fit"><Clock3 className="mr-1 h-3.5 w-3.5" />Borrador guardado {lastSavedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</Badge>}
          </div>

          {draftRestored && <div className="mb-5 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Hemos recuperado tu borrador</p><p className="text-sm text-muted-foreground">También se han restaurado las fotografías guardadas en este dispositivo.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void clearDraft()}><Trash2 className="mr-2 h-4 w-4" />Eliminar borrador</Button></div>}

          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Fotos y detalles</CardTitle><CardDescription>La misma validación se aplica al publicar y al editar.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <ListingImageManager images={images} onChange={setImages} disabled={saving} />

                  {mode === 'create' && <AIListingAssistant images={images.flatMap((image) => image.file ? [image.file] : [])} categories={categories} subcategories={subcategories} formData={form} onApply={(next) => setForm((current) => ({ ...current, ...next }))} />}

                  <div className="space-y-2"><Label htmlFor="listing-title">Título</Label><Input id="listing-title" value={form.title} maxLength={100} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. Bicicleta urbana en muy buen estado" /><p className="text-right text-xs text-muted-foreground">{form.title.length}/100</p></div>
                  <div className="space-y-2"><Label htmlFor="listing-description">Descripción</Label><Textarea id="listing-description" value={form.description} maxLength={MAX_LISTING_DESCRIPTION} rows={7} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Marca, modelo, antigüedad, medidas, accesorios y posibles defectos..." /><p className="text-right text-xs text-muted-foreground">{form.description.length}/{MAX_LISTING_DESCRIPTION}</p></div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="listing-price">Precio</Label><Input id="listing-price" type="number" min="0.5" max="50000" step="0.01" inputMode="decimal" value={form.price} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="0,00" /></div>
                    <div className="space-y-2"><Label>Estado</Label><Select value={form.condition} disabled={saving} onValueChange={(condition) => setForm((current) => ({ ...current, condition }))}><SelectTrigger><SelectValue placeholder="Selecciona el estado" /></SelectTrigger><SelectContent>{Object.entries(CONDITION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Categoría</Label><Select value={form.category_id} disabled={saving} onValueChange={(category_id) => setForm((current) => ({ ...current, category_id, subcategory_id: '' }))}><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Subcategoría</Label><Select value={form.subcategory_id || 'none'} disabled={saving || !form.category_id} onValueChange={(value) => setForm((current) => ({ ...current, subcategory_id: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent><SelectItem value="none">Sin subcategoría</SelectItem>{subcategories.map((subcategory) => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.icon ? `${subcategory.icon} ` : ''}{subcategory.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>

                  <div className="space-y-2"><Label htmlFor="listing-location">Ubicación</Label><div className="flex gap-2"><div className="relative flex-1"><MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="listing-location" value={form.location} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value, latitude: null, longitude: null }))} placeholder="Ciudad o localidad" className="pl-9" /></div><Button type="button" variant="outline" disabled={saving || locating || !geolocation.isSupported} onClick={requestCurrentLocation}><Locate className={`mr-2 h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />{locating ? 'Buscando' : 'Usar actual'}</Button></div>{form.latitude != null && form.longitude != null && <p className="text-xs text-muted-foreground">Coordenadas guardadas para las búsquedas cercanas.</p>}</div>
                </CardContent>
              </Card>

              <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={saving}><Save className="mr-2 h-5 w-5" />{saving ? 'Guardando...' : mode === 'create' ? 'Publicar anuncio' : 'Guardar cambios'}</Button>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Calidad del anuncio</CardTitle><CardDescription>Completa estos puntos para ganar visibilidad.</CardDescription></CardHeader>
                <CardContent className="space-y-4"><div><div className="mb-2 flex justify-between text-sm"><span>Preparación</span><strong>{qualityScore}%</strong></div><Progress value={qualityScore} /></div><div className="space-y-2">{checks.map((check) => <div key={check.label} className="flex items-center gap-2 text-sm"><CheckCircle2 className={`h-4 w-4 ${check.ok ? 'text-green-600' : 'text-muted-foreground/40'}`} /><span className={check.ok ? '' : 'text-muted-foreground'}>{check.label}</span></div>)}</div></CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />Vista previa</CardTitle></CardHeader>
                <CardContent className="space-y-3"><div className="aspect-video overflow-hidden rounded-xl bg-muted">{images[0]?.url ? <img src={images[0].url} alt="Vista previa" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Añade una foto principal</div>}</div><div><p className="line-clamp-2 font-semibold">{form.title.trim() || 'Título del producto'}</p><p className="mt-1 text-xl font-bold text-primary">{formatListingPrice(form.price)}</p><p className="mt-1 text-sm text-muted-foreground">{selectedCategory || 'Categoría'} · {CONDITION_LABELS[form.condition] || 'Estado'}</p><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{form.location.trim() || 'Ubicación'}</p></div></CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5"><CardContent className="pt-6"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /><div className="text-sm"><p className="font-semibold">Publicación segura</p><p className="text-muted-foreground">No incluyas teléfonos, correos ni formas de pago. Coordina todo mediante el chat de Reveta.</p></div></div></CardContent></Card>
            </aside>
          </form>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default ListingEditor;
