import React, { useState } from 'react';
import { 
  Globe, 
  MoreVertical, 
  ExternalLink, 
  Trash2, 
  Edit, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { format } from 'date-fns';
import { Site } from '../../../types/site';

interface SiteListItemProps {
  site: Site;
  onDelete: (siteId: string) => Promise<void>;
  onScanNow: (siteId: string, siteUrl: string, gscProperty?: string) => Promise<void>; // Added for Scan Now
  onRequestReindex: (siteId: string, gscProperty: string) => Promise<void>; // Added for Re-index
}

const SiteListItem: React.FC<SiteListItemProps> = ({ site, onDelete, onScanNow, onRequestReindex }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false); // For individual item actions

  const handleScanNow = async () => {
    setIsMenuOpen(false);
    setIsActionLoading(true);
    await onScanNow(site.id, site.url, site.gscProperty);
    setIsActionLoading(false);
  };

  const handleRequestReindex = async () => {
    setIsMenuOpen(false);
    if (!site.gscProperty) {
      // Optionally, show a toast or alert that gscProperty is required
      console.warn('Cannot request re-index without gscProperty for site:', site.name);
      return;
    }
    setIsActionLoading(true);
    await onRequestReindex(site.id, site.gscProperty);
    setIsActionLoading(false);
  };

  const getStatusIndicator = () => {
    if (!site.totalPages) return null;
    
    const indexedPercentage = Math.round((site.indexedPages / site.totalPages) * 100);
    
    if (indexedPercentage >= 90) {
      return (
        <div className="flex items-center text-green-700">
          <CheckCircle2 className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">Good</span>
        </div>
      );
    } else if (indexedPercentage >= 70) {
      return (
        <div className="flex items-center text-amber-700">
          <AlertTriangle className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">Needs Attention</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-red-700">
          <AlertTriangle className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">Critical</span>
        </div>
      );
    }
  };
  
  return (
    <div className="p-5 hover:bg-slate-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center mr-4">
            <Globe className="w-5 h-5 text-blue-800" />
          </div>
          
          <div>
            <h3 className="font-medium text-slate-900">{site.name}</h3>
            <div className="flex items-center text-sm text-slate-500">
              <a 
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center hover:text-blue-800"
              >
                {site.url}
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          {getStatusIndicator()}
          
          <div className="text-center">
            <div className="text-lg font-medium text-slate-900">
              {site.indexedPages}/{site.totalPages || 0}
            </div>
            <div className="text-xs text-slate-500">
              Pages Indexed
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-sm text-slate-700">
              {site.lastScan ? format(site.lastScan.toDate(), 'MMM d, yyyy') : 'Never'}
            </div>
            <div className="text-xs text-slate-500">
              Last Scanned
            </div>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 disabled:opacity-50"
              disabled={isActionLoading}
            >
              {isActionLoading ? <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" /> : <MoreVertical className="w-4 h-4 text-slate-500" />}
            </button>
            
            {isMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg py-1 z-10 border border-slate-100">
                <button
                  onClick={handleScanNow}
                  disabled={isActionLoading}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check Indexing Status
                </button>
                <button
                  onClick={handleRequestReindex}
                  disabled={isActionLoading || !site.gscProperty} // Disable if no GSC property
                  title={!site.gscProperty ? 'GSC Property (e.g., sc-domain:example.com) must be set for this site to request re-indexing.' : 'Request re-indexing for non-indexed pages'}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4 mr-2 text-green-600" />
                  Request Re-index Missing
                </button>
                <div className="my-1 border-t border-slate-100"></div> 
                <button
                  // onClick={() => { /* TODO: Implement Edit Site */ setIsMenuOpen(false); }}
                  disabled // TODO: Re-enable when edit functionality is ready
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 opacity-50 cursor-not-allowed"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Site
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDelete(site.id);
                  }}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Site
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteListItem;