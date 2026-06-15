# CondoHub — Plano do Frontend (Vue 3 + Tailwind + shadcn-vue)

Substitui o plano original em React. SPA multi-tenant que consome a API REST do backend.
Foco: simplicidade, responsivo mobile-first (porteiro e morador usam celular), tema claro/escuro.

## 1. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Vue 3** (`<script setup>` + Composition API) | reatividade simples, curva suave |
| Build | **Vite** + TypeScript | dev rápido, alias `@` |
| Estilo | **Tailwind CSS** | utilitário, design consistente |
| UI | **shadcn-vue** (Reka UI + Tailwind) | componentes acessíveis, copy-paste, sem lock-in |
| Ícones | **lucide-vue-next** | par do shadcn |
| Roteamento | **Vue Router** | guards por papel |
| Server state | **@tanstack/vue-query** | cache, refetch, paginação, invalidação |
| Client state | **Pinia** | auth/session, tema |
| Forms | **vee-validate + zod** (`@vee-validate/zod`) | reaproveita os mesmos schemas do backend |
| HTTP | **axios** | interceptors (Bearer + refresh) |
| Gráficos | **unovis** ou **vue-chartjs** | dashboard (fluxo de caixa, pizza) |
| Datas | **@internationalized/date** / dayjs | reservas, relatórios |
| QR | render do `qrCodeDataUrl` vindo do backend (sem lib) | visitantes |

## 2. Estrutura de pastas

```
src/
  main.ts                  # bootstrap: Pinia, Router, VueQuery, Tailwind
  App.vue
  router/
    index.ts               # rotas + guards (auth, role, tenant)
  lib/
    api.ts                 # axios + interceptors (refresh rotativo)
    queryClient.ts
    utils.ts               # cn() (clsx+tailwind-merge), formatadores BRL/data
  stores/
    auth.ts                # Pinia: user, tokens, login/logout/refresh
    theme.ts               # claro/escuro (persistido, prefers-color-scheme)
  components/
    ui/                    # shadcn-vue (button, input, dialog, table, card, badge,
                           #   dropdown-menu, sheet, toast, tabs, select, form, skeleton...)
    layout/
      AppShell.vue         # sidebar + topbar + <RouterView>
      Sidebar.vue          # navegação filtrada por papel
      Topbar.vue           # busca, sino de notificações, tema, menu do usuário
    charts/
      CashflowChart.vue
      TicketsByStatus.vue
    common/
      DataTable.vue        # tabela paginada genérica (sort/filtros)
      PageHeader.vue  EmptyState.vue  ConfirmDialog.vue  FileUpload.vue
  features/                # um módulo por domínio (espelha o backend)
    auth/        (LoginView, useAuth)
    dashboard/   (DashboardView, api.ts)
    residents/   (ListView, DetailView, FormDialog, api.ts, schemas.ts)
    structure/   (BlocksView, ApartmentsView)
    notices/     (ListView, ComposeDialog, api.ts)
    reservations/(CalendarView, MyReservations, ApproveQueue, api.ts)
    tickets/     (ListView, DetailView, api.ts)
    visitors/    (PreRegisterView, GateView /portaria, api.ts)
    packages/    (ListView, RegisterDialog, api.ts)
    finance/     (Expenses, Revenues, CashflowView, ReportsView, api.ts)
    notifications/(NotificationsMenu, api.ts)
    admin/       (CondominiumsView, MetricsView, SubscriptionView)  # SUPER_ADMIN
  pages/         (NotFound, Forbidden)
  styles/        (tailwind.css, tokens)
```

## 3. Autenticação & multi-tenant no client

- **Login**: form pede e-mail + senha; o tenant vem do **subdomínio** (`acme.condohub.com.br` → `condominiumSlug=acme`) ou de um campo quando em `localhost`. SUPER_ADMIN loga sem slug.
- **Tokens**: `accessToken` em memória (Pinia); `refreshToken` em `localStorage` (ou cookie httpOnly se o backend migrar). Interceptor do axios:
  - request → injeta `Authorization: Bearer <access>`
  - response 401 → tenta `POST /auth/refresh` (1x, com fila de requests pendentes), reidrata tokens, repete a request; se falhar → logout + redirect `/login`.
- **Guards do router**:
  - `requiresAuth` → sem sessão → `/login`
  - `meta.roles` → papel fora da lista → `/403`
  - menu da Sidebar é derivado do papel (mesma fonte de verdade dos guards).

## 4. Rotas por papel (espelham o RBAC do backend)

