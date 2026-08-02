import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Save } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type EditableProduct = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  location: string | null;
  condition: string | null;
  status: string | null;
};

const OPEN_TRANSACTION_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'disputed', 'under_review'];
const conditionLabels: Record<string, string> = {
  new: 'Nuevo',
  like_new: 'Como nuevo',
  good: 'Buen estado',
  fair: 'Aceptable',
  poor: 'Necesita reparación',
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeMultiline = (value: string) => value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
const parsePrice = (value: string) => Number.parseFloat(value.replace(',', '.'));

const EditProduct = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<EditableProduct | null>(null);
  const [form, setForm] = useState({ title: '', description: '', price: '', location: '', condition: '' });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user?.id && productId) loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, productId]);

  const loadProduct = async () => {
    if (!user || !productId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, user_id, title, description, price, location, condition, status')
        .eq('id', productId)
        .maybeSingle();
      if (error || !data) throw error || new Error('Producto no encontrado');
      if (data.user_id !== user.id) throw new Error('Solo puedes editar tus propios anuncios');
      if (data.status === 'sold' || data.status === 'completed') throw new Error('Los productos vendidos no se pueden editar');

      const [{ count: reservations }, { count: transactions }] = await Promise.all([
        (supabase as any).from('product_reservations').select('id', { count: 'exact', head: true }).eq('product_id', data.id).eq('status', 'active'),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('product_id', data.id).in('status', OPEN_TRANSACTION_STATUSES),
      ]);
      if ((reservations || 0) > 0 || (transactions || 0) > 0) throw new Error('Este anuncio tiene una reserva u operación abierta y no se puede editar todavía');

      const editable = data as EditableProduct;
      setProduct(editable);
      setForm({
        title: editable.title || '',
        description: editable.description || '',
        price: String(editable.price ?? ''),
        location: editable.location || '',
        condition: editable.condition || '',
      });
    } catch (error: any) {
      toast({ title: 'No se puede editar este anuncio', description: error?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
      navigate('/seller-dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !product || saving) return;

    const title = normalizeText(form.title);
    const description = normalizeMultiline(form.description);
    const location = normalizeText(form.location);
    const price = parsePrice(form.price);

    if (title.length < 8) {
      toast({ title: 'Título demasiado corto', description: 'Escribe al menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (description.length < 20 || description.length > 2000) {
      toast({ title: 'Revisa la descripción', description: 'Debe tener entre 20 y 2000 caracteres.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(price) || price < 0.5 || price > 50000) {
      toast({ title: 'Precio inválido', description: 'Usa un importe entre 0,50 € y 50.000 €.', variant: 'destructive' });
      return;
    }
    if (location.length < 2 || !form.condition) {
      toast({ title: 'Faltan datos', description: 'Completa ubicación y estado del producto.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('products')
      .update({ title, description, price, location, condition: form.condition })
      .eq('id', product.id)
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'No se pudo guardar', description: error.message || 'Inténtalo de nuevo.', variant: 'destructive' });
      setSaving(false);
      return;
    }

    toast({ title: 'Anuncio actualizado', description: 'Los cambios ya se han guardado.' });
    navigate(`/product/${product.id}`, { replace: true });
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!user || !product) return null;

  return (
    <>
      <Helmet><title>Editar anuncio | Reveta</title><meta name="robots" content="noindex,nofollow,noarchive" /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <Button type="button" variant="ghost" className="mb-4" onClick={() => navigate('/seller-dashboard')}><ArrowLeft className="mr-2 h-4 w-4" />Volver al panel</Button>
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>Editar anuncio</CardTitle>
              <CardDescription>Actualiza la información comercial. Las fotos se mantienen sin cambios.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                <div className="space-y-2"><Label htmlFor="edit-title">Título</Label><Input id="edit-title" value={form.title} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="edit-description">Descripción</Label><Textarea id="edit-description" rows={8} maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /><p className="text-right text-xs text-muted-foreground">{form.description.length}/2000</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="edit-price">Precio</Label><Input id="edit-price" type="number" min="0.5" max="50000" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Estado</Label><Select value={form.condition} onValueChange={(value) => setForm((current) => ({ ...current, condition: value }))}><SelectTrigger><SelectValue placeholder="Estado del producto" /></SelectTrigger><SelectContent>{Object.entries(conditionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label htmlFor="edit-location">Ubicación</Label><Input id="edit-location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} /></div>
                <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => navigate('/seller-dashboard')}>Cancelar</Button><Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Guardando...' : 'Guardar cambios'}</Button></div>
              </form>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default EditProduct;
