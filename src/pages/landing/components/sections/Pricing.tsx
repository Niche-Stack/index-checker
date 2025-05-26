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
    <section 
      id="pricing"
      ref={pricingRef}
      className="py-16 md:py-24 bg-gray-50 duration-1000"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            No hidden fees or complex tiers. Choose the plan that works for your business.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`bg-white rounded-xl shadow-lg overflow-hidden transition-transform hover:-translate-y-1 duration-300 ${
                plan.recommended ? 'ring-2 ring-primary-500 relative' : ''
              }`}
            >
              {plan.recommended && (
                <div className="absolute top-0 right-0">
                  <div className="bg-primary-500 text-white text-xs font-bold px-3 py-1 transform rotate-45 translate-x-6 -translate-y-1">
                    BEST VALUE
                  </div>
                </div>
              )}
              
              <div className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{plan.name}</h3>
                <p className="text-gray-600 mb-6">{plan.description}</p>
                
                <div className="mb-6">
                  <div className="flex items-end">
                    <span className="text-4xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-gray-500 ml-2 pb-1">
                      /{plan.name.toLowerCase() === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  {plan.recommended && (
                    <p className="text-green-600 text-sm font-medium mt-1">Includes 2 months free</p>
                  )}
                </div>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex">
                      <Check size={20} className="text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  variant="primary" 
                  size="lg" 
                  className="w-full"
                  data-plan={plan.name.toLowerCase()}
                >
                  {plan.buttonText}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-white rounded-xl shadow-md p-8 max-w-4xl mx-auto">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Enterprise Solutions</h3>
          <p className="text-gray-600 mb-6">
            Need a custom solution for your large website or multiple domains? Our enterprise plan offers dedicated support, custom features, and volume discounts.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div className="mb-4 sm:mb-0">
              <p className="text-gray-700 font-medium">Contact our sales team for a custom quote</p>
            </div>
            <Button variant="outline" size="md">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;