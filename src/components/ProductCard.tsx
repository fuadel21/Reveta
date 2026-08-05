import { useEffect, useState } from 'react';
import { Heart, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  imagePriority?: boolean;
  onFavoriteChange?: (favorite: boolean) => void;
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
  imagePriority = false,
  onFavoriteChange,
}: ProductCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [favorite, setFavorite] = useState(isFavorite);
  const [isToggling, setIsToggling] = useState(false);
  const [imageSrc, setImageSrc] = useState(image || '/placeholder.svg');

  useEffect(() => setFavorite(isFavorite), [isFavorite]);
  useEffect(() => setImageSrc(image || '/placeholder.svg'), [image]);

  const handleFavoriteClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      navigate('/auth');
      return;
    }
    if (!id || isToggling) return;

    setIsToggling(true);
    try {
      const nextFavorite = !favorite;
      if (favorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', String(id));
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, product_id: String(id) });
        if (error) throw error;
      }

      setFavorite(nextFavorite);
      onFavoriteChange?.(nextFavorite);
      toast({
        title: nextFavorite ? 'Añadido a favoritos' : 'Eliminado de favoritos',
        description: nextFavorite
          ? 'El producto se ha añadido a tus favoritos.'
          : 'El producto se ha eliminado de tus favoritos.',
      });
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      toast({
        title: 'No se pudo actualizar el favorito',
        description: error?.message || 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-card shadow-card transition-all duration-300 hover:-translate-y-2 hover:shadow-card-hover">
      <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 blur-sm transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative aspect-square overflow-hidden rounded-t-2xl">
        <img
          src={imageSrc}
          alt={title}
          width={640}
          height={640}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading={imagePriority ? 'eager' : 'lazy'}
          fetchPriority={imagePriority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setImageSrc('/placeholder.svg')}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleFavoriteClick}
          disabled={isToggling}
          aria-label={favorite ? `Eliminar ${title} de favoritos` : `Añadir ${title} a favoritos`}
          className="absolute right-3 top-3 h-10 w-10 rounded-full bg-card/90 text-muted-foreground shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-card hover:text-destructive"
        >
          <Heart className={`h-5 w-5 transition-all duration-300 ${favorite ? 'scale-110 fill-destructive text-destructive' : ''}`} />
        </Button>

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <ProductBadge isFeatured={isFeatured} isNew={isNew} discount={discount} />
          {isNegotiable && (
            <Badge variant="secondary" className="border-0 bg-card/90 text-foreground shadow-lg backdrop-blur-md">
              Negociable
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground transition-colors group-hover:text-primary">{price.toLocaleString('es-ES')}</span>
          <span className="text-lg font-semibold text-foreground">€</span>
        </div>
        <h3 className="mb-3 line-clamp-2 text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
          {title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-1">
            <MapPin className="h-3 w-3" />
            <span className="max-w-20 truncate">{location}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-1">
            <Clock className="h-3 w-3" />
            <span>{time}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
