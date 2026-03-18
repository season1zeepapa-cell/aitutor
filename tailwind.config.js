/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './src/index.html'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'card-bg': 'var(--card-bg)',
        'card-bg-hover': 'var(--card-bg-hover)',
        text: 'var(--text)',
        'text-secondary': 'var(--text-secondary)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-light': 'var(--primary-light)',
        border: 'var(--border)',
        danger: 'var(--danger)',
        'danger-hover': 'var(--danger-hover)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        'input-bg': 'var(--input-bg)',
        'badge-bg': 'var(--badge-bg)',
      },
      boxShadow: {
        sm: '0 1px 2px var(--shadow-color)',
        md: '0 4px 12px var(--shadow-color)',
        lg: '0 10px 24px var(--shadow-color)',
        card: '0 2px 8px var(--shadow-color)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
    },
  },
  plugins: [],
};
