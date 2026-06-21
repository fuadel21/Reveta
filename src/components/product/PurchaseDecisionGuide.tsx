import { Badge } from '@/components/ui/badge';
import { CheckCircle2, CreditCard, MessageCircle, Phone, ShieldCheck, Sparkles } from 'lucide-react';

const PurchaseDecisionGuide = () => {
  return (
    <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
      <div className="mb-3 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-bold text-foreground">¿Qué hacer ahora?</p>
          <p className="text-xs text-muted-foreground">Elige la mejor acción según tu nivel de interés.</p>
        </div>
      </div>

      <div className="mb-4 grid gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Revisa fotos, descripción, estado y ubicación.</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Pregunta dudas antes de pagar si no lo tienes claro.</div>
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Usa Compra Protegida cuando quieras cerrar la compra.</div>
      </div>

      <div className="grid gap-3 text-sm">
        <div className="rounded-lg bg-background/80 p-3 border border-border/60">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Hacer oferta / Chat</span>
            <Badge variant="secondary">Negociar</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Úsalo para preguntar, negociar precio o acordar detalles con el vendedor.</p>
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

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/70 p-3 text-xs text-muted-foreground">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        Consejo: si el precio te encaja y el vendedor tiene buenas señales de confianza, comprar con protección evita riesgos.
      </div>
    </div>
  );
};

export default PurchaseDecisionGuide;
