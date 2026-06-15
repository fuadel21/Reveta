import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerRatingProps {
  sellerId: string;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
}

const SellerRating = ({ sellerId, showCount = true, size = 'md' }: SellerRatingProps) => {
  const [stats, setStats] = useState<ReviewStats>({ averageRating: 0, totalReviews: 0 });

  useEffect(() => {
    fetchReviewStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const fetchReviewStats = async () => {
    if (!sellerId) return;

    const { data, error } = await (supabase as any)
      .from('reviews')
      .select('rating')
      .eq('reviewed_id', sellerId);

    if (error) {
      console.error('Error fetching seller rating:', error);
      setStats({ averageRating: 0, totalReviews: 0 });
      return;
    }

    const total = data?.length || 0;
    const avg = total > 0 ? data.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) / total : 0;
    setStats({ averageRating: avg, totalReviews: total });
  };

  const iconSize = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };
  const textSize = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

  if (stats.totalReviews === 0) {
    return <span className={cn('text-muted-foreground', textSize[size])}>Sin valoraciones</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              iconSize[size],
              star <= Math.round(stats.averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground',
            )}
          />
        ))}
      </div>
      <span className={cn('font-medium', textSize[size])}>{stats.averageRating.toFixed(1)}</span>
      {showCount && <span className={cn('text-muted-foreground', textSize[size])}>({stats.totalReviews})</span>}
    </div>
  );
};

export default SellerRating;
