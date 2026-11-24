/**
 * Aprovação dos candidatos pendentes.
 *
 * Modos:
 *   npm run approve            — loop contínuo esperando os botões do Telegram
 *   npm run approve -- --once  — processa os callbacks atuais e sai
 *   npm run approve -- --list  — lista os candidatos aguardando
 *   npm run approve -- --approve <id> [--recompensa "..."]
 *   npm run approve -- --reject <id>
 *
 * Aprovado → entra em codes.json e dispara o aviso no canal (se configurado).
 * Depois rode `npm run publish` para commitar e deployar.
 */
import { obterJogo } from '../src/lib/games';
import { buscarUpdates, confirmarCallback, avisarCanal, telegramDisponivel } from '../src/lib/telegram';
import { carregarCodigos, carregarPending, salvarCodigos, salvarPending } from '../src/lib/db';
import type { Candidato, Codigo } from '../src/lib/types';

const args = process.argv.slice(2);
const tem = (flag: string) => args.includes(flag);
const valor = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

function paraCodigo(candidato: Candidato): Codigo {
  const agora = new Date().toISOString();
  return {
    jogo: candidato.jogoId,
    codigo: candidato.codigo,
    recompensa: candidato.recompensa,
    status: 'ativo',
    adicionadoEm: agora,
    ultimaVerificacao: agora,
    fonte: candidato.fonteUrl,
  };
}

async function aprovar(candidato: Candidato, recompensa?: string): Promise<void> {
  const jogo = obterJogo(candidato.jogoId);
  const codigos = await carregarCodigos();
  const chave = `${candidato.jogoId}:${candidato.codigo}`;
  if (!codigos.some((c) => `${c.jogo}:${c.codigo}` === chave)) {
    const codigo = paraCodigo(candidato);
    if (recompensa) codigo.recompensa = recompensa;
    codigos.push(codigo);
    await salvarCodigos(codigos);
  }
  candidato.status = 'aprovado';
  if (recompensa) candidato.recompensa = recompensa;
  if (jogo) await avisarCanal(jogo, candidato.codigo, candidato.recompensa);
  console.log(`aprovado: ${candidato.codigo} (${candidato.jogoId})`);
}

function rejeitar(candidato: Candidato): void {
  candidato.status = 'rejeitado';
  console.log(`rejeitado: ${candidato.codigo} (${candidato.jogoId})`);
}

async function processarCallbacks(offset: number): Promise<{ offset: number; processados: number }> {
  const pending = await carregarPending();
  const updates = await buscarUpdates(offset);
  let processados = 0;
  for (const u of updates) {
    offset = Math.max(offset, u.update_id + 1);
    const cb = u.callback_query;
    const msg = cb?.message;
    const data = cb?.data;
    if (!cb || !data || !msg) continue;
    const acao = data.slice(0, 2); // 'a:' ou 'r:'
    const alvo = pending.candidatos.find((c) => c.id === data.slice(2));
    if (!alvo || alvo.status !== 'aguardando') {
      await confirmarCallback(cb.id, msg.message_id, msg.chat.id, 'Já processado.');
      continue;
    }
    if (acao === 'a:') {
      await aprovar(alvo);
      await confirmarCallback(cb.id, msg.message_id, msg.chat.id, `Aprovado: ${alvo.codigo}`);
    } else if (acao === 'r:') {
      rejeitar(alvo);
      await confirmarCallback(cb.id, msg.message_id, msg.chat.id, `Rejeitado: ${alvo.codigo}`);
    }
    processados++;
  }
  await salvarPending(pending);
  return { offset, processados };
}

async function main() {
  if (tem('--list')) {
    const pending = await carregarPending();
    const aguardando = pending.candidatos.filter((c) => c.status === 'aguardando');
    if (aguardando.length === 0) console.log('nada aguardando');
    for (const c of aguardando) {
      console.log(`${c.id}  [${c.confianca}] ${c.recompensa ?? '(sem recompensa)'} — ${c.fonteRotulo}`);
    }
    return;
  }

  const aId = valor('--approve');
  const rId = valor('--reject');
  if (aId || rId) {
    const pending = await carregarPending();
    const alvo = pending.candidatos.find((c) => c.id === (aId ?? rId));
    if (!alvo) {
      console.error(`candidato não encontrado: ${aId ?? rId} (use --list)`);
      process.exit(1);
    }
    if (aId) await aprovar(alvo, valor('--recompensa'));
    else rejeitar(alvo);
    await salvarPending(pending);
    return;
  }

  if (!telegramDisponivel()) {
    console.error('Configure TELEGRAM_BOT_TOKEN e TELEGRAM_APPROVAL_CHAT_ID, ou use --list/--approve/--reject.');
    process.exit(1);
  }

  // O offset fica em memória: em restart, callbacks já processados voltam mas
  // são ignorados porque o candidato não está mais 'aguardando'.
  let offset = 0;
  if (tem('--once')) {
    const { processados } = await processarCallbacks(offset);
    console.log(processados === 0 ? 'nenhum callback novo' : `${processados} callback(s) processado(s)`);
    return;
  }

  console.log('aguardando callbacks do Telegram (Ctrl+C para sair)...');
  for (;;) {
    try {
      const res = await processarCallbacks(offset);
      offset = res.offset;
    } catch (erro) {
      console.warn('erro no polling:', erro instanceof Error ? erro.message : erro);
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
