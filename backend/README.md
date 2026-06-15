# CondoHub — Backend

SaaS multi-tenant de gestão para condomínios. Node + Express + TypeScript + Prisma + PostgreSQL + Redis.

> Arquitetura completa e plano de produto em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Stack
- **Express + TypeScript** (monolito modular, stateless)
- **Prisma + PostgreSQL** — multi-tenant (shared DB, isolado por `condominiumId`)
- **Redis** — rate limit e cache
- **Auth** — JWT access (15 min) + refresh rotativo (hash no banco) + argon2id
- **Zod** — validação de toda entrada

## Setup local

```bash
cp .env.example .env          # ajuste os segredos
docker compose up -d db redis # sobe Postgres + Redis
npm install
npm run prisma:generate
npm run prisma:migrate        # cria o schema
npm run seed                  # cria SUPER_ADMIN + condomínio demo
npm run dev                   # API em http://localhost:3333
```

Subir tudo em container: `docker compose up --build`.

## Credenciais do seed
| Papel | Email | Senha | Slug (subdomínio) |
|-------|-------|-------|------|
| SUPER_ADMIN | admin@condohub.com.br | changeme123 | *(nenhum)* |
| SÍNDICO | sindico@demo.com.br | changeme123 | demo |

## Rotas implementadas
```
GET  /health
POST /api/auth/login      { email, password, condominiumSlug? }
POST /api/auth/refresh    { refreshToken }
POST /api/auth/logout     { refreshToken }
GET  /api/auth/me         (Bearer)
```

Exemplo:
```bash
curl -X POST localhost:3333/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"sindico@demo.com.br","password":"changeme123","condominiumSlug":"demo"}'
```

## Arquitetura de tenancy (importante)
- O `condominiumId` **nunca** vem do cliente — é derivado do JWT.
- `src/middlewares/auth.ts` estabelece o contexto de tenant (`AsyncLocalStorage`).
- `src/lib/prisma.ts` (extensão) injeta `condominiumId` automaticamente em todo
  modelo de tenant (defesa em profundidade). `SUPER_ADMIN` usa `bypassTenant`.
- Leituras por id em modelos de tenant: use `findFirst` (escopado) ou
  `assertSameTenant()` após carregar — `findUnique` não aceita filtro não-único.

## Estrutura
```
src/
  config/        env (validado com Zod)
  lib/           prisma (+ tenant ext), redis, logger, tenant-context
  middlewares/   auth, rbac, rate-limit, validate, error
  modules/
    auth/        routes, controller, service, schemas, token.service
  utils/         errors (AppError), async-handler
  types/         express.d.ts (Request.user)
  app.ts         montagem do Express
  server.ts      bootstrap + graceful shutdown
prisma/
  schema.prisma  24 entidades
  seed.ts
```

## Próximos módulos (scaffold pronto em `src/routes.ts`)
residents · notices · reservations · finance · tickets · visitors · packages · dashboard · admin
