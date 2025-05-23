export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  credits: number;
  timestamp: any; // Firestore timestamp
  type: 'purchase' | 'usage';
  reason?: string;
  packageId?: string;
  amount?: number;
}