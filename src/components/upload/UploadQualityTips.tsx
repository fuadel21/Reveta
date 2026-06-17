import { BadgeCheck, Camera, Euro, MapPin, Sparkles } from 'lucide-react';

const tips = [
  {
    icon: Camera,
    title: 'Sube fotos claras',
    description: 'Los anuncios con varias fotos reales generan más confianza y reciben más mensajes.',
  },
  {
    icon: Sparkles,
    title: 'Título directo',
    description: 'Escribe marca, modelo y detalle principal. Ejemplo: “iPhone 13 128GB azul”.',
  },
  {
    icon: Euro,
    title: 'Precio competitivo',
    description: 'Un precio realista ayuda a vender antes. Puedes aceptar ofertas desde el chat.',
  },
  {
    icon: MapPin,
    title: 'Ubicación útil',
    description: 'Añade ciudad o usa ubicación actual para aparecer en búsquedas cercanas.',
  },
];

export const UploadQualityTips = () => {
  return (
    <aside className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <BadgeCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Consejos para vender antes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completa bien el anuncio para que aparezca mejor en búsquedas y genere más confianza.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {tips.map((tip) => {
          const Icon = tip.icon;
          return (
            <div key={tip.title} className="rounded-xl border border-border/60 bg-card/80 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">{tip.title}</p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{tip.description}</p>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default UploadQualityTips;
