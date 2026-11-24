/**
 * Detecção de códigos de resgate em texto livre (posts de Reddit, RSS...).
 *
 * Duas camadas:
 * 1. `textoRelevante` — o item precisa falar de código/resgate;
 * 2. `extrairCodigos` — tokens que casam com o formato do jogo, com
 *    confiança alta quando misturam letra e dígito e média quando são só
 *    letras mas aparecem perto de uma palavra-gatilho (ex.: GENSHINGIFT).
 *
 * A deduplicação e a decisão final ficam com a aprovação humana (Telegram),
 * então aqui vale mais um falso positivo do que um código perdido.
 */

const GATILHOS = [
  /c[oó]dig/i,
  /\bcode(s)?\b/i,
  /redeem/i,
  /resgat/i,
  /promo(code)?\b/i,
  /\bgift\b/i,
  /cupom/i,
  /\bgr[aá]tis\b/i,
  /\bfree\b/i,
  /\bkey\b/i,
];

/** O item tem chance de conter código? (gate barato antes do regex) */
export function textoRelevante(texto: string): boolean {
  return GATILHOS.some((g) => g.test(texto));
}

export interface Extraido {
  codigo: string;
  confianca: 'alta' | 'media';
}

/** Palavras que casam com formatos mas nunca são código (falsos positivos de página de lista). */
const BLOQUEADOS = new Set([
  'REDEEM', 'REDEMPTION', 'CODES', 'CODE', 'UPDATE', 'UPDATES', 'EXPIRED',
  'ACTIVE', 'REWARD', 'REWARDS', 'WORKING', 'LATEST', 'CHECK', 'CLICK',
  'COPY', 'PLEASE', 'DISCORD', 'TWITTER', 'YOUTUBE', 'FOLLOW', 'ROBUX',
  'SPINS', 'COINS', 'GEMS', 'ITEMS', 'BOOSTS', 'STATUS', 'NOTE', 'WIKI',
  'FANDOM', 'EDIT', 'SOURCE', 'HISTORY', 'PAGE', 'GAME', 'VERSION',
  'MAINTENANCE', 'GUIDE', 'PATCH', 'EVENT', 'EVENTS', 'FREE', 'GIFT',
  'GIFTS', 'TODAY', 'HERE', 'LIST', 'SEASON', 'SERVER', 'SERVERS',
  'PLAYERS', 'PLAY', 'NAVIGATION', 'PRIVATE', 'RECENT', 'POSTS', 'POST',
  'RESET', 'NOTE', 'SEA', 'BAG', 'RELL', 'NOVO', 'NOVA', 'ATUALIZADO',
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO',
  'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
]);

const JANELA_CONTEXTO = 90;

export interface OpcoesDeteccao {
  /** Aceita tokens case-mistos (Roblox). Exige gatilho + dígito/underline. */
  permiteMinusculas?: boolean;
  /** Tokens extras a ignorar (ex.: palavras do nome do jogo — "FISCH"). */
  bloqueados?: Set<string>;
}

/**
 * Extrai candidatos a código de um texto, respeitando o formato do jogo.
 * Por padrão só tokens em CAIXA ALTA. Com `permiteMinusculas`, tokens
 * case-mistos precisam de dígito/underline + palavra-gatilho por perto —
 * senão qualquer palavra com inicial maiúscula numa wiki ("Lucky",
 * "Official") viraria "código". Códigos 100% minúsculos ficam de fora.
 */
export function extrairCodigos(
  texto: string,
  formatoCodigo: string,
  opcoes?: OpcoesDeteccao,
): Extraido[] {
  const formato = new RegExp(`^(?:${formatoCodigo})$`);
  const tokenRe = opcoes?.permiteMinusculas ? /\b[A-Za-z0-9_]{4,24}\b/g : /\b[A-Z0-9]{4,20}\b/g;
  const achados = new Map<string, Extraido['confianca']>();
  for (const m of texto.matchAll(tokenRe)) {
    const token = m[0];
    if (!/[A-Z]/.test(token)) continue; // só dígitos/minúsculas não é código
    if (BLOQUEADOS.has(token.toUpperCase()) || opcoes?.bloqueados?.has(token.toUpperCase())) continue;
    if (!formato.test(token)) continue;
    if (/^\d{2}T\d{2}$/.test(token) || /^\d{4}-/.test(token)) continue; // fragmento de data
    const indice = m.index ?? 0;
    const janela = texto.slice(Math.max(0, indice - JANELA_CONTEXTO), indice + JANELA_CONTEXTO);
    const pertoDeGatilho = GATILHOS.some((g) => g.test(janela));
    const todoMaiusculo = token === token.toUpperCase();
    if (todoMaiusculo) {
      if (/\d/.test(token)) {
        achados.set(token, 'alta'); // letra + dígito é assinatura de código
      } else if (pertoDeGatilho) {
        // só letras (ex.: GENSHINGIFT) só conta perto de uma palavra-gatilho
        if (achados.get(token) !== 'alta') achados.set(token, 'media');
      }
    } else if (opcoes?.permiteMinusculas && pertoDeGatilho) {
      // Misto tipo "Sub2Gamer"/"Enyu_is_Pro": exige dígito, ou underline
      // com algum segmento minúsculo (filtra rótulos de wiki em
      // Title_Case_Snake como "Private_Servers"/"Stat_Reset").
      const seg = token.split('_');
      const temSegMinusculo = seg.some((s) => s.length > 0 && s[0] === s[0].toLowerCase());
      const temSegBloqueado = seg.some((s) => BLOQUEADOS.has(s.toUpperCase()) || opcoes?.bloqueados?.has(s.toUpperCase()));
      if (!temSegBloqueado && !/^2F/i.test(token) && (/\d/.test(token) || (token.includes('_') && temSegMinusculo))) {
        if (achados.get(token) !== 'alta') achados.set(token, 'media');
      }
    }
  }
  return [...achados.entries()].map(([codigo, confianca]) => ({ codigo, confianca }));
}

/** Pipeline completo: gate de relevância + extração. */
export function candidatosDe(
  texto: string,
  formatoCodigo: string,
  opcoes?: OpcoesDeteccao,
): Extraido[] {
  if (!textoRelevante(texto)) return [];
  return extrairCodigos(texto, formatoCodigo, opcoes);
}

/** Recorte curto do texto em volta do código, para a mensagem de aprovação. */
export function contextoDoCodigo(texto: string, codigo: string, max = 220): string {
  const i = texto.indexOf(codigo);
  if (i < 0) return texto.slice(0, max);
  const ini = Math.max(0, i - Math.floor((max - codigo.length) / 2));
  return texto.slice(ini, ini + max).replace(/\s+/g, ' ').trim();
}
