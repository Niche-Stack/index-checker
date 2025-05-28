import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider, // Import GoogleAuthProvider to access credentialFromResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, updateDoc,
  collection, // Added
  writeBatch // Added
} from 'firebase/firestore'; // Import updateDoc
import { auth, db, googleProvider } from '../config/firebase';
import { User } from '../types/user';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  connectSearchConsole: () => Promise<string | null>;
  fetchGoogleSearchConsoleSites: (tokenOverride?: string) => Promise<GSCSite[]>; // Modified method signature
}

// Define GSCSite interface if it's not already globally available
// For simplicity, defining it here. Ideally, it would be in a types file.
export interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const profileData = userDoc.data() as User;
            setUserProfile(profileData);
            // If onboarding was completed and GSC is connected, consider an initial sync
            // This might be better handled explicitly after login or in a dedicated effect
            // For now, sync is triggered by connectSearchConsole or updateUserProfile (onboarding)
          } else {
            // New user, create basic profile
            const newUser: Partial<User> = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              createdAt: serverTimestamp() as Timestamp,
              updatedAt: serverTimestamp() as Timestamp,
              onboardingCompleted: false,
              credits: 100, // Free credits on signup
              seoFocus: '',
              searchConsoleConnected: false, // Ensure this field is initialized
              searchConsoleAccessToken: undefined, // Ensure this field is initialized
              // searchConsoleRefreshToken will be added if available during signInWithGoogle or connectSearchConsole
            };
            
            await setDoc(userRef, newUser);
            setUserProfile(newUser as User);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setError('Failed to load user profile');
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper function to sync GSC sites and their sitemaps to Firestore
  const syncGscSitesAndSitemapsToFirestore = async (userId: string, token: string) => {
    if (!userId || !token) {
      console.log('User ID or token missing, skipping GSC sync.');
      return;
    }

    try {
      const sites = await fetchGoogleSearchConsoleSites(token); // This method is defined below
      if (!sites || sites.length === 0) {
        console.log('No GSC sites found to sync for user:', userId);
        return;
      }

      const userGscSitesColRef = collection(db, 'users', userId, 'gscSites');
      const batch = writeBatch(db);

      for (const site of sites) {
        const siteDocId = encodeURIComponent(site.siteUrl); // Sanitize siteUrl for use as a document ID
        const siteRef = doc(userGscSitesColRef, siteDocId);
        
        let sitemapEntries: any[] = [];
        try {
          // Fetch sitemaps for this site
          // Note: site.siteUrl needs to be properly encoded for the API call if it's not already.
          // The GSC API expects the siteUrl as it was verified (e.g., sc-domain:example.com or https://www.example.com/)
          const sitemapsResponse = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site.siteUrl)}/sitemaps`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (sitemapsResponse.ok) {
            const sitemapsData = await sitemapsResponse.json();
            if (sitemapsData.sitemap) {
              sitemapEntries = sitemapsData.sitemap.map((sm: any) => ({ 
                path: sm.path || null, 
                lastSubmitted: sm.lastSubmitted ? Timestamp.fromDate(new Date(sm.lastSubmitted)) : null,
                isPending: typeof sm.isPending === 'boolean' ? sm.isPending : null, 
                isSitemapIndex: typeof sm.isSitemapIndex === 'boolean' ? sm.isSitemapIndex : null, 
                type: sm.type || null, 
                lastDownloaded: sm.lastDownloaded ? Timestamp.fromDate(new Date(sm.lastDownloaded)) : null,
                warnings: typeof sm.warnings === 'number' ? sm.warnings : 0, 
                errors: typeof sm.errors === 'number' ? sm.errors : 0 
              }));
            }
          } else {
            console.warn(`Failed to fetch sitemaps for ${site.siteUrl}: ${sitemapsResponse.status} ${sitemapsResponse.statusText}`);
            const errorBody = await sitemapsResponse.text();
            console.warn(`Error body: ${errorBody}`);
          }
        } catch (sitemapError) {
          console.error(`Error fetching or processing sitemaps for ${site.siteUrl}:`, sitemapError);
        }

        batch.set(siteRef, {
          ...site, // siteUrl, permissionLevel
          userId: userId,
          sitemaps: sitemapEntries,
          syncedAt: serverTimestamp(),
          // Note: Storing individual pages and their statuses from these sitemaps
          // is a more complex process involving parsing sitemap XML (if not an index) 
          // and potentially using the URL Inspection API for each page.
          // This would typically be handled by a separate process or background job
          // due to complexity, potential for many API calls, and processing time.
        });
      }
      await batch.commit();
      console.log('Successfully synced GSC sites and their sitemaps to Firestore for user:', userId);

    } catch (error) {
      console.error('Error syncing GSC sites/sitemaps to Firestore:', error);
      // Avoid setting a general context error here as this is a background sync
    }
  };


  const connectSearchConsole = async (): Promise<string | null> => {
    if (!currentUser) {
      setError('User not authenticated');
      throw new Error('User not authenticated');
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      const refreshToken = result.user?.refreshToken; // Capture the refresh token
      let expiryTime: number | null = null;
      if (credential) {
        const idToken = credential.idToken;
        if (idToken) {
          try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        expiryTime = payload.exp ? payload.exp * 1000 : null;
        console.log("Token expires at:", expiryTime ? new Date(expiryTime) : 'No expiry found');
          } catch (e) {
        console.error("Failed to decode JWT:", e);
        expiryTime = null;
          }
        }
      }

      if (accessToken) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          searchConsoleAccessToken: accessToken,
          searchConsoleRefreshToken: refreshToken, // Store the refresh token
          searchConsoleAccessTokenExpiryTime: expiryTime ? Timestamp.fromMillis(expiryTime) : null,
          searchConsoleConnected: true,
          updatedAt: serverTimestamp(),
        });
        
        setUserProfile(prevProfile => {
          if (!prevProfile) {
            // This case should ideally not happen if currentUser exists
            // but as a fallback, create a minimal profile.
             console.warn("User profile was null when updating after GSC connect. This might indicate an issue.");
             return {
                uid: currentUser.uid,
                email: currentUser.email || '',
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                createdAt: Timestamp.now(),
                credits: 0,
                onboardingCompleted: false,
                seoFocus: '',
                searchConsoleConnected: true,
                searchConsoleAccessToken: accessToken,
                searchConsoleRefreshToken: refreshToken, // Add to local profile state
                updatedAt: Timestamp.now(),
             } as User;
          }
          return {
            ...prevProfile,
            searchConsoleAccessToken: accessToken,
            searchConsoleRefreshToken: refreshToken, // Add to local profile state
            searchConsoleConnected: true,
            updatedAt: Timestamp.now(),
          };
        });

        // After successful connection and profile update, sync GSC sites
        if (accessToken) {
          console.log('GSC connected, initiating site and sitemap sync...');
          await syncGscSitesAndSitemapsToFirestore(currentUser.uid, accessToken);
        }
        return accessToken;
      } else {
        setError('Failed to retrieve access token for Search Console.');
        throw new Error('Failed to retrieve access token for Search Console.');
      }
    } catch (err) {
      console.error('Error connecting Search Console:', err);
      setError('Failed to connect Search Console. Please try again.');
      throw err;
    }
  };

  const fetchGoogleSearchConsoleSites = async (tokenOverride?: string): Promise<GSCSite[]> => {
    const tokenToUse = tokenOverride || userProfile?.searchConsoleAccessToken;

    if (!tokenToUse) {
      const noTokenError = 'Search Console not connected or access token unavailable.';
      setError(noTokenError);
      throw new Error(noTokenError);
    }

    try {
      const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: {
          Authorization: `Bearer ${tokenToUse}`,
        },
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        let errorDetails = {};
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
          errorDetails = errorData.error; // Store full error details
        } catch (e) {
          console.warn('Could not parse error response as JSON:', e);
        }
        console.error('Error fetching GSC sites. Status:', response.status, 'Message:', errorMessage, 'Details:', errorDetails);
        // Construct a more informative error message
        const detailedError = `Failed to fetch sites from Google Search Console: ${errorMessage} (Status: ${response.status})`;
        setError(detailedError); 
        throw new Error(detailedError); 
      }

      const data = await response.json();
      return data.siteEntry || [];
    } catch (err) {
      console.error('Catch block in fetchGoogleSearchConsoleSites:', err);
      // If err is already the detailed error from the !response.ok block, rethrow it.
      // Otherwise, if a context error (this.error) hasn't been set or is different, set a generic one.
      if (err instanceof Error) {
        if (!error || error !== err.message) { // If no context error or it's different from current err
            const genericMessage = 'An error occurred while fetching your sites from Google Search Console.';
            setError(genericMessage); // Set context error
        }
        throw err; // Rethrow the original error (could be the detailed one or a new one)
      } else {
        // Handle cases where err is not an Error instance
        const genericMessage = 'An unexpected error occurred while fetching your sites.';
        setError(genericMessage);
        throw new Error(genericMessage);
      }
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      
      // Ensure user document is created after successful sign in
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          const newUser: Partial<User> = {
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            onboardingCompleted: false,
            credits: 100,
            seoFocus: '',
            // makeConnected: false, // Removed as it's not in User type
            searchConsoleConnected: false,
            searchConsoleRefreshToken: result.user.refreshToken, // Store refresh token on initial creation if available
          };
          
          await setDoc(userRef, newUser);
        }
      }
    } catch (err) {
      console.error('Error signing in with Google:', err);
      setError('Failed to sign in with Google');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out');
      throw err;
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    if (!currentUser) {
      console.error("Cannot update profile: no current user.");
      setError("User not authenticated for profile update.");
      throw new Error("User not authenticated");
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Determine the state of the profile after this update for the GSC sync check
      // Use a combination of the previous profile state and the incoming data
      const profileSnapshotForCheck = {
        ...(userProfile || { 
          // Provide defaults if userProfile was null, though less likely if currentUser exists
          uid: currentUser.uid, 
          email: currentUser.email || '', 
          searchConsoleConnected: false, 
          searchConsoleAccessToken: undefined 
        }),
        ...data, // Apply the updates from 'data'
      };
      
      // Update local userProfile state
      setUserProfile(prevProfile => {
        const dataToUpdate = { ...data, updatedAt: Timestamp.now() };

        if (prevProfile) {
          return {
            ...prevProfile,
            ...dataToUpdate,
          };
        } else {
          // This case handles if prevProfile was null.
          // We construct a new User object based on currentUser and data.
          // This ensures all required fields are present.
          return {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
            createdAt: Timestamp.now(), // Default for a new local profile representation
            credits: 0, // Default credits, data might override this if 'credits' is in data
            onboardingCompleted: false, // Default, data will override this
            seoFocus: '', // Default, data will override this
            // makeConnected: false, // Removed
            searchConsoleConnected: false, // Default
            searchConsoleAccessToken: undefined, // Default
            ...dataToUpdate, // Apply the actual updates from 'data' and the new updatedAt
          } as User;
        }
      });

      // Perform GSC sync if onboarding was just completed and GSC is connected with a token
      if (data.onboardingCompleted === true &&
          profileSnapshotForCheck.searchConsoleConnected === true &&
          profileSnapshotForCheck.searchConsoleAccessToken) {
        console.log('Onboarding completed and GSC connected, initiating site and sitemap sync...');
        await syncGscSitesAndSitemapsToFirestore(currentUser.uid, profileSnapshotForCheck.searchConsoleAccessToken);
      }

    } catch (err) {
      console.error('Error updating user profile:', err);
      setError('Failed to update profile');
      throw err; // Re-throw to be caught by caller if necessary
    }
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    error,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    connectSearchConsole,
    fetchGoogleSearchConsoleSites, // Ensure this uses the modified function
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}