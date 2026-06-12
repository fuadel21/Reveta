import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom price marker icon
const createPriceIcon = (price: number) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative">
        <div class="bg-primary text-primary-foreground px-2 py-1 rounded-lg text-xs font-bold shadow-lg whitespace-nowrap border border-white/20">
          ${price.toLocaleString('es-ES')} €
        </div>
        <div class="absolute left-1/2 -translate-x-1/2 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-primary"></div>
      </div>
    `,
    iconSize: [60, 30],
    iconAnchor: [30, 30],
  });
};

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  latitude: number;
  longitude: number;
  location: string | null;
}

interface ProductsMapProps {
  products: Product[];
  userLocation?: { latitude: number; longitude: number } | null;
  className?: string;
}

// Component to handle map center changes
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const ProductsMap = ({ products, userLocation, className }: ProductsMapProps) => {
  const navigate = useNavigate();
  
  const initialCenter: [number, number] = useMemo(() => {
    if (userLocation) return [userLocation.latitude, userLocation.longitude];
    if (products.length > 0 && products[0].latitude && products[0].longitude) {
      return [products[0].latitude, products[0].longitude];
    }
    return [40.4168, -3.7038]; // Madrid
  }, [userLocation, products]);

  const initialZoom = userLocation ? 11 : 6;

  // Filter products with valid coordinates
  const mappableProducts = useMemo(() => 
    products.filter(p => p.latitude && p.longitude), 
    [products]
  );

  const handleViewProduct = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  if (mappableProducts.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-xl ${className}`}>
        <div className="text-center p-8">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay productos con ubicación disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden ${className} relative z-0`}>
      {/* @ts-ignore */}
      <MapContainer 
        center={initialCenter} 
        zoom={initialZoom} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <ChangeView center={initialCenter} zoom={initialZoom} />
        {/* @ts-ignore */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="topright" />

        {/* User location marker */}
        {userLocation && (
          <Marker position={[userLocation.latitude, userLocation.longitude]}>
            <Popup>Tu ubicación actual</Popup>
          </Marker>
        )}

        {/* Product markers */}
        {mappableProducts.map((product) => (
          <Marker
            key={product.id}
            position={[product.latitude, product.longitude]}
            // @ts-ignore
            icon={createPriceIcon(product.price)}
            eventHandlers={{
              click: () => {},
            }}
          >
            {/* @ts-ignore */}
            <Popup className="product-popup-custom">
              <div className="w-48 p-0">
                {product.images?.[0] && (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-24 object-cover rounded-t-lg mb-2"
                  />
                )}
                <div className="p-1">
                  <p className="font-bold text-base leading-tight mb-1">
                    {product.price.toLocaleString('es-ES')} €
                  </p>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {product.title}
                  </p>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => handleViewProduct(product.id)}
                  >
                    Ver producto
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

      </MapContainer>
    </div>
  );
};

export default ProductsMap;
