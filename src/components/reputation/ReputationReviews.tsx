import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

type Review = {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
};

interface ReputationReviewsProps {
  userId: string;
  limit?: number;
}

export default function ReputationReviews({ userId, limit = 5 }: ReputationReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_reviews')
        .select('id, rating, review, created_at')
        .eq('reviewee_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (active) {
        if (error) console.error('Error loading reputation reviews:', error);
        setReviews((data || []) as Review[]);
        setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [userId, limit]);

  if (loading || reviews.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Opiniones recientes</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {reviews.map((item) => (
          <div key={item.id} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
            <div className="flex items-center gap-1" aria-label={`${item.rating} de 5 estrellas`}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Star key={value} className={`h-4 w-4 ${value <= item.rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString('es-ES')}</span>
            </div>
            {item.review && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{item.review}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
