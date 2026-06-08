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

// Helper to detect if content is an image URL
const isImageUrl = (content: string): boolean => {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
  const imageHostPatterns = [
    /supabase.*storage.*products/i,
    /cloudinary/i,
    /imgur/i,
    /unsplash/i,
  ];
  
  if (imageExtensions.test(content)) return true;
  if (imageHostPatterns.some(pattern => pattern.test(content))) return true;
  
  try {
    const url = new URL(content);
    return imageExtensions.test(url.pathname);
  } catch {
    return false;
  }
};

// Helper to detect URLs in text
const extractUrls = (text: string): { type: 'text' | 'image' | 'link'; content: string }[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts: { type: 'text' | 'image' | 'link'; content: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    
    const url = match[0];
    parts.push({ 
      type: isImageUrl(url) ? 'image' : 'link', 
      content: url 
    });
    
    lastIndex = match.index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

export const MessageBubble = ({ 
  content, 
  isOwn, 
  isRead, 
  timestamp,
}: MessageBubbleProps) => {
  const parts = extractUrls(content);
  const hasOnlyImage = parts.length === 1 && parts[0].type === 'image';

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl transition-all",
          hasOnlyImage ? "p-1" : "px-4 py-2",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-muted rounded-bl-none"
        )}
      >
        <div className={cn("text-sm", hasOnlyImage && "p-0")}>
          {parts.map((part, index) => {
            if (part.type === 'image') {
              return (
                <ImagePreview 
                  key={index} 
                  src={part.content} 
                  className="my-1"
                />
              );
            }
            if (part.type === 'link') {
              return (
                <a
                  key={index}
                  href={part.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "underline break-all",
                    isOwn ? "text-primary-foreground/90" : "text-primary"
                  )}
                >
                  {part.content}
                </a>
              );
            }
            return <span key={index}>{part.content}</span>;
          })}
        </div>
        
        <div className={cn(
          "flex items-center gap-1 mt-1",
          isOwn ? "justify-end" : "justify-start"
        )}>
          <span className={cn(
            "text-xs",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {timestamp}
          </span>
          {isOwn && (
            <ReadReceipt 
              isRead={isRead} 
              className={isOwn ? "text-primary-foreground/70" : ""} 
            />
          )}
        </div>
      </div>
    </div>
  );
};
