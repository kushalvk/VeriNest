/**
 * Design tokens for VeriNest.
 *
 * Color roles (use these over raw palette names in new code):
 *   primary  — brand accent (indigo; matches the email templates' #4f46e5)
 *   success / warning / danger / info — semantic states
 *   slate    — THE neutral scale for text, borders, and surfaces
 *
 * Scales are inlined (Tailwind's own indigo/green/amber/red/sky values)
 * so the config has zero imports — the Vite dev server re-evaluates it
 * reliably on change.
 *
 * Conventions:
 *   radius : rounded-md buttons/inputs · rounded-lg cards · rounded-full pills/avatars
 *   shadow : shadow-card raised cards · shadow-lg popovers/menus
 *   type   : font-sans everywhere (same stack as the branded emails)
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic surfaces — CSS-variable backed (values in index.css),
        // so they flip automatically when <html class="dark"> is set.
        canvas: 'rgb(var(--vn-canvas) / <alpha-value>)',
        surface: 'rgb(var(--vn-surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--vn-surface-muted) / <alpha-value>)',
        ink: 'rgb(var(--vn-ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--vn-ink-muted) / <alpha-value>)',
        'ink-faint': 'rgb(var(--vn-ink-faint) / <alpha-value>)',
        line: 'rgb(var(--vn-line) / <alpha-value>)',
        'line-strong': 'rgb(var(--vn-line-strong) / <alpha-value>)',
        primary: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
        },
        success: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d', 950: '#052e16',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f', 950: '#451a03',
        },
        danger: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
        },
        info: {
          50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
          800: '#075985', 900: '#0c4a6e', 950: '#082f49',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
};
