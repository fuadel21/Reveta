import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface RecentReviewsProps {
  userId: string;
  limit?: number;
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

const RecentReviews = ({ userId, limit = 3 }: RecentReviewsProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!userId) return;
      setLoading(true);

      const { data, error } = await (supabase as any)
        .from('reviews')
        .select('id,rating,comment,created_at')
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error loading recent reviews:', error);
        setReviews([]);
      } else {
        setReviews(data || []);
      }

      setLoading(false);
    };

    fetchReviews();
  }, [userId, limit]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
        Cargando opiniones...
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="mb-2 text-lg font-semibold">Opiniones recientes</h2>
        <p className="text-sm text-muted-foreground">Este usuario todavía no tiene opiniones publicadas.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold">Opiniones recientes</h2>
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {review.comment || 'Valoración sin comentario.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentReviews;
