import { AlertTriangle, BadgeCheck, CheckCircle2, CreditCard, MessageCircle, PackageCheck, ShieldCheck, Truck } from 'lucide-react';

const trustItems = [
  {
    icon: ShieldCheck,
    title: 'Compra con registro',
    description: 'Prioriza el pago dentro de Reveta para que la operación quede registrada y sea más fácil revisarla si hay un problema.',
  },
  {
    icon: MessageCircle,
    title: 'Chat registrado',
    description: 'Negocia por el chat de Reveta, guarda acuerdos y evita cerrar por enlaces externos o mensajes fuera de la plataforma.',
  },
  {
    icon: Truck,
    title: 'Entrega clara',
    description: 'Pregunta si el producto se entrega en mano o con envío, quién paga el transporte y cuándo se confirma la entrega.',
  },
  {
    icon: BadgeCheck,
    title: 'Revisa al vendedor',
    description: 'Mira antigüedad, valoraciones, ventas, anuncios activos y verificación antes de decidir.',
  },
];

const checklist = [
  'Pide fotos reales y actuales si tienes dudas.',
  'Comprueba estado, accesorios incluidos y posibles defectos.',
  'No envíes dinero por adelantado fuera de Reveta.',
  'Desconfía de prisas, excusas raras o precios demasiado bajos.',
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
            Antes de pagar, revisa el producto, el vendedor y deja los acuerdos importantes dentro del chat de Reveta.
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

      <div className="mt-4 rounded-xl border border-border/60 bg-card/80 p-4">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-foreground">Checklist antes de comprar</p>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {checklist.map((item) => (
            <div key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Alerta antifraude: no aceptes enlaces externos, pagos por adelantado ni vendedores que presionan para cerrar fuera de Reveta.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <CreditCard className="h-4 w-4 text-primary" />
        <span>Consejo Reveta: usa chat, pago dentro de Reveta y reporta cualquier comportamiento sospechoso.</span>
      </div>
    </section>
  );
};

export default ProductBuyerConfidence;
