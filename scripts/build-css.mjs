// Compila Tailwind y actualiza la versión (?v=hash) en los HTML para que Cloudflare y los
// navegadores tomen el CSS nuevo aunque lo cacheen por un año.
//   assets/app.css     → index.html y nexobar.html (agencia y NexoBar)
//   assets/nexopos.css → nexopos.html (NexoPos, paleta propia)
// Uso: node scripts/build-css.mjs
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const hojas = [
  { config: 'tailwind.config.js', salida: 'assets/app.css', paginas: ['index.html', 'nexobar.html'] },
  { config: 'tailwind.nexopos.config.js', salida: 'assets/nexopos.css', paginas: ['nexopos.html'] },
];

for (const { config, salida, paginas } of hojas) {
  if (!paginas.every((p) => fs.existsSync(p))) continue;
  execSync(`npx --yes tailwindcss@3.4.17 -c ${config} -i src/app.css -o ${salida} --minify`, { stdio: 'inherit' });

  const version = createHash('sha256').update(fs.readFileSync(salida)).digest('hex').slice(0, 10);
  const escapada = salida.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const ruta = new RegExp(`/${escapada}(\\?v=[0-9a-f]+)?`, 'g');
  for (const pagina of paginas) {
    const html = fs.readFileSync(pagina, 'utf8');
    const nuevo = html.replace(ruta, `/${salida}?v=${version}`);
    if (nuevo !== html) fs.writeFileSync(pagina, nuevo);
  }
  console.log(`${salida} v=${version}`);
}
