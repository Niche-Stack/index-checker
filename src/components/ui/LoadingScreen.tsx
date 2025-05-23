import React from 'react';
import { Search } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="inline-flex bg-blue-800 text-white p-3 rounded-md mb-4 animate-pulse">
          <Search className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Loading Index Checker</h1>
        <p className="text-slate-500">Just a moment...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;