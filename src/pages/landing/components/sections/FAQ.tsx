import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ: React.FC = () => {
  const faqRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  
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
    
    if (faqRef.current) {
      observer.observe(faqRef.current);
    }
    
    return () => {
      if (faqRef.current) {
        observer.unobserve(faqRef.current);
      }
    };
  }, []);

  const faqItems: FAQItem[] = [
    {
      question: "How does Index Checker AI work?",
      answer: "Index Checker AI connects to your website and Google Search Console to scan your entire site and identify pages that are not appearing in Google's index. It continuously monitors your site for changes and alerts you when pages drop out of the index, allowing you to take immediate action to resubmit them."
    },
    {
      question: "Will this work for any type of website?",
      answer: "Yes, Index Checker AI works for any website type, including e-commerce, blogs, SaaS, and enterprise sites. It's especially valuable for websites with frequently changing content or large numbers of pages that need to stay indexed."
    },
    {
      question: "Do I need technical knowledge to use Index Checker AI?",
      answer: "No technical knowledge is required. Our tool is designed with a user-friendly interface that makes it easy for anyone to set up and use. Simply connect your website and Google Search Console, and the system will handle the technical aspects for you."
    },
    {
      question: "How often does Index Checker AI scan my website?",
      answer: "The Monthly plan includes weekly scans of your entire website, while the Annual plan upgrades you to daily scans for more frequent monitoring. For very large websites, custom scanning schedules can be arranged through our Enterprise plan."
    },
    {
      question: "Can I track multiple websites with one account?",
      answer: "Yes, our Monthly and Annual plans allow you to add multiple websites to your account. Each additional website will be charged at a discounted rate. For organizations managing many websites, our Enterprise plan offers the most cost-effective solution."
    },
    {
      question: "Is there a free trial available?",
      answer: "Yes, we offer a 14-day free trial with no credit card required. This gives you full access to all features so you can see exactly how Index Checker AI helps improve your website's visibility before committing to a subscription."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section 
      id="faq"
      ref={faqRef}
      className="py-16 md:py-24 duration-1000"
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Got questions about Index Checker AI? We've got answers.
          </p>
        </div>

        <div className="max-w-3xl mx-auto divide-y divide-gray-200">
          {faqItems.map((item, index) => (
            <div key={index} className="py-6">
              <button
                className="flex justify-between items-center w-full text-left"
                onClick={() => toggleFAQ(index)}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <h3 className="text-lg font-medium text-gray-900">{item.question}</h3>
                <span className="ml-6 flex-shrink-0">
                  {openIndex === index ? (
                    <ChevronUp className="h-6 w-6 text-primary-500" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-gray-500" />
                  )}
                </span>
              </button>
              <div
                id={`faq-answer-${index}`}
                className={`mt-3 transition-all duration-300 ease-in-out overflow-hidden ${
                  openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
                aria-hidden={openIndex !== index}
              >
                <p className="text-gray-600">{item.answer}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Still have questions? Contact our support team.
          </p>
          <a 
            href="mailto:support@indexcheckerai.com" 
            className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-medium"
          >
            support@indexcheckerai.com
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQ;