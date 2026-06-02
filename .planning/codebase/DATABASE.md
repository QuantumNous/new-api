# DATABASE — Atius

> PostgreSQL schema, tables, migrations, DB operations.
> Repo: `/home/ubuntu/GitHub/atius/`
> Updated: 2026-06-02.

## Databases

| DB | Client | Purpose |
|----|--------|---------|
| PostgreSQL | `pg` (Node), `psycopg2`/`asyncpg` (Python) | Primary — all trading data |
| MySQL | `mysql2` | Legacy? — dual pool coexisting |

**Connection files** (CRITICAL — não mover):
- Node: `backend/core/database/conexao.js`
- Python: `backend/core/database/conexao.py`
- README: `backend/core/database/README.md`

## Schema (from initial_schema.sql)

### Core Tables

#### user
```sql
CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,          -- bcrypt hash
    nome VARCHAR(100),
    sobrenome VARCHAR(100),
    ativa BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,

    -- RBAC permissions
    can_access_backtest BOOLEAN DEFAULT false,
    can_access_dashboard BOOLEAN DEFAULT false,
    can_access_automation BOOLEAN DEFAULT false,
    can_access_trade BOOLEAN DEFAULT false,
    can_access_lc BOOLEAN DEFAULT false,

    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ultima_atualizacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### corretoras (Exchanges)
```sql
CREATE TABLE IF NOT EXISTS corretoras (
    id SERIAL PRIMARY KEY,
    corretora VARCHAR(50) NOT NULL,       -- 'binance', 'mexc', 'bybit', 'okx'
    ambiente VARCHAR(20) NOT NULL,         -- 'prd', 'testnet'
    spot_rest_api_url VARCHAR(255),
    futures_rest_api_url VARCHAR(255),
    futures_ws_market_url VARCHAR(255),
    futures_ws_api_url VARCHAR(255),
    ativa BOOLEAN DEFAULT true,
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ultima_atualizacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(corretora, ambiente)
);
```

**Seed data** (from initial_schema.sql):
```
(binance, prd), (binance, testnet), (bybit, prd), (bybit, testnet)
```
More added via migrations (MEXC=?, OKX=1005/1006/1007, Hyperliquid=V7).

#### user_account_exchange
```sql
CREATE TABLE IF NOT EXISTS user_account_exchange (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    id_corretora INT DEFAULT 1 REFERENCES corretoras(id),
    api_key VARCHAR(255) NOT NULL,
    api_secret VARCHAR(255) NOT NULL,
    ws_api_key VARCHAR(255),
    ws_api_secret VARCHAR(255),
    testnet_spot_api_key VARCHAR(255),
    testnet_spot_api_secret VARCHAR(255),
    telegram_chat_id BIGINT,
    ativa BOOLEAN DEFAULT true,
    max_posicoes INT DEFAULT 5,
    saldo_futuros DECIMAL(20,8),
    saldo_spot DECIMAL(20,8),
    saldo_base_calculo_futuros DECIMAL(20,8),
    saldo_base_calculo_spot DECIMAL(20,8),
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ultima_atualizacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    celular VARCHAR(20)
);
```
Renamed: `user_account_exchange` → `user_account` (V34).

#### configuracoes
```sql
CREATE TABLE IF NOT EXISTS configuracoes (
    id SERIAL PRIMARY KEY,
    chave_api VARCHAR(255) NOT NULL,
    chave_secreta VARCHAR(255) NOT NULL,
    bot_token VARCHAR(255),
    api_url VARCHAR(255),
    ambiente VARCHAR(50),
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ultima_atualizacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### exchange_symbols
```sql
CREATE TABLE IF NOT EXISTS exchange_symbols (
    id SERIAL PRIMARY KEY,
    id_corretora INT REFERENCES corretoras(id),
    symbol VARCHAR(50) NOT NULL,
    base_asset VARCHAR(50),
    quote_asset VARCHAR(50),
    status VARCHAR(20),
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### exchange_filters (Binance Trading Rules)
```sql
CREATE TABLE IF NOT EXISTS exchange_filters (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    id_corretora INT REFERENCES corretoras(id),
    filter_type VARCHAR(50),
    filter_value JSONB,
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, id_corretora, filter_type)
);
```

#### exchange_leverage_brackets
```sql
CREATE TABLE IF NOT EXISTS exchange_leverage_brackets (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50),
    id_corretora INT REFERENCES corretoras(id),
    bracket INT,
    max_leverage DECIMAL(10,2),
    min_margin_rate DECIMAL(10,5),
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Trading Tables

