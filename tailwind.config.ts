import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        blue: {
          DEFAULT: '#185FA5',
          dark: '#0C447C',
          light: '#E6F1FB',
        },
        green: '#1D9E75',
        yellow: '#BA7517',
        red: '#A32D2D',
        bg: {
          DEFAULT: '#FFFFFF',
          2: '#F5F5F0',
          3: '#EEEDE8',
        },
        text: {
          DEFAULT: '#2C2C2A',
          muted: '#888780',
        },
        border: '#E5E5E0',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
}

export default config
