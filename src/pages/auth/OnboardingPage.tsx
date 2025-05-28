import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, ArrowRight, Globe, Link as LinkIcon, Loader2 } from 'lucide-react'; // Removed unused icons
import { useAuth, GSCSite } from '../../contexts/AuthContext';
import { collection, serverTimestamp, writeBatch, doc } from 'firebase/firestore'; // Removed unused addDoc
import { db } from '../../config/firebase';

const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [seoFocus, setSeoFocus] = useState('');
  // siteUrl and sitemapUrl states removed, will be handled by selectedSites
  const [searchConsoleConnected, setSearchConsoleConnected] = useState(false);
  const {
    updateUserProfile,
    connectSearchConsole: connectSearchConsoleAuth,
    fetchGoogleSearchConsoleSites,
    currentUser,
    userProfile
  } = useAuth();
  const navigate = useNavigate();

  const [gscSites, setGscSites] = useState<GSCSite[]>([]);
  const [selectedSites, setSelectedSites] = useState<GSCSite[]>([]);
  const [loadingGscSites, setLoadingGscSites] = useState(false);
  const [errorGscSites, setErrorGscSites] = useState<string | null>(null);

  // New state for additional profile questions
  const [seoImportance, setSeoImportance] = useState('');
  const [newPagesPerMonth, setNewPagesPerMonth] = useState('');

  const totalSteps = 3;

  // Effect to check if GSC is already connected from userProfile
  useEffect(() => {
    if (userProfile?.searchConsoleConnected) {
      setSearchConsoleConnected(true);
      // If connected, on new step 2 (GSC connect), and sites haven't been loaded/are not loading, and no error previously
      if (step === 2 && gscSites.length === 0 && !loadingGscSites && !errorGscSites) {
        handleFetchGscSites(); // Will use token from userProfile via AuthContext
      }
    }
  }, [userProfile, step, gscSites.length, loadingGscSites, errorGscSites]); // Added dependencies

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const completeOnboarding = async () => {
    if (!currentUser) {
      console.error("User not found, cannot complete onboarding");
      return;
    }

    try {
      await updateUserProfile({
        seoFocus,
        seoImportance, // Added
        newPagesPerMonth, // Added
        onboardingCompleted: true
      });

      // Add selected GSC sites to Firestore 'sites' collection
      const batch = writeBatch(db);
      let sitesProcessedForBatch = 0; // Initialize counter

      selectedSites.forEach(gscSite => {
        const originalGscSiteUrl = gscSite.siteUrl; // Use a clear name for the original value

        if (!originalGscSiteUrl || originalGscSiteUrl.trim() === '') {
          console.warn('Skipping selected GSC site with empty or whitespace URL:', gscSite);
          return; 
        }

        let siteNameForDb: string;
        let urlForDb: string;

        if (originalGscSiteUrl.startsWith('sc-domain:')) {
          const domain = originalGscSiteUrl.substring('sc-domain:'.length);
          siteNameForDb = domain;
          urlForDb = 'https://' + domain;
        } else {
          // Handles URL prefix properties like http://example.com or https://www.example.com/path
          // It could also be just "example.com"
          let tempUrl = originalGscSiteUrl;
          if (!/^https?:\/\//i.test(tempUrl)) {
            tempUrl = 'https://' + tempUrl;
          }
          urlForDb = tempUrl; // This will be stored as the site's URL

          try {
            siteNameForDb = new URL(urlForDb).hostname;
          } catch (e) {
            console.warn(`Error parsing hostname from GSC site URL '${originalGscSiteUrl}'. Attempting fallback. Error:`, e);
            // Fallback: extract what looks like a hostname before any path
            const parts = originalGscSiteUrl.replace(/^https?:\/\//, '').split('/');
            siteNameForDb = parts[0];
            if (!siteNameForDb) {
                console.error(`Could not determine a valid site name for GSC URL: ${originalGscSiteUrl}. Skipping this site.`);
                return; // Skip this site if a name cannot be derived
            }
          }
        }
        
        // Ensure siteNameForDb is not empty after all processing (trimming and final check)
        siteNameForDb = siteNameForDb.trim();
        if (!siteNameForDb) {
            console.error(`Could not determine a valid site name for GSC URL: ${originalGscSiteUrl} after attempting all parsing and fallbacks. Skipping this site.`);
            return; // Skip this site
        }
        
        const siteData = {
          userId: currentUser.uid,
          name: siteNameForDb, 
          url: urlForDb,
          sitemapUrl: '', // Sitemap URL not provided by GSC listing
          gscProperty: originalGscSiteUrl, // Store the original GSC property URL
          createdAt: serverTimestamp(),
          lastScan: null,
          totalPages: 0,
          indexedPages: 0,
        };
        const siteRef = doc(collection(db, 'sites')); 
        batch.set(siteRef, siteData);
        sitesProcessedForBatch++; // Increment counter
      });

      // Check if sites were selected but none were processed
      if (selectedSites.length > 0 && sitesProcessedForBatch === 0) {
        console.error('Onboarding Error: None of the selected GSC sites could be processed. Please check their format in Google Search Console.');
        throw new Error('Failed to process any selected sites. Please ensure they are valid and try again.');
      }

      if (sitesProcessedForBatch > 0) {
        await batch.commit();
        console.log(`${sitesProcessedForBatch} GSC sites added to Firestore.`);
      } else {
        console.log('No GSC sites were processed to be added to Firestore.');
      }
      
      navigate('/dashboard');
    } catch (err) {
      console.error('Error completing onboarding:', err);
      // TODO: Show user-friendly error message
    }
  };

  const handleConnectSearchConsole = async () => {
    try {
      const token = await connectSearchConsoleAuth(); // Changed variable name for clarity
      if (token) {
        setSearchConsoleConnected(true);
        console.log('Search Console connected successfully.');
        // Automatically fetch sites after connecting, passing the new token
        handleFetchGscSites(token);
      } else {
        console.error('Search Console connection failed. Access token not received.');
        setErrorGscSites('Failed to connect Search Console. Please try again.');
      }
    } catch (error) {
      console.error('Error during Search Console connection process:', error);
      setErrorGscSites('An error occurred while connecting to Search Console.');
    }
  };

  const handleFetchGscSites = async (accessToken?: string) => {
    setLoadingGscSites(true);
    setErrorGscSites(null);
    try {
      const sites = await fetchGoogleSearchConsoleSites(accessToken);
      setGscSites(sites);
      if (sites.length === 0) {
        setErrorGscSites("No sites found in your Google Search Console account, or we couldn't access them. Please ensure you have sites verified in GSC and that you granted the necessary permissions during connection.");
      }
    } catch (error) {
      console.error('Error fetching GSC sites in OnboardingPage:', error);
      if (error instanceof Error) {
        // Use the detailed message from the error thrown by AuthContext
        setErrorGscSites(error.message); 
      } else {
        // Fallback for non-Error objects
        setErrorGscSites('An unknown error occurred while fetching your sites. Please check your connection and permissions.');
      }
    } finally {
      setLoadingGscSites(false);
    }
  };

  const toggleSiteSelection = (site: GSCSite) => {
    setSelectedSites(prev => 
      prev.some(s => s.siteUrl === site.siteUrl) 
        ? prev.filter(s => s.siteUrl !== site.siteUrl)
        : [...prev, site]
    );
  };

  // Determine if the next/complete button should be disabled
  const isNextButtonDisabled = () => {
    if (step === 1 && (!seoFocus || !seoImportance || !newPagesPerMonth)) return true; // New Step 1: Profile
    if (step === 2 && !searchConsoleConnected) return true; // New Step 2: Connect GSC
    if (step === 3 && selectedSites.length === 0) return true; // New Step 3: Select Sites
    return false;
  };

  return (
    <div className="animate-fade-up">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div 
              key={i} 
              className={`relative flex items-center justify-center flex-1`}
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i + 1 === step
                    ? 'bg-blue-600 text-white'
                    : i + 1 < step
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i + 1 < step ? <CheckCircle className="w-5 h-5" /> : i + 1}
              </div>
              
              {i < totalSteps - 1 && (
                <div 
                  className={`h-1 flex-1 mx-2 ${
                    i + 1 < step ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                ></div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Your Profile</span>
          <span className="text-center">Connect Search Console</span>
          <span className="text-right">Select Sites</span>
        </div>
      </div>

      <div className="card p-8">
        {/* Step 1: Basic Profile (Moved from Step 3 and expanded) */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Tell us about your business</h2>
            <p className="text-slate-600 mb-6">
              This helps us optimize Index Checker for your specific needs.
            </p>

            <div className="space-y-6 mb-8"> {/* Increased spacing */}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">What industry are you in?</span>
                <select
                  value={seoFocus}
                  onChange={(e) => setSeoFocus(e.target.value)}
                  className="input w-full mt-1"
                  required
                >
                  <option value="" disabled>Select your industry</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="blog">Blog / Content</option>
                  <option value="saas">SaaS / Software</option>
                  <option value="local">Local Business</option>
                  <option value="enterprise">Enterprise / Corporate</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">How important is SEO to your growth?</span>
                <select
                  value={seoImportance}
                  onChange={(e) => setSeoImportance(e.target.value)}
                  className="input w-full mt-1"
                  required
                >
                  <option value="" disabled>Select importance</option>
                  <option value="low">Not very important</option>
                  <option value="medium">Somewhat important</option>
                  <option value="high">Very important</option>
                  <option value="critical">Critical</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">How many new webpages do you add each month?</span>
                <select
                  value={newPagesPerMonth}
                  onChange={(e) => setNewPagesPerMonth(e.target.value)}
                  className="input w-full mt-1"
                  required
                >
                  <option value="" disabled>Select range</option>
                  <option value="0-10">0-10 pages</option>
                  <option value="11-50">11-50 pages</option>
                  <option value="51-200">51-200 pages</option>
                  <option value="200+">200+ pages</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Connect Google Search Console (Moved from Step 1) */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Connect Google Search Console</h2>
            <p className="text-slate-600 mb-6">
              Connect your Google Search Console account to allow Index Checker to access your sites.
            </p>

            <div className="bg-slate-50 p-5 rounded-lg mb-8 border border-slate-200">
              <div className="flex items-start">
                <div className="mr-4 mt-1">
                  <LinkIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-800 mb-1">Search Console Access</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    We need access to your Search Console to fetch your sites and later to check index status and request indexing.
                  </p>
                  
                  {searchConsoleConnected ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <span className="font-medium">Successfully connected to Google Search Console!</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectSearchConsole}
                      className="btn-primary py-2"
                      disabled={loadingGscSites} // Disable while attempting to connect/fetch
                    >
                      {loadingGscSites ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</>
                      ) : (
                        'Connect Search Console'
                      )}
                    </button>
                  )}
                  {errorGscSites && !searchConsoleConnected && (
                     <p className="text-sm text-red-600 mt-2">{errorGscSites}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Select Sites from GSC (Moved from Step 2) */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Select Sites to Monitor</h2>
            <p className="text-slate-600 mb-6">
              Choose the sites from your Google Search Console account you want to monitor with Index Checker.
            </p>
            {loadingGscSites && (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mr-3" />
                <p className="text-slate-600">Loading your sites from Google Search Console...</p>
              </div>
            )}
            {errorGscSites && !loadingGscSites && (
              <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
                {errorGscSites}
                {gscSites.length === 0 && (
                  <button onClick={() => handleFetchGscSites()} className="btn-secondary mt-3 text-sm">
                    Try fetching sites again
                  </button>
                )}
              </div>
            )}
            {!loadingGscSites && !errorGscSites && gscSites.length === 0 && (
              <div className="text-center p-6 bg-slate-50 rounded-lg">
                <Globe className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">No Sites Found</h3>
                <p className="text-sm text-slate-500 mb-4">We couldn't find any sites in your Google Search Console account. Please ensure you have sites verified and that you granted the necessary permissions.</p>
                <button onClick={() => handleFetchGscSites()} className="btn-secondary text-sm">
                  Refresh Site List
                </button>
              </div>
            )}
            {!loadingGscSites && gscSites.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {gscSites.map(site => (
                  <div 
                    key={site.siteUrl}
                    onClick={() => toggleSiteSelection(site)}
                    className={`p-4 border rounded-lg cursor-pointer flex items-center justify-between hover:border-blue-500 transition-colors ${
                      selectedSites.some(s => s.siteUrl === site.siteUrl) 
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500' 
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-slate-800">{site.siteUrl}</p>
                      <p className="text-xs text-slate-500">Permission: {site.permissionLevel}</p>
                    </div>
                    {selectedSites.some(s => s.siteUrl === site.siteUrl) && (
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="btn-secondary"
            >
              Back
            </button>
          ) : (
            <div></div> 
          )}
          
          <button
            onClick={handleNext}
            className="btn-primary"
            disabled={isNextButtonDisabled()}
          >
            {step < totalSteps ? (
              <>
                Next
                <ChevronRight className="w-5 h-5 ml-1" />
              </>
            ) : (
              <>
                Complete Setup
                <ArrowRight className="w-5 h-5 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;