| Rota | Papéis | View |
|---|---|---|
| `/login` | público | LoginView |
| `/` (dashboard) | SINDICO | DashboardView |
| `/moradores` | SINDICO | ResidentsListView |
| `/estrutura` | SINDICO | Blocks/Apartments |
| `/avisos` | SINDICO, MORADOR, PORTEIRO | NoticesListView (síndico compõe) |
| `/reservas` | SINDICO, MORADOR | Calendar + fila de aprovação (síndico) |
| `/chamados` | SINDICO, MORADOR | TicketsListView/Detail |
| `/financeiro` | SINDICO | Expenses/Revenues/Cashflow/Reports |
| `/portaria` | PORTEIRO, SINDICO | GateView (validar QR, check-in/out, registrar encomenda) |
| `/visitantes` | MORADOR | PreRegisterView (gera QR) |
| `/encomendas` | MORADOR, PORTEIRO | PackagesListView |
| `/perfil` | todos | ProfileView (`/residents/me` ou `/auth/me`) |
| `/admin/*` | SUPER_ADMIN | Condominiums, Metrics, Subscriptions |

Notificações (sino) e tema ficam no Topbar, disponíveis em todas as rotas autenticadas.

## 5. Integração com a API (vue-query)

Cada feature tem `api.ts` tipado + composables:
```ts
// features/tickets/api.ts
export const useTickets = (params) =>
  useQuery({ queryKey: ['tickets', params], queryFn: () => api.get('/tickets', { params }).then(r => r.data) });

export const useUpdateTicket = () =>
  useMutation({
    mutationFn: ({ id, data }) => api.patch(`/tickets/${id}`, data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });
```
- Paginação: `{ data, meta }` → componente `DataTable` consome direto.
- Erros: interceptor mapeia `{ error: { code, message } }` → `toast` (shadcn).
- Uploads: `POST /uploads/presign` → `PUT` no S3 → registra `fileUrl` no recurso.
- Relatórios: download de `/finance/report?format=pdf|xlsx` via blob.

## 6. shadcn-vue — componentes a instalar
`button, input, label, form, card, table, dialog, sheet, dropdown-menu, select, tabs, badge, avatar, toast (sonner), skeleton, popover, calendar, command, alert-dialog, switch, separator, tooltip`.
Theming via CSS vars do shadcn + `dark` class strategy do Tailwind (store `theme`).

## 7. Wireframes (texto)

**AppShell (desktop):**
```
┌───────────────────────────────────────────────────────────┐
│ CondoHub        🔎 buscar       🔔3   ☀/🌙   Síndico ▾     │
├──────────┬────────────────────────────────────────────────┤
│ Dashboard│  <RouterView>                                   │
│ Moradores│                                                 │
│ Avisos   │                                                 │
│ Reservas │                                                 │
│ Chamados │                                                 │
│ Financeiro                                                 │
│ Portaria │                                                 │
│ Config   │                                                 │
└──────────┴────────────────────────────────────────────────┘
```
**Mobile:** Sidebar vira `Sheet` (drawer); bottom-nav opcional para morador/porteiro.

**Portaria (porteiro, mobile-first):**
```
[ Escanear QR ]   ← câmera / input do token
┌── Visitante validado ──┐
│ Maria — apto 101       │
│ [ Confirmar entrada ]  │
└────────────────────────┘
[ + Registrar encomenda ]  → apto, foto, transportadora
```

## 8. Sequência de construção (frontend)
1. Scaffold Vite+Vue+TS, Tailwind, shadcn-vue, Pinia, Router, vue-query, axios.
2. `auth` (login + interceptors + guards) — fundação.
3. `AppShell` + Sidebar/Topbar + tema + notificações.
4. `dashboard` (consome `/dashboard`, gráficos).
5. `residents` + `structure` (CRUD com DataTable + FormDialog).
6. `notices`, `reservations`, `tickets`.
7. `portaria` (visitors + packages) — fluxo do porteiro.
8. `finance` (tabelas + cashflow + export).
9. `admin` (SUPER_ADMIN).
10. Polimento responsivo, estados de loading/erro, e2e (Playwright).

## 9. Decisões
- **Sem SSR** (Nuxt) no MVP: SPA basta (app interno autenticado), deploy estático + CDN. Migrar para Nuxt só se SEO/marketing exigir.
- **vee-validate + zod**: os schemas Zod do backend podem ser espelhados/compartilhados num pacote futuro (monorepo) para validação única.
- **Mesma fonte de RBAC**: o mapa de papéis→rotas dirige guard E sidebar, evitando divergência com o backend.
