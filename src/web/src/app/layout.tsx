'use client';

import React from 'react';
import { ErrorBoundary } from '@sentry/react'; // v7.0.0
import { Metadata } from 'next'; // v13.0.0
import ThemeProvider from '../providers/ThemeProvider';
import AuthProvider from '../providers/AuthProvider';
import ToastProvider from '../providers/ToastProvider';

// Enhanced metadata configuration for SEO optimization
export const metadata: Metadata = {
  title: 'Community Management Platform',
  description: 'Advanced community analytics and management platform with graph database technology',
  viewport: 'width=device-width, initial-scale=1',
  charset: 'utf-8',
  openGraph: {
    title: 'Community Management Platform',
    description: 'Advanced community analytics platform',
    type: 'website',
    image: '/og-image.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Management Platform',
    description: 'Advanced community analytics platform',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

// Custom error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="error-boundary" role="alert">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Reload Page</button>
  </div>
);

// Root layout component with performance optimization
const RootLayout = React.memo<{ children: React.ReactNode }>(({ children }) => {
  // Error tracking configuration
  const beforeCapture = (scope: any) => {
    scope.setTag('component', 'RootLayout');
    scope.setLevel('error');
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ErrorBoundary
          fallback={ErrorFallback}
          beforeCapture={beforeCapture}
          onError={(error) => {
            console.error('Root Layout Error:', error);
          }}
        >
          <React.Suspense
            fallback={
              <div className="loading" role="status">
                Loading...
              </div>
            }
          >
            <ThemeProvider>
              <AuthProvider>
                <ToastProvider>
                  <main className="app-root">
                    {children}
                  </main>
                </ToastProvider>
              </AuthProvider>
            </ThemeProvider>
          </React.Suspense>
        </ErrorBoundary>

        {/* Performance monitoring script */}
        <script
          defer
          data-site="community-platform"
          src="/js/performance-monitor.js"
        />
      </body>
    </html>
  );
});

// Display name for debugging
RootLayout.displayName = 'RootLayout';

export default RootLayout;