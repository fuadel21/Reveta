import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProductStatusBadgeProps {
  status: string | null;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  reserved: { label: 'Reservado', variant: 'secondary' },
  sold: { label: 'Vendido', variant: 'destructive' },
};

const ProductStatusBadge = ({ status, className }: ProductStatusBadgeProps) => {
  const config = statusConfig[status || 'active'] || statusConfig.active;

  return (
    <Badge 
      variant={config.variant} 
      className={cn(
        status === 'reserved' && 'bg-amber-500 hover:bg-amber-600',
        status === 'sold' && 'bg-green-600 hover:bg-green-700',
        className
      )}
    >
      {config.label}
    </Badge>
  );
};

export default ProductStatusBadge;
