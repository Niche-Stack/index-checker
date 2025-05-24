import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; // Import onSnapshot, removed getDoc and DocumentData
import { auth, db } from '../config/firebase';
import { User } from '../types/user';

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Listener for Firebase Auth state changes
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          // User is signed in, now listen for Firestore document changes
          setLoading(true);
          const userDocRef = doc(db, 'users', firebaseUser.uid);

          // Listener for user document changes in Firestore
          const unsubscribeFirestore = onSnapshot(
            userDocRef,
            (docSnap) => {
              if (docSnap.exists()) {
                setUser(docSnap.data() as User);
              } else {
                // This case might happen if the user document is deleted
                // or was never created properly after sign-up.
                console.warn(`User document not found for UID: ${firebaseUser.uid}`);
                setUser(null);
              }
              setLoading(false);
            },
            (firestoreError) => {
              console.error('Error listening to user document:', firestoreError);
              setError(firestoreError);
              setUser(null);
              setLoading(false);
            }
          );

          // Return cleanup function for Firestore listener
          return () => {
            unsubscribeFirestore();
            // When auth state changes to logged out, or component unmounts while logged in,
            // we also want to reset user state if not already handled by outer logic.
            // However, the primary reset for logout is handled by the 'else' block below.
          };
        } else {
          // User is signed out
          setUser(null);
          setLoading(false);
        }
      },
      (authError) => {
        console.error('Error in auth state listener:', authError);
        setError(authError);
        setUser(null);
        setLoading(false);
      }
    );

    // Return cleanup function for Auth listener
    return () => {
      unsubscribeAuth();
      // Note: The Firestore listener's cleanup is handled within the auth listener's scope.
    };
  }, []);

  return { user, loading, error };
}