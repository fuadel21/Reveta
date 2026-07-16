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

const normalizeReason = (value?: string) => {
  const reason = value?.trim().replace(/\s+/g, ' ') || '';
  return reason ? reason.slice(0, 300) : null;
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
    const { data, error } = await supabase
      .from('blocked_users')
      .select('id, blocked_user_id, reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocked users:', error);
      setBlockedUsers([]);
      setBlockedUserIds(new Set());
    } else {
      setBlockedUsers(data || []);
      setBlockedUserIds(new Set((data || []).map((blocked) => blocked.blocked_user_id)));
    }

    setLoading(false);
  }, [user?.id]);

  const isBlocked = useCallback((userId: string) => blockedUserIds.has(userId), [blockedUserIds]);

  const blockUser = useCallback(async (blockedUserId: string, reason?: string) => {
    if (!user || !blockedUserId) return false;
    if (blockedUserId === user.id) {
      console.warn('Cannot block yourself');
      return false;
    }

    if (blockedUserIds.has(blockedUserId)) return true;

    const safeReason = normalizeReason(reason);
    const { data: existingBlock, error: checkError } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('blocked_user_id', blockedUserId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking blocked user:', checkError);
      return false;
    }

    const { error } = existingBlock?.id
      ? await supabase
        .from('blocked_users')
        .update({ reason: safeReason })
        .eq('id', existingBlock.id)
        .eq('user_id', user.id)
      : await supabase
        .from('blocked_users')
        .insert({
          user_id: user.id,
          blocked_user_id: blockedUserId,
          reason: safeReason,
        } as any);

    if (error) {
      console.error('Error blocking user:', error);
      return false;
    }

    await fetchBlockedUsers();
    return true;
  }, [user?.id, blockedUserIds, fetchBlockedUsers]);

  const unblockUser = useCallback(async (blockedUserId: string) => {
    if (!user || !blockedUserId) return false;

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
  }, [user?.id, fetchBlockedUsers]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  return { blockedUsers, blockedUserIds, loading, isBlocked, blockUser, unblockUser, refetch: fetchBlockedUsers };
};