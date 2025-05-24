import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Globe, 
  ArrowUpRight, 
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock 
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore'; // Added addDoc, serverTimestamp, doc, updateDoc, increment
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Site, IndexingHistory } from '../../types/site';
import MetricCard from './components/MetricCard';
import RecentActivityList from './components/RecentActivityList';
import CreditsCard from './components/CreditsCard';
import SiteStatusChart from './components/SiteStatusChart';

const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [recentHistory, setRecentHistory] = useState<IndexingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  // Summary metrics
  const [totalPages, setTotalPages] = useState(0);
  const [totalIndexed, setTotalIndexed] = useState(0);
  const [totalNonIndexed, setTotalNonIndexed] = useState(0);
  const [actionsThisMonth, setActionsThisMonth] = useState(0);

  const fetchDashboardData = async () => {
    if (!currentUser) return;

    try {
      // Fetch user's sites
      const sitesQuery = query(
        collection(db, 'sites'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const sitesSnapshot = await getDocs(sitesQuery);
      const sitesData = sitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Site[];
      
      setSites(sitesData);
      
      // Calculate metrics
      let pages = 0;
      let indexed = 0;
      
      sitesData.forEach(site => {
        pages += site.totalPages || 0;
        indexed += site.indexedPages || 0;
      });
      
      setTotalPages(pages);
      setTotalIndexed(indexed);
      setTotalNonIndexed(pages - indexed);
      
      // Fetch recent history and count actions this month
      if (sitesData.length > 0) {
        const siteIds = sitesData.map(site => site.id);
        
        // Fetch recent history for the activity list (limited)
        const historyQuery = query(
          collection(db, 'indexingHistory'),
          where('siteId', 'in', siteIds),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        
        const historySnapshot = await getDocs(historyQuery);
        const historyData = historySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as IndexingHistory[];
        setRecentHistory(historyData);
        
        // Accurately count actions this month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        
        const actionsQuery = query(
          collection(db, 'indexingHistory'),
          where('siteId', 'in', siteIds),
          where('timestamp', '>=', firstDayOfMonth),
          where('timestamp', '<', firstDayOfNextMonth)
        );
        
        const actionsSnapshot = await getDocs(actionsQuery);
        setActionsThisMonth(actionsSnapshot.size);
      } else {
        // No sites, so no recent history or actions this month
        setRecentHistory([]);
        setActionsThisMonth(0);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser]);

  const handleCheckAllPages = async () => {
    if (!currentUser || sites.length === 0 || isProcessingAction) return;
    setIsProcessingAction(true);
    console.log('Starting to check all pages for all sites...');

    try {
      for (const site of sites) {
        console.log(`Processing site: ${site.name} (${site.id})`);
        // TODO: Replace with your actual API call to check site status
        // const response = await fetch(`YOUR_API_ENDPOINT/check-status?siteUrl=${encodeURIComponent(site.url)}`, {
        //   method: 'POST', // or 'GET'
        //   headers: {
        //     'Authorization': `Bearer YOUR_API_KEY_OR_TOKEN`,
        //     'Content-Type': 'application/json',
        //   },
        // });
        // if (!response.ok) {
        //   throw new Error(`API error for site ${site.name}: ${response.statusText}`);
        // }
        // const result = await response.json();
        // const { indexedPages, totalPages, creditsUsed } = result; // Adjust based on your API response

        // Simulating API response for now
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
        const simulatedCreditsUsed = 1; // Placeholder
        let newIndexedPages = site.indexedPages || 0;
        // Simulate finding one new indexed page if not all are indexed
        if ((site.totalPages || 0) > 0 && newIndexedPages < (site.totalPages || 0)) {
            newIndexedPages = Math.min(newIndexedPages + 1, site.totalPages || 0);
        }

        const siteDocRef = doc(db, 'sites', site.id);
        await updateDoc(siteDocRef, {
          // indexedPages: indexedPages, // Use actual value from API
          // totalPages: totalPages, // Use actual value from API, if it can change
          indexedPages: newIndexedPages, // Using simulated value
          lastScan: serverTimestamp(),
        });
        console.log(`Updated site ${site.name} in Firestore.`);

        const historyCollectionRef = collection(db, 'indexingHistory');
        await addDoc(historyCollectionRef, {
          siteId: site.id,
          userId: currentUser.uid,
          timestamp: serverTimestamp(),
          action: 'site_check_all', // More specific action
          result: `Checked: ${newIndexedPages}/${site.totalPages || 0} indexed`, // Or more detailed result from API
          // creditsUsed: creditsUsed, // Use actual value from API
          creditsUsed: simulatedCreditsUsed, // Using simulated value
        });
        console.log(`Added history entry for site ${site.name} check action.`);
      }
      console.log('Finished checking all pages for all sites.');
      await fetchDashboardData(); // Refresh dashboard data
    } catch (error) {
      console.error('Error during check all pages:', error);
      // TODO: Add user-facing error notification
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReindexAllMissing = async () => {
    if (!currentUser || sites.length === 0 || isProcessingAction) return;
    setIsProcessingAction(true);
    console.log('Starting to reindex missing pages for all sites...');

    try {
      for (const site of sites) {
        const missingPages = (site.totalPages || 0) - (site.indexedPages || 0);
        if (missingPages <= 0) {
          console.log(`No missing pages to reindex for site ${site.name}.`);
          continue;
        }

        console.log(`Requesting reindex for ${missingPages} missing pages on site: ${site.name} (${site.id})`);
        // TODO: Replace with your actual API call to request re-indexing
        // const response = await fetch(`YOUR_API_ENDPOINT/reindex-missing`, {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer YOUR_API_KEY_OR_TOKEN`,
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({ siteUrl: site.url, missingPagesCount: missingPages })
        // });
        // if (!response.ok) {
        //   throw new Error(`API error for reindexing site ${site.name}: ${response.statusText}`);
        // }
        // const result = await response.json();
        // const { creditsUsed, submissionId } = result; // Adjust based on your API response

        // Simulating API response for now
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
        const simulatedCreditsUsedForReindex = missingPages * 1; // Example: 1 credit per page

        const historyCollectionRef = collection(db, 'indexingHistory');
        await addDoc(historyCollectionRef, {
          siteId: site.id,
          userId: currentUser.uid,
          timestamp: serverTimestamp(),
          action: 'site_reindex_missing', // More specific action
          result: 'pending', // Or 'successful_submission', 'failed_submission' based on API response
          details: `Requested reindex for ${missingPages} pages.`, // Optional: add submissionId or other details
          // creditsUsed: creditsUsed, // Use actual value from API
          creditsUsed: simulatedCreditsUsedForReindex, // Using simulated value
        });
        console.log(`Added history entry for site ${site.name} reindex action.`);

        const siteDocRef = doc(db, 'sites', site.id);
        await updateDoc(siteDocRef, {
          lastScan: serverTimestamp(), // Update last activity timestamp
        });
        console.log(`Updated lastScan for site ${site.name}.`);
      }
      console.log('Finished reindexing missing pages for all sites.');
      await fetchDashboardData(); // Refresh dashboard data
    } catch (error) {
      console.error('Error during reindex all missing:', error);
      // TODO: Add user-facing error notification
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center">
          <RefreshCw className="w-5 h-5 text-blue-800 animate-spin mr-2" />
          <span>Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Dashboard</h1>
          <p className="text-slate-500">Monitor your SEO indexing status</p>
        </div>
        
        {/* <div className="mt-4 md:mt-0 flex space-x-3">
          <Link to="/sites" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Site
          </Link>
        </div> */}
      </div>

      {/* Metrics overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard 
          title="Total Pages" 
          value={totalPages.toString()}
          icon={<Globe className="w-5 h-5 text-blue-900" />}
          description="Pages being monitored"
          color="blue"
        />
        
        <MetricCard 
          title="Indexed Pages" 
          value={totalIndexed.toString()}
          icon={<CheckCircle2 className="w-5 h-5 text-green-700" />}
          description={`${totalPages > 0 ? Math.round((totalIndexed / totalPages) * 100) : 0}% of total`}
          color="green"
        />
        
        <MetricCard 
          title="Non-indexed Pages" 
          value={totalNonIndexed.toString()}
          icon={<AlertTriangle className="w-5 h-5 text-amber-700" />}
          description="Pages needing attention"
          color="amber"
        />
        
        <MetricCard 
          title="Actions This Month" 
          value={actionsThisMonth.toString()}
          icon={<Clock className="w-5 h-5 text-blue-700" />}
          description="Index checks & requests"
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Sites overview */}
          <div className="card">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Site Status</h2>
                <Link to="/sites" className="text-sm text-blue-800 hover:text-blue-900 flex items-center">
                  View all
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
            {sites.length > 0 ? (
              <div className="p-6">
                <SiteStatusChart sites={sites} />
                <div className="mt-6 space-y-4">
                  {sites.slice(0, 3).map(site => (
                    <div key={site.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center mr-3">
                          <Globe className="w-5 h-5 text-blue-800" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">{site.name}</h3>
                          <p className="text-xs text-slate-500 flex items-center">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            {site.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <div className="text-sm font-medium text-slate-900">
                            {`${site.indexedPages || 0}/${site.totalPages || 0}`}
                          </div>
                          <div className="text-xs text-slate-500">
                            pages indexed
                          </div>
                        </div>
                        <div className="h-8 w-8 rounded-full flex items-center justify-center bg-blue-50 text-blue-800">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                  <Globe className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-2">No sites added yet</h3>
                <p className="text-slate-500 mb-4">Add your first site to start monitoring indexing</p>
                <Link to="/sites" className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Site
                </Link>
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                <Link to="/history" className="text-sm text-blue-800 hover:text-blue-900 flex items-center">
                  View history
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              <RecentActivityList activities={recentHistory} sites={sites} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-8">
          {/* Credits info */}
          <CreditsCard />

          {/* Quick actions */}
          <div className="card">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            </div>
            <div className="p-6 space-y-3">
              <button 
                onClick={handleCheckAllPages}
                disabled={isProcessingAction || sites.length === 0}
                className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-800 font-medium rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search className="w-4 h-4 mr-2" />
                Check All Pages (Simulated)
              </button>
              <button 
                onClick={handleReindexAllMissing}
                disabled={isProcessingAction || sites.length === 0}
                className="w-full py-3 bg-green-50 hover:bg-green-100 text-green-800 font-medium rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reindex All Missing (Simulated)
              </button>
              {/* <button className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium rounded-lg flex items-center justify-center transition-colors">
                <BarChart3 className="w-4 h-4 mr-2" />
                Generate Report
              </button> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;