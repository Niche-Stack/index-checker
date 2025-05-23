import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithPopup,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
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
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { 
        ...data, 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      
      // Update local state
      if (userProfile) {
        setUserProfile({ 
          ...userProfile, 
          ...data,
          updatedAt: Timestamp.now()
        });
      }
    } catch (err) {
      console.error('Error updating user profile:', err);
      setError('Failed to update profile');
      throw err;
    }
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    error,
    signInWithGoogle,
    signOut,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}