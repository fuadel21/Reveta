import { Link } from 'react-router-dom';
import { PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReadReceipt } from './ReadReceipt';
import { ImagePreview } from './ImagePreview';

interface MessageBubbleProps {
  content: string;
  isOwn: boolean;
  isRead: boolean;
  timestamp: string;
  senderName?: string;
}

type MessagePart = {
  type: 'text' | 'image' | 'link' | 'internal-call';
  content: string;
};

const trimTrailingPunctuation = (value: string) => {
  const match = value.match(/^(.+?)([.,!?)]*)$/);
  return {
    clean: match?.[1] || value,
    trailing: match?.[2] || '',
  };
};

const isImageUrl = (content: string): boolean => {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
  const imageHostPatterns = [/supabase.*storage.*products/i, /cloudinary/i, /imgur/i, /unsplash/i];

  if (imageExtensions.test(content)) return true;
  if (imageHostPatterns.some((pattern) => pattern.test(content))) return true;

  try {
    const url = new URL(content);
    return imageExtensions.test(url.pathname);
  } catch {
    return false;
  }
};

const isInternalCallLink = (value: string) => {
  try {
    const url = value.startsWith('http') ? new URL(value) : null;
    return value.startsWith('/call/') || url?.pathname.startsWith('/call/');
  } catch {
    return value.startsWith('/call/');
  }
};

const getInternalCallPath = (value: string) => {
  if (value.startsWith('/call/')) return value;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
};

const extractUrls = (text: string): MessagePart[] => {
  const urlRegex = /(https?:\/\/[^\s]+|\/call\/[A-Za-z0-9_-]+)/g;
  const parts: MessagePart[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const { clean, trailing } = trimTrailingPunctuation(match[0]);
    parts.push({
      type: isInternalCallLink(clean) ? 'internal-call' : isImageUrl(clean) ? 'image' : 'link',
      content: clean,
    });

    if (trailing) parts.push({ type: 'text', content: trailing });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

export const MessageBubble = ({ content, isOwn, isRead, timestamp }: MessageBubbleProps) => {
  const parts = extractUrls(content);
  const hasOnlyImage = parts.length === 1 && parts[0].type === 'image';

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl transition-all',
          hasOnlyImage ? 'p-1' : 'px-4 py-2',
          isOwn ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none',
        )}
      >
        <div className={cn('text-sm whitespace-pre-wrap', hasOnlyImage && 'p-0')}>
          {parts.map((part, index) => {
            if (part.type === 'image') {
              return <ImagePreview key={index} src={part.content} className="my-1" />;
            }

            if (part.type === 'internal-call') {
              return (
                <Link
                  key={index}
                  to={getInternalCallPath(part.content)}
                  className={cn(
                    'my-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold no-underline transition',
                    isOwn
                      ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  <PhoneCall className="h-4 w-4" />
                  Entrar a la llamada privada
                </Link>
              );
            }

            if (part.type === 'link') {
              return (
                <a
                  key={index}
                  href={part.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('underline break-all', isOwn ? 'text-primary-foreground/90' : 'text-primary')}
                >
                  {part.content}
                </a>
              );
            }

            return <span key={index}>{part.content}</span>;
          })}
        </div>

        <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
          <span className={cn('text-xs', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {timestamp}
          </span>
          {isOwn && <ReadReceipt isRead={isRead} className={isOwn ? 'text-primary-foreground/70' : ''} />}
        </div>
      </div>
    </div>
  );
};
