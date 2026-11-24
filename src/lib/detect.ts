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

const JANELA_CONTEXTO = 90;

/**
 * Extrai candidatos a código de um texto, respeitando o formato do jogo.
 * Tokens precisam estar em CAIXA ALTA no texto original.
 */
export function extrairCodigos(texto: string, formatoCodigo: string): Extraido[] {
  const formato = new RegExp(`^(?:${formatoCodigo})$`);
  const achados = new Map<string, Extraido['confianca']>();
  for (const m of texto.matchAll(/\b[A-Z0-9]{4,20}\b/g)) {
    const token = m[0];
    if (token !== token.toUpperCase()) continue;
    if (!formato.test(token)) continue;
    if (!/[A-Z]/.test(token)) continue; // só dígitos não é código
    const indice = m.index ?? 0;
    const janela = texto.slice(Math.max(0, indice - JANELA_CONTEXTO), indice + JANELA_CONTEXTO);
    const pertoDeGatilho = GATILHOS.some((g) => g.test(janela));
    if (/\d/.test(token)) {
      achados.set(token, 'alta'); // letra + dígito é assinatura de código
    } else if (pertoDeGatilho) {
      // só letras (ex.: GENSHINGIFT) só conta perto de uma palavra-gatilho
      if (achados.get(token) !== 'alta') achados.set(token, 'media');
    }
  }
  return [...achados.entries()].map(([codigo, confianca]) => ({ codigo, confianca }));
}

/** Pipeline completo: gate de relevância + extração. */
export function candidatosDe(texto: string, formatoCodigo: string): Extraido[] {
  if (!textoRelevante(texto)) return [];
  return extrairCodigos(texto, formatoCodigo);
}

/** Recorte curto do texto em volta do código, para a mensagem de aprovação. */
export function contextoDoCodigo(texto: string, codigo: string, max = 220): string {
  const i = texto.indexOf(codigo);
  if (i < 0) return texto.slice(0, max);
  const ini = Math.max(0, i - Math.floor((max - codigo.length) / 2));
  return texto.slice(ini, ini + max).replace(/\s+/g, ' ').trim();
}
