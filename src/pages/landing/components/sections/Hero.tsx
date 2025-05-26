import React, { useEffect, useRef } from 'react';
import Button from '../ui/Button';

const Hero: React.FC = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  
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
    
    if (heroRef.current) {
      observer.observe(heroRef.current);
    }
    
    return () => {
      if (heroRef.current) {
        observer.unobserve(heroRef.current);
      }
    };
  }, []);

  return (
    <section 
      ref={heroRef}
      className="pt-28 pb-20 md:pt-32 md:pb-24"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-10 md:mb-0">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 
            !leading-[5rem] mb-6">
              Never Lose Organic Traffic Due To <span className="text-primary-600 relative">
                Unindexed Pages
                <span className="absolute bottom-1 left-0 w-full h-2 bg-accent-200 -z-10"></span>
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Index Checker AI finds and fixes pages that Google missed, recovering lost traffic and maximizing your SEO investment.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button variant="primary" size="lg">
                Start Free Trial
              </Button>
              <Button variant="outline" size="lg">
                See Demo
              </Button>
            </div>
            <div className="mt-8 flex items-center text-sm text-gray-500">
              <span className="bg-green-100 text-green-800 font-medium px-2.5 py-0.5 rounded text-xs">NEW</span>
              <span className="ml-2">Now with real-time alerts and automated re-submission</span>
            </div>
          </div>
          <div className="md:w-1/2 md:pl-12">
            <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-accent-400 to-secondary-500"></div>
              <img 
                src="https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1" 
                alt="Index Checker AI dashboard showing unindexed pages" 
                className="w-full h-auto rounded-b-xl"
              />
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-full px-4 py-2 w-3/4 flex justify-center">
                <span className="text-primary-600 font-semibold text-sm">Average recovery: 27% increase in indexed pages</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;