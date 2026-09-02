/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './data/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1B4332',
          mid: '#2D6A4F',
          lt: '#40916C',
        },
        amber: {
          DEFAULT: '#D4A017',
          lt: '#F0C040',
        },
        surface: {
          DEFAULT: '#F7F6F3',
          2: '#EDECEA',
        },
        ink: {
          DEFAULT: '#1A1A18',
          mid: '#3D3D38',
        },
        muted: '#7A7A72',
        border: '#D9D8D4',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        serif: ['var(--font-dm-serif)', 'serif'],
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '16px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,.08)',
        'card-lg': '0 6px 28px rgba(0,0,0,.12)',
      },
    },
  },
  plugins: [],
};
