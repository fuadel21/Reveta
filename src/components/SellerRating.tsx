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
  }, [sellerId]);

  const fetchReviewStats = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('seller_id', sellerId);

    if (!error && data) {
      const total = data.length;
      const avg = total > 0 
        ? data.reduce((sum, r) => sum + r.rating, 0) / total 
        : 0;
      setStats({ averageRating: avg, totalReviews: total });
    }
  };

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const textSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  if (stats.totalReviews === 0) {
    return (
      <span className={cn("text-muted-foreground", textSize[size])}>
        Sin valoraciones
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              iconSize[size],
              star <= Math.round(stats.averageRating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            )}
          />
        ))}
      </div>
      <span className={cn("font-medium", textSize[size])}>
        {stats.averageRating.toFixed(1)}
      </span>
      {showCount && (
        <span className={cn("text-muted-foreground", textSize[size])}>
          ({stats.totalReviews})
        </span>
      )}
    </div>
  );
};

export default SellerRating;
