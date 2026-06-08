import { X, Navigation, Tag, MapPin, DollarSign, Package, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
}

interface ActiveFiltersProps {
  useGeoFilter: boolean;
  distanceRadius: number;
  searchQuery: string;
  selectedCategory: string;
  selectedSubcategory?: string;
  categories: Category[];
  subcategories?: Subcategory[];
  location: string;
  condition: string;
  priceRange: [number, number];
  hasLocation: boolean;
  onRemoveGeo: () => void;
  onRemoveSearch: () => void;
  onRemoveCategory: () => void;
  onRemoveSubcategory?: () => void;
  onRemoveLocation: () => void;
  onRemoveCondition: () => void;
  onRemovePrice: () => void;
}

export const ActiveFilters = ({
  useGeoFilter,
  distanceRadius,
  searchQuery,
  selectedCategory,
  selectedSubcategory,
  categories,
  subcategories = [],
  location,
  condition,
  priceRange,
  hasLocation,
  onRemoveGeo,
  onRemoveSearch,
  onRemoveCategory,
  onRemoveSubcategory,
  onRemoveLocation,
  onRemoveCondition,
  onRemovePrice,
}: ActiveFiltersProps) => {
  const hasActiveFilters = 
    (useGeoFilter && hasLocation) || 
    searchQuery || 
    selectedCategory || 
    selectedSubcategory ||
    location || 
    condition ||
    priceRange[0] > 0 || 
    priceRange[1] < 10000;

  if (!hasActiveFilters) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6 animate-fade-in">
      {useGeoFilter && hasLocation && (
        <FilterChip 
          icon={<Navigation className="h-3 w-3" />}
          label={`A ${distanceRadius} km de ti`}
          onRemove={onRemoveGeo}
          variant="primary"
        />
      )}
      {searchQuery && (
        <FilterChip 
          icon={<Tag className="h-3 w-3" />}
          label={`"${searchQuery}"`}
          onRemove={onRemoveSearch}
        />
      )}
      {selectedCategory && (
        <FilterChip 
          icon={<Package className="h-3 w-3" />}
          label={categories.find(c => c.id === selectedCategory)?.name || ''}
          onRemove={onRemoveCategory}
        />
      )}
      {selectedSubcategory && (
        <FilterChip 
          icon={<Layers className="h-3 w-3" />}
          label={subcategories.find(s => s.id === selectedSubcategory)?.name || ''}
          onRemove={onRemoveSubcategory || (() => {})}
        />
      )}
      {location && (
        <FilterChip 
          icon={<MapPin className="h-3 w-3" />}
          label={location}
          onRemove={onRemoveLocation}
        />
      )}
      {condition && (
        <FilterChip 
          label={condition}
          onRemove={onRemoveCondition}
        />
      )}
      {(priceRange[0] > 0 || priceRange[1] < 10000) && (
        <FilterChip 
          icon={<DollarSign className="h-3 w-3" />}
          label={`${priceRange[0]}€ - ${priceRange[1] === 10000 ? '10000+' : priceRange[1]}€`}
          onRemove={onRemovePrice}
        />
      )}
    </div>
  );
};

interface FilterChipProps {
  icon?: React.ReactNode;
  label: string;
  onRemove: () => void;
  variant?: 'default' | 'primary';
}

const FilterChip = ({ icon, label, onRemove, variant = 'default' }: FilterChipProps) => (
  <span 
    className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105",
      variant === 'primary' 
        ? "bg-primary text-primary-foreground" 
        : "bg-secondary text-secondary-foreground"
    )}
  >
    {icon}
    {label}
    <button 
      onClick={onRemove}
      className={cn(
        "ml-1 rounded-full p-0.5 transition-colors",
        variant === 'primary'
          ? "hover:bg-primary-foreground/20"
          : "hover:bg-foreground/10"
      )}
    >
      <X className="h-3 w-3" />
    </button>
  </span>
);
