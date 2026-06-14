import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import Header from '@/components/Header';
import CategoryNav from '@/components/CategoryNav';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Search, SlidersHorizontal, Bookmark } from 'lucide-react';
import ProductsMap from '@/components/ProductsMap';
import { SearchFilters } from '@/components/search/SearchFilters';
import { ActiveFilters } from '@/components/search/ActiveFilters';
import { QuickFilters } from '@/components/search/QuickFilters';
import { ViewModeToggle, ViewMode } from '@/components/search/ViewModeToggle';
import { ProductGrid } from '@/components/search/ProductGrid';
import { SortSelect } from '@/components/search/SortSelect';
import SaveSearchDialog from '@/components/SaveSearchDialog';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  location: string | null;
  created_at: string;
  condition: string | null;
  distance_km?: number;
  latitude?: number;
  longitude?: number;
  subcategory_id?: string;
  boosted_until?: string | null;
}

interface Category { id: string; name: string; }
interface Subcategory { id: string; category_id: string; name: string; }
interface Favorite { product_id: string; }

const isBoosted = (product: Product) => !!product.boosted_until && new Date(product.boosted_until).getTime() > Date.now();

const sortBoostedFirst = (items: Product[]) => {
  return [...items].sort((a, b) => {
    const aBoosted = isBoosted(a);
    const bBoosted = isBoosted(b);
    if (aBoosted && !bBoosted) return -1;
    if (!aBoosted && bBoosted) return 1;
    return 0;
  });
};

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const geolocation = useGeolocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const [saveSearchDialogOpen, setSaveSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedSubcategory, setSelectedSubcategory] = useState(searchParams.get('subcategory') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [priceRange, setPriceRange] = useState<[number, number]>([Number(searchParams.get('minPrice')) || 0, Number(searchParams.get('maxPrice')) || 10000]);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'recent');
  const [condition, setCondition] = useState(searchParams.get('condition') || '');
  const [useGeoFilter, setUseGeoFilter] = useState(searchParams.get('geo') === 'true');
  const [distanceRadius, setDistanceRadius] = useState(Number(searchParams.get('radius')) || 25);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { selectedCategory ? fetchSubcategories(selectedCategory) : setSubcategories([]); }, [selectedCategory]);
  useEffect(() => { fetchProducts(); }, [searchParams, geolocation.latitude, geolocation.longitude]);
  useEffect(() => { if (user) fetchFavorites(); }, [user]);
  useEffect(() => { if (useGeoFilter && !geolocation.hasLocation && !geolocation.loading) geolocation.requestLocation(); }, [useGeoFilter]);
  useEffect(() => { setSelectedSubcategory(searchParams.get('subcategory') || ''); }, [searchParams]);

  useEffect(() => {
    if (useGeoFilter && geolocation.hasLocation) {
      if (sortBy !== 'distance') {
        setSortBy('distance');
        const params = new URLSearchParams(searchParams);
        params.set('sort', 'distance');
        setSearchParams(params, { replace: true });
      }
    } else if (!useGeoFilter && sortBy === 'distance') {
      setSortBy('recent');
      const params = new URLSearchParams(searchParams);
      params.delete('sort');
      setSearchParams(params, { replace: true });
    }
  }, [useGeoFilter, geolocation.hasLocation]);

  const fetchFavorites = async () => {
    if (!user) return;
    const { data } = await supabase.from('favorites').select('product_id').eq('user_id', user.id);
    if (data) setFavorites(new Set(data.map((f: Favorite) => f.product_id)));
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const fetchSubcategories = async (categoryId: string) => {
    const { data } = await supabase.from('subcategories').select('*').eq('category_id', categoryId).order('name');
    setSubcategories(data || []);
  };

  const fetchProducts = async () => {
    setLoading(true);
    const geoEnabled = searchParams.get('geo') === 'true';
    const radius = Number(searchParams.get('radius')) || 25;
    const subcategoryFilter = searchParams.get('subcategory');

    if (geoEnabled && geolocation.latitude && geolocation.longitude) {
      const { data, error } = await supabase.rpc('get_products_within_radius', {
        user_lat: geolocation.latitude,
        user_lon: geolocation.longitude,
        radius_km: radius,
        search_query: searchParams.get('q') || null,
        category_filter: searchParams.get('category') || null,
        condition_filter: searchParams.get('condition') || null,
        min_price: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : null,
        max_price: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : null,
        sort_option: searchParams.get('sort') || 'distance',
      });
      if (error) {
        console.error('Error fetching products with geo:', error);
        setProducts([]);
        setTotalCount(0);
      } else {
        let filteredData = (data || []) as Product[];
        if (subcategoryFilter) filteredData = filteredData.filter((p) => p.subcategory_id === subcategoryFilter);
        setProducts(sortBoostedFirst(filteredData));
        setTotalCount(filteredData.length);
      }
    } else {
      let query = supabase.from('products').select('*', { count: 'exact' }).eq('status', 'active');
      const q = searchParams.get('q');
      if (q) query = query.ilike('title', `%${q}%`);
      const cat = searchParams.get('category');
      if (cat) query = query.eq('category_id', cat);
      if (subcategoryFilter) query = query.eq('subcategory_id', subcategoryFilter);
      const loc = searchParams.get('location');
      if (loc) query = query.ilike('location', `%${loc}%`);
      const minPrice = searchParams.get('minPrice');
      if (minPrice) query = query.gte('price', Number(minPrice));
      const maxPrice = searchParams.get('maxPrice');
      if (maxPrice && Number(maxPrice) < 10000) query = query.lte('price', Number(maxPrice));
      const cond = searchParams.get('condition');
      if (cond) query = query.eq('condition', cond);
      const sort = searchParams.get('sort') || 'recent';
      switch (sort) {
        case 'price_asc': query = query.order('price', { ascending: true }); break;
        case 'price_desc': query = query.order('price', { ascending: false }); break;
        default: query = query.order('created_at', { ascending: false });
      }
      const { data, count, error } = await query.limit(50);
      if (error) console.error('Error fetching products:', error);
      else {
        setProducts(sortBoostedFirst((data || []) as Product[]));
        setTotalCount(count || 0);
      }
    }
    setLoading(false);
  };

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedSubcategory) params.set('subcategory', selectedSubcategory);
    if (!useGeoFilter && location) params.set('location', location);
    if (priceRange[0] > 0) params.set('minPrice', priceRange[0].toString());
    if (priceRange[1] < 10000) params.set('maxPrice', priceRange[1].toString());
    if (sortBy !== 'recent') params.set('sort', sortBy);
    if (condition) params.set('condition', condition);
    if (useGeoFilter) { params.set('geo', 'true'); params.set('radius', distanceRadius.toString()); }
    setSearchParams(params);
  }, [searchQuery, selectedCategory, selectedSubcategory, location, priceRange, sortBy, condition, useGeoFilter, distanceRadius]);

  const clearFilters = () => {
    setSearchQuery(''); setSelectedCategory(''); setSelectedSubcategory(''); setLocation(''); setPriceRange([0, 10000]); setSortBy('recent'); setCondition(''); setUseGeoFilter(false); setDistanceRadius(25); setActiveQuickFilter(null); setSearchParams({});
  };

  const handleQuickFilter = (filterId: string) => {
    setActiveQuickFilter(filterId || null);
    if (!filterId) { clearFilters(); return; }
    const params = new URLSearchParams();
    switch (filterId) {
      case 'new': setCondition('new'); params.set('condition', 'new'); break;
      case 'recent': setSortBy('recent'); break;
      case 'deals': setPriceRange([0, 100]); params.set('maxPrice', '100'); break;
      case 'nearby': setUseGeoFilter(true); if (!geolocation.hasLocation) geolocation.requestLocation(); params.set('geo', 'true'); params.set('radius', '10'); setDistanceRadius(10); break;
    }
    setSearchParams(params);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    const params = new URLSearchParams(searchParams);
    value === 'recent' ? params.delete('sort') : params.set('sort', value);
    setSearchParams(params);
  };

  const handleCategoryChange = (value: string) => { setSelectedCategory(value); setSelectedSubcategory(''); };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString); const now = new Date(); const diffMs = now.getTime() - date.getTime(); const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) { const diffHours = Math.floor(diffMs / (1000 * 60 * 60)); return diffHours === 0 ? 'Hace unos min' : `Hace ${diffHours}h`; }
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const formatDistance = (km: number | undefined) => {
    if (km === undefined || km === null) return '';
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const hasActiveFilters = searchQuery || selectedCategory || selectedSubcategory || location || priceRange[0] > 0 || priceRange[1] < 10000 || condition || useGeoFilter;
  const currentFilters = { query: searchQuery || undefined, category_id: selectedCategory || undefined, subcategory_id: selectedSubcategory || undefined, min_price: priceRange[0] > 0 ? priceRange[0] : undefined, max_price: priceRange[1] < 10000 ? priceRange[1] : undefined, condition: condition || undefined, location: location || undefined, radius_km: useGeoFilter ? distanceRadius : undefined };
  const mappableProducts = products.filter((p) => p.latitude && p.longitude);

  return (
    <>
      <Helmet><title>{searchQuery ? `${searchQuery} - Buscar` : 'Explorar productos'} | Reveta</title><meta name="description" content="Encuentra productos de segunda mano cerca de ti. Filtra por categoría, precio y ubicación." /></Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <CategoryNav />
        <main className="flex-1 container py-6">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} placeholder="¿Qué estás buscando?" className="pl-12 h-12 text-base" /></div>
            <Button onClick={applyFilters} className="h-12 px-6">Buscar</Button>
            <Sheet><SheetTrigger asChild><Button variant="outline" size="icon" className="h-12 w-12 lg:hidden"><SlidersHorizontal className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="overflow-y-auto"><SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader><div className="mt-6"><SearchFilters categories={categories} selectedCategory={selectedCategory} setSelectedCategory={handleCategoryChange} selectedSubcategory={selectedSubcategory} setSelectedSubcategory={setSelectedSubcategory} location={location} setLocation={setLocation} priceRange={priceRange} setPriceRange={setPriceRange} condition={condition} setCondition={setCondition} useGeoFilter={useGeoFilter} setUseGeoFilter={setUseGeoFilter} distanceRadius={distanceRadius} setDistanceRadius={setDistanceRadius} geolocation={geolocation} onApply={applyFilters} onClear={clearFilters} hasActiveFilters={!!hasActiveFilters} /></div></SheetContent></Sheet>
          </div>

          <div className="mb-6"><QuickFilters onQuickFilter={handleQuickFilter} activeQuickFilter={activeQuickFilter} /></div>

          <div className="flex gap-8">
            <aside className="hidden lg:block w-72 shrink-0"><div className="sticky top-24 bg-card rounded-xl p-6 border border-border/50 shadow-sm"><h2 className="font-semibold mb-6 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Filtros</h2><SearchFilters categories={categories} selectedCategory={selectedCategory} setSelectedCategory={handleCategoryChange} selectedSubcategory={selectedSubcategory} setSelectedSubcategory={setSelectedSubcategory} location={location} setLocation={setLocation} priceRange={priceRange} setPriceRange={setPriceRange} condition={condition} setCondition={setCondition} useGeoFilter={useGeoFilter} setUseGeoFilter={setUseGeoFilter} distanceRadius={distanceRadius} setDistanceRadius={setDistanceRadius} geolocation={geolocation} onApply={applyFilters} onClear={clearFilters} hasActiveFilters={!!hasActiveFilters} /></div></aside>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"><div><h1 className="text-2xl font-bold">{useGeoFilter && geolocation.hasLocation ? 'Productos cerca de ti' : searchQuery ? `Resultados para "${searchQuery}"` : 'Todos los productos'}</h1><p className="text-muted-foreground">{totalCount} producto{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}{useGeoFilter && geolocation.hasLocation && ` a menos de ${distanceRadius} km`}</p></div><div className="flex items-center gap-3">{user && hasActiveFilters && <Button variant="outline" size="sm" onClick={() => setSaveSearchDialogOpen(true)}><Bookmark className="h-4 w-4 mr-2" />Guardar búsqueda</Button>}<SortSelect value={sortBy} onChange={handleSortChange} showDistanceOption={useGeoFilter && geolocation.hasLocation} /><ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} /></div></div>
              <SaveSearchDialog open={saveSearchDialogOpen} onOpenChange={setSaveSearchDialogOpen} filters={currentFilters} />
              <ActiveFilters useGeoFilter={useGeoFilter} distanceRadius={distanceRadius} searchQuery={searchQuery} selectedCategory={selectedCategory} selectedSubcategory={selectedSubcategory} categories={categories} subcategories={subcategories} location={location} condition={condition} priceRange={priceRange} hasLocation={geolocation.hasLocation} onRemoveGeo={() => { setUseGeoFilter(false); applyFilters(); }} onRemoveSearch={() => { setSearchQuery(''); applyFilters(); }} onRemoveCategory={() => { setSelectedCategory(''); setSelectedSubcategory(''); applyFilters(); }} onRemoveSubcategory={() => { setSelectedSubcategory(''); applyFilters(); }} onRemoveLocation={() => { setLocation(''); applyFilters(); }} onRemoveCondition={() => { setCondition(''); applyFilters(); }} onRemovePrice={() => { setPriceRange([0, 10000]); applyFilters(); }} />
              {loading ? <div className="flex items-center justify-center py-12"><div className="flex flex-col items-center gap-4"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /><p className="text-muted-foreground">Buscando productos...</p></div></div> : products.length === 0 ? <div className="text-center py-12 bg-muted/30 rounded-xl"><Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium mb-2">No se encontraron productos</h3><p className="text-muted-foreground mb-4">{useGeoFilter ? 'No hay productos cerca de ti. Prueba aumentar el radio de búsqueda.' : 'Prueba con otros filtros o términos de búsqueda'}</p><Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button></div> : viewMode === 'map' ? <ProductsMap products={mappableProducts as any} userLocation={geolocation.hasLocation ? { latitude: geolocation.latitude!, longitude: geolocation.longitude! } : null} className="h-[600px]" /> : viewMode === 'split' ? <div className="grid grid-cols-2 gap-6 h-[700px]"><div className="overflow-y-auto pr-2 scrollbar-thin"><ProductGrid products={products} favorites={favorites} useGeoFilter={useGeoFilter} formatDistance={formatDistance} formatDate={formatDate} selectedProductId={hoveredProductId} onProductHover={setHoveredProductId} compact /></div><div className="sticky top-0"><ProductsMap products={mappableProducts as any} userLocation={geolocation.hasLocation ? { latitude: geolocation.latitude!, longitude: geolocation.longitude! } : null} className="h-full rounded-xl" /></div></div> : <ProductGrid products={products} favorites={favorites} useGeoFilter={useGeoFilter} formatDistance={formatDistance} formatDate={formatDate} selectedProductId={hoveredProductId} onProductHover={setHoveredProductId} />}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default SearchPage;
