# TESTING — Atius Monorepo

> Mapeado a partir do código real em `/home/ubuntu/GitHub/atius/`. Atualizado: 2026-06-02.

## Test Frameworks

### Backend (Node.js)
- **Framework**: Jest (`jest`, `@babel/core`, `@babel/preset-env`)
- **Config**: `jest.backend.config.js` (backend Node), `jest.backend.runtime.config.js` (runtime tests)
- **Reporter**: JUnit XML output para CI (`jest.reporters.js`)
- **Mode**: `--ci --runInBand` para CI (sequencial, não paralelo)

### Frontend
- **Framework**: Playwright (`playwright`)
- **Config**: `playwright.config.js`
- **Report**: `playwright-report/` dir

### Python
- **Framework**: pytest `>=9.0.2` (dependency group dev em pyproject.toml)
- **Usage**: Não observado testes Python ativos — provavelmente para backtest e indicadores

## Test Directory Structure

```
tests/
├── backend/
│   ├── exchanges/
│   │   └── mexc/
│   │       ├── regression/          # Regression suite MEXC
│   │       ├── automation/
│   │       └── (outros)
│   ├── auth/                        # Auth tests
│   └── (outros)
│
└── frontend/
    └── auth/                        # Frontend auth tests
```

## Backend Jest — Detailed Config

### jest.backend.config.js
```javascript
// Test patterns: *.test.js
// Config: jest.backend.config.js
// Reporter: JUnit XML via jest.reporters.js
// CI command: CI=true JEST_JUNIT_ENABLED=1 jest --config jest.backend.config.js --ci --runInBand
```

### jest.backend.runtime.config.js
```javascript
// Runtime tests: *.runtime.test.js (live API tests)
// Executado separadamente com RUN_LIVE_API_TESTS env var
// CI: CI=true JEST_JUNIT_ENABLED=1 jest --config jest.backend.runtime.config.js
```

### jest.reporters.js
- JUnit XML output para integração CI/CD
- Output: `backend-junit.xml`, `backend-runtime-junit.xml`

## Naming Patterns

### Backend
- `*.test.js` — unit tests (Jest)
- `*.runtime.test.js` — runtime/live API tests

### Frontend
- Não especificado — Playwright usa `*.spec.ts` ou `*.test.ts`

## Mocking Strategy

### Manual Mocks
- `__mocks__/` dir para mocks manuais
- `jest.mock()` para mocking inline

### Common Mocks
- Exchange API mocks (não hitting real exchanges em tests)
- Database mocks (pool mock para não precisar Postgres real)
- Telegram bot mocks

## CI/CD Integration

### Backend Tests
```bash
# Unit tests
npm run test:backend:jest
# or
CI=true JEST_JUNIT_ENABLED=1 JEST_JUNIT_OUTPUT_NAME=backend-junit.xml \
  jest --config jest.backend.config.js --ci --runInBand

# Runtime tests
npm run test:backend:runtime
# or
CI=true JEST_JUNIT_ENABLED=1 JEST_JUNIT_OUTPUT_NAME=backend-runtime-junit.xml \
  jest --config jest.backend.runtime.config.js --ci --runInBand
```

### Frontend Tests (Playwright)
```bash
# Commands em package.json (frontend/package.json)
# Verificar playwright scripts específicos
```

## Live Test Mode

### RUN_LIVE_API_TESTS
```bash
# Ativa testes de API real (não mocks)
RUN_LIVE_API_TESTS=true npm run test:backend:runtime:live
# ou
RUN_LIVE_API_TESTS=true jest --config jest.backend.runtime.config.js
```

## Playwright Config

```javascript
// playwright.config.js (raiz)
// playwright.config.js (frontend/)
// Playwright tests: tests/frontend/ (não especificado)
```

## Coverage Approach

- JUnit XML output para CI parsing (Jenkins, GitHub Actions, etc.)
- No coverage report mentioned (sem istanbul/nyc)
- Tests run `--ci --runInBand` (sequencial, não paralelo para evitar race conditions)

## Test Execution

```bash
# All tests
npm run test  # → test:backend:jest

# Backend unit
npm run test:backend:jest

# Backend runtime
npm run test:backend:runtime

# Backend CI
npm run test:backend:ci

# Frontend
npm run test:frontend  # Verificar em package.json
```

## MEXC Regression Suite

Tests específicos para MEXC:
- `tests/backend/exchanges/mexc/regression/` — regressão de automação
- Regression gate: `npm run mexc:regression-gate` + `mexc:regression-gate:strict`
- Truth baseline recheck: `npm run mexc:truth-baseline:recheck`

## Browser Automation Testing

- Playwright usado para MEXC browser automation testing
- Tests em `backend/exchanges/mexc/automation/` e `tests/backend/exchanges/mexc/`
- Chromium via `npm run mexc:browser:install`