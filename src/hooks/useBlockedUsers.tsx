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

type UserBlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

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

    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('user_blocks')
      .select('blocker_id,blocked_id,created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocked users:', error);
      setBlockedUsers([]);
      setBlockedUserIds(new Set());
    } else {
      const rows = ((data || []) as UserBlockRow[]).map((row) => ({
        id: `${row.blocker_id}:${row.blocked_id}`,
        blocked_user_id: row.blocked_id,
        reason: null,
        created_at: row.created_at,
      }));
      setBlockedUsers(rows);
      setBlockedUserIds(new Set(rows.map((blocked) => blocked.blocked_user_id)));
    }

    setLoading(false);
  }, [user?.id]);

  const isBlocked = useCallback((userId: string) => blockedUserIds.has(userId), [blockedUserIds]);

  const blockUser = useCallback(async (blockedUserId: string, _reason?: string) => {
    if (!user || !blockedUserId) return false;
    if (blockedUserId === user.id) {
      console.warn('Cannot block yourself');
      return false;
    }

    if (blockedUserIds.has(blockedUserId)) return true;

    const { error } = await (supabase as any)
      .from('user_blocks')
      .upsert(
        {
          blocker_id: user.id,
          blocked_id: blockedUserId,
        },
        {
          onConflict: 'blocker_id,blocked_id',
          ignoreDuplicates: true,
        },
      );

    if (error) {
      console.error('Error blocking user:', error);
      return false;
    }

    await fetchBlockedUsers();
    window.dispatchEvent(new CustomEvent('reveta:safety-changed'));
    return true;
  }, [user?.id, blockedUserIds, fetchBlockedUsers]);

  const unblockUser = useCallback(async (blockedUserId: string) => {
    if (!user || !blockedUserId) return false;

    const { error } = await (supabase as any)
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedUserId);

    if (error) {
      console.error('Error unblocking user:', error);
      return false;
    }

    await fetchBlockedUsers();
    window.dispatchEvent(new CustomEvent('reveta:safety-changed'));
    return true;
  }, [user?.id, fetchBlockedUsers]);

  useEffect(() => {
    void fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  return { blockedUsers, blockedUserIds, loading, isBlocked, blockUser, unblockUser, refetch: fetchBlockedUsers };
};
