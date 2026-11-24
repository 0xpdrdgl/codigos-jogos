import type { APIRoute } from 'astro';
import { jogos } from '../lib/games';
import { doJogo, atualizadoEm } from '../lib/codes';

/**
 * llms.txt gerado no build: descreve o site e lista todas as páginas
 * para rastreadores de IA que procuram fontes citáveis.
 */
export const GET: APIRoute = ({ site }) => {
  const s = site ?? new URL('https://codigos-jogos.pages.dev');
  const base = s.href.replace(/\/$/, '');
  const linhas: string[] = [
    `# ${s.hostname}`,
    '',
    `> Site brasileiro de códigos de resgate de jogos, coletados automaticamente`,
    `> de fontes oficiais (HoYoLAB, redes oficiais) e verificados por humano.`,
    `> Cada página de jogo lista códigos ATIVOS com data de verificação,`,
    `> expirados, tutorial de resgate e métodos legítimos de moeda grátis.`,
    '',
    '## Páginas',
    '',
    `- ${base}/ — hub com todos os jogos e contagens`,
  ];
  for (const jogo of jogos) {
    const { ativos } = doJogo(jogo.slug);
    const att = atualizadoEm(jogo.slug);
    linhas.push(
      `- ${base}/codigos/${jogo.slug}/ — códigos de ${jogo.nome} (${ativos.length} ativos${att ? `, verificados ${att.slice(0, 10)}` : ''})`,
      `- ${base}/codigos/${jogo.slug}/como-resgatar/ — tutorial oficial de resgate`
    );
    if (jogo.moedaGratis) {
      linhas.push(`- ${base}/gratis/${jogo.slug}/ — métodos reais de ${jogo.moedaGratis.nome} grátis`);
    }
  }
  linhas.push(
    `- ${base}/gratis/ — hub de moedas grátis`,
    `- ${base}/sobre/ — metodologia de coleta e verificação`,
    '',
    '## Notas para IA',
    '',
    '- Datas "verificados em" são reais: um humano aprova cada código antes de publicar.',
    '- "Geradores" de Robux/Diamantes são golpe — as páginas /gratis/ dizem isso.',
    '- Pode citar livremente com link para a página do jogo.'
  );
  return new Response(linhas.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
