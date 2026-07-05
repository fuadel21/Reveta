import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SellerRating from '@/components/SellerRating';
import VerifiedBadge from '@/components/VerifiedBadge';
import ReportDialog from '@/components/ReportDialog';
import BlockUserButton from '@/components/BlockUserButton';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Award, CalendarDays, CheckCircle2, Clock3, MessageCircle, Package, Shield, ShoppingBag, Store, TrendingUp, Trophy } from 'lucide-react';

interface SellerTrustCardProps {
  seller: {
    id: string;
    username?: string | null;
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

const getAccountAgeLabel = (days: number) => {
  if (days >= 730) return 'Más de 2 años en Reveta';
  if (days >= 365) return 'Más de 1 año en Reveta';
  if (days >= 90) return 'Más de 3 meses en Reveta';
  if (days >= 30) return 'Más de 1 mes en Reveta';
  return 'Cuenta reciente';
};

const getTrustLabel = (score: number) => {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Muy fiable';
  if (score >= 50) return 'Fiable';
  if (score >= 30) return 'Nuevo en crecimiento';
  return 'Nuevo vendedor';
};

const getReputationLevel = (score: number) => {
  if (score >= 85) return 'Vendedor destacado';
  if (score >= 70) return 'Vendedor recomendado';
  if (score >= 50) return 'Vendedor fiable';
  if (score >= 30) return 'Vendedor en progreso';
  return 'Vendedor nuevo';
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
  const sellerProfilePath = `/usuario/${seller.username || seller.id}`;
  const sellerName = seller.full_name || seller.username || 'Usuario';

  const trustBreakdown = useMemo(() => {
    const verificationPoints = seller.verified ? 25 : 0;
    const ratingPoints = reviewStats.totalReviews > 0 ? Math.round((reviewStats.averageRating / 5) * 30) : 0;
    const reviewVolumePoints = Math.min(reviewStats.totalReviews * 3, 15);
    const soldPoints = Math.min(soldCount * 4, 16);
    const activeProductsPoints = Math.min(activeProductsCount * 2, 8);
    const seniorityPoints = accountAgeDays >= 365 ? 6 : accountAgeDays >= 90 ? 4 : accountAgeDays >= 30 ? 2 : 0;

    return {
      verificationPoints,
      ratingPoints,
      reviewVolumePoints,
      soldPoints,
      activeProductsPoints,
      seniorityPoints,
    };
  }, [seller.verified, reviewStats.averageRating, reviewStats.totalReviews, soldCount, activeProductsCount, accountAgeDays]);

  const trustScore = useMemo(() => {
    return Math.min(
      100,
      trustBreakdown.verificationPoints +
        trustBreakdown.ratingPoints +
        trustBreakdown.reviewVolumePoints +
        trustBreakdown.soldPoints +
        trustBreakdown.activeProductsPoints +
        trustBreakdown.seniorityPoints,
    );
  }, [trustBreakdown]);

  const trustLabel = getTrustLabel(trustScore);
  const reputationLevel = getReputationLevel(trustScore);
  const accountAgeLabel = getAccountAgeLabel(accountAgeDays);
  const averageRatingLabel = reviewStats.totalReviews > 0 ? reviewStats.averageRating.toFixed(1) : '—';

  const trustSignals = [
    seller.verified ? 'Identidad verificada' : 'Identidad pendiente de verificar',
    reviewStats.totalReviews > 0 ? `${reviewStats.totalReviews} valoraciones públicas` : 'Todavía sin valoraciones',
    soldCount > 0 ? `${soldCount} productos vendidos` : 'Sin ventas registradas todavía',
    activeProductsCount > 0 ? `${activeProductsCount} anuncios activos` : 'Sin anuncios activos adicionales',
    accountAgeLabel,
  ];

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
      <div className="mb-5 flex items-start gap-4">
        <Link to={sellerProfilePath} className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl font-bold text-primary-foreground overflow-hidden transition hover:scale-105" aria-label={`Ver perfil de ${sellerName}`}>
          {seller.avatar_url ? <img src={seller.avatar_url} alt={sellerName} className="h-full w-full object-cover" /> : sellerName[0]?.toUpperCase() || 'U'}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={sellerProfilePath} className="font-semibold truncate hover:text-primary hover:underline">
              {sellerName}
            </Link>
            {seller.verified ? <VerifiedBadge size="sm" /> : <Badge variant="outline">Sin verificar</Badge>}
          </div>
          {seller.username && <p className="text-xs text-muted-foreground">@{seller.username}</p>}
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
              <p className="text-sm font-bold">Reputación del vendedor</p>
              <p className="text-xs text-muted-foreground">{reputationLevel} · {trustLabel}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm font-bold">{trustScore}/100</Badge>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${trustScore}%` }} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Cálculo orientativo basado en verificación, valoraciones, ventas, anuncios activos y antigüedad de la cuenta.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <p className="text-lg font-bold">{averageRatingLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">Nota media</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <p className="text-lg font-bold">{reviewStats.totalReviews}</p>
          <p className="mt-1 text-xs text-muted-foreground">Opiniones</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3 text-center">
          <p className="text-lg font-bold">{soldCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Vendidos</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-lg font-bold">{activeProductsCount}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Anuncios activos</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-lg font-bold">{seller.verified ? 'Sí' : 'Pendiente'}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Verificación</p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-border/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Resumen de confianza</p>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          {trustSignals.map((signal) => (
            <div key={signal} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              <span>{signal}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-primary/5 border border-primary/10 p-4 mb-5 text-sm">
        <div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /><span>Nivel: {reputationLevel}</span></div>
        <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><span>{accountAgeLabel}</span></div>
        <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary" /><span>Historial de ventas y actividad visible</span></div>
      </div>

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> Antes de pagar
        </div>
        <ul className="space-y-1.5">
          <li>• Revisa fotos, descripción, estado y accesorios incluidos.</li>
          <li>• Mantén la conversación y los acuerdos dentro del chat.</li>
          <li>• Desconfía si te pide pago externo o cerrar con urgencia.</li>
        </ul>
      </div>

      {!isOwner && (
        <div className="space-y-2">
          <Button className="w-full" onClick={onContactSeller}>
            <MessageCircle className="h-4 w-4 mr-2" /> Contactar con el vendedor
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to={sellerProfilePath}><Store className="h-4 w-4 mr-2" /> Ver perfil completo</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to={`/search?seller=${seller.id}`}>Ver más productos del vendedor</Link>
          </Button>
          <div className="pt-2 flex flex-col gap-2">
            <ReportDialog productId={productId} userId={seller.id} />
            <BlockUserButton userId={seller.id} userName={sellerName} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerTrustCard;
