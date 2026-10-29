// Compila Tailwind a assets/app.css y actualiza la versión (?v=hash) en los HTML para que
// Cloudflare y los navegadores tomen el CSS nuevo aunque lo cacheen por un año.
// Uso: node scripts/build-css.mjs
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

execSync('npx --yes tailwindcss@3.4.17 -c tailwind.config.js -i src/app.css -o assets/app.css --minify', { stdio: 'inherit' });

const version = createHash('sha256').update(fs.readFileSync('assets/app.css')).digest('hex').slice(0, 10);
for (const pagina of ['index.html', 'nexobar.html']) {
  const html = fs.readFileSync(pagina, 'utf8');
  const nuevo = html.replace(/\/assets\/app\.css(\?v=[0-9a-f]+)?/g, `/assets/app.css?v=${version}`);
  if (nuevo !== html) fs.writeFileSync(pagina, nuevo);
}
console.log(`assets/app.css v=${version}`);
