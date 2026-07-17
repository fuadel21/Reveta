import { CreditCard, MessageCircle, ShieldCheck, Truck } from 'lucide-react';

const items = [
  { icon: CreditCard, text: 'Pago con tarjeta procesado por Stripe; Reveta no guarda los datos de tu tarjeta.' },
  { icon: Truck, text: 'Si eliges envío compatible, Reveta guarda seguimiento de la operación.' },
  { icon: MessageCircle, text: 'Usa el chat privado para dejar constancia de entrega, acuerdos y dudas.' },
  { icon: ShieldCheck, text: 'Puedes abrir una incidencia desde tus transacciones si algo no encaja.' },
];

export const CheckoutTrustCard = () => {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <div>
          <p className="font-bold text-foreground">Reveta Compra Segura</p>
          <p className="text-xs text-muted-foreground">Más confianza antes de confirmar tu compra.</p>
        </div>
      </div>
      <div className="space-y-2 text-xs text-muted-foreground">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.text} className="flex gap-2">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CheckoutTrustCard;
