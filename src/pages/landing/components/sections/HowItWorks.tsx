import React, { useEffect, useRef } from 'react';

const HowItWorks: React.FC = () => {
  const howItWorksRef = useRef<HTMLDivElement>(null);
  
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
    
    if (howItWorksRef.current) {
      observer.observe(howItWorksRef.current);
    }
    
    return () => {
      if (howItWorksRef.current) {
        observer.unobserve(howItWorksRef.current);
      }
    };
  }, []);

  const steps = [
    {
      number: "01",
      title: "Connect Your Website",
      description: "Simply add your website URL and connect your Google Search Console to get started. No code or complex setup required."
    },
    {
      number: "02",
      title: "Initial Scan",
      description: "Our AI crawls your entire website and cross-references with Google's index to identify unindexed pages and content gaps."
    },
    {
      number: "03",
      title: "Monitor & Alert",
      description: "Index Checker AI continuously monitors your website for changes and alerts you when pages drop out of the index."
    },
    {
      number: "04",
      title: "Fix & Resubmit",
      description: "With one click, submit unindexed URLs directly to Google for faster re-indexing, plus get recommendations to improve indexability."
    }
  ];

  return (
    <section 
      id="how-it-works"
      ref={howItWorksRef}
      className="py-16 md:py-24 bg-gray-50 duration-1000"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Simple 4-Step Process
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Fixing your indexing issues has never been easier. Our streamlined process gets you from setup to results in minutes.
          </p>
        </div>

        <div className="relative">
          {/* Connection line */}
          {/* <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 z-0"></div> */}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-xl font-bold mb-6 shadow-lg">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">{step.title}</h3>
                <p className="text-gray-600 text-center">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 md:mt-24 bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="p-1 bg-gradient-to-r from-primary-500 via-accent-400 to-secondary-500"></div>
          <div className="p-8">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-8 md:mb-0 md:pr-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">See It In Action</h3>
                <p className="text-gray-600 mb-6">
                  Watch how Index Checker AI finds and fixes unindexed pages in real-time, 
                  helping you recover lost traffic and maximize your SEO investment.
                </p>
                <button className="flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg transition-colors">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Watch Demo Video
                </button>
              </div>
              <div className="md:w-1/2">
                <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                  <img 
                    src="https://images.pexels.com/photos/265087/pexels-photo-265087.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1" 
                    alt="Demo video thumbnail" 
                    className="w-full h-full object-cover opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;