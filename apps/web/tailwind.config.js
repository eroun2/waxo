/** WaXo brand tokens: black & white, theme-aware via CSS variables (see styles/index.css). */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        line: 'var(--line)',
      },
      borderRadius: {
        card: '16px',
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      letterSpacing: {
        tightest: '-0.035em',
        tighter: '-0.02em',
        tight: '-0.01em',
      },
    },
  },
  plugins: [],
};
