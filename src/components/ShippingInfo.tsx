import React, { useState } from 'react';
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

const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: 'standard',
    name: 'Envío Estándar',
    price: 5.99,
    estimatedDays: 5,
    description: 'Entrega en 3-5 días laborales',
  },
  {
    id: 'express',
    name: 'Envío Express',
    price: 12.99,
    estimatedDays: 2,
    description: 'Entrega en 1-2 días laborales',
  },
  {
    id: 'pickup',
    name: 'Recogida en Persona',
    price: 0,
    estimatedDays: 0,
    description: 'Acuerda una hora y lugar con el vendedor',
  },
];

export const ShippingInfo: React.FC<ShippingInfoProps> = ({
  productId,
  productPrice,
  sellerLocation = 'Madrid',
  shippingInfo = 'Envío disponible a toda España',
  onSelectShipping,
}) => {
  const [selectedShipping, setSelectedShipping] = useState<string>('standard');
  const [showDetails, setShowDetails] = useState(false);

  const handleSelectShipping = (optionId: string) => {
    setSelectedShipping(optionId);
    const option = SHIPPING_OPTIONS.find((o) => o.id === optionId);
    if (option && onSelectShipping) {
      onSelectShipping(option);
    }
  };

  const selectedOption = SHIPPING_OPTIONS.find(
    (o) => o.id === selectedShipping
  );
  const totalPrice = productPrice + (selectedOption?.price || 0);

  return (
    <div className="space-y-4 bg-white p-6 rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Truck className="text-blue-600" size={24} />
        <h3 className="text-lg font-semibold text-gray-900">
          Información de Envío
        </h3>
      </div>

      {/* Seller Location */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
        <MapPin className="text-blue-600 flex-shrink-0 mt-1" size={20} />
        <div>
          <p className="font-semibold text-gray-900">Ubicación del vendedor</p>
          <p className="text-sm text-gray-600">{sellerLocation}</p>
        </div>
      </div>

      {/* Shipping Info */}
      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
        <p className="text-sm text-gray-700">
          <CheckCircle className="inline mr-2 text-green-600" size={16} />
          {shippingInfo}
        </p>
      </div>

      {/* Shipping Options */}
      <div className="space-y-3">
        <p className="font-semibold text-gray-900">Opciones de envío:</p>

        {SHIPPING_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition ${
              selectedShipping === option.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="shipping"
              value={option.id}
              checked={selectedShipping === option.id}
              onChange={() => handleSelectShipping(option.id)}
              className="mt-1"
            />

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{option.name}</p>
                <p className="font-bold text-gray-900">
                  {option.price === 0 ? 'Gratis' : `+€${option.price.toFixed(2)}`}
                </p>
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock size={16} />
                  {option.estimatedDays === 0
                    ? 'Acordar'
                    : `${option.estimatedDays} día${option.estimatedDays > 1 ? 's' : ''}`}
                </span>
                <span>{option.description}</span>
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Price Summary */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-gray-700">
          <span>Precio del producto:</span>
          <span>€{productPrice.toFixed(2)}</span>
        </div>

        {selectedOption && selectedOption.price > 0 && (
          <div className="flex justify-between text-gray-700">
            <span>Envío ({selectedOption.name}):</span>
            <span>€{selectedOption.price.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between text-lg font-bold text-gray-900 bg-gray-100 p-3 rounded-lg">
          <span>Total:</span>
          <span>€{totalPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* Additional Info */}
      <button
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
                El vendedor puede ofrecer envío gratis o descuentos. Contacta
                con él para más información.
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
              Reveta protege tus compras. Si no recibes el producto o no es
              como se describe, puedes solicitar un reembolso.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
