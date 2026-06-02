# STRUCTURE — Atius Monorepo

> Mapeado a partir do código real em `/home/ubuntu/GitHub/atius/`. Atualizado: 2026-06-02.

## Root

```
atius/
├── backend/                 # Node.js backend + Python
├── frontend/                # Next.js frontend (React 15)
├── docs/                    # 195+ arquivos de documentação
├── config/                  # Configurações compartilhadas
├── .claude/                  # Claude agent config (skills, agents)
├── .agent/                   # Agent configs
├── .opencode/                # OpenCode config
├── .gemini/                  # Gemini config
├── .copilotignore/           # Copilot ignore
│
├── package.json              # Backend Node deps
├── pyproject.toml           # Python deps
├── ecosystem.config.js      # PM2 config (7 apps)
├── ecosystem.testnet.config.js
├── start.sh                  # Build + start script
├── main.py                   # Python entry point (Hello world)
├── tsconfig.json             # Root TS config
├── pyrightconfig.json        # Python type config
├── jest.config.js            # Root Jest config
├── jest.backend.config.js    # Backend Jest
├── jest.backend.runtime.config.js
├── jest.reporters.js         # JUnit reporter
├── playwright.config.js      # Playwright config
├── launch.json               # VSCode launch
│
├── pyproject.toml            # Python deps
└── logs/                     # Log directory
```

## backend/

```
backend/
├── core/
│   ├── database/
│   │   ├── conexao.js         # DB pool (Postgres + MySQL) + queue system
│   │   ├── conexao.py          # Python DB access
│   │   ├── dataValidation.js   # Validation interceptor
│   │   ├── validationInterceptor.js
│   │   ├── README.md
│   │   ├── migrations/         # V1__... → V40__... (40 migrations SQL)
│   │   ├── backups/           # Schema + scripts
│   │   └── performance/       # Performance scripts
│   │
│   ├── backups/
│   │   ├── schema/
│   │   │   ├── initial_schema.sql
│   │   │   └── performance_indexes.sql
│   │   ├── scripts/
│   │   │   ├── backup.js, restore.js, setup_postgres.js, createDb.js
│   │   │   ├── cleanup_duplicate_indexes.sql
│   │   │   └── archive/
│   │   └── archive/
│   │
│   └── migrations/            # ALSO here (V26__add_okx, V34__rename, etc.)
│
├── exchanges/
│   ├── binance/
│   │   ├── api/
│   │   │   ├── rest.js
│   │   │   └── websocketApi.js
│   │   ├── monitoring/
│   │   │   ├── core/
│   │   │   │   └── MonitorOrchestrator.js
│   │   │   ├── trailingStopLoss.js
│   │   │   └── (outros monitores)
│   │   ├── processes/
│   │   │   ├── app.js
│   │   │   └── instanceManager.js
│   │   ├── services/
│   │   │   └── positionSync.js
│   │   ├── strategies/
│   │   │   └── reverse.js
│   │   └── automation/ (se existir)
│   │
│   ├── mexc/
│   │   ├── automation/         # Browser automation (playwright + nodriver)
│   │   ├── browser/            # Browser session management
│   │   ├── api/
│   │   └── services/
│   │
│   ├── bybit/
│   ├── bingx/
│   ├── okx/
│   └── hyperliquid/
│
├── server/
│   ├── api.js                  # Fastify entry point (horistic-api PM2 app)
│   ├── middleware/             # Auth, rate-limit, distributor, cors, helmet, etc.
│   ├── routes/
│   │   └── auth/
│   │       └── index.js        # Auth routes
│   ├── ws/                     # WebSocket handlers
│   └── utils/
│
├── services/
│   ├── unified-bot-launcher.js # PM2 app
│   ├── billing_session.js
│   └── (outros)
│
├── indicators/
│   ├── pine/                   # Pine Script indicators
│   ├── utils/
│   ├── strategy_builder/
│   ├── webhook/
│   │   └── webhookSignals.js   # PM2 app (port 8099)
│   ├── divap.py                # Python indicator (PM2 app)
│   └── __pycache__/
│
├── backtest/
│   └── divap_backtest.py       # Python backtest engine
│
├── telegram/
│   └── (bot handlers)
│
├── utils/
│   └── scripts/               # Utility scripts (MEXC auth gate, regression, etc.)
│
└── sessions/                  # Session management
```

