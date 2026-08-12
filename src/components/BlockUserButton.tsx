import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Ban, Check } from 'lucide-react';

interface BlockUserButtonProps {
  userId: string;
  userName?: string;
  isBlocked?: boolean;
  onBlockChange?: (blocked: boolean) => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const BlockUserButton = ({
  userId,
  userName = 'este usuario',
  isBlocked = false,
  onBlockChange,
  variant = 'outline',
  size = 'sm',
}: BlockUserButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isBlocked: isCanonicalBlocked, blockUser, unblockUser, loading: blockStateLoading } = useBlockedUsers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const blocked = user ? isCanonicalBlocked(userId) : isBlocked;

  const handleBlock = async () => {
    if (!user || working) return;
    setWorking(true);

    const success = await blockUser(userId);
    if (!success) {
      toast({
        title: 'Error',
        description: 'No se pudo bloquear al usuario',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Usuario bloqueado',
        description: 'Las interacciones con este usuario quedan bloqueadas en Reveta.',
      });
      onBlockChange?.(true);
    }

    setWorking(false);
    setDialogOpen(false);
  };

  const handleUnblock = async () => {
    if (!user || working) return;
    setWorking(true);

    const success = await unblockUser(userId);
    if (!success) {
      toast({
        title: 'Error',
        description: 'No se pudo desbloquear al usuario',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Usuario desbloqueado',
        description: 'Las interacciones vuelven a regirse por tus preferencias de privacidad.',
      });
      onBlockChange?.(false);
    }

    setWorking(false);
  };

  if (user?.id === userId) return null;

  if (blocked) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => void handleUnblock()}
        disabled={working || blockStateLoading}
      >
        <Check className="h-4 w-4 mr-2" />
        Desbloquear
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setDialogOpen(true)}
        disabled={working || blockStateLoading}
        className="text-destructive hover:text-destructive"
      >
        <Ban className="h-4 w-4 mr-2" />
        Bloquear
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Bloquear a {userName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Al bloquear a este usuario:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Se impedirán nuevas interacciones entre ambas cuentas</li>
                <li>No podrá iniciar conversaciones contigo</li>
                <li>El bloqueo aparecerá en tu Centro de Protección</li>
              </ul>
              <p className="mt-2">Puedes desbloquearlo en cualquier momento desde ajustes.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleBlock()}
              className="bg-destructive hover:bg-destructive/90"
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BlockUserButton;
