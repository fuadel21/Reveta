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

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
}

interface GeocodedLocation {
  latitude: number;
  longitude: number;
  displayName?: string;
}

interface DetectionRule {
  keywords: string[];
  categoryHints: string[];
  subcategoryHints?: string[];
  score: number;
}

const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación'
};

const DETECTION_RULES: DetectionRule[] = [
  { keywords: ['iphone', 'samsung', 'xiaomi', 'huawei', 'oppo', 'movil', 'moviles', 'móvil', 'móviles', 'telefono', 'teléfono', 'smartphone'], categoryHints: ['electronica', 'tecnologia', 'informatica'], subcategoryHints: ['movil', 'moviles', 'telefono', 'telefonos', 'smartphone'], score: 18 },
  { keywords: ['portatil', 'portátil', 'macbook', 'ordenador', 'pc', 'imac', 'laptop'], categoryHints: ['electronica', 'tecnologia', 'informatica'], subcategoryHints: ['ordenador', 'ordenadores', 'portatil', 'portatiles', 'informatica'], score: 18 },
  { keywords: ['tablet', 'ipad'], categoryHints: ['electronica', 'tecnologia', 'informatica'], subcategoryHints: ['tablet', 'tablets', 'ipad'], score: 18 },
  { keywords: ['playstation', 'ps4', 'ps5', 'xbox', 'nintendo', 'switch', 'consola', 'videojuego', 'videojuegos'], categoryHints: ['electronica', 'tecnologia', 'juegos', 'gaming'], subcategoryHints: ['consola', 'consolas', 'videojuego', 'videojuegos', 'gaming'], score: 18 },
  { keywords: ['auriculares', 'airpods', 'altavoz', 'bluetooth', 'sonos', 'jbl', 'cascos'], categoryHints: ['electronica', 'tecnologia', 'sonido'], subcategoryHints: ['audio', 'sonido', 'auriculares', 'altavoces'], score: 16 },
  { keywords: ['camara', 'cámara', 'canon', 'nikon', 'sony alpha', 'objetivo', 'gopro'], categoryHints: ['electronica', 'fotografia', 'tecnologia'], subcategoryHints: ['camara', 'camaras', 'fotografia', 'objetivos'], score: 16 },

  { keywords: ['coche', 'auto', 'vehiculo', 'vehículo', 'seat', 'renault', 'bmw', 'audi', 'mercedes', 'ford', 'toyota'], categoryHints: ['motor', 'coches', 'vehiculos'], subcategoryHints: ['coche', 'coches', 'vehiculo', 'vehiculos'], score: 18 },
  { keywords: ['moto', 'scooter', 'yamaha', 'honda', 'kawasaki', 'vespa'], categoryHints: ['motor', 'motos', 'vehiculos'], subcategoryHints: ['moto', 'motos', 'scooter'], score: 18 },
  { keywords: ['bicicleta', 'bici', 'mtb', 'mountain bike', 'patinete', 'patinete electrico', 'patinete eléctrico'], categoryHints: ['deporte', 'motor', 'bicicletas'], subcategoryHints: ['bicicleta', 'bicicletas', 'patinete', 'patinetes'], score: 16 },

  { keywords: ['sofa', 'sofá', 'mesa', 'silla', 'armario', 'estanteria', 'estantería', 'cama', 'colchon', 'colchón', 'mueble', 'muebles'], categoryHints: ['hogar', 'casa', 'muebles'], subcategoryHints: ['mueble', 'muebles', 'sofas', 'sofás', 'mesas', 'sillas', 'camas'], score: 18 },
  { keywords: ['nevera', 'frigorifico', 'frigorífico', 'lavadora', 'secadora', 'horno', 'microondas', 'cafetera', 'aspiradora'], categoryHints: ['hogar', 'electrodomesticos', 'casa'], subcategoryHints: ['electrodomestico', 'electrodomesticos', 'cocina'], score: 18 },
  { keywords: ['decoracion', 'decoración', 'lampara', 'lámpara', 'cuadro', 'alfombra', 'espejo'], categoryHints: ['hogar', 'decoracion', 'casa'], subcategoryHints: ['decoracion', 'decoración'], score: 14 },

  { keywords: ['pantalon', 'pantalón', 'jeans', 'vaquero', 'camisa', 'camiseta', 'chaqueta', 'abrigo', 'vestido', 'falda', 'jersey'], categoryHints: ['moda', 'ropa', 'fashion'], subcategoryHints: ['ropa', 'hombre', 'mujer', 'camisetas', 'pantalones', 'vestidos'], score: 18 },
  { keywords: ['zapatos', 'zapatillas', 'botas', 'nike', 'adidas', 'new balance', 'sandalias'], categoryHints: ['moda', 'ropa', 'fashion'], subcategoryHints: ['calzado', 'zapatos', 'zapatillas'], score: 18 },
  { keywords: ['bolso', 'mochila', 'cartera', 'reloj', 'gafas', 'collar', 'pulsera', 'anillo'], categoryHints: ['moda', 'complementos', 'accesorios'], subcategoryHints: ['accesorios', 'complementos', 'bolsos', 'joyas'], score: 16 },

  { keywords: ['libro', 'novela', 'comic', 'cómic', 'manga', 'enciclopedia'], categoryHints: ['libros', 'ocio', 'cultura'], subcategoryHints: ['libros', 'comics', 'cómics', 'manga'], score: 18 },
  { keywords: ['guitarra', 'piano', 'teclado', 'bateria', 'batería', 'violin', 'violín', 'microfono', 'micrófono'], categoryHints: ['musica', 'música', 'ocio'], subcategoryHints: ['instrumentos', 'musica', 'música'], score: 18 },
  { keywords: ['juguete', 'lego', 'muñeca', 'muneca', 'peluche', 'playmobil'], categoryHints: ['niños', 'ninos', 'juguetes', 'infantil'], subcategoryHints: ['juguetes', 'niños', 'ninos'], score: 18 },
  { keywords: ['carrito bebe', 'carrito bebé', 'silla bebe', 'silla bebé', 'cuna', 'maxicosi', 'trona'], categoryHints: ['niños', 'ninos', 'bebe', 'bebé', 'infantil'], subcategoryHints: ['bebe', 'bebé', 'infantil'], score: 18 },

  { keywords: ['raqueta', 'pesa', 'pesas', 'mancuerna', 'fitness', 'gym', 'gimnasio', 'balon', 'balón', 'ski', 'snowboard', 'surf'], categoryHints: ['deporte', 'deportes', 'fitness'], subcategoryHints: ['fitness', 'deporte', 'deportes'], score: 16 },
  { keywords: ['perro', 'gato', 'transportin', 'transportín', 'acuario', 'jaula', 'mascota', 'mascotas'], categoryHints: ['mascotas', 'animales'], subcategoryHints: ['perros', 'gatos', 'mascotas'], score: 18 },
  { keywords: ['herramienta', 'taladro', 'sierra', 'destornillador', 'bricolaje', 'jardin', 'jardín'], categoryHints: ['herramientas', 'bricolaje', 'jardin', 'jardín'], subcategoryHints: ['herramientas', 'bricolaje', 'jardin', 'jardín'], score: 18 },
];

