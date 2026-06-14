import { useState, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload as UploadIcon, X, ImagePlus, MapPin, Euro, Navigation, Locate, ChevronRight, Sparkles } from 'lucide-react';

interface Category { id: string; name: string; icon: string; }
interface Subcategory { id: string; category_id: string; name: string; icon: string | null; }
interface GeocodedLocation { latitude: number; longitude: number; displayName?: string; }
interface DetectionRule { keywords: string[]; categoryHints: string[]; subcategoryHints?: string[]; score: number; }

const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación',
};

const DETECTION_RULES: DetectionRule[] = [
  { keywords: ['iphone', 'samsung', 'xiaomi', 'huawei', 'oppo', 'realme', 'pixel', 'movil', 'moviles', 'móvil', 'móviles', 'telefono', 'teléfono', 'smartphone'], categoryHints: ['electronica'], subcategoryHints: ['movil', 'moviles', 'móviles', 'telefono', 'telefonos'], score: 30 },
  { keywords: ['portatil', 'portátil', 'macbook', 'ordenador', 'pc', 'imac', 'laptop', 'asus', 'lenovo', 'hp', 'dell', 'monitor', 'teclado', 'raton', 'ratón'], categoryHints: ['electronica'], subcategoryHints: ['ordenador', 'ordenadores'], score: 30 },
  { keywords: ['tablet', 'ipad', 'galaxy tab'], categoryHints: ['electronica'], subcategoryHints: ['tablet', 'tablets'], score: 30 },
  { keywords: ['television', 'televisión', 'tv', 'smart tv', 'oled', 'qled', 'monitor tv'], categoryHints: ['electronica'], subcategoryHints: ['tv', 'television', 'televisión'], score: 30 },
  { keywords: ['auriculares', 'airpods', 'altavoz', 'bluetooth', 'sonos', 'jbl', 'cascos', 'homepod', 'barra de sonido', 'subwoofer'], categoryHints: ['electronica'], subcategoryHints: ['audio', 'sonido', 'auriculares', 'altavoces'], score: 30 },
  { keywords: ['camara', 'cámara', 'canon', 'nikon', 'sony alpha', 'objetivo', 'gopro', 'dron', 'drone', 'fotografia', 'fotografía'], categoryHints: ['electronica'], subcategoryHints: ['camara', 'camaras', 'cámaras', 'fotografia', 'fotografía'], score: 28 },

  { keywords: ['coche', 'coches', 'auto', 'vehiculo', 'vehículo', 'seat', 'renault', 'bmw', 'audi', 'mercedes', 'ford', 'toyota', 'volkswagen', 'passat', 'golf', 'ibiza', 'megane', 'clio'], categoryHints: ['motor'], subcategoryHints: ['coche', 'coches'], score: 32 },
  { keywords: ['moto', 'motos', 'scooter', 'yamaha', 'honda', 'kawasaki', 'vespa', 'ducati', 'casco moto'], categoryHints: ['motor'], subcategoryHints: ['moto', 'motos'], score: 32 },
  { keywords: ['bateria coche', 'batería coche', 'arrancador', 'arrancador bateria', 'arrancador batería', 'cargador bateria', 'cargador batería', 'llantas', 'neumaticos', 'neumáticos', 'radio coche', 'portabicis', 'bacas', 'maletero', 'gps coche', 'aceite motor'], categoryHints: ['motor'], subcategoryHints: ['accesorios'], score: 34 },

  { keywords: ['bicicleta', 'bicicletas', 'bici', 'mtb', 'mountain bike', 'carretera', 'patinete', 'patinete electrico', 'patinete eléctrico'], categoryHints: ['deportes'], subcategoryHints: ['bicicleta', 'bicicletas', 'patinete', 'patinetes'], score: 30 },
  { keywords: ['pesa', 'pesas', 'mancuerna', 'mancuernas', 'fitness', 'gym', 'gimnasio', 'banco pesas', 'cinta correr', 'eliptica', 'elíptica'], categoryHints: ['deportes'], subcategoryHints: ['fitness'], score: 30 },
  { keywords: ['balon', 'balón', 'futbol', 'fútbol', 'botas futbol', 'botas fútbol', 'portería', 'porteria'], categoryHints: ['deportes'], subcategoryHints: ['futbol', 'fútbol'], score: 28 },
  { keywords: ['raqueta', 'tenis', 'padel', 'pádel', 'ski', 'snowboard', 'surf', 'kayak', 'tabla surf', 'neopreno', 'running', 'zapatillas running'], categoryHints: ['deportes'], subcategoryHints: ['running', 'deportes acuaticos', 'deportes acuáticos', 'deportes de nieve'], score: 26 },

  { keywords: ['sofa', 'sofá', 'mesa', 'silla', 'sillas', 'armario', 'estanteria', 'estantería', 'cama', 'colchon', 'colchón', 'mueble', 'muebles', 'comoda', 'cómoda', 'escritorio'], categoryHints: ['hogar'], subcategoryHints: ['mueble', 'muebles'], score: 32 },
  { keywords: ['nevera', 'frigorifico', 'frigorífico', 'lavadora', 'secadora', 'horno', 'microondas', 'cafetera', 'aspiradora', 'lavavajillas', 'termo', 'aire acondicionado'], categoryHints: ['hogar'], subcategoryHints: ['electrodomesticos', 'electrodomésticos'], score: 32 },
  { keywords: ['decoracion', 'decoración', 'lampara', 'lámpara', 'cuadro', 'alfombra', 'espejo', 'cortinas', 'jarron', 'jarrón'], categoryHints: ['hogar'], subcategoryHints: ['decoracion', 'decoración'], score: 26 },
  { keywords: ['sarten', 'sartén', 'olla', 'vajilla', 'cuberteria', 'cubertería', 'batidora', 'robot cocina', 'thermomix', 'cocina'], categoryHints: ['hogar'], subcategoryHints: ['cocina'], score: 28 },
  { keywords: ['jardin', 'jardín', 'barbacoa', 'cortacesped', 'cortacésped', 'maceta', 'manguera', 'terraza', 'tumbona'], categoryHints: ['hogar'], subcategoryHints: ['jardin', 'jardín'], score: 28 },
  { keywords: ['herramienta', 'herramientas', 'taladro', 'sierra', 'destornillador', 'bricolaje', 'lijadora', 'radial', 'martillo', 'caja herramientas'], categoryHints: ['hogar'], subcategoryHints: ['herramientas'], score: 30 },

  { keywords: ['pantalon', 'pantalón', 'jeans', 'vaquero', 'camisa', 'camiseta', 'chaqueta', 'abrigo', 'vestido', 'falda', 'jersey', 'sudadera', 'traje', 'bikini', 'bañador'], categoryHints: ['moda'], subcategoryHints: ['ropa'], score: 32 },
  { keywords: ['zapatos', 'zapatillas', 'botas', 'botines', 'nike', 'adidas', 'new balance', 'sandalias', 'tacones', 'converse', 'vans'], categoryHints: ['moda'], subcategoryHints: ['zapatos', 'calzado'], score: 32 },
  { keywords: ['bolso', 'mochila', 'cartera', 'reloj', 'gafas', 'collar', 'pulsera', 'anillo', 'pendientes', 'cinturon', 'cinturón', 'bufanda'], categoryHints: ['moda'], subcategoryHints: ['complementos', 'accesorios'], score: 30 },

  { keywords: ['playstation', 'ps4', 'ps5', 'xbox', 'nintendo', 'switch', 'consola', 'consolas'], categoryHints: ['juegos', 'electronica'], subcategoryHints: ['consolas'], score: 32 },
  { keywords: ['videojuego', 'videojuegos', 'fifa', 'ea sports', 'call of duty', 'minecraft', 'zelda', 'pokemon', 'pokémon'], categoryHints: ['juegos'], subcategoryHints: ['videojuegos'], score: 30 },
  { keywords: ['juego mesa', 'juego de mesa', 'monopoly', 'risk', 'ajedrez', 'cartas', 'puzzle'], categoryHints: ['juegos'], subcategoryHints: ['juegos de mesa'], score: 30 },
  { keywords: ['juguete', 'juguetes', 'lego', 'muñeca', 'muneca', 'peluche', 'playmobil', 'hot wheels', 'barbie'], categoryHints: ['juegos'], subcategoryHints: ['juguetes'], score: 30 },

  { keywords: ['libro', 'libros', 'novela', 'cuento', 'literatura'], categoryHints: ['libros'], subcategoryHints: ['novelas', 'libros'], score: 32 },
  { keywords: ['comic', 'cómic', 'comics', 'cómics', 'marvel', 'dc comics'], categoryHints: ['libros'], subcategoryHints: ['comics', 'cómics'], score: 30 },
  { keywords: ['manga', 'anime', 'naruto', 'one piece', 'dragon ball'], categoryHints: ['libros'], subcategoryHints: ['manga'], score: 30 },
  { keywords: ['libro texto', 'libro de texto', 'apuntes', 'universidad', 'bachillerato', 'eso', 'primaria'], categoryHints: ['libros'], subcategoryHints: ['libros de texto'], score: 30 },

  { keywords: ['perro', 'perros', 'correa', 'arnes', 'arnés', 'cama perro', 'transportin perro'], categoryHints: ['mascotas'], subcategoryHints: ['perros', 'accesorios'], score: 30 },
  { keywords: ['gato', 'gatos', 'rascador', 'arena gato', 'transportin gato'], categoryHints: ['mascotas'], subcategoryHints: ['gatos', 'accesorios'], score: 30 },
  { keywords: ['acuario', 'pecera', 'filtro acuario', 'peces'], categoryHints: ['mascotas'], subcategoryHints: ['acuarios'], score: 30 },
  { keywords: ['mascota', 'mascotas', 'jaula', 'comedero', 'bebedero', 'transportin', 'transportín'], categoryHints: ['mascotas'], subcategoryHints: ['accesorios'], score: 26 },

  { keywords: ['perfume', 'colonia', 'crema', 'secador pelo', 'plancha pelo', 'maquillaje', 'pintalabios', 'rimel', 'rímel', 'afeitadora', 'depiladora'], categoryHints: ['belleza', 'otros'], subcategoryHints: ['perfumes', 'maquillaje', 'cuidado personal'], score: 30 },
  { keywords: ['guitarra', 'piano', 'teclado', 'bateria', 'batería', 'violin', 'violín', 'microfono', 'micrófono', 'amplificador', 'mesa mezclas'], categoryHints: ['instrumentos', 'otros'], subcategoryHints: ['guitarras', 'pianos', 'teclados', 'sonido profesional'], score: 30 },
  { keywords: ['impresora', 'scanner', 'escáner', 'silla oficina', 'mesa oficina', 'material oficina', 'calculadora', 'archivador'], categoryHints: ['oficina', 'otros'], subcategoryHints: ['impresoras', 'material de oficina', 'mobiliario de oficina'], score: 30 },
  { keywords: ['moneda', 'monedas', 'billete', 'billetes', 'sello', 'sellos', 'carta pokemon', 'carta pokémon', 'antiguedad', 'antigüedad', 'figura coleccion'], categoryHints: ['coleccionismo', 'otros'], subcategoryHints: ['monedas', 'billetes', 'cartas', 'antiguedades', 'antigüedades'], score: 30 },
];

