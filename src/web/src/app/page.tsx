'use client';

import React, { useEffect, useState } from 'react'; // v18.0.0
import { motion, useAnimation, AnimatePresence } from 'framer-motion'; // v10.0.0
import { Header } from '../components/layout/Header';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';

// Responsive breakpoints following design specifications
const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

// Animation variants for sections
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const graphAnimation = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
};

const LandingPage: React.FC = () => {
  const { isAuthenticated, handleLogin } = useAuth();
  const controls = useAnimation();
  const [currentBreakpoint, setCurrentBreakpoint] = useState<keyof typeof BREAKPOINTS>('mobile');

  // Handle responsive breakpoints
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= BREAKPOINTS.wide) setCurrentBreakpoint('wide');
      else if (width >= BREAKPOINTS.desktop) setCurrentBreakpoint('desktop');
      else if (width >= BREAKPOINTS.tablet) setCurrentBreakpoint('tablet');
      else setCurrentBreakpoint('mobile');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Trigger animations on mount
  useEffect(() => {
    controls.start('visible');
  }, [controls]);

  const handleGetStarted = async () => {
    if (!isAuthenticated) {
      try {
        await handleLogin('', ''); // Will trigger login flow through Clerk
      } catch (error) {
        console.error('Login failed:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      {/* Hero Section */}
      <motion.section
        className="relative pt-20 pb-16 md:pt-32 md:pb-24"
        initial="hidden"
        animate={controls}
        variants={fadeInUp}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6"
              variants={fadeInUp}
            >
              Community Management Platform
            </motion.h1>
            <motion.p
              className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto"
              variants={fadeInUp}
            >
              Revolutionize how you manage and analyze your community data through advanced graph technology and network analysis.
            </motion.p>
            <motion.div variants={fadeInUp}>
              <Button
                variant="primary"
                size="lg"
                onClick={handleGetStarted}
                className="mr-4"
                ariaLabel="Get Started"
              >
                Get Started
              </Button>
              <Button
                variant="outline"
                size="lg"
                ariaLabel="Learn More"
              >
                Learn More
              </Button>
            </motion.div>
          </div>

          {/* Graph Visualization Preview */}
          <motion.div
            className="mt-16 relative h-[400px] md:h-[500px] bg-gradient-to-r from-primary-50 to-primary-100 dark:from-gray-800 dark:to-gray-700 rounded-lg shadow-xl overflow-hidden"
            variants={graphAnimation}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Placeholder for actual graph visualization */}
              <div className="w-full h-full bg-[url('/graph-preview.svg')] bg-no-repeat bg-center bg-contain" />
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        className="py-16 md:py-24 bg-gray-50 dark:bg-gray-800"
        initial="hidden"
        animate={controls}
        variants={fadeInUp}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Graph Database Feature */}
            <motion.div
              className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md"
              variants={fadeInUp}
            >
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Advanced Graph Database
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Transform disparate data sources into an actionable knowledge graph for deep insights.
              </p>
            </motion.div>

            {/* Network Analysis Feature */}
            <motion.div
              className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md"
              variants={fadeInUp}
            >
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Network Analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Understand complex relationships and patterns within your community data.
              </p>
            </motion.div>

            {/* Event Integration Feature */}
            <motion.div
              className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md"
              variants={fadeInUp}
            >
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Event Integration
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Seamlessly integrate with major event platforms for comprehensive data analysis.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Call to Action Section */}
      <motion.section
        className="py-16 md:py-24"
        initial="hidden"
        animate={controls}
        variants={fadeInUp}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Ready to Transform Your Community?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Join organizations already leveraging our platform for deeper community insights.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={handleGetStarted}
            ariaLabel="Start Free Trial"
          >
            Start Free Trial
          </Button>
        </div>
      </motion.section>
    </div>
  );
};

export default LandingPage;