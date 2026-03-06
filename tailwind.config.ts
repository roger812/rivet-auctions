import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#B8924A',
          light: '#D4AA6A',
          dark: '#8B6B34',
        },
        rivet: {
          dark: '#1C1A17',
          mid: '#3A3530',
          warm: '#6B6258',
          cream: '#F5F1EB',
          'cream-dark': '#EDE8DF',
          white: '#FAFAF8',
        },
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-jost)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
