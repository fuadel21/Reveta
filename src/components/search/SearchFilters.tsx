import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Navigation, MapPin, Locate, X, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  hasLocation: boolean;
  requestLocation: () => void;
}

const DISTANCE_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: 200, label: '200 km' },
];

interface SearchFiltersProps {
  categories: Category[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  selectedSubcategory?: string;
  setSelectedSubcategory?: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  priceRange: [number, number];
  setPriceRange: (value: [number, number]) => void;
  condition: string;
  setCondition: (value: string) => void;
  useGeoFilter: boolean;
  setUseGeoFilter: (value: boolean) => void;
  distanceRadius: number;
  setDistanceRadius: (value: number) => void;
  geolocation: GeolocationState;
  onApply: () => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

export const SearchFilters = ({
  categories,
  selectedCategory,
  setSelectedCategory,
  selectedSubcategory = '',
  setSelectedSubcategory,
  location,
  setLocation,
  priceRange,
  setPriceRange,
  condition,
  setCondition,
  useGeoFilter,
  setUseGeoFilter,
  distanceRadius,
  setDistanceRadius,
  geolocation,
  onApply,
  onClear,
  hasActiveFilters,
}: SearchFiltersProps) => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
    }
  }, [selectedCategory]);

  const fetchSubcategories = async (categoryId: string) => {
    setLoadingSubcategories(true);
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('category_id', categoryId)
      .order('name');
    
    if (!error && data) {
      setSubcategories(data);
    } else {
      setSubcategories([]);
    }
    setLoadingSubcategories(false);
  };

  const handleCategoryChange = (value: string) => {
    const newValue = value === 'all' ? '' : value;
    setSelectedCategory(newValue);
    if (setSelectedSubcategory) {
      setSelectedSubcategory('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Geolocation Filter */}
      <div className="space-y-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            <Label className="font-medium">Buscar cerca de mí</Label>
          </div>
          <Switch 
            checked={useGeoFilter} 
            onCheckedChange={(checked) => {
              setUseGeoFilter(checked);
              if (checked && !geolocation.hasLocation) {
                geolocation.requestLocation();
              }
            }}
          />
        </div>
        
        {useGeoFilter && (
          <>
            {geolocation.loading && (
              <p className="text-sm text-muted-foreground animate-pulse">Obteniendo ubicación...</p>
            )}
            {geolocation.error && (
              <p className="text-sm text-destructive">{geolocation.error}</p>
            )}
            {geolocation.hasLocation && (
              <div className="space-y-3">
                <p className="text-sm text-primary flex items-center gap-1">
                  <Locate className="h-3 w-3" />
                  Ubicación obtenida
                </p>
                <div className="space-y-2">
                  <Label className="text-sm">Distancia máxima: {distanceRadius} km</Label>
                  <Select 
                    value={distanceRadius.toString()} 
                    onValueChange={(val) => setDistanceRadius(Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTANCE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Categoría</Label>
        <Select value={selectedCategory || "all"} onValueChange={handleCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subcategory */}
      {selectedCategory && subcategories.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <Label className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronRight className="h-3 w-3" />
            Subcategoría
          </Label>
          <Select 
            value={selectedSubcategory || "all"} 
            onValueChange={(val) => setSelectedSubcategory?.(val === 'all' ? '' : val)}
            disabled={loadingSubcategories}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingSubcategories ? "Cargando..." : "Todas las subcategorías"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las subcategorías</SelectItem>
              {subcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!useGeoFilter && (
        <div className="space-y-2">
          <Label>Ubicación</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ciudad o provincia"
              className="pl-10"
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Label>Precio: {priceRange[0]}€ - {priceRange[1] === 10000 ? '10000+' : priceRange[1]}€</Label>
        <Slider
          value={priceRange}
          onValueChange={(value) => setPriceRange(value as [number, number])}
          max={10000}
          step={50}
          className="py-4"
        />
      </div>

      <div className="space-y-2">
        <Label>Estado</Label>
        <Select value={condition || "all"} onValueChange={(val) => setCondition(val === "all" ? "" : val)}>
          <SelectTrigger>
            <SelectValue placeholder="Cualquier estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier estado</SelectItem>
            <SelectItem value="Nuevo">Nuevo</SelectItem>
            <SelectItem value="Como nuevo">Como nuevo</SelectItem>
            <SelectItem value="Buen estado">Buen estado</SelectItem>
            <SelectItem value="Usado">Usado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button onClick={onApply} className="flex-1">
          Aplicar filtros
        </Button>
        {hasActiveFilters && (
          <Button variant="outline" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
