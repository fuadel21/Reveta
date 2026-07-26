import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { PackageSearch, RefreshCw, Search, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

interface PublicResourceGateProps {
  type: 'product' | 'seller';
  children: ReactNode;
}

type ResourceState = 'loading' | 'found' | 'missing' | 'error';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const PublicResourceGate = ({ type, children }: PublicResourceGateProps) => {
  const { id = '' } = useParams<{ id: string }>();
  const [state, setState] = useState<ResourceState>('loading');

  const validateResource = useCallback(async () => {
    const identifier = decodeURIComponent(id).trim();
    if (!identifier) {
      setState('missing');
      return;
    }

    setState('loading');

    try {
      if (type === 'product') {
        const { data, error } = await supabase
          .from('products')
          .select('id')
          .eq('id', identifier)
          .maybeSingle();

        if (error) throw error;
        setState(data ? 'found' : 'missing');
        return;
      }

      const normalizedIdentifier = identifier.toLowerCase();
      const profileQuery = supabase.from('profiles').select('id');
      const { data, error } = isUuid(normalizedIdentifier)
        ? await profileQuery.eq('id', normalizedIdentifier).maybeSingle()
        : await profileQuery.eq('username', normalizedIdentifier).maybeSingle();

      if (error) throw error;
      setState(data ? 'found' : 'missing');
    } catch (error) {
      console.error(`Error validating public ${type}:`, error);
      setState('error');
    }
  }, [id, type]);

  useEffect(() => {
    void validateResource();
  }, [validateResource]);

  if (state === 'found') return <>{children}</>;

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-label="Comprobando contenido" />
      </div>
    );
  }

  const isMissing = state === 'missing';
  const title = isMissing
    ? type === 'product'
      ? 'Producto no encontrado | Reveta'
      : 'Vendedor no encontrado | Reveta'
    : 'No se pudo cargar el contenido | Reveta';
  const heading = isMissing
    ? type === 'product'
      ? 'Este producto ya no está disponible'
      : 'Este perfil de vendedor no existe'
    : 'No hemos podido comprobar esta página';
  const description = isMissing
    ? type === 'product'
      ? 'El anuncio puede haberse eliminado, haber caducado o contener un enlace incorrecto. Puedes seguir explorando productos activos en Reveta.'
      : 'El perfil puede haberse eliminado, haber cambiado de nombre o contener un enlace incorrecto. Puedes seguir explorando vendedores y anuncios activos.'
    : 'Se ha producido un problema temporal al consultar Reveta. Reintenta la comprobación o continúa navegando por los anuncios disponibles.';

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="noindex,follow,noarchive" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container flex flex-1 items-center justify-center py-12 md:py-20">
          <section className="w-full max-w-2xl rounded-3xl border bg-card p-8 text-center shadow-sm md:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {type === 'product' ? <PackageSearch className="h-8 w-8" /> : <Store className="h-8 w-8" />}
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-primary">
              {isMissing ? 'Contenido no encontrado' : 'Error temporal'}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{heading}</h1>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{description}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {!isMissing && (
                <Button type="button" onClick={() => void validateResource()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reintentar
                </Button>
              )}
              <Button asChild variant={isMissing ? 'default' : 'outline'}>
                <Link to="/segunda-mano">
                  <Search className="mr-2 h-4 w-4" />
                  Explorar segunda mano
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Volver al inicio</Link>
              </Button>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default PublicResourceGate;