## frontend/

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (root files) page.tsx, layout.tsx, globals.css, app.tsx
│   │   ├── admin/
│   │   ├── api/
│   │   ├── backtest/
│   │   ├── dashboard/
│   │   ├── login/              # Login page (page.tsx)
│   │   ├── painel/
│   │   ├── sinal/
│   │   ├── strategy/
│   │   ├── unauthorized/
│   │   ├── global-error.tsx
│   │   └── home-client.tsx
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── login-form.tsx      (30KB — maior componente)
│   │   │   ├── conditional-auth-provider.tsx
│   │   │   ├── protected-route.tsx
│   │   │   └── PermissionGate.tsx
│   │   ├── layout/
│   │   ├── modals/
│   │   └── ui/
│   │
│   ├── lib/
│   ├── hooks/
│   ├── types/
│   └── styles/
│
├── package.json                # Next.js + deps
├── .eslintrc.json
├── .stylelintrc.json
├── components.json             # shadcn/ui ou similar
├── next.config.mjs
├── tailwind.config.js
├── tsconfig.json
├── start.js                    # Custom start script
├── start-filtered.sh
├── playwright.config.js
├── playwright-report/
├── sessions/                  # Frontend session files
└── public/                     # Static assets
```

## docs/

```
docs/
├── architecture/
├── backend/                    # 195 arquivos de docs backend
├── changelog/                  # 73 arquivos de changelog
├── development/
├── fix/
├── frontend/
├── infrastructure/            # 25 arquivos
├── mcp/
├── operations/
├── prompts/
├── quality/
├── scripts/
├── assets/
└── rename-report-2026-04-10.md
```

## tests/

```
tests/
├── backend/
│   ├── exchanges/
│   │   └── mexc/
│   │       ├── regression/
│   │       └── (outros)
│   └── auth/
│
└── frontend/
    └── auth/
```

## Config

```
config/
├── (arquivos de configuração)
```

## Naming Conventions

### Backend Node (JavaScript)
- **Files**: kebab-case: `monitor-orchestrator.js`, `trailing-stop-loss.js`
- **Services/Modules**: camelCase: `positionSync`, `instanceManager`
- **Classes**: PascalCase: (não observado no backend)
- **Constants**: SCREAMING_SNAKE_CASE: `MAX_RESTARTS`, `LOG_DATE_FORMAT`

### Python
- **Files**: snake_case: `conexao.py`, `divap_backtest.py`
- **Functions/Classes**: snake_case + PascalCase (Pydantic/FastAPI)

### Database Migrations
- Pattern: `V{number}__{description}.sql`
- Examples: `V34__rename_user_account_exchange_tables_v2.sql`
- Sequential numbering (V1 → V40)
- Never reuse numbers

### Git Commits
- Conventional-ish: `feat(...)`, `fix(...)`, `chore(...)`, `docs(...)`, `test(...)`
- Examples: `fix(MEXC): Correct screenshot paths`
- GSD snapshots: `gsd snapshot: pre-dispatch, uncommitted changes after N m inactivity`

## Key Paths (Invariants)

- Backend entry: `backend/server/api.js`
- Frontend entry: `frontend/node_modules/next/dist/bin/next start -p 3015`
- DB connection Node: `backend/core/database/conexao.js`
- DB connection Python: `backend/core/database/conexao.py`
- Migrations: `backend/core/migrations/V{number}__{desc}.sql`
- PM2 config: `ecosystem.config.js` (raiz)
- Docs: `docs/` (195 arquivos)