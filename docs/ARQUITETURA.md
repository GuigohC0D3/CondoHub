# CondoHub — Arquitetura & Plano de Produto

SaaS multi-tenant de gestão para condomínios pequenos e médios (Brasil).
Documento de referência técnica e de negócio. Stack: React + TS / Node + Express + TS / PostgreSQL + Prisma / S3 / Docker.

---

## 1. Modelo de Negócio

### Como cobrar
Cobrança **B2B por assinatura mensal recorrente**, paga pelo condomínio (não pelo morador), precificada por **faixa de unidades (apartamentos)**. Esse é o modelo de menor atrito: o síndico já tem orçamento de administração, e o valor é diluído na taxa condominial.

- **Gateway:** Asaas ou Pagar.me (nacionais, suportam Pix recorrente + cartão + boleto, e split). Stripe só se houver intenção internacional.
- **Pix recorrente / boleto** para condomínios (síndicos preferem boleto/Pix a cartão corporativo).
- **Cobrança de boleto de morador** (taxa condominial) é um módulo *futuro* e exige integração bancária + responsabilidade financeira — fora do MVP.

### Planos sugeridos

| Plano | Unidades | Preço/mês | Foco |
|-------|----------|-----------|------|
| **Free** | até 10 | R$ 0 | Isca / condomínio minúsculo. Avisos + moradores apenas. |
| **Básico** | até 30 | R$ 99 | Avisos, moradores, reservas, chamados. |
| **Profissional** | até 100 | R$ 249 | Tudo + financeiro, portaria (visitantes/encomendas), relatórios. |
| **Enterprise** | 100+ | sob consulta (R$ 2,50–4/unidade) | Multi-condomínio (administradoras), suporte prioritário, white-label. |

Regra de ouro: precificar por **valor entregue ao síndico** (economia de tempo, organização, transparência), não por custo de infra. Margem-alvo > 85%.

### Primeiros clientes (0 → 10)
1. **Venda direta consultiva:** seu próprio condomínio + indicações. Síndicos confiam em indicação de síndico.
2. **Grupos de síndicos** no Facebook/WhatsApp e associações de síndicos regionais.
3. **Administradoras de condomínio** pequenas — um contrato traz 5–20 condomínios.
4. **Trial de 30 dias** sem cartão + onboarding feito por você manualmente (migra os dados do cliente de graça).
5. Posicionamento: "mais simples e mais barato que [concorrente]", foco em condomínio sem zelador/administradora profissional.

### Crescimento (10 → centenas)
- **Self-service onboarding** (criar condomínio em < 10 min sem intervenção).
- **Programa de indicação** (mês grátis por condomínio indicado).
- **Canal administradoras** (revenda / comissão) — alavanca de maior escala.
- **SEO + conteúdo** ("modelo de ata", "regras de reserva de salão de festas") capturando síndicos.
- **Métricas que importam:** CAC, churn mensal (< 3% é saudável em B2B SMB), LTV, MRR, expansão (upgrade de plano).

### Custos de infra estimados
- **0–50 condomínios:** 1 VPS (4 vCPU / 8 GB, ex. Hetzner/Contabo ~R$ 120–200/mês) rodando app + Postgres + Redis em Docker. S3 (Backblaze B2/Cloudflare R2 ~R$ 0). **Total ~R$ 200–300/mês.**
- **50–200:** VPS maior + Postgres gerenciado (RDS/Neon) + Redis gerenciado + CDN Cloudflare. **~R$ 800–1.500/mês.**
- **200–1.000:** multi-instância atrás de load balancer, Postgres com read replica, filas, observabilidade paga. **~R$ 4–10 mil/mês.**

Custo por condomínio cai com escala; receita cresce linear → margem expande.

---

## 2. Tipos de Usuário & Permissões (RBAC)

Modelo: **RBAC por papel + escopo de tenant**. Toda autorização verifica (a) papel e (b) que o recurso pertence ao `condominiumId` do usuário. `SUPER_ADMIN` é o único sem tenant.

