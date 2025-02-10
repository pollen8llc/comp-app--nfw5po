import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms' // v0.5+
import typography from '@tailwindcss/typography' // v0.5+

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    screens: {
      'sm': '320px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1440px'
    },
    colors: {
      primary: {
        DEFAULT: 'var(--md-sys-color-primary)',
        container: 'var(--md-sys-color-primary-container)',
        on: 'var(--md-sys-color-on-primary)',
        'on-container': 'var(--md-sys-color-on-primary-container)'
      },
      secondary: {
        DEFAULT: 'var(--md-sys-color-secondary)',
        container: 'var(--md-sys-color-secondary-container)', 
        on: 'var(--md-sys-color-on-secondary)',
        'on-container': 'var(--md-sys-color-on-secondary-container)'
      },
      surface: {
        DEFAULT: 'var(--md-sys-color-surface)',
        dim: 'var(--md-sys-color-surface-dim)',
        bright: 'var(--md-sys-color-surface-bright)',
        'container-lowest': 'var(--md-sys-color-surface-container-lowest)',
        'container-low': 'var(--md-sys-color-surface-container-low)',
        container: 'var(--md-sys-color-surface-container)',
        'container-high': 'var(--md-sys-color-surface-container-high)',
        'container-highest': 'var(--md-sys-color-surface-container-highest)'
      },
      error: {
        DEFAULT: 'var(--md-sys-color-error)',
        container: 'var(--md-sys-color-error-container)',
        on: 'var(--md-sys-color-on-error)',
        'on-container': 'var(--md-sys-color-on-error-container)'
      },
      success: {
        DEFAULT: 'var(--md-sys-color-success)',
        container: 'var(--md-sys-color-success-container)',
        on: 'var(--md-sys-color-on-success)',
        'on-container': 'var(--md-sys-color-on-success-container)'
      },
      warning: {
        DEFAULT: 'var(--md-sys-color-warning)',
        container: 'var(--md-sys-color-warning-container)',
        on: 'var(--md-sys-color-on-warning)',
        'on-container': 'var(--md-sys-color-on-warning-container)'
      }
    },
    fontFamily: {
      sans: ['var(--font-sans)'],
      mono: ['var(--font-mono)']
    },
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-in-out',
        'motion-safe': {
          'fade-in': 'fadeIn 0.2s var(--motion-easing-standard)',
          'slide-in': 'slideIn 0.3s var(--motion-easing-emphasized)',
          'scale-in': 'scaleIn 0.2s var(--motion-easing-emphasized-decelerate)'
        },
        'motion-reduce': {
          'fade-in': 'none',
          'slide-in': 'none',
          'scale-in': 'none'
        }
      },
      elevation: {
        '1': 'var(--md-sys-elevation-1)',
        '2': 'var(--md-sys-elevation-2)',
        '3': 'var(--md-sys-elevation-3)',
        '4': 'var(--md-sys-elevation-4)',
        '5': 'var(--md-sys-elevation-5)'
      },
      transitionTimingFunction: {
        'standard': 'var(--motion-easing-standard)',
        'emphasized': 'var(--motion-easing-emphasized)',
        'emphasized-decelerate': 'var(--motion-easing-emphasized-decelerate)',
        'emphasized-accelerate': 'var(--motion-easing-emphasized-accelerate)'
      }
    }
  },
  plugins: [
    require('tailwindcss/nesting'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
} satisfies Config