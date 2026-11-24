import type { APIRoute } from 'astro';

/**
 * ads.txt gerado do env do build — o AdSense exige este arquivo na raiz
 * para validar o publisher. Sem PUBLIC_ADSENSE_CLIENT, serve arquivo vazio.
 */
export const GET: APIRoute = () => {
  const client = import.meta.env.PUBLIC_ADSENSE_CLIENT;
  // ads.txt usa o ID "pub-…" sem o prefixo "ca-" do snippet do <head>
  const corpo = client ? `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` : '';
  return new Response(corpo, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
