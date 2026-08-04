import { useMemo, useState } from 'react';
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

type ComparableSearch = {
  query: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  min_price: number | null;
  max_price: number | null;
  condition: string | null;
  location: string | null;
  radius_km: number | null;
};

const MAX_SAVED_SEARCHES = 20;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 80;

const normalizeText = (value?: string | null) => value?.trim().toLowerCase().replace(/\s+/g, ' ') || null;
const normalizeNumber = (value?: number | null) => Number.isFinite(Number(value)) ? Number(value) : null;

const signature = (search: ComparableSearch) => JSON.stringify({
  query: normalizeText(search.query),
  category_id: search.category_id || null,
  subcategory_id: search.subcategory_id || null,
  min_price: normalizeNumber(search.min_price),
  max_price: normalizeNumber(search.max_price),
  condition: search.condition || null,
  location: normalizeText(search.location),
  radius_km: normalizeNumber(search.radius_km),
});

const SaveSearchDialog = ({ open, onOpenChange, filters, onSaved }: SaveSearchDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const cleanName = name.trim().replace(/\s+/g, ' ');
  const currentSearch = useMemo<ComparableSearch>(() => ({
    query: filters.query || null,
    category_id: filters.category_id || null,
    subcategory_id: filters.subcategory_id || null,
    min_price: filters.min_price ?? null,
    max_price: filters.max_price ?? null,
    condition: filters.condition || null,
    location: filters.location || null,
    radius_km: filters.radius_km ?? null,
  }), [filters]);

  const closeDialog = () => {
    if (saving) return;
    setName('');
    setAlertsEnabled(true);
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!user || saving) return;
    if (cleanName.length < MIN_NAME_LENGTH || cleanName.length > MAX_NAME_LENGTH) {
      toast({ title: 'Revisa el nombre', description: `Escribe entre ${MIN_NAME_LENGTH} y ${MAX_NAME_LENGTH} caracteres.`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data: existing, error: existingError } = await supabase
        .from('saved_searches')
        .select('query,category_id,subcategory_id,min_price,max_price,condition,location,radius_km')
        .eq('user_id', user.id)
        .limit(MAX_SAVED_SEARCHES + 1);
      if (existingError) throw existingError;

      if ((existing || []).length >= MAX_SAVED_SEARCHES) {
        toast({ title: 'Límite alcanzado', description: `Puedes guardar hasta ${MAX_SAVED_SEARCHES} búsquedas. Elimina una antes de crear otra.`, variant: 'destructive' });
        return;
      }

      const currentSignature = signature(currentSearch);
      const duplicate = (existing || []).some((item) => signature(item as ComparableSearch) === currentSignature);
      if (duplicate) {
        toast({ title: 'Esta búsqueda ya está guardada', description: 'Puedes gestionarla desde Búsquedas guardadas y activar allí sus alertas.' });
        return;
      }

      const { error } = await supabase.from('saved_searches').insert({
        user_id: user.id,
        name: cleanName,
        ...currentSearch,
        alerts_enabled: alertsEnabled,
      });
      if (error) throw error;

      toast({
        title: 'Búsqueda guardada',
        description: alertsEnabled ? 'La alerta queda activa para nuevos productos.' : 'Podrás abrirla cuando quieras desde tu perfil.',
      });
      setName('');
      setAlertsEnabled(true);
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('Error saving search:', error);
      toast({ title: 'No se pudo guardar la búsqueda', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar búsqueda</DialogTitle>
          <DialogDescription>Guarda estos filtros para acceder rápidamente y recibir alertas de nuevos productos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la búsqueda</Label>
            <Input id="name" value={name} disabled={saving} maxLength={MAX_NAME_LENGTH} onChange={(event) => setName(event.target.value)} placeholder="Ej. iPhones baratos cerca de mí" />
            <p className="text-right text-xs text-muted-foreground">{cleanName.length}/{MAX_NAME_LENGTH}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5"><Label>Alertas de nuevos productos</Label><p className="text-sm text-muted-foreground">Recibe notificaciones cuando aparezcan coincidencias.</p></div>
            <Switch checked={alertsEnabled} disabled={saving} onCheckedChange={setAlertsEnabled} />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="mb-2 font-medium">Filtros guardados:</p>
            <ul className="space-y-1 text-muted-foreground">
              {filters.query && <li>Búsqueda: “{filters.query}”</li>}
              {filters.category_id && <li>Categoría seleccionada</li>}
              {filters.subcategory_id && <li>Subcategoría seleccionada</li>}
              {filters.condition && <li>Condición: {filters.condition}</li>}
              {(filters.min_price !== undefined || filters.max_price !== undefined) && <li>Precio: {filters.min_price || 0} € – {filters.max_price || '∞'} €</li>}
              {filters.location && <li>Ubicación: {filters.location}</li>}
              {filters.radius_km && <li>Cerca de ti: radio de {filters.radius_km} km</li>}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={closeDialog}>Cancelar</Button>
          <Button onClick={handleSave} disabled={cleanName.length < MIN_NAME_LENGTH || saving}>{saving ? 'Guardando...' : 'Guardar búsqueda'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveSearchDialog;
