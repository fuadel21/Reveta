import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Euro, Tag } from 'lucide-react';

interface OfferDialogProps {
  conversationId: string;
  productPrice: number;
  productTitle: string;
  onOfferSent?: () => void;
  trigger?: React.ReactNode;
}

const OfferDialog = ({ conversationId, productPrice, productTitle, onOfferSent, trigger }: OfferDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !amount) return;

    const offerAmount = parseFloat(amount);
    if (isNaN(offerAmount) || offerAmount <= 0) {
      toast({
        title: 'Cantidad inválida',
        description: 'Introduce una cantidad válida',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('offers')
      .insert({
        conversation_id: conversationId,
        buyer_id: user.id,
        amount: offerAmount
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar la oferta',
        variant: 'destructive'
      });
    } else {
      // Also send a message about the offer
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: `💰 He hecho una oferta de ${offerAmount.toLocaleString('es-ES')} € por "${productTitle}"`
        });

      toast({
        title: 'Oferta enviada',
        description: `Tu oferta de ${offerAmount.toLocaleString('es-ES')} € ha sido enviada`
      });
      setOpen(false);
      setAmount('');
      onOfferSent?.();
    }

    setSubmitting(false);
  };

  const suggestedPrices = [
    Math.round(productPrice * 0.8),
    Math.round(productPrice * 0.9),
    Math.round(productPrice * 0.95)
  ].filter(p => p > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Tag className="h-4 w-4 mr-2" />
            Hacer oferta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hacer una oferta</DialogTitle>
          <DialogDescription>
            Precio actual: {productPrice.toLocaleString('es-ES')} €
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Tu oferta</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="pl-10 text-lg"
              />
            </div>
          </div>

          {suggestedPrices.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Sugerencias</Label>
              <div className="flex gap-2 flex-wrap">
                {suggestedPrices.map((price) => (
                  <Button
                    key={price}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(price.toString())}
                  >
                    {price.toLocaleString('es-ES')} €
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !amount}>
            {submitting ? 'Enviando...' : 'Enviar oferta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OfferDialog;
