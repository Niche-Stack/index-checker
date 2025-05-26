import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import Button from '../ui/Button';

const Pricing: React.FC = () => {
  const pricingRef = useRef<HTMLDivElement>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    
    if (pricingRef.current) {
      observer.observe(pricingRef.current);
    }
    
    return () => {
      if (pricingRef.current) {
        observer.unobserve(pricingRef.current);
      }
    };
  }, []);

  const plans = [
    {
      name: "Monthly",
      price: 50,
      description: "Perfect for websites that need ongoing indexing protection.",
      features: [
        "Unlimited pages monitored",
        "Weekly indexing checks",
        "Real-time alerts",
        "Automatic re-submission",
        "Basic analytics dashboard",
        "Email support"
      ],
      recommended: false,
      buttonText: "Get Started"
    },
    {
      name: "Annual",
      price: 500,
      description: "Our most popular plan with 16% savings and priority features.",
      features: [
        "Everything in Monthly",
        "Daily indexing checks",
        "Priority re-indexing",
        "Advanced analytics dashboard",
        "SEO recommendations",
        "Priority support",
        "2 months free"
      ],
      recommended: true,
      buttonText: "Get Started"
    }
  ];

  return (
    <section className="py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Only pay for what you use with our credit-based system. No monthly fees or hidden costs.
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-8 border-b border-slate-100">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Credit-Based System</h3>
            <p className="text-slate-600 mb-6">Purchase credits and use them only when you need to check or index pages.</p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-5 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-slate-800">Index checking</h4>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">1 credit</span>
                </div>
                <p className="text-slate-600 text-sm">Per page checked for indexing status</p>
              </div>
              
              <div className="bg-slate-50 p-5 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-slate-800">Reindexing request</h4>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">5 credits</span>
                </div>
                <p className="text-slate-600 text-sm">Per page submitted for indexing</p>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            <h4 className="font-semibold text-slate-900 mb-4">Credit Packages</h4>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 border border-slate-200 rounded-lg">
                <div>
                  <h5 className="font-medium text-slate-800">Starter</h5>
                  <p className="text-slate-500 text-sm">1,000 credits</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">$10.00</p>
                  <p className="text-xs text-slate-500">$0.01 per credit</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-4 border border-slate-200 rounded-lg">
                <div>
                  <h5 className="font-medium text-slate-800">Pro</h5>
                  <p className="text-slate-500 text-sm">5,000 credits</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">$37.50</p>
                  <p className="text-xs text-slate-500">$0.0075 per credit</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-4 border border-slate-200 rounded-lg">
                <div>
                  <h5 className="font-medium text-slate-800">Enterprise</h5>
                  <p className="text-slate-500 text-sm">20,000 credits</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">$100.00</p>
                  <p className="text-xs text-slate-500">$0.005 per credit</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 bg-blue-50 p-4 rounded-lg flex items-start">
              <div className="shrink-0 mt-1">
                <Check className="w-5 h-5 text-blue-800" />
              </div>
              <p className="ml-3 text-sm text-blue-800">
                <strong>Free 100 credits</strong> for all new accounts so you can try the service risk-free.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;