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

  const clearTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!conversationId || !userId) {
      setTypingUsers([]);
      return;
    }

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
      clearTypingTimeout();
      setTypingUsers([]);
      channel.untrack().catch((error) => console.warn('Typing presence untrack failed:', error));
      supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [clearTypingTimeout, conversationId, userId]);

  const stopTyping = useCallback(async () => {
    if (!channelRef.current) return;

    clearTypingTimeout();
    await channelRef.current.track({ isTyping: false, name: '' });
  }, [clearTypingTimeout]);

  const startTyping = useCallback(async (userName: string = 'Usuario') => {
    if (!channelRef.current) return;

    clearTypingTimeout();
    await channelRef.current.track({ isTyping: true, name: userName });

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping().catch((error) => console.warn('Typing auto-stop failed:', error));
    }, 3000);
  }, [clearTypingTimeout, stopTyping]);

  return { typingUsers, startTyping, stopTyping };
};