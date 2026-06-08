import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
}

interface CategorySubcategorySelectorProps {
  categoryId: string;
  subcategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  onSubcategoryChange: (subcategoryId: string) => void;
  categories?: Category[];
  showLabels?: boolean;
  className?: string;
}

export const CategorySubcategorySelector = ({
  categoryId,
  subcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  categories: externalCategories,
  showLabels = true,
  className,
}: CategorySubcategorySelectorProps) => {
  const [categories, setCategories] = useState<Category[]>(externalCategories || []);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  useEffect(() => {
    if (!externalCategories) {
      fetchCategories();
    }
  }, [externalCategories]);

  useEffect(() => {
    if (categoryId) {
      fetchSubcategories(categoryId);
    } else {
      setSubcategories([]);
      onSubcategoryChange('');
    }
  }, [categoryId]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchSubcategories = async (catId: string) => {
    setLoadingSubcategories(true);
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('category_id', catId)
      .order('name');
    
    if (!error && data) {
      setSubcategories(data);
    } else {
      setSubcategories([]);
    }
    setLoadingSubcategories(false);
  };

  const handleCategoryChange = (value: string) => {
    const newCategoryId = value === 'all' ? '' : value;
    onCategoryChange(newCategoryId);
    onSubcategoryChange(''); // Reset subcategory when category changes
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        {showLabels && <Label>Categoría</Label>}
        <Select value={categoryId || "all"} onValueChange={handleCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {categoryId && subcategories.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          {showLabels && (
            <Label className="flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronRight className="h-3 w-3" />
              Subcategoría
            </Label>
          )}
          <Select 
            value={subcategoryId || "all"} 
            onValueChange={(val) => onSubcategoryChange(val === 'all' ? '' : val)}
            disabled={loadingSubcategories}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingSubcategories ? "Cargando..." : "Selecciona subcategoría"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las subcategorías</SelectItem>
              {subcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

// Hook to fetch subcategories for a given category
export const useSubcategories = (categoryId: string | null) => {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (categoryId) {
      setLoading(true);
      supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data) {
            setSubcategories(data);
          } else {
            setSubcategories([]);
          }
          setLoading(false);
        });
    } else {
      setSubcategories([]);
    }
  }, [categoryId]);

  return { subcategories, loading };
};
