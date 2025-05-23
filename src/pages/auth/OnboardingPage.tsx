import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, ArrowRight, Globe, Search, Cog } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [seoFocus, setSeoFocus] = useState('');
  const [makeConnected, setMakeConnected] = useState(false);
  const [searchConsoleConnected, setSearchConsoleConnected] = useState(false);
  const { updateUserProfile } = useAuth();
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
    try {
      await updateUserProfile({
        seoFocus,
        makeConnected,
        searchConsoleConnected,
        onboardingCompleted: true
      });
      navigate('/dashboard');
    } catch (err) {
      console.error('Error completing onboarding:', err);
    }
  };

  const connectMake = () => {
    // In a real app, this would open a Make.com OAuth flow
    setTimeout(() => {
      setMakeConnected(true);
    }, 1000);
  };

  const connectSearchConsole = () => {
    // In a real app, this would open a Google Search Console OAuth flow
    setTimeout(() => {
      setSearchConsoleConnected(true);
    }, 1000);
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
          <span className="ml-2">Connect Make.com</span>
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

        {/* Step 2: Connect Make.com */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Connect with Make.com</h2>
            <p className="text-slate-600 mb-6">
              Index Checker uses Make.com to automate the indexing process for your web pages.
            </p>

            <div className="bg-slate-50 p-5 rounded-lg mb-8 border border-slate-200">
              <div className="flex items-start">
                <div className="mr-4 mt-1">
                  <Cog className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-800 mb-1">Automated Workflows</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    We'll create custom Make.com workflows that monitor and maintain your page indexing status automatically.
                  </p>
                  
                  {makeConnected ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      <span className="font-medium">Successfully connected</span>
                    </div>
                  ) : (
                    <button
                      onClick={connectMake}
                      className="btn-primary py-2"
                    >
                      Connect Make.com
                    </button>
                  )}
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
                      onClick={connectSearchConsole}
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
                    (step === 2 && !makeConnected) || 
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