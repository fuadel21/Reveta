import { BadgeCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const VerifiedBadge = ({ className, size = 'md' }: VerifiedBadgeProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <BadgeCheck className={cn(
          "text-primary fill-primary/20",
          sizeClasses[size],
          className
        )} />
      </TooltipTrigger>
      <TooltipContent>
        <p>Usuario verificado</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default VerifiedBadge;
