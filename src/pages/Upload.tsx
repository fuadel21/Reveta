import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AIListingAssistant from '@/components/upload/AIListingAssistant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ArrowDown, ArrowUp, Camera, CheckCircle2, Clock3, Euro, Eye, Images, Lightbulb, Locate, MapPin, Navigation, Save, ShieldCheck, Sparkles, Upload as UploadIcon, X } from 'lucide-react';

interface Category { id: string; name: string; icon?: string | null; }
interface Subcategory { id: string; category_id: string; name: string; icon?: string | null; }
interface GeocodedLocation { latitude: number; longitude: number; displayName?: string; }
interface UploadedImageResult { urls: string[]; paths: string[]; }

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_PRICE = 0.5;
const MAX_PRICE = 50000;
const MIN_TITLE_LENGTH = 8;
const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 2000;
const DRAFT_KEY = 'reveta:listing-draft:v1';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const conditionLabels: Record<string, string> = { new: 'Nuevo', like_new: 'Como nuevo', good: 'Buen estado', fair: 'Aceptable', poor: 'Necesita reparación' };
const emptyForm = { title: '', description: '', price: '', category_id: '', subcategory_id: '', condition: '', location: '', latitude: null as number | null, longitude: null as number | null };
const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeMultiline = (value: string) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
const parsePrice = (value: string | number) => Number.parseFloat(String(value).replace(',', '.'));
const formatPrice = (value: string | number) => {
  const parsed = parsePrice(value);
  return Number.isFinite(parsed) ? `${parsed.toLocaleString('es-ES')} €` : '0 €';
};
const isValidImageFile = (file: File) => ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_SIZE_BYTES;
const hasSuspiciousContactText = (value: string) => /\b(whatsapp|telegram|bizum|transferencia|correo|email|gmail|hotmail|tel[eé]fono|tlf|\+34)\b/i.test(value);

