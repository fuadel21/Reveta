import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useFeaturedProducts = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFeatured = useCallback(
    async (productId: string, isFeatured: boolean) => {
      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from('products')
          .update({ is_featured: !isFeatured })
          .eq('id', productId);

        if (updateError) throw updateError;

        return !isFeatured;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al actualizar';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const makeFeatured = useCallback(
    async (productId: string, durationDays: number = 7) => {
      setLoading(true);
      setError(null);

      try {
        // Calculate expiration date
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + durationDays);

        const { error: updateError } = await supabase
          .from('products')
          .update({
            is_featured: true,
            featured_expires_at: expirationDate.toISOString(),
          })
          .eq('id', productId);

        if (updateError) throw updateError;

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al destacar';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const removeFeatured = useCallback(async (productId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          is_featured: false,
          featured_expires_at: null,
        })
        .eq('id', productId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al remover destacado';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    toggleFeatured,
    makeFeatured,
    removeFeatured,
  };
};
