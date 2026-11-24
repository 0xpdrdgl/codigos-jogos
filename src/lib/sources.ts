/**
 * Coletores de fontes. Cada fonte vira uma lista uniforme de itens
 * (título + texto + link) para a detecção processar.
 *
 * Tipos:
 * - 'reddit'  — JSON público .json (bloqueado em várias redes; mantido para
 *   ambientes onde funciona)
 * - 'rss'     — feed XML genérico
 * - 'html'    — página que lista códigos (ex.: wiki) inteira como um item
 * - 'hoyolab' — API pública do HoYoLAB (getNewsList + getPostFull), a fonte
 *   mais confiável para Genshin/HSR/ZZZ: códigos saem primeiro nos anúncios
 *   oficiais
 * - 'telegram' — preview público de canal (t.me/s/{canal}), sem API e sem
 *   login; útil para jogos sem fonte oficial (ex.: Free Fire)
 *
 * Falhas de rede não derrubam a coleta — a fonte vazia só não gera itens.
 */
import { createHash } from 'node:crypto';
import type { Fonte } from './types';

export interface ItemFonte {
  /** ID estável do item dentro da fonte (dedup entre execuções). */
  itemId: string;
  titulo: string;
  texto: string;
  url: string;
  /**
   * Item extraído da seção de expirados da fonte (wiki listam código morto
   * separado): não gera candidato — serve para expirar o que está na base.
   */
  expirado?: boolean;
}

const UA = 'codigos-jogos/0.1 (+https://codigos-jogos.pages.dev)';
const TIMEOUT_MS = 15_000;

const JINA = 'https://r.jina.ai/';