| Recurso / Ação | SUPER_ADMIN | SÍNDICO | MORADOR | PORTEIRO |
|---|---|---|---|---|
| Criar/gerenciar condomínios | ✅ | — | — | — |
| Gerenciar assinaturas / bloquear inadimplente | ✅ | — | — | — |
| Métricas globais | ✅ | — | — | — |
| Cadastrar/aprovar moradores | — | ✅ | — | — |
| Criar avisos | — | ✅ | — | — |
| Gerenciar reservas (aprovar) | — | ✅ | criar/cancelar próprias | — |
| Financeiro (receitas/despesas/relatórios) | — | ✅ | ver boletos próprios | — |
| Chamados | ver (suporte) | gerenciar todos | abrir/comentar próprios | — |
| Visitantes | — | ver | pré-cadastrar | registrar entrada/saída |
| Encomendas | — | ver | ver/confirmar retirada própria | registrar |
| Editar próprio perfil | ✅ | ✅ | ✅ | ✅ |

Implementação: middleware `requireRole([...])` + helper `assertSameTenant(resource, user)` + **Prisma Client Extension** que injeta `where: { condominiumId }` automaticamente em todo modelo com esse campo (defesa em profundidade contra vazamento entre tenants).

---

## 3. Módulos do Sistema
Ver detalhamento de campos no `schema.prisma`. Resumo funcional:

- **Dashboard** — KPIs (nº moradores, próximas reservas, chamados abertos, avisos recentes, despesas do mês) + gráfico fluxo de caixa (receitas vs despesas 12 meses) e pizza por categoria. Dados agregados em uma rota `GET /dashboard` com queries paralelas + cache curto (Redis 60s).
- **Cadastro de moradores** — fluxo de aprovação (`PENDING → APPROVED`), upload de docs (S3 presigned), histórico de alterações (`ResidentHistory`), veículos.
- **Avisos** — fixar (`isPinned`), anexos, confirmação de leitura (`NoticeRead`), notificação push/email aos moradores.
- **Reservas** — janelas de horário por área, aprovação automática/manual, limite mensal por morador, detecção de conflito de horário (range overlap), cancelamento.
- **Financeiro** — receitas/despesas com categoria, fluxo de caixa, relatório mensal/anual, export PDF (pdfkit) e Excel (exceljs).
- **Chamados** — categoria, prioridade, status, responsável, comentários, fotos, histórico (timeline via comentários + auditoria).
- **Visitantes** — pré-cadastro pelo morador gera QR Code (token único), porteiro faz check-in/out via leitura.
- **Encomendas** — porteiro registra + foto, notifica morador, confirma retirada.

---

## 4. Banco de Dados

Diagrama ER (resumido — entidades e cardinalidade):

```
Condominium 1───* User
Condominium 1───* Block 1───* Apartment 1───* Resident *───1 User(opcional)
Condominium 1───1 Subscription 1───* Payment
Resident 1───* Vehicle | ResidentDocument | ResidentHistory
Condominium 1───* Notice 1───* NoticeAttachment | NoticeRead
Condominium 1───* CommonArea 1───* Reservation *───1 Resident
Condominium 1───* Expense *───1 ExpenseCategory ; Condominium 1───* Revenue
Condominium 1───* Ticket 1───* TicketComment | TicketAttachment ; Ticket *───1 Resident, *───1 User(assignee)
Condominium 1───* Visitor *───1 Resident
Condominium 1───* Package *───1 Apartment
Condominium 1───* Notification ; Condominium 1───* AuditLog
```

**Por que cada tabela** (justificativa de design):
- `Condominium` — o tenant; raiz do isolamento. Todo dado de domínio referencia seu id.
- `Subscription`/`Payment` — separa o ciclo de cobrança da plataforma do dado operacional; permite bloqueio por inadimplência sem apagar dados.
- `User` x `Resident` — **separação deliberada**: `User` é credencial de login (qualquer papel); `Resident` é a pessoa física vinculada a uma unidade. Um porteiro tem User mas não Resident; um morador pode ter Resident sem User (cadastrado pelo síndico antes de ativar conta).
- `Block`/`Apartment` — estrutura física reutilizada por moradores e encomendas; `Block` opcional (condomínio horizontal pode não ter).
- `RefreshToken` — rotação/revogação de sessão; armazena **hash**, não o token.
- `Notice`/`NoticeRead` — comunicação + métrica de leitura (compliance/assembleias).
- `CommonArea`/`Reservation` — regras de reserva configuráveis por área.
- `Expense`/`Revenue`/`ExpenseCategory` — financeiro com categorização para relatórios.
- `Ticket`+comentários/anexos — manutenção com timeline.
- `Visitor`/`Package` — operação de portaria.
- `Notification` — central de notificações in-app.
- `AuditLog` — trilha de auditoria (LGPD + disputas em assembleia).

