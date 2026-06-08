import { Button } from '@/components/ui/button';
import { Grid, Map as MapIcon, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'map' | 'split';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export const ViewModeToggle = ({ viewMode, onViewModeChange, className }: ViewModeToggleProps) => {
  return (
    <div className={cn("flex border border-border rounded-lg overflow-hidden", className)}>
      <Button
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none border-0"
        onClick={() => onViewModeChange('grid')}
        title="Vista de cuadrícula"
      >
        <Grid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === 'split' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none border-0 hidden md:flex"
        onClick={() => onViewModeChange('split')}
        title="Vista dividida"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === 'map' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none border-0"
        onClick={() => onViewModeChange('map')}
        title="Vista de mapa"
      >
        <MapIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
