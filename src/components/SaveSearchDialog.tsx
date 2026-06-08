import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface SearchFilters {
  query?: string;
  category_id?: string;
  subcategory_id?: string;
  min_price?: number;
  max_price?: number;
  condition?: string;
  location?: string;
  radius_km?: number;
}

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SearchFilters;
  onSaved?: () => void;
}

const SaveSearchDialog = ({ open, onOpenChange, filters, onSaved }: SaveSearchDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !name.trim()) return;

    setSaving(true);

    const { error } = await supabase
      .from('saved_searches')
      .insert({
        user_id: user.id,
        name: name.trim(),
        query: filters.query || null,
        category_id: filters.category_id || null,
        subcategory_id: filters.subcategory_id || null,
        min_price: filters.min_price || null,
        max_price: filters.max_price || null,
        condition: filters.condition || null,
        location: filters.location || null,
        radius_km: filters.radius_km || null,
        alerts_enabled: alertsEnabled
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la búsqueda',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Búsqueda guardada',
        description: alertsEnabled 
          ? 'Recibirás alertas cuando haya nuevos productos'
          : 'Puedes acceder a esta búsqueda desde tu perfil'
      });
      setName('');
      onOpenChange(false);
      onSaved?.();
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar búsqueda</DialogTitle>
          <DialogDescription>
            Guarda estos filtros para acceder rápidamente y recibir alertas de nuevos productos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la búsqueda</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: iPhones baratos cerca de mí"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Alertas de nuevos productos</Label>
              <p className="text-sm text-muted-foreground">
                Recibe notificaciones cuando aparezcan productos
              </p>
            </div>
            <Switch
              checked={alertsEnabled}
              onCheckedChange={setAlertsEnabled}
            />
          </div>

          {/* Preview of filters */}
          <div className="bg-muted rounded-lg p-3 text-sm">
            <p className="font-medium mb-2">Filtros guardados:</p>
            <ul className="space-y-1 text-muted-foreground">
              {filters.query && <li>Búsqueda: "{filters.query}"</li>}
              {filters.condition && <li>Condición: {filters.condition}</li>}
              {(filters.min_price || filters.max_price) && (
                <li>
                  Precio: {filters.min_price || 0}€ - {filters.max_price || '∞'}€
                </li>
              )}
              {filters.location && <li>Ubicación: {filters.location}</li>}
              {filters.radius_km && <li>Radio: {filters.radius_km} km</li>}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Guardando...' : 'Guardar búsqueda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveSearchDialog;
