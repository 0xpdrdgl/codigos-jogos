/**
 * Portão de validação dos dados antes do build.
 * Falha (exit 1) se games.json ou codes.json tiverem qualquer problema —
 * a base inválida nunca vai para produção.
 */
import { validarJogos, jogos, regexFormato } from '../src/lib/games';
import { validarCodigos, codigos } from '../src/lib/codes';

const erros = [...validarJogos(), ...validarCodigos((slug) => {
  const jogo = jogos.find((j) => j.slug === slug);
  return jogo ? regexFormato(jogo) : undefined;
})];

if (erros.length > 0) {
  console.error('Base de dados inválida:');
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exit(1);
}

console.log(`seed ok: ${jogos.length} jogos monitorados, ${codigos.length} códigos na base`);
