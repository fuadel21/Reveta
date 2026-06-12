import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Euro, MapPin } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface EditProductDialogProps {
  product: {
    id: string;
    title: string;
    description: string | null;
    price: number;
    location: string | null;
    condition: string | null;
    category_id: string | null;
    status: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductUpdated: () => void;
}

const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación'
};

const statusLabels: Record<string, string> = {
  active: 'Activo',
  reserved: 'Reservado',
  sold: 'Vendido'
};

const EditProductDialog = ({ product, open, onOpenChange, onProductUpdated }: EditProductDialogProps) => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    location: '',
    condition: '',
    category_id: '',
    status: 'active'
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title,
        description: product.description || '',
        price: product.price.toString(),
        location: product.location || '',
        condition: product.condition || '',
        category_id: product.category_id || '',
        status: product.status || 'active'
      });
    }
  }, [product]);

  if (!product) return null;

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    if (data) setCategories(data);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.price) {
      toast({
        title: 'Campos requeridos',
        description: 'El título y el precio son obligatorios',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('products')
      .update({
        title: formData.title,
        description: formData.description || null,
        price: parseFloat(formData.price),
        location: formData.location || null,
        condition: formData.condition || null,
        category_id: formData.category_id || null,
        status: formData.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', product.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el producto',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Producto actualizado',
        description: 'Los cambios se han guardado correctamente'
      });
      onProductUpdated();
      onOpenChange(false);
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar producto</DialogTitle>
          <DialogDescription>
            Modifica los detalles de tu producto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Título *</Label>
            <Input
              id="edit-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descripción</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-price">Precio *</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estado del producto</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Condición</Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData({ ...formData, condition: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado del producto" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(conditionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">Ubicación</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;
