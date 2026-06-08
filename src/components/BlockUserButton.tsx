import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  size = 'sm'
}: BlockUserButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [blocked, setBlocked] = useState(isBlocked);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    if (!user) return;

    setLoading(true);

    const { error } = await supabase
      .from('blocked_users')
      .insert({
        user_id: user.id,
        blocked_user_id: userId
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo bloquear al usuario',
        variant: 'destructive'
      });
    } else {
      setBlocked(true);
      toast({
        title: 'Usuario bloqueado',
        description: 'Ya no verás productos ni mensajes de este usuario'
      });
      onBlockChange?.(true);
    }

    setLoading(false);
    setDialogOpen(false);
  };

  const handleUnblock = async () => {
    if (!user) return;

    setLoading(true);

    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('user_id', user.id)
      .eq('blocked_user_id', userId);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo desbloquear al usuario',
        variant: 'destructive'
      });
    } else {
      setBlocked(false);
      toast({
        title: 'Usuario desbloqueado',
        description: 'Ahora puedes ver sus productos y mensajes'
      });
      onBlockChange?.(false);
    }

    setLoading(false);
  };

  if (user?.id === userId) return null;

  if (blocked) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleUnblock}
        disabled={loading}
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
        disabled={loading}
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
                <li>No verás sus productos</li>
                <li>No podrá contactarte</li>
                <li>No podrá ver tus productos</li>
              </ul>
              <p className="mt-2">Puedes desbloquearlo en cualquier momento desde ajustes.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
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
