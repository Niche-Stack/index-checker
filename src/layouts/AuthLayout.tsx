import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-6">
        <header className="flex justify-between items-center mb-8">
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-blue-800 text-white p-2 rounded-md">
              <Search className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-blue-900">Index Checker</span>
          </Link>
        </header>
        
        <main className="max-w-md mx-auto">
          {children}
        </main>
        
        <footer className="mt-16 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Index Checker. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default AuthLayout;