import React, { useEffect, useState } from 'react';
import { Truck, MapPin, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface ShippingOption {
  id: string;
  name: string;
  price: number;
  estimatedDays: number;
  description: string;
}

interface ShippingInfoProps {
  productId: string;
  productPrice: number;
  sellerLocation?: string;
  shippingInfo?: string;
  onSelectShipping?: (option: ShippingOption) => void;
}

const SHIPPING_OPTION: ShippingOption = {
  id: 'national-spain',
  name: 'Envío nacional España',
  price: 2.99,
  estimatedDays: 5,
  description: 'Entrega nacional en España',
};

export const ShippingInfo: React.FC<ShippingInfoProps> = ({
  productPrice,
  sellerLocation = 'España',
  shippingInfo = 'Envío nacional disponible en España por 2,99 €',
  onSelectShipping,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const totalPrice = productPrice + SHIPPING_OPTION.price;

  useEffect(() => {
    onSelectShipping?.(SHIPPING_OPTION);
  }, [onSelectShipping]);

  return (
    <div className="space-y-4 bg-white p-6 rounded-lg border">
      <div className="flex items-center gap-2">
        <Truck className="text-blue-600" size={24} />
        <h3 className="text-lg font-semibold text-gray-900">Información de envío</h3>
      </div>

      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
        <MapPin className="text-blue-600 flex-shrink-0 mt-1" size={20} />
        <div>
          <p className="font-semibold text-gray-900">Ubicación del vendedor</p>
          <p className="text-sm text-gray-600">{sellerLocation}</p>
        </div>
      </div>

      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
        <p className="text-sm text-gray-700">
          <CheckCircle className="inline mr-2 text-green-600" size={16} />
          {shippingInfo}
        </p>
      </div>

      <div className="space-y-3">
        <p className="font-semibold text-gray-900">Opción de envío:</p>

        <div className="flex items-start gap-3 p-4 border rounded-lg border-blue-600 bg-blue-50">
          <input
            type="radio"
            name="shipping"
            value={SHIPPING_OPTION.id}
            checked
            readOnly
            className="mt-1"
          />

          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-gray-900">{SHIPPING_OPTION.name}</p>
              <p className="font-bold text-gray-900">+€{SHIPPING_OPTION.price.toFixed(2)}</p>
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Clock size={16} />
                {SHIPPING_OPTION.estimatedDays} días
              </span>
              <span>{SHIPPING_OPTION.description}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-gray-700">
          <span>Precio del producto:</span>
          <span>€{productPrice.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-gray-700">
          <span>Envío ({SHIPPING_OPTION.name}):</span>
          <span>€{SHIPPING_OPTION.price.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-lg font-bold text-gray-900 bg-gray-100 p-3 rounded-lg">
          <span>Total:</span>
          <span>€{totalPrice.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-semibold py-2"
      >
        {showDetails ? '▼ Ocultar' : '▶ Mostrar'} más detalles
      </button>

      {showDetails && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-3 text-sm text-gray-700">
          <div className="flex gap-2">
            <AlertCircle className="text-yellow-600 flex-shrink-0" size={18} />
            <div>
              <p className="font-semibold">Nota importante:</p>
              <p>
                El envío nacional tiene un coste fijo de 2,99 €. Usa el chat para coordinar cualquier detalle adicional con el vendedor.
              </p>
            </div>
          </div>

          <div>
            <p className="font-semibold mb-2">Políticas de devolución:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Tienes 14 días para devolver el producto</li>
              <li>El producto debe estar en perfecto estado</li>
              <li>Los gastos de devolución corren por tu cuenta</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold mb-2">Protección del comprador:</p>
            <p>
              Reveta registra la operación para que comprador y vendedor puedan hacer seguimiento desde Mis transacciones.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
