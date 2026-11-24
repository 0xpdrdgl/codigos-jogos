# Códigos Jogos

Site estático com **códigos de resgate de jogos** (Genshin Impact, Honkai: Star
Rail, Zenless Zone Zero, Free Fire) coletados automaticamente das fontes
oficiais e comunidades — programmatic SEO em Astro, com aprovação humana no
Telegram antes de qualquer código ir ao ar. Custo zero de infraestrutura.

## Stack

- **Astro 7** (SSG) — build 100% estático, zero runtime de servidor
- **Tailwind CSS 4** (plugin Vite) — estilização minimalista, tokens em CSS
- **@astrojs/sitemap** — sitemap fatiado (`entryLimit: 1000`)
- **@fontsource-variable/newsreader** — serif editorial self-hosted
- **tsx** — scripts operacionais (coleta, aprovação, publicação, IndexNow)
- **node:test** — testes de unidade e de integridade da base (18 testes)

## O fluxo de um código

```
fontes (Reddit .json, RSS)          ← games.json declara fontes por jogo
    ↓  npm run collect (a cada 30 min via GitHub Actions)
detect.ts (gate por gatilho + regex do formato do jogo)
    ↓  candidato em src/data/pending.json
Telegram (botões ✅/❌) ou CLI (--approve/--reject)
    ↓  npm run approve
src/data/codes.json + post no canal do Telegram
    ↓  npm run publish -- --deploy
push → build no Cloudflare Pages → npm run indexnow (Bing)
```

A deduplicação funciona em três níveis: item de fonte já lido (`seen`),
código já na base e código já pendente de aprovação.

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
npm test           # 18 testes: detecção, parsers de fonte, integridade da base
npm run lint       # ESLint (flat config + typescript-eslint)
npm run typecheck  # astro check
```

A CI (GitHub Actions) roda install, lint, typecheck, test, audit e build a
cada push e pull request.

## Operar a coleta

```bash
npm run collect                        # lê as fontes e abre candidatos
npm run approve -- --list              # lista o que está aguardando
npm run approve -- --approve <id>      # aprova sem Telegram
npm run approve                        # loop esperando os botões do Telegram
npm run publish -- --deploy            # commit + push + deploy + IndexNow
```

Para o bot do Telegram: crie no [@BotFather](https://t.me/BotFather), pegue o
token, descubra seu `chat_id` (mande qualquer mensagem e consulte
`getUpdates`) e preencha `TELEGRAM_BOT_TOKEN` + `TELEGRAM_APPROVAL_CHAT_ID` no
`.env` (local) e nos **secrets do GitHub** (para a workflow `collect.yml`).

## Adicionar um jogo

Edite `src/data/games.json` — sem código novo:

- `formatoCodigo`: regex do formato (valida detecção e base, fonte única)
- `fontes`: endpoints `reddit` (`.json` público) ou `rss`
- `passosResgate`, `faq`, `resgateOficial`: viram a página e o HowTo/FAQ do SEO

O seed valida tudo no build; slug, URLs e formato inválidos derrubam o CI.

## Arquitetura

```
src/
  data/games.json      # jogos, fontes, formato do código, passos e FAQ
  data/codes.json      # base publicada (ativos + expirados) — commitada
  data/pending.json    # fila de aprovação + seen de fontes — commitada
  lib/                 # tipos, detecção, coletores, Telegram, leitura dos dados
  pages/               # / · /codigos/ · /codigos/[jogo]/ · .../como-resgatar/
  components/          # layout, ads CLS-safe, CodeCard, FAQ, breadcrumbs
scripts/
  collect.ts           # varre fontes e abre candidatos (GitHub Actions, 30 min)
  approve.ts           # aprova/rejeita via Telegram ou CLI → codes.json
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
- `/` e `/codigos/` — hubs com contagem de ativos e ItemList

### Monetização (AdSense)

A integração é acionada por variáveis de ambiente — sem elas, o site renderiza
placeholders neutros com altura reservada (zero CLS):

```
PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX   # ID do publisher
PUBLIC_ADSENSE_SLOT_TOP=1234567890               # bloco do topo
PUBLIC_ADSENSE_SLOT_ARTIGO=0987654321            # bloco no meio do artigo
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
`SITE_URL` (SEO), `PUBLIC_ADSENSE_*` (monetização), `TELEGRAM_*` (aprovação e
canal), `LLM_*` (extração da recompensa, opcional).

## Nota legal

O resgate acontece sempre nos sites/apps oficiais das editoras. Este site não
é afiliado a HoYoverse, Garena ou qualquer editora; nomes e marcas pertencem
aos seus detentores.
