import { useMemo, useState } from 'react';
import { ImagePlus, Loader2, Sparkles, WandSparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface Category { id: string; name: string; }
interface Subcategory { id: string; category_id: string; name: string; }
interface ListingFormData {
  title: string;
  description: string;
  price: string;
  category_id: string;
  subcategory_id: string;
  condition: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
}

interface AIResult {
  title?: string;
  description?: string;
  category_name?: string;
  subcategory_name?: string;
  condition?: string;
  suggested_price?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  tags?: string[];
  photo_tips?: string[];
  warnings?: string[];
  confidence?: number;
}

interface Props {
  images: File[];
  categories: Category[];
  subcategories: Subcategory[];
  formData: ListingFormData;
  onApply: (next: Partial<ListingFormData>) => void;
  onAddGeneratedImage: (file: File) => void;
  maxImagesReached: boolean;
}

const normalize = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const resizeImage = (file: File, maxDimension = 1280, quality = 0.82): Promise<string> => new Promise((resolve, reject) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo preparar la imagen'));
      return;
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);
    resolve(canvas.toDataURL('image/jpeg', quality));
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('No se pudo leer la imagen'));
  };
  image.src = objectUrl;
});

const dataUrlToFile = (dataUrl: string) => {
  const [header, encoded] = dataUrl.split(',');
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], `reveta-ia-${crypto.randomUUID()}.png`, { type: mimeType });
};

const AIListingAssistant = ({ images, categories, subcategories, formData, onApply, onAddGeneratedImage, maxImagesReached }: Props) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  const categoryPayload = useMemo(() => categories.map((category) => ({
    name: category.name,
    subcategories: subcategories.filter((subcategory) => subcategory.category_id === category.id).map((subcategory) => ({ name: subcategory.name })),
  })), [categories, subcategories]);

  const prepareImages = async (limit = 3) => Promise.all(images.slice(0, limit).map((file) => resizeImage(file)));

  const analyze = async () => {
    if (images.length === 0) {
      toast({ title: 'Añade una foto primero', description: 'La IA necesita ver el producto para ayudarte.', variant: 'destructive' });
      return;
    }
    setAnalyzing(true);
    try {
      const imageData = await prepareImages(3);
      const { data, error } = await supabase.functions.invoke('ai-listing-assistant', {
        body: {
          action: 'analyze',
          images: imageData,
          categories: categoryPayload,
          notes,
          current: {
            title: formData.title,
            description: formData.description,
            price: formData.price,
            condition: formData.condition,
            location: formData.location,
          },
        },
      });
      if (error) throw error;
      if (!data?.result) throw new Error(data?.error || 'La IA no devolvió una propuesta');
      const suggestion = data.result as AIResult;
      setResult(suggestion);

      const category = categories.find((item) => normalize(item.name) === normalize(suggestion.category_name || ''));
      const availableSubcategories = category ? subcategories.filter((item) => item.category_id === category.id) : [];
      const subcategory = availableSubcategories.find((item) => normalize(item.name) === normalize(suggestion.subcategory_name || ''));
      const validCondition = ['new', 'like_new', 'good', 'fair', 'poor'].includes(suggestion.condition || '') ? suggestion.condition : '';
      const suggestedPrice = Number(suggestion.suggested_price);

      onApply({
        title: suggestion.title?.slice(0, 100) || formData.title,
        description: suggestion.description?.slice(0, 2000) || formData.description,
        category_id: category?.id || formData.category_id,
        subcategory_id: subcategory?.id || '',
        condition: validCondition || formData.condition,
        price: Number.isFinite(suggestedPrice) && suggestedPrice > 0 ? String(Math.round(suggestedPrice * 100) / 100) : formData.price,
      });
      toast({ title: 'Propuesta aplicada', description: 'Revisa los datos antes de publicar. La IA puede equivocarse.' });
    } catch (error: any) {
      console.error('AI listing analysis error:', error);
      toast({ title: 'No se pudo completar con IA', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const enhanceImage = async () => {
    if (images.length === 0) {
      toast({ title: 'Añade una foto primero', variant: 'destructive' });
      return;
    }
    if (maxImagesReached) {
      toast({ title: 'Ya tienes el máximo de fotos', description: 'Elimina una foto antes de crear la versión mejorada.', variant: 'destructive' });
      return;
    }
    setEnhancing(true);
    try {
      const [image] = await prepareImages(1);
      const { data, error } = await supabase.functions.invoke('ai-listing-assistant', {
        body: { action: 'enhance-image', images: [image], title: formData.title, notes },
      });
      if (error) throw error;
      if (!data?.image) throw new Error(data?.error || 'La IA no devolvió ninguna imagen');
      onAddGeneratedImage(dataUrlToFile(data.image));
      toast({ title: 'Foto mejorada añadida', description: 'La hemos colocado como principal. Comprueba que representa fielmente el producto.' });
    } catch (error: any) {
      console.error('AI image enhancement error:', error);
      toast({ title: 'No se pudo mejorar la foto', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Asistente IA para publicar</CardTitle>
        <CardDescription>Sube fotos reales y deja que la IA prepare una propuesta. Tú siempre decides qué se publica.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={800} rows={3} placeholder="Opcional: marca, modelo, antigüedad, accesorios, defectos o cualquier dato que la foto no muestre." />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={analyze} disabled={analyzing || enhancing || images.length === 0} className="flex-1">
            {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
            {analyzing ? 'Analizando producto...' : 'Completar anuncio con IA'}
          </Button>
          <Button type="button" variant="outline" onClick={enhanceImage} disabled={enhancing || analyzing || images.length === 0 || maxImagesReached} className="flex-1">
            {enhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {enhancing ? 'Creando foto...' : 'Crear foto principal limpia'}
          </Button>
        </div>

        {result && (
          <div className="space-y-3 rounded-xl border bg-background p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>Resultado de la IA</strong>
              <Badge variant="secondary">Confianza: {Math.max(0, Math.min(100, Number(result.confidence) || 0))}%</Badge>
            </div>
            {(result.price_min || result.price_max) && <p className="text-muted-foreground">Precio orientativo: {result.price_min || '—'} € – {result.price_max || '—'} €</p>}
            {!!result.tags?.length && <div className="flex flex-wrap gap-2">{result.tags.slice(0, 6).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>}
            {!!result.photo_tips?.length && <div><p className="font-medium">Fotos que convendría añadir</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{result.photo_tips.slice(0, 3).map((tip) => <li key={tip}>{tip}</li>)}</ul></div>}
            {!!result.warnings?.length && <Alert><AlertDescription><strong>Comprueba antes de publicar:</strong> {result.warnings.slice(0, 4).join(' · ')}</AlertDescription></Alert>}
          </div>
        )}

        <p className="text-xs text-muted-foreground">La IA no debe inventar características ni ocultar defectos. Las fotos generadas o mejoradas tienen que representar el producto real.</p>
      </CardContent>
    </Card>
  );
};

export default AIListingAssistant;
