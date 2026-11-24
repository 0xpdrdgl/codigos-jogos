import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jogos, obterJogo, validarJogos, regexFormato } from './games';
import { codigos, doJogo, ativosPorJogo, atualizadoEm, validarCodigos } from './codes';

test('catálogo de jogos passa na validação do seed', () => {
  assert.deepEqual(validarJogos(), []);
});

test('base de códigos passa na validação do seed', () => {
  const erros = validarCodigos((slug) => {
    const jogo = obterJogo(slug);
    return jogo ? regexFormato(jogo) : undefined;
  });
  assert.deepEqual(erros, []);
});

test('todo jogo tem slug, formato compilável e ao menos uma fonte', () => {
  for (const jogo of jogos) {
    assert.ok(jogo.slug.length > 0);
    assert.ok(regexFormato(jogo) instanceof RegExp);
    assert.ok(jogo.fontes.length > 0, `${jogo.slug} sem fonte`);
    assert.ok(jogo.passosResgate.length > 0, `${jogo.slug} sem passos`);
    assert.ok(jogo.resgateOficial.startsWith('https://'), `${jogo.slug} resgate não-oficial`);
  }
});

test('doJogo separa ativos e expirados por slug', () => {
  const { ativos, expirados } = doJogo('jogo-inexistente');
  assert.equal(ativos.length, 0);
  assert.equal(expirados.length, 0);
  for (const c of codigos) {
    const { ativos: a, expirados: e } = doJogo(c.jogo);
    const alvo = c.status === 'ativo' ? a : e;
    assert.ok(alvo.some((x) => x.codigo === c.codigo), `${c.codigo} não apareceu em doJogo`);
  }
});

test('ativosPorJogo conta só status ativo', () => {
  const mapa = ativosPorJogo();
  let esperado = 0;
  for (const c of codigos) if (c.status === 'ativo') esperado++;
  const total = [...mapa.values()].reduce((s, n) => s + n, 0);
  assert.equal(total, esperado);
});

test('atualizadoEm retorna a data mais recente da base', () => {
  const site = atualizadoEm();
  for (const c of codigos) {
    assert.ok(!site || c.adicionadoEm <= site);
    assert.ok(!site || c.ultimaVerificacao <= site);
  }
  if (codigos.length > 0) {
    const doPrimeiro = atualizadoEm(codigos[0].jogo);
    assert.ok(doPrimeiro);
    assert.ok(doPrimeiro <= (site ?? ''));
  }
});
