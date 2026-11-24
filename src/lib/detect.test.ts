import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoRelevante, extrairCodigos, candidatosDe, contextoDoCodigo } from './detect';

const FORMATO_HOYO = '[A-Z0-9]{12,16}';

test('textoRelevante exige palavra-gatilho', () => {
  assert.equal(textoRelevante('Novo código de resgate disponível'), true);
  assert.equal(textoRelevante('redeem code for primogems'), true);
  assert.equal(textoRelevante('CUPOM de 10 diamantes'), true);
  assert.equal(textoRelevante('atualização 5.3 traz novos personagens'), false);
  assert.equal(textoRelevante(''), false);
});

test('extrai código com letra e dígito em confiança alta', () => {
  const texto = 'New code: LA54C77THS99 redeem before Sunday!';
  const achados = extrairCodigos(texto, FORMATO_HOYO);
  assert.deepEqual(achados, [{ codigo: 'LA54C77THS99', confianca: 'alta' }]);
});

test('token só de letras precisa de gatilho por perto (confianca media)', () => {
  // longe de gatilho: ignorado
  assert.deepEqual(extrairCodigos('TRANSMISSION ended', '[A-Z0-9]{8,16}'), []);
  // perto de gatilho: entra como média
  const achados = extrairCodigos('use the code GENSHINGIFT for free stuff', '[A-Z0-9]{8,16}');
  assert.deepEqual(achados, [{ codigo: 'GENSHINGIFT', confianca: 'media' }]);
});

test('token só de dígitos nunca é código', () => {
  assert.deepEqual(extrairCodigos('code 123456789012 here', FORMATO_HOYO), []);
});

test('respeita o formato do jogo e a caixa alta', () => {
  // 8 chars fora do formato 12-16
  assert.deepEqual(extrairCodigos('code AB12CD34', FORMATO_HOYO), []);
  // minúsculas/misto não é código
  assert.deepEqual(extrairCodigos('code la54c77ths2', FORMATO_HOYO), []);
});

test('não duplica o mesmo código no texto', () => {
  const achados = extrairCodigos('code LA54C77THS99 and again LA54C77THS99', FORMATO_HOYO);
  assert.equal(achados.length, 1);
});

test('candidatosDe aplica o gate de relevância antes de extrair', () => {
  const semGatilho = 'o evento LA54C77THS99 começa semana que vem';
  assert.deepEqual(candidatosDe(semGatilho, FORMATO_HOYO), []);
  const comGatilho = 'redeem code LA54C77THS99 for gems';
  assert.equal(candidatosDe(comGatilho, FORMATO_HOYO).length, 1);
});

test('contextoDoCodigo centra o recorte no código', () => {
  const texto = `${'x'.repeat(200)} code LA54C77THS99 ${'y'.repeat(200)}`;
  const ctx = contextoDoCodigo(texto, 'LA54C77THS99', 100);
  assert.ok(ctx.includes('LA54C77THS99'));
  assert.ok(ctx.length <= 110);
});

test('permiteMinusculas aceita case misto com dígito perto de gatilho', () => {
  const achados = candidatosDe('redeem code Sub2Gamer agora', '[A-Za-z0-9_]{4,24}', { permiteMinusculas: true });
  assert.equal(achados[0].codigo, 'Sub2Gamer');
  assert.equal(achados[0].confianca, 'media');
});

test('permiteMinusculas rejeita palavras comuns e códigos sem contexto', () => {
  const achados = candidatosDe('Lucky Egg Official Roblox NorthernExpedition', '[A-Za-z0-9_]{4,24}', { permiteMinusculas: true });
  assert.equal(achados.length, 0); // sem gatilho por perto, nada entra
});

test('permiteMinusculas exige dígito ou underline para token misto', () => {
  const achados = candidatosDe('use code MerryFischmas and Sub2Gamer', '[A-Za-z0-9_]{4,24}', { permiteMinusculas: true });
  const codigos = achados.map((a) => a.codigo);
  assert.ok(codigos.includes('Sub2Gamer')); // tem dígito
  assert.ok(!codigos.includes('MerryFischmas')); // camelCase sem dígito: fora
});

test('bloqueados remove palavras do nome do jogo', () => {
  const achados = candidatosDe('FISCH code ACTIVE123', '[A-Za-z0-9_]{4,24}', {
    permiteMinusculas: true,
    bloqueados: new Set(['FISCH']),
  });
  const codigos = achados.map((a) => a.codigo);
  assert.ok(!codigos.includes('FISCH'));
  assert.ok(codigos.includes('ACTIVE123'));
});

test('fragmento de data ISO não é código', () => {
  const achados = candidatosDe('code updated 24T17 and REAL9CODE', '[A-Z0-9]{4,20}');
  const codigos = achados.map((a) => a.codigo);
  assert.ok(!codigos.includes('24T17'));
  assert.ok(codigos.includes('REAL9CODE'));
});
