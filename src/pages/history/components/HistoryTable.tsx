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
    return site ? site.name : (history.find(h => h.siteId === siteId)?.siteUrl || 'Unknown Site');
  };

  const getActionIcon = (action: IndexingHistory['action'], status: IndexingHistory['status']) => {
    switch (action) {
      case 'check':
        if (status === 'successful' || status === 'completed_with_errors') {
          return <CheckCircle className="w-5 h-5 text-green-600" />;
        } else if (status === 'pending' || status === 'processing') {
          return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
        } else {
          return <AlertTriangle className="w-5 h-5 text-amber-600" />;
        }
      case 'reindex': // Added reindex
        if (status === 'successful' || status === 'completed_with_errors' || status === 'no_urls_to_reindex') {
          return <CheckCircle className="w-5 h-5 text-green-600" />;
        } else if (status === 'pending' || status === 'processing') {
          return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
        } else {
          return <AlertTriangle className="w-5 h-5 text-red-600" />;
        }
      case 'index_request': // Kept for potential future use, though reindex is primary now
      default:
        return status === 'successful' || status === 'pending' || status === 'processing'
          ? <RefreshCw className="w-5 h-5 text-blue-600" />
          : <AlertTriangle className="w-5 h-5 text-red-600" />;
    }
  };

  const getActionText = (action: IndexingHistory['action']): string => {
    switch (action) {
      case 'check':
        return 'Check Indexing';
      case 'reindex':
        return 'Request Re-indexing';
      case 'index_request':
        return 'Request Indexing (Legacy)';
      default:
        return 'Unknown Action';
    }
  };

  const getResultClass = (statusValue: IndexingHistory['status']): string => {
    switch (statusValue) {
      case 'indexed': // Retained for compatibility if old data exists
      case 'successful':
      case 'no_urls_to_reindex': // Treat as a success-like outcome
        return 'bg-green-100 text-green-800';
      case 'not_indexed': // Retained for compatibility
      case 'completed_with_errors':
        return 'bg-amber-100 text-amber-800';
      case 'pending':
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
      case 'no_urls_found': // Treat as a form of failure or non-action
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getResultText = (statusValue: IndexingHistory['status'], message?: string): string => {
    // Prioritize message if available and status is one that implies a message is useful
    if (message && ['successful', 'failed', 'completed_with_errors', 'no_urls_to_reindex', 'no_urls_found', 'pending', 'processing'].includes(statusValue)) {
      // Truncate long messages for table display
      return message.length > 100 ? message.substring(0, 97) + '...' : message;
    }
    switch (statusValue) {
      case 'indexed': return 'Indexed (Legacy)';
      case 'not_indexed': return 'Not Indexed (Legacy)';
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'successful': return 'Successful';
      case 'failed': return 'Failed';
      case 'completed_with_errors': return 'Completed with Errors';
      case 'no_urls_to_reindex': return 'No URLs to Re-index';
      case 'no_urls_found': return 'No URLs Found';
      default:
        // Ensure statusValue is a string before calling replace
        const stringStatusValue = String(statusValue);
        const formatted = stringStatusValue.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        return formatted; // Return the status value itself if not matched
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
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Site/URL</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Action</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Status & Message</th>
            <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {history.map(item => (
            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                {item.timestamp?.toDate ? format(item.timestamp.toDate(), 'MMM d, yyyy h:mm a') : 'Invalid Date'}
              </td>
              <td className="px-6 py-4 text-sm font-medium text-slate-900">
                {getSiteNameById(item.siteId)}
                {item.siteUrl && <div className='text-xs text-slate-500'>{item.siteUrl}</div>}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center text-sm text-slate-700">
                  {getActionIcon(item.action, item.status)}
                  <span className="ml-2">{getActionText(item.action)}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`block px-2 py-1 text-xs font-medium rounded-full ${getResultClass(item.status)} mb-1 w-fit`}>
                  {getResultText(item.status /* Intentionally not passing item.message here, handled below */)}
                </span>
                {item.message && <p className='text-xs text-slate-500 max-w-xs truncate' title={item.message}>{item.message}</p>}
              </td>
              <td className="px-6 py-4 text-sm text-slate-700 text-right whitespace-nowrap">
                {item.action === 'check' && (
                  <>
                    <div>{item.indexedItemCount !== undefined ? `${item.indexedItemCount} / ` : ''}{item.processedItemCount !== undefined ? item.processedItemCount : (item.initialItemCount || 0)} URLs</div>
                    <div className='text-xs'>{item.creditsUsed !== undefined ? `${item.creditsUsed} cred.` : (item.estimatedCredits ? `${item.estimatedCredits} est.` : '')}</div>
                  </>
                )}
                {item.action === 'reindex' && (
                  <>
                    <div>{item.processedItemCount !== undefined ? `${item.processedItemCount} / ` : ''}{item.initialItemCount || 0} URLs</div>
                    <div className='text-xs'>{item.creditsUsed !== undefined ? `${item.creditsUsed} cred.` : (item.estimatedCredits ? `${item.estimatedCredits} est.` : '')}</div>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryTable;