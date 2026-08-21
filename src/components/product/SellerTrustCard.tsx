import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import VerifiedBadge from '@/components/VerifiedBadge';
import ReportDialog from '@/components/ReportDialog';
import BlockUserButton from '@/components/BlockUserButton';
import ReserveProductButton from '@/components/product/ReserveProductButton';
import ReputationSummary from '@/components/reputation/ReputationSummary';
import { supabase } from '@/integrations/supabase/client';
import { supabaseUntyped } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Award, CalendarDays, CheckCircle2, Clock3, MapPin, MessageCircle, ShoppingBag, Store, TrendingUp, Trophy } from 'lucide-react';

interface SellerTrustCardProps { seller: { id: string; username?: string | null; full_name: string | null; avatar_url: string | null; created_at: string; verified: boolean | null } | null; productId?: string; isOwner?: boolean; activeProductsCount?: number; onContactSeller?: () => void; }
interface ReviewStats { totalReviews: number; averageRating: number; }
const normalizeLocation = (value?: string | null) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(',')[0].trim();
const getMemberSince = (dateString: string) => new Date(dateString).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
const getAccountAgeInDays = (dateString: string) => { const createdAt = new Date(dateString).getTime(); if (Number.isNaN(createdAt)) return 0; return Math.max(0, Math.floor((Date.now() - createdAt) / 86400000)); };
const getAccountAgeLabel = (days: number) => days >= 730 ? 'Más de 2 años en Reveta' : days >= 365 ? 'Más de 1 año en Reveta' : days >= 90 ? 'Más de 3 meses en Reveta' : days >= 30 ? 'Más de 1 mes en Reveta' : 'Cuenta reciente';
const getTrustLabel = (score: number) => score >= 85 ? 'Excelente' : score >= 70 ? 'Muy fiable' : score >= 50 ? 'Fiable' : score >= 30 ? 'Nuevo en crecimiento' : 'Nuevo vendedor';

