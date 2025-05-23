import React, { useState } from 'react';
import { X, Globe, Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { Site } from '../../../types/site';

interface AddSiteModalProps {
  onClose: () => void;
  onSiteAdded: (site: Site) => void;
}

const AddSiteModal: React.FC<AddSiteModalProps> = ({ onClose, onSiteAdded }) => {
  const { currentUser } = useAuth();
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    // Basic validation
    if (!siteName.trim()) {
      setError('Site name is required');
      return;
    }
    
    if (!siteUrl.trim()) {
      setError('Site URL is required');
      return;
    }
    
    if (!sitemapUrl.trim()) {
      setError('Sitemap URL is required');
      return;
    }
    
    // Ensure URLs have proper format
    let formattedSiteUrl = siteUrl;
    if (!/^https?:\/\//i.test(formattedSiteUrl)) {
      formattedSiteUrl = 'https://' + formattedSiteUrl;
    }
    
    let formattedSitemapUrl = sitemapUrl;
    if (!/^https?:\/\//i.test(formattedSitemapUrl)) {
      formattedSitemapUrl = 'https://' + formattedSitemapUrl;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // In a real app, we would validate the sitemap URL and fetch the sitemap data
      // For demo purposes, we'll simulate this with a timeout
      
      // Add site to Firestore
      const siteData = {
        userId: currentUser.uid,
        name: siteName,
        url: formattedSiteUrl,
        sitemapUrl: formattedSitemapUrl,
        createdAt: serverTimestamp(),
        lastScan: null,
        totalPages: 0,
        indexedPages: 0
      };
      
      const docRef = await addDoc(collection(db, 'sites'), siteData);
      
      // Add the new site to the UI
      onSiteAdded({
        id: docRef.id,
        ...siteData,
        createdAt: new Date(),
      } as Site);
      
      onClose();
    } catch (err) {
      console.error('Error adding site:', err);
      setError('Failed to add site. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-up">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Add New Site</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="site-name" className="block text-sm font-medium text-slate-700 mb-1">
                Site Name
              </label>
              <input
                id="site-name"
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="input w-full"
                placeholder="My Website"
                required
              />
            </div>
            
            <div>
              <label htmlFor="site-url" className="block text-sm font-medium text-slate-700 mb-1">
                Site URL
              </label>
              <input
                id="site-url"
                type="text"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                className="input w-full"
                placeholder="https://example.com"
                required
              />
            </div>
            
            <div>
              <label htmlFor="sitemap-url" className="block text-sm font-medium text-slate-700 mb-1">
                Sitemap URL
              </label>
              <input
                id="sitemap-url"
                type="text"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                className="input w-full"
                placeholder="https://example.com/sitemap.xml"
                required
              />
            </div>
          </div>
          
          <div className="mt-8 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  Add Site
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSiteModal;