import { useState } from 'react';
import { Heart, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ProductBadge } from './ProfileBadge';

interface ProductCardProps {
  id?: string | number;
  title: string;
  price: number;
  image: string;
  location: string;
  time: string;
  isFavorite?: boolean;
  isNew?: boolean;
  isNegotiable?: boolean;
  isFeatured?: boolean;
  discount?: number;
}

const ProductCard = ({
  id,
  title,
  price,
  image,
  location,
  time,
  isFavorite = false,
  isNew = false,
  isNegotiable = false,
  isFeatured = false,
  discount = 0,
}: ProductCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [favorite, setFavorite] = useState(isFavorite);
  const [isToggling, setIsToggling] = useState(false);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!id || isToggling) return;

    setIsToggling(true);

    try {
      if (favorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', String(id));

        setFavorite(false);
        toast({
          title: 'Eliminado de favoritos',
          description: 'El producto se ha eliminado de tus favoritos'
        });
      } else {
        await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            product_id: String(id)
          });

        setFavorite(true);
        toast({
          title: 'Añadido a favoritos',
          description: 'El producto se ha añadido a tus favoritos'
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }

    setIsToggling(false);
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-2">
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm" />
      
      <div className="relative aspect-square overflow-hidden rounded-t-2xl">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFavoriteClick}
          disabled={isToggling}
          className="absolute right-3 top-3 h-10 w-10 rounded-full bg-card/90 backdrop-blur-md hover:bg-card text-muted-foreground hover:text-destructive transition-all duration-300 hover:scale-110 shadow-lg"
        >
          <Heart className={`h-5 w-5 transition-all duration-300 ${favorite ? "fill-destructive text-destructive scale-110" : ""}`} />
        </Button>
        
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <ProductBadge 
            isFeatured={isFeatured} 
            isNew={isNew} 
            discount={discount} 
          />
          {isNegotiable && (
            <Badge variant="secondary" className="bg-card/90 backdrop-blur-md text-foreground border-0 shadow-lg">
              Negociable
            </Badge>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <div className="mb-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{price.toLocaleString('es-ES')}</span>
          <span className="text-lg font-semibold text-foreground">€</span>
        </div>
        <h3 className="mb-3 line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200">
          {title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-full">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-20">{location}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            <span>{time}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
