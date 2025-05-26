import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthState } from './hooks/useAuthState';
import LoadingScreen from './components/ui/LoadingScreen';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import LandingPage from './pages/landing/LandingPage';

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const OnboardingPage = lazy(() => import('./pages/auth/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const SitesPage = lazy(() => import('./pages/sites/SitesPage'));
const HistoryPage = lazy(() => import('./pages/history/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const BillingPage = lazy(() => import('./pages/billing/BillingPage'));

// Route guards
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthState();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user hasn't finished onboarding, send them there
  if (!user.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding is done but user tries to access onboarding, send to dashboard
  if (user.onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthState();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    if (!user.onboardingCompleted) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={
          <PublicRoute>
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          </PublicRoute>
        } />
        <Route path="/onboarding" element={
          <PrivateRoute>
            <AuthLayout>
              <OnboardingPage />
            </AuthLayout>
          </PrivateRoute>
        } />

        {/* Private routes */}
        <Route path="/dashboard" element={
          <PrivateRoute>
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          </PrivateRoute>
        } />
        <Route path="/sites" element={
          <PrivateRoute>
            <MainLayout>
              <SitesPage />
            </MainLayout>
          </PrivateRoute>
        } />
        <Route path="/history" element={
          <PrivateRoute>
            <MainLayout>
              <HistoryPage />
            </MainLayout>
          </PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute>
            <MainLayout>
              <SettingsPage />
            </MainLayout>
          </PrivateRoute>
        } />
        <Route path="/billing" element={
          <PrivateRoute>
            <MainLayout>
              <BillingPage />
            </MainLayout>
          </PrivateRoute>
        } />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;