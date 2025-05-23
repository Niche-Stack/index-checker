import React from 'react';
import { CreditCard, CheckCircle, Trash2, Pencil } from 'lucide-react';

interface PaymentMethodCardProps {
  type: 'visa' | 'mastercard' | 'amex' | 'discover';
  last4: string;
  expiry: string;
  isDefault?: boolean;
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  type,
  last4,
  expiry,
  isDefault = false
}) => {
  const getCardIcon = () => {
    switch (type) {
      case 'visa':
        return (
          <div className="w-8 h-8 bg-blue-900 rounded flex items-center justify-center text-white">
            <span className="font-bold text-xs">VISA</span>
          </div>
        );
      case 'mastercard':
        return (
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white">
            <span className="font-bold text-xs">MC</span>
          </div>
        );
      case 'amex':
        return (
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white">
            <span className="font-bold text-xs">AMEX</span>
          </div>
        );
      case 'discover':
        return (
          <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white">
            <span className="font-bold text-xs">DISC</span>
          </div>
        );
      default:
        return <CreditCard className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex items-center">
          <div className="mr-3">
            {getCardIcon()}
          </div>
          <div>
            <div className="flex items-center">
              <h3 className="font-medium text-slate-900">
                •••• •••• •••• {last4}
              </h3>
              {isDefault && (
                <span className="ml-2 inline-flex items-center text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Default
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">Expires {expiry}</p>
          </div>
        </div>
        
        <div className="flex space-x-1">
          <button className="text-slate-400 hover:text-slate-600 p-1">
            <Pencil className="w-4 h-4" />
          </button>
          <button className="text-slate-400 hover:text-red-600 p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodCard;