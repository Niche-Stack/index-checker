import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider, // Import GoogleAuthProvider to access credentialFromResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'; // Import updateDoc
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
  connectSearchConsole: () => Promise<string | null>; // New method
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
            setUserProfile(userDoc.data() as User);
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
              makeConnected: false,
              searchConsoleConnected: false,
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

  const connectSearchConsole = async (): Promise<string | null> => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    try {
      const result = await signInWithPopup(auth, googleProvider); // Re-authenticate with Google to get Search Console scope
      const credential = GoogleAuthProvider.credentialFromResult(result); // Correct way to get credential
      const accessToken = credential?.accessToken; // Correct way to get access token

      if (accessToken) {
        // Store the access token securely, e.g., in Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          searchConsoleAccessToken: accessToken,
          searchConsoleConnected: true, // Update connection status
          updatedAt: serverTimestamp(),
        });
        // Update local user profile state
        if (userProfile) {
          setUserProfile({
            ...userProfile,
            searchConsoleAccessToken: accessToken,
            searchConsoleConnected: true,
            updatedAt: Timestamp.now(),
          });
        }
        return accessToken;
      } else {
        throw new Error('Failed to retrieve access token for Search Console.');
      }
    } catch (err) {
      console.error('Error connecting Search Console:', err);
      setError('Failed to connect Search Console. Please try again.');
      throw err;
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
            makeConnected: false,
            searchConsoleConnected: false,
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

      // Update local userProfile state more robustly
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
            makeConnected: false, // Default
            searchConsoleConnected: false, // Default
            searchConsoleAccessToken: undefined, // Default
            ...dataToUpdate, // Apply the actual updates from 'data' and the new updatedAt
          } as User;
        }
      });

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
    connectSearchConsole, // Add to context value
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}