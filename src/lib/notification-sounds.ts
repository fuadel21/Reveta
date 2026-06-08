// Notification sound utilities
const NOTIFICATION_SOUNDS = {
  default: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1rZXaBgYuJg32JlYyMhIJ3jJObkoZ6gH1/gIJxc3+GhIuEioaIj42RlZONhIF4eoKJj5KPjoqFgYKEi5GYlJGQjo2OkpWZlJGNiYeFhomKjI2Lh4WDgYCCg4WFhYSEg4KAf39/f4CAf39/f39/f39/f39/f39/f4B/gH+AgICAgH9/f39/gICBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKDg4OCgoKCgoKCgoKCgoKCg4ODg4ODg4OEhISEhISEhISEhIWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWGhoaGhoaGhoaGhoaGhoaG',
  message: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1rZXaBgYuJg32JlYyMhIJ3jJObkoZ6gH1/gIJxc3+GhIuEioaIj42RlZONhIF4eoKJj5KPjoqFgYKEi5GYlJGQjo2OkpWZlJGNiYeFhomKjI2Lh4WDgYCCg4WFhYSEg4KAf39/f4CAf39/f39/f39/f39/f39/f4B/gH+AgICAgH9/f39/gICBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKDg4OCgoKCgoKCgoKCgoKCg4ODg4ODg4OEhISEhISEhISEhIWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWGhoaGhoaGhoaGhoaGhoaG',
  offer: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1rZXaBgYuJg32JlYyMhIJ3jJObkoZ6gH1/gIJxc3+GhIuEioaIj42RlZONhIF4eoKJj5KPjoqFgYKEi5GYlJGQjo2OkpWZlJGNiYeFhomKjI2Lh4WDgYCCg4WFhYSEg4KAf39/f4CAf39/f39/f39/f39/f39/f4B/gH+AgICAgH9/f39/gICBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKDg4OCgoKCgoKCgoKCgoKCg4ODg4ODg4OEhISEhISEhISEhIWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWGhoaGhoaGhoaGhoaGhoaG',
};

export const playNotificationSound = (type: 'default' | 'message' | 'offer' = 'default') => {
  try {
    const audio = new Audio(NOTIFICATION_SOUNDS[type]);
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Silently fail if audio can't play (e.g., autoplay blocked)
    });
  } catch {
    // Audio not supported
  }
};

export const vibrateDevice = (pattern: number | number[] = 100) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export const notifyWithFeedback = (
  type: 'default' | 'message' | 'offer' = 'default',
  options?: { sound?: boolean; vibrate?: boolean }
) => {
  const { sound = true, vibrate = true } = options || {};
  
  if (sound) {
    playNotificationSound(type);
  }
  
  if (vibrate) {
    vibrateDevice(type === 'offer' ? [100, 50, 100] : 100);
  }
};
