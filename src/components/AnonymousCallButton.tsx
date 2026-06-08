import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Phone, PhoneOff, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnonymousCallButtonProps {
  sellerName: string;
  className?: string;
}

const AnonymousCallButton = ({ sellerName, className }: AnonymousCallButtonProps) => {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [callActive, setCallActive] = useState(false);

  const handleStartCall = () => {
    setCallActive(true);
    toast({
      title: 'Llamada iniciada',
      description: `Conectando con ${sellerName} de forma anónima...`,
    });

    // Simulate call (in production this would connect to a VoIP service)
    setTimeout(() => {
      setCallActive(false);
      toast({
        title: 'Llamada finalizada',
        description: 'La llamada ha terminado',
      });
    }, 5000);
  };

  const handleEndCall = () => {
    setCallActive(false);
    toast({
      title: 'Llamada finalizada',
      description: 'Has terminado la llamada',
    });
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setShowDialog(true)}
        className={className}
      >
        <Phone className="h-4 w-4 mr-2" />
        Llamar
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Llamada anónima
            </DialogTitle>
            <DialogDescription>
              Tu número de teléfono permanecerá oculto durante la llamada
            </DialogDescription>
          </DialogHeader>

          <div className="py-8 text-center">
            {callActive ? (
              <div className="space-y-4">
                <div className="h-20 w-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                  <Phone className="h-10 w-10 text-green-500" />
                </div>
                <p className="text-lg font-medium">Llamando a {sellerName}...</p>
                <p className="text-sm text-muted-foreground">
                  Tu número está protegido
                </p>
                <Button 
                  variant="destructive" 
                  onClick={handleEndCall}
                  className="mt-4"
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Colgar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-20 w-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                  <Phone className="h-10 w-10 text-primary" />
                </div>
                <p className="text-lg font-medium">{sellerName}</p>
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  <p className="flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Tu número no será visible para el vendedor
                  </p>
                </div>
                <Button onClick={handleStartCall} className="mt-4">
                  <Phone className="h-4 w-4 mr-2" />
                  Iniciar llamada
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AnonymousCallButton;
