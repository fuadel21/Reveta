import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Youtube, Heart, ArrowUpRight } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card py-16 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
      
      <div className="container relative">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-6 group">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-hero shadow-lg transition-transform duration-300 group-hover:scale-105">
                <span className="text-xl font-bold text-primary-foreground">R</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Reveta</span>
            </Link>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              La mejor plataforma para comprar y vender productos de segunda mano cerca de ti.
            </p>
            <div className="flex gap-2">
              {[
                { icon: Facebook, label: 'Facebook' },
                { icon: Twitter, label: 'Twitter' },
                { icon: Instagram, label: 'Instagram' },
                { icon: Youtube, label: 'YouTube' },
              ].map(({ icon: Icon, label }) => (
                <a 
                  key={label}
                  href="#" 
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-110 hover:shadow-lg"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">Explorar</h3>
            <ul className="space-y-3">
              {[
                { to: '/search', label: 'Todas las categorías' },
                { to: '/search?sort=recent', label: 'Productos destacados' },
                { to: '/search', label: 'Cerca de mí' },
                { to: '/search?sort=price_asc', label: 'Mejores ofertas' },
              ].map(({ to, label }) => (
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
            <h3 className="font-semibold text-foreground mb-6 text-lg">Ayuda</h3>
            <ul className="space-y-3">
              {['Cómo funciona', 'Centro de ayuda', 'Consejos de seguridad', 'Contacto'].map((item) => (
                <li key={item}>
                  <a 
                    href="#" 
                    className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    {item}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-6 text-lg">Legal</h3>
            <ul className="space-y-3">
              {[
                { to: '/terms', label: 'Términos de uso' },
                { to: '/privacy', label: 'Política de privacidad' },
                { to: '/cookies', label: 'Cookies' },
              ].map(({ to, label }) => (
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
        </div>
        
        <div className="mt-16 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-muted-foreground flex items-center gap-1">
              Hecho con <Heart className="h-4 w-4 text-destructive fill-destructive animate-pulse" /> en España © 2026 Reveta
            </p>
            <div className="flex items-center gap-6">
              <span className="text-sm text-muted-foreground">Descarga la app:</span>
              <a href="#" className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group">
                App Store
                <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </a>
              <a href="#" className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group">
                Google Play
                <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
