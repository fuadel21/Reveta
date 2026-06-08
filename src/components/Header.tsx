import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, User, Heart, MessageCircle, Search, Shield, Settings, BookMarked, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import NotificationCenter from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary transition-transform duration-300 group-hover:scale-105 shadow-lg">
            <span className="text-xl font-bold text-primary-foreground">R</span>
          </div>
          <span className="text-xl font-bold text-primary hidden sm:block transition-colors group-hover:text-primary/80">Reveta</span>
        </Link>
        
        {/* Search bar - center */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Busca lo que quieras..."
              className="w-full h-11 pl-11 pr-4 rounded-full border-2 border-border bg-background focus:border-primary/50 transition-all duration-300 hover:border-primary/30"
            />
          </div>
        </form>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Theme toggle */}
          <ThemeToggle />
          
          {/* Mobile search */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
            onClick={() => navigate('/search')}
          >
            <Search className="h-5 w-5" />
          </Button>
          
          {user ? (
            <>
              {isAdmin && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hidden sm:flex text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 transition-all" 
                  asChild
                >
                  <Link to="/admin">
                    <Shield className="h-5 w-5" />
                  </Link>
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="hidden sm:flex text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" 
                asChild
              >
                <Link to="/profile?tab=favorites">
                  <Heart className="h-5 w-5" />
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="hidden sm:flex text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" 
                asChild
              >
                <Link to="/messages">
                  <MessageCircle className="h-5 w-5" />
                </Link>
              </Button>
              <NotificationCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Mi Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/transactions" className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Transacciones
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/saved-searches" className="flex items-center gap-2">
                      <BookMarked className="h-4 w-4" />
                      Búsquedas guardadas
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Ajustes
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                className="h-10 px-4 sm:px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5" 
                asChild
              >
                <Link to="/upload">
                  <Plus className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Vender</span>
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                className="h-10 px-4 sm:px-6 rounded-full border-2 border-border text-foreground hover:bg-muted hover:border-primary/30 font-medium transition-all duration-300" 
                asChild
              >
                <Link to="/auth">
                  <span className="hidden sm:inline">Regístrate o inicia sesión</span>
                  <span className="sm:hidden">Entrar</span>
                </Link>
              </Button>
              <Button 
                className="h-10 px-4 sm:px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5" 
                asChild
              >
                <Link to="/upload">
                  <Plus className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Vender</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
