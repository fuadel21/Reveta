import { useMemo, useState } from 'react';
import { Loader2, Sparkles, WandSparkles } from 'lucide-react';
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

const AIListingAssistant = ({ images, categories, subcategories, formData, onApply }: Props) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  const categoryPayload = useMemo(() => categories.map((category) => ({
    name: category.name,
    subcategories: subcategories.filter((subcategory) => subcategory.category_id === category.id).map((subcategory) => ({ name: subcategory.name })),
  })), [categories, subcategories]);

  const analyze = async () => {
    if (images.length === 0) {
      toast({ title: 'Añade una foto primero', description: 'Groq necesita ver el producto para ayudarte.', variant: 'destructive' });
      return;
    }

    setAnalyzing(true);
    try {
      const imageData = await Promise.all(images.slice(0, 3).map((file) => resizeImage(file)));
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
      if (!data?.result) throw new Error(data?.error || 'Groq no devolvió una propuesta');
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

      toast({ title: 'Propuesta aplicada con Groq', description: 'Revisa los datos antes de publicar. La IA puede equivocarse.' });
    } catch (error: any) {
      console.error('Groq listing analysis error:', error);
      toast({ title: 'No se pudo completar con Groq', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Asistente gratuito con Groq</CardTitle>
        <CardDescription>Sube fotos reales y Groq preparará el título, la descripción y los datos principales del anuncio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={800} rows={3} placeholder="Opcional: marca, modelo, antigüedad, accesorios, defectos o cualquier dato que la foto no muestre." />
        <Button type="button" onClick={analyze} disabled={analyzing || images.length === 0} className="w-full">
          {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
          {analyzing ? 'Analizando producto...' : 'Completar anuncio con Groq'}
        </Button>

        {result && (
          <div className="space-y-3 rounded-xl border bg-background p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>Resultado de Groq</strong>
              <Badge variant="secondary">Confianza: {Math.max(0, Math.min(100, Number(result.confidence) || 0))}%</Badge>
            </div>
            {(result.price_min || result.price_max) && <p className="text-muted-foreground">Precio orientativo: {result.price_min || '—'} € – {result.price_max || '—'} €</p>}
            {!!result.tags?.length && <div className="flex flex-wrap gap-2">{result.tags.slice(0, 6).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>}
            {!!result.photo_tips?.length && <div><p className="font-medium">Fotos que convendría añadir</p><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{result.photo_tips.slice(0, 3).map((tip) => <li key={tip}>{tip}</li>)}</ul></div>}
            {!!result.warnings?.length && <Alert><AlertDescription><strong>Comprueba antes de publicar:</strong> {result.warnings.slice(0, 4).join(' · ')}</AlertDescription></Alert>}
          </div>
        )}

        <p className="text-xs text-muted-foreground">Groq analiza las fotos y genera texto, pero no crea ni modifica imágenes. Conservamos siempre las fotografías reales del vendedor.</p>
      </CardContent>
    </Card>
  );
};

export default AIListingAssistant;