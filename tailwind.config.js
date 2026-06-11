/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        background: '#121212',
        surface: '#1E1E1E',
        primary: '#06b6d4',
        accent: '#8b5cf6',
      },
    },
  },
  plugins: [],
};
