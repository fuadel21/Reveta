import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingUser {
  id: string;
  name: string;
}

export const useTypingIndicator = (conversationId: string | undefined, userId: string | undefined) => {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;

    // Create a presence channel for typing indicators
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing: TypingUser[] = [];
        
        Object.keys(state).forEach((key) => {
          if (key !== userId) {
            const presences = state[key] as any[];
            presences.forEach((presence) => {
              if (presence.isTyping) {
                typing.push({ id: key, name: presence.name || 'Usuario' });
              }
            });
          }
        });
        
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ isTyping: false, name: '' });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, userId]);

  const startTyping = useCallback(async (userName: string = 'Usuario') => {
    if (!channelRef.current) return;

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Track that user is typing
    await channelRef.current.track({ isTyping: true, name: userName });

    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(async () => {
      await stopTyping();
    }, 3000);
  }, []);

  const stopTyping = useCallback(async () => {
    if (!channelRef.current) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    await channelRef.current.track({ isTyping: false, name: '' });
  }, []);

  return { typingUsers, startTyping, stopTyping };
};
