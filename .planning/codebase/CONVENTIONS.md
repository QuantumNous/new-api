# CONVENTIONS — Atius Monorepo

> Mapeado a partir do código real em `/home/ubuntu/GitHub/atius/`. Atualizado: 2026-06-02.

## Code Style

### ESLint
- `.eslintrc.json` em `frontend/` (TypeScript, Next.js rules)
- Root `.eslintrc.json` (backend Node — verificar)
- Padrão: ESLint recommended + Next.js plugin + TypeScript plugin

### TypeScript
- Frontend: TypeScript estrito (Next.js 15, tsconfig.json)
- Backend Node: **JavaScript puro** (sem tsc, sem TypeScript compiler)
- Python: pyright para type checking

### Indentation
- 2 spaces (padrão Next.js/ESLint default)
- Não 4 spaces, não tabs

### Quotes
- Single quotes para strings em JS (`'hello'`)
- Double quotes para strings em JSX (`<div className="foo">`)
- Confirmação: verificar `.eslintrc.json` `quotes` rule

### Semicolons
- Provavelmente sim (padrão ESLint)
- Confirmação: verificar `.eslintrc.json` `semi` rule

### Line endings
- LF (Unix) — projeto em ambiente Linux

## Naming Conventions

### JavaScript (Backend Node)

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `monitor-orchestrator.js`, `trailing-stop-loss.js` |
| Services/Modules | camelCase | `positionSync`, `instanceManager`, `webhookSignals` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RESTARTS`, `LOG_DATE_FORMAT`, `DEFAULT_TIMEOUT` |
| Enums-like objects | SCREAMING_SNAKE_CASE | `ORDER_STATUS`, `EXCHANGE_IDS` |
| DB column constants | SCREAMING_SNAKE_CASE | `commonGroupCol`, `commonKeyCol` |

### Python

| Type | Convention | Example |
|------|-----------|---------|
| Files | snake_case | `conexao.py`, `divap_backtest.py` |
| Functions/Classes | snake_case + PascalCase | `def enqueue_db_operation`, `class DataValidation` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_POOL_SIZE` |

### Database

| Type | Convention | Example |
|------|-----------|---------|
| Tables | snake_case (plural-ish) | `posicoes_fechadas`, `user_account_config` |
| Columns | snake_case | `preco_entrada`, `account_id`, `exchange_slug` |
| Sequences | snake_case | (gerenciado pelo GORM ou manual) |

### Git Commits
- Formato: `type(scope): description`
- Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `merge`
- GSD snapshots: `gsd snapshot: pre-dispatch, uncommitted changes after Nm inactivity`

## Error Handling

### Backend Node
```javascript
// Try/catch com logging
try {
    const result = await dbOperation();
} catch (err) {
    console.warn(`[CONTA-${accountId}] [DB_MOVE] Erro ao arredondar: ${err.message}`);
    // Não throw — tentando recovery
}

// Async/await com tratamento
async function handleSignal(req, res) {
    try {
        const signal = await validateSignal(req.body);
        await processSignal(signal);
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('[SIGNAL] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
```

### Custom Error Classes
- Não observado custom error classes — usa Error nativo

### Validation
- `validationInterceptor.js` — validação de dados de entrada
- `dataValidation.js` — validação de dados
- `dataValidation.validatePosition()` — validação de posições

## Logging Conventions

### Backend Node (pino-pretty)
```javascript
// Tags estruturadas
console.warn(`[CONTA-${accountId}] [DB_MOVE] Erro ao arredondar preco_saida`);
console.error('[SIGNAL] Error processing signal:', err);
console.log('[API] Request received:', req.method, req.url);

// Padrão de tags
// [AREA] [SUBCOMPONENT] Message
// [CONTA-{id}] [DB_MOVE] Message
// [MEXC] [SESSION] Message
// [SIGNAL] Message
```

### PM2
- `log_date_format: 'YYYY-MM-DD HH:mm:ss'` em todas as apps
- `merge_logs: true` — logs agregados
- `pm2 logs` para visualização

### Python
```python
# Logging padrão Python
import logging
logger = logging.getLogger(__name__)
logger.error("message")
```

## Comment Standards

### JSDoc
- Não observado uso massivo de JSDoc
- Comentários inline para explicar decisões complexas

### Inline
```javascript
// Função para carregar validationInterceptor dinamicamente (evita dependência circular)
let validationInterceptor = null;
```

### Python Docstrings
- Não observado docstrings em todas as funções
- Funções críticas têm docstrings

## Database Conventions

### GORM-like (Node) — manual query builder
- Queries via `pg` client (não GORM)
- Filas de operações por tabela (`enqueue_db_operation`)

### Migrations
- SQL puro (não ORM migrations)
- Patologia: migrations renomeiam tabelas/colunas frequentemente
- V34: renomeou `user_account_exchange` → `user_account`
- V35: criou `user_strategies` + linked `account_config`
- Nunca drop columns sem backup

### Cross-DB Compatibility
- Dual pool: PostgreSQL + MySQL
- `commonGroupCol`, `commonKeyCol` para colunas que são palavras reservadas
- Boolean handling: Postgres `true/false` vs MySQL `1/0`

## API Conventions

### REST
- Backend: Fastify routes
- Frontend: Next.js API routes (`frontend/src/app/api/`)

### WebSocket
- `ws` raw — não socket.io
- Handler files em `backend/server/ws/`

### Response Shape
```javascript
// Sucesso
res.status(200).json({ ok: true, data: result });

// Erro
res.status(500).json({ error: err.message });
res.status(400).json({ error: 'Invalid signal' });
```

## Testing Conventions

Ver `TESTING.md` para cobertura completa.