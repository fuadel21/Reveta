import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Clock, Package } from 'lucide-react';

interface ProductStatusSelectorProps {
  productId: string;
  currentStatus: string | null;
  onStatusChange?: (newStatus: string) => void;
}

const statusOptions = [
  { value: 'active', label: 'Activo', icon: Package, color: 'text-primary' },
  { value: 'reserved', label: 'Reservado', icon: Clock, color: 'text-amber-500' },
  { value: 'sold', label: 'Vendido', icon: CheckCircle, color: 'text-green-600' },
];

const ProductStatusSelector = ({ productId, currentStatus, onStatusChange }: ProductStatusSelectorProps) => {
  const { toast } = useToast();
  const [status, setStatus] = useState(currentStatus || 'active');
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    
    const { error } = await supabase
      .from('products')
      .update({ status: newStatus })
      .eq('id', productId);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive'
      });
    } else {
      setStatus(newStatus);
      toast({
        title: 'Estado actualizado',
        description: `El producto ahora está ${statusOptions.find(s => s.value === newStatus)?.label.toLowerCase()}`
      });
      onStatusChange?.(newStatus);
    }
    
    setLoading(false);
  };

  const currentOption = statusOptions.find(s => s.value === status);
  const Icon = currentOption?.icon || Package;

  return (
    <Select value={status} onValueChange={handleStatusChange} disabled={loading}>
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${currentOption?.color}`} />
            {currentOption?.label}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              <option.icon className={`h-4 w-4 ${option.color}`} />
              {option.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ProductStatusSelector;
