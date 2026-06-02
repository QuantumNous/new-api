# CONCERNS — Atius Monorepo

> Mapeado a partir do código real em `/home/ubuntu/GitHub/atius/`. Atualizado: 2026-06-02.

## Technical Debt

### Database Schema Churn
- 40+ migrations em sequência (V1..V40)
- Múltiplos renames de tabelas/colunas (V34, V36, V37, V38, V39)
- `user_account_exchange` → `user_account` (V34)
- `user_account_config_conta_id` → `account_id` (V37)
- `user_strategies` → `user_account_strategies` (V39)
- **Concern**: Renames frequentes indicam falta de upfront design. Cada rename quebra queries existentes e requer migration roll-out.

### Dual Database Pools
- `conexao.js` mantém pool PostgreSQL + pool MySQL simultaneamente
- Não está claro qual dado está em qual DB
- **Concern**: Confusão sobre data ownership. MySQL pode ser legado não documentado.

### Python Queue System (conexao.py)
- Threading-based queue system para DB writes
- `_table_queues` + `_table_locks` + threading
- Não usa async Python (não usa `asyncpg` no async path)
- **Concern**: Threading em código production. Preferir async/await com `asyncpg`.

### Monorepo Cross-Reference
- `ecosystem.config.js` referencia `HORISTIC_ROOT` (outro repo em `/home/ubuntu/GitHub/horistic`)
- Backend código em atius/ mas executado de horistic/ (cwd)
- **Concern**: Strong coupling entre atius e horistic. Mudar horistic quebra atius.

### Browser Automation (MEXC)
- `nodriver` + `playwright-extra` coexistindo
- Não está claro qual é primary para qual task
- MEXC bypass mechanism é frágil (baseado em session cookies + browser automation)
- **Concern**: Anti-bot bypass pode quebrar a qualquer update do MEXC. Manutenção contínua.

### Legacy Express + Fastify
- API usa Fastify (moderno) mas WebSocket handlers usam Express raw
- Duas abstrações coexistindo
- **Concern**: Inconsistência de middleware. Auth middleware não cobre WS path.

## Known Bugs / Fragile Areas

### DB Queue Deadlock
- `enqueue_db_operation` em `conexao.js` tenta prevenir deadlocks mas usa threading lock simples
- Se o operation fn throw, queue pode ficar stuck
- **Known**: `enqueue_db_operation` usa `result_holder` com threading event — não há timeout

### MEXC Session Recovery
- `sessionHealer` é fragile — tenta recover broken sessions
- Se MEXC muda estrutura de cookies, session recovery falha silently
- **Known**: MEXC anti-bot detection evolves constantly

### Position Sync Race
- `positionSync.js` sincroniza posições entre exchange e DB
- Race condition possible se múltiplos webhooks chegam simultaneamente
- **Concern**: Webhook handler em `webhookSignals.js` não serializa por account

### API Memory Leaks
- `axios` não configura `maxSockets` ou `maxTotalSockets`
- Sem connection pool limits configurados
- **Concern**: Long-running process pode leak connections

### WebSocket Reconnection
- Binance WebSocket (`websocketApi.js`) não tem automatic reconnection backoff
- Se exchange disconnects, reconnect pode loop rapidamente
- **Concern**: Não há circuit breaker

## Security Concerns

### Secrets in Env
- Exchange API keys, DB credentials, Telegram tokens todos em `.env`
- `.env` não commitado mas acessível a quem tem acesso ao FS
- **Concern**: Compartilhamento de `.env` entre devs é arriscado

### MEXC Cookie Storage
- `mexc_browser_session` table storeia cookies sensíveis (session cookies)
- Não está claro se cookies são encryptados
- **Concern**: Se DB é comprometido, todos os MEXC sessions são comprometidos

### No Rate Limiting on Webhook
- `webhookSignals.js` (port 8099) accepts signals sem authentication apparent
- Qualquer um pode enviar sinais que disparam trades
- **Concern**: Webhook deve ter authentication (API key ou HMAC signature)

### Password Storage
- bcrypt usado (bom) mas salt rounds não especificado
- **Check**: verificar `bcrypt` rounds config em `backend/server/routes/auth/index.js`

## Performance Concerns

### PM2 Fork Mode
- 7 processos em fork mode — nenhum usa cluster
- `atius-web` (Next.js) é single-threaded
- **Concern**: Não aproveita multi-core. Next.js production build é Node.js que pode usar cluster.

### No Redis Cache
- Sistema usa PostgreSQL para state mas não tem Redis
- Session data, cache de rates, etc. vai direto no DB
- **Concern**: DB becomes bottleneck under load

### Large Backend Tree
- `backend/exchanges/` tem 11K+ arquivos (probavelmente node_modules ou artifacts)
- `backend/` principal: 66 arquivos em `core/`, 11791 em `exchanges/`
- **Concern**: Build, test, and deploy operations são lentos

### Database Connection Limits
- `pg` pool default pode não ser suficiente para 7 PM2 apps
- **Check**: `conexao.js` pool size config

## Performance Bottlenecks

### MEXC Browser Automation
- nodriver + playwright rodando em headless Chrome para cada operation
- Isso é I/O-bound e memory-heavy
- **Concern**: Scaling horizontally é complexo (precisa um browser por instance)

### Backtest (divap_backtest.py)
- vectorbt backtest pode ser memory-intensive para grandes datasets
- Não há mention de limiting dataset size
- **Concern**: Backtest pode OOM em symbols com muitos candles

## Open Questions

1. **MySQL usage**: Qual dado está em MySQL vs PostgreSQL? Por que dual pool?
2. **Redis**: Há server Redis no ecossistema? Não está no package.json deps
3. **MEXC automation resilience**: O que acontece quando MEXC muda anti-bot?
4. **Multi-tenant**: Sistema suporta múltiplos usuários ou é single-tenant?
5. **Backup strategy**: Como backups de PostgreSQL são feitos? Há schedule?
6. **Horistic coupling**: Por que ecosystem.config.js referencia HORISTIC_ROOT?

## Fragile Areas (Summary)

| Area | Risk | Impact |
|------|------|--------|
| MEXC browser automation | HIGH | Trading stops |
| DB queue threading | MEDIUM | Data inconsistency |
| Webhook auth | HIGH | Unauthorized trades |
| PM2 fork mode (Next.js) | MEDIUM | Performance under load |
| Dual DB pools | LOW | Confusion |
| Schema churn | MEDIUM | Migration bugs |