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
  amount?: number; // Amount paid in major currency unit (e.g., USD)
  currency?: string; // e.g., "USD"
  paymentId?: string; // Razorpay payment ID
  orderId?: string; // Razorpay order ID
}