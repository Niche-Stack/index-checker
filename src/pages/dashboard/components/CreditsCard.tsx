import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ArrowUpRight, PlusCircle } from 'lucide-react';
import { useCredits } from '../../../contexts/CreditContext';

const CreditsCard: React.FC = () => {
  const { credits, loading } = useCredits();

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-medium text-blue-100 mb-1">Available Credits</h3>
            <div className="text-3xl font-bold">{loading ? '...' : credits}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-slate-500">Credit Usage:</p>
            <ul className="text-sm mt-2 space-y-1">
              <li className="flex items-center">
                <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                  <span className="text-xs text-blue-800 font-medium">1</span>
                </span>
                <span className="text-slate-700">Per page indexed check</span>
              </li>
              <li className="flex items-center">
                <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                  <span className="text-xs text-blue-800 font-medium">5</span>
                </span>
                <span className="text-slate-700">Per indexing request</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col space-y-2">
          <Link to="/billing" className="btn-primary flex items-center justify-center">
            <PlusCircle className="w-4 h-4 mr-2" />
            Buy Credits
          </Link>
          <Link to="/billing" className="btn-ghost flex items-center justify-center">
            View Pricing
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CreditsCard;