import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReddit, parseRss } from './sources';

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
