import { Badge } from '@/components/ui/badge';
import { CreditCard, MessageCircle, Phone, ShieldCheck } from 'lucide-react';

const PurchaseDecisionGuide = () => {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <p className="text-sm font-bold text-foreground">Elige cómo comprar</p>
      </div>

      <div className="grid gap-3 text-sm">
        <div className="rounded-lg bg-background/80 p-3 border border-border/60">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Hacer oferta / Chat</span>
            <Badge variant="secondary">Negociar</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Úsalo si quieres preguntar algo, negociar precio o acordar detalles con el vendedor.</p>
        </div>

        <div className="rounded-lg bg-background/80 p-3 border border-border/60">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Comprar ahora</span>
            <Badge>Más seguro</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Paga con Compra Protegida. Reveta protege tu dinero hasta que recibas el producto.</p>
        </div>

        <div className="rounded-lg bg-background/80 p-3 border border-border/60">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> Llamada privada</span>
            <Badge variant="outline">Sin compartir número</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Úsala para resolver dudas rápidas sin mostrar tu teléfono personal.</p>
        </div>
      </div>
    </div>
  );
};

export default PurchaseDecisionGuide;