#### posicoes (Open Positions)
```sql
CREATE TABLE IF NOT EXISTS posicoes (
    id SERIAL PRIMARY KEY,
    conta_id INT REFERENCES user_account_exchange(id),
    simbolo VARCHAR(50) NOT NULL,
    side VARCHAR(10),                     -- 'LONG' / 'SHORT'
    tipo VARCHAR(20),                     -- 'LIMIT', 'MARKET', 'STOP'
    quantidade DECIMAL(20,8),
    preco_entrada DECIMAL(20,8),
    preco_atual DECIMAL(20,8),
    leverage INT DEFAULT 1,
    nivel_tp1 DECIMAL(20,8),
    nivel_tp2 DECIMAL(20,8),
    nivel_tp3 DECIMAL(20,8),
    tp1_ativa BOOLEAN DEFAULT false,
    tp2_ativa BOOLEAN DEFAULT false,
    tp3_ativa BOOLEAN DEFAULT false,
    trailing_percent DECIMAL(10,4),
    status VARCHAR(20) DEFAULT 'ABERTA',
    data_hora_entrada TIMESTAMPTZ,
    data_hora_ultima_atualizacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ordem_id VARCHAR(100),
    ativo BOOLEAN DEFAULT true,
    archiving_in_progress BOOLEAN DEFAULT false
);
```

#### posicoes_fechadas (Closed Positions)
```sql
CREATE TABLE IF NOT EXISTS posicoes_fechadas (
    id SERIAL PRIMARY KEY,
    conta_id INT,
    simbolo VARCHAR(50),
    side VARCHAR(10),
    quantidade DECIMAL(20,8),
    preco_entrada DECIMAL(20,8),
    preco_saida DECIMAL(20,8),
    pnl DECIMAL(20,2),
    pnl_percent DECIMAL(10,4),
    fees DECIMAL(20,8),
    realized_pnl DECIMAL(20,2),
    realized_pnl_with_fees DECIMAL(20,2),
    leverage INT,
    exit_reason VARCHAR(50),
    data_hora_entrada TIMESTAMPTZ,
    data_hora_saida TIMESTAMPTZ,
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```
Added: V1 (pnl columns), V4 (realized_pnl, fees, realized_pnl_with_fees).

#### ordens (Orders)
```sql
CREATE TABLE IF NOT EXISTS ordens (
    id SERIAL PRIMARY KEY,
    conta_id INT REFERENCES user_account_exchange(id),
    simbolo VARCHAR(50) NOT NULL,
    side VARCHAR(10),
    tipo VARCHAR(20),
    quantidade DECIMAL(20,8),
    preco DECIMAL(20,8),
    stop_price DECIMAL(20,8),
    ordem_exchange_id VARCHAR(100),
    status VARCHAR(20),
    filled_quantity DECIMAL(20,8) DEFAULT 0,
    data_hora_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    data_hora_ultima_atualizacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```
V2: unique constraint on (conta_id, simbolo, ordem_exchange_id).

