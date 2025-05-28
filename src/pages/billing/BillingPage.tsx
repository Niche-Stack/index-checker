declare global {
  interface Window {
    Razorpay: any;
  }
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CreditCard, 
  RefreshCw, 
  Download, 
  CheckCircle, 
  ChevronRight,
  Info,
  PlusCircle,
  AlertTriangle
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCredits } from '../../contexts/CreditContext';
import { CreditPackage, CreditTransaction } from '../../types/credits';
import CreditPackageCard from './components/CreditPackageCard';
import TransactionHistoryTable from './components/TransactionHistoryTable';
import PaymentMethodCard from './components/PaymentMethodCard';

const BillingPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { credits, getCreditPackages } = useCredits();
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [purchaseError, setPurchaseError] = useState(''); // Add state for purchase errors

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch credit packages
        const packages = await getCreditPackages();
        setCreditPackages(packages);
        
        // Fetch transaction history
        const transactionsQuery = query(
          collection(db, 'creditTransactions'),
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        const transactionsData = transactionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CreditTransaction[];
        
        setTransactions(transactionsData);
      } catch (err) {
        console.error('Error fetching billing data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser, getCreditPackages]);

  const handlePurchase = async () => {
    if (!selectedPackage || !currentUser) {
      setPurchaseError("Please select a package.");
      return;
    }
    
    const pkgDetails = creditPackages.find(p => p.id === selectedPackage);
    if (!pkgDetails) {
      setPurchaseError("Selected package details not found.");
      return;
    }

    setPurchaseLoading(true);
    setPurchaseError('');
    setSuccessMessage('');

    try {
      // 1. Create Razorpay Order via Firebase Function
      const createOrderFunction = httpsCallable(functions, 'create_razorpay_order');
      const orderPayload = {
        amount: pkgDetails.price * quantity, // Price in USD
        currency: 'USD',
        packageId: pkgDetails.id,
        packageName: pkgDetails.name,
      };
      
      const orderResult = await createOrderFunction(orderPayload);
      const orderData = orderResult.data as any; // Cast to expected type

      if (!orderData.success || !orderData.orderId) {
        throw new Error(orderData.message || 'Failed to create Razorpay order.');
      }

      // 2. Initialize Razorpay Checkout
      const options = {
        key: orderData.razorpayKeyId, // Your Razorpay Key ID
        amount: orderData.amount, // Amount in the smallest currency unit (e.g., paise/cents)
        currency: orderData.currency,
        name: 'Index Checker', // Your App Name
        description: `Purchase ${pkgDetails.name}`,
        order_id: orderData.orderId, // From Firebase function
        handler: async (response: any) => {
          // 3. Verify Payment via Firebase Function
          try {
            const verifyPaymentFunction = httpsCallable(functions, 'verify_razorpay_payment');
            const verificationPayload = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              packageId: pkgDetails.id,
              creditsToAdd: pkgDetails.credits * quantity,
              amountPaid: pkgDetails.price * quantity, // Amount in USD
            };
            
            const verificationResult = await verifyPaymentFunction(verificationPayload);
            const verificationData = verificationResult.data as any;

            if (verificationData.success) {
              setSuccessMessage('Credits purchased successfully! Your balance will update shortly.');
              // Optionally, re-fetch transactions or user credits here to get the latest data
              // For optimistic UI update (current approach):
              const newTransaction: CreditTransaction = {
                id: response.razorpay_payment_id, // Use actual payment ID
                userId: currentUser!.uid,
                packageId: selectedPackage,
                credits: pkgDetails.credits * quantity,
                amount: pkgDetails.price * quantity,
                currency: 'USD',
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                timestamp: Timestamp.now(), // Or server timestamp from verification if available
                type: 'purchase',
                reason: `Purchased ${pkgDetails.name}`
              };
              setTransactions(prev => [newTransaction, ...prev.filter(t => !t.id.startsWith('temp-'))]);
              // Consider calling a function from useCredits to refresh credits balance
              // e.g., refreshCredits(); 

              setSelectedPackage('');
              setQuantity(1);
            } else {
              setPurchaseError(verificationData.message || 'Payment verification failed.');
            }
          } catch (verifyError: any) {
            console.error('Error verifying payment:', verifyError);
            setPurchaseError(verifyError.message || 'An error occurred during payment verification.');
          } finally {
            setPurchaseLoading(false);
          }
        },
        prefill: {
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          // contact: currentUser.phoneNumber || '' // If available
        },
        notes: {
          userId: currentUser.uid,
          packageId: pkgDetails.id,
        },
        theme: {
          color: '#3B82F6' // Example: Blue-500 from Tailwind
        },
        modal: {
          ondismiss: () => {
            setPurchaseLoading(false);
            setPurchaseError('Payment was cancelled.');
          }
        }
      };
      
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        console.error('Razorpay payment failed:', response.error);
        setPurchaseError(`Payment Failed: ${response.error.description} (Reason: ${response.error.reason})`);
        setPurchaseLoading(false);
      });
      rzp.open();
      // setPurchaseLoading(false) is handled by Razorpay's handler or ondismiss

    } catch (err: any) {
      console.error('Error purchasing credits:', err);
      setPurchaseError(err.message || 'An error occurred during the purchase process.');
      setPurchaseLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Billing & Credits</h1>
          <p className="text-slate-500">Manage your credit balance and billing information</p>
        </div>
        
        <div className="mt-4 md:mt-0 bg-slate-100 rounded-full px-4 py-2 flex items-center">
          <CreditCard className="w-5 h-5 text-blue-800 mr-2" />
          <span className="font-medium text-slate-800">{credits} credits available</span>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-100 text-green-800 rounded-lg p-4 mb-6 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
          {successMessage}
        </div>
      )}

      {purchaseError && (
        <div className="bg-red-50 border border-red-100 text-red-800 rounded-lg p-4 mb-6 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
          {purchaseError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Purchase Credits */}
          <div className="card">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Purchase Credits</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-6">
                Choose a credit package below. Credits are used for checking indexing status (1 credit per page) 
                and requesting indexing (5 credits per page).
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {creditPackages.map(pkg => (
                  <CreditPackageCard
                    key={pkg.id}
                    package={pkg}
                    isSelected={selectedPackage === pkg.id}
                    onSelect={() => setSelectedPackage(pkg.id)}
                  />
                ))}
              </div>
              
              {selectedPackage && (
                <div className="bg-slate-50 p-4 rounded-lg mb-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="mb-4 md:mb-0">
                      <h3 className="font-medium text-slate-800 mb-1">Purchase Details</h3>
                      <p className="text-sm text-slate-600">
                        {creditPackages.find(p => p.id === selectedPackage)?.name} Package
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div>
                        <label htmlFor="quantity" className="block text-sm text-slate-600 mb-1">
                          Quantity
                        </label>
                        <select
                          id="quantity"
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value))}
                          className="input"
                        >
                          {[1, 2, 3, 4, 5].map(q => (
                            <option key={q} value={q}>{q}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <p className="text-sm text-slate-600 mb-1">Price</p>
                        <p className="font-bold text-slate-900">
                          ${(creditPackages.find(p => p.id === selectedPackage)?.price || 0) * quantity}
                        </p>
                      </div>
                      
                      <button
                        onClick={handlePurchase}
                        disabled={purchaseLoading}
                        className="btn-primary h-10"
                      >
                        {purchaseLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Buy Now
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-blue-800 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-800 mb-1">Volume Discounts Available</h3>
                    <p className="text-sm text-blue-700">
                      For custom packages or volume discounts on larger credit purchases, please 
                      <a href="mailto:support@indexchecker.ai" className="font-medium underline ml-1">contact our team</a>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Transaction History */}
          <div className="card">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Transaction History</h2>
              <button className="text-sm text-blue-800 hover:text-blue-900 flex items-center">
                <Download className="w-4 h-4 mr-1" />
                Export
              </button>
            </div>
            <TransactionHistoryTable 
              transactions={transactions}
              loading={loading}
              creditPackages={creditPackages}
            />
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-8">
          {/* Credit Usage Summary */}
          <div className="card">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Credit Usage</h2>
            </div>
            <div className="p-6">
              {/* <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Available Credits</span>
                  <span className="font-semibold text-slate-900">{credits}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-800 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div> */}
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                    <CheckCircle className="w-4 h-4 text-blue-800" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-800">Checking Pages</h4>
                    <p className="text-sm text-slate-600">1 credit per page checked</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                    <RefreshCw className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-800">Requesting Indexing</h4>
                    <p className="text-sm text-slate-600">5 credits per indexing request</p>
                  </div>
                </div>
              </div>
              
              {credits < 50 && (
                <div className="mt-6 p-3 bg-amber-50 text-amber-800 rounded-lg flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-amber-600" />
                  <span className="text-sm">Your credit balance is running low</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Payment Methods */}
          {/* <div className="card">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Payment Methods</h2>
            </div>
            <div className="p-6">
              <PaymentMethodCard
                type="visa"
                last4="4242"
                expiry="12/25"
                isDefault={true}
              />
              
              <button className="mt-4 w-full btn-secondary flex items-center justify-center">
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Payment Method
              </button>
            </div>
          </div> */}
          
          {/* Billing FAQ */}
          <div className="card">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Billing FAQ</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-slate-800 mb-1">Do credits expire?</h4>
                  <p className="text-sm text-slate-600">No, your purchased credits never expire.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-slate-800 mb-1">Can I get a refund?</h4>
                  <p className="text-sm text-slate-600">Unused credits can be refunded within 30 days of purchase.</p>
                </div>
                
                <div>
                  <h4 className="font-medium text-slate-800 mb-1">Are there any hidden fees?</h4>
                  <p className="text-sm text-slate-600">No, you only pay for the credits you purchase.</p>
                </div>
              </div>
              
              <div className="mt-6">
                <Link to="/settings" className="text-blue-800 text-sm flex items-center hover:text-blue-900">
                  More billing questions
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;