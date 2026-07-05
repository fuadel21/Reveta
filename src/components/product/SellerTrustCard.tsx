import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SellerRating from '@/components/SellerRating';
import VerifiedBadge from '@/components/VerifiedBadge';
import ReportDialog from '@/components/ReportDialog';
import BlockUserButton from '@/components/BlockUserButton';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, CheckCircle2, MessageCircle, Package, Shield, ShoppingBag, Star, Trophy } from 'lucide-react';

interface SellerTrustCardProps {
  seller: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    verified: boolean | null;
  };
  productId: string;
  isOwner: boolean;
  activeProductsCount?: number;
  onContactSeller: () => void;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
}

const getMemberSince = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

const getAccountAgeInDays = (dateString: string) => {
  const createdAt = new Date(dateString).getTime();
  if (Number.isNaN(createdAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));
};

const getTrustLabel = (score: number) => {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Muy fiable';
  if (score >= 50) return 'Fiable';
  if (score >= 30) return 'Nuevo en crecimiento';
  return 'Nuevo vendedor';
};

const SellerTrustCard = ({ seller, productId, isOwner, activeProductsCount = 0, onContactSeller }: SellerTrustCardProps) => {
  const [soldCount, setSoldCount] = useState(0);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ totalReviews: 0, averageRating: 0 });

  useEffect(() => {
    fetchTrustStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller.id]);

  const fetchTrustStats = async () => {
    const [{ count: soldProductsCount }, { data: reviews }] = await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', seller.id)
        .eq('status', 'sold'),
      (supabase as any)
        .from('reviews')
        .select('rating')
        .eq('reviewed_id', seller.id),
    ]);

    const validReviews = (reviews || []).filter((review: { rating?: number }) => typeof review.rating === 'number');
    const totalReviews = validReviews.length;
    const averageRating = totalReviews > 0
      ? validReviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) / totalReviews
      : 0;

    setSoldCount(soldProductsCount || 0);
    setReviewStats({ totalReviews, averageRating });
  };

  const accountAgeDays = getAccountAgeInDays(seller.created_at);

  const trustScore = useMemo(() => {
    const verificationPoints = seller.verified ? 25 : 0;
    const ratingPoints = reviewStats.totalReviews > 0 ? Math.round((reviewStats.averageRating / 5) * 30) : 0;
    const reviewVolumePoints = Math.min(reviewStats.totalReviews * 3, 15);
    const soldPoints = Math.min(soldCount * 4, 16);
    const activeProductsPoints = Math.min(activeProductsCount * 2, 8);
    const seniorityPoints = accountAgeDays >= 365 ? 6 : accountAgeDays >= 90 ? 4 : accountAgeDays >= 30 ? 2 : 0;

    return Math.min(100, verificationPoints + ratingPoints + reviewVolumePoints + soldPoints + activeProductsPoints + seniorityPoints);
  }, [seller.verified, reviewStats.averageRating, reviewStats.totalReviews, soldCount, activeProductsCount, accountAgeDays]);

  const trustLabel = getTrustLabel(trustScore);

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
      <div className="flex items-start gap-4 mb-5">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl font-bold text-primary-foreground overflow-hidden">
          {seller.avatar_url ? <img src={seller.avatar_url} alt={seller.full_name || 'Vendedor'} className="h-full w-full object-cover" /> : seller.full_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold truncate">{seller.full_name || 'Usuario'}</p>
            {seller.verified ? <VerifiedBadge size="sm" /> : <Badge variant="outline">Sin verificar</Badge>}
          </div>
          <SellerRating sellerId={seller.id} size="sm" />
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <CalendarDays className="h-4 w-4" /> Miembro desde {getMemberSince(seller.created_at)}
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-bold">Confianza del vendedor</p>
              <p className="text-xs text-muted-foreground">{trustLabel}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm font-bold">{trustScore}/100</Badge>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${trustScore}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-lg font-bold">{activeProductsCount}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Anuncios activos</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-lg font-bold">{soldCount}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" /> Vendidos</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-lg font-bold">{reviewStats.totalReviews}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Valoraciones</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-lg font-bold">{seller.verified ? 'Sí' : 'Pendiente'}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Verificación</p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-primary/5 border border-primary/10 p-4 mb-5 text-sm">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Valoraciones visibles del vendedor</span></div>
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Historial de ventas y actividad</span></div>
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Chat seguro y compra protegida</span></div>
      </div>

      {!isOwner && (
        <div className="space-y-2">
          <Button className="w-full" onClick={onContactSeller}>
            <MessageCircle className="h-4 w-4 mr-2" /> Contactar con el vendedor
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to={`/search?seller=${seller.id}`}>Ver más productos del vendedor</Link>
          </Button>
          <div className="pt-2 flex flex-col gap-2">
            <ReportDialog productId={productId} userId={seller.id} />
            <BlockUserButton userId={seller.id} userName={seller.full_name || 'este usuario'} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerTrustCard;
