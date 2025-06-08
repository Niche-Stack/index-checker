import React, { useState, useEffect } from 'react';
import { Search, Menu, X } from 'lucide-react';
import Button from '../ui/Button';
import Logo from '../ui/Logo';

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white shadow-md py-2' 
          : 'bg-transparent py-4'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          <a href='/' className="flex items-center space-x-2">
            <Logo />
          </a>
          
          {/* Desktop Navigation */}
          {/* <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              FAQ
            </a>
          </nav> */}

          <div className="hidden md:flex items-center space-x-4">
            <a 
              href="/login" 
            >
              <Button variant="primary" size="sm">
                Get Started
              </Button>
            </a>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white">
          <div className="px-4 py-5 space-y-4">
            <a 
              href="#features" 
              className="block text-gray-700 hover:text-primary-600 font-medium transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a 
              href="#how-it-works" 
              className="block text-gray-700 hover:text-primary-600 font-medium transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </a>
            <a 
              href="#pricing" 
              className="block text-gray-700 hover:text-primary-600 font-medium transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </a>
            <a 
              href="#faq" 
              className="block text-gray-700 hover:text-primary-600 font-medium transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </a>
            <div className="pt-4 space-y-3">
              <Button variant="outline" size="sm" className="w-full">
                Log in
              </Button>
              <Button variant="primary" size="sm" className="w-full">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;