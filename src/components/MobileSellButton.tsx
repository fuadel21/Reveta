import { useEffect, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const MobileSellButton = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [boostProductId, setBoostProductId] = useState<string | null>(null);

  useEffect(() => {
    const checkProductOwner = async () => {
      setBoostProductId(null);

      if (!user || !location.pathname.startsWith("/product/")) return;

      const productId = location.pathname.split("/product/")[1]?.split("/")[0];
      if (!productId) return;

      const { data } = await supabase
        .from("products")
        .select("id, user_id, status")
        .eq("id", productId)
        .maybeSingle();

      if (data?.user_id === user.id && data?.status === "active") {
        setBoostProductId(data.id);
      }
    };

    checkProductOwner();
  }, [location.pathname, user?.id]);

  if (location.pathname === "/upload" || location.pathname === "/auth" || location.pathname.startsWith("/boost/")) {
    return null;
  }

  if (boostProductId) {
    return (
      <Link
        to={`/boost/${boostProductId}`}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden"
      >
        <div className="flex flex-col items-center gap-1">
          <div className="h-14 px-5 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center gap-2 hover:scale-105 transition-transform active:scale-95 border-4 border-background">
            <Megaphone className="h-6 w-6" />
            <span className="text-sm font-bold">Destacar</span>
          </div>
          <span className="text-[10px] font-bold text-foreground bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm">
            MÁS VISIBILIDAD
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={user ? "/upload" : "/auth"}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden"
    >
      <div className="flex flex-col items-center gap-1">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 border-4 border-background">
          <Plus className="h-8 w-8" />
        </div>
        <span className="text-[10px] font-bold text-foreground bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm">
          VENDER
        </span>
      </div>
    </Link>
  );
};

export default MobileSellButton;
