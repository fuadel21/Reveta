import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, Scale, ShieldCheck, Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getComparedProductIds, setComparedProductIds } from '@/lib/productComparison';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  location: string | null;
  condition: string | null;
  description: string | null;
  created_at: string;
  status: string | null;
  views: number | null;
  user_id: string;
}

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'producto';
const formatDate = (value: string) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

const ProductComparison = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    const ids = getComparedProductIds();
    if (!ids.length) { setProducts([]); setLoading(false); return; }
    const { data } = await supabase.from('products').select('id,title,price,images,location,condition,description,created_at,status,views,user_id').in('id', ids);
    const ordered = ids.map((id) => (data || []).find((item) => item.id === id)).filter(Boolean) as Product[];
    setProducts(ordered);
    setLoading(false);
  };

  useEffect(() => { loadProducts(); }, []);

  const cheapestId = useMemo(() => products.length ? [...products].sort((a, b) => a.price - b.price)[0].id : null, [products]);
  const remove = (id: string) => { setComparedProductIds(getComparedProductIds().filter((item) => item !== id)); setProducts((items) => items.filter((item) => item.id !== id)); };
  const clear = () => { setComparedProductIds([]); setProducts([]); };

  return <div className="min-h-screen flex flex-col bg-background">
    <Header />
    <main className="container flex-1 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-2 -ml-3"><Link to="/search"><ArrowLeft className="mr-2 h-4 w-4" />Volver a buscar</Link></Button>
          <h1 className="flex items-center gap-3 text-3xl font-bold"><Scale className="h-8 w-8 text-primary" />Comparador de productos</h1>
          <p className="mt-2 text-muted-foreground">Compara hasta cuatro anuncios antes de decidir.</p>
        </div>
        {products.length > 0 && <Button variant="outline" onClick={clear}><Trash2 className="mr-2 h-4 w-4" />Vaciar comparador</Button>}
      </div>

      {loading ? <div className="py-20 text-center text-muted-foreground">Cargando comparación…</div> : products.length === 0 ? <Card><CardContent className="py-16 text-center"><Scale className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-semibold">Aún no has añadido productos</h2><p className="mt-2 text-muted-foreground">Usa el botón Comparar en los resultados de búsqueda.</p><Button asChild className="mt-5"><Link to="/search">Explorar anuncios</Link></Button></CardContent></Card> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => <Card key={product.id} className="relative overflow-hidden">
          {product.id === cheapestId && <Badge className="absolute left-3 top-3 z-10">Precio más bajo</Badge>}
          <button onClick={() => remove(product.id)} className="absolute right-3 top-3 z-10 rounded-full bg-background/90 p-2 shadow" aria-label="Quitar del comparador"><Trash2 className="h-4 w-4" /></button>
          <img src={product.images?.[0] || '/placeholder.svg'} alt={product.title} className="h-52 w-full object-cover" />
          <CardHeader><CardTitle className="line-clamp-2 text-lg">{product.title}</CardTitle><div className="text-2xl font-bold text-primary">{Number(product.price).toLocaleString('es-ES')} €</div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Estado</span><Badge variant="outline">{product.condition || 'Sin indicar'}</Badge></div>
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{product.location || 'Sin ubicación'}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Publicado</span><span>{formatDate(product.created_at)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Visitas</span><span>{product.views || 0}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="h-4 w-4" />Compra y chat dentro de Reveta</div>
            <div className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Anuncio {product.status === 'active' ? 'disponible' : product.status || 'sin estado'}</div>
            <p className="line-clamp-4 min-h-20 text-muted-foreground">{product.description || 'Sin descripción adicional.'}</p>
            <Button asChild className="w-full"><Link to={`/producto/${product.id}/${slugify(product.title)}`}>Ver anuncio</Link></Button>
          </CardContent>
        </Card>)}
      </div>}
    </main>
    <Footer />
  </div>;
};

export default ProductComparison;
