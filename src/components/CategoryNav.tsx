import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

interface CategoryWithSubs extends Category {
  subcategories: Subcategory[];
}

const CategoryNav = () => {
  const navigate = useNavigate();
  const [categoriesWithSubs, setCategoriesWithSubs] = useState<CategoryWithSubs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategoriesWithSubcategories();
  }, []);

  const fetchCategoriesWithSubcategories = async () => {
    // Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');

    if (catError) {
      console.error('Error fetching categories:', catError);
      setLoading(false);
      return;
    }

    // Fetch all subcategories
    const { data: subcategories, error: subError } = await supabase
      .from('subcategories')
      .select('id, category_id, name')
      .order('name');

    if (subError) {
      console.error('Error fetching subcategories:', subError);
    }

    // Combine categories with their subcategories
    const combined = (categories || []).map(cat => ({
      ...cat,
      subcategories: (subcategories || []).filter(sub => sub.category_id === cat.id)
    }));

    setCategoriesWithSubs(combined);
    setLoading(false);
  };

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/search?category=${categoryId}`);
  };

  const handleSubcategoryClick = (categoryId: string, subcategoryId: string) => {
    navigate(`/search?category=${categoryId}&subcategory=${subcategoryId}`);
  };

  const handleAllCategories = () => {
    navigate('/search');
  };

  // Show first 6 categories in the nav bar
  const visibleCategories = categoriesWithSubs.slice(0, 6);

  if (loading) {
    return (
      <nav className="border-b border-border bg-card">
        <div className="container">
          <div className="flex items-center gap-6 h-12 overflow-x-auto">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 w-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b border-border bg-card">
      <div className="container">
        <div className="flex items-center gap-2 sm:gap-6 h-12 overflow-x-auto scrollbar-hide">
          {/* All categories dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary whitespace-nowrap px-2 sm:px-4"
              >
                <Menu className="h-4 w-4" />
                <span className="hidden sm:inline">Todas las categorías</span>
                <span className="sm:hidden">Categorías</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={handleAllCategories} className="font-medium">
                Ver todas
              </DropdownMenuItem>
              {categoriesWithSubs.map((category) => (
                category.subcategories.length > 0 ? (
                  <DropdownMenuSub key={category.id}>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      {category.name}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-48">
                        <DropdownMenuItem 
                          onClick={() => handleCategoryClick(category.id)}
                          className="font-medium"
                        >
                          Ver todo en {category.name}
                        </DropdownMenuItem>
                        {category.subcategories.map((sub) => (
                          <DropdownMenuItem 
                            key={sub.id}
                            onClick={() => handleSubcategoryClick(category.id, sub.id)}
                          >
                            {sub.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                ) : (
                  <DropdownMenuItem 
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                  >
                    {category.name}
                  </DropdownMenuItem>
                )
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Individual category links with hover subcategory dropdown */}
          {visibleCategories.map((category) => (
            category.subcategories.length > 0 ? (
              <DropdownMenu key={category.id}>
                <DropdownMenuTrigger asChild>
                  <button className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors whitespace-nowrap flex items-center gap-1">
                    {category.name}
                    <ChevronRight className="h-3 w-3 rotate-90" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => handleCategoryClick(category.id)}
                    className="font-medium"
                  >
                    Ver todo
                  </DropdownMenuItem>
                  {category.subcategories.map((sub) => (
                    <DropdownMenuItem 
                      key={sub.id}
                      onClick={() => handleSubcategoryClick(category.id, sub.id)}
                    >
                      {sub.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
              >
                {category.name}
              </button>
            )
          ))}
        </div>
      </div>
    </nav>
  );
};

export default CategoryNav;
