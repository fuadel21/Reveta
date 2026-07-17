import { AlertTriangle, BadgeCheck, CheckCircle2, CreditCard, MessageCircle, PackageCheck, PhoneCall, ShieldCheck, Truck } from 'lucide-react';

const securePurchaseItems = [
  {
    icon: CreditCard,
    title: 'Pago protegido',
    description: 'Cuando pagas con tarjeta, Reveta registra la operación y Stripe confirma el pago de forma segura.',
  },
  {
    icon: Truck,
    title: 'Envío con seguimiento',
    description: 'Los envíos compatibles pueden guardar seguimiento en Reveta para que comprador y vendedor tengan trazabilidad.',
  },
  {
    icon: MessageCircle,
    title: 'Chat privado',
    description: 'Mantén preguntas, acuerdos, fotos y ofertas dentro del chat para tener historial si surge una incidencia.',
  },
  {
    icon: PhoneCall,
    title: 'Llamada privada',
    description: 'Puedes hablar por audio desde Reveta sin publicar ni compartir números de teléfono entre usuarios.',
  },
  {
    icon: ShieldCheck,
    title: 'Incidencias Reveta',
    description: 'Si algo no encaja, puedes abrir una incidencia desde la operación para que quede registrada y revisable.',
  },
  {
    icon: BadgeCheck,
    title: 'Vendedor valorado',
    description: 'Consulta reputación, antigüedad, valoraciones, productos vendidos y señales de verificación antes de comprar.',
  },
];

const checklist = [
  'Comprueba fotos reales, estado, accesorios y posibles defectos.',
  'Usa el chat de Reveta para dejar constancia de los acuerdos.',
  'Prioriza pago con tarjeta si quieres operación registrada automáticamente.',
  'Desconfía de enlaces externos, prisas raras o precios demasiado bajos.',
];

export const ProductBuyerConfidence = () => {
  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <PackageCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Reveta Compra Segura</p>
          <h2 className="text-base font-bold text-foreground">Compra, habla y acuerda dentro de Reveta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Una capa de confianza para comprar segunda mano con chat, llamada privada, pago registrado, seguimiento e incidencias.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {securePurchaseItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-xl border border-border/60 bg-card/90 p-3 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-border/60 bg-card/90 p-4">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-bold text-foreground">Checklist rápido antes de comprar</p>
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
            Alerta antifraude: no aceptes enlaces externos, códigos SMS, pagos por adelantado fuera de Reveta ni usuarios que presionan para cerrar rápido.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ProductBuyerConfidence;
