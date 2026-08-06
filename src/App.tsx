import { lazy, Suspense } from "react";
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
import PublicResourceGate from "@/components/seo/PublicResourceGate";
import Index from "./pages/Index";
import MobileSellButton from "@/components/MobileSellButton";
import ScrollToTop from "@/components/ScrollToTop";

const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const BuyerCenter = lazy(() => import("./pages/BuyerCenter"));
const PublicSellerProfile = lazy(() => import("./pages/PublicSellerProfile"));
const Upload = lazy(() => import("./pages/Upload"));
const EditProduct = lazy(() => import("./pages/EditProduct"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const ProductComparison = lazy(() => import("./pages/ProductComparison"));
const Search = lazy(() => import("./pages/Search"));
const SeoIndex = lazy(() => import("./pages/SeoIndex"));
const SeoLanding = lazy(() => import("./pages/SeoLanding"));
const Safety = lazy(() => import("./pages/Safety"));
const SafetyCenter = lazy(() => import("./pages/SafetyCenter"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminSafety = lazy(() => import("./pages/AdminSafety"));
const AdminGrowth = lazy(() => import("./pages/AdminGrowth"));
const AdminDisputeDetail = lazy(() => import("./pages/AdminDisputeDetail"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Settings = lazy(() => import("./pages/Settings"));
const SavedSearches = lazy(() => import("./pages/SavedSearches"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CallRoom = lazy(() => import("./pages/CallRoom"));
const BoostProduct = lazy(() => import("./pages/BoostProduct"));

const queryClient = new QueryClient();
const privatePage = (title: string, element: JSX.Element) => <><NoIndex title={title} />{element}</>;

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center bg-background" role="status" aria-live="polite">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-label="Cargando página" />
  </div>
);

const App = () => (
  <HelmetProvider><QueryClientProvider client={queryClient}><ThemeProvider defaultTheme="system" storageKey="marketplace-theme"><AuthProvider><TooltipProvider>
    <Toaster /><Sonner /><GlobalJsonLd />
    <BrowserRouter><ScrollToTop /><MobileSellButton /><Suspense fallback={<RouteFallback />}><Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/forgot-password" element={privatePage("Recuperar contraseña | Reveta", <ForgotPassword />)} />
      <Route path="/reset-password" element={privatePage("Restablecer contraseña | Reveta", <ResetPassword />)} />
      <Route path="/profile" element={privatePage("Mi perfil | Reveta", <Profile />)} />
      <Route path="/seller-dashboard" element={privatePage("Panel del vendedor | Reveta", <SellerDashboard />)} />
      <Route path="/comprador" element={privatePage("Centro del comprador | Reveta", <BuyerCenter />)} />
      <Route path="/usuario/:id" element={<PublicResourceGate type="seller"><PublicSellerProfile /></PublicResourceGate>} />
      <Route path="/upload" element={privatePage("Publicar producto | Reveta", <Upload />)} />
      <Route path="/edit-product/:productId" element={privatePage("Editar anuncio | Reveta", <EditProduct />)} />
      <Route path="/messages" element={privatePage("Mensajes | Reveta", <Messages />)} />
      <Route path="/notifications" element={privatePage("Notificaciones | Reveta", <Notifications />)} />
      <Route path="/product/:id" element={<PublicResourceGate type="product"><ProductDetail /></PublicResourceGate>} />
      <Route path="/producto/:id/:slug" element={<PublicResourceGate type="product"><ProductDetail /></PublicResourceGate>} />
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
      <Route path="/mi-proteccion" element={privatePage("Mi Centro de Protección | Reveta", <SafetyCenter />)} />
      <Route path="/admin" element={privatePage("Administración | Reveta", <Admin />)} />
      <Route path="/admin/safety" element={privatePage("Seguridad admin | Reveta", <AdminSafety />)} />
      <Route path="/admin/growth" element={privatePage("Growth admin | Reveta", <AdminGrowth />)} />
      <Route path="/admin/disputes/:id" element={privatePage("Incidencia admin | Reveta", <AdminDisputeDetail />)} />
      <Route path="/transactions" element={privatePage("Transacciones | Reveta", <Transactions />)} />
      <Route path="/settings" element={privatePage("Ajustes | Reveta", <Settings />)} />
      <Route path="/saved-searches" element={privatePage("Búsquedas guardadas | Reveta", <SavedSearches />)} />
      <Route path="/terms" element={<Terms />} /><Route path="/privacy" element={<Privacy />} /><Route path="/cookies" element={<Cookies />} />
      <Route path="*" element={privatePage("Página no encontrada | Reveta", <NotFound />)} />
    </Routes></Suspense></BrowserRouter>
  </TooltipProvider></AuthProvider></ThemeProvider></QueryClientProvider></HelmetProvider>
);

export default App;