**Índices-chave:** todo modelo de tenant indexa `condominiumId` (+ colunas de filtro frequente como `status`). Únicos compostos garantem isolamento (`@@unique([condominiumId, email])`, `@@unique([condominiumId, cpf])`).

**Integridade:** FKs com `onDelete` deliberado — `Cascade` no tenant (apagar condomínio limpa tudo), `Restrict` onde apagar quebraria histórico financeiro/portaria, `SetNull` em vínculos opcionais.

---

## 5. APIs REST

Convenções: prefixo `/api`, JWT no header `Authorization: Bearer`, respostas JSON, erros padronizados `{ error: { code, message, details } }`. Paginação `?page=&limit=` → `{ data, meta: { total, page, limit } }`. Validação com **Zod** em todo payload.

Códigos de erro: `400` validação, `401` não autenticado, `403` sem permissão/tenant errado, `404`, `409` conflito (ex. reserva sobreposta), `422` regra de negócio, `429` rate limit, `500`.

### Auth
```
POST /api/auth/login           { email, password } → { accessToken, refreshToken, user }
POST /api/auth/refresh         { refreshToken }     → { accessToken, refreshToken }
POST /api/auth/logout          (revoga refresh token)
GET  /api/auth/me              → usuário atual
```

### Plataforma (SUPER_ADMIN)
```
POST   /api/admin/condominiums                cria condomínio + síndico inicial
GET    /api/admin/condominiums                lista (paginado)
PATCH  /api/admin/condominiums/:id/block      bloqueia inadimplente (status=BLOCKED)
GET    /api/admin/metrics                      MRR, churn, condomínios ativos, etc.
GET    /api/admin/subscriptions               assinaturas + status pagamento
```

### Moradores
```
GET    /api/residents?status=&page=
POST   /api/residents                          (síndico) cadastra
GET    /api/residents/:id
PATCH  /api/residents/:id                       grava ResidentHistory dos campos alterados
PATCH  /api/residents/:id/approve               PENDING → APPROVED
POST   /api/residents/:id/documents             presigned upload S3
GET    /api/residents/me                        (morador) próprio cadastro
```

### Avisos
```
GET    /api/notices?pinned=&page=
POST   /api/notices                             (síndico) cria + dispara notificações
PATCH  /api/notices/:id
POST   /api/notices/:id/read                    (morador) marca como lido
DELETE /api/notices/:id
```

### Reservas
```
GET    /api/common-areas
POST   /api/common-areas                        (síndico)
GET    /api/reservations?areaId=&from=&to=
POST   /api/reservations                        valida conflito → 409 se sobreposto; limite mensal → 422
PATCH  /api/reservations/:id/approve            (síndico, modo MANUAL)
PATCH  /api/reservations/:id/cancel
```
Exemplo `POST /api/reservations`:
```jsonc
// req
{ "commonAreaId": "uuid", "startsAt": "2026-07-01T18:00:00Z", "endsAt": "2026-07-01T23:00:00Z", "notes": "Aniversário" }
// 201
{ "id": "uuid", "status": "PENDING", "commonAreaId": "uuid", "startsAt": "...", "endsAt": "..." }
// 409
{ "error": { "code": "RESERVATION_CONFLICT", "message": "Horário já reservado" } }
```

### Financeiro
```
GET    /api/expenses?from=&to=&categoryId=
POST   /api/expenses
GET    /api/revenues?from=&to=
POST   /api/revenues
GET    /api/finance/cashflow?year=2026          série mensal receita/despesa
GET    /api/finance/report?period=monthly&month=2026-06&format=pdf|xlsx
```

### Chamados
```
GET    /api/tickets?status=&priority=&page=
POST   /api/tickets                             (morador) abre
GET    /api/tickets/:id                          inclui comentários + anexos
PATCH  /api/tickets/:id                          status / assignee / priority (síndico)
POST   /api/tickets/:id/comments
POST   /api/tickets/:id/attachments
```

