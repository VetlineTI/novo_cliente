/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#85b934',
          'green-dark': '#709d29',
          'green-light': '#f4f8ec',
          'green-subtle': '#f7faef',
          teal: '#1d5b79',
          'teal-dark': '#144258',
          'teal-light': '#e9f3f8',
          navy: '#0f3a53',
          'navy-dark': '#0a2738',
          'navy-light': '#1e5a7e',
          dark: '#18181b',
          muted: '#64748b',
          bg: '#f8fafc',
          card: '#ffffff'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'elevated': '0 20px 40px -15px rgba(0, 0, 0, 0.07), 0 0 0 1px rgba(0, 0, 0, 0.03)',
        'glow': '0 0 20px rgba(133, 185, 52, 0.25)',
      }
    },
  },
  plugins: [],
}
