/**
 * Catálogo de jogos monitorados (src/data/games.json).
 * Fonte única do formato de código, das fontes a monitorar e do conteúdo
 * estático (passos de resgate e FAQ) de cada página de jogo.
 */
import raw from '../data/games.json';
import type { Jogo } from './types';

interface GamesDb {
  jogos: Jogo[];
}

const db = raw as unknown as GamesDb;

export const jogos: readonly Jogo[] = db.jogos;

const porSlug = new Map(jogos.map((j) => [j.slug, j]));

export function obterJogo(slug: string): Jogo | undefined {
  return porSlug.get(slug);
}

/** Regex do formato de código do jogo, ancorado ao token inteiro. */
export function regexFormato(jogo: Jogo): RegExp {
  return new RegExp(`^(?:${jogo.formatoCodigo})$`);
}

/**
 * Valida o catálogo antes do build (rodado pelo seed e pelos testes).
 * Retorna a lista de problemas encontrados — vazio quando está tudo ok.
 */
export function validarJogos(): string[] {
  const erros: string[] = [];
  const slugs = new Set<string>();
  for (const jogo of jogos) {
    if (slugs.has(jogo.slug)) erros.push(`slug duplicado: ${jogo.slug}`);
    slugs.add(jogo.slug);
    if (!/^[a-z0-9-]+$/.test(jogo.slug)) erros.push(`slug inválido: ${jogo.slug}`);
    for (const campo of ['nome', 'editora', 'oficial', 'resgateOficial'] as const) {
      if (!jogo[campo]) erros.push(`${jogo.slug}: campo vazio (${campo})`);
    }
    for (const url of [jogo.oficial, jogo.resgateOficial, ...jogo.fontes.map((f) => f.url)]) {
      try {
        new URL(url);
      } catch {
        erros.push(`${jogo.slug}: URL inválida (${url})`);
      }
    }
    try {
      regexFormato(jogo);
    } catch {
      erros.push(`${jogo.slug}: formatoCodigo inválido (${jogo.formatoCodigo})`);
    }
    if (jogo.passosResgate.length === 0) erros.push(`${jogo.slug}: sem passosResgate`);
    if (jogo.fontes.length === 0) erros.push(`${jogo.slug}: sem fontes`);
    if (jogo.faq.length === 0) erros.push(`${jogo.slug}: sem faq`);
    if (jogo.moedaGratis && jogo.moedaGratis.metodos.length === 0) {
      erros.push(`${jogo.slug}: moedaGratis sem metodos`);
    }
  }
  return erros;
}
