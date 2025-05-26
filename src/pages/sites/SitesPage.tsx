import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Globe, 
  RefreshCw
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'; // Added updateDoc, serverTimestamp
import { getFunctions, httpsCallable } from 'firebase/functions'; // Added Firebase Functions imports
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Site } from '../../types/site';
import SiteListItem from './components/SiteListItem';
import ComingSoonModal from './components/ComingSoonModal'; // Import the new modal

const SitesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false); // Add state for the modal
  const [actionError, setActionError] = useState<string | null>(null); // For displaying errors from actions
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null); // For displaying success messages

  const fetchSites = async () => {
    if (!currentUser) return;
    setLoading(true);
    setActionError(null); // Clear previous errors on fetch
    // setActionSuccessMessage(null); // Optionally clear success messages on refresh
    try {
      const sitesQuery = query(
        collection(db, 'sites'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(sitesQuery);
      const sitesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Site[];
      
      setSites(sitesData);
    } catch (err) {
      console.error('Error fetching sites:', err);
      setActionError('Error fetching sites: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, [currentUser]);

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'sites', siteId));
      setSites(prev => prev.filter(site => site.id !== siteId));
      setActionSuccessMessage('Site deleted successfully.');
    } catch (err) {
      console.error('Error deleting site:', err);
      // alert('Failed to delete site. Please try again.');
      setActionError('Failed to delete site: ' + (err as Error).message);
    }
  };

  const handleScanNowForSite = async (siteId: string, siteUrl: string, gscProperty?: string) => {
    console.log(`Requesting scan for site: ${siteId}, URL: ${siteUrl}, GSC: ${gscProperty}`);
    setActionError(null);
    setActionSuccessMessage(null);
    if (!currentUser) {
      setActionError("User not authenticated.");
      return;
    }

    const functions = getFunctions();
    const getSiteIndexingStatus = httpsCallable(functions, 'get_site_indexing_status');
    const siteIdentifier = gscProperty || siteUrl;

    try {
      const response: any = await getSiteIndexingStatus({ siteUrl: siteIdentifier });
      const { status: cloudFnStatus, message: cloudFnMessage } = response.data as { status: string; message: string };

      const siteDocRef = doc(db, 'sites', siteId);
      await updateDoc(siteDocRef, {
        lastScan: serverTimestamp(),
        lastScanStatus: cloudFnStatus === 'pending' ? 'processing' : (cloudFnStatus || 'queued_with_unknown_status'),
        lastScanMessage: cloudFnMessage || 'Indexing check initiated.',
      });
      setActionSuccessMessage(`Indexing check initiated for ${siteIdentifier}: ${cloudFnMessage}`);
      // Optionally, refresh just this site's data or all sites after a delay
      // setTimeout(fetchSites, 5000); // Example: refresh all sites after 5s
    } catch (error: any) {
      console.error('Error calling get_site_indexing_status:', error);
      setActionError(`Error initiating scan for ${siteIdentifier}: ${error.message}`);
      const siteDocRef = doc(db, 'sites', siteId);
      try {
        await updateDoc(siteDocRef, { // Log error to site document as well
            lastScan: serverTimestamp(),
            lastScanStatus: 'error',
            lastScanMessage: `Failed to initiate scan: ${error.message}`,
        });
      } catch (updateError) {
        console.error('Error updating site document with scan error:', updateError);
      }
    }
  };

  const handleRequestReindexForSite = async (siteId: string, gscProperty: string) => {
    console.log(`Requesting re-index for site: ${siteId}, GSC: ${gscProperty}`);
    setActionError(null);
    setActionSuccessMessage(null);
    if (!currentUser) {
      setActionError("User not authenticated.");
      return;
    }
    if (!gscProperty) {
      setActionError("GSC Property is required to request re-indexing.");
      return;
    }

    const functions = getFunctions();
    const requestSiteReindexing = httpsCallable(functions, 'request_site_reindexing');

    try {
      const response: any = await requestSiteReindexing({ siteUrl: gscProperty });
      const { status: cloudFnStatus, message: cloudFnMessage, urlsQueued } = response.data as { status: string; message: string; urlsQueued?: number };

      const siteDocRef = doc(db, 'sites', siteId);
      if (cloudFnStatus === 'pending') {
        await updateDoc(siteDocRef, {
          lastReindexRequestAt: serverTimestamp(),
          lastReindexStatus: 'pending',
          lastReindexMessage: cloudFnMessage || `Re-indexing task for ${urlsQueued || 'several'} URLs initiated.`,
        });
        setActionSuccessMessage(`Re-indexing request for ${gscProperty} is pending: ${cloudFnMessage}`);
      } else if (cloudFnStatus === 'no_urls_to_reindex' || cloudFnStatus === 'no_urls_found') {
        await updateDoc(siteDocRef, {
          lastReindexRequestAt: serverTimestamp(),
          lastReindexStatus: 'no_action_needed',
          lastReindexMessage: cloudFnMessage || 'No URLs found requiring re-indexing.',
        });
        setActionSuccessMessage(`Re-indexing for ${gscProperty}: ${cloudFnMessage}`);
      } else {
        await updateDoc(siteDocRef, {
          lastReindexRequestAt: serverTimestamp(),
          lastReindexStatus: 'error',
          lastReindexMessage: `Re-index request failed: ${cloudFnMessage || 'Unknown reason'}`,
        });
        setActionError(`Re-index request for ${gscProperty} failed: ${cloudFnMessage}`);
      }
      // Optionally, refresh just this site's data or all sites after a delay
      // setTimeout(fetchSites, 5000); // Example: refresh all sites after 5s
    } catch (error: any) {
      console.error('Error calling request_site_reindexing:', error);
      setActionError(`Error initiating re-index for ${gscProperty}: ${error.message}`);
      const siteDocRef = doc(db, 'sites', siteId);
      try {
        await updateDoc(siteDocRef, { // Log error to site document as well
            lastReindexRequestAt: serverTimestamp(),
            lastReindexStatus: 'error',
            lastReindexMessage: `Failed to initiate re-index: ${error.message}`,
        });
      } catch (updateError) {
        console.error('Error updating site document with re-index error:', updateError);
      }
    }
  };

  const filteredSites = sites.filter(site => 
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Sites</h1>
          <p className="text-slate-500">Manage your monitored websites</p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <button 
            onClick={() => setIsComingSoonModalOpen(true)} // Open modal onClick
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Site
          </button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="mb-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search sites..."
            className="input pl-10 w-full md:w-80"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Action Feedback Messages */}
      {actionError && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">
          <strong>Error:</strong> {actionError}
        </div>
      )}
      {actionSuccessMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm">
          <strong>Success:</strong> {actionSuccessMessage}
        </div>
      )}

      {/* Sites list */}
      <div className="card overflow-visible">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Your Sites</h2>
          <button className="text-sm text-blue-800 hover:text-blue-900 flex items-center">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh All
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-blue-800 animate-spin mx-auto mb-4" />
            <p>Loading your sites...</p>
          </div>
        ) : filteredSites.length > 0 ? (
          <div className="divide-y divide-slate-100 relative z-1">
            {filteredSites.map(site => (
              <SiteListItem 
                key={site.id} 
                site={site} 
                onDelete={handleDeleteSite} 
                onScanNow={handleScanNowForSite} // Pass the handler
                onRequestReindex={handleRequestReindexForSite} // Pass the handler
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
              <Globe className="w-6 h-6 text-slate-400" />
            </div>
            {searchQuery ? (
              <>
                <h3 className="text-lg font-medium text-slate-800 mb-2">No sites match your search</h3>
                <p className="text-slate-500 mb-4">Try adjusting your search terms</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-slate-800 mb-2">No sites added yet</h3>
                <p className="text-slate-500 mb-4">Add your first site to start monitoring indexing</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Coming Soon Modal */}
      {isComingSoonModalOpen && (
        <ComingSoonModal onClose={() => setIsComingSoonModalOpen(false)} />
      )}
    </div>
  );
};

export default SitesPage;