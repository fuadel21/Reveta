import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight, Eye, ImagePlus, MapPin, Save, Star, Trash2, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type Category = { id: string; name: string };
type Subcategory = { id: string; category_id: string; name: string };
type EditableProduct = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  category_id: string | null;
  subcategory_id: string | null;
  condition: string | null;
  status: string | null;
  images: string[] | null;
};
type EditableImage = { id: string; url: string; file?: File; original: boolean };
type EditForm = {
  title: string;
  description: string;
  price: string;
  location: string;
  category_id: string;
  subcategory_id: string;
  condition: string;
};

const OPEN_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación',
};
const emptyForm: EditForm = { title: '', description: '', price: '', location: '', category_id: '', subcategory_id: '', condition: '' };
const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeMultiline = (value: string) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
const parsePrice = (value: string) => Number.parseFloat(value.replace(',', '.'));
const isValidImage = (file: File) => ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_SIZE_BYTES;

const getStoragePath = (url: string, userId: string) => {
  try {
    const marker = '/storage/v1/object/public/products/';
    const index = url.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
    return path.startsWith(`${userId}/`) ? path : null;
  } catch {
    return null;
  }
};

const EditProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<EditableImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [product, setProduct] = useState<EditableProduct | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [images, setImages] = useState<EditableImage[]>([]);
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [form, setForm] = useState<EditForm>(emptyForm);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user?.id && productId) loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, productId]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => () => {
    imagesRef.current.filter((image) => !image.original).forEach((image) => URL.revokeObjectURL(image.url));
  }, []);

  useEffect(() => {
    if (!form.category_id) {
      setSubcategories([]);
      return;
    }
    fetchSubcategories(form.category_id);
  }, [form.category_id]);

  const currentSnapshot = useMemo(() => JSON.stringify({ form, images: images.map((image) => ({ id: image.id, url: image.url, original: image.original })) }), [form, images]);
  const hasUnsavedChanges = !!initialSnapshot && currentSnapshot !== initialSnapshot;
  const previewPrice = parsePrice(form.price);
  const selectedCategory = categories.find((category) => category.id === form.category_id)?.name || 'Sin categoría';
  const selectedSubcategory = subcategories.find((subcategory) => subcategory.id === form.subcategory_id)?.name;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || saving) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges, saving]);

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('id, name').order('name');
    if (error) throw error;
    setCategories((data || []) as Category[]);
  };

  const fetchSubcategories = async (categoryId: string) => {
    const { data, error } = await supabase.from('subcategories').select('id, category_id, name').eq('category_id', categoryId).order('name');
    if (error) {
      setSubcategories([]);
      return;
    }
    setSubcategories((data || []) as Subcategory[]);
  };

  const loadProduct = async () => {
    if (!user || !productId) return;
    setLoading(true);
    try {
      const [{ data, error }] = await Promise.all([
        supabase
          .from('products')
          .select('id, user_id, title, description, price, location, latitude, longitude, category_id, subcategory_id, condition, status, images')
          .eq('id', productId)
          .maybeSingle(),
        fetchCategories(),
      ]);
      if (error || !data) throw error || new Error('Producto no encontrado');
      if (data.user_id !== user.id) throw new Error('Solo puedes editar tus propios anuncios');
      if (data.status === 'sold' || data.status === 'completed') throw new Error('Los productos vendidos no se pueden editar');

      const [{ count: reservations }, { count: transactions }] = await Promise.all([
        (supabase as any).from('product_reservations').select('id', { count: 'exact', head: true }).eq('product_id', data.id).eq('status', 'active'),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('product_id', data.id).in('status', OPEN_TRANSACTION_STATUSES),
      ]);
      if ((reservations || 0) > 0 || (transactions || 0) > 0) throw new Error('Este anuncio tiene una reserva u operación abierta y no se puede editar todavía');

      const editable = data as EditableProduct;
      const currentUrls = Array.isArray(editable.images) ? editable.images.filter(Boolean).slice(0, MAX_IMAGES) : [];
      const nextImages = currentUrls.map((url, index) => ({ id: `original-${index}-${url}`, url, original: true }));
      const nextForm: EditForm = {
        title: editable.title || '',
        description: editable.description || '',
        price: String(editable.price ?? ''),
        location: editable.location || '',
        category_id: editable.category_id || '',
        subcategory_id: editable.subcategory_id || '',
        condition: editable.condition || '',
      };
      setProduct(editable);
      setOriginalImageUrls(currentUrls);
      setImages(nextImages);
      setForm(nextForm);
      setInitialSnapshot(JSON.stringify({ form: nextForm, images: nextImages.map((image) => ({ id: image.id, url: image.url, original: image.original })) }));
    } catch (error: any) {
      toast({ title: 'No se puede editar este anuncio', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
      navigate('/seller-dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (saving) return;
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    const availableSlots = Math.max(0, MAX_IMAGES - images.length);
    const valid = selected.filter(isValidImage);
    const accepted = valid.slice(0, availableSlots);
    const rejected = selected.length - accepted.length;
    if (accepted.length > 0) {
      setImages((current) => [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), original: false }))]);
    }
    if (rejected > 0) {
      toast({ title: 'Algunas fotos no se añadieron', description: `Se añadieron ${accepted.length}. Se ignoraron ${rejected} por formato, tamaño o por superar el máximo de ${MAX_IMAGES}.`, variant: 'destructive' });
    }
  };

  const removeImage = (index: number) => {
    if (saving) return;
    const image = images[index];
    if (!image) return;
    if (!image.original) URL.revokeObjectURL(image.url);
    setImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    if (saving) return;
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setImages((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const confirmNavigation = (destination: string) => {
    if (hasUnsavedChanges && !saving && !window.confirm('Tienes cambios sin guardar. ¿Quieres salir igualmente?')) return;
    navigate(destination);
  };

  const uploadNewImages = async () => {
    if (!user) return { urlsById: new Map<string, string>(), paths: [] as string[] };
    const urlsById = new Map<string, string>();
    const paths: string[] = [];
    try {
      for (const image of images) {
        if (!image.file) continue;
        const extension = image.file.type === 'image/png' ? 'png' : image.file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from('products').upload(path, image.file, { contentType: image.file.type, upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
        paths.push(path);
        urlsById.set(image.id, publicUrl);
      }
      return { urlsById, paths };
    } catch (error) {
      if (paths.length > 0) await supabase.storage.from('products').remove(paths);
      throw error;
    }
  };

  const geocodeLocation = async (location: string) => {
    if (product && normalizeText(product.location || '') === location) return { latitude: product.latitude, longitude: product.longitude, displayName: location };
    try {
      const { data, error } = await supabase.functions.invoke('geocode-location', { body: { location } });
      if (error || !data?.latitude || !data?.longitude) return { latitude: null, longitude: null, displayName: location };
      return { latitude: Number(data.latitude), longitude: Number(data.longitude), displayName: data.displayName || location };
    } catch {
      return { latitude: null, longitude: null, displayName: location };
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !product || saving) return;
    const title = normalizeText(form.title);
    const description = normalizeMultiline(form.description);
    const location = normalizeText(form.location);
    const price = parsePrice(form.price);

    if (images.length === 0) return void toast({ title: 'Añade al menos una foto', description: 'El anuncio no puede quedarse sin imágenes.', variant: 'destructive' });
    if (title.length < 8) return void toast({ title: 'Título demasiado corto', description: 'Escribe al menos 8 caracteres.', variant: 'destructive' });
    if (description.length < 20 || description.length > 2000) return void toast({ title: 'Revisa la descripción', description: 'Debe tener entre 20 y 2000 caracteres.', variant: 'destructive' });
    if (!Number.isFinite(price) || price < 0.5 || price > 50000) return void toast({ title: 'Precio inválido', description: 'Usa un importe entre 0,50 € y 50.000 €.', variant: 'destructive' });
    if (location.length < 2 || !form.condition || !form.category_id) return void toast({ title: 'Faltan datos', description: 'Completa categoría, ubicación y estado del producto.', variant: 'destructive' });

    setSaving(true);
    let uploadedPaths: string[] = [];
    try {
      const [uploaded, geocoded] = await Promise.all([uploadNewImages(), geocodeLocation(location)]);
      uploadedPaths = uploaded.paths;
      const finalUrls = images.map((image) => image.original ? image.url : uploaded.urlsById.get(image.id)).filter((url): url is string => !!url);
      if (finalUrls.length !== images.length) throw new Error('No se pudieron preparar todas las imágenes');

      const { error } = await supabase
        .from('products')
        .update({
          title,
          description,
          price,
          location: geocoded.displayName,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          category_id: form.category_id,
          subcategory_id: form.subcategory_id || null,
          condition: form.condition,
          images: finalUrls,
        })
        .eq('id', product.id)
        .eq('user_id', user.id);
      if (error) throw error;

      const keptOriginals = new Set(images.filter((image) => image.original).map((image) => image.url));
      const pathsToDelete = originalImageUrls.filter((url) => !keptOriginals.has(url)).map((url) => getStoragePath(url, user.id)).filter((path): path is string => !!path);
      if (pathsToDelete.length > 0) {
        const { error: cleanupError } = await supabase.storage.from('products').remove(pathsToDelete);
        if (cleanupError) console.warn('No se pudieron retirar algunas imágenes antiguas:', cleanupError);
      }

      setInitialSnapshot('');
      toast({ title: 'Anuncio actualizado', description: 'Información, categoría, ubicación y fotos guardadas.' });
      navigate(`/product/${product.id}`, { replace: true });
    } catch (error: any) {
      if (uploadedPaths.length > 0) await supabase.storage.from('products').remove(uploadedPaths);
      toast({ title: 'No se pudo guardar', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
      setSaving(false);
    }
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!user || !product) return null;

  return (
    <>
      <Helmet><title>Editar anuncio | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => confirmNavigation('/seller-dashboard')}><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Button>
            {hasUnsavedChanges && <Badge variant="secondary">Cambios sin guardar</Badge>}
          </div>
          <Card className="mx-auto max-w-4xl">
            <CardHeader><CardTitle>Editar anuncio</CardTitle><CardDescription>Actualiza toda la ficha. La primera imagen será la foto principal.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-7">
                <section className="space-y-3">
                  <div className="flex items-center justify-between"><Label className="text-base">Fotografías</Label><span className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES}</span></div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {images.map((image, index) => <div key={image.id} className="relative aspect-square overflow-hidden rounded-xl border bg-muted"><img src={image.url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <Badge className="absolute left-1 top-1"><Star className="mr-1 h-3 w-3" />Principal</Badge>}<button type="button" disabled={saving} onClick={() => removeImage(index)} aria-label={`Eliminar foto ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-destructive p-1.5 text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button><div className="absolute bottom-1 left-1 right-1 flex justify-between"><button type="button" disabled={saving || index === 0} onClick={() => moveImage(index, -1)} className="rounded-full bg-black/65 p-1.5 text-white disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" disabled={saving || index === images.length - 1} onClick={() => moveImage(index, 1)} className="rounded-full bg-black/65 p-1.5 text-white disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button></div></div>)}
                  </div>
                  {images.length < MAX_IMAGES && <><Button type="button" variant="outline" className="w-full" disabled={saving} onClick={() => fileInputRef.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />Añadir fotos</Button><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFiles} /></>}
                  <p className="text-xs text-muted-foreground">JPG, PNG o WEBP de hasta 5 MB. Debe quedar al menos una foto.</p>
                </section>

                <section className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="edit-title">Título</Label><Input id="edit-title" disabled={saving} value={form.title} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="edit-description">Descripción</Label><Textarea id="edit-description" disabled={saving} rows={8} maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /><p className="text-right text-xs text-muted-foreground">{form.description.length}/2000</p></div>
                  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="edit-price">Precio</Label><Input id="edit-price" disabled={saving} type="number" min="0.5" max="50000" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} /></div><div className="space-y-2"><Label>Estado</Label><Select disabled={saving} value={form.condition} onValueChange={(value) => setForm((current) => ({ ...current, condition: value }))}><SelectTrigger><SelectValue placeholder="Estado del producto" /></SelectTrigger><SelectContent>{Object.entries(conditionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>
                </section>

                <section className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Categoría</Label><Select disabled={saving} value={form.category_id} onValueChange={(value) => setForm((current) => ({ ...current, category_id: value, subcategory_id: '' }))}><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Subcategoría</Label><Select disabled={saving || !form.category_id || subcategories.length === 0} value={form.subcategory_id} onValueChange={(value) => setForm((current) => ({ ...current, subcategory_id: value }))}><SelectTrigger><SelectValue placeholder={subcategories.length ? 'Selecciona subcategoría' : 'Sin subcategorías'} /></SelectTrigger><SelectContent>{subcategories.map((subcategory) => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>)}</SelectContent></Select></div></div>
                  <div className="space-y-2"><Label htmlFor="edit-location">Ubicación</Label><div className="relative"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="edit-location" disabled={saving} className="pl-10" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} /></div><p className="text-xs text-muted-foreground">Si cambias la ciudad, las coordenadas se recalcularán al guardar.</p></div>
                </section>

                <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={saving} onClick={() => confirmNavigation('/seller-dashboard')}>Cancelar</Button><Button type="button" variant="outline" disabled={saving} onClick={() => setPreviewOpen(true)}><Eye className="mr-2 h-4 w-4" />Vista previa</Button><Button type="submit" disabled={saving || !hasUnsavedChanges}><Save className="mr-2 h-4 w-4" />{saving ? 'Guardando...' : hasUnsavedChanges ? 'Guardar cambios' : 'Sin cambios'}</Button></div>
              </form>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>

      {previewOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">VISTA PREVIA</p><h2 className="text-xl font-bold">Así quedará el anuncio</h2></div><Button type="button" variant="ghost" size="icon" onClick={() => setPreviewOpen(false)}><X className="h-4 w-4" /></Button></div><div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">{images[0]?.url ? <img src={images[0].url} alt="Vista previa" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground">Sin foto principal</div>}</div><div className="mt-4 space-y-3"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-bold">{form.title || 'Título del producto'}</h3><p className="text-sm text-muted-foreground">{form.location || 'Ubicación'} · {selectedSubcategory || selectedCategory}</p></div><p className="text-2xl font-bold text-primary">{Number.isFinite(previewPrice) ? `${previewPrice.toLocaleString('es-ES')} €` : '0 €'}</p></div><Badge variant="secondary">{conditionLabels[form.condition] || 'Estado sin indicar'}</Badge><p className="whitespace-pre-line text-sm text-muted-foreground">{form.description || 'Aquí aparecerá la descripción.'}</p></div><Button type="button" className="mt-5 w-full" onClick={() => setPreviewOpen(false)}>Seguir editando</Button></div></div>}
    </>
  );
};

export default EditProduct;
