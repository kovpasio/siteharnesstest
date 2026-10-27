/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0C121C',
          900: '#111A27',
          800: '#182334',
          700: '#223146',
          600: '#2E4058',
        },
        accent: {
          DEFAULT: '#4F9DFF',
          soft: '#8DC2FF',
          deep: '#2B6CCB',
        },
        neon: {
          lime: '#4F9DFF',
          cyan: '#43D6C5',
          violet: '#B27CFF',
        },
        rarity: {
          common: '#96A3B8',
          rare: '#4D9BFF',
          epic: '#B07CFF',
          legendary: '#F2A54A',
          mythic: '#F06473',
        },
        gold: '#F2A54A',
        teal: '#43D6C5',
        paper: '#F1F5FB',
        muted: '#A1AEC2',
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-lime': '0 14px 36px -18px rgba(79,157,255,.55)',
        'neon-violet': '0 14px 36px -18px rgba(176,124,255,.4)',
        card: '0 20px 50px -28px rgba(0,0,0,.72)',
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
