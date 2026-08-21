import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';

interface ReviewFormProps {
  transactionId: string;
  onSubmitted?: () => void;
}

export default function ReviewForm({ transactionId, onSubmitted }: ReviewFormProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (rating < 1 || rating > 5 || saving) return;
    setSaving(true);
    const { error } = await supabaseUntyped.rpc('submit_transaction_review', {
      p_transaction_id: transactionId,
      p_rating: rating,
      p_review: review.trim() || null,
    });

    if (error) {
      toast({
        title: 'No se pudo guardar la valoración',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Valoración guardada', description: 'Gracias por ayudar a construir una comunidad más segura.' });
      onSubmitted?.();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <Label>¿Cómo fue la operación?</Label>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Valoración de 1 a 5 estrellas">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
            >
              <Star className={`h-7 w-7 ${value <= rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`review-${transactionId}`}>Comentario (opcional)</Label>
        <Textarea
          id={`review-${transactionId}`}
          value={review}
          maxLength={1000}
          rows={4}
          placeholder="Cuéntanos brevemente cómo fue la experiencia..."
          onChange={(event) => setReview(event.target.value)}
        />
        <p className="text-xs text-muted-foreground text-right">{review.length}/1000</p>
      </div>

      <Button type="button" disabled={rating === 0 || saving} onClick={() => void submit()}>
        {saving ? 'Guardando...' : 'Publicar valoración'}
      </Button>
    </div>
  );
}
