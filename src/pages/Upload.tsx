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
import { Upload as UploadIcon, X, ImagePlus, MapPin, Euro, Navigation, Locate, ChevronRight } from 'lucide-react';

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

const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación'
};

const Upload = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const geolocation = useGeolocation();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
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
    longitude: null as number | null
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchCategories();
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
      toast({
        title: 'Límite de imágenes',
        description: 'Solo puedes subir un máximo de 5 imágenes',
        variant: 'destructive'
      });
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
      
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, image);
      
      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw uploadError;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);
      
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
      toast({
        title: 'No se pudo publicar',
        description: error?.message || 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
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
              <CardTitle className="flex items-center gap-2">
                <UploadIcon className="h-5 w-5" />
                Subir producto
              </CardTitle>
              <CardDescription>
                Añade fotos y detalles de lo que quieres vender
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <Label>Fotos del producto (máx. 5)</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                    {imageUrls.map((url, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    
                    {images.length < 5 && (
                      <>
                        <label className="aspect-square w-full rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                          <ImagePlus className="h-6 w-6" />
                          <span className="text-xs">Galería</span>
                          <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                        </label>
                        <label className="aspect-square w-full rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                          <UploadIcon className="h-6 w-6" />
                          <span className="text-xs">Cámara</span>
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
                
                <div className="space-y-2">
                  <Label htmlFor="price">Precio *</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="price" type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" className="pl-10" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value, subcategory_id: '' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.category_id && subcategories.length > 0 && (
                    <div className="space-y-2 animate-fade-in">
                      <Label className="flex items-center gap-1 text-sm">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        Subcategoría
                      </Label>
                      <Select value={formData.subcategory_id} onValueChange={(value) => setFormData({ ...formData, subcategory_id: value })} disabled={loadingSubcategories}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingSubcategories ? 'Cargando...' : 'Selecciona subcategoría'} />
                        </SelectTrigger>
                        <SelectContent>
                          {subcategories.map((sub) => (
                            <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Estado del producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(conditionLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="location">Ubicación</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value, latitude: null, longitude: null })} placeholder="Ciudad" className="pl-10" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Si escribes una ciudad, Reveta intentará convertirla automáticamente en coordenadas para búsquedas cercanas.
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={useCurrentLocation && geolocation.hasLocation ? 'default' : 'outline'}
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          if (!useCurrentLocation) {
                            setUseCurrentLocation(true);
                            geolocation.requestLocation();
                          } else {
                            setUseCurrentLocation(false);
                            setFormData(prev => ({ ...prev, location: '', latitude: null, longitude: null }));
                          }
                        }}
                        disabled={geolocation.loading}
                      >
                        {geolocation.loading ? (
                          <>
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Obteniendo...
                          </>
                        ) : useCurrentLocation && geolocation.hasLocation ? (
                          <>
                            <Locate className="h-4 w-4" />
                            Ubicación detectada
                          </>
                        ) : (
                          <>
                            <Navigation className="h-4 w-4" />
                            Usar mi ubicación actual
                          </>
                        )}
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
