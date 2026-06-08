import { Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const MobileSellButton = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Don't show on upload page or auth page
  if (location.pathname === "/upload" || location.pathname === "/auth") {
    return null;
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
