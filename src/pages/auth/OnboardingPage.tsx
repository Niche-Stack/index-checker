import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, ArrowRight, Globe, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [seoFocus, setSeoFocus] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [searchConsoleConnected, setSearchConsoleConnected] = useState(false);
  const { updateUserProfile, connectSearchConsole: connectSearchConsoleAuth, currentUser } = useAuth();
  const navigate = useNavigate();

  const totalSteps = 3;

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
        onboardingCompleted: true
      });

      let formattedSiteUrl = siteUrl;
      if (formattedSiteUrl && !/^https?:\/\//i.test(formattedSiteUrl)) {
        formattedSiteUrl = 'https://' + formattedSiteUrl;
      }
      let formattedSitemapUrl = sitemapUrl;
      if (sitemapUrl && !/^https?:\/\//i.test(formattedSitemapUrl)) {
        formattedSitemapUrl = 'https://' + formattedSitemapUrl;
      }

      const siteData = {
        userId: currentUser.uid,
        name: formattedSiteUrl ? new URL(formattedSiteUrl).hostname : 'Unnamed Site',
        url: formattedSiteUrl,
        sitemapUrl: formattedSitemapUrl || '',
        createdAt: serverTimestamp(),
        lastScan: null,
        totalPages: 0,
        indexedPages: 0,
      };

      await addDoc(collection(db, 'sites'), siteData);
      console.log('Site added to Firestore:', siteData);

      if (!searchConsoleConnected) {
        console.warn('Search Console not connected before completing onboarding.');
      }
      
      navigate('/dashboard');
    } catch (err) {
      console.error('Error completing onboarding:', err);
    }
  };

  const handleConnectSearchConsole = async () => {
    try {
      const accessToken = await connectSearchConsoleAuth();
      if (accessToken) {
        setSearchConsoleConnected(true);
        console.log('Search Console connected successfully.');
      } else {
        console.error('Search Console connection failed. Access token not received.');
      }
    } catch (error) {
      console.error('Error during Search Console connection process:', error);
    }
  };

  return (
    <div className="animate-fade-up">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div 
              key={i} 
              className={`relative flex items-center justify-center ${
                i === totalSteps - 1 ? 'flex-1' : 'flex-1'
              }`}
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
          <span className="ml-2">Add Your Site</span> {/* Changed label */}
          <span>Connect Search Console</span>
        </div>
      </div>

      <div className="card p-8">
        {/* Step 1: Basic Profile */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Tell us about your SEO focus</h2>
            <p className="text-slate-600 mb-6">
              This helps us optimize Index Checker for your specific needs.
            </p>

            <div className="space-y-4 mb-8">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">What best describes your SEO focus?</span>
                <select
                  value={seoFocus}
                  onChange={(e) => setSeoFocus(e.target.value)}
                  className="input w-full mt-1"
                  required
                >
                  <option value="" disabled>Select your focus</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="blog">Blog / Content</option>
                  <option value="saas">SaaS / Software</option>
                  <option value="local">Local Business</option>
                  <option value="enterprise">Enterprise / Corporate</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Add Your Site */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Add Your Site</h2>
            <p className="text-slate-600 mb-6">
              Provide the URL of the site you want to index and its sitemap URL.
            </p>

            <div className="bg-slate-50 p-5 rounded-lg mb-8 border border-slate-200">
              <div className="flex items-start">
                <div className="mr-4 mt-1">
                  <Globe className="w-6 h-6 text-slate-400" /> {/* Changed icon */}
                </div>
                <div>
                  <h3 className="font-medium text-slate-800 mb-1">Site Details</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    We'll use this information to track and manage your site's indexing status.
                  </p>
                  
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Site URL</span>
                      <input
                        type="url"
                        value={siteUrl}
                        onChange={(e) => setSiteUrl(e.target.value)}
                        placeholder="https://www.example.com"
                        className="input w-full mt-1"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Sitemap URL (optional)</span>
                      <input
                        type="url"
                        value={sitemapUrl}
                        onChange={(e) => setSitemapUrl(e.target.value)}
                        placeholder="https://www.example.com/sitemap.xml"
                        className="input w-full mt-1"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Connect Google Search Console */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Connect Google Search Console</h2>
            <p className="text-slate-600 mb-6">
              Connect your Google Search Console account to enable Index Checker to monitor and manage your indexed pages.
            </p>

            <div className="bg-slate-50 p-5 rounded-lg mb-8 border border-slate-200">
              <div className="flex items-start">
                <div className="mr-4 mt-1">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-800 mb-1">Search Console Access</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    We need read and write access to your Search Console to check index status and request indexing.
                  </p>
                  
                  {searchConsoleConnected ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <span className="font-medium">Successfully connected</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectSearchConsole} // Updated to call new handler
                      className="btn-primary py-2"
                    >
                      Connect Search Console
                    </button>
                  )}
                </div>
              </div>
            </div>
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
            disabled={(step === 1 && !seoFocus) || 
                    (step === 2 && (!siteUrl)) || // Sitemap URL is optional
                    (step === 3 && !searchConsoleConnected)}
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