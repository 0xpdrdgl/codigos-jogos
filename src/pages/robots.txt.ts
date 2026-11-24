import type { APIRoute } from 'astro';

/**
 * robots.txt gerado no build: libera rastreadores de busca e de IA
 * (o conteúdo é factual e queremos ser citados pelas respostas de IA).
 */
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap-index.xml', site ?? 'https://codigos-jogos.pages.dev').href;
  return new Response(
    `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${sitemap}
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
};
