import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, Upload, CheckCircle } from 'lucide-react';

interface VerificationRequestProps {
  isVerified?: boolean;
}

const VerificationRequest = ({ isVerified }: VerificationRequestProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    documentType: 'dni',
    documentNumber: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    
    // In a real implementation, you would:
    // 1. Upload ID document to secure storage
    // 2. Create a verification request in a separate table
    // 3. Have an admin review the request
    
    // For demo purposes, we'll simulate a successful submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setSubmitted(true);
    toast({
      title: 'Solicitud enviada',
      description: 'Tu solicitud de verificación ha sido recibida. Te notificaremos cuando sea revisada.'
    });
    
    setLoading(false);
  };

  if (isVerified) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span>Cuenta verificada</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Shield className="h-4 w-4" />
          Verificar cuenta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verificar tu cuenta</DialogTitle>
          <DialogDescription>
            La verificación aumenta la confianza de los compradores y te da acceso a funciones premium.
          </DialogDescription>
        </DialogHeader>
        
        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Solicitud enviada</h3>
            <p className="text-muted-foreground">
              Revisaremos tu solicitud en las próximas 24-48 horas.
              Te notificaremos cuando tu cuenta esté verificada.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo (como aparece en el documento)</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="documentType">Tipo de documento</Label>
              <select
                id="documentType"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={formData.documentType}
                onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
              >
                <option value="dni">DNI / NIE</option>
                <option value="passport">Pasaporte</option>
                <option value="license">Carnet de conducir</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="documentNumber">Número de documento</Label>
              <Input
                id="documentNumber"
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                placeholder="12345678A"
                required
              />
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Beneficios de la verificación:</p>
              <ul className="space-y-1">
                <li>• Badge de usuario verificado en tu perfil</li>
                <li>• Mayor visibilidad en los resultados de búsqueda</li>
                <li>• Mayor confianza de los compradores</li>
                <li>• Acceso a límites de publicación más altos</li>
              </ul>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar solicitud'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VerificationRequest;
