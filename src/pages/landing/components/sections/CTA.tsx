import React, { useEffect, useRef } from 'react';
import Button from '../ui/Button';

const CTA: React.FC = () => {
  const ctaRef = useRef<HTMLDivElement>(null);
  
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
    
    if (ctaRef.current) {
      observer.observe(ctaRef.current);
    }
    
    return () => {
      if (ctaRef.current) {
        observer.unobserve(ctaRef.current);
      }
    };
  }, []);

  return (
    <section 
      ref={ctaRef}
      className="py-16 md:py-24 bg-primary-600 duration-1000"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="p-1 bg-gradient-to-r from-primary-500 via-accent-400 to-secondary-500"></div>
          <div className="p-8 md:p-12">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Start Recovering Your Lost Traffic Today
              </h2>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Don't let unindexed pages cost you traffic and revenue. Join 500+ businesses using Index Checker AI to maximize their SEO investment.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                <Button variant="primary" size="lg">
                  Start Your Free Trial
                </Button>
                <Button variant="outline" size="lg">
                  Schedule a Demo
                </Button>
              </div>
              
              <p className="mt-6 text-sm text-gray-500">
                No credit card required. 14-day free trial. Cancel anytime.
              </p>
            </div>
            
            <div className="mt-12 pt-12 border-t border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary-600">14-Day</p>
                  <p className="text-gray-600">Free Trial</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary-600">5-Minute</p>
                  <p className="text-gray-600">Setup</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary-600">24/7</p>
                  <p className="text-gray-600">Support</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary-600">100%</p>
                  <p className="text-gray-600">Satisfaction</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;