const normalizeText = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
const containsTerm = (text: string, term: string) => {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  return text.includes(normalizedTerm);
};

const Upload = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const geolocation = useGeolocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [autoDetectedLabel, setAutoDetectedLabel] = useState('');
  const [formData, setFormData] = useState({ title: '', description: '', price: '', category_id: '', subcategory_id: '', condition: '', location: '', latitude: null as number | null, longitude: null as number | null });

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);
  useEffect(() => { fetchCategories(); fetchAllSubcategories(); }, []);
  useEffect(() => { if (formData.category_id) fetchSubcategories(formData.category_id); else { setSubcategories([]); setFormData(prev => ({ ...prev, subcategory_id: '' })); } }, [formData.category_id]);
  useEffect(() => { if (useCurrentLocation && geolocation.latitude && geolocation.longitude) reverseGeocode(geolocation.latitude, geolocation.longitude); }, [useCurrentLocation, geolocation.latitude, geolocation.longitude]);
  useEffect(() => {
    if (categoryTouched || categories.length === 0) return;
    const timer = window.setTimeout(() => {
      const detected = detectCategoryFromText();
      if (!detected || detected.score < 12) return;
      setFormData(prev => prev.category_id === detected.categoryId && prev.subcategory_id === detected.subcategoryId ? prev : { ...prev, category_id: detected.categoryId, subcategory_id: detected.subcategoryId || '' });
      setAutoDetectedLabel(detected.label);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [formData.title, formData.description, categories, allSubcategories, categoryTouched]);

  const detectCategoryFromText = () => {
    const text = normalizeText(`${formData.title} ${formData.description}`);
    if (text.length < 3) return null;
    let bestMatch: { categoryId: string; subcategoryId: string; score: number; label: string } | null = null;
    for (const category of categories) {
      const categoryName = normalizeText(category.name);
      const categorySubcategories = allSubcategories.filter(sub => sub.category_id === category.id);
      let categoryScore = categoryName.length >= 3 && containsTerm(text, categoryName) ? 20 : 0;
      for (const rule of DETECTION_RULES) {
        if (!rule.keywords.some(keyword => containsTerm(text, keyword))) continue;
        if (rule.categoryHints.some(hint => containsTerm(categoryName, hint) || containsTerm(hint, categoryName))) categoryScore += rule.score;
      }
      if (categoryScore > 0 && (!bestMatch || categoryScore > bestMatch.score)) bestMatch = { categoryId: category.id, subcategoryId: '', score: categoryScore, label: category.name };
      for (const subcategory of categorySubcategories) {
        const subcategoryName = normalizeText(subcategory.name);
        let subcategoryScore = categoryScore;
        if (subcategoryName.length >= 3 && containsTerm(text, subcategoryName)) subcategoryScore += 25;
        for (const rule of DETECTION_RULES) {
          if (!rule.keywords.some(keyword => containsTerm(text, keyword))) continue;
          const categoryMatches = rule.categoryHints.some(hint => containsTerm(categoryName, hint) || containsTerm(hint, categoryName));
          const subcategoryMatches = rule.subcategoryHints?.some(hint => containsTerm(subcategoryName, hint) || containsTerm(hint, subcategoryName)) || false;
          if (subcategoryMatches) subcategoryScore += rule.score + 12;
          else if (categoryMatches) subcategoryScore += Math.floor(rule.score / 2);
        }
        if (subcategoryScore > 0 && (!bestMatch || subcategoryScore > bestMatch.score)) bestMatch = { categoryId: category.id, subcategoryId: subcategory.id, score: subcategoryScore, label: `${category.name} · ${subcategory.name}` };
      }
    }
    return bestMatch;
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
      const data = await response.json();
      const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.suburb || data?.address?.state;
      if (city) { setFormData(prev => ({ ...prev, location: city, latitude: lat, longitude: lon })); toast({ title: 'Ubicación detectada', description: `Te encuentras en ${city}` }); }
    } catch (error) { console.error('Error in reverse geocoding:', error); }
  };

  const geocodeTypedLocation = async (): Promise<GeocodedLocation | null> => {
    const typedLocation = formData.location.trim();
    if (useCurrentLocation && geolocation.latitude && geolocation.longitude) return { latitude: geolocation.latitude, longitude: geolocation.longitude, displayName: typedLocation || undefined };
    if (!typedLocation) return null;
    try {
      const { data, error } = await supabase.functions.invoke('geocode-location', { body: { location: typedLocation } });
      if (error || !data?.latitude || !data?.longitude) return null;
      return { latitude: Number(data.latitude), longitude: Number(data.longitude), displayName: data.displayName || typedLocation };
    } catch { return null; }
  };

  const fetchCategories = async () => { const { data, error } = await supabase.from('categories').select('*').order('name'); if (!error) setCategories(data || []); };
  const fetchAllSubcategories = async () => { const { data, error } = await supabase.from('subcategories').select('*').order('name'); if (!error) setAllSubcategories(data || []); };
  const fetchSubcategories = async (categoryId: string) => { setLoadingSubcategories(true); const { data, error } = await supabase.from('subcategories').select('*').eq('category_id', categoryId).order('name'); setSubcategories(error ? [] : data || []); setLoadingSubcategories(false); };
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(e.target.files || []); if (images.length + files.length > 5) { toast({ title: 'Límite de imágenes', description: 'Solo puedes subir un máximo de 5 imágenes', variant: 'destructive' }); return; } setImages([...images, ...files]); setImageUrls([...imageUrls, ...files.map(file => URL.createObjectURL(file))]); };
  const removeImage = (index: number) => { setImages(images.filter((_, i) => i !== index)); setImageUrls(imageUrls.filter((_, i) => i !== index)); };
  const uploadImages = async (): Promise<string[]> => { if (!user || images.length === 0) return []; const uploadedUrls: string[] = []; for (const image of images) { const fileExt = image.name.split('.').pop(); const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`; const { error } = await supabase.storage.from('products').upload(fileName, image); if (error) throw error; const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName); uploadedUrls.push(publicUrl); } return uploadedUrls; };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/auth'); return; }
    const priceNum = parseFloat(String(formData.price).replace(',', '.'));
    if (!formData.title.trim()) { toast({ title: 'Falta el título', description: 'Indica qué estás vendiendo', variant: 'destructive' }); return; }
    if (!formData.price || isNaN(priceNum) || priceNum < 0) { toast({ title: 'Precio inválido', description: 'Introduce un precio válido', variant: 'destructive' }); return; }
    if (images.length === 0) { toast({ title: 'Añade al menos una foto', description: 'Los productos con fotos se venden antes', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const uploadedImages = await uploadImages();
      const geocodedLocation = await geocodeTypedLocation();
      const { error } = await supabase.from('products').insert({ user_id: user.id, title: formData.title.trim(), description: formData.description?.trim() || null, price: priceNum, category_id: formData.category_id || null, subcategory_id: formData.subcategory_id || null, condition: formData.condition || null, location: formData.location?.trim() || null, latitude: geocodedLocation?.latitude ?? null, longitude: geocodedLocation?.longitude ?? null, images: uploadedImages, status: 'active' });
      if (error) throw error;
      toast({ title: '¡Producto publicado!', description: geocodedLocation ? 'Tu producto está disponible y aparecerá en búsquedas cerca de ti.' : 'Tu producto está disponible. Añade una ciudad válida para mejorar la búsqueda cercana.' });
      navigate('/profile');
    } catch (error: any) { toast({ title: 'No se pudo publicar', description: error?.message || 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <>
      <Helmet><title>Subir Producto | Reveta</title><meta name="description" content="Publica tu producto en Reveta y empieza a vender" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background"><Header /><main className="flex-1 container py-8"><Card className="max-w-2xl mx-auto border-border/50"><CardHeader><CardTitle className="flex items-center gap-2"><UploadIcon className="h-5 w-5" />Subir producto</CardTitle><CardDescription>Añade fotos y detalles de lo que quieres vender</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4"><Label>Fotos del producto (máx. 5)</Label><div className="grid grid-cols-3 sm:grid-cols-5 gap-4">{imageUrls.map((url, index) => <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border"><img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" /><button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"><X className="h-4 w-4" /></button></div>)}{images.length < 5 && <><label className="aspect-square w-full rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"><ImagePlus className="h-6 w-6" /><span className="text-xs">Galería</span><input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" /></label><label className="aspect-square w-full rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"><UploadIcon className="h-6 w-6" /><span className="text-xs">Cámara</span><input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" /></label></>}</div></div>
        <div className="space-y-2"><Label htmlFor="title">Título *</Label><Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="¿Qué vendes?" maxLength={100} /></div>
        <div className="space-y-2"><Label htmlFor="description">Descripción</Label><Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe el producto, su estado, características..." rows={4} /></div>
        {autoDetectedLabel && !categoryTouched && <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary"><Sparkles className="h-4 w-4" /><span>Categoría detectada automáticamente: <strong>{autoDetectedLabel}</strong></span></div>}
        <div className="space-y-2"><Label htmlFor="price">Precio *</Label><div className="relative"><Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="price" type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" className="pl-10" /></div></div>
        <div className="space-y-4"><div className="space-y-2"><Label>Categoría</Label><Select value={formData.category_id} onValueChange={(value) => { setCategoryTouched(true); setAutoDetectedLabel(''); setFormData({ ...formData, category_id: value, subcategory_id: '' }); }}><SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger><SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent></Select></div>{formData.category_id && subcategories.length > 0 && <div className="space-y-2 animate-fade-in"><Label className="flex items-center gap-1 text-sm"><ChevronRight className="h-3 w-3 text-muted-foreground" />Subcategoría</Label><Select value={formData.subcategory_id} onValueChange={(value) => { setCategoryTouched(true); setAutoDetectedLabel(''); setFormData({ ...formData, subcategory_id: value }); }} disabled={loadingSubcategories}><SelectTrigger><SelectValue placeholder={loadingSubcategories ? 'Cargando...' : 'Selecciona subcategoría'} /></SelectTrigger><SelectContent>{subcategories.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}</SelectContent></Select></div>}</div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Estado</Label><Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value })}><SelectTrigger><SelectValue placeholder="Estado del producto" /></SelectTrigger><SelectContent>{Object.entries(conditionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-3"><Label htmlFor="location">Ubicación</Label><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value, latitude: null, longitude: null })} placeholder="Ciudad" className="pl-10" /></div><p className="text-xs text-muted-foreground">Si escribes una ciudad, Reveta intentará convertirla automáticamente en coordenadas para búsquedas cercanas.</p><Button type="button" variant={useCurrentLocation && geolocation.hasLocation ? 'default' : 'outline'} size="sm" className="gap-2" onClick={() => { if (!useCurrentLocation) { setUseCurrentLocation(true); geolocation.requestLocation(); } else { setUseCurrentLocation(false); setFormData(prev => ({ ...prev, location: '', latitude: null, longitude: null })); } }} disabled={geolocation.loading}>{geolocation.loading ? <><div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Obteniendo...</> : useCurrentLocation && geolocation.hasLocation ? <><Locate className="h-4 w-4" />Ubicación detectada</> : <><Navigation className="h-4 w-4" />Usar mi ubicación actual</>}</Button>{useCurrentLocation && geolocation.error && <p className="text-sm text-destructive">{geolocation.error}</p>}{useCurrentLocation && geolocation.hasLocation && <p className="text-sm text-muted-foreground">Tu producto aparecerá en búsquedas por ubicación cercana</p>}</div></div>
        <div className="flex gap-4"><Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">Cancelar</Button><Button type="submit" className="flex-1 gradient-hero" disabled={uploading}>{uploading ? 'Subiendo...' : 'Publicar producto'}</Button></div>
      </form></CardContent></Card></main><Footer /></div>
    </>
  );
};

export default Upload;
