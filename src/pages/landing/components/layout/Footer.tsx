import React from 'react';
import Logo from '../ui/Logo';
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin, Github } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8 mb-12">
          <div>
            <Logo variant="light" />
            <p className="mt-4 text-gray-400 leading-relaxed">
              Index Checker AI helps you discover and fix unindexed pages that are missed by search engines, ensuring maximum visibility for your website.
            </p>
            <div className="flex mt-6 space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="LinkedIn">
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
              </li>
              <li>
                <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a>
              </li>
              <li>
                <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
              </li>
              <li>
                <a href="#faq" className="text-gray-400 hover:text-white transition-colors">FAQ</a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a>
              </li>
            </ul>
          </div> */}

          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-3">
              <li>
                <a href="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <Mail size={20} className="mr-3 text-gray-400 flex-shrink-0 mt-1" />
                <a href="mailto:info@indexcheckerai.com" className="text-gray-400 hover:text-white transition-colors">
                  info@indexcheckerai.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <hr className="border-gray-800 mb-8" />

        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm mb-4 md:mb-0">
            &copy; {currentYear} Index Checker AI. All rights reserved.
          </p>
          {/* <div className="flex space-x-4">
            <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
              Sitemap
            </a>
            <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
              Accessibility
            </a>
            <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
              Support
            </a>
          </div> */}
        </div>
      </div>
    </footer>
  );
};

export default Footer;