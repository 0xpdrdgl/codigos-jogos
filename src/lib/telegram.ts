/**
 * Integração com a Bot API do Telegram: envia candidatos para aprovação
 * (botões Aprovar/Rejeitar) e publica os aprovados no canal público.
 * Sem TELEGRAM_BOT_TOKEN, tudo vira no-op silencioso (modo manual via CLI).
 */
import type { Candidato, Jogo } from './types';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_APROVACAO = process.env.TELEGRAM_APPROVAL_CHAT_ID;
const CANAL = process.env.TELEGRAM_CHANNEL_ID;

const API = `https://api.telegram.org/bot${TOKEN}`;

export function telegramDisponivel(): boolean {
  return Boolean(TOKEN && CHAT_APROVACAO);
}

async function chamar(metodo: string, corpo: unknown): Promise<unknown | undefined> {
  if (!TOKEN) return undefined;
  try {
    const resposta = await fetch(`${API}/${metodo}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resposta.ok) {
      console.warn(`telegram ${metodo}: HTTP ${resposta.status}`);
      return undefined;
    }
    return resposta.json();
  } catch {
    return undefined;
  }
}

/** Envia o candidato ao chat de aprovação. Retorna o message_id enviado. */
export async function mandarAprovacao(candidato: Candidato, jogo: Jogo): Promise<number | undefined> {
  if (!telegramDisponivel()) return undefined;
  const linhas = [
    `🎮 *${jogo.nome}*`,
    `Código: \`${candidato.codigo}\``,
    candidato.recompensa ? `Recompensa: ${candidato.recompensa}` : undefined,
    `Fonte: ${candidato.fonteRotulo}`,
    `_${candidato.contexto.slice(0, 160)}_`,
  ]
    .filter(Boolean)
    .join('\n');
  const resposta = (await chamar('sendMessage', {
    chat_id: CHAT_APROVACAO,
    text: linhas,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Aprovar', callback_data: `a:${candidato.id}` },
          { text: '❌ Rejeitar', callback_data: `r:${candidato.id}` },
        ],
      ],
    },
  })) as { result?: { message_id?: number } } | undefined;
  return resposta?.result?.message_id;
}

export interface CallbackUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number | string } };
  };
}

/** Busca novas interações (botões apertados) desde o último offset. */
export async function buscarUpdates(offset: number): Promise<CallbackUpdate[]> {
  const resposta = (await chamar('getUpdates', {
    offset,
    timeout: 30,
    allowed_updates: ['callback_query'],
  })) as { result?: CallbackUpdate[] } | undefined;
  return resposta?.result ?? [];
}

/** Confirma o clique (tira o "carregando" do botão) e remove o teclado. */
export async function confirmarCallback(callbackId: string, messageId: number, chatId: number | string, texto: string): Promise<void> {
  await chamar('answerCallbackQuery', { callback_query_id: callbackId, text: texto });
  await chamar('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

/** Publica o código aprovado no canal público (se configurado). */
export async function avisarCanal(jogo: Jogo, codigo: string, recompensa?: string): Promise<void> {
  if (!TOKEN || !CANAL) return;
  await chamar('sendMessage', {
    chat_id: CANAL,
    text: [
      `🎁 *${jogo.nome}* — código novo`,
      `\`${codigo}\``,
      recompensa ? `Recompensa: ${recompensa}` : undefined,
      `Resgate: ${jogo.resgateOficial}`,
    ]
      .filter(Boolean)
      .join('\n'),
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
}
