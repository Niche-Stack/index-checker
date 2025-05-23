import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, increment, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { CreditPackage } from '../types/credits';

interface CreditContextType {
  credits: number;
  loading: boolean;
  error: string | null;
  purchaseCredits: (packageId: string, quantity: number) => Promise<boolean>;
  useCredits: (amount: number, reason: string) => Promise<boolean>;
  getCreditPackages: () => Promise<CreditPackage[]>;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export function useCredits() {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
}

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile } = useAuth();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setCredits(userProfile.credits);
      setLoading(false);
    } else {
      setCredits(0);
    }
  }, [userProfile]);

  const getCreditPackages = async (): Promise<CreditPackage[]> => {
    // In a real app, these would come from Firestore
    return [
      {
        id: 'basic',
        name: 'Basic',
        credits: 1000,
        price: 10,
        description: 'Best for small sites and blogs'
      },
      {
        id: 'pro',
        name: 'Professional',
        credits: 5000,
        price: 37.5, // Discounted rate ($0.0075 per credit)
        description: 'Perfect for growing businesses'
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        credits: 20000,
        price: 100, // Discounted rate ($0.005 per credit)
        description: 'For large sites with extensive SEO needs'
      }
    ];
  };

  const purchaseCredits = async (packageId: string, quantity: number): Promise<boolean> => {
    if (!currentUser) return false;
    
    setLoading(true);
    setError(null);
    
    try {
      const packages = await getCreditPackages();
      const selectedPackage = packages.find(p => p.id === packageId);
      
      if (!selectedPackage) {
        setError('Invalid package selected');
        return false;
      }
      
      const creditsToAdd = selectedPackage.credits * quantity;
      
      // Update user's credits in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        credits: increment(creditsToAdd)
      });
      
      // Record the transaction
      await addDoc(collection(db, 'creditTransactions'), {
        userId: currentUser.uid,
        packageId,
        credits: creditsToAdd,
        amount: selectedPackage.price * quantity,
        timestamp: Timestamp.now(),
        type: 'purchase'
      });
      
      // Update local state
      setCredits(prev => prev + creditsToAdd);
      
      return true;
    } catch (err) {
      console.error('Error purchasing credits:', err);
      setError('Failed to purchase credits');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const useCredits = async (amount: number, reason: string): Promise<boolean> => {
    if (!currentUser) return false;
    
    if (credits < amount) {
      setError('Insufficient credits');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Update user's credits in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        credits: increment(-amount)
      });
      
      // Record the transaction
      await addDoc(collection(db, 'creditTransactions'), {
        userId: currentUser.uid,
        credits: -amount,
        reason,
        timestamp: Timestamp.now(),
        type: 'usage'
      });
      
      // Update local state
      setCredits(prev => prev - amount);
      
      return true;
    } catch (err) {
      console.error('Error using credits:', err);
      setError('Failed to use credits');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    credits,
    loading,
    error,
    purchaseCredits,
    useCredits,
    getCreditPackages
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}