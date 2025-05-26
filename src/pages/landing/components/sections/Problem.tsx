import React, { useEffect, useRef } from 'react';
import { AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';

const Problem: React.FC = () => {
  const problemRef = useRef<HTMLDivElement>(null);
  
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
    
    if (problemRef.current) {
      observer.observe(problemRef.current);
    }
    
    return () => {
      if (problemRef.current) {
        observer.unobserve(problemRef.current);
      }
    };
  }, []);

  return (
    <section
      ref={problemRef}
      className="py-16 md:py-24 bg-gray-50 duration-1000"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            The Hidden Problem Costing You Traffic
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Even with the best SEO strategy, up to 30% of your pages go unindexed by Google, 
            creating invisible holes in your website that leak traffic and revenue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow transform hover:-translate-y-1 duration-300">
            <div className="w-12 h-12 bg-error-100 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={24} className="text-error-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Unindexed Pages</h3>
            <p className="text-gray-600">
              Whenever your site gets updated or new pages are added, Google can miss them, 
              leaving valuable content invisible to search engines.
            </p>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Average impact</span>
                <span className="text-sm font-semibold text-error-600">15-30% of pages</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow transform hover:-translate-y-1 duration-300">
            <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center mb-6">
              <TrendingDown size={24} className="text-warning-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Lost Traffic</h3>
            <p className="text-gray-600">
              When high-ranking pages fall out of the index, you instantly lose 
              the organic traffic they were generating for your business.
            </p>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Average impact</span>
                <span className="text-sm font-semibold text-warning-600">12-25% traffic drop</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow transform hover:-translate-y-1 duration-300">
            <div className="w-12 h-12 bg-error-100 rounded-full flex items-center justify-center mb-6">
              <DollarSign size={24} className="text-error-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Wasted SEO Budget</h3>
            <p className="text-gray-600">
              Investing in content and SEO only to have pages disappear from search results 
              means you're not getting the full ROI from your marketing spend.
            </p>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Average impact</span>
                <span className="text-sm font-semibold text-error-600">$10K+ per month</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Problem;