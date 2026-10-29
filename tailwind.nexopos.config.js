// Tailwind de la página de NexoPos (nexopos.html): acento naranja #FF8C32 sobre grafito #181A20.
// Va en su propio CSS (assets/nexopos.css) para no tocar el de la agencia ni el de NexoBar.
// Se compila con: node scripts/build-css.mjs
const base = require('./tailwind.config.js');

module.exports = {
  ...base,
  content: ['./nexopos.html'],
  theme: {
    extend: {
      ...base.theme.extend,
      colors: {
        ...base.theme.extend.colors,
        brand: {
          50: '#FFF4EB',
          100: '#FFE4CC',
          200: '#FFC999',
          300: '#FFB070',
          400: '#FF9D4D',
          500: '#FF8C32',
          600: '#E6731B',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
        },
        grafito: {
          950: '#12141A',
          900: '#16181F',
          850: '#20232B',
          800: '#282C37',
          700: '#323745',
        },
      },
    },
  },
};
