import React from 'react';
import { format } from 'date-fns';
import { PlusCircle, MinusCircle, RefreshCw, Search } from 'lucide-react';
import { CreditTransaction, CreditPackage } from '../../../types/credits';

interface TransactionHistoryTableProps {
  transactions: CreditTransaction[];
  loading: boolean;
  creditPackages: CreditPackage[];
}

const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({
  transactions,
  loading,
  creditPackages
}) => {
  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-6 h-6 text-blue-800 animate-spin mx-auto mb-3" />
        <p>Loading transactions...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
          <Search className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-800 mb-2">No transactions yet</h3>
        <p className="text-slate-500">
          Purchase credits or use the service to see your transaction history
        </p>
      </div>
    );
  }

  const getPackageName = (packageId: string): string => {
    const pkg = creditPackages.find(p => p.id === packageId);
    return pkg ? pkg.name : 'Unknown Package';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Date</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Transaction</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Type</th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map(transaction => (
            <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                {transaction.timestamp && format(transaction.timestamp.toDate(), 'MMM d, yyyy h:mm a')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center mr-3
                    ${transaction.type === 'purchase' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                    }
                  `}>
                    {transaction.type === 'purchase' 
                      ? <PlusCircle className="w-4 h-4" /> 
                      : <MinusCircle className="w-4 h-4" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {transaction.type === 'purchase' 
                        ? `Credit Purchase - ${getPackageName(transaction.packageId || '')}` 
                        : `Credit Usage - ${transaction.reason || 'Service Usage'}`
                      }
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`
                  inline-flex rounded-full text-xs font-medium px-2.5 py-0.5
                  ${transaction.type === 'purchase' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                  }
                `}>
                  {transaction.type === 'purchase' ? 'Purchase' : 'Usage'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <span className={`text-sm font-medium ${transaction.type === 'purchase' ? 'text-green-700' : 'text-blue-700'}`}>
                  {transaction.type === 'purchase' ? '+' : ''}{transaction.credits} credits
                </span>
                {transaction.amount && (
                  <p className="text-xs text-slate-500">
                    {transaction.type === 'purchase' ? '$' + transaction.amount.toFixed(2) : ''}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionHistoryTable;