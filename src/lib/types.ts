/**
 * Tipos compartilhados entre a base de dados (src/data), os coletores
 * (scripts/) e a renderização do site (src/pages).
 */

export type TipoFonte = 'reddit' | 'rss' | 'html' | 'hoyolab';

export interface Fonte {
  tipo: TipoFonte;
  url: string;
  rotulo: string;
}

export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export interface Jogo {
  id: string;
  nome: string;
  slug: string;
  editora: string;
  /** Página oficial do jogo. */
  oficial: string;
  /** Página oficial de resgate do código. */
  resgateOficial: string;
  /** Verdadeiro quando o resgate também pode ser feito dentro do jogo. */
  resgateInGame: boolean;
  /** Regex do formato do código (fonte única: valida detecção e base). */
  formatoCodigo: string;
  /** Descrição do formato em texto, exibida ao usuário. */
  palavrasFormato: string;
  passosResgate: string[];
  fontes: Fonte[];
  faq: Pergunta[];
  /** Seção "moeda grátis" (Robux, Diamantes...) — opcional por jogo. */
  moedaGratis?: MoedaGratis;
}

export interface MetodoGratis {
  titulo: string;
  descricao: string;
  /** Nível de esforço: 'fácil' | 'médio' | 'difícil'. */
  esforco: 'facil' | 'medio' | 'dificil';
  /** Link externo do método (opcional). */
  link?: string;
}

export interface MoedaGratis {
  /** Nome da moeda como o público busca: "Robux", "Diamantes"... */
  nome: string;
  metodos: MetodoGratis[];
}

export type StatusCodigo = 'ativo' | 'expirado';

export interface Codigo {
  /** Slug do jogo (games.json). */
  jogo: string;
  codigo: string;
  recompensa?: string;
  status: StatusCodigo;
  /** ISO 8601 — quando o código entrou na base. */
  adicionadoEm: string;
  /** ISO 8601 — última vez que o código foi visto/reconfirmado numa fonte. */
  ultimaVerificacao: string;
  /** URL da fonte onde o código foi encontrado. */
  fonte?: string;
}

export type Confianca = 'alta' | 'media';
export type StatusCandidato = 'aguardando' | 'aprovado' | 'rejeitado';

export interface Candidato {
  /** `${slugDoJogo}:${codigo}` — chave de dedup. */
  id: string;
  jogoId: string;
  codigo: string;
  confianca: Confianca;
  recompensa?: string;
  fonteRotulo: string;
  fonteUrl: string;
  /** Trecho do post onde o código apareceu (para aprovação humana). */
  contexto: string;
  criadoEm: string;
  status: StatusCandidato;
  telegramMessageId?: number;
}

export interface PendingDb {
  /** IDs de itens de fonte já processados (dedup entre execuções). */
  seen: string[];
  candidatos: Candidato[];
}
