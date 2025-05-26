import React, { useEffect, useRef } from 'react';
import { Search, Bell, BarChart, Zap, RefreshCw, Award } from 'lucide-react';

const Features: React.FC = () => {
  const featuresRef = useRef<HTMLDivElement>(null);
  
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
    
    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }
    
    return () => {
      if (featuresRef.current) {
        observer.unobserve(featuresRef.current);
      }
    };
  }, []);

  const features = [
    {
      icon: <Search className="text-primary-600" size={24} />,
      title: "Deep Indexing Scan",
      description: "Crawls your entire website and cross-references with Google's index to identify every unindexed page."
    },
    {
      icon: <Bell className="text-primary-600" size={24} />,
      title: "Real-time Alerts",
      description: "Get instant notifications when pages drop out of Google's index so you can take immediate action."
    },
    {
      icon: <BarChart className="text-primary-600" size={24} />,
      title: "Performance Analytics",
      description: "Track your indexing rate over time and measure the impact on your organic traffic and conversions."
    },
    {
      icon: <Zap className="text-primary-600" size={24} />,
      title: "Automatic Re-submission",
      description: "One-click submission of unindexed URLs directly to Google for faster re-indexing."
    },
    {
      icon: <RefreshCw className="text-primary-600" size={24} />,
      title: "Weekly Monitoring",
      description: "Continuous monitoring ensures no page stays unindexed for long, maintaining consistent visibility."
    },
    {
      icon: <Award className="text-primary-600" size={24} />,
      title: "SEO Recommendations",
      description: "Get actionable advice on how to improve indexability for problematic pages."
    }
  ];

  return (
    <section 
      id="features"
      ref={featuresRef}
      className="py-16 md:py-24 duration-1000"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            How Index Checker AI Recovers Your Lost Traffic
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Our AI-powered tools find and fix indexing issues before they impact your traffic,
            ensuring your SEO investment delivers maximum returns.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;