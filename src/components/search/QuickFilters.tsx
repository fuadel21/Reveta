import { Button } from '@/components/ui/button';
import { Sparkles, Clock, TrendingDown, MapPin, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickFiltersProps {
  onQuickFilter: (filter: string) => void;
  activeQuickFilter: string | null;
}

const QUICK_FILTERS = [
  { id: 'new', label: 'Nuevo', icon: Sparkles },
  { id: 'recent', label: 'Recientes', icon: Clock },
  { id: 'deals', label: 'Ofertas', icon: TrendingDown },
  { id: 'nearby', label: 'Cerca de mí', icon: MapPin },
];

export const QuickFilters = ({ onQuickFilter, activeQuickFilter }: QuickFiltersProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {QUICK_FILTERS.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeQuickFilter === filter.id;
        
        return (
          <Button
            key={filter.id}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onQuickFilter(isActive ? '' : filter.id)}
            className={cn(
              "shrink-0 gap-1.5 transition-all",
              isActive && "shadow-md"
            )}
          >
            <Icon className="h-4 w-4" />
            {filter.label}
          </Button>
        );
      })}
    </div>
  );
};
