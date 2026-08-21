import { getErrorMessage } from '@/lib/errors';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FollowSellerButtonProps {
  sellerId: string;
  onFollowersChange?: (count: number) => void;
}

const FollowSellerButton = ({ sellerId, onFollowersChange }: FollowSellerButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const isOwnProfile = user?.id === sellerId;

  useEffect(() => {
    const loadFollowState = async () => {
      const { count } = await supabaseUntyped
        .from('seller_followers')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', sellerId);

      onFollowersChange?.(count || 0);

      if (!user?.id || isOwnProfile) {
        setIsFollowing(false);
        return;
      }

      const { data } = await supabaseUntyped
        .from('seller_followers')
        .select('id')
        .eq('seller_id', sellerId)
        .eq('follower_id', user.id)
        .maybeSingle();

      setIsFollowing(!!data);
    };

    loadFollowState();
  }, [sellerId, user?.id, isOwnProfile, onFollowersChange]);

  const toggleFollow = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (isOwnProfile || loading) return;
    setLoading(true);

    try {
      if (isFollowing) {
        const { error } = await supabaseUntyped
          .from('seller_followers')
          .delete()
          .eq('seller_id', sellerId)
          .eq('follower_id', user.id);

        if (error) throw error;
        setIsFollowing(false);
        onFollowersChange?.(-1);
        toast({ title: 'Has dejado de seguir al vendedor' });
      } else {
        const { error } = await supabaseUntyped
          .from('seller_followers')
          .insert({ seller_id: sellerId, follower_id: user.id });

        if (error) throw error;
        setIsFollowing(true);
        onFollowersChange?.(1);
        toast({ title: 'Ahora sigues a este vendedor' });
      }
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: getErrorMessage(error, 'Inténtalo de nuevo.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (isOwnProfile) return null;

  return (
    <Button onClick={toggleFollow} disabled={loading}>
      {isFollowing ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
      {loading ? 'Guardando...' : isFollowing ? 'Dejar de seguir' : 'Seguir vendedor'}
    </Button>
  );
};

export default FollowSellerButton;
