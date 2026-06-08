import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export const useBlockedUsers = () => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchBlockedUsers = useCallback(async () => {
    if (!user) {
      setBlockedUsers([]);
      setBlockedUserIds(new Set());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('blocked_users')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching blocked users:', error);
    } else {
      setBlockedUsers(data || []);
      setBlockedUserIds(new Set(data?.map(b => b.blocked_user_id) || []));
    }

    setLoading(false);
  }, [user]);

  const isBlocked = useCallback((userId: string) => {
    return blockedUserIds.has(userId);
  }, [blockedUserIds]);

  const blockUser = useCallback(async (blockedUserId: string, reason?: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('blocked_users')
      .insert({
        user_id: user.id,
        blocked_user_id: blockedUserId,
        reason: reason || null
      });

    if (error) {
      console.error('Error blocking user:', error);
      return false;
    }

    await fetchBlockedUsers();
    return true;
  }, [user, fetchBlockedUsers]);

  const unblockUser = useCallback(async (blockedUserId: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('user_id', user.id)
      .eq('blocked_user_id', blockedUserId);

    if (error) {
      console.error('Error unblocking user:', error);
      return false;
    }

    await fetchBlockedUsers();
    return true;
  }, [user, fetchBlockedUsers]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  return {
    blockedUsers,
    blockedUserIds,
    loading,
    isBlocked,
    blockUser,
    unblockUser,
    refetch: fetchBlockedUsers
  };
};
