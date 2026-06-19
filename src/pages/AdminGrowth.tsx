import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, BarChart3, Eye, Loader2, MapPin, MousePointerClick, Package, Search, TrendingUp, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ProductEngagementFunnel } from '@/components/admin/ProductEngagementFunnel';

interface SearchAnalytic {
  id: string;
  user_id: string | null;
  query: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  location: string | null;
  result_count: number;
  created_at: string;
  geo_enabled: boolean;
}

interface ProductClick {
  id: string;
  product_id: string | null;
  user_id: string | null;
  source: string | null;
  created_at: string;
}

interface ClickedProduct {
  product_id: string;
  title: string | null;
  price: number | null;
  status: string | null;
  click_count: number;
  last_clicked_at: string;
}

interface SummaryRow {
  label: string;
  count: number;
  zeroResults?: number;
}

const normalizeLabel = (value: string | null | undefined, fallback: string) => {
  const cleaned = value?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : fallback;
};

const getSourceLabel = (source: string | null | undefined) => {
  if (source === 'product_grid') return 'Búsqueda / listado';
  if (source === 'related_products') return 'Productos similares';
  if (source === 'search_grid') return 'Búsqueda';
  return source || 'Sin origen';
};

const summarize = (items: SearchAnalytic[], getLabel: (item: SearchAnalytic) => string | null | undefined): SummaryRow[] => {
  const map = new Map<string, SummaryRow>();

  items.forEach((item) => {
    const label = normalizeLabel(getLabel(item), 'Sin dato');
    const current = map.get(label) || { label, count: 0, zeroResults: 0 };
    current.count += 1;
    if (item.result_count === 0) current.zeroResults = (current.zeroResults || 0) + 1;
    map.set(label, current);
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
};

const summarizeClickSources = (items: ProductClick[]): SummaryRow[] => {
  const map = new Map<string, SummaryRow>();

  items.forEach((item) => {
    const label = getSourceLabel(item.source);
    const current = map.get(label) || { label, count: 0 };
    current.count += 1;
    map.set(label, current);
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
};

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

const AdminGrowth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [items, setItems] = useState<SearchAnalytic[]>([]);
  const [productClicks, setProductClicks] = useState<ProductClick[]>([]);
  const [clickedProducts, setClickedProducts] = useState<ClickedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      toast.error('No tienes permisos de administrador');
      navigate('/');
    }
  }, [isAdmin, adminLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin) fetchAnalytics();
  }, [isAdmin]);

  const fetchAnalytics = async () => {
    setLoading(true);

    const [searchResult, clickedProductsResult, productClicksResult] = await Promise.all([
      (supabase as any)
        .from('search_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      (supabase as any)
        .from('growth_top_clicked_products')
        .select('*')
        .limit(10),
      (supabase as any)
        .from('product_clicks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (searchResult.error) {
      console.error('Error fetching search analytics:', searchResult.error);
      toast.error('No se pudieron cargar las métricas de búsqueda');
      setItems([]);
    } else {
      setItems((searchResult.data || []) as SearchAnalytic[]);
    }

    if (clickedProductsResult.error) {
      console.warn('Clicked products view not available:', clickedProductsResult.error.message);
      setClickedProducts([]);
    } else {
      setClickedProducts((clickedProductsResult.data || []) as ClickedProduct[]);
    }

    if (productClicksResult.error) {
      console.warn('Product clicks not available:', productClicksResult.error.message);
      setProductClicks([]);
    } else {
      setProductClicks((productClicksResult.data || []) as ProductClick[]);
    }

    setLoading(false);
  };

  const totalSearches = items.length;
  const searchesWithNoResults = items.filter((item) => item.result_count === 0).length;
  const uniqueQueries = new Set(items.map((item) => normalizeLabel(item.query, 'Sin texto'))).size;
  const geoSearches = items.filter((item) => item.geo_enabled).length;
  const totalProductClicks = productClicks.length;

  const topQueries = useMemo(() => summarize(items, (item) => item.query), [items]);
  const topLocations = useMemo(() => summarize(items, (item) => item.location), [items]);
  const noResultQueries = useMemo(() => summarize(items.filter((item) => item.result_count === 0), (item) => item.query), [items]);
  const clickSources = useMemo(() => summarizeClickSources(productClicks), [productClicks]);
  const recentSearches = items.slice(0, 25);

  if (authLoading || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) return null;

  return (
    <>
      <Helmet><title>Crecimiento y búsquedas | Reveta</title></Helmet>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Crecimiento y búsquedas</h1>
                <p className="text-muted-foreground">Detecta demanda, ciudades activas, productos clicados y búsquedas sin resultados.</p>
              </div>
            </div>
            <Button onClick={fetchAnalytics} variant="outline">Actualizar</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{totalSearches}</CardTitle><CardDescription className="flex items-center gap-2"><Search className="h-4 w-4" /> Búsquedas</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{uniqueQueries}</CardTitle><CardDescription className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Términos únicos</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{searchesWithNoResults}</CardTitle><CardDescription className="flex items-center gap-2"><XCircle className="h-4 w-4" /> Sin resultados</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{geoSearches}</CardTitle><CardDescription className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Cerca de mí</CardDescription></CardHeader></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-2xl">{totalProductClicks}</CardTitle><CardDescription className="flex items-center gap-2"><MousePointerClick className="h-4 w-4" /> Clics</CardDescription></CardHeader></Card>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-8">
              <div className="grid gap-6 lg:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Más buscado</CardTitle>
                    <CardDescription>Términos que más se repiten.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Búsqueda</TableHead><TableHead className="text-right">Veces</TableHead></TableRow></TableHeader>
                      <TableBody>{topQueries.map((row) => <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell className="text-right font-medium">{row.count}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Ciudades</CardTitle>
                    <CardDescription>Ubicaciones con más demanda.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Ciudad</TableHead><TableHead className="text-right">Veces</TableHead></TableRow></TableHeader>
                      <TableBody>{topLocations.map((row) => <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell className="text-right font-medium">{row.count}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><XCircle className="h-5 w-5" /> Oportunidades</CardTitle>
                    <CardDescription>Búsquedas sin resultados para crear oferta.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Búsqueda</TableHead><TableHead className="text-right">Veces</TableHead></TableRow></TableHeader>
                      <TableBody>{noResultQueries.map((row) => <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell className="text-right font-medium">{row.count}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MousePointerClick className="h-5 w-5" /> Origen de clics</CardTitle>
                    <CardDescription>Qué zonas generan más navegación.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Origen</TableHead><TableHead className="text-right">Clics</TableHead></TableRow></TableHeader>
                      <TableBody>{clickSources.map((row) => <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell className="text-right font-medium">{row.count}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Productos más clicados</CardTitle>
                  <CardDescription>Productos que generan más interés desde listados, búsquedas y productos similares.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Clics</TableHead>
                          <TableHead>Último clic</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clickedProducts.map((item) => (
                          <TableRow key={item.product_id}>
                            <TableCell className="font-medium max-w-[280px] truncate">{item.title || 'Producto eliminado'}</TableCell>
                            <TableCell><Badge variant="outline">{getStatusLabel(item.status)}</Badge></TableCell>
                            <TableCell className="text-right">{typeof item.price === 'number' ? `${item.price.toLocaleString('es-ES')} €` : '-'}</TableCell>
                            <TableCell className="text-right font-semibold">{item.click_count}</TableCell>
                            <TableCell>{item.last_clicked_at ? format(new Date(item.last_clicked_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}</TableCell>
                            <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => navigate(`/producto/${item.product_id}/${createProductSlug(item.title)}`)}><Eye className="h-4 w-4 mr-1" /> Ver</Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <ProductEngagementFunnel />

              <Card>
                <CardHeader>
                  <CardTitle>Últimas búsquedas</CardTitle>
                  <CardDescription>Últimos 25 registros guardados.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Búsqueda</TableHead>
                          <TableHead>Ubicación</TableHead>
                          <TableHead>Resultados</TableHead>
                          <TableHead>Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentSearches.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                            <TableCell className="font-medium">{normalizeLabel(item.query, 'Sin texto')}</TableCell>
                            <TableCell>{normalizeLabel(item.location, item.geo_enabled ? 'Cerca de mí' : 'Sin ubicación')}</TableCell>
                            <TableCell>{item.result_count === 0 ? <Badge variant="destructive">0</Badge> : item.result_count}</TableCell>
                            <TableCell>{item.geo_enabled ? <Badge>Geo</Badge> : <Badge variant="outline">Normal</Badge>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminGrowth;
