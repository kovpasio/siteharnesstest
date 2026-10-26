/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05060a',
          900: '#080a11',
          800: '#0d101a',
          700: '#141827',
          600: '#1c2133',
        },
        neon: {
          lime: '#b6ff3b',
          cyan: '#39e8ff',
          violet: '#8b5cff',
        },
        rarity: {
          common: '#8b95a7',
          rare: '#3b82f6',
          epic: '#a855f7',
          legendary: '#ff8a1f',
          mythic: '#ff3d55',
        },
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-lime': '0 0 30px rgba(182,255,59,.22), 0 0 80px rgba(182,255,59,.08)',
        'neon-violet': '0 0 30px rgba(139,92,255,.3), 0 0 90px rgba(139,92,255,.12)',
        card: '0 24px 60px -28px rgba(0,0,0,.9)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseNeon: {
          '0%, 100%': { opacity: '.45', transform: 'scale(1)' },
          '50%': { opacity: '.9', transform: 'scale(1.06)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        scan: {
          '0%': { transform: 'translateY(-120%)' },
          '100%': { transform: 'translateY(520%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.6s linear infinite',
        float: 'float 5s ease-in-out infinite',
        'pulse-neon': 'pulseNeon 3s ease-in-out infinite',
        scan: 'scan 5s linear infinite',
      },
    },
  },
  plugins: [],
};