export async function coletar(fonte: Fonte): Promise<ItemFonte[]> {
  try {
    const resposta = await fetch(fonte.url, {
      headers: { 'user-agent': UA, accept: fonte.tipo === 'reddit' ? 'application/json' : 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (resposta.ok) {
      const corpo = await resposta.text();
      if (fonte.tipo === 'reddit') return parseReddit(corpo);
      if (fonte.tipo === 'rss') return parseRss(corpo);
      if (fonte.tipo === 'hoyolab') return coletarHoyolab(corpo);
      if (fonte.tipo === 'telegram') return parseTelegram(corpo, fonte);
      return parseHtml(corpo, fonte);
    }
    console.warn(`fonte ${fonte.rotulo}: HTTP ${resposta.status} — tentando via jina.ai`);
  } catch (erro) {
    console.warn(`fonte ${fonte.rotulo}: ${erro instanceof Error ? erro.message : erro} — tentando via jina.ai`);
  }

  // Fallback: o leitor-proxy r.jina.ai devolve a página como texto limpo e
  // contorna bloqueios de datacenter (Fandom/Reddit). O resultado é texto —
  // tratado como uma página genérica (mesmo para fontes reddit/rss).
  if (fonte.tipo === 'hoyolab') return [];
  try {
    const viaJina = await fetch(`${JINA}${fonte.url}`, {
      headers: { 'user-agent': UA, accept: 'text/plain' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!viaJina.ok) {
      console.warn(`fonte ${fonte.rotulo} via jina: HTTP ${viaJina.status}`);
      return [];
    }
    return parseHtml(await viaJina.text(), fonte);
  } catch (erro) {
    console.warn(`fonte ${fonte.rotulo} via jina: ${erro instanceof Error ? erro.message : erro}`);
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

const MARCADOR_EXPIRADOS = /expired|expirad[oa]s/i;

/**
 * Página de listagem de códigos: o conteúdo vira até dois itens — o trecho
 * antes da seção de expirados (candidatos) e o trecho depois (evidência de
 * código morto). itemId = hash do texto: página sem novidade não gera item.
 */
export function parseHtml(html: string, fonte: Fonte): ItemFonte[] {
  // Strip script/style/comentários ANTES de decodificar: JS inline e JSON-LD
  // contêm tokens com cara de código (wgPageName, u003C, dateModified...).
  const limpo = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const texto = decodeXml(limpo).replace(/\s+/g, ' ');
  const corte = texto.search(MARCADOR_EXPIRADOS);
  const ativo = corte > 0 ? texto.slice(0, corte) : texto;
  const itemAtivo: ItemFonte = {
    itemId: `${fonte.url}#${createHash('sha1').update(ativo).digest('hex').slice(0, 12)}`,
    titulo: fonte.rotulo,
    texto: ativo,
    url: fonte.url,
  };
  if (corte <= 0) return [itemAtivo];
  const morto = texto.slice(corte);
  const itemMorto: ItemFonte = {
    itemId: `${fonte.url}#exp#${createHash('sha1').update(morto).digest('hex').slice(0, 12)}`,
    titulo: `${fonte.rotulo} (expirados)`,
    texto: morto,
    url: fonte.url,
    expirado: true,
  };
  return [itemAtivo, itemMorto];
}

/**
 * Preview público de canal do Telegram (t.me/s/{canal}): cada mensagem vira
 * um item, com data-post como ID estável. Não usa Bot API nem login.
 */
export function parseTelegram(html: string, fonte: Fonte): ItemFonte[] {
  const itens: ItemFonte[] = [];
  // Split no início de cada div de mensagem: `tgme_widget_message ` ou
  // `tgme_widget_message"` — o sufixo evita casar com `..._message_text`.
  const blocos = html.split(/(?=<div class="tgme_widget_message(?:\s|"))/);
  for (const bloco of blocos) {
    const post = bloco.match(/data-post="([^"]+)"/)?.[1];
    const textoBruto = bloco.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)?.[1];
    if (!post || !textoBruto) continue;
    const texto = decodeXml(textoBruto).replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    itens.push({
      itemId: post,
      titulo: fonte.rotulo,
      texto,
      url: `https://t.me/${post}`,
    });
  }
  return itens;
}

const URL_POST = 'https://bbs-api-os.hoyolab.com/community/post/wapi/getPostFull?post_id=';

interface PostLista {
  post?: { post_id?: string; subject?: string; desc?: string };
}

/** Lista os posts recentes e busca o conteúdo completo de cada um. */
async function coletarHoyolab(jsonLista: string): Promise<ItemFonte[]> {
  let raiz: { data?: { list?: PostLista[] } };
  try {
    raiz = JSON.parse(jsonLista);
  } catch {
    return [];
  }
  const itens: ItemFonte[] = [];
  for (const entrada of raiz.data?.list ?? []) {
    const post = entrada.post;
    if (!post?.post_id || !post.subject) continue;
    const item: ItemFonte = {
      itemId: post.post_id,
      titulo: post.subject,
      texto: post.desc ?? '',
      url: `https://www.hoyolab.com/article/${post.post_id}`,
    };
    try {
      const detalhe = await fetch(`${URL_POST}${post.post_id}`, {
        headers: { 'user-agent': UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (detalhe.ok) item.texto = `${post.desc ?? ''}\n${extrairTextoPost(await detalhe.text())}`;
      await new Promise((r) => setTimeout(r, 60)); // respeita a API pública
    } catch {
      // sem o detalhe, o item ainda entra com título + descrição
    }
    itens.push(item);
  }
  return itens;
}

/**
 * Extrai o texto corrido de um post HoYoLAB: `structured_content` é um delta
 * Quill (texto nos `insert` strings); `content` é o HTML de fallback.
 */
export function extrairTextoPost(jsonPost: string): string {
  try {
    const post = (JSON.parse(jsonPost) as { data?: { post?: { post?: { content?: string; structured_content?: string } } } })
      .data?.post?.post;
    if (!post) return '';
    if (post.structured_content) {
      const delta = JSON.parse(post.structured_content) as { insert?: unknown }[];
      const texto = delta
        .map((op) => (typeof op.insert === 'string' ? op.insert : ' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (texto) return texto;
    }
    return decodeXml(post.content ?? '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

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
