import React from 'react';
import { Package, Check } from 'lucide-react';
import { CreditPackage } from '../../../types/credits';

interface CreditPackageCardProps {
  package: CreditPackage;
  isSelected: boolean;
  onSelect: () => void;
}

const CreditPackageCard: React.FC<CreditPackageCardProps> = ({ 
  package: pkg, 
  isSelected, 
  onSelect 
}) => {
  return (
    <div 
      className={`
        border rounded-lg p-5 cursor-pointer transition-all hover:shadow-md
        ${isSelected 
          ? 'border-blue-800 bg-blue-50 shadow-sm' 
          : 'border-slate-200 bg-white hover:border-slate-300'
        }
      `}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center">
          <Package className="w-5 h-5 text-blue-800" />
        </div>
        
        {isSelected && (
          <div className="w-6 h-6 bg-blue-800 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      
      <h3 className="font-semibold text-slate-900 mb-1">{pkg.name}</h3>
      <p className="text-blue-800 font-bold text-xl mb-1">${pkg.price}</p>
      <p className="text-sm text-slate-500 mb-2">{pkg.credits.toLocaleString()} credits</p>
      <p className="text-xs text-slate-600">${(pkg.price / pkg.credits).toFixed(4)} per credit</p>
      
      <div className="mt-3 text-sm text-slate-700">
        {pkg.description}
      </div>
    </div>
  );
};

export default CreditPackageCard;