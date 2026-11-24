/**
 * Envia todas as URLs do sitemap gerado (dist/) ao IndexNow, que repassa
 * para Bing, Yandex, Seznam e Naver. Rodar depois de `npm run deploy`.
 *
 * Uso: npm run indexnow
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const KEY = '33ff2ef01c6680385e6668040eb58d4a';
const SITE = process.env.SITE_URL ?? 'https://codigos-jogos.pages.dev';
const DIST = path.join(process.cwd(), 'dist');

async function urlsDoSitemap(): Promise<string[]> {
  const arquivos = (await readdir(DIST)).filter((f) => /^sitemap-\d+\.xml$/.test(f));
  const urls: string[] = [];
  for (const arquivo of arquivos) {
    const xml = await readFile(path.join(DIST, arquivo), 'utf-8');
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1]);
  }
  return urls;
}

async function main() {
  const urls = await urlsDoSitemap();
  if (urls.length === 0) throw new Error('Nenhuma URL no sitemap — rode `npm run build` antes.');
  const host = new URL(SITE).host;
  // O IndexNow aceita até 10.000 URLs por requisição.
  for (let i = 0; i < urls.length; i += 10_000) {
    const lote = urls.slice(i, i + 10_000);
    const resposta = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: KEY,
        keyLocation: `${SITE}/${KEY}.txt`,
        urlList: lote,
      }),
    });
    console.log(`IndexNow: ${lote.length} URLs -> HTTP ${resposta.status} ${resposta.statusText}`);
    if (resposta.status >= 400) console.log(await resposta.text());
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
