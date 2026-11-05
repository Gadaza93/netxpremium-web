// Tailwind de la página de Nexo Retail (nexoretail.html): misma paleta que NexoPos (naranja #FF8C32 sobre grafito).
// Va en su propio CSS (assets/nexoretail.css) para no tocar el de la agencia, NexoBar ni NexoPos.
// Se compila con: node scripts/build-css.mjs
const nexopos = require('./tailwind.nexopos.config.js');

module.exports = {
  ...nexopos,
  content: ['./nexoretail.html'],
};
