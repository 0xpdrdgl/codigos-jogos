import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReddit, parseRss, parseHtml, parseTelegram, extrairTextoPost } from './sources';

test('parseReddit extrai título, texto e permalink dos posts', () => {
  const json = JSON.stringify({
    data: {
      children: [
        { data: { id: 'abc1', title: 'New code!', selftext: 'code LA54C77THS99', permalink: '/r/Genshin_Impact/comments/abc1/x/' } },
        { data: { id: 'abc2', title: 'Patch notes', permalink: '/r/Genshin_Impact/comments/abc2/y/' } },
      ],
    },
  });
  const itens = parseReddit(json);
  assert.equal(itens.length, 2);
  assert.equal(itens[0].itemId, 'abc1');
  assert.equal(itens[0].titulo, 'New code!');
  assert.ok(itens[0].url.startsWith('https://www.reddit.com/'));
  assert.equal(itens[1].texto, '');
});

test('parseReddit tolera JSON quebrado', () => {
  assert.deepEqual(parseReddit('not json'), []);
  assert.deepEqual(parseReddit('{"data":{}}'), []);
});

test('parseRss extrai itens com título, descrição e link', () => {
  const rss = `<?xml version="1.0"?>
  <rss version="2.0"><channel>
    <item><title>Code drop</title><link>https://ex.com/a</link><guid>g1</guid><description><![CDATA[Use code <b>LA54C77THS99</b>]]></description></item>
    <item><title>News</title><link>https://ex.com/b</link><guid>g2</guid></item>
  </channel></rss>`;
  const itens = parseRss(rss);
  assert.equal(itens.length, 2);
  assert.equal(itens[0].itemId, 'g1');
  assert.equal(itens[0].url, 'https://ex.com/a');
  assert.ok(itens[0].texto.includes('LA54C77THS99'));
});

test('parseRss decodifica entidades e CDATA', () => {
  const rss = `<rss><channel><item><title>A &amp; B</title><link>https://ex.com</link></item></channel></rss>`;
  assert.equal(parseRss(rss)[0].titulo, 'A & B');
});

test('parseHtml separa ativos de expirados e estabiliza o itemId', () => {
  const fonte = { tipo: 'html' as const, url: 'https://wiki.ex.com/codes', rotulo: 'wiki' };
  const html1 = '<html><body><table><tr><td>code LA54C77THS99 active</td></tr></table><h2>Expired codes</h2><p>OLD1CODE12</p></body></html>';
  const itens1 = parseHtml(html1, fonte);
  assert.equal(itens1.length, 2);
  const [ativo, morto] = itens1;
  assert.ok(ativo.texto.includes('LA54C77THS99'));
  assert.ok(!ativo.texto.includes('OLD1CODE12'));
  assert.ok(morto.expirado);
  assert.ok(morto.texto.includes('OLD1CODE12'));
  assert.equal(parseHtml(html1, fonte)[0].itemId, ativo.itemId); // mesmo conteúdo = mesmo itemId
  const item3 = parseHtml(html1.replace('LA54C77THS99', 'NEWINCOME1234'), fonte)[0];
  assert.notEqual(ativo.itemId, item3.itemId); // conteúdo novo = item novo
});

test('parseHtml sem seção de expirados devolve item único', () => {
  const fonte = { tipo: 'html' as const, url: 'https://wiki.ex.com/codes', rotulo: 'wiki' };
  const itens = parseHtml('<html><body><p>code LA54C77THS99 active</p></body></html>', fonte);
  assert.equal(itens.length, 1);
  assert.ok(!itens[0].expirado);
});

test('parseTelegram extrai mensagens do preview público', () => {
  const fonte = { tipo: 'telegram' as const, url: 'https://t.me/s/canal', rotulo: 'Telegram @canal' };
  const html = `<main>
    <div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="canal/10">
      <div class="tgme_widget_message_text js-message_text" dir="auto">CODE : LA54C77THS99<br>resgate já</div>
    </div>
    <div class="tgme_widget_message js-widget_message" data-post="canal/11">
      <div class="tgme_widget_message_text js-message_text" dir="auto"></div>
    </div>
  </main>`;
  const itens = parseTelegram(html, fonte);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].itemId, 'canal/10');
  assert.equal(itens[0].url, 'https://t.me/canal/10');
  assert.ok(itens[0].texto.includes('LA54C77THS99'));
});

test('extrairTextoPost lê o delta Quill do structured_content', () => {
  const post = JSON.stringify({
    data: {
      post: {
        post: {
          content: '<p>ignored</p>',
          structured_content: JSON.stringify([
            { insert: { image: 'https://x/y.png' } },
            { insert: 'Use the redemption code LA54C77THS99 before Friday' },
          ]),
        },
      },
    },
  });
  const texto = extrairTextoPost(post);
  assert.ok(texto.includes('LA54C77THS99'));
  assert.ok(!texto.includes('y.png'));
});

test('extrairTextoPost cai no HTML quando não há delta', () => {
  const post = JSON.stringify({
    data: { post: { post: { content: '<p>Redeem <b>LA54C77THS99</b> now</p>' } } },
  });
  assert.ok(extrairTextoPost(post).includes('LA54C77THS99'));
  assert.equal(extrairTextoPost('{}'), '');
});
