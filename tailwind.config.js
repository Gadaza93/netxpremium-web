// Tailwind compilado (antes se usaba el CDN, que compila en el navegador en cada visita).
// Regenerar assets/app.css después de cambiar clases en los HTML:
//   npx tailwindcss@3.4.17 -c tailwind.config.js -i src/app.css -o assets/app.css --minify
module.exports = {
  content: ['./index.html', './nexobar.html', './planes.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Plus Jakarta Fallback"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"JetBrains Mono Fallback"', 'monospace'],
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
  // Letras de reemplazo ajustadas a las medidas de Plus Jakarta Sans y JetBrains Mono.
  // Mientras carga la fuente de Google se usa Arial / Courier New con el mismo ancho y alto,
  // así el texto no cambia de tamaño al llegar la fuente y la página no «salta» (CLS).
  // Medidas tomadas con canvas (ancho de texto real) para cada grosor.
  plugins: [
    ({ addBase }) => addBase([
      { '@font-face': { fontFamily: '"Plus Jakarta Fallback"', src: 'local("Arial"), local("ArialMT")', fontWeight: '100 500', sizeAdjust: '105.7%', ascentOverride: '98.4%', descentOverride: '20.8%', lineGapOverride: '0%' } },
      { '@font-face': { fontFamily: '"Plus Jakarta Fallback"', src: 'local("Arial Bold"), local("Arial-BoldMT")', fontWeight: '600 700', sizeAdjust: '100.2%', ascentOverride: '103.8%', descentOverride: '22%', lineGapOverride: '0%' } },
      { '@font-face': { fontFamily: '"Plus Jakarta Fallback"', src: 'local("Arial Bold"), local("Arial-BoldMT")', fontWeight: '800 900', sizeAdjust: '88.5%', ascentOverride: '117.5%', descentOverride: '24.9%', lineGapOverride: '0%' } },
      { '@font-face': { fontFamily: '"JetBrains Mono Fallback"', src: 'local("Courier New"), local("CourierNewPSMT")', sizeAdjust: '100%', ascentOverride: '102%', descentOverride: '30%', lineGapOverride: '0%' } },
    ]),
  ],
};