const Upload = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const geolocation = useGeolocation();
  const imageUrlsRef = useRef<string[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (formData.category_id) fetchSubcategories(formData.category_id); else setSubcategories([]); }, [formData.category_id]);
  useEffect(() => { if (useCurrentLocation && geolocation.latitude && geolocation.longitude) reverseGeocode(geolocation.latitude, geolocation.longitude); }, [useCurrentLocation, geolocation.latitude, geolocation.longitude]);
  useEffect(() => { imageUrlsRef.current = imageUrls; }, [imageUrls]);
  useEffect(() => () => { imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed?.formData) {
        setFormData({ ...emptyForm, ...parsed.formData, latitude: null, longitude: null });
        setDraftRestored(true);
        if (parsed.savedAt) setLastSavedAt(new Date(parsed.savedAt));
      }
    } catch (error) { console.warn('No se pudo restaurar el borrador:', error); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hasContent = Object.values(formData).some((value) => value !== '' && value !== null);
      if (!hasContent) return;
      const savedAt = new Date();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData: { ...formData, latitude: null, longitude: null }, savedAt: savedAt.toISOString() }));
      setLastSavedAt(savedAt);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [formData]);

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('id, name, icon').order('name');
    if (error) { toast({ title: 'No se pudieron cargar las categorías', description: 'Puedes intentarlo de nuevo en unos segundos.', variant: 'destructive' }); return; }
    setCategories(data || []);
  };

  const fetchSubcategories = async (categoryId: string) => {
    const { data, error } = await supabase.from('subcategories').select('id, category_id, name, icon').eq('category_id', categoryId).order('name');
    if (error) { setSubcategories([]); return; }
    setSubcategories(data || []);
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
      const data = await response.json();
      const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.suburb || data?.address?.state;
      if (city) { setFormData(prev => ({ ...prev, location: city, latitude: lat, longitude: lon })); toast({ title: 'Ubicación detectada', description: `Tu anuncio aparecerá cerca de ${city}.` }); }
    } catch (error) { console.error('Error detecting location:', error); }
  };

  const geocodeTypedLocation = async (): Promise<GeocodedLocation | null> => {
    const typedLocation = normalizeText(formData.location);
    if (useCurrentLocation && geolocation.latitude && geolocation.longitude) return { latitude: geolocation.latitude, longitude: geolocation.longitude, displayName: typedLocation || undefined };
    if (!typedLocation) return null;
    try {
      const { data, error } = await supabase.functions.invoke('geocode-location', { body: { location: typedLocation } });
      if (error || !data?.latitude || !data?.longitude) return null;
      return { latitude: Number(data.latitude), longitude: Number(data.longitude), displayName: data.displayName || typedLocation };
    } catch { return null; }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    const remainingSlots = Math.max(0, MAX_IMAGES - images.length);
    if (remainingSlots === 0) {
      toast({ title: 'Límite de imágenes', description: `Ya has añadido las ${MAX_IMAGES} fotos permitidas.`, variant: 'destructive' });
      return;
    }
    const validFiles = selectedFiles.filter(isValidImageFile);
    const acceptedFiles = validFiles.slice(0, remainingSlots);
    const invalidCount = selectedFiles.length - validFiles.length;
    const ignoredForLimit = Math.max(0, validFiles.length - acceptedFiles.length);
    if (invalidCount > 0) toast({ title: 'Algunas imágenes no se añadieron', description: 'Solo se permiten JPG, PNG o WEBP de hasta 5 MB.', variant: 'destructive' });
    if (ignoredForLimit > 0) toast({ title: 'Se alcanzó el límite de fotos', description: `Se añadieron ${acceptedFiles.length} y se ignoraron ${ignoredForLimit} porque el máximo es ${MAX_IMAGES}.` });
    if (acceptedFiles.length === 0) return;
    setImages(prev => [...prev, ...acceptedFiles]);
    setImageUrls(prev => [...prev, ...acceptedFiles.map(file => URL.createObjectURL(file))]);
  };

  const removeImage = (index: number) => {
    if (uploading) return;
    if (imageUrls[index]) URL.revokeObjectURL(imageUrls[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };
  const moveImage = (index: number, direction: -1 | 1) => {
    if (uploading) return;
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setImages(prev => { const next = [...prev]; [next[index], next[target]] = [next[target], next[index]]; return next; });
    setImageUrls(prev => { const next = [...prev]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  };

  const uploadImages = async (): Promise<UploadedImageResult> => {
    if (!user || images.length === 0) return { urls: [], paths: [] };
    const urls: string[] = [];
    const paths: string[] = [];
    try {
      for (const image of images) {
        const fileExt = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
        const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
        const { error } = await supabase.storage.from('products').upload(fileName, image, { contentType: image.type, upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
        urls.push(publicUrl);
        paths.push(fileName);
      }
      return { urls, paths };
    } catch (error) {
      if (paths.length > 0) {
        const { error: cleanupError } = await supabase.storage.from('products').remove(paths);
        if (cleanupError) console.error('No se pudieron limpiar las imágenes parciales:', cleanupError);
      }
      throw error;
    }
  };

  const cleanupUploadedImages = async (paths: string[]) => { if (paths.length === 0) return; await supabase.storage.from('products').remove(paths); };
  const checks = useMemo(() => {
    const price = parsePrice(formData.price);
    return [
      { label: 'Al menos una foto', ok: images.length > 0 },
      { label: `Título de ${MIN_TITLE_LENGTH}+ caracteres`, ok: normalizeText(formData.title).length >= MIN_TITLE_LENGTH },
      { label: `Descripción de ${MIN_DESCRIPTION_LENGTH}+ caracteres`, ok: normalizeMultiline(formData.description).length >= MIN_DESCRIPTION_LENGTH },
      { label: 'Precio válido', ok: Number.isFinite(price) && price >= MIN_PRICE && price <= MAX_PRICE },
      { label: 'Categoría elegida', ok: !!formData.category_id },
      { label: 'Estado indicado', ok: !!formData.condition },
      { label: 'Ubicación añadida', ok: normalizeText(formData.location).length >= 2 },
    ];
  }, [formData, images.length]);
  const qualityScore = Math.round((checks.filter(check => check.ok).length / checks.length) * 100);
  const selectedCategory = categories.find(category => category.id === formData.category_id)?.name;

  const validateForm = () => {
    const title = normalizeText(formData.title); const description = normalizeMultiline(formData.description); const location = normalizeText(formData.location); const priceNum = parsePrice(formData.price);
    if (images.length === 0) { toast({ title: 'Añade al menos una foto', variant: 'destructive' }); return null; }
    if (title.length < MIN_TITLE_LENGTH) { toast({ title: 'Título demasiado corto', variant: 'destructive' }); return null; }
    if (description.length < MIN_DESCRIPTION_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) { toast({ title: 'Revisa la descripción', description: `Debe tener entre ${MIN_DESCRIPTION_LENGTH} y ${MAX_DESCRIPTION_LENGTH} caracteres.`, variant: 'destructive' }); return null; }
    if (!Number.isFinite(priceNum) || priceNum < MIN_PRICE || priceNum > MAX_PRICE) { toast({ title: 'Precio inválido', variant: 'destructive' }); return null; }
    if (!formData.category_id || !formData.condition || location.length < 2) { toast({ title: 'Faltan datos importantes', description: 'Completa categoría, estado y ubicación.', variant: 'destructive' }); return null; }
    if (hasSuspiciousContactText(`${title} ${description}`)) { toast({ title: 'Evita datos de contacto en el anuncio', description: 'Usa el chat de Reveta.', variant: 'destructive' }); return null; }
    return { title, description, location, priceNum };
  };

  const clearDraft = () => { localStorage.removeItem(DRAFT_KEY); setLastSavedAt(null); setDraftRestored(false); toast({ title: 'Borrador eliminado' }); };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!user || uploading) { if (!user) navigate('/auth'); return; }
    const validated = validateForm(); if (!validated) return;
    setUploading(true); let uploadedPaths: string[] = [];
    try {
      const uploadedImages = await uploadImages(); uploadedPaths = uploadedImages.paths; const geocodedLocation = await geocodeTypedLocation();
      const { data: createdProduct, error } = await supabase.from('products').insert({ user_id: user.id, title: validated.title, description: validated.description, price: validated.priceNum, category_id: formData.category_id || null, subcategory_id: formData.subcategory_id || null, condition: formData.condition || null, location: geocodedLocation?.displayName || validated.location, latitude: geocodedLocation?.latitude ?? null, longitude: geocodedLocation?.longitude ?? null, images: uploadedImages.urls, status: 'active' }).select('id').single();
      if (error) throw error;
      if (!createdProduct?.id) throw new Error('El producto se guardó, pero no se pudo abrir su ficha');
      localStorage.removeItem(DRAFT_KEY);
      toast({ title: 'Producto publicado', description: 'Abriendo la ficha de tu anuncio.' });
      navigate(`/product/${createdProduct.id}`, { replace: true });
    } catch (error: any) { await cleanupUploadedImages(uploadedPaths); toast({ title: 'No se pudo publicar', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return <>
    <Helmet><title>Publicar producto | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
    <div className="min-h-screen flex flex-col bg-background"><Header /><main className="flex-1 container py-8">
      <div className="mx-auto mb-6 max-w-6xl rounded-2xl border bg-card p-4 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h1 className="text-2xl font-bold">Publicación profesional</h1></div><p className="text-sm text-muted-foreground">Sube fotos, deja que Groq prepare el anuncio y revisa todo antes de publicar.</p></div><div className="min-w-[220px]"><div className="mb-2 flex justify-between text-sm"><span>Calidad del anuncio</span><strong>{qualityScore}%</strong></div><Progress value={qualityScore} /></div></div>{(lastSavedAt || draftRestored) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Borrador guardado automáticamente{lastSavedAt ? ` a las ${lastSavedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}.</span><Button type="button" variant="ghost" size="sm" onClick={clearDraft} disabled={uploading}>Eliminar borrador</Button></div>}</div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]"><Card className="border-border/50"><CardHeader><CardTitle className="flex items-center gap-2"><UploadIcon className="h-5 w-5" />Crear anuncio</CardTitle><CardDescription>La primera foto será la principal. Puedes cambiar el orden antes de publicar.</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmit} className="space-y-7">
        <section className="space-y-4"><Label className="text-base font-semibold">1. Fotografías *</Label><div className="grid grid-cols-2 gap-4 sm:grid-cols-5">{imageUrls.map((url, index) => <div key={url} className="relative aspect-square overflow-hidden rounded-xl border bg-muted"><img src={url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <Badge className="absolute left-1 top-1">Principal</Badge>}<button type="button" disabled={uploading} onClick={() => removeImage(index)} className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-white disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" /></button><div className="absolute bottom-1 left-1 right-1 flex justify-between"><button type="button" disabled={uploading || index === 0} onClick={() => moveImage(index, -1)} className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"><ArrowUp className="h-4 w-4 -rotate-90" /></button><button type="button" disabled={uploading || index === imageUrls.length - 1} onClick={() => moveImage(index, 1)} className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"><ArrowDown className="h-4 w-4 -rotate-90" /></button></div></div>)}</div>{images.length < MAX_IMAGES && <div className="grid gap-3 sm:grid-cols-2"><Button type="button" variant="outline" className="h-14 justify-center gap-2 text-base" disabled={uploading} onClick={() => cameraInputRef.current?.click()}><Camera className="h-5 w-5" />Hacer foto</Button><Button type="button" variant="outline" className="h-14 justify-center gap-2 text-base" disabled={uploading} onClick={() => galleryInputRef.current?.click()}><Images className="h-5 w-5" />Elegir de galería</Button><input ref={cameraInputRef} type="file" accept="image/*" capture="environment" disabled={uploading} onChange={handleImageChange} className="hidden" aria-label="Hacer una foto con la cámara" /><input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={handleImageChange} className="hidden" aria-label="Elegir fotos de la galería" /></div>}<p className="text-xs text-muted-foreground">Puedes añadir hasta {MAX_IMAGES} fotos. La cámara usa preferentemente la lente trasera del móvil.</p></section>
        <AIListingAssistant images={images} categories={categories} subcategories={subcategories} formData={formData} onApply={(next) => setFormData((current) => ({ ...current, ...next }))} />
        <section className="space-y-4"><Label className="text-base font-semibold">2. Información del producto</Label><div className="space-y-2"><Label htmlFor="title">Título *</Label><Input id="title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} maxLength={100} placeholder="Ej. iPhone 13 128GB azul" /><p className="text-right text-xs text-muted-foreground">{formData.title.length}/100</p></div><div className="space-y-2"><Label htmlFor="description">Descripción *</Label><Textarea id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={6} maxLength={MAX_DESCRIPTION_LENGTH} placeholder="Estado, antigüedad, accesorios, defectos y motivo de venta." /><p className="text-right text-xs text-muted-foreground">{formData.description.length}/{MAX_DESCRIPTION_LENGTH}</p></div></section>
        <section className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="price">Precio *</Label><div className="relative"><Euro className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="price" type="number" min={MIN_PRICE} max={MAX_PRICE} step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="pl-10" /></div></div><div className="space-y-2"><Label>Estado *</Label><Select value={formData.condition} onValueChange={value => setFormData({ ...formData, condition: value })}><SelectTrigger><SelectValue placeholder="Estado del producto" /></SelectTrigger><SelectContent>{Object.entries(conditionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></section>
        <section className="space-y-4"><Label className="text-base font-semibold">3. Categoría y ubicación</Label><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Categoría *</Label><Select value={formData.category_id} onValueChange={value => setFormData({ ...formData, category_id: value, subcategory_id: '' })}><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger><SelectContent>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>{formData.category_id && subcategories.length > 0 && <div className="space-y-2"><Label>Subcategoría</Label><Select value={formData.subcategory_id} onValueChange={value => setFormData({ ...formData, subcategory_id: value })}><SelectTrigger><SelectValue placeholder="Selecciona subcategoría" /></SelectTrigger><SelectContent>{subcategories.map(subcategory => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>)}</SelectContent></Select></div>}</div><div className="space-y-3"><Label htmlFor="location">Ubicación *</Label><div className="relative"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="location" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value, latitude: null, longitude: null })} placeholder="Ciudad" className="pl-10" /></div><Button type="button" variant={useCurrentLocation && geolocation.hasLocation ? 'default' : 'outline'} size="sm" onClick={() => { if (!useCurrentLocation) { setUseCurrentLocation(true); geolocation.requestLocation(); } else setUseCurrentLocation(false); }} disabled={geolocation.loading || uploading}>{geolocation.loading ? 'Obteniendo...' : useCurrentLocation && geolocation.hasLocation ? <><Locate className="mr-2 h-4 w-4" />Ubicación detectada</> : <><Navigation className="mr-2 h-4 w-4" />Usar mi ubicación</>}</Button></div></section>
        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row"><Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} className="flex-1" disabled={uploading}><Eye className="mr-2 h-4 w-4" />Vista previa</Button><Button type="button" variant="outline" disabled={uploading} onClick={() => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, savedAt: new Date().toISOString() })); setLastSavedAt(new Date()); toast({ title: 'Borrador guardado' }); }} className="flex-1"><Save className="mr-2 h-4 w-4" />Guardar borrador</Button><Button type="submit" className="flex-1 gradient-hero" disabled={uploading}>{uploading ? 'Publicando...' : 'Publicar anuncio'}</Button></div>
      </form></CardContent></Card><aside className="space-y-4"><Card><CardHeader><CardTitle className="text-lg">Lista de comprobación</CardTitle></CardHeader><CardContent className="space-y-2">{checks.map(check => <div key={check.label} className={`flex items-center gap-2 text-sm ${check.ok ? 'text-foreground' : 'text-muted-foreground'}`}><CheckCircle2 className={`h-4 w-4 ${check.ok ? 'text-green-600' : ''}`} />{check.label}</div>)}</CardContent></Card><Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lightbulb className="h-5 w-5 text-primary" />Para vender antes</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>• Usa varias fotos claras y ordena la mejor como principal.</p><p>• Menciona defectos y accesorios incluidos.</p><p>• Compara precios similares antes de publicar.</p><p>• Responde rápido a mensajes y ofertas.</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" />Publicación segura</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">No publiques teléfono, correo, Bizum ni enlaces externos. Negocia dentro de Reveta.</CardContent></Card></aside></div>
    </main><Footer /></div>
    {previewOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-medium text-primary">VISTA PREVIA</p><h2 className="text-xl font-bold">Así verá tu anuncio el comprador</h2></div><Button variant="ghost" size="icon" onClick={() => setPreviewOpen(false)}><X className="h-4 w-4" /></Button></div><div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">{imageUrls[0] ? <img src={imageUrls[0]} alt="Vista previa" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground">Añade una foto principal</div>}</div><div className="mt-4 space-y-3"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-bold">{formData.title || 'Título del producto'}</h3><p className="text-sm text-muted-foreground">{formData.location || 'Ubicación'} · {selectedCategory || 'Categoría'}</p></div><p className="text-2xl font-bold text-primary">{formatPrice(formData.price)}</p></div><Badge variant="secondary">{conditionLabels[formData.condition] || 'Estado sin indicar'}</Badge><p className="whitespace-pre-line text-sm text-muted-foreground">{formData.description || 'Aquí aparecerá la descripción de tu producto.'}</p></div><Button className="mt-5 w-full" onClick={() => setPreviewOpen(false)}>Seguir editando</Button></div></div>}
  </>;
};

export default Upload;
