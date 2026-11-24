/**
 * Camada de leitura da base de códigos (src/data/codes.json).
 * As páginas consomem estes helpers — o JSON bruto nunca é importado direto.
 */
import raw from '../data/codes.json';
import { jogos } from './games';
import type { Codigo, StatusCodigo } from './types';

interface CodesDb {
  codigos: Codigo[];
}

const db = raw as unknown as CodesDb;

export const codigos: readonly Codigo[] = db.codigos;

/** Códigos de um jogo, separados por status e ordenados por recência. */
export function doJogo(slug: string): { ativos: Codigo[]; expirados: Codigo[] } {
  const porData = (a: Codigo, b: Codigo) => b.ultimaVerificacao.localeCompare(a.ultimaVerificacao);
  const ativos = codigos.filter((c) => c.jogo === slug && c.status === 'ativo').sort(porData);
  const expirados = codigos.filter((c) => c.jogo === slug && c.status === 'expirado').sort(porData);
  return { ativos, expirados };
}

/** Contagem de ativos por jogo, para o hub e a home. */
export function ativosPorJogo(): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const c of codigos) {
    if (c.status !== 'ativo') continue;
    mapa.set(c.jogo, (mapa.get(c.jogo) ?? 0) + 1);
  }
  return mapa;
}

/** ISO da última movimentação da base (ou de um jogo) — usado em dateModified. */
export function atualizadoEm(slug?: string): string | undefined {
  const lista = slug ? codigos.filter((c) => c.jogo === slug) : [...codigos];
  let mais = '';
  for (const c of lista) {
    if (c.ultimaVerificacao > mais) mais = c.ultimaVerificacao;
    if (c.adicionadoEm > mais) mais = c.adicionadoEm;
  }
  return mais || undefined;
}

/**
 * Valida a base de códigos antes do build (rodado pelo seed e pelos testes).
 */
export function validarCodigos(regexPorJogo: (slug: string) => RegExp | undefined): string[] {
  const erros: string[] = [];
  const vistos = new Set<string>();
  const slugsConhecidos = new Set(jogos.map((j) => j.slug));
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  const statusValidos: StatusCodigo[] = ['ativo', 'expirado'];
  for (const c of codigos) {
    const chave = `${c.jogo}:${c.codigo}`;
    if (vistos.has(chave)) erros.push(`código duplicado: ${chave}`);
    vistos.add(chave);
    if (!slugsConhecidos.has(c.jogo)) erros.push(`${chave}: jogo desconhecido`);
    if (!statusValidos.includes(c.status)) erros.push(`${chave}: status inválido (${c.status})`);
    if (!iso.test(c.adicionadoEm)) erros.push(`${chave}: adicionadoEm inválido`);
    if (!iso.test(c.ultimaVerificacao)) erros.push(`${chave}: ultimaVerificacao inválida`);
    const re = regexPorJogo(c.jogo);
    if (re && !re.test(c.codigo)) erros.push(`${chave}: fora do formato do jogo`);
    if (c.codigo !== c.codigo.toUpperCase()) erros.push(`${chave}: normalize para CAIXA ALTA`);
  }
  return erros;
}
