import React from 'react';
import { Search, Zap } from 'lucide-react';

interface LogoProps {
  variant?: 'light' | 'dark';
}

const Logo: React.FC<LogoProps> = ({ variant = 'dark' }) => {
  const textColor = variant === 'light' ? 'text-white' : 'text-gray-900';
  
  return (
    <div className="flex items-center">
      <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center mr-2 relative overflow-hidden">
        <Search className="text-white absolute" size={16} />
        <Zap className="text-white absolute animate-ping opacity-70" size={16} />
      </div>
      <span className={`text-xl font-bold ${textColor}`}>
        Index<span className="text-primary-600">Checker</span>AI
      </span>
    </div>
  );
};

export default Logo;