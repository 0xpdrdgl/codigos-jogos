/**
 * Coletores de fontes. Cada fonte vira uma lista uniforme de itens
 * (título + texto + link) para a detecção processar.
 *
 * Tipos: 'reddit' (JSON público .json) e 'rss' (feed XML genérico).
 * Falhas de rede não derrubam a coleta — a fonte vazia só não gera itens.
 */
import type { Fonte } from './types';

export interface ItemFonte {
  /** ID estável do item dentro da fonte (dedup entre execuções). */
  itemId: string;
  titulo: string;
  texto: string;
  url: string;
}

const UA = 'codigos-jogos/0.1 (+https://codigos-jogos.pages.dev)';
const TIMEOUT_MS = 15_000;

export async function coletar(fonte: Fonte): Promise<ItemFonte[]> {
  try {
    const resposta = await fetch(fonte.url, {
      headers: { 'user-agent': UA, accept: fonte.tipo === 'reddit' ? 'application/json' : 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) {
      console.warn(`fonte ${fonte.rotulo}: HTTP ${resposta.status}`);
      return [];
    }
    const corpo = await resposta.text();
    return fonte.tipo === 'reddit' ? parseReddit(corpo) : parseRss(corpo);
  } catch (erro) {
    console.warn(`fonte ${fonte.rotulo}: ${erro instanceof Error ? erro.message : erro}`);
    return [];
  }
}

interface RedditChild {
  data?: {
    id?: string;
    title?: string;
    selftext?: string;
    permalink?: string;
    stickied?: boolean;
  };
}

/** Reddit: lista posts do JSON público (.json / search.json). */
export function parseReddit(json: string): ItemFonte[] {
  let raiz: { data?: { children?: RedditChild[] } };
  try {
    raiz = JSON.parse(json);
  } catch {
    return [];
  }
  const itens: ItemFonte[] = [];
  for (const child of raiz.data?.children ?? []) {
    const post = child.data;
    if (!post?.id || !post.title) continue;
    itens.push({
      itemId: post.id,
      titulo: post.title,
      texto: post.selftext ?? '',
      url: post.permalink ? `https://www.reddit.com${post.permalink}` : '',
    });
  }
  return itens;
}

const decodeXml = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ');

const tag = (bloco: string, nome: string): string => {
  const m = bloco.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`));
  return m ? decodeXml(m[1]).trim() : '';
};

/** RSS/Atom mínimo: título, descrição e link de cada <item>/<entry>. */
export function parseRss(xml: string): ItemFonte[] {
  const itens: ItemFonte[] = [];
  const entradas = xml.match(/<item>[\s\S]*?<\/item>|<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const entrada of entradas) {
    const titulo = tag(entrada, 'title');
    if (!titulo) continue;
    const guid = tag(entrada, 'guid');
    const linkAtom = entrada.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? '';
    const link = tag(entrada, 'link') || linkAtom;
    itens.push({
      itemId: guid || link || titulo,
      titulo,
      texto: tag(entrada, 'description') || tag(entrada, 'summary') || tag(entrada, 'content'),
      url: link,
    });
  }
  return itens;
}
