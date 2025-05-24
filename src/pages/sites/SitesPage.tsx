import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Globe, 
  RefreshCw
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, doc, deleteDoc } from 'firebase/firestore';
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

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchSites = async () => {
      setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, [currentUser]);

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'sites', siteId));
      setSites(prev => prev.filter(site => site.id !== siteId));
    } catch (err) {
      console.error('Error deleting site:', err);
      alert('Failed to delete site. Please try again.');
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