### Visitantes
```
POST   /api/visitors                            (morador) pré-cadastra → gera qrCode
GET    /api/visitors?status=
POST   /api/visitors/:id/checkin                (porteiro)
POST   /api/visitors/:id/checkout               (porteiro)
GET    /api/visitors/validate/:qrCode           (porteiro) valida QR
```

### Encomendas
```
GET    /api/packages?status=&apartmentId=
POST   /api/packages                            (porteiro) registra + foto → notifica morador
PATCH  /api/packages/:id/pickup                 confirma retirada
```

### Dashboard & Notificações
```
GET    /api/dashboard                           KPIs agregados (cache 60s)
GET    /api/notifications?unread=true
PATCH  /api/notifications/:id/read
```

---

## 6. Frontend

> **Plano detalhado em [`FRONTEND.md`](FRONTEND.md).** Stack revisada para **Vue 3 + Tailwind + shadcn-vue**.

Stack frontend: **Vue 3 (`<script setup>`) + TS + Vite + Tailwind + shadcn-vue (Reka UI) + Vue Router + Pinia + TanStack Vue Query + vee-validate/zod + axios**. SPA multi-tenant, mobile-first, tema claro/escuro via `dark` class strategy do Tailwind (store Pinia, persistido, respeita `prefers-color-scheme`).

Organização por **feature** (espelha os módulos do backend): `features/{auth,dashboard,residents,structure,notices,reservations,tickets,visitors,packages,finance,notifications,admin}`, cada uma com `api.ts` (composables vue-query) + views/components. UI em `components/ui/` (shadcn-vue), layout em `components/layout/` (AppShell, Sidebar, Topbar), genéricos em `components/common/` (DataTable paginado, FormDialog, EmptyState, FileUpload, ConfirmDialog).

O **mapa papel→rota** dirige ao mesmo tempo os guards do router e a montagem da Sidebar (fonte única, sem divergir do RBAC do backend). Auth via interceptor axios com refresh rotativo e fila de requests pendentes.

### Wireframes (texto)

**Shell (desktop):**
```
┌──────────────────────────────────────────────────────────┐
│ [≡] CondoHub        Buscar...      🔔(3)   🌙   Síndico ▾ │ Topbar
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │  Conteúdo                                       │
│ ▸ Dash   │                                                 │
│ ▸ Morad. │                                                 │
│ ▸ Avisos │                                                 │
│ ▸ Reserv.│                                                 │
│ ▸ Financ.│                                                 │
│ ▸ Chamad.│                                                 │
│ ▸ Portaria                                                 │
│ ▸ Config │                                                 │
└──────────┴───────────────────────────────────────────────┘
```

**Dashboard:**
```
┌── Moradores ──┐ ┌── Reservas hoje ─┐ ┌── Chamados ──┐ ┌── Despesas mês ─┐
│      128       │ │        3          │ │   7 abertos   │ │   R$ 12.430     │
└───────────────┘ └───────────────────┘ └───────────────┘ └─────────────────┘
┌──────────── Fluxo de Caixa (12m) ────────────┐ ┌── Avisos recentes ──┐
│  ▆▆▅▇▆▅▇▆▇▅▆▇  (linhas receita x despesa)     │ │ • Manutenção elevador│
│                                                │ │ • Assembleia 20/06   │
└────────────────────────────────────────────────┘ └──────────────────────┘
```

**Mobile (morador):** bottom tab nav → Início | Avisos | Reservar | Encomendas | Perfil.

---

## 7. MVP (lançar em 30 dias)

**Construir primeiro (núcleo de valor — semanas 1–3):**
1. Auth + multi-tenant + RBAC (fundação).
2. Cadastro/aprovação de moradores + estrutura (blocos/aptos).
3. Avisos (com leitura) — *é o gancho que faz o síndico adotar*.
4. Reservas de áreas comuns.
5. Chamados.
6. Dashboard básico.

**Deixar para depois (v2):** financeiro completo c/ export, portaria (visitantes QR + encomendas), notificações push, app mobile nativo, boleto de morador, white-label, multi-condomínio para administradoras.

