import { useRef } from 'react';
import { ArrowLeft, ArrowRight, Camera, Images, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  isValidListingImage,
  MAX_LISTING_IMAGES,
  type ListingImage,
} from '@/lib/listingEditor';

type Props = {
  images: ListingImage[];
  onChange: (images: ListingImage[]) => void;
  disabled?: boolean;
};

export const ListingImageManager = ({ images, onChange, disabled = false }: Props) => {
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const addFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    const remaining = Math.max(0, MAX_LISTING_IMAGES - images.length);
    if (remaining === 0) {
      toast({ title: 'Límite de fotos alcanzado', description: `Puedes añadir hasta ${MAX_LISTING_IMAGES} imágenes.`, variant: 'destructive' });
      return;
    }

    const valid = selected.filter(isValidListingImage);
    const accepted = valid.slice(0, remaining);
    const invalidCount = selected.length - valid.length;
    const ignoredCount = Math.max(0, valid.length - accepted.length);

    if (invalidCount > 0) {
      toast({ title: 'Algunas fotos no se añadieron', description: 'Solo se permiten JPG, PNG o WEBP de hasta 5 MB.', variant: 'destructive' });
    }
    if (ignoredCount > 0) {
      toast({ title: 'Se alcanzó el límite', description: `Se añadieron ${accepted.length} fotos y se ignoraron ${ignoredCount}.` });
    }
    if (accepted.length === 0) return;

    onChange([
      ...images,
      ...accepted.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), original: false })),
    ]);
  };

  const remove = (index: number) => {
    const target = images[index];
    if (!target || disabled) return;
    if (!target.original) URL.revokeObjectURL(target.url);
    onChange(images.filter((_, currentIndex) => currentIndex !== index));
  };

  const move = (index: number, direction: -1 | 1) => {
    if (disabled) return;
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Fotografías</h2>
          <p className="text-xs text-muted-foreground">La primera foto será la imagen principal.</p>
        </div>
        <Badge variant="secondary">{images.length}/{MAX_LISTING_IMAGES}</Badge>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {images.map((image, index) => (
            <div key={image.id} className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
              <img src={image.url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
              {index === 0 && <Badge className="absolute left-1 top-1"><Star className="mr-1 h-3 w-3" />Principal</Badge>}
              <button type="button" disabled={disabled} onClick={() => remove(index)} aria-label={`Eliminar foto ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-destructive p-1.5 text-white disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
              <div className="absolute bottom-1 left-1 right-1 flex justify-between">
                <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label="Mover foto a la izquierda" className="rounded-full bg-black/65 p-1.5 text-white disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={disabled || index === images.length - 1} onClick={() => move(index, 1)} aria-label="Mover foto a la derecha" className="rounded-full bg-black/65 p-1.5 text-white disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length < MAX_LISTING_IMAGES && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => cameraRef.current?.click()}><Camera className="mr-2 h-4 w-4" />Abrir cámara</Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => galleryRef.current?.click()}><Images className="mr-2 h-4 w-4" />Elegir de galería</Button>
          <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={addFiles} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={addFiles} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">JPG, PNG o WEBP de hasta 5 MB. Se guardan como máximo cinco fotos.</p>
    </section>
  );
};

export default ListingImageManager;