const SellerTrustCard = ({ seller, productId, isOwner = false, activeProductsCount = 0, onContactSeller }: SellerTrustCardProps) => {
  const { id: routeProductId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [soldCount, setSoldCount] = useState(0);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ totalReviews: 0, averageRating: 0 });
  const [sellerLocation, setSellerLocation] = useState<string | null>(null);
  const [productLocation, setProductLocation] = useState<string | null>(null);

  useEffect(() => {
    if (!seller?.id) return;
    const fetchTrustStats = async () => {
      const effectiveProductId = productId || routeProductId;
      const [{ count: soldProductsCount }, { data: reputation, error: reputationError }, { data: profileData }, productResult] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', seller.id).eq('status', 'sold'),
        supabaseUntyped.from('user_reputation').select('average_rating, review_count').eq('user_id', seller.id).maybeSingle(),
        supabaseUntyped.from('profiles').select('location').eq('id', seller.id).maybeSingle(),
        effectiveProductId ? supabase.from('products').select('location').eq('id', effectiveProductId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (reputationError) console.error('Error loading seller reputation:', reputationError);
      setSoldCount(soldProductsCount || 0);
      setReviewStats({ totalReviews: reputation?.review_count || 0, averageRating: reputation?.average_rating || 0 });
      setSellerLocation(profileData?.location || null);
      setProductLocation((productResult as { data?: { location?: string | null } | null }).data?.location || null);
    };
    void fetchTrustStats();
  }, [seller?.id, productId, routeProductId]);

  if (!seller) return null;
  const effectiveProductId = productId || routeProductId;
  const effectiveIsOwner = isOwner || user?.id === seller.id;
  const accountAgeDays = getAccountAgeInDays(seller.created_at);
  const accountAgeLabel = getAccountAgeLabel(accountAgeDays);
  const sellerProfilePath = `/usuario/${seller.username || seller.id}`;
  const sellerName = seller.full_name || seller.username || 'Usuario';
  const verificationPoints = seller.verified ? 25 : 0;
  const ratingPoints = reviewStats.totalReviews > 0 ? Math.round((reviewStats.averageRating / 5) * 30) : 0;
  const reviewVolumePoints = Math.min(reviewStats.totalReviews * 3, 15);
  const soldPoints = Math.min(soldCount * 4, 16);
  const activeProductsPoints = Math.min(activeProductsCount * 2, 8);
  const seniorityPoints = accountAgeDays >= 365 ? 6 : accountAgeDays >= 90 ? 4 : accountAgeDays >= 30 ? 2 : 0;
  const trustScore = Math.min(100, verificationPoints + ratingPoints + reviewVolumePoints + soldPoints + activeProductsPoints + seniorityPoints);
  const trustLabel = getTrustLabel(trustScore);
  const averageRatingLabel = reviewStats.totalReviews > 0 ? reviewStats.averageRating.toFixed(1) : '—';
  const normalizedSellerLocation = normalizeLocation(sellerLocation);
  const normalizedProductLocation = normalizeLocation(productLocation);
  const sameLocalArea = Boolean(normalizedSellerLocation && normalizedProductLocation && normalizedSellerLocation === normalizedProductLocation);
  const isTopLocalSeller = Boolean(sameLocalArea && seller.verified && reviewStats.totalReviews >= 3 && reviewStats.averageRating >= 4.5 && soldCount >= 3);
  const reputationLevel = isTopLocalSeller ? 'Vendedor top local' : seller.verified && trustScore >= 85 ? 'Vendedor top verificado' : seller.verified && trustScore >= 70 ? 'Vendedor verificado recomendado' : seller.verified ? 'Vendedor verificado' : trustScore >= 70 ? 'Vendedor recomendado' : trustScore >= 50 ? 'Vendedor fiable' : 'Vendedor nuevo';
  const trustSignals = [seller.verified ? 'Identidad verificada por Reveta' : 'Identidad pendiente de verificar', reviewStats.totalReviews > 0 ? `${reviewStats.totalReviews} valoraciones verificadas` : 'Todavía sin valoraciones verificadas', soldCount > 0 ? `${soldCount} productos vendidos` : 'Sin ventas registradas todavía', activeProductsCount > 0 ? `${activeProductsCount} anuncios activos` : 'Sin anuncios activos adicionales', accountAgeLabel];

  return <div className="rounded-xl border border-border/50 bg-card p-6 shadow-card">
    <div className="mb-5 flex items-start gap-4"><Link to={sellerProfilePath} className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent text-xl font-bold text-primary-foreground transition hover:scale-105">{seller.avatar_url ? <img src={seller.avatar_url} alt={sellerName} className="h-full w-full object-cover" /> : sellerName[0]?.toUpperCase() || 'U'}</Link><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link to={sellerProfilePath} className="truncate font-semibold hover:text-primary hover:underline">{sellerName}</Link>{seller.verified ? <VerifiedBadge size="sm" /> : <Badge variant="outline">Sin verificar</Badge>}{isTopLocalSeller && <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500"><MapPin className="h-3.5 w-3.5" /> Top local</Badge>}</div>{seller.username && <p className="text-xs text-muted-foreground">@{seller.username}</p>}<ReputationSummary reputation={{ average_rating: reviewStats.averageRating || null, review_count: reviewStats.totalReviews }} verified={!!seller.verified} compact /><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /> Miembro desde {getMemberSince(seller.created_at)}</p></div></div>
    <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /><div><p className="text-sm font-bold">{reputationLevel}</p><p className="text-xs text-muted-foreground">Confianza Reveta · {trustLabel}</p></div></div><Badge variant="secondary" className="text-sm font-bold">{trustScore}/100</Badge></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${trustScore}%` }} /></div>{isTopLocalSeller && <p className="mt-3 text-xs font-medium text-primary">Destacado en {sellerLocation || productLocation} por valoración, ventas y verificación.</p>}</div>
    <div className="mb-5 grid grid-cols-3 gap-2"><div className="rounded-lg border border-border/60 p-3 text-center"><p className="text-lg font-bold">{averageRatingLabel}</p><p className="mt-1 text-xs text-muted-foreground">Nota media</p></div><div className="rounded-lg border border-border/60 p-3 text-center"><p className="text-lg font-bold">{reviewStats.totalReviews}</p><p className="mt-1 text-xs text-muted-foreground">Opiniones</p></div><div className="rounded-lg border border-border/60 p-3 text-center"><p className="text-lg font-bold">{soldCount}</p><p className="mt-1 text-xs text-muted-foreground">Vendidos</p></div></div>
    <div className="mb-5 rounded-xl border border-border/60 p-4"><div className="mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Señales de confianza</p></div><div className="space-y-2 text-sm text-muted-foreground">{trustSignals.map((signal) => <div key={signal} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /><span>{signal}</span></div>)}</div></div>
    <div className="mb-5 space-y-2 rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm"><div className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /><span>Nivel: {reputationLevel}</span></div><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><span>{accountAgeLabel}</span></div><div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary" /><span>Historial de ventas y actividad visible</span></div></div>
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Antes de pagar</div><ul className="space-y-1.5"><li>• Revisa fotos, descripción, estado y accesorios incluidos.</li><li>• Mantén la conversación y los acuerdos dentro del chat.</li><li>• Desconfía si te pide pago externo, códigos SMS o cerrar con urgencia.</li></ul></div>
    {!effectiveIsOwner && <div className="space-y-2">{effectiveProductId && <ReserveProductButton productId={effectiveProductId} sellerId={seller.id} />}{onContactSeller && <Button className="w-full" onClick={onContactSeller}><MessageCircle className="mr-2 h-4 w-4" /> Contactar con el vendedor</Button>}<Button asChild variant="outline" className="w-full"><Link to={sellerProfilePath}><Store className="mr-2 h-4 w-4" /> Ver perfil completo</Link></Button><Button asChild variant="outline" className="w-full"><Link to={`/search?seller=${seller.id}`}>Ver más productos del vendedor</Link></Button><div className="flex flex-col gap-2 pt-2">{effectiveProductId && <ReportDialog productId={effectiveProductId} userId={seller.id} />}<BlockUserButton userId={seller.id} userName={sellerName} /></div></div>}
  </div>;
};
export default SellerTrustCard;
