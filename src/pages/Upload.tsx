import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Euro, ImagePlus, Lightbulb, Locate, MapPin, Navigation, ShieldCheck, Upload as UploadIcon, X } from 'lucide-react';

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
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación',
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeMultiline = (value: string) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
const isValidImageFile = (file: File) => ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_SIZE_BYTES;
const hasSuspiciousContactText = (value: string) => /\b(whatsapp|telegram|bizum|transferencia|correo|email|gmail|hotmail|tel[eé]fono|tlf|\+34)\b/i.test(value);

const Upload = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const geolocation = useGeolocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    subcategory_id: '',
    condition: '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (formData.category_id) fetchSubcategories(formData.category_id); else setSubcategories([]); }, [formData.category_id]);
  useEffect(() => { if (useCurrentLocation && geolocation.latitude && geolocation.longitude) reverseGeocode(geolocation.latitude, geolocation.longitude); }, [useCurrentLocation, geolocation.latitude, geolocation.longitude]);
  useEffect(() => () => { imageUrls.forEach((url) => URL.revokeObjectURL(url)); }, [imageUrls]);

  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) {
      console.error('Error fetching categories:', error);
      toast({ title: 'No se pudieron cargar las categorías', description: 'Puedes intentarlo de nuevo en unos segundos.', variant: 'destructive' });
      return;
    }
    setCategories(data || []);
  };

  const fetchSubcategories = async (categoryId: string) => {
    const { data, error } = await supabase.from('subcategories').select('*').eq('category_id', categoryId).order('name');
    setSubcategories(error ? [] : data || []);
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
      const data = await response.json();
      const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.suburb || data?.address?.state;
      if (city) {
        setFormData(prev => ({ ...prev, location: city, latitude: lat, longitude: lon }));
        toast({ title: 'Ubicación detectada', description: `Tu anuncio aparecerá cerca de ${city}.` });
      }
    } catch (error) {
      console.error('Error detecting location:', error);
    }
  };

  const geocodeTypedLocation = async (): Promise<GeocodedLocation | null> => {
    const typedLocation = normalizeText(formData.location);
    if (useCurrentLocation && geolocation.latitude && geolocation.longitude) return { latitude: geolocation.latitude, longitude: geolocation.longitude, displayName: typedLocation || undefined };
    if (!typedLocation) return null;
    try {
      const { data, error } = await supabase.functions.invoke('geocode-location', { body: { location: typedLocation } });
      if (error || !data?.latitude || !data?.longitude) return null;
      return { latitude: Number(data.latitude), longitude: Number(data.longitude), displayName: data.displayName || typedLocation };
    } catch {
      return null;
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';

    if (images.length + selectedFiles.length > MAX_IMAGES) {
      toast({ title: 'Límite de imágenes', description: `Puedes subir hasta ${MAX_IMAGES} fotos por producto.`, variant: 'destructive' });
      return;
    }

    const validFiles = selectedFiles.filter(isValidImageFile);
    const rejectedCount = selectedFiles.length - validFiles.length;

    if (rejectedCount > 0) {
      toast({ title: 'Algunas imágenes no se añadieron', description: 'Solo se permiten JPG, PNG o WEBP de hasta 5 MB.', variant: 'destructive' });
    }

    if (validFiles.length === 0) return;

    setImages(prev => [...prev, ...validFiles]);
    setImageUrls(prev => [...prev, ...validFiles.map(file => URL.createObjectURL(file))]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imageUrls[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<UploadedImageResult> => {
    if (!user || images.length === 0) return { urls: [], paths: [] };
    const urls: string[] = [];
    const paths: string[] = [];

    for (const image of images) {
      if (!isValidImageFile(image)) throw new Error('Una imagen no cumple los requisitos de formato o tamaño.');
      const fileExt = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      const { error } = await supabase.storage.from('products').upload(fileName, image, { contentType: image.type, upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
      urls.push(publicUrl);
      paths.push(fileName);
    }

    return { urls, paths };
  };

  const cleanupUploadedImages = async (paths: string[]) => {
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from('products').remove(paths);
    if (error) console.warn('No se pudieron limpiar imágenes huérfanas:', error.message);
  };

  const validateForm = () => {
    const title = normalizeText(formData.title);
    const description = normalizeMultiline(formData.description);
    const location = normalizeText(formData.location);
    const priceNum = parseFloat(String(formData.price).replace(',', '.'));

    if (images.length === 0) { toast({ title: 'Añade al menos una foto', description: 'Los anuncios con fotos reciben más mensajes.', variant: 'destructive' }); return null; }
    if (title.length < MIN_TITLE_LENGTH) { toast({ title: 'Título demasiado corto', description: `Escribe al menos ${MIN_TITLE_LENGTH} caracteres.`, variant: 'destructive' }); return null; }
    if (description.length < MIN_DESCRIPTION_LENGTH) { toast({ title: 'Descripción demasiado corta', description: `Añade al menos ${MIN_DESCRIPTION_LENGTH} caracteres con estado, uso y detalles.`, variant: 'destructive' }); return null; }
    if (description.length > MAX_DESCRIPTION_LENGTH) { toast({ title: 'Descripción demasiado larga', description: `Máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`, variant: 'destructive' }); return null; }
    if (!formData.price || isNaN(priceNum) || priceNum < MIN_PRICE || priceNum > MAX_PRICE) { toast({ title: 'Precio inválido', description: `Introduce un precio entre ${MIN_PRICE} € y ${MAX_PRICE.toLocaleString('es-ES')} €.`, variant: 'destructive' }); return null; }
    if (!formData.category_id) { toast({ title: 'Selecciona una categoría', description: 'Ayuda a los compradores a encontrar tu anuncio.', variant: 'destructive' }); return null; }
    if (!formData.condition) { toast({ title: 'Selecciona el estado', description: 'Indica si está nuevo, usado o necesita reparación.', variant: 'destructive' }); return null; }
    if (location.length < 2) { toast({ title: 'Añade una ubicación', description: 'Escribe al menos la ciudad donde está el producto.', variant: 'destructive' }); return null; }
    if (hasSuspiciousContactText(`${title} ${description}`)) { toast({ title: 'Evita datos de contacto en el anuncio', description: 'Por seguridad, usa el chat de Reveta para negociar y compartir datos.', variant: 'destructive' }); return null; }

    return { title, description, location, priceNum };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) { navigate('/auth'); return; }

    const validated = validateForm();
    if (!validated) return;

    setUploading(true);
    let uploadedPaths: string[] = [];
    try {
      const uploadedImages = await uploadImages();
      uploadedPaths = uploadedImages.paths;
      const geocodedLocation = await geocodeTypedLocation();
      const { error } = await supabase.from('products').insert({
        user_id: user.id,
        title: validated.title,
        description: validated.description,
        price: validated.priceNum,
        category_id: formData.category_id || null,
        subcategory_id: formData.subcategory_id || null,
        condition: formData.condition || null,
        location: geocodedLocation?.displayName || validated.location,
        latitude: geocodedLocation?.latitude ?? null,
        longitude: geocodedLocation?.longitude ?? null,
        images: uploadedImages.urls,
        status: 'active',
      });
      if (error) throw error;
      toast({ title: 'Producto publicado', description: geocodedLocation ? 'Tu anuncio ya aparece en Reveta y en búsquedas cercanas.' : 'Tu anuncio ya aparece en Reveta.' });
      navigate('/profile');
    } catch (error: any) {
      await cleanupUploadedImages(uploadedPaths);
      toast({ title: 'No se pudo publicar', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <>
      <Helmet>
        <title>Publicar producto | Reveta</title>
        <meta name="description" content="Publica gratis un producto de segunda mano en Reveta. Añade fotos, precio, ciudad y empieza a recibir mensajes de compradores." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl"><UploadIcon className="h-6 w-6" />Publicar producto</CardTitle>
                <CardDescription>Sube buenas fotos, escribe un título claro y añade un precio realista para vender antes.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-7">
                  <section className="space-y-4">
                    <div>
                      <Label className="text-base font-semibold">1. Fotos del producto *</Label>
                      <p className="mt-1 text-sm text-muted-foreground">Añade hasta 5 fotos JPG, PNG o WEBP de máximo 5 MB. La primera será la imagen principal.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
                      {imageUrls.map((url, index) => (
                        <div key={url} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                          <img src={url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                          <button type="button" onClick={() => removeImage(index)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground" aria-label="Quitar foto"><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <>
                          <label className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                            <ImagePlus className="h-6 w-6" /><span className="text-xs">Galería</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageChange} className="hidden" />
                          </label>
                          <label className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                            <UploadIcon className="h-6 w-6" /><span className="text-xs">Cámara</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleImageChange} className="hidden" />
                          </label>
                        </>
                      )}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div>
                      <Label className="text-base font-semibold">2. Información del anuncio</Label>
                      <p className="mt-1 text-sm text-muted-foreground">Sé concreto. Ejemplo: “iPhone 13 128GB azul en buen estado”.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Título *</Label>
                      <Input id="title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="¿Qué vendes?" maxLength={100} />
                      <p className="text-xs text-muted-foreground">Mínimo {MIN_TITLE_LENGTH} caracteres.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descripción *</Label>
                      <Textarea id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Explica el estado, tiempo de uso, accesorios incluidos y motivo de venta." rows={5} maxLength={MAX_DESCRIPTION_LENGTH} />
                      <p className="text-xs text-muted-foreground">No pongas teléfono, email, WhatsApp, Bizum ni enlaces externos en la descripción.</p>
                    </div>
                  </section>

                  <section className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="price">Precio *</Label>
                      <div className="relative"><Euro className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="price" type="number" min={MIN_PRICE} max={MAX_PRICE} step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" className="pl-10" /></div>
                      <p className="text-xs text-muted-foreground">Entre {MIN_PRICE} € y {MAX_PRICE.toLocaleString('es-ES')} €.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Estado *</Label>
                      <Select value={formData.condition} onValueChange={value => setFormData({ ...formData, condition: value })}>
                        <SelectTrigger><SelectValue placeholder="Estado del producto" /></SelectTrigger>
                        <SelectContent>{Object.entries(conditionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div>
                      <Label className="text-base font-semibold">3. Categoría y ubicación</Label>
                      <p className="mt-1 text-sm text-muted-foreground">Ayuda a los compradores a encontrar tu anuncio.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Categoría *</Label>
                        <Select value={formData.category_id} onValueChange={value => setFormData({ ...formData, category_id: value, subcategory_id: '' })}>
                          <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                          <SelectContent>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {formData.category_id && subcategories.length > 0 && (
                        <div className="space-y-2">
                          <Label>Subcategoría</Label>
                          <Select value={formData.subcategory_id} onValueChange={value => setFormData({ ...formData, subcategory_id: value })}>
                            <SelectTrigger><SelectValue placeholder="Selecciona subcategoría" /></SelectTrigger>
                            <SelectContent>{subcategories.map(subcategory => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="location">Ubicación *</Label>
                      <div className="relative"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="location" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value, latitude: null, longitude: null })} placeholder="Ciudad" className="pl-10" /></div>
                      <Button type="button" variant={useCurrentLocation && geolocation.hasLocation ? 'default' : 'outline'} size="sm" className="gap-2" onClick={() => { if (!useCurrentLocation) { setUseCurrentLocation(true); geolocation.requestLocation(); } else { setUseCurrentLocation(false); setFormData(prev => ({ ...prev, location: '', latitude: null, longitude: null })); } }} disabled={geolocation.loading}>{geolocation.loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Obteniendo...</> : useCurrentLocation && geolocation.hasLocation ? <><Locate className="h-4 w-4" />Ubicación detectada</> : <><Navigation className="h-4 w-4" />Usar mi ubicación actual</>}</Button>
                      {useCurrentLocation && geolocation.error && <p className="text-sm text-destructive">{geolocation.error}</p>}
                    </div>
                  </section>

                  <div className="flex gap-4 border-t pt-6">
                    <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1" disabled={uploading}>Cancelar</Button>
                    <Button type="submit" className="flex-1 gradient-hero" disabled={uploading}>{uploading ? 'Publicando...' : 'Publicar anuncio gratis'}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <aside className="space-y-4">
              <Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lightbulb className="h-5 w-5 text-primary" />Consejos para vender antes</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Sube fotos claras con buena luz.</span></div><div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Indica marca, modelo, estado y accesorios.</span></div><div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Usa un precio competitivo para recibir más mensajes.</span></div><div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Responde rápido a las ofertas.</span></div></CardContent></Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" />Publicación segura</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">No compartas datos sensibles en la descripción. Usa el chat de Reveta para negociar y evita pagos externos sospechosos.</CardContent></Card>
            </aside>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Upload;