const normalizeText = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9ñ\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

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
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    subcategory_id: '',
    condition: '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchCategories();
    fetchAllSubcategories();
  }, []);

  useEffect(() => {
    if (formData.category_id) {
      fetchSubcategories(formData.category_id);
    } else {
      setSubcategories([]);
      setFormData(prev => ({ ...prev, subcategory_id: '' }));
    }
  }, [formData.category_id]);

  useEffect(() => {
    if (useCurrentLocation && geolocation.latitude && geolocation.longitude) {
      reverseGeocode(geolocation.latitude, geolocation.longitude);
    }
  }, [useCurrentLocation, geolocation.latitude, geolocation.longitude]);

  useEffect(() => {
    if (categoryTouched || categories.length === 0 || allSubcategories.length === 0) return;

    const timer = window.setTimeout(() => {
      const detected = detectCategoryFromText();
      if (!detected || detected.score < 12) return;

      setFormData(prev => {
        if (prev.category_id === detected.categoryId && prev.subcategory_id === detected.subcategoryId) return prev;
        return {
          ...prev,
          category_id: detected.categoryId,
          subcategory_id: detected.subcategoryId || '',
        };
      });
      setAutoDetectedLabel(detected.label);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [formData.title, formData.description, categories, allSubcategories, categoryTouched]);

  const detectCategoryFromText = () => {
    const text = normalizeText(`${formData.title} ${formData.description}`);
    if (text.length < 4) return null;

    let bestMatch: { categoryId: string; subcategoryId: string; score: number; label: string } | null = null;

    for (const category of categories) {
      const categoryName = normalizeText(category.name);
      const categorySubcategories = allSubcategories.filter(sub => sub.category_id === category.id);
      let categoryScore = 0;

      if (categoryName.length >= 4 && containsTerm(text, categoryName)) {
        categoryScore += 20;
      }

      for (const rule of DETECTION_RULES) {
        const hasKeyword = rule.keywords.some(keyword => containsTerm(text, keyword));
        if (!hasKeyword) continue;

        const categoryMatches = rule.categoryHints.some(hint => containsTerm(categoryName, hint));
        if (categoryMatches) categoryScore += rule.score;
      }

      if (categoryScore > 0) {
        const categoryCandidate = {
          categoryId: category.id,
          subcategoryId: '',
          score: categoryScore,
          label: category.name,
        };
        if (!bestMatch || categoryCandidate.score > bestMatch.score) bestMatch = categoryCandidate;
      }

      for (const subcategory of categorySubcategories) {
        const subcategoryName = normalizeText(subcategory.name);
        let subcategoryScore = categoryScore;

        if (subcategoryName.length >= 4 && containsTerm(text, subcategoryName)) {
          subcategoryScore += 25;
        }

        for (const rule of DETECTION_RULES) {
          const hasKeyword = rule.keywords.some(keyword => containsTerm(text, keyword));
          if (!hasKeyword) continue;

          const categoryMatches = rule.categoryHints.some(hint => containsTerm(categoryName, hint));
          const subcategoryMatches = rule.subcategoryHints?.some(hint => containsTerm(subcategoryName, hint)) || false;

          if (subcategoryMatches) subcategoryScore += rule.score + 10;
          else if (categoryMatches) subcategoryScore += Math.floor(rule.score / 2);
        }

        if (subcategoryScore > 0 && (!bestMatch || subcategoryScore > bestMatch.score)) {
          bestMatch = {
            categoryId: category.id,
            subcategoryId: subcategory.id,
            score: subcategoryScore,
            label: `${category.name}${subcategory.name ? ` · ${subcategory.name}` : ''}`,
          };
        }
      }
    }

    return bestMatch;
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
      const data = await response.json();
      
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.state;
        if (city) {
          setFormData(prev => ({ ...prev, location: city, latitude: lat, longitude: lon }));
          toast({
            title: 'Ubicación detectada',
            description: `Te encuentras en ${city}`
          });
        }
      }
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
    }
  };

  const geocodeTypedLocation = async (): Promise<GeocodedLocation | null> => {
    const typedLocation = formData.location.trim();

    if (useCurrentLocation && geolocation.latitude && geolocation.longitude) {
      return {
        latitude: geolocation.latitude,
        longitude: geolocation.longitude,
        displayName: typedLocation || undefined,
      };
    }

    if (!typedLocation) return null;

    try {
      const { data, error } = await supabase.functions.invoke('geocode-location', {
        body: { location: typedLocation },
      });

      if (error || !data?.latitude || !data?.longitude) {
        console.warn('No se pudo geocodificar la ubicación:', error || data);
        return null;
      }

      return {
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        displayName: data.displayName || typedLocation,
      };
    } catch (error) {
      console.warn('Error geocoding typed location:', error);
      return null;
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
  };

  const fetchAllSubcategories = async () => {
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching all subcategories:', error);
      setAllSubcategories([]);
    } else {
      setAllSubcategories(data || []);
    }
  };

  const fetchSubcategories = async (categoryId: string) => {
    setLoadingSubcategories(true);
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('category_id', categoryId)
      .order('name');
    
    if (error) {
      console.error('Error fetching subcategories:', error);
      setSubcategories([]);
    } else {
      setSubcategories(data || []);
    }
    setLoadingSubcategories(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      toast({ title: 'Límite de imágenes', description: 'Solo puedes subir un máximo de 5 imágenes', variant: 'destructive' });
      return;
    }
    
    const newImages = [...images, ...files];
    setImages(newImages);
    const newUrls = files.map(file => URL.createObjectURL(file));
    setImageUrls([...imageUrls, ...newUrls]);
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newUrls = imageUrls.filter((_, i) => i !== index);
    setImages(newImages);
    setImageUrls(newUrls);
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!user || images.length === 0) return [];
    const uploadedUrls: string[] = [];
    
    for (const image of images) {
      const fileExt = image.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(fileName, image);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
      uploadedUrls.push(publicUrl);
    }
    
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    const priceNum = parseFloat(String(formData.price).replace(',', '.'));
    
    if (!formData.title.trim()) {
      toast({ title: 'Falta el título', description: 'Indica qué estás vendiendo', variant: 'destructive' });
      return;
    }
    if (!formData.price || isNaN(priceNum) || priceNum < 0) {
      toast({ title: 'Precio inválido', description: 'Introduce un precio válido', variant: 'destructive' });
      return;
    }
    if (images.length === 0) {
      toast({ title: 'Añade al menos una foto', description: 'Los productos con fotos se venden antes', variant: 'destructive' });
      return;
    }
    
    setUploading(true);
    
    try {
      const uploadedImages = await uploadImages();
      const geocodedLocation = await geocodeTypedLocation();
      const cleanLocation = formData.location?.trim() || null;
      
      const { error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          price: priceNum,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
          condition: formData.condition || null,
          location: cleanLocation,
          latitude: geocodedLocation?.latitude ?? null,
          longitude: geocodedLocation?.longitude ?? null,
          images: uploadedImages,
          status: 'active'
        });
      
      if (error) throw error;
      
      toast({
        title: '¡Producto publicado!',
        description: geocodedLocation
          ? 'Tu producto está disponible y aparecerá en búsquedas cerca de ti.'
          : 'Tu producto está disponible. Añade una ciudad válida para mejorar la búsqueda cercana.'
      });
      
      navigate('/profile');
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast({ title: 'No se pudo publicar', description: error?.message || 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <>
      <Helmet>
        <title>Subir Producto | Reveta</title>
        <meta name="description" content="Publica tu producto en Reveta y empieza a vender" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <Card className="max-w-2xl mx-auto border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UploadIcon className="h-5 w-5" />Subir producto</CardTitle>
              <CardDescription>Añade fotos y detalles de lo que quieres vender</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <Label>Fotos del producto (máx. 5)</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                    {imageUrls.map((url, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    {images.length < 5 && (
                      <>
                        <label className="aspect-square w-full rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                          <ImagePlus className="h-6 w-6" /><span className="text-xs">Galería</span>
                          <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                        </label>
                        <label className="aspect-square w-full rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                          <UploadIcon className="h-6 w-6" /><span className="text-xs">Cámara</span>
                          <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="¿Qué vendes?" maxLength={100} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe el producto, su estado, características..." rows={4} />
                </div>

                {autoDetectedLabel && !categoryTouched && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span>Categoría detectada automáticamente: <strong>{autoDetectedLabel}</strong></span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="price">Precio *</Label>
                  <div className="relative"><Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="price" type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" className="pl-10" /></div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={formData.category_id} onValueChange={(value) => { setCategoryTouched(true); setAutoDetectedLabel(''); setFormData({ ...formData, category_id: value, subcategory_id: '' }); }}>
                      <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                      <SelectContent>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {formData.category_id && subcategories.length > 0 && (
                    <div className="space-y-2 animate-fade-in">
                      <Label className="flex items-center gap-1 text-sm"><ChevronRight className="h-3 w-3 text-muted-foreground" />Subcategoría</Label>
                      <Select value={formData.subcategory_id} onValueChange={(value) => { setCategoryTouched(true); setAutoDetectedLabel(''); setFormData({ ...formData, subcategory_id: value }); }} disabled={loadingSubcategories}>
                        <SelectTrigger><SelectValue placeholder={loadingSubcategories ? 'Cargando...' : 'Selecciona subcategoría'} /></SelectTrigger>
                        <SelectContent>{subcategories.map((sub) => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value })}>
                      <SelectTrigger><SelectValue placeholder="Estado del producto" /></SelectTrigger>
                      <SelectContent>{Object.entries(conditionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="location">Ubicación</Label>
                    <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value, latitude: null, longitude: null })} placeholder="Ciudad" className="pl-10" /></div>
                    <p className="text-xs text-muted-foreground">Si escribes una ciudad, Reveta intentará convertirla automáticamente en coordenadas para búsquedas cercanas.</p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant={useCurrentLocation && geolocation.hasLocation ? 'default' : 'outline'} size="sm" className="gap-2" onClick={() => { if (!useCurrentLocation) { setUseCurrentLocation(true); geolocation.requestLocation(); } else { setUseCurrentLocation(false); setFormData(prev => ({ ...prev, location: '', latitude: null, longitude: null })); } }} disabled={geolocation.loading}>
                        {geolocation.loading ? <><div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Obteniendo...</> : useCurrentLocation && geolocation.hasLocation ? <><Locate className="h-4 w-4" />Ubicación detectada</> : <><Navigation className="h-4 w-4" />Usar mi ubicación actual</>}
                      </Button>
                    </div>
                    {useCurrentLocation && geolocation.error && <p className="text-sm text-destructive">{geolocation.error}</p>}
                    {useCurrentLocation && geolocation.hasLocation && <p className="text-sm text-muted-foreground">Tu producto aparecerá en búsquedas por ubicación cercana</p>}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">Cancelar</Button>
                  <Button type="submit" className="flex-1 gradient-hero" disabled={uploading}>{uploading ? 'Subiendo...' : 'Publicar producto'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Upload;
