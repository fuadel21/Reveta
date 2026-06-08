import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewFormProps {
  sellerId: string;
  productId?: string;
  onReviewSubmitted?: () => void;
}

const ReviewForm = ({ sellerId, productId, onReviewSubmitted }: ReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (rating === 0) {
      toast({
        title: 'Selecciona una valoración',
        description: 'Debes dar al menos 1 estrella',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('reviews')
      .insert({
        reviewer_id: user.id,
        seller_id: sellerId,
        product_id: productId || null,
        rating,
        comment: comment.trim() || null
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar la valoración',
        variant: 'destructive'
      });
    } else {
      toast({
        title: '¡Valoración enviada!',
        description: 'Gracias por tu opinión'
      });
      setRating(0);
      setComment('');
      onReviewSubmitted?.();
    }

    setSubmitting(false);
  };

  if (!user || user.id === sellerId) {
    return null;
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
      <h4 className="font-medium">Deja tu valoración</h4>
      
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(star)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                star <= (hoverRating || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              )}
            />
          </button>
        ))}
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escribe un comentario sobre tu experiencia (opcional)"
        rows={3}
      />

      <Button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full"
      >
        {submitting ? 'Enviando...' : 'Enviar valoración'}
      </Button>
    </div>
  );
};

export default ReviewForm;
