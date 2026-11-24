/**
 * Coleta de códigos nas fontes configuradas em games.json — pipeline
 * 100% automático, sem aprovação humana.
 *
 * Por item de fonte:
 * 1. Re-verificação: código já na base renova ultimaVerificacao; código que
 *    aparece na seção de "expirados" de uma fonte é marcado expirado.
 * 2. Publicação direta: código novo entra em codes.json como ativo na hora
 *    (códigos morrem rápido — demora de aprovação custa mais que falso
 *    positivo, que expira sozinho em DIAS_EXPIRACAO dias).
 * 3. Auditoria: todo candidato também vai para pending.json, que serve de
 *    histórico e dedup (rejeitados manuais via `npm run approve -- --reject`
 *    não voltam a entrar).
 *
 * Roda local (npm run collect) ou no cron do GitHub Actions.
 */
import { jogos } from '../src/lib/games';
import { candidatosDe, contextoDoCodigo } from '../src/lib/detect';
import { coletar } from '../src/lib/sources';
import { enriquecer } from '../src/lib/llm';
import { avisarCanal } from '../src/lib/telegram';
import { carregarCodigos, carregarPending, salvarCodigos, salvarPending } from '../src/lib/db';
import type { Candidato } from '../src/lib/types';

/** Dias sem ser re-visto em fonte até marcar o código como expirado. */
const DIAS_EXPIRACAO = 14;

async function main() {
  const codigos = await carregarCodigos();
  const pending = await carregarPending();
  const seen = new Set(pending.seen);
  const naBase = new Set(codigos.map((c) => `${c.jogo}:${c.codigo}`));
  // Dedup contra TODOS os candidatos: rejeitado manual não volta a entrar.
  const jaVistos = new Set(pending.candidatos.map((c) => c.id));
  const agora = new Date().toISOString();

  let itensNovos = 0;
  let publicados = 0;
  let expirados = 0;

  for (const jogo of jogos) {
    for (const fonte of jogo.fontes) {
      const fonteId = `${jogo.id}:${fonte.url}`;
      const itens = await coletar(fonte);
      for (const item of itens) {
        const texto = `${item.titulo}\n${item.texto}`;
        const achados = candidatosDe(texto, jogo.formatoCodigo, {
          permiteMinusculas: jogo.permiteMinusculas,
          // palavras do nome do jogo nunca são código ("FISCH", "BLOX")
          bloqueados: new Set(jogo.nome.toUpperCase().split(/[\s:—-]+/)),
        });

        // Re-verificação roda em todo item (visto ou não): mantém a data fresca
        // enquanto a fonte continuar listando o código.
        for (const a of achados) {
          const naBaseCodigo = codigos.find((c) => c.jogo === jogo.slug && c.codigo === a.codigo);
          if (!naBaseCodigo) continue;
          if (item.expirado) {
            if (naBaseCodigo.status !== 'expirado') {
              naBaseCodigo.status = 'expirado';
              expirados++;
            }
          } else {
            naBaseCodigo.ultimaVerificacao = agora;
          }
        }

        const itemKey = `${fonteId}:${item.itemId}`;
        if (seen.has(itemKey)) continue;
        seen.add(itemKey);
        pending.seen.push(itemKey);
        itensNovos++;

        // Seção de expirados não gera candidato — código morto não entra.
        if (item.expirado) continue;

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
            criadoEm: agora,
            status: 'aprovado',
          };
          pending.candidatos.push(candidato);
          codigos.push({
            jogo: candidato.jogoId,
            codigo: candidato.codigo,
            recompensa: candidato.recompensa,
            status: 'ativo',
            adicionadoEm: agora,
            ultimaVerificacao: agora,
            fonte: candidato.fonteUrl,
          });
          naBase.add(candidato.id);
          jaVistos.add(candidato.id);
          publicados++;
          await avisarCanal(jogo, candidato.codigo, candidato.recompensa);
          console.log(`  + ${candidato.codigo} (${jogo.slug}, ${achado.confianca})`);
        }
      }
    }
  }

  // Varredura: código sem re-verificação há DIAS_EXPIRACAO dias morreu.
  const limite = Date.now() - DIAS_EXPIRACAO * 86_400_000;
  for (const c of codigos) {
    if (c.status === 'ativo' && Date.parse(c.ultimaVerificacao) < limite) {
      c.status = 'expirado';
      expirados++;
    }
  }

  await salvarCodigos(codigos);
  await salvarPending(pending);
  console.log(`coleta ok: ${itensNovos} itens novos lidos, ${publicados} publicados, ${expirados} expirados`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
