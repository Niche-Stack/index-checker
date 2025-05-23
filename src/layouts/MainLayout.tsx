import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, 
  LayoutDashboard, 
  Globe, 
  History, 
  Settings, 
  CreditCard, 
  LogOut, 
  Menu, 
  X, 
  ChevronDown 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCredits } from '../contexts/CreditContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, signOut } = useAuth();
  const { credits } = useCredits();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/sites', label: 'Sites', icon: <Globe className="w-5 h-5" /> },
    { path: '/history', label: 'History', icon: <History className="w-5 h-5" /> },
    { path: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
    { path: '/billing', label: 'Billing', icon: <CreditCard className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <button 
                className="md:hidden mr-2 p-2 rounded-md hover:bg-slate-100"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              
              <Link to="/" className="flex items-center space-x-2">
                <div className="bg-blue-800 text-white p-2 rounded-md">
                  <Search className="w-5 h-5" />
                </div>
                <span className="font-bold text-xl text-blue-900 hidden md:inline">Index Checker</span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              <div className="bg-slate-100 rounded-full px-3 py-1 text-sm font-medium text-slate-700 flex items-center">
                <span>{credits}</span>
                <span className="ml-1">credits</span>
              </div>
              
              <div className="relative">
                <button 
                  className="flex items-center space-x-2"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                    {userProfile?.photoURL ? (
                      <img 
                        src={userProfile.photoURL} 
                        alt={userProfile.displayName || 'User'} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-slate-600">
                        {userProfile?.displayName?.[0] || 'U'}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
                
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium">{userProfile?.displayName}</p>
                      <p className="text-xs text-slate-500 truncate">{userProfile?.email}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center space-x-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 container mx-auto px-4 py-6">
        {/* Side navigation - desktop */}
        <aside className="hidden md:block w-56 mr-8 shrink-0">
          <nav className="space-y-1 sticky top-20">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === item.path
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-slate-800 bg-opacity-75 z-40">
            <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 p-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="bg-blue-800 text-white p-2 rounded-md">
                    <Search className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-xl text-blue-900">Index Checker</span>
                </div>
                <button 
                  className="p-2 rounded-md hover:bg-slate-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === item.path
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;