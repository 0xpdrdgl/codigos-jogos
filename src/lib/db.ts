/**
 * Leitura e escrita dos arquivos de dados em disco.
 * Usado só pelos scripts (coleta, aprovação, publicação) — as páginas Astro
 * consomem o JSON via import estático em lib/codes.ts e lib/games.ts.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Codigo, PendingDb } from './types';

const DATA = path.join(process.cwd(), 'src', 'data');

const CODES = path.join(DATA, 'codes.json');
const PENDING = path.join(DATA, 'pending.json');

async function lerJson<T>(arquivo: string, padrao: T): Promise<T> {
  try {
    return JSON.parse(await readFile(arquivo, 'utf-8')) as T;
  } catch {
    return padrao;
  }
}

async function escreverJson(arquivo: string, valor: unknown): Promise<void> {
  await writeFile(arquivo, `${JSON.stringify(valor, null, 2)}\n`, 'utf-8');
}

export async function carregarCodigos(): Promise<Codigo[]> {
  const db = await lerJson<{ codigos: Codigo[] }>(CODES, { codigos: [] });
  return db.codigos;
}

export async function salvarCodigos(codigos: Codigo[]): Promise<void> {
  await escreverJson(CODES, { codigos });
}

export async function carregarPending(): Promise<PendingDb> {
  return lerJson<PendingDb>(PENDING, { seen: [], candidatos: [] });
}

export async function salvarPending(db: PendingDb): Promise<void> {
  // O seen cresce sem parar; manter só os mais recentes é suficiente para dedup.
  if (db.seen.length > 20_000) db.seen = db.seen.slice(-10_000);
  await escreverJson(PENDING, db);
}
