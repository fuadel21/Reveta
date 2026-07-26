import { Link, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingBag } from 'lucide-react';
import NoIndex from '@/components/seo/NoIndex';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();

  return (
    <>
      <NoIndex
        title="Página no encontrada | Reveta"
        description="Esta página no existe en Reveta. Vuelve al inicio, busca productos o explora anuncios de segunda mano cerca de ti."
        robots="noindex,follow,noarchive"
      />
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
        <section className="w-full max-w-2xl rounded-3xl border bg-card p-8 text-center shadow-sm md:p-12" aria-labelledby="not-found-title">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Error 404</p>
          <h1 id="not-found-title" className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
            No encontramos esta página
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            La dirección <span className="break-all font-medium text-foreground">{location.pathname}</span> no existe o ya no está disponible. Puedes continuar desde una de estas opciones.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Button asChild size="lg">
              <Link to="/">
                <Home className="mr-2 h-5 w-5" />
                Ir al inicio
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/search">
                <Search className="mr-2 h-5 w-5" />
                Buscar productos
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/segunda-mano">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Ver segunda mano
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </>
  );
};

export default NotFound;
