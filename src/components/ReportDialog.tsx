import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Flag } from 'lucide-react';

interface ReportDialogProps {
  productId?: string;
  userId?: string;
  trigger?: React.ReactNode;
}

const reportReasons = [
  { value: 'spam', label: 'Spam o anuncio repetido' },
  { value: 'scam', label: 'Posible estafa' },
  { value: 'inappropriate', label: 'Contenido inapropiado' },
  { value: 'fake', label: 'Producto falso o engañoso' },
  { value: 'prohibited', label: 'Artículo prohibido' },
  { value: 'other', label: 'Otro motivo' },
];

const ReportDialog = ({ productId, userId, trigger }: ReportDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!reason) {
      toast({
        title: 'Selecciona un motivo',
        description: 'Debes indicar por qué reportas este contenido',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        reported_product_id: productId || null,
        reported_user_id: userId || null,
        reason,
        description: description.trim() || null
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el reporte',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Reporte enviado',
        description: 'Revisaremos tu reporte lo antes posible'
      });
      setOpen(false);
      setReason('');
      setDescription('');
    }

    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Flag className="h-4 w-4 mr-2" />
            Reportar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar contenido</DialogTitle>
          <DialogDescription>
            Ayúdanos a mantener la comunidad segura reportando contenido inapropiado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>¿Por qué reportas este contenido?</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {reportReasons.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción adicional (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Proporciona más detalles si lo deseas..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason}>
            {submitting ? 'Enviando...' : 'Enviar reporte'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
