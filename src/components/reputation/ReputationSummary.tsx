import { Star, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type Reputation = {
  average_rating?: number | null;
  review_count?: number | null;
};

interface ReputationSummaryProps {
  reputation?: Reputation | null;
  verified?: boolean;
  compact?: boolean;
}

export default function ReputationSummary({ reputation, verified = false, compact = false }: ReputationSummaryProps) {
  const count = reputation?.review_count ?? 0;
  const rating = reputation?.average_rating ?? null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Star className="h-4 w-4 fill-current text-amber-500" />
        <span className="font-medium">{rating === null ? 'Sin valoraciones' : rating.toFixed(1)}</span>
        {rating !== null && <span className="text-muted-foreground">({count})</span>}
        {verified && <ShieldCheck className="h-4 w-4 text-primary" aria-label="Usuario verificado" />}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Reputación</p>
          <div className="mt-1 flex items-center gap-2">
            <Star className="h-5 w-5 fill-current text-amber-500" />
            <span className="text-2xl font-bold">{rating === null ? '—' : rating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">
              {count === 0 ? 'Sin valoraciones todavía' : `${count} ${count === 1 ? 'valoración' : 'valoraciones'}`}
            </span>
          </div>
        </div>
        {verified && <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" />Verificado</Badge>}
      </CardContent>
    </Card>
  );
}
