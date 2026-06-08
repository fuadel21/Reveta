import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown } from 'lucide-react';

interface SortSelectProps {
  value: string;
  onChange: (value: string) => void;
  showDistanceOption?: boolean;
}

export const SortSelect = ({ value, onChange, showDistanceOption }: SortSelectProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {showDistanceOption && (
          <SelectItem value="distance">Más cercanos</SelectItem>
        )}
        <SelectItem value="recent">Más recientes</SelectItem>
        <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
        <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
      </SelectContent>
    </Select>
  );
};
