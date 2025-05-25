import React from 'react';
import { format } from 'date-fns';
import { Search, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { IndexingHistory, Site } from '../../../types/site';

interface HistoryTableProps {
  history: IndexingHistory[];
  sites: Site[];
  loading: boolean;
}

const HistoryTable: React.FC<HistoryTableProps> = ({ history, sites, loading }) => {
  const getSiteNameById = (siteId: string): string => {
    const site = sites.find(s => s.id === siteId);
    return site ? site.name : 'Unknown Site';
  };

  const getActionIcon = (action: string, status: string) => {
    if (action === 'check') {
      return status === 'successful'
        ? <CheckCircle className="w-5 h-5 text-green-600" />
        : <AlertTriangle className="w-5 h-5 text-amber-600" />;
    } else { // action === 'request'
      return status === 'successful' || status === 'pending'
        ? <RefreshCw className="w-5 h-5 text-blue-600" />
        : <AlertTriangle className="w-5 h-5 text-red-600" />;
    }
  };

  const getActionText = (action: string): string => {
    return action === 'check' ? 'Check Indexing' : 'Request Indexing';
  };

  const getResultClass = (result: string): string => {
    switch (result) {
      case 'indexed':
      case 'successful':
        return 'bg-green-100 text-green-800';
      case 'not_indexed':
        return 'bg-amber-100 text-amber-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getResultText = (result: string): string => {
    switch (result) {
      case 'indexed':
        return 'Indexed';
      case 'not_indexed':
        return 'Not Indexed';
      case 'pending':
        return 'Pending';
      case 'successful':
        return 'Successful';
      case 'failed':
        return 'Failed';
      default:
        return result;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-6 h-6 text-blue-800 animate-spin mx-auto mb-3" />
        <p>Loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
          <Search className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-800 mb-2">No history found</h3>
        <p className="text-slate-500">
          When you check or request indexing for your pages, the actions will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Date</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Site</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Action</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Result</th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Credits</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {history.map(item => (
            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 text-sm text-slate-700">
                {format(item.timestamp.toDate(), 'MMM d, yyyy h:mm a')}
              </td>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">
                {getSiteNameById(item.siteId)}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center text-sm text-slate-700">
                  {getActionIcon(item.action, item.status)}
                  <span className="ml-2">{getActionText(item.action)}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getResultClass(item.result)}`}>
                  {getResultText(item.result)}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-700 text-right">
                {item.creditsUsed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryTable;