// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

// lastmod por URL: páginas de jogo usam a última verificação real dos
// códigos; o resto usa a data do build. Sinal de frescor para SEO/GEO.
const codes = JSON.parse(readFileSync('./src/data/codes.json', 'utf8'));
const lastmodPorSlug = {};
for (const c of codes.codigos ?? []) {
  const ref = c.ultimaVerificacao ?? c.primeiroVisto;
  if (!ref) continue;
  const data = ref.slice(0, 10);
  if (!lastmodPorSlug[c.jogo] || data > lastmodPorSlug[c.jogo]) {
    lastmodPorSlug[c.jogo] = data;
  }
}
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://codigos-jogos.pages.dev',
  integrations: [
    // Sitemap fatiado: milhares de URLs divididas em arquivos de até 1.000 entradas.
    sitemap({
      entryLimit: 1000,
      serialize(item) {
        const m = item.url.match(/\/codigos\/([a-z0-9-]+)\//);
        item.lastmod = (m && lastmodPorSlug[m[1]]) ?? buildDate;
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
