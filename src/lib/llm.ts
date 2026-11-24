/**
 * Enriquecimento opcional dos candidatos por LLM: extrai a recompensa e a
 * validade do contexto do post. Funciona com qualquer API compatível com
 * OpenAI (OpenRouter free tier, Gemini, etc.). Sem LLM_API_KEY configurada,
 * retorna vazio e a aprovação humana cobre a lacuna.
 */
import type { Jogo } from './types';

export interface Enriquecimento {
  recompensa?: string;
  validade?: string;
}

const BASE = process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1';
const KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL ?? 'meta-llama/llama-3.1-8b-instruct:free';

export function llmDisponivel(): boolean {
  return Boolean(KEY);
}

/**
 * Para cada código candidato, tenta extrair do contexto a recompensa e a
 * data de validade. Erros de rede/parse retornam vazio (degradação silenciosa).
 */
export async function enriquecer(
  jogo: Jogo,
  contexto: string,
  codigos: string[],
): Promise<Map<string, Enriquecimento>> {
  const mapa = new Map<string, Enriquecimento>();
  if (!KEY || codigos.length === 0) return mapa;
  try {
    const resposta = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'Você extrai dados de posts sobre códigos de resgate de jogos. Responda APENAS com JSON válido no formato {"CODIGO": {"recompensa": "...", "validade": "..."}}, usando null quando o post não disser.',
          },
          {
            role: 'user',
            content: `Jogo: ${jogo.nome}\nCódigos: ${codigos.join(', ')}\nPost: ${contexto.slice(0, 2000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resposta.ok) return mapa;
    const dados = (await resposta.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const texto = dados.choices?.[0]?.message?.content ?? '';
    const json = texto.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return mapa;
    const extraido = JSON.parse(json) as Record<string, Enriquecimento | null>;
    for (const codigo of codigos) {
      const e = extraido[codigo];
      if (e) mapa.set(codigo, { recompensa: e.recompensa ?? undefined, validade: e.validade ?? undefined });
    }
  } catch {
    // LLM é enfeite: falha nunca bloqueia a coleta.
  }
  return mapa;
}
