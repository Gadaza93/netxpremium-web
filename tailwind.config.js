// Tailwind compilado (antes se usaba el CDN, que compila en el navegador en cada visita).
// Regenerar assets/app.css después de cambiar clases en los HTML:
//   npx tailwindcss@3.4.17 -c tailwind.config.js -i src/app.css -o assets/app.css --minify
module.exports = {
  content: ['./index.html', './nexobar.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        obsidian: {
          950: '#06070A',
          900: '#0B0E14',
          850: '#101520',
          800: '#171E2D',
          700: '#222C40',
        },
        electric: {
          cyan: '#38BDF8',
          indigo: '#6366F1',
          violet: '#8B5CF6',
          emerald: '#10B981',
        },
      },
    },
  },
};
