import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types/user';

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setLoading(true);
        try {
          if (firebaseUser) {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              setUser(userDoc.data() as User);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch (err) {
          console.error('Error in auth state:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setUser(null);
        } finally {
          setLoading(false);
        }
      },
      setError
    );

    return () => unsubscribe();
  }, []);

  return { user, loading, error };
}