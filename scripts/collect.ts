/**
 * Coleta de códigos nas fontes configuradas em games.json.
 *
 * Roda local (npm run collect) ou no cron do GitHub Actions. Para cada item
 * novo detectado, cria um candidato em pending.json e, se o Telegram estiver
 * configurado, manda a mensagem com botões de aprovação.
 *
 * Dedup em três níveis: item de fonte já visto (seen), código já na base
 * (codes.json) e código já pendente (pending.json).
 */
import { jogos } from '../src/lib/games';
import { candidatosDe, contextoDoCodigo } from '../src/lib/detect';
import { coletar } from '../src/lib/sources';
import { enriquecer } from '../src/lib/llm';
import { mandarAprovacao, telegramDisponivel } from '../src/lib/telegram';
import { carregarCodigos, carregarPending, salvarPending } from '../src/lib/db';
import type { Candidato } from '../src/lib/types';

async function main() {
  const codigos = await carregarCodigos();
  const pending = await carregarPending();
  const seen = new Set(pending.seen);
  const naBase = new Set(codigos.map((c) => `${c.jogo}:${c.codigo}`));
  // Dedup contra TODOS os candidatos: rejeitado não volta a propor, e
  // aguardando não duplica a fila de aprovação.
  const jaVistos = new Set(pending.candidatos.map((c) => c.id));

  let itensNovos = 0;
  let candidatosNovos = 0;

  for (const jogo of jogos) {
    for (const fonte of jogo.fontes) {
      const fonteId = `${jogo.id}:${fonte.url}`;
      const itens = await coletar(fonte);
      for (const item of itens) {
        const itemKey = `${fonteId}:${item.itemId}`;
        if (seen.has(itemKey)) continue;
        seen.add(itemKey);
        pending.seen.push(itemKey);
        itensNovos++;

        const texto = `${item.titulo}\n${item.texto}`;
        const achados = candidatosDe(texto, jogo.formatoCodigo);
        if (achados.length === 0) continue;

        const novos = achados.filter((a) => {
          const id = `${jogo.slug}:${a.codigo}`;
          return !naBase.has(id) && !jaVistos.has(id);
        });
        if (novos.length === 0) continue;

        const extras = await enriquecer(
          jogo,
          texto,
          novos.map((n) => n.codigo),
        );

        for (const achado of novos) {
          const candidato: Candidato = {
            id: `${jogo.slug}:${achado.codigo}`,
            jogoId: jogo.slug,
            codigo: achado.codigo,
            confianca: achado.confianca,
            recompensa: extras.get(achado.codigo)?.recompensa,
            fonteRotulo: fonte.rotulo,
            fonteUrl: item.url || fonte.url,
            contexto: contextoDoCodigo(texto, achado.codigo),
            criadoEm: new Date().toISOString(),
            status: 'aguardando',
          };
          if (telegramDisponivel()) {
            candidato.telegramMessageId = await mandarAprovacao(candidato, jogo);
          }
          pending.candidatos.push(candidato);
          jaVistos.add(candidato.id);
          candidatosNovos++;
          console.log(`  + ${candidato.codigo} (${jogo.slug}, ${achado.confianca})`);
        }
      }
    }
  }

  await salvarPending(pending);
  console.log(
    `coleta ok: ${itensNovos} itens novos lidos, ${candidatosNovos} candidatos ` +
      `${telegramDisponivel() ? 'enviados ao Telegram' : 'aguardando aprovação manual'}`,
  );
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
