/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#14161A',
          900: '#171A1F',
          800: '#1E2128',
          700: '#252A32',
          600: '#2D333C',
        },
        accent: {
          DEFAULT: '#6C8EBF',
          soft: '#88A6D2',
          deep: '#4C6C97',
        },
        neon: {
          lime: '#6C8EBF',
          cyan: '#82A6C9',
          violet: '#8E6BB5',
        },
        rarity: {
          common: '#8A8F98',
          rare: '#5B8FB9',
          epic: '#8E6BB5',
          legendary: '#C9884A',
          mythic: '#B5545B',
        },
        paper: '#E6E8EB',
        muted: '#9AA0A8',
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-lime': '0 12px 32px -18px rgba(108,142,191,.35)',
        'neon-violet': '0 12px 32px -18px rgba(142,107,181,.28)',
        card: '0 18px 45px -28px rgba(0,0,0,.65)',
        soft: '0 8px 24px -18px rgba(0,0,0,.7)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        pulseNeon: {
          '0%, 100%': { opacity: '.5' },
          '50%': { opacity: '.85' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.8s linear infinite',
        float: 'float 5s ease-in-out infinite',
        'pulse-neon': 'pulseNeon 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
