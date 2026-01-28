/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#000000',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F5F5F5',
          foreground: '#000000',
        },
        muted: {
          DEFAULT: '#F5F5F5',
          foreground: '#737373',
        },
        accent: {
          DEFAULT: '#F5F5F5',
          foreground: '#000000',
        },
        border: '#E5E5E5',
        input: '#E5E5E5',
        ring: '#000000',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#000000',
            a: {
              color: '#000000',
              '&:hover': {
                color: '#000000',
              },
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('tailwindcss-animate')],
}

