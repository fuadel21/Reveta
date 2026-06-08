import React from 'react';
import { CheckCircle, Award, Zap } from 'lucide-react';

interface ProfileBadgeProps {
  isVerified?: boolean;
  isFeatured?: boolean;
  isPremium?: boolean;
  className?: string;
}

export const ProfileBadge: React.FC<ProfileBadgeProps> = ({
  isVerified,
  isFeatured,
  isPremium,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isVerified && (
        <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
          <CheckCircle size={16} />
          <span>Verificado</span>
        </div>
      )}

      {isFeatured && (
        <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-semibold">
          <Zap size={16} />
          <span>Destacado</span>
        </div>
      )}

      {isPremium && (
        <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
          <Award size={16} />
          <span>Premium</span>
        </div>
      )}
    </div>
  );
};

interface ProductBadgeProps {
  isFeatured?: boolean;
  isNew?: boolean;
  discount?: number;
  className?: string;
}

export const ProductBadge: React.FC<ProductBadgeProps> = ({
  isFeatured,
  isNew,
  discount,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {isFeatured && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-md">
          ⭐ Destacado
        </div>
      )}

      {isNew && (
        <div className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-md">
          🆕 Nuevo
        </div>
      )}

      {discount && discount > 0 && (
        <div className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-md">
          -{discount}%
        </div>
      )}
    </div>
  );
};
