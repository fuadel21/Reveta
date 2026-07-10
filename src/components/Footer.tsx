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
    <footer className="border-t border-border bg-card py-16 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
      
      <div className="container relative">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-6 group" aria-label="Reveta inicio">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-border bg-background shadow-lg transition-transform duration-300 group-hover:scale-105">
                <img src="/favicon.svg" alt="Reveta" className="h-full w-full object-cover" />
              </div>
              <span className="text-2xl font-bold text-foreground">Reveta</span>
            </Link>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Marketplace para comprar y vender productos de segunda mano cerca de ti.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Publica gratis, negocia por chat y usa valoraciones, ofertas y operaciones registradas para comprar y vender con más claridad.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">Explorar</h3>
            <ul className="space-y-3">
              {exploreLinks.map(({ to, label }) => (
                <li key={label}>
                  <Link 
                    to={to} 
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    {label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">Por ciudad</h3>
            <ul className="space-y-3">
              {cityLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link 
                    to={to} 
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    {label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">Búsquedas populares</h3>
            <ul className="space-y-3">
              {categoryLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link 
                    to={to} 
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    {label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">Legal</h3>
            <ul className="space-y-3">
              {legalLinks.map(({ to, label }) => (
                <li key={label}>
                  <Link 
                    to={to} 
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    {label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="/sitemap.xml"
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                >
                  Sitemap
                  <ArrowUpRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-muted-foreground flex items-center gap-1">
              Hecho con <Heart className="h-4 w-4 text-destructive fill-destructive animate-pulse" /> en España © 2026 Reveta
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <Link to="/segunda-mano" className="hover:text-primary transition-colors">Segunda mano</Link>
              <Link to="/segunda-mano/barcelona" className="hover:text-primary transition-colors">Barcelona</Link>
              <Link to="/segunda-mano/girona" className="hover:text-primary transition-colors">Girona</Link>
              <Link to="/segunda-mano/pineda-de-mar" className="hover:text-primary transition-colors">Pineda de Mar</Link>
              <Link to="/segunda-mano/blanes" className="hover:text-primary transition-colors">Blanes</Link>
              <Link to="/segunda-mano/lloret-de-mar" className="hover:text-primary transition-colors">Lloret de Mar</Link>
              <Link to="/seguridad" className="hover:text-primary transition-colors">Seguridad</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
