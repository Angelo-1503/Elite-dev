# Arremate · Casa de Leilões online

Teste técnico **Elite Dev · Verzel**. Plataforma de leilões de obras de arte com lances ao vivo, carteira simulada, comprovante de arremate compartilhável e **histórico de lances auditável e à prova de adulteração**.

- **Aplicação (deploy):** _preencher com a URL da Vercel_
- **API (deploy):** _preencher com a URL do Render_
- **Itens leiloados:** acervo público do [Art Institute of Chicago](https://api.artic.edu/docs/) (API aberta, sem chave)

---

## Sumário

1. [O que dá para fazer](#o-que-dá-para-fazer)
2. [Stack](#stack)
3. [Estrutura do repositório](#estrutura-do-repositório)
4. [Como rodar](#como-rodar)
5. [Dados de teste](#dados-de-teste)
6. [Roteiro sugerido para avaliar](#roteiro-sugerido-para-avaliar)
7. [Regras de negócio](#regras-de-negócio)
8. [Decisões técnicas](#decisões-técnicas)
9. [Endpoints da API](#endpoints-da-api)
10. [Testes](#testes)
11. [Deploy](#deploy)
12. [Comportamentos que podem parecer inesperados](#comportamentos-que-podem-parecer-inesperados)
13. [Uso de IA](#uso-de-ia)

---

## O que dá para fazer

| Tela | Quem usa | O que faz |
| --- | --- | --- |
| **Vitrine** (`/`) | Todos | Abas *Ao vivo*, *Agendados* e *Encerrados* (cancelados não aparecem), busca por obra ou artista, filtro de preço, ordenação e paginação. Atualiza sozinha quando há lances ou encerramentos. |
| **Sala do lote** (`/lotes/:id`) | Todos (lance só para licitante) | Lance atual, histórico, contagem regressiva sincronizada com o servidor, indicador **"você está ganhando" / "você foi superado"**, sua posição na disputa e aviso de prorrogação. Tudo em tempo real (WebSocket). |
| **Carteira** (`/carteira`) | Licitante | Saldo total, comprometido e disponível, depósito simulado, lista do que está comprometido e extrato. |
| **Meus arremates** (`/meus-lances`) | Licitante | Lotes em disputa, arrematados (com comprovante e botão de compartilhar) e encerrados. |
| **Painel do leiloeiro** (`/painel`) | Leiloeiro | Total recebido, resultado de cada lote (arrematado e por quanto, sem lances, cancelado) e cancelamento. |
| **Novo lote** (`/painel/novo-lote`) | Leiloeiro | Busca no catálogo do Art Institute, escolha da obra, lance inicial, incremento mínimo, início (agora ou agendado) e fim. |
| **Auditoria** (`/auditoria/:id`) | Qualquer pessoa, sem login | Verifica a cadeia de lances **no próprio navegador** e mostra também o relatório do servidor, apontando qual lance foi alterado, se algum foi. |
| **Comprovante** (`/comprovantes/:token`) | Qualquer pessoa com o link | Comprovante assinado digitalmente, verificado no navegador, sem dados pessoais. Dá para compartilhar e imprimir. |

Opcionais implementados: busca e filtro de lotes, cancelamento com estorno automático, Docker Compose, testes automatizados e dark mode.

## Stack

| Camada | Tecnologias |
| --- | --- |
| Front-end (`verzel-interface`) | React 19, Vite, TypeScript, Tailwind CSS 4, React Router, Axios, Socket.IO client, react-hot-toast, lucide-react |
| Back-end (`verzel-api`) | Node.js, Express 5, TypeScript, Prisma 6, Socket.IO, JWT + bcrypt, express-rate-limit, helmet |
| Banco | PostgreSQL 17 |
| Testes | Vitest (back-end) |
| Qualidade | Biome (formatação e lint), ESLint no front |

## Estrutura do repositório

```
Elite-dev/
├── docker-compose.yml        # db + api + web
├── render.yaml               # blueprint do deploy da API + Postgres no Render
├── verzel-api/
│   ├── prisma/               # schema e migrations
│   ├── scripts/local-db.mts  # Postgres embutido para desenvolver sem Docker
│   ├── src/
│   │   ├── config/           # env e Prisma client
│   │   ├── controllers/      # camada HTTP
│   │   ├── routes/           # rotas + router.ts central
│   │   ├── middlewares/      # auth, papéis, rate limit
│   │   ├── services/         # regras: lances, liquidação, carteira, auditoria, API externa, tempo real
│   │   ├── utils/            # funções puras: regras de lance, cadeia de hashes, verificador, pseudônimo
│   │   ├── jobs/             # job de liquidação
│   │   └── scripts/          # seed e geração de segredos
│   └── tests/                # testes unitários (Vitest)
└── verzel-interface/
    └── src/
        ├── pages/            # telas
        ├── components/       # ui/, layout/, lots/
        ├── context/          # Auth, Theme, Wallet (+ notificações em tempo real)
        ├── hooks/            # useFetch, useNow, useLotTiming
        ├── lib/              # formatação, relógio do servidor, verificação criptográfica
        └── services/         # axios e socket
```

## Como rodar

Pré-requisito: **Node.js 20+** (ou Docker).

### Opção 1: Docker Compose (tudo de uma vez)

```bash
docker compose up --build
```

- Front: http://localhost:8080
- API: http://localhost:3000/api

As migrations e o seed rodam automaticamente na subida da API.

### Opção 2: localmente, sem Docker

**1. API**

```bash
cd verzel-api
npm install
cp .env.example .env      # depois preencha os segredos (próximo passo)
npm run keygen            # imprime JWT_SECRET, ALIAS_SECRET e SIGNING_KEY_SEED: cole no .env
```

Banco: use um Postgres seu (ajuste `DATABASE_URL` no `.env`) **ou** suba um Postgres 17 embutido, que o npm baixa sozinho, sem instalar nada:

```bash
npm run db:local          # deixe este terminal aberto (porta 5433)
```

Em outro terminal:

```bash
npm run db:migrate        # cria as tabelas
npm run db:seed           # dados de teste
npm run dev               # API em http://localhost:3000
```

**2. Front**

```bash
cd verzel-interface
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:3000/api
npm run dev               # http://localhost:5173
```

### Variáveis de ambiente

**`verzel-api/.env`**

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | URL do Postgres. Em bancos que exigem SSL, adicione `?sslmode=require`. |
| `PORT` | Porta da API (padrão 3000). |
| `CORS_ORIGIN` | Origens liberadas, separadas por vírgula (ex.: a URL da Vercel). |
| `JWT_SECRET` | Segredo dos tokens de login. |
| `ALIAS_SECRET` | Segredo usado para gerar os pseudônimos dos licitantes. |
| `SIGNING_KEY_SEED` | Semente da chave Ed25519 que assina a cadeia de lances (64 caracteres hex ou qualquer texto longo). |
| `AIC_USER_AGENT` | Identificação enviada à API do Art Institute. |

Em desenvolvimento os segredos têm valores padrão (com aviso no console); com `NODE_ENV=production` eles são obrigatórios.

**`verzel-interface/.env`**: `VITE_API_URL` (URL da API, terminando em `/api`).

## Dados de teste

O seed cria (senha de todos: **`senha123`**):

| Conta | Papel | Saldo inicial |
| --- | --- | --- |
| `leiloeiro@verzel.com` | Leiloeiro | — |
| `ana@verzel.com` | Licitante | R$ 150.000 |
| `bruno@verzel.com` | Licitante | R$ 150.000 |

E lotes em todas as situações (as datas são relativas ao momento do seed):

| Lote | Situação |
| --- | --- |
| Water Lilies (Monet) | Ao vivo por 20 dias, **com lances** da Ana e do Bruno |
| The Bedroom (Van Gogh) | Ao vivo por 10 dias, com 1 lance |
| Paris Street; Rainy Day (Caillebotte) | Ao vivo por 7 dias, sem lances |
| Arrival of the Normandy Train (Monet) | Ao vivo, **termina 30 min após o seed** (bom para ver anti-sniping e encerramento) |
| A Sunday on La Grande Jatte (Seurat) | Agendado |
| Stacks of Wheat (Monet) | Encerrado e arrematado pelo Bruno, **com comprovante** |
| Self-Portrait (Van Gogh) | Encerrado sem lances |
| Two Sisters (Renoir) | Cancelado (não aparece na vitrine) |

A tela de login tem botões para entrar direto com cada conta de demonstração.

Para recriar tudo com datas novas: `npm run db:seed -- --force` (na pasta `verzel-api`).

## Roteiro sugerido para avaliar

1. Abra a vitrine sem login e entre em **Water Lilies**.
2. Em uma janela, entre como **Ana**; em outra (aba anônima), como **Bruno**. Abra o mesmo lote nas duas.
3. Dê lances alternados: o lance atual, o histórico e o indicador "ganhando/superado" mudam na hora nas duas janelas, e quem foi superado recebe um aviso.
4. Tente lances inválidos (abaixo do mínimo, cobrir o próprio lance, mais do que o saldo) e veja a mensagem de cada recusa.
5. Veja a **Carteira**: o valor do lote que você lidera aparece como comprometido e volta ao disponível assim que alguém cobre.
6. Clique em **Auditar** na sala. Para testar a detecção de adulteração, altere um lance direto no banco (ex.: `UPDATE bids SET amount_cents = amount_cents + 100 WHERE seq = 1;`) e clique em "Verificar de novo".
7. Como **leiloeiro**, crie um lote curto (botão "15 min"), dê lances nos 2 minutos finais para ver a prorrogação, e acompanhe o encerramento, a liquidação e o comprovante em **Meus arremates**.

## Regras de negócio

| Regra | Implementação |
| --- | --- |
| Lances só em lotes ao vivo | `startsAt <= agora < endsAt` e status `ACTIVE` |
| Primeiro lance ≥ lance inicial; seguintes ≥ atual + incremento | `utils/bidRules.ts` (`minimumNextBid`) |
| Líder não cobre o próprio lance | Recusa com `ALREADY_WINNING` |
| Lance só se couber no saldo disponível | disponível = total − soma dos lances que o usuário lidera em **outros** lotes ativos |
| Superado → valor volta na hora | O comprometido é **derivado** de `lots.leader_id` (não fica guardado), então muda na mesma transação do lance |
| Anti-sniping | Lance aceito com ≤ 2 min restantes faz `endsAt += 2 min` |
| Liquidação | Job a cada 2 s: debita o vencedor, credita o leiloeiro, registra no extrato e emite o comprovante assinado. Sem lances, fecha sem vencedor |
| Cancelamento | Leiloeiro cancela lotes não encerrados. Se já houver lances, o valor comprometido do líder é liberado automaticamente (estorno) e os licitantes são avisados |
| Papéis | Leiloeiro cria/gerencia os próprios lotes e não dá lance; licitante deposita, dá lances e arremata |

Mensagens de recusa (código → texto exibido ao usuário): `BELOW_MINIMUM` (informa o valor mínimo), `INSUFFICIENT_FUNDS` (informa o disponível), `ALREADY_WINNING`, `LOT_NOT_STARTED`, `LOT_ENDED`, `LOT_CANCELLED`, `NOT_A_BIDDER`, `INVALID_AMOUNT`.

## Decisões técnicas

### Histórico à prova de adulteração

A técnica escolhida combina **cadeia de hashes + assinaturas digitais Ed25519 + verificação independente no navegador**.

1. **Gênesis.** Ao criar o lote, os parâmetros (lote, obra, leiloeiro, lance inicial, incremento, início, fim original) são serializados e passam por SHA-256. Esse é o primeiro elo.
2. **Encadeamento.** Cada lance guarda `hash = SHA-256(lote, nº do lance, pseudônimo, valor, horário, hash do lance anterior)`. Alterar um lance muda o hash dele e quebra o elo com todos os seguintes; remover ou inserir no meio quebra a numeração e o encadeamento.
3. **Assinatura.** Um atacante com acesso ao banco poderia recalcular todos os hashes. Por isso cada lance é **assinado com a chave privada Ed25519 da casa**, que fica só na variável de ambiente do servidor, nunca no banco.
4. **Selo do lote.** A cada mudança de estado, o servidor assina um "selo" com a quantidade de lances, o último hash, o prazo atual, o status e o resultado (vencedor e preço). Isso detecta **remoção de lances do final** (que não quebraria o encadeamento), prorrogação indevida do prazo e alteração do resultado.
5. **Verificação pública.** A rota `/api/audit/:id` devolve os dados crus e a chave pública. A página de auditoria **recalcula tudo no navegador** com a Web Crypto API (SHA-256 e Ed25519), sem depender do veredito do servidor. O servidor faz uma checagem extra que só ele pode fazer: confere se o pseudônimo de cada lance corresponde ao licitante gravado (detecta troca de `bidder_id`).
6. **Comprovante.** É um payload canônico assinado que inclui o último hash da cadeia, então fica amarrado ao histórico daquele lote.

Os payloads são serializados com `JSON.stringify` de arrays em ordem fixa, sem ambiguidade de separadores, e o front reproduz exatamente o mesmo formato.

Testado (automatizado e manualmente) contra: alteração de valor, alteração com hash recalculado, remoção no meio e no fim, inserção assinada com outra chave, troca do licitante, mudança dos parâmetros do lote, prorrogação do prazo e adulteração do resultado.

**Limitação conhecida.** Quem tiver acesso ao banco **e** tiver guardado uma cópia antiga do estado do lote poderia restaurar aquele estado inteiro (lote + lances), porque ele já foi assinado um dia. Para mitigar isso em produção, a cabeça da cadeia poderia ser publicada periodicamente em um meio externo e imutável (log público, blockchain, e-mail ao vencedor). O comprovante e as notificações já distribuem parte dessa informação aos participantes.

### Concorrência

Cada lance roda em uma transação que trava a linha do lote (`SELECT ... FOR UPDATE`) e depois a do licitante. Lances simultâneos no mesmo lote são processados em fila, e o mesmo licitante não compromete o mesmo saldo em dois lotes ao mesmo tempo. A ordem de trava é sempre lote → usuário, o que evita deadlock. Em teste com 8 lances simultâneos do mesmo valor, exatamente 1 é aceito.

### Saldo comprometido derivado

Em vez de guardar um campo "comprometido" e mantê-lo em sincronia, ele é calculado como a soma de `current_bid_cents` dos lotes ativos em que o usuário é o líder. Quando alguém cobre o lance, o líder do lote muda e o valor volta ao disponível automaticamente, na mesma transação. O mesmo vale para o cancelamento (estorno). O saldo total só muda em depósito, arremate e venda, sempre com registro no extrato (`ledger_entries`).

### Resiliência da API externa

- **Snapshot.** Ao criar um lote, os metadados e a **imagem** da obra são copiados para o banco. Vitrine, sala, auditoria e comprovante nunca chamam a API externa, então continuam funcionando se ela cair.
- **Busca do leiloeiro.** É a única função que depende da API. Tem timeout de 6 s, cache em memória com TTL e **circuit breaker**: após 3 falhas seguidas, para de chamar por 30 s e responde com o cache (avisando que está desatualizado) ou com uma mensagem amigável (503).
- **Seed.** Se a API estiver fora durante o seed, ele usa metadados de reserva embutidos.

### Privacidade

Licitantes aparecem como **pseudônimos por lote** (`Licitante 3FA2C1`), gerados por HMAC de (lote, usuário) com um segredo do servidor. O pseudônimo é estável dentro do lote, diferente em cada lote (não dá para rastrear a pessoa entre leilões) e não pode ser revertido. Nenhuma rota pública devolve nome, e-mail ou id de licitante. O próprio usuário vê "Você" no lugar do pseudônimo.

### Tempo real

Socket.IO com um canal por lote (`lot:<id>`) para lances, prorrogação, encerramento e cancelamento, e um canal por usuário (`user:<id>`) para avisos pessoais (superado, arrematou, lote cancelado, carteira atualizada). A contagem regressiva usa o relógio do servidor (o front calcula a diferença a partir de cada resposta), então um relógio errado no computador do usuário não afeta o encerramento.

## Endpoints da API

Base: `/api`. Autenticação via `Authorization: Bearer <token>`.

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/register` | Público | Cadastro (`role`: `AUCTIONEER` ou `BIDDER`) |
| POST | `/auth/login` | Público | Login |
| GET | `/auth/me` | Logado | Usuário atual |
| GET | `/lots?phase=live\|scheduled\|ended&search=&minPrice=&maxPrice=&sort=&page=` | Público | Vitrine |
| GET | `/lots/:id` | Público (login opcional) | Sala do lote |
| POST | `/lots` | Leiloeiro | Cria lote a partir de uma obra do catálogo |
| POST | `/lots/:id/cancel` | Leiloeiro dono | Cancela (com estorno, se houver lances) |
| POST | `/lots/:id/bids` | Licitante | Dá um lance (`{ amountCents }`) |
| GET | `/seller/lots` | Leiloeiro | Painel: lotes e resumo financeiro |
| GET | `/me/bids` | Licitante | Meus lances e arremates |
| GET | `/wallet` | Licitante | Saldos, comprometidos e extrato |
| POST | `/wallet/deposit` | Licitante | Depósito simulado (`{ amountCents }`) |
| GET | `/catalog/search?q=&page=` | Leiloeiro | Busca no Art Institute of Chicago |
| GET | `/audit/:lotId` | Público | Cadeia de lances + relatório de integridade |
| GET | `/audit/public-key` | Público | Chave pública Ed25519 |
| GET | `/receipts/:token` | Público | Comprovante de arremate |
| GET | `/items/:id/image` | Público | Imagem da obra (servida do banco) |
| GET | `/health` | Público | Health check |

Valores monetários trafegam sempre em **centavos** (inteiros).

## Testes

```bash
cd verzel-api
npm test
```

São 37 testes unitários cobrindo as regras de lance (mínimos, saldo, estados do lote, valores inválidos), o anti-sniping, a fase do lote, o pseudônimo e o verificador de integridade, incluindo um cenário para cada tipo de adulteração.

Além disso, o fluxo completo foi validado de ponta a ponta contra a API real (concorrência, carteira, liquidação, cancelamento com estorno, comprovante, adulterações direto no banco) e na interface pelo navegador.

## Deploy

**API + banco: Render** (arquivo `render.yaml`)

1. No Render: *New → Blueprint* e selecione este repositório. São criados o Postgres e o serviço `verzel-leiloes-api` (pasta `verzel-api`), com os segredos gerados automaticamente.
2. A cada deploy rodam `prisma migrate deploy` e o seed (que só popula o banco se estiver vazio).
3. Depois que o front estiver no ar, preencha `CORS_ORIGIN` com a URL da Vercel.

**Front: Vercel**

1. *Add New → Project*, selecione o repositório e defina **Root Directory = `verzel-interface`** (framework: Vite).
2. Variável `VITE_API_URL` = `https://<sua-api>.onrender.com/api`.
3. O `vercel.json` já redireciona as rotas do React Router para o `index.html`.

## Comportamentos que podem parecer inesperados

- **Primeiro acesso lento no deploy.** O plano gratuito do Render "dorme" após 15 min sem uso, e a primeira requisição pode levar cerca de 50 s. Enquanto a API dorme, o job de liquidação não roda; os lotes vencidos nesse período são liquidados assim que ela acorda, com as datas reais de fim preservadas.
- **Prorrogação acumula.** O anti-sniping soma +2 min ao **fim atual** a cada lance na janela final (interpretação literal de "estende o fim do lote para +2 minutos"). Vários lances seguidos na reta final prorrogam várias vezes.
- **Cancelamento com lances é permitido.** O requisito base pede cancelar lotes sem lances; implementei também o opcional "cancelamento com estorno automático". Ao cancelar um lote com lances, o modal avisa que o valor do líder será liberado. Lotes já encerrados não podem ser cancelados.
- **Limite de lances.** Cada licitante pode enviar no máximo 10 lances a cada 10 s (proteção contra abuso).
- **Lote "Arrival of the Normandy Train" encerra 30 min após o seed.** Se você chegar depois disso, ele já estará entre os encerrados (sem lances). Para um lote curto novo, crie como leiloeiro (botão "15 min") ou rode o seed com `--force`.
- **Lances do seed não passam pelas regras de horário.** Eles são gravados com horários no passado para montar o histórico; a cadeia e as assinaturas são as mesmas de produção, então a auditoria fica íntegra.
- **Busca do leiloeiro depende da API externa.** Se o Art Institute estiver fora, a busca mostra resultados em cache (com aviso) ou uma mensagem de indisponibilidade. O resto da aplicação não é afetado.
- **Imagens das obras ficam no banco.** Por isso a criação de um lote leva alguns segundos (download da imagem). Se o download falhar, o lote é criado assim mesmo e a imagem é buscada na origem ao exibir.
- **Pseudônimo muda de lote para lote.** É intencional (privacidade). Dentro do mesmo lote ele é sempre o mesmo.
- **Banco local no Windows.** O script `npm run db:local` inicializa o Postgres em UTF-8. Se você já tinha uma pasta `.pgdata` criada com outra codificação, apague-a antes.

## Uso de IA

_Rascunho; o autor deve revisar e completar com a própria descrição._

O projeto foi desenvolvido com o auxílio do **Claude Code** (Anthropic). As decisões de stack, a estrutura de pastas (baseada em projetos anteriores do autor) e as escolhas de produto foram definidas pelo autor. A IA foi usada para gerar e revisar código, escrever testes, investigar bugs e validar os fluxos de ponta a ponta. Todo o código foi revisado e testado antes da entrega.
