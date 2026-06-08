import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Euro, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfferCardProps {
  offer: {
    id: string;
    amount: number;
    status: string;
    buyer_id: string;
    created_at: string;
  };
  isSeller: boolean;
  productTitle: string;
  onStatusChange?: () => void;
}

const OfferCard = ({ offer, isSeller, productTitle, onStatusChange }: OfferCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const handleUpdateStatus = async (status: 'accepted' | 'rejected') => {
    setUpdating(true);

    const { error } = await supabase
      .from('offers')
      .update({ status })
      .eq('id', offer.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la oferta',
        variant: 'destructive'
      });
    } else {
      toast({
        title: status === 'accepted' ? '¡Oferta aceptada!' : 'Oferta rechazada',
        description: status === 'accepted' 
          ? 'Has aceptado la oferta. Contacta con el comprador para finalizar la venta.'
          : 'La oferta ha sido rechazada.'
      });
      onStatusChange?.();
    }

    setUpdating(false);
  };

  const statusConfig = {
    pending: {
      label: 'Pendiente',
      icon: Clock,
      className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
    },
    accepted: {
      label: 'Aceptada',
      icon: Check,
      className: 'bg-green-500/10 text-green-600 border-green-500/30'
    },
    rejected: {
      label: 'Rechazada',
      icon: X,
      className: 'bg-red-500/10 text-red-600 border-red-500/30'
    }
  };

  const status = statusConfig[offer.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      status.className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Euro className="h-5 w-5" />
          <span className="text-lg font-bold">
            {offer.amount.toLocaleString('es-ES')} €
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <StatusIcon className="h-4 w-4" />
          <span>{status.label}</span>
        </div>
      </div>

      <p className="text-sm opacity-80">
        Oferta por "{productTitle}"
      </p>

      {offer.status === 'pending' && isSeller && (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-green-500 text-green-600 hover:bg-green-500 hover:text-white"
            onClick={() => handleUpdateStatus('accepted')}
            disabled={updating}
          >
            <Check className="h-4 w-4 mr-1" />
            Aceptar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-red-500 text-red-600 hover:bg-red-500 hover:text-white"
            onClick={() => handleUpdateStatus('rejected')}
            disabled={updating}
          >
            <X className="h-4 w-4 mr-1" />
            Rechazar
          </Button>
        </div>
      )}

      {offer.status === 'accepted' && (
        <p className="text-sm font-medium text-green-600">
          ¡Contacta para finalizar la transacción!
        </p>
      )}
    </div>
  );
};

export default OfferCard;
