import React, { useState } from 'react';
import Button from '../ui/Button';
import { Search } from 'lucide-react';

const TryItFree: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      alert('This is a demo. In the real application, you would receive a report of unindexed pages.');
    }, 2000);
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-block bg-primary-100 text-primary-800 text-sm font-medium px-3 py-1 rounded-full mb-4">
            Free Indexing Report
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Discover Your Unindexed Pages Now
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Get a free report of your website's unindexed pages. See exactly what content Google is missing and understand the potential traffic you're losing.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="website-url" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your website URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    id="website-url"
                    required
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="block w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Analyzing Your Website...' : 'Get Free Report'}
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary-600">100%</p>
                  <p className="text-gray-600">Free Analysis</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary-600">30 sec</p>
                  <p className="text-gray-600">Quick Scan</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary-600">No Card</p>
                  <p className="text-gray-600">Required</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 text-center mt-6">
            Want automated monitoring and instant reindexing? 
            <a href="#pricing" className="text-primary-600 hover:text-primary-700 font-medium ml-1">
              Check out our plans
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default TryItFree;