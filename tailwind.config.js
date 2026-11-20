/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        grotesk: ['"Space Grotesk"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        space: {
          black: '#000000',
          dark: '#05040a',
          surface: '#0d0a16',
          card: '#120d20',
          border: 'rgba(168, 85, 247, 0.18)',
          purple: {
            DEFAULT: '#a855f7',
            light: '#c084fc',
            muted: '#e9d5ff',
            dark: '#7e22ce',
            glow: 'rgba(168, 85, 247, 0.35)',
          }
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
};
