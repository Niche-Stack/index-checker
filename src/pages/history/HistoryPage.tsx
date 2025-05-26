import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  Download,
  ArrowDownUp
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { IndexingHistory, Site } from '../../types/site';
import HistoryTable from './components/HistoryTable';
import { CheckedPagesTable } from './components/CheckedPagesTable';

const HistoryPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [history, setHistory] = useState<IndexingHistory[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch user's sites
        const sitesQuery = query(
          collection(db, 'sites'),
          where('userId', '==', currentUser.uid)
        );
        
        const sitesSnapshot = await getDocs(sitesQuery);
        const sitesData = sitesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Site[];
        
        setSites(sitesData);
        
        // Fetch all history for all sites
        const siteIds = sitesData.map(site => site.id);
        
        if (siteIds.length > 0) {
          const historyQuery = query(
            collection(db, 'indexingHistory'),
            where('siteId', 'in', siteIds),
            orderBy('timestamp', 'desc') // Changed 'timestamp' to 'timestamp'
          );
          
          const historySnapshot = await getDocs(historyQuery);
          const historyData = historySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              pageId: data.pageId || '',
              siteId: data.siteId,
              timestamp: data.timestamp, // Map timestamp to timestamp
              action: data.action,
              result: data.message || 'N/A', // Map message to result
              status: data.status,
              creditsUsed: data.creditsUsed ?? data.estimatedCredits ?? 0, // Map credits
            };
          }).filter(item => item.timestamp) as IndexingHistory[]; // Ensure timestamp is valid for sorting/display
          
          setHistory(historyData);
        } else {
          setHistory([]); // Clear history if no sites
        }
      } catch (err) {
        console.error('Error fetching history data:', err);
        setHistory([]); // Clear history on error to avoid crashes
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  const getSiteNameById = (siteId: string): string => {
    const site = sites.find(s => s.id === siteId);
    return site ? site.name : 'Unknown Site';
  };

  // Filter and sort the history data
  const filteredHistory = history.filter(item => {
    const matchesSearch = searchQuery 
      ? getSiteNameById(item.siteId).toLowerCase().includes(searchQuery.toLowerCase())
      : true;
      
    const matchesSite = selectedSite 
      ? item.siteId === selectedSite
      : true;
      
    const matchesAction = selectedAction 
      ? item.action === selectedAction
      : true;
      
    return matchesSearch && matchesSite && matchesAction;
  });
  
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    // Ensure timestamp objects are valid and have toDate method
    const aTime = a.timestamp && typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate().getTime() : 0;
    const bTime = b.timestamp && typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate().getTime() : 0;
    
    return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
  });

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const exportHistory = () => {
    // Simple CSV export
    const headers = ['Date', 'Site', 'Action', 'Result', 'Credits Used'];
    
    const csvData = sortedHistory.map(item => [
      // Ensure timestamp objects are valid and have toDate method for CSV export
      item.timestamp && typeof item.timestamp.toDate === 'function' ? item.timestamp.toDate().toISOString() : 'N/A',
      getSiteNameById(item.siteId),
      item.action === 'check' ? 'Check Indexing' : 'Request Indexing',
      item.result,
      item.creditsUsed
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `indexing-history-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Indexing History</h1>
          <p className="text-slate-500">Track all indexing checks and requests</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <button 
            onClick={exportHistory}
            className="btn-secondary"
            disabled={filteredHistory.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
        <div className="relative flex-grow md:max-w-xs">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search sites..."
            className="input pl-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex-grow md:max-w-xs">
          <label htmlFor="select-site-filter" className="sr-only">Filter by site</label>
          <select
            id="select-site-filter"
            className="input w-full"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            <option value="">All Sites</option>
            {sites.map(site => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex-grow md:max-w-xs">
          <label htmlFor="select-action-filter" className="sr-only">Filter by action</label>
          <select
            id="select-action-filter"
            className="input w-full"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
          >
            <option value="">All Actions</option>
            <option value="check">Check Indexing</option>
            <option value="index_request">Request Indexing</option>
          </select>
        </div>
        
        <button
          onClick={toggleSortOrder}
          className="btn-secondary flex items-center"
        >
          <ArrowDownUp className="w-4 h-4 mr-2" />
          {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
        </button>
      </div>

      {/* History table */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Indexing Actions</h2>
          <div className="flex items-center text-sm text-slate-500">
            <Calendar className="w-4 h-4 mr-2" />
            <span>All Time</span>
          </div>
        </div>
        
        <HistoryTable 
          history={sortedHistory} 
          sites={sites}
          loading={loading}
        />
      </div>

      {/* Checked Pages Table */}
      <div className="mt-8">
        <CheckedPagesTable />
      </div>
    </div>
  );
};

export default HistoryPage;