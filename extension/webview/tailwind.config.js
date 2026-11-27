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
          50: '#f0fdf4',
          500: '#10b981',
          600: '#059669',
        },
        editor: {
          bg: '#0d1117',
          sidebar: '#161b22',
          card: '#21262d',
          border: '#30363d',
          text: '#c9d1d9',
          muted: '#8b949e',
          accent: '#58a6ff'
        }
      }
    },
  },
  plugins: [],
}
