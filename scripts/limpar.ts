/**
 * Limpeza única: re-aplica as regras atuais de detecção sobre codes.json.
 * Cada código é re-extraído num contexto com gatilho — se a regra nova não
 * o pegaria, ele sai da base (falso positivo da versão anterior).
 */
import { jogos } from '../src/lib/games';
import { extrairCodigos } from '../src/lib/detect';
import { carregarCodigos, salvarCodigos } from '../src/lib/db';

const codigos = await carregarCodigos();
const limpos = codigos.filter((c) => {
  const jogo = jogos.find((j) => j.slug === c.jogo);
  if (!jogo) return false;
  const extraidos = extrairCodigos(`code ${c.codigo}`, jogo.formatoCodigo, {
    permiteMinusculas: jogo.permiteMinusculas,
    bloqueados: new Set(jogo.nome.toUpperCase().split(/[\s:—-]+/)),
  });
  return extraidos.some((e) => e.codigo === c.codigo);
});

const removidos = codigos.filter((c) => !limpos.includes(c));
for (const c of removidos) console.log(`  - ${c.codigo} (${c.jogo})`);
console.log(`mantidos: ${limpos.length} | removidos: ${removidos.length}`);
await salvarCodigos(limpos);
