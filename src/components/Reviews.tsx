import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Star, Send } from 'lucide-react';

interface Review {
  id: string;
  reviewer_id: string;
  reviewed_id: string;
  product_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

interface ReviewsProps {
  userId: string;
  productId?: string;
  onReviewSubmitted?: () => void;
}

export const Reviews: React.FC<ReviewsProps> = ({
  userId,
  productId,
  onReviewSubmitted,
}) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [averageRating, setAverageRating] = useState(0);

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:profiles!reviewer_id(id, full_name, avatar_url)
        `)
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        return;
      }

      setReviews(data || []);

      // Calculate average rating
      if (data && data.length > 0) {
        const avg =
          data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }

      // Check if current user has reviewed
      if (user) {
        const hasUserReviewed = data?.some(
          (r) => r.reviewer_id === user.id
        );
        setHasReviewed(!!hasUserReviewed);
      }
    };

    fetchReviews();
  }, [userId, user]);

  // Submit review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || user.id === userId) {
      alert('No puedes valorarte a ti mismo');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('reviews').insert({
      reviewer_id: user.id,
      reviewed_id: userId,
      product_id: productId || null,
      rating,
      comment,
    });

    if (error) {
      console.error('Error submitting review:', error);
      alert('Error al enviar la valoración');
    } else {
      setComment('');
      setRating(5);
      setHasReviewed(true);
      onReviewSubmitted?.();
      // Refresh reviews
      const { data } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:profiles!reviewer_id(id, full_name, avatar_url)
        `)
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false });

      if (data) {
        setReviews(data);
        const avg =
          data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Average Rating */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg border border-yellow-200">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">
              {averageRating.toFixed(1)}
            </div>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={16}
                  className={
                    i < Math.round(averageRating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }
                />
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {reviews.length} valoraciones
            </p>
          </div>
        </div>
      </div>

      {/* Review Form */}
      {user && user.id !== userId && !hasReviewed && (
        <form
          onSubmit={handleSubmitReview}
          className="bg-white p-6 rounded-lg border space-y-4"
        >
          <h3 className="font-semibold text-gray-900">
            Deja tu valoración
          </h3>

          {/* Rating Stars */}
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="focus:outline-none transition"
              >
                <Star
                  size={32}
                  className={
                    star <= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 hover:text-yellow-200'
                  }
                />
              </button>
            ))}
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comparte tu experiencia (opcional)"
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            rows={4}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 text-gray-900 font-semibold py-2 rounded-lg hover:bg-yellow-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Send size={18} />
            Enviar valoración
          </button>
        </form>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">
          Valoraciones ({reviews.length})
        </h3>

        {reviews.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Sin valoraciones aún
          </p>
        ) : (
          reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white p-4 rounded-lg border space-y-3"
            >
              {/* Reviewer Info */}
              <div className="flex items-center gap-3">
                {review.reviewer?.avatar_url && (
                  <img
                    src={review.reviewer.avatar_url}
                    alt={review.reviewer.full_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {review.reviewer?.full_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(review.created_at).toLocaleDateString(
                      'es-ES'
                    )}
                  </p>
                </div>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={
                        i < review.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {review.rating}.0
                </span>
              </div>

              {/* Comment */}
              {review.comment && (
                <p className="text-gray-700">{review.comment}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
