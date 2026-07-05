import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, CreditCard, MessageCircle, PackageCheck, ShieldCheck, Truck } from 'lucide-react';

const trustItems = [
  {
    icon: ShieldCheck,
    title: 'Compra protegida',
    description: 'Paga desde Reveta y mantén el control hasta recibir el producto.',
  },
  {
    icon: MessageCircle,
    title: 'Negocia por chat',
    description: 'Habla con el vendedor, envía ofertas y guarda toda la conversación.',
  },
  {
    icon: Truck,
    title: 'Envío o trato local',
    description: 'Elige comprar online o cerrar el trato en persona si ambos lo preferís.',
  },
  {
    icon: BadgeCheck,
    title: 'Vendedor valorado',
    description: 'Revisa valoraciones, perfil y señales de confianza antes de comprar.',
  },
];

export const ProductBuyerConfidence = () => {
  return (
    <section className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <PackageCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Compra con más seguridad en Reveta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Antes de pagar, comprueba el producto, habla con el vendedor y usa las herramientas de protección de la plataforma.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-xl border border-border/60 bg-card/80 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Alerta antifraude: no aceptes enlaces externos, pagos por adelantado ni vendedores que presionan para cerrar fuera de Reveta.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <span>Consejo: evita pagos externos si no conoces al vendedor.</span>
        </div>
        <Link to="/seguridad" className="font-semibold text-primary hover:underline">
          Ver Reveta Protección
        </Link>
      </div>
    </section>
  );
};

export default ProductBuyerConfidence;
