import { MessageCircle, Shield, ShieldCheck, Store, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VerifiedBadge from '@/components/VerifiedBadge';
import SellerRating from '@/components/SellerRating';
import ReportDialog from '@/components/ReportDialog';
import BlockUserButton from '@/components/BlockUserButton';

interface SellerTrustPanelProps {
  seller: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    verified: boolean | null;
  };
  productId: string;
  activeProducts?: number;
  isOwner: boolean;
  onContact: () => void;
}

const getMemberSince = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

const SellerTrustPanel = ({ seller, productId, activeProducts = 0, isOwner, onContact }: SellerTrustPanelProps) => {
  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
      <div className="flex items-center gap-4 mb-4">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl font-bold text-primary-foreground overflow-hidden">
          {seller.avatar_url ? (
            <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            seller.full_name?.[0]?.toUpperCase() || 'U'
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{seller.full_name || 'Usuario'}</p>
            {seller.verified && <VerifiedBadge size="sm" />}
          </div>
          <SellerRating sellerId={seller.id} size="sm" />
          <p className="text-sm text-muted-foreground mt-1">Miembro desde {getMemberSince(seller.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="rounded-lg bg-muted/60 p-3">
          <div className="flex items-center gap-2 font-medium">
            <Store className="h-4 w-4 text-primary" />
            {activeProducts}
          </div>
          <p className="text-xs text-muted-foreground mt-1">anuncios activos</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <div className="flex items-center gap-2 font-medium">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Historial
          </div>
          <p className="text-xs text-muted-foreground mt-1">perfil con antigüedad</p>
        </div>
      </div>

      <div className="space-y-2 mb-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>{seller.verified ? 'Identidad verificada por Reveta' : 'Identidad pendiente de verificación'}</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span>Contacta siempre por el chat seguro de Reveta</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span>Compra protegida disponible en productos activos</span>
        </div>
      </div>

      {!isOwner && (
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={onContact}>
            <MessageCircle className="h-4 w-4 mr-2" /> Contactar vendedor
          </Button>
          <ReportDialog productId={productId} userId={seller.id} />
          <BlockUserButton userId={seller.id} userName={seller.full_name || 'este usuario'} />
        </div>
      )}
    </div>
  );
};

export default SellerTrustPanel;
