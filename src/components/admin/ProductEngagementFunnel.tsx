import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, Loader2, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ProductFunnel {
  product_id: string;
  title: string | null;
  price: number | null;
  status: string | null;
  click_count: number;
  conversation_count: number;
  offer_count: number;
  accepted_offer_count: number;
  click_to_conversation_rate: number;
  conversation_to_offer_rate: number;
  last_activity_at: string | null;
}

const getStatusLabel = (status: string | null) => {
  if (status === 'active') return 'Activo';
  if (status === 'sold') return 'Vendido';
  if (status === 'reserved') return 'Reservado';
  if (status === 'inactive') return 'Inactivo';
  return status || 'Sin estado';
};

const createProductSlug = (title: string | null) => {
  return (title || 'producto')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'producto';
};

const formatRate = (value: number | null | undefined) => `${Number(value || 0).toLocaleString('es-ES')}%`;

export const ProductEngagementFunnel = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProductFunnel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFunnel = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('growth_product_engagement_funnel')
      .select('*')
      .limit(20);

    if (error) {
      console.warn('Product engagement funnel view not available:', error.message);
      setItems([]);
    } else {
      setItems((data || []) as ProductFunnel[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFunnel();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Embudo por producto</CardTitle>
        <CardDescription>Clics, conversaciones, ofertas y conversión por anuncio.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Aún no hay datos de embudo o falta ejecutar la vista SQL.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">Chats</TableHead>
                  <TableHead className="text-right">Ofertas</TableHead>
                  <TableHead className="text-right">Aceptadas</TableHead>
                  <TableHead className="text-right">Clic → chat</TableHead>
                  <TableHead className="text-right">Chat → oferta</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.product_id}>
                    <TableCell className="font-medium max-w-[260px] truncate">{item.title || 'Producto eliminado'}</TableCell>
                    <TableCell><Badge variant="outline">{getStatusLabel(item.status)}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{item.click_count}</TableCell>
                    <TableCell className="text-right">{item.conversation_count}</TableCell>
                    <TableCell className="text-right">{item.offer_count}</TableCell>
                    <TableCell className="text-right">{item.accepted_offer_count}</TableCell>
                    <TableCell className="text-right">{formatRate(item.click_to_conversation_rate)}</TableCell>
                    <TableCell className="text-right">{formatRate(item.conversation_to_offer_rate)}</TableCell>
                    <TableCell>{item.last_activity_at ? format(new Date(item.last_activity_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/producto/${item.product_id}/${createProductSlug(item.title)}`)}>
                        <Eye className="h-4 w-4 mr-1" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
