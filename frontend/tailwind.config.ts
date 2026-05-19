import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        base: '#0A0A0F',
        surface: '#111118',
        elevated: '#1A1A24',
        border: '#2A2A3A',
        primary: '#6366F1',
        secondary: '#22D3EE',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        critical: '#DC2626',
      },
    },
  },
  plugins: [],
} satisfies Config
