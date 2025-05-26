import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { Loader2, AlertCircle } from 'lucide-react'; // Import icons

const SettingsPage = () => {
  const { connectSearchConsole, userProfile } = useAuth(); // Get connectSearchConsole and userProfile
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleReAuth = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await connectSearchConsole();
      setSuccessMessage("Successfully re-authenticated with Google and updated Search Console connection.");
      // Optionally, refresh userProfile or related data if needed
    } catch (err) {
      console.error("Error re-authenticating with Google:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred during re-authentication.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Google Account</h2>
        {userProfile?.searchConsoleConnected ? (
          <p className="text-gray-600 mb-4">
            Your Google Search Console account is connected.
          </p>
        ) : (
          <p className="text-gray-600 mb-4">
            Your Google Search Console account is not connected.
          </p>
        )}
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <p>{error}</p>
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 text-green-700 p-3 rounded-md mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" /> {/* Consider using a CheckCircle icon here */}
            <p>{successMessage}</p>
          </div>
        )}

        <button
          onClick={handleReAuth}
          disabled={isLoading}
          className="btn-primary py-2 px-4 rounded-md flex items-center justify-center disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            userProfile?.searchConsoleConnected ? 'Re-authorize Google Account' : 'Connect Google Account'
          )}
        </button>
        <p className="text-sm text-gray-500 mt-3">
          If you encounter issues with Google Search Console access, or if you need to switch accounts, use this option to re-authenticate.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;