import { Link } from "react-router-dom";
import { Heart, ArrowUpRight } from "lucide-react";

const cityLinks = [
  { to: "/segunda-mano/barcelona", label: "Segunda mano Barcelona" },
  { to: "/segunda-mano/madrid", label: "Segunda mano Madrid" },
  { to: "/segunda-mano/valencia", label: "Segunda mano Valencia" },
  { to: "/segunda-mano/girona", label: "Segunda mano Girona" },
  { to: "/segunda-mano/tarragona", label: "Segunda mano Tarragona" },
  { to: "/segunda-mano/lleida", label: "Segunda mano Lleida" },
  { to: "/segunda-mano/reus", label: "Segunda mano Reus" },
  { to: "/segunda-mano/badalona", label: "Segunda mano Badalona" },
  { to: "/segunda-mano/hospitalet-de-llobregat", label: "Segunda mano Hospitalet" },
  { to: "/segunda-mano/sabadell", label: "Segunda mano Sabadell" },
  { to: "/segunda-mano/terrassa", label: "Segunda mano Terrassa" },
  { to: "/segunda-mano/mataro", label: "Segunda mano Mataró" },
  { to: "/segunda-mano/pineda-de-mar", label: "Segunda mano Pineda de Mar" },
  { to: "/segunda-mano/lloret-de-mar", label: "Segunda mano Lloret de Mar" },
  { to: "/segunda-mano/blanes", label: "Segunda mano Blanes" },
  { to: "/segunda-mano/malgrat-de-mar", label: "Segunda mano Malgrat de Mar" },
  { to: "/segunda-mano/figueres", label: "Segunda mano Figueres" },
  { to: "/segunda-mano/granollers", label: "Segunda mano Granollers" },
  { to: "/segunda-mano/vic", label: "Segunda mano Vic" },
];

const categoryLinks = [
  { to: "/segunda-mano/barcelona/electronica", label: "Electrónica Barcelona" },
  { to: "/segunda-mano/barcelona/iphone", label: "iPhone Barcelona" },
  { to: "/segunda-mano/barcelona/muebles", label: "Muebles Barcelona" },
  { to: "/segunda-mano/barcelona/motor", label: "Motor Barcelona" },
  { to: "/segunda-mano/madrid/motor", label: "Motor Madrid" },
  { to: "/segunda-mano/madrid/electronica", label: "Electrónica Madrid" },
  { to: "/segunda-mano/valencia/iphone", label: "iPhone Valencia" },
  { to: "/segunda-mano/valencia/muebles", label: "Muebles Valencia" },
  { to: "/segunda-mano/girona/electronica", label: "Electrónica Girona" },
  { to: "/segunda-mano/tarragona/muebles", label: "Muebles Tarragona" },
  { to: "/segunda-mano/badalona/electronica", label: "Electrónica Badalona" },
  { to: "/segunda-mano/hospitalet-de-llobregat/electronica", label: "Electrónica Hospitalet" },
  { to: "/segunda-mano/sabadell/electronica", label: "Electrónica Sabadell" },
  { to: "/segunda-mano/terrassa/muebles", label: "Muebles Terrassa" },
  { to: "/segunda-mano/mataro/electronica", label: "Electrónica Mataró" },
  { to: "/segunda-mano/pineda-de-mar/electronica", label: "Electrónica Pineda de Mar" },
];

const exploreLinks = [
  { to: '/segunda-mano', label: 'Segunda mano cerca de ti' },
  { to: '/search', label: 'Todas las categorías' },
  { to: '/search?sort=recent', label: 'Últimos productos' },
  { to: '/search?sort=price_asc', label: 'Mejores ofertas' },
  { to: '/upload', label: 'Vender un producto' },
  { to: '/seguridad', label: 'Centro de seguridad' },
];

const legalLinks = [
  { to: '/seguridad', label: 'Centro de seguridad' },
  { to: '/terms', label: 'Términos de uso' },
  { to: '/privacy', label: 'Política de privacidad' },
  { to: '/cookies', label: 'Cookies' },
];

const Footer = () => {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-card py-16">
      <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/2 translate-y-1/2 rounded-full bg-accent/5 blur-3xl" />

      <div className="container relative">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link to="/" className="group mb-6 flex items-center gap-2" aria-label="Reveta inicio">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-border bg-background shadow-lg transition-transform duration-300 group-hover:scale-105">
                <img
                  src="/favicon.svg"
                  alt=""
                  width="44"
                  height="44"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-2xl font-bold text-foreground">Reveta</span>
            </Link>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Marketplace para comprar y vender productos de segunda mano cerca de ti.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Publica gratis, negocia por chat y usa valoraciones, ofertas y operaciones registradas para comprar y vender con más claridad.
            </p>
          </div>

          <nav aria-label="Explorar Reveta">
            <h3 className="mb-6 text-lg font-semibold text-foreground">Explorar</h3>
            <ul className="space-y-3">
              {exploreLinks.map(({ to, label }) => (
                <li key={label}>
                  <Link to={to} className="group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary">
                    {label}
                    <ArrowUpRight aria-hidden="true" className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Segunda mano por ciudad">
            <h3 className="mb-6 text-lg font-semibold text-foreground">Por ciudad</h3>
            <ul className="space-y-3">
              {cityLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary">
                    {label}
                    <ArrowUpRight aria-hidden="true" className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Búsquedas populares">
            <h3 className="mb-6 text-lg font-semibold text-foreground">Búsquedas populares</h3>
            <ul className="space-y-3">
              {categoryLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary">
                    {label}
                    <ArrowUpRight aria-hidden="true" className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Información legal">
            <h3 className="mb-6 text-lg font-semibold text-foreground">Legal</h3>
            <ul className="space-y-3">
              {legalLinks.map(({ to, label }) => (
                <li key={label}>
                  <Link to={to} className="group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary">
                    {label}
                    <ArrowUpRight aria-hidden="true" className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
              <li>
                <a href="/sitemap.xml" className="group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary">
                  Sitemap
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-16 border-t border-border pt-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <p className="flex items-center gap-1 text-muted-foreground">
              Hecho con <Heart aria-hidden="true" className="h-4 w-4 animate-pulse fill-destructive text-destructive" /> en España © 2026 Reveta
            </p>
            <nav aria-label="Enlaces destacados del pie" className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <Link to="/segunda-mano" className="transition-colors hover:text-primary">Segunda mano</Link>
              <Link to="/segunda-mano/barcelona" className="transition-colors hover:text-primary">Barcelona</Link>
              <Link to="/segunda-mano/girona" className="transition-colors hover:text-primary">Girona</Link>
              <Link to="/segunda-mano/pineda-de-mar" className="transition-colors hover:text-primary">Pineda de Mar</Link>
              <Link to="/segunda-mano/blanes" className="transition-colors hover:text-primary">Blanes</Link>
              <Link to="/segunda-mano/lloret-de-mar" className="transition-colors hover:text-primary">Lloret de Mar</Link>
              <Link to="/seguridad" className="transition-colors hover:text-primary">Seguridad</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
