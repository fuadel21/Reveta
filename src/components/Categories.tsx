import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Car, 
  Smartphone, 
  Sofa, 
  Shirt, 
  Gamepad2, 
  Bike, 
  Watch, 
  Baby, 
  Wrench,
  BookOpen,
  Dumbbell,
  Home,
  LucideIcon
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

const iconMap: Record<string, LucideIcon> = {
  Car,
  Smartphone,
  Sofa,
  Shirt,
  Gamepad2,
  Bike,
  Watch,
  Baby,
  Wrench,
  BookOpen,
  Dumbbell,
  Home
};

const colorMap: Record<string, string> = {
  'Coches': 'bg-blue-500/10 text-blue-600',
  'Móviles': 'bg-purple-500/10 text-purple-600',
  'Muebles': 'bg-amber-500/10 text-amber-600',
  'Moda': 'bg-pink-500/10 text-pink-600',
  'Videojuegos': 'bg-green-500/10 text-green-600',
  'Bicicletas': 'bg-orange-500/10 text-orange-600',
  'Relojes': 'bg-slate-500/10 text-slate-600',
  'Bebés': 'bg-rose-500/10 text-rose-600',
  'Bricolaje': 'bg-yellow-500/10 text-yellow-600',
  'Libros': 'bg-indigo-500/10 text-indigo-600',
  'Deportes': 'bg-red-500/10 text-red-600',
  'Hogar': 'bg-teal-500/10 text-teal-600',
};

const Categories = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/search?category=${categoryId}`);
  };

  const getIcon = (iconName: string | null): LucideIcon => {
    if (iconName && iconMap[iconName]) {
      return iconMap[iconName];
    }
    return Home;
  };

  const getColor = (name: string): string => {
    return colorMap[name] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">Categorías</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14 md:py-18">
      <div className="container">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">Categorías populares</h2>
            <p className="mt-1 text-muted-foreground">Explora por tipo de producto</p>
          </div>
          <button 
            onClick={() => navigate('/search')}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group"
          >
            Ver todas
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
          {categories.map((category, index) => {
            const Icon = getIcon(category.icon);
            const colorClass = getColor(category.name);
            
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className="group flex flex-col items-center gap-3 rounded-2xl bg-card p-5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-2 animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${colorClass} transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                  <Icon className="h-7 w-7" />
                </div>
                <span className="text-xs font-semibold text-foreground text-center group-hover:text-primary transition-colors">{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Categories;