#### ordens_fechadas (Closed Orders)
```sql
CREATE TABLE IF NOT EXISTS ordens_fechadas (
    id SERIAL PRIMARY KEY,
    conta_id INT,
    simbolo VARCHAR(50),
    side VARCHAR(10),
    tipo VARCHAR(20),
    quantidade DECIMAL(20,8),
    preco DECIMAL(20,8),
    preco_medio DECIMAL(20,8),
    ordem_exchange_id VARCHAR(100),
    fees DECIMAL(20,8),
    data_hora_criacao TIMESTAMPTZ,
    data_hora_fechamento TIMESTAMPTZ,
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Exchange-Specific Tables

#### binance_fills (implicit — fills table, V1)
#### bybit_fills
```sql
-- From V3: bybit_fills
CREATE TABLE IF NOT EXISTS bybit_fills (
    id SERIAL PRIMARY KEY,
    trade_id TEXT,               -- altered to TEXT in V5
    conta_id INT,
    symbol VARCHAR(50),
    side VARCHAR(10),
    qty DECIMAL(20,8),
    price DECIMAL(20,8),
    -- ...
);
```

#### exchange_updates_log (V6)
```sql
CREATE TABLE IF NOT EXISTS exchange_updates_log (
    id SERIAL PRIMARY KEY,
    exchange VARCHAR(50),
    update_type VARCHAR(50),
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### signal_account
```sql
CREATE TABLE IF NOT EXISTS signal_account (
    id SERIAL PRIMARY KEY,
    position_id INT,            -- FK to posicoes
    signal_id INT,              -- FK to signals_analysis
    account_id INT,             -- FK to user_account
    status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### signals_analysis
```sql
CREATE TABLE IF NOT EXISTS signals_analysis (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50),
    signal_data JSONB,
    received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### signals_msg
```sql
CREATE TABLE IF NOT EXISTS signals_msg (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255),
    content TEXT,
    parsed_data JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### monitoramento
```sql
CREATE TABLE IF NOT EXISTS monitoramento (
    id SERIAL PRIMARY KEY,
    conta_id INT,
    tipo_monitoramento VARCHAR(50),
    status VARCHAR(20),
    last_check TIMESTAMPTZ,
    data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### backtest_signals / backtest_results
```sql
-- Backtest data tables
CREATE TABLE IF NOT EXISTS backtest_signals (
    id SERIAL PRIMARY KEY,
    -- ...
);
CREATE TABLE IF NOT EXISTS backtest_results (
    id SERIAL PRIMARY KEY,
    -- ...
);
```

#### logs
```sql
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20),
    source VARCHAR(100),
    message TEXT,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### MEXC-Specific Tables

#### mexc_browser_session (V23)
```sql
-- Created V23: mexc_browser_session
-- Stores MEXC browser automation session data
-- Fields: session cookies, user center auth, etc.
```

#### mexc_session_handshake_telemetry (V32, V33)
```sql
-- Created V32: mexc_session_handshake_telemetry
-- V33: extends with cookie_uc_tracking
-- Tracks handshake telemetry for MEXC session recovery
```

### Strategy Tables

#### user_strategies (V35 → renamed to user_account_strategies in V39)
#### user_account_strategies
```sql
-- Created V35: user_strategies + account_config linking
-- Renamed V39: user_strategies → user_account_strategies
```

### Hyperliquid Table

#### hyperliquid_wallet (V7)
```sql
-- Created V7: hyperliquid_wallet
-- Wallet address + expiration for Hyperliquid
```

## Migration System

### Location
`backend/core/migrations/` — V1__...sql through V40__...sql

### Naming
Pattern: `V{number}__{description}.sql`

### Migration List (40 total)

| # | File | Purpose |
|---|------|---------|
| V1 | add_pnl_columns_to_posicoes_fechadas | PnL tracking |
| V2 | add_unique_constraint_to_ordens | Ordens constraints |
| V3 | create_bybit_fills_table | Bybit fills |
| V4 | add_realized_pnl_fees_total_to_posicoes | Fees |
| V5 | alter_fills_bybit_trade_id_to_text | Bybit trade_id type |
| V6 | create_exchange_updates_log | Updates log |
| V7 | add_hyperliquid_and_wallet_expiration | Hyperliquid |
| V8 | increase_backtest_numeric_precision | Precision |
| V9 | add_multibroker_columns_webhook_signals | Multi-broker signals |
| V10 | add_archival_in_progress_to_posicoes | Archival |
| V11 | add_tp_strategy_and_percentages | TP strategy |
| V12 | add_tp_config_columns | TP config |
| V13 | add_use_max_leverage_column | Max leverage |
| V14 | add_bybit_affiliate | Bybit affiliate |
| V15 | add_lc_access_and_tables | LC tables |
| V16 | add_user_id_to_lc_tables | User ID |
| V17 | add_remindset_strategy | Remindset |
| V18 | rename_corretoras_to_exchange_add_fees | Exchange rename + fees |
| V19 | rename_lc_to_strategy_tables | Strategy rename |
| V20 | rename_tables_to_user_account | User account tables |
| V21 | rename_lc_sequences_to_strategy | Sequences |
| V22 | add_symbol_fee_columns | Fees per symbol |
| V23 | add_mexc_browser_sessions | MEXC sessions |
| V24 | add_mexc_automation_bypass | MEXC bypass |
| V25 | add_okx_exchange | OKX |
| V26 | add_okx_nacional_and_accounts | OKX Nacional |
| V27 | add_api_key_passphrase_column | OKX passphrase |
| V28 | add_strategy_builder_symbol_conditions | Strategy builder |
| V29 | add_exchange_ccxt_ohlcv_limits | CCXT limits |
| V30 | add_manual_stop_bot_status_columns | Manual stop |
| V31 | add_mexc_execution_policy | MEXC execution |
| V32 | add_mexc_session_handshake_telemetry | MEXC telemetry |
| V33 | extend_mexc_session_handshake_telemetry_cookie_uc_tracking | Cookie tracking |
| V34 | rename_user_account_exchange_tables_v2 | MAJOR RENAME |
| V35 | create_user_strategies_and_link_account_config | Strategies |
| V36 | rename_user_account_id_corretora_to_exchange_id | Rename |
| V37 | rename_user_account_config_conta_id_to_account_id | Rename |
| V38 | rename_user_account_config_exchange_to_exchange_slug | Rename |
| V39 | rename_user_strategies_to_user_account_strategies | Rename |
| V40 | add_tp6_support | TP6 support |

### Schema Evolution Pattern

```sql
-- V34: Renames user_account_exchange → user_account
ALTER TABLE user_account_exchange RENAME TO user_account;
ALTER SEQUENCE user_account_exchange_id_seq RENAME TO user_account_id_seq;
ALTER INDEX idx_user_account_exchange_conta_id RENAME TO idx_user_account_conta_id;
-- ... and 20+ more renames
```

## Connection Architecture (Node)

### conexao.js — Queue System

```javascript
// Global operation queue per table (deadlock prevention)
const queues = new Map();       // table → [wrapped_functions]
const isProcessing = new Map();  // table → bool

// Enqueue operation by accountId + table
function enqueueDbOperation(accountId, baseKey, dbOperationFn) {
    // Normaliza accountId para string
    // Lock por table (não por account) — serializa writes na tabela
    // Executa sequencialmente
    // event.wait() bloqueia caller até completar
    // Sem timeout — se operation fn throw, queue pode ficar stuck
}

// Example usage:
const metrics = await enqueueDbOperation(
    accountId, 'posicoes_fechadas',
    async () => {
        // INSERT + UPDATE + DELETE dentro da mesma transação
        // positionSync.js pattern
    }
);
```

**Key files using this pattern**:
- `backend/exchanges/binance/services/positionSync.js`
- `backend/core/database/conexao.js` (definition)

### Pool Config

```javascript
// conexao.js
const pool = new Pool({
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // ... (verificar config real)
});
```

## Connection Architecture (Python)

### conexao.py — Threading Queue

```python
import threading
from queue import Queue

_table_queues = {}
_table_locks = {}
_lock = threading.Lock()

def enqueue_db_operation(query: str, params: tuple, op_fn):
    table = _get_table_from_query(query)
    lock = _table_locks[table]
    queue = _table_queues[table]

    def wrapped():
        result_holder['result'] = op_fn()
        # ou result_holder['error'] = e

    with lock:
        queue.append(wrapped)
        if len(queue) == 1:
            threading.Thread(target=_process_table_queue, args=(table,)).start()

    event.wait()
    if 'error' in result_holder: raise result_holder['error']
    return result_holder['result']
```

**Concern**: Threading-based queue em código production. Preferir async/await com `asyncpg`.

## Cross-DB Compatibility

### Boolean Handling
```javascript
// Postgres: true/false
// MySQL: 1/0
commonTrueVal / commonFalseVal
// (não verificado se isso existe em conexao.js)
```

### Column Quoting
```javascript
// Postgres: "column"
// MySQL: `column`
commonGroupCol / commonKeyCol // for reserved words
```

## Indexes (from performance_indexes.sql)

```sql
-- Performance critical
CREATE INDEX idx_critical_position_signal_join ON posicoes (status, conta_id, id);
CREATE INDEX idx_critical_signal_account_join ON signal_account (position_id, conta_id);
CREATE INDEX idx_critical_sync_positions ON posicoes (conta_id, simbolo, status, data_hora_ultima_atualizacao);
CREATE INDEX idx_critical_distinct_symbols ON posicoes (conta_id, simbolo);
CREATE INDEX idx_critical_user_lookup ON "user" (lower(email));
CREATE INDEX idx_critical_exchange_symbol ON exchange_symbols (id_corretora, symbol);
```

## Backup Scripts

**Location**: `backend/core/backups/scripts/`
- `backup.js` — full database backup
- `restore.js` — restore from backup
- `setup_postgres.js` — initial PostgreSQL setup
- `createDb.js` — create database
- `cleanup_duplicate_indexes.sql` — index maintenance

**Schema**: `backend/core/backups/schema/`
- `initial_schema.sql` — full schema creation (17 tables)
- `performance_indexes.sql` — performance indexes