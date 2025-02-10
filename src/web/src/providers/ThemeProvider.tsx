import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSystemTheme, getStoredTheme, setTheme } from '../config/theme';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  handleThemeChange: (newTheme: Theme) => void;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: Theme;
}

// Create theme context with default values
export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  handleThemeChange: () => {},
});

/**
 * Custom hook to access theme context within components
 * @throws {Error} When used outside of ThemeProvider
 * @returns {ThemeContextType} Current theme context value
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Theme provider component that manages theme state and provides
 * theme context throughout the application
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
}) => {
  // Initialize theme state with stored preference, initial theme, or system preference
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    if (initialTheme) return initialTheme;
    const stored = getStoredTheme();
    return stored;
  });

  /**
   * Handles theme changes throughout the application
   * @param newTheme - The new theme to apply
   */
  const handleThemeChange = (newTheme: Theme): void => {
    // Validate theme value
    if (!['light', 'dark', 'system'].includes(newTheme)) {
      console.error('Invalid theme value:', newTheme);
      return;
    }

    // Update theme state
    setCurrentTheme(newTheme);

    // Apply theme changes using utility function
    setTheme(newTheme);

    // Track theme change for analytics (if needed)
    try {
      window.dispatchEvent(
        new CustomEvent('theme-analytics', {
          detail: {
            action: 'theme_change',
            value: newTheme,
          },
        })
      );
    } catch (error) {
      console.error('Failed to track theme change:', error);
    }
  };

  /**
   * Handles system theme preference changes
   * @param event - MediaQueryList change event
   */
  const handleSystemThemeChange = (event: MediaQueryListEvent): void => {
    if (currentTheme === 'system') {
      const newTheme = event.matches ? 'dark' : 'light';
      setTheme('system'); // This will apply the correct theme based on system preference
    }
  };

  // Set up system theme change listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Add event listener for system theme changes
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // Apply initial theme
    setTheme(currentTheme);

    // Cleanup listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [currentTheme]);

  // Create context value object
  const contextValue: ThemeContextType = {
    theme: currentTheme,
    handleThemeChange,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Default props
ThemeProvider.defaultProps = {
  initialTheme: undefined,
};