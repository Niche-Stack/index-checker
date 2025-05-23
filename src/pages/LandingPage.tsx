import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Check, Bell, Zap, Lock, ChevronRight } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-800 text-white p-2 rounded-md">
              <Search className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-blue-900">Index Checker</span>
          </div>
          <div className="flex space-x-4 items-center">
            <Link to="/login" className="text-slate-700 hover:text-blue-800 text-sm font-medium">
              Sign in
            </Link>
            <Link to="/login" className="btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-32 flex flex-col lg:flex-row items-center">
        <div className="lg:w-1/2 lg:pr-12 mb-12 lg:mb-0">
          <h1 className="text-4xl font-bold text-slate-900 mb-6 tracking-tight lg:text-5xl leading-tight">
            Never let your important pages get unindexed again
          </h1>
          <p className="text-lg text-slate-600 mb-8 leading-relaxed">
            Index Checker automatically monitors your web pages, detects when they fall out of search engine indexes, and gets them back in — all without lifting a finger.
          </p>
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <Link to="/login" className="btn-primary py-3 px-6 text-center text-base">
              Start for free
            </Link>
            <a href="#how-it-works" className="btn-secondary py-3 px-6 text-center text-base">
              Learn more
            </a>
          </div>
          <div className="mt-6 flex items-center space-x-2 text-sm text-slate-500">
            <Check className="w-4 h-4 text-green-600" />
            <span>Free 100 credits upon signup</span>
          </div>
        </div>
        <div className="lg:w-1/2 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
          <img 
            src="https://images.pexels.com/photos/7858743/pexels-photo-7858743.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
            alt="Dashboard preview" 
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* Features Section */}
      <section id="how-it-works" className="bg-white py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">How Index Checker Works</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Our powerful system continuously monitors your pages and takes action to keep them visible in search results.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-blue-800" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900">Automatic Monitoring</h3>
              <p className="text-slate-600">
                Our system regularly checks if your pages are still indexed in search engines, without you having to do anything.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Bell className="w-6 h-6 text-blue-800" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900">Unindexed Alerts</h3>
              <p className="text-slate-600">
                Get notified immediately when any of your critical pages drop out of the search index so you can take action.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-800" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900">Automatic Reindexing</h3>
              <p className="text-slate-600">
                We automatically submit your unindexed pages back to search engines, saving you time and ensuring visibility.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
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

      {/* CTA Section */}
      <section className="bg-blue-900 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to stay indexed?</h2>
          <p className="text-blue-100 max-w-2xl mx-auto mb-8 text-lg">
            Join thousands of companies that trust Index Checker to maintain their search visibility.
          </p>
          <Link to="/login" className="inline-flex items-center bg-white text-blue-900 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors">
            Get started for free
            <ChevronRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between mb-8">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-blue-800 text-white p-2 rounded-md">
                  <Search className="w-5 h-5" />
                </div>
                <span className="font-bold text-xl text-white">Index Checker</span>
              </div>
              <p className="text-slate-400 max-w-xs">
                Helping businesses stay visible in search results with automated indexing solutions.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-medium text-white mb-4">Product</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-white mb-4">Resources</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Guides</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">API Status</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-white mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p>© {new Date().getFullYear()} Index Checker. All rights reserved.</p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors flex items-center">
                <Lock className="w-4 h-4 mr-1" />
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;