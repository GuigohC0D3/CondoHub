# CondoHub

SaaS multi-tenant de gestão para condomínios pequenos e médios (Brasil).

```
CondoHub/
├── backend/      API REST — Node + Express + TS + Prisma + PostgreSQL + Redis
├── frontend/     SPA — Vue 3 + TS + Vite + Tailwind + shadcn-vue
├── docs/         ARQUITETURA.md · FRONTEND.md
└── docker-compose.yml   (db + redis + api + web)
```

## Subir tudo (Docker)
```bash
cp backend/.env.example backend/.env   # ajuste os segredos
docker compose up --build
# API  → http://localhost:3333
# Web  → http://localhost:5173
```

## Desenvolvimento local

**Backend** (ver `backend/README.md`):
```bash
cd backend
cp .env.example .env
docker compose up -d db redis   # na raiz, ou suba Postgres/Redis manualmente
npm install
npm run prisma:migrate && npm run seed
npm run dev        # http://localhost:3333
```

**Frontend:**
```bash
cd frontend
cp .env.example .env             # VITE_API_URL=http://localhost:3333/api
npm install
npm run dev        # http://localhost:5173
```

## Credenciais (seed)
| Papel | E-mail | Senha | Slug |
|-------|--------|-------|------|
| SUPER_ADMIN | admin@condohub.com.br | changeme123 | *(nenhum)* |
| SÍNDICO | sindico@demo.com.br | changeme123 | demo |

## Documentação
- **`docs/ARQUITETURA.md`** — negócio, RBAC, modelo de dados, APIs, segurança, escala.
- **`docs/FRONTEND.md`** — plano do frontend (Vue 3 + shadcn-vue).
