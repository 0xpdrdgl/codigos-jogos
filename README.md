# Códigos Jogos

Site estático com **códigos de resgate de jogos** (24 jogos: Genshin, Honkai,
ZZZ, Free Fire, Roblox e mais) coletados **100% automaticamente** — sem
aprovação humana. Códigos morrem rápido: demora de aprovação custa mais que
falso positivo, que expira sozinho. Programmatic SEO em Astro, custo zero de
infraestrutura.

## Stack

- **Astro 7** (SSG) — build 100% estático, zero runtime de servidor
- **Tailwind CSS 4** (plugin Vite) — dark HUD/arcade, Chakra Petch + volt
- **@astrojs/sitemap** — sitemap fatiado com `lastmod` real por jogo
- **tsx** — scripts operacionais (coleta, aprovação manual, IndexNow)
- **node:test** — 28 testes de detecção, parsers e integridade da base

## O fluxo de um código (automático)

```
fontes (HoYoLAB API, Telegram t.me/s, wikis, Reddit, RSS)
    ↓  npm run collect (a cada 30 min via GitHub Actions)
detect.ts (gate de gatilho + regex do formato + blocklist)
    ↓  publica DIRETO em src/data/codes.json + post no canal Telegram
re-verificação em cada run (código re-visto renova ultimaVerificacao)
    ↓  sumiu de todas as fontes por 14 dias → expirado automático
commit → push → rebuild no Cloudflare Pages → sitemap lastmod muda
```

- **Dedup em 3 níveis:** item de fonte já lido (`seen`), código na base,
  código já proposto (rejeitados manuais não voltam).
- **Auto-expiração:** 14 dias sem re-verificação, ou código flagrado na
  seção "expirados" de uma wiki.
- **Override manual** continua existindo: `npm run approve -- --reject <id>`
  remove um código ruim e o impede de voltar.

## Setup

```bash
npm install
cp .env.example .env
```

Requisitos: Node 22+ (recomendado 24). O site funciona sem nenhuma variável de
ambiente; as integrações (Telegram, AdSense, LLM) são opt-in.

## Rodar

```bash
npm run dev        # desenvolvimento em http://localhost:4321
npm run build      # valida os dados (seed) + gera o estático em dist/
npm run preview    # serve o build local
```

## Testar

```bash
npm test           # 28 testes: detecção, parsers de fonte, integridade da base
npm run lint       # ESLint (flat config + typescript-eslint)
npm run typecheck  # astro check
```

A CI (GitHub Actions) roda install, lint, typecheck, test, audit e build a
cada push e pull request.

## Operar a coleta

```bash
npm run collect                        # pipeline completo: coleta + publica + expira
npm run approve -- --list              # lista candidatos (auditoria)
npm run approve -- --reject <id>       # remove um código e o bane da base
npm run indexnow                       # avisa o Bing após deploy
```

Telegram é só notificação: com `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID`,
cada código publicado sai no canal público na hora.

## Adicionar um jogo

Edite `src/data/games.json` — sem código novo:

- `formatoCodigo`: regex do formato (valida detecção e base, fonte única)
- `permiteMinusculas`: `true` para códigos case-sensitive (Roblox)
- `fontes`: tipos `hoyolab`, `telegram` (t.me/s), `html` (wiki), `reddit`, `rss`
- `moedaGratis`: opcional — gera a página `/gratis/[jogo]/` (métodos reais)
- `passosResgate`, `faq`, `resgateOficial`: viram a página e o HowTo/FAQ do SEO

O seed valida tudo no build; slug, URLs e formato inválidos derrubam o CI.

## Arquitetura

```
src/
  data/games.json      # 24 jogos, fontes, formato, passos, FAQ, moedaGratis
  data/codes.json      # base publicada (ativos + expirados) — commitada
  data/pending.json    # auditoria + seen de fontes — commitada
  lib/                 # tipos, detecção, coletores (5 tipos), Telegram, dados
  pages/               # / · /codigos/ · /codigos/[jogo]/ · /gratis/[jogo]/
                       # robots.txt · llms.txt · ads.txt (gerados no build)
  components/          # layout HUD, ads CLS-safe, CodeCard, FAQ, breadcrumbs
scripts/
  collect.ts           # coleta + publicação + expiração (GitHub Actions, 30 min)
  approve.ts           # override manual (rejeitar código ruim)
  publish.ts           # commit + push + deploy + IndexNow
  seed-data.ts         # portão de validação dos dados antes do build
  indexnow.ts          # envia o sitemap ao IndexNow pós-deploy
```

### O que cada página entrega (pSEO)

- `/codigos/[jogo]/` — título datado ("Códigos X hoje (24 nov 2026)"), ativos
  com botão copiar, expirados recentes, resumo do resgate, FAQ e JSON-LD
  (FAQPage + BreadcrumbList)
- `/codigos/[jogo]/como-resgatar/` — tutorial com HowTo schema, link oficial
  `nofollow` e formato do código para o usuário reconhecer golpe
- `/gratis/[jogo]/` — métodos reais de moeda grátis (Robux, Diamantes,
  PokéCoins) ranqueados por esforço + bloco anti-golpe ("gerador não existe")
- `/` e `/codigos/` — hubs com contagem de ativos e ItemList
- `/robots.txt`, `/llms.txt`, `/ads.txt` — gerados no build a partir dos dados

### Monetização (AdSense)

A monetização usa só os anúncios automáticos do Google — basta o client no
`<head>`; não há blocos manuais nem slots. `ads.txt` é gerado no build a partir
de `PUBLIC_ADSENSE_CLIENT`.

```
PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX   # ID do publisher
```

Ative no Cloudflare Pages (Settings → Environment variables) ou no `.env`
local e rode `npm run deploy`. A política de privacidade já cobre os cookies
do Google.

## Deploy gratuito — Cloudflare Pages

1. Suba o repositório para o GitHub e conecte em **Workers & Pages → Create
   application → Pages → Connect to Git**.
2. Build: framework `Astro`, comando `npm run build`, saída `dist`.
3. Variáveis: `NODE_VERSION=24`, `SITE_URL=https://SEU-PROJETO.pages.dev`.
4. Alternativa direta: `npm run deploy` com `npx wrangler` autenticado.
5. Pós-deploy: `npm run indexnow` e submeta `sitemap-index.xml` no Search
   Console e no Bing Webmaster Tools.

## Variáveis de ambiente

Todas estão em `.env.example`, com comentário de uma linha cada. Resumo:
`SITE_URL` (SEO), `PUBLIC_ADSENSE_*` (monetização), `TELEGRAM_*` (notificação
do canal), `LLM_*` (extração da recompensa, opcional).

## Nota legal

O resgate acontece sempre nos sites/apps oficiais das editoras. Este site não
é afiliado a HoYoverse, Garena, Roblox Corporation ou qualquer editora; nomes
e marcas pertencem aos seus detentores.