**Cronograma 30 dias:**
- Sem 1: setup (Docker, Prisma, CI), auth, tenancy, moradores.
- Sem 2: avisos, reservas, chamados (back + front).
- Sem 3: dashboard, polish UI, notificações por email, testes E2E críticos.
- Sem 4: onboarding manual de 2–3 condomínios-piloto, ajustes, deploy produção.

**Validação:** 2–3 condomínios-piloto reais (migração de dados feita por você). Métrica de sucesso = % de avisos lidos e nº de reservas/chamados criados pelos moradores na 1ª semana (engajamento real, não só o síndico). Coletar feedback semanal.

---

## 8. Segurança

- **SQL Injection:** Prisma (queries parametrizadas) — nunca `$queryRawUnsafe` com input do usuário. Toda entrada validada com Zod.
- **Multi-tenant leak:** Prisma extension injeta `condominiumId` + `assertSameTenant` em handlers. Testes automatizados de isolamento.
- **Autenticação:** senha com **argon2id** (ou bcrypt cost ≥ 12). JWT access curto (15 min) + refresh rotativo (hash no banco, revogável). Logout revoga refresh.
- **Autorização:** RBAC central, deny-by-default. Nunca confiar em `condominiumId` vindo do cliente — sempre do token.
- **Rate limiting:** `express-rate-limit` + Redis store. Mais agressivo em `/auth/login` (ex. 5/min/IP) para brute force; global por IP/usuário.
- **Criptografia:** TLS em trânsito (Cloudflare/Let's Encrypt). Segredos em variáveis de ambiente / secret manager, nunca no repo. Dados sensíveis (CPF) — acesso restrito por papel; considerar criptografia em repouso para PII.
- **Headers:** `helmet`, CORS allow-list por tenant, CSP. Cookies `httpOnly`+`secure`+`sameSite` se usar cookie para refresh.
- **Uploads:** presigned URLs S3, validar mime/tamanho, antivírus opcional, buckets privados (acesso via URL assinada temporária).
- **Auditoria:** `AuditLog` em ações sensíveis (aprovação, exclusão, login, mudança financeira) — requisito LGPD.
- **LGPD:** consentimento, direito de exclusão (anonimização), DPA com clientes, retenção definida.
- **Backup:** Postgres `pg_dump` diário + PITR (WAL) no Postgres gerenciado; backup S3 versionado; testar restore mensalmente.
- **Logs:** estruturados (pino/winston) sem PII em claro, centralizados (Loki/Datadog), alertas em erros 5xx e picos de 401/403.

---

## 9. Escalabilidade

**100 condomínios:** 1 VPS bem dimensionada já aguenta. Postgres com índices corretos (já no schema), connection pool (PgBouncer/Prisma pool), Redis para cache de dashboard e rate limit. App stateless.

**1.000 condomínios:**
- **App stateless** → escalar horizontalmente N instâncias atrás de **load balancer** (Nginx/Traefik/Cloudflare LB). Sessão no JWT, nada em memória.
- **Banco:** Postgres gerenciado com **read replica** (dashboards/relatórios na réplica); particionar tabelas de alto volume (`Notification`, `AuditLog`) por data/tenant se necessário. PgBouncer obrigatório.
- **Cache (Redis):** dashboard agregado, listas quentes, sessões de rate limit. Invalidação por evento.
- **Filas (BullMQ/Redis):** trabalho assíncrono — envio de email/push de avisos, geração de PDF/Excel, processamento de imagem de encomenda, webhooks de pagamento. Desacopla request do trabalho pesado.
- **CDN (Cloudflare):** assets do frontend + cache de arquivos S3 públicos; WAF/DDoS na borda.
- **Storage:** S3/R2 escala sozinho; servir via CDN.
- **Observabilidade:** métricas (Prometheus/Grafana), tracing (OpenTelemetry), alertas. Autoscaling baseado em CPU/latência.
- **Quando o shared-DB apertar:** migrar tenants grandes (administradoras) para schema dedicado ou banco dedicado (modelo híbrido) sem reescrever a aplicação — a abstração de tenant já isola.

**Resumo da progressão:** monolito modular stateless + Postgres + Redis → +read replica +filas +CDN → +múltiplas instâncias +particionamento +observabilidade. Não introduzir microserviços antes de a dor justificar.
