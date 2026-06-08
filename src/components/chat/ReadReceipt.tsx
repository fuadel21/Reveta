import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadReceiptProps {
  isRead: boolean;
  isSent?: boolean;
  className?: string;
}

export const ReadReceipt = ({ isRead, isSent = true, className }: ReadReceiptProps) => {
  if (!isSent) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <div className="h-3 w-3 rounded-full border border-current opacity-50 animate-pulse" />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      {isRead ? (
        <CheckCheck className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Check className="h-3.5 w-3.5 opacity-70" />
      )}
    </span>
  );
};
