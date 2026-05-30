/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2563EB',
          dark: '#1D4ED8',
          accent: '#6366F1',
          ai: '#7C3AED',
          sky: '#FAFBFC',
          surface: '#FFFFFF',
        },
      },
      borderRadius: {
        '4xl': '1.5rem',
        '5xl': '1.75rem',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
  plugins: [],
}
