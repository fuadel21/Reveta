import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import NoIndex from "@/components/seo/NoIndex";
import GlobalJsonLd from "@/components/seo/GlobalJsonLd";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import SellerDashboard from "./pages/SellerDashboard";
import BuyerCenter from "./pages/BuyerCenter";
import PublicSellerProfile from "./pages/PublicSellerProfile";
import Upload from "./pages/Upload";
import Messages from "./pages/Messages";
import ProductDetail from "./pages/ProductDetail";
import ProductComparison from "./pages/ProductComparison";
import Search from "./pages/Search";
import SeoIndex from "./pages/SeoIndex";
import SeoLanding from "./pages/SeoLanding";
import Safety from "./pages/Safety";
import Admin from "./pages/Admin";
import AdminSafety from "./pages/AdminSafety";
import AdminGrowth from "./pages/AdminGrowth";
import AdminDisputeDetail from "./pages/AdminDisputeDetail";
import Transactions from "./pages/Transactions";
import Settings from "./pages/Settings";
import SavedSearches from "./pages/SavedSearches";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import CallRoom from "./pages/CallRoom";
import BoostProduct from "./pages/BoostProduct";
import MobileSellButton from "@/components/MobileSellButton";
import ScrollToTop from "@/components/ScrollToTop";

const queryClient = new QueryClient();
const privatePage = (title: string, element: JSX.Element) => <><NoIndex title={title} />{element}</>;

const App = () => (
  <HelmetProvider><QueryClientProvider client={queryClient}><ThemeProvider defaultTheme="system" storageKey="marketplace-theme"><AuthProvider><TooltipProvider>
    <Toaster /><Sonner /><GlobalJsonLd />
    <BrowserRouter><ScrollToTop /><MobileSellButton /><Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/forgot-password" element={privatePage("Recuperar contraseña | Reveta", <ForgotPassword />)} />
      <Route path="/reset-password" element={privatePage("Restablecer contraseña | Reveta", <ResetPassword />)} />
      <Route path="/profile" element={privatePage("Mi perfil | Reveta", <Profile />)} />
      <Route path="/seller-dashboard" element={privatePage("Panel del vendedor | Reveta", <SellerDashboard />)} />
      <Route path="/comprador" element={privatePage("Centro del comprador | Reveta", <BuyerCenter />)} />
      <Route path="/usuario/:id" element={<PublicSellerProfile />} />
      <Route path="/upload" element={privatePage("Publicar producto | Reveta", <Upload />)} />
      <Route path="/messages" element={privatePage("Mensajes | Reveta", <Messages />)} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/producto/:id/:slug" element={<ProductDetail />} />
      <Route path="/comparar" element={privatePage("Comparar productos | Reveta", <ProductComparison />)} />
      <Route path="/checkout/:productId" element={privatePage("Checkout | Reveta", <Checkout />)} />
      <Route path="/boost/:productId" element={privatePage("Destacar producto | Reveta", <BoostProduct />)} />
      <Route path="/call/:id" element={privatePage("Llamada privada | Reveta", <CallRoom />)} />
      <Route path="/search" element={<Search />} />
      <Route path="/segunda" element={<Navigate to="/segunda-mano" replace />} />
      <Route path="/segunda-ma" element={<Navigate to="/segunda-mano" replace />} />
      <Route path="/segunda-mano" element={<SeoIndex />} />
      <Route path="/segunda-mano/:city" element={<SeoLanding />} />
      <Route path="/segunda-mano/:city/:category" element={<SeoLanding />} />
      <Route path="/seguridad" element={<Safety />} />
      <Route path="/admin" element={privatePage("Administración | Reveta", <Admin />)} />
      <Route path="/admin/safety" element={privatePage("Seguridad admin | Reveta", <AdminSafety />)} />
      <Route path="/admin/growth" element={privatePage("Growth admin | Reveta", <AdminGrowth />)} />
      <Route path="/admin/disputes/:id" element={privatePage("Incidencia admin | Reveta", <AdminDisputeDetail />)} />
      <Route path="/transactions" element={privatePage("Transacciones | Reveta", <Transactions />)} />
      <Route path="/settings" element={privatePage("Ajustes | Reveta", <Settings />)} />
      <Route path="/saved-searches" element={privatePage("Búsquedas guardadas | Reveta", <SavedSearches />)} />
      <Route path="/terms" element={<Terms />} /><Route path="/privacy" element={<Privacy />} /><Route path="/cookies" element={<Cookies />} />
      <Route path="*" element={privatePage("Página no encontrada | Reveta", <NotFound />)} />
    </Routes></BrowserRouter>
  </TooltipProvider></AuthProvider></ThemeProvider></QueryClientProvider></HelmetProvider>
);

export default App;
