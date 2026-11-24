/**
 * Formatação de datas pt-BR usada nos títulos e metadados das páginas.
 */

const LONGA: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const CURTA: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** "24 de novembro de 2026" — corpo de texto e descrições. */
export function dataLonga(data: string | Date = new Date()): string {
  return new Date(data).toLocaleDateString('pt-BR', LONGA);
}

/** "24 de nov. de 2026" — títulos de página. */
export function dataCurta(data: string | Date = new Date()): string {
  return new Date(data).toLocaleDateString('pt-BR', CURTA);
}
