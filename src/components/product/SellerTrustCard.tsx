import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SellerRating from '@/components/SellerRating';
import VerifiedBadge from '@/components/VerifiedBadge';
import ReportDialog from '@/components/ReportDialog';
import BlockUserButton from '@/components/BlockUserButton';
import { CalendarDays, CheckCircle2, MessageCircle, Package, Shield } from 'lucide-react';

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

const getMemberSince = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

const SellerTrustCard = ({ seller, productId, isOwner, activeProductsCount = 0, onContactSeller }: SellerTrustCardProps) => {
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

      <div className="space-y-2 rounded-xl bg-primary/5 border border-primary/10 p-4 mb-5 text-sm">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Valoraciones visibles del vendedor</span></div>
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Chat seguro dentro de Reveta</span></div>
        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Compra protegida disponible</span></div>
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
