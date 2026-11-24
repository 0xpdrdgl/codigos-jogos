// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// SITE_URL define a URL canônica usada em meta tags, Open Graph e sitemap.
// Defina a variável de ambiente SITE_URL no build de produção (ex.: no
// Cloudflare Pages) para apontar o domínio final.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://codigos-jogos.pages.dev',
  integrations: [
    // Sitemap fatiado: milhares de URLs divididas em arquivos de até 1.000 entradas.
    sitemap({ entryLimit: 1000 }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
