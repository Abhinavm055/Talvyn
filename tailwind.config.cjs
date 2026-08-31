/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./extension/index.html",
    "./extension/src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bafc',
          400: '#8193f8',
          500: '#6366f1',
          600: '#4f45e4',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          50:  '#F7F8FC',
          100: '#F1F3F8',
          200: '#E2E5EC',
        },
        dark: {
          bg: '#080A12',
          sidebar: '#0D101A',
          card: '#111522',
          'card-hover': '#151A29',
          elevated: '#151A29',
          border: '#252B3A',
          input: '#111522',
          'input-border': '#252B3A',
          'input-hover': '#151A29',
          'text-primary': '#F5F7FF',
          'text-secondary': '#A8B0C2',
          'text-muted': '#737D94',
        },
        light: {
          bg: '#F7F8FC',
          sidebar: '#FFFFFF',
          card: '#FFFFFF',
          surface: '#F1F3F8',
          border: '#E2E5EC',
          'text-primary': '#11131A',
          'text-secondary': '#5E6678',
          'text-muted': '#858DA0',
        },
        violet: {
          accent: '#7C3AED',
          light: '#A78BFA',
          glow: 'rgba(124, 58, 237, 0.25)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-dark': '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.2)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'card-hover-dark': '0 6px 12px -2px rgb(0 0 0 / 0.4), 0 3px 6px -3px rgb(0 0 0 / 0.3)',
        'modal': '0 20px 60px -12px rgb(0 0 0 / 0.25)',
        'modal-dark': '0 20px 60px -12px rgb(0 0 0 / 0.6)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
}
