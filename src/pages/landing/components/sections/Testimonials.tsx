import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

const Testimonials: React.FC = () => {
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
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
    
    if (testimonialsRef.current) {
      observer.observe(testimonialsRef.current);
    }
    
    return () => {
      if (testimonialsRef.current) {
        observer.unobserve(testimonialsRef.current);
      }
    };
  }, []);

  const testimonials = [
    {
      quote: "Index Checker AI found 47 unindexed pages on our e-commerce site, including product pages that were driving sales. After resubmitting them, we saw a 23% increase in organic traffic within 3 weeks!",
      author: "Sarah Johnson",
      position: "SEO Manager",
      company: "TechGear Inc.",
      avatar: "https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
      stars: 5
    },
    {
      quote: "As a content marketer, it was frustrating to see our blog posts disappear from Google's index. Index Checker AI alerts us immediately when this happens, saving us thousands in potential lost conversions.",
      author: "Michael Chen",
      position: "Content Director",
      company: "Growth Metrics",
      avatar: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
      stars: 5
    },
    {
      quote: "Our agency manages SEO for over 30 client websites. Index Checker AI has become an essential tool in our workflow, helping us maintain high indexing rates and impress clients with proactive solutions.",
      author: "Emily Rodriguez",
      position: "Agency Owner",
      company: "Digital Boost Agency",
      avatar: "https://images.pexels.com/photos/3757942/pexels-photo-3757942.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
      stars: 4
    }
  ];

  const nextTestimonial = () => {
    setActiveIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  const prevTestimonial = () => {
    setActiveIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  return (
    <section 
      ref={testimonialsRef}
      className="py-16 md:py-24 duration-1000"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Trusted by SEO Professionals
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            See how Index Checker AI is helping businesses recover lost traffic and maximize their SEO investment.
          </p>
        </div>

        <div className="max-w-4xl mx-auto relative">
          <div className="bg-white rounded-xl shadow-xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/3 flex justify-center mb-6 md:mb-0">
                <div className="relative">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-primary-100">
                    <img 
                      src={testimonials[activeIndex].avatar} 
                      alt={testimonials[activeIndex].author}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-3 -right-3 bg-primary-600 text-white p-2 rounded-full">
                    <Star size={16} fill="white" />
                  </div>
                </div>
              </div>
              <div className="md:w-2/3 md:pl-8">
                <div className="mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      size={20} 
                      className={i < testimonials[activeIndex].stars ? "text-yellow-500 inline-block" : "text-gray-300 inline-block"} 
                      fill={i < testimonials[activeIndex].stars ? "#F59E0B" : "#D1D5DB"} 
                    />
                  ))}
                </div>
                <blockquote className="text-lg md:text-xl text-gray-700 italic mb-6">
                  "{testimonials[activeIndex].quote}"
                </blockquote>
                <div>
                  <p className="font-bold text-gray-900">{testimonials[activeIndex].author}</p>
                  <p className="text-gray-600">
                    {testimonials[activeIndex].position}, {testimonials[activeIndex].company}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === activeIndex ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
          
          <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2">
            <button
              onClick={prevTestimonial}
              className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-700 hover:text-primary-600 transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          
          <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2">
            <button
              onClick={nextTestimonial}
              className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-700 hover:text-primary-600 transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-primary-600">98%</p>
            <p className="text-gray-600">Accuracy Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-primary-600">3.2M+</p>
            <p className="text-gray-600">Pages Monitored</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-primary-600">23%</p>
            <p className="text-gray-600">Avg. Traffic Increase</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-primary-600">500+</p>
            <p className="text-gray-600">Active Customers</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;