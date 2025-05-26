import React from 'react';
import Header from './components/layout/Header';
import Hero from './components/sections/Hero';
import TryItFree from './components/sections/TryItFree';
import Problem from './components/sections/Problem';
import Features from './components/sections/Features';
import HowItWorks from './components/sections/HowItWorks';
import Testimonials from './components/sections/Testimonials';
import Pricing from './components/sections/Pricing';
import FAQ from './components/sections/FAQ';
import CTA from './components/sections/CTA';
import Footer from './components/layout/Footer';

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />
      <main>
        <Hero />
        <TryItFree />
        <Problem />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;