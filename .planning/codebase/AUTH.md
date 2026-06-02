# AUTH — Atius (this repo)

> Auth flow, session management, SSO cookie, login page.
> Repo: `/home/ubuntu/GitHub/atius/`
> Updated: 2026-06-02.

## Auth Flow (End-to-End)

```
Browser                    Apache                    Fastify API              PostgreSQL
   |                          |                          |                        |
   |-- GET /login ----------->|                          |                        |
   |                          |-- proxy ---------------->|                        |
   |                          |                          |-- SELECT * FROM "user" |
   |                          |                          |                        |
   |<--------------------- login page (Next.js)          |                        |
   |                          |                          |                        |
   |-- POST /v1/auth/login -->|                          |                        |
   |  { identifier, senha }    |-- proxy ---------------->|                        |
   |                          |                          |-- verify bcrypt -------->|
   |                          |                          |<-- hash match ----------|
   |                          |                          |-- jwt.sign(id,email)    |
   |                          |                          |                        |
   |<----------------- Set-Cookie: auth-token           |                        |
   |    httpOnly; secure; sameSite=lax; domain=.atius.com.br; maxAge=604800       |
   |                          |                          |                        |
   |-- GET /auth/me -------->|                          |                        |
   |  Cookie: auth-token=...  |-- proxy ---------------->|                        |
   |                          |                          |-- jwt.verify ------------>|
   |                          |                          |-- SELECT "user" -------->|
   |                          |                          |                        |
   |<--------------------- { user, expiresIn }            |                        |
```

## Cookie Configuration

**File**: `backend/server/routes/auth/index.js`

```javascript
const COOKIE_OPTIONS = {
  httpOnly: true,          // Inaccessível via JavaScript (XSS protection)
  secure: isProd,          // true em produção (HTTPS only)
  sameSite: 'lax',         // Lax: permite navegação cross-site sem subdomínio
  maxAge: 7 * 24 * 60 * 60, // 604800 segundos = 7 dias
  path: '/',
  domain: isProd ? '.atius.com.br' : undefined // SSO cross-subdomain em produção
};
```

**Cookie name**: `auth-token` (não `session` — isso é o Atius, router-ai-atius usa `session`)

**JWT**: `jsonwebtoken` ^9.0.2
- Payload: `{ id, email, nome, sobrenome }`
- Expiry: `7d`
- Secret: `process.env.JWT_SECRET` (FATAL if undefined — server exits)

## Backend Routes (Fastify)

### POST /v1/auth/login
```javascript
// Verifica login OR username (case insensitive)
// bcrypt.compare(senha, user.senha_hash)
// jwt.sign({ id, email, nome, sobrenome }, JWT_SECRET, { expiresIn: '7d' })
// reply.setCookie('auth-token', token, COOKIE_OPTIONS)
```

### GET /v1/auth/me
```javascript
// Extrai cookie 'auth-token'
// jwt.verify(token, JWT_SECRET)
// SELECT id, email, nome, sobrenome, is_admin FROM "user" WHERE id = ?
// Retorna { user, expiresIn }
```

### POST /v1/auth/register
```javascript
// Cria usuário: nome, sobrenome, email, username, senha (bcrypt hash), bybit_uid
// INSERT INTO "user" (...)
// Auto-login após registro
```

### POST /v1/auth/logout
```javascript
// reply.clearCookie('auth-token', COOKIE_OPTIONS)
// reply.clearCookie('auth-token', { path: '/', httpOnly, secure, sameSite }) // sem domain (fallback)
```

## Frontend: Login Page

**Page**: `frontend/src/app/login/page.tsx`
**Component**: `frontend/src/components/auth/login-form.tsx` (30KB — principal)

### Login Flow (Frontend)

```typescript
// frontend/src/components/auth/login-form.tsx
const handleLogin = async (e: React.FormEvent) => {
  // 1. Validação client-side
  if (!validateLoginForm()) return;

  // 2. POST /v1/auth/login
  const response = await apiClient.login(email, password);

  // 3. Se sucesso → apiClient.setAuthToken(token) + redirect
  // 4. Se erro → showErrorModal
};
```

### Host-Based Post-Login Redirect

**File**: `frontend/src/app/login/page.tsx`

```typescript
const HOST_REDIRECT_MAP: Record<string, string> = {
  'painel.atius.com.br': '/admin',
  'admin.atius.com.br': '/admin',
  'backtest.atius.com.br': '/',
  'backtest.horistic.com': '/',
  'backtest.horistic.ckm': '/',
  'dashboard.atius.com.br': '/',
  'strategy.atius.com.br': '/',
};
const DEFAULT_REDIRECT = '/painel';
```

Ao fazer login em qualquer subdomínio, o Next.js detecta o host e redireciona para a página correta pós-login.

### Auth Context

**File**: `frontend/src/contexts/auth-context.tsx`

```typescript
// Provider: AuthContext
// login(identifier, password) → apiClient.login()
// register(...) → apiClient.register()
// logout() → apiClient.logout()
// checkAuth() → GET /v1/auth/me
// silentRefresh() → POST /v1/auth/refresh (renova token antes de expirar)
// REFRESH_THRESHOLD = 5 minutes (se expira em <5min, faz silent refresh)
```

### API Client

**File**: `frontend/src/lib/api.js`

```javascript
class ApiClient {
  // getApiBaseUrl(): '' no browser, 'http://localhost:PORT' no SSR
  // request(path, options) → adiciona Authorization: Bearer <token>
  //                             ou credentials: 'include' (cookie mode)
  login(identifier, password) { return this.request('/v1/auth/login', { body }) }
  register(...) { return this.request('/v1/auth/register', { body }) }
  logout() { return this.request('/v1/auth/logout', { method: 'POST' }) }
  getBacktests(...) { return this.request('/v1/backtests/list-backtest?...') }
}
```

## RBAC (Permissions)

**File**: `backend/server/middleware/permissions.js`

### Roles
- `is_admin`: Painel administrativo
- `can_access_backtest`: Sistema de backtest
- `can_access_dashboard`: Dashboards analíticos
- `can_access_automation`: Trading automatizado
- `can_access_trade`: Trading manual/semi-automático
- `can_access_lc`: Strategy builder

### Middleware Usage
```javascript
// Em rotas protegidas:
fastify.get('/protected', {
  preHandler: [fastify.authMiddleware]
}, async (request, reply) => { ... });

// Verificação inline:
if (!request.user?.permissions?.can_access_automation) {
  return reply.status(403).send({ error: 'Acesso negado' });
}
```

## SSO (Single Sign-On) Between Subdomains

### How It Works
1. **Cookie domain**: `.atius.com.br` (not a specific subdomain)
2. **path: '/'** — cookie válido em todos os paths
3. **sameSite: 'lax'** — permite navegação cross-site
4. **secure: true** — só transmitindo em HTTPS

### Subdomains Covered
- `trade.atius.com.br` → dashboard principal
- `painel.atius.com.br` → painel administrativo
- `admin.atius.com.br` → admin
- `backtest.atius.com.br` → backtest
- `dashboard.atius.com.br` → analytics
- `strategy.atius.com.br` → estratégia

### Logout Cleanup
```javascript
// Em /auth/logout — limpa duas versões do cookie:
// 1. Com domain=.atius.com.br (captura subdomínios)
reply.clearCookie('auth-token', { domain: '.atius.com.br', path: '/', ... });
// 2. Sem domain (captura domain-less cookies legacy)
reply.clearCookie('auth-token', { path: '/', ... });
```

## Apache Proxy Config (SSO Context)

### admin.atius.com.br.conf
```
ProxyPass / http://FRONTEND_IP:3015/
# Next.js middleware.ts → rewrite para /admin se host=admin.atius.com.br
# root page.tsx → redirect para /login se não autenticado
```

### backtest.atius.com.br.conf
```
ProxyPass / http://FRONTEND_IP:3015/
# Next.js middleware.ts → rewrite para /backtest
```

### all *.atius.com.br
```
RequestHeader set X-Forwarded-Proto https
RequestHeader set X-Forwarded-Port 443
# Garante que Fastify vê HTTPS (não HTTP) para validar cookie secure
```

## Protected Route Component

**File**: `frontend/src/components/auth/protected-route.tsx`
```typescript
// Wraps routes que requerem autenticação
// Se não logado → redirect para /login com returnUrl
// Se logado → render children
```

**File**: `frontend/src/components/auth/permission-gate.tsx`
```typescript
// Verifica permissão específica antes de renderizar
// Se não tem permissão → mostra unauthorized ou redirect
```

## Password Hashing

```javascript
// bcrypt ^6.0.0
bcrypt.hash(password, saltRounds)  // registro
bcrypt.compare(password, hash)     // login
```

Salt rounds: não especificado no código — verificar config.

## Database Tables

### user
```sql
id SERIAL PRIMARY KEY
email VARCHAR(255) UNIQUE NOT NULL
username VARCHAR(255) UNIQUE NOT NULL
senha VARCHAR(255) NOT NULL  -- bcrypt hash
nome VARCHAR(100)
sobrenome VARCHAR(100)
ativa BOOLEAN DEFAULT true
is_admin BOOLEAN DEFAULT false
can_access_backtest BOOLEAN DEFAULT false
can_access_dashboard BOOLEAN DEFAULT false
can_access_automation BOOLEAN DEFAULT false
can_access_trade BOOLEAN DEFAULT false
can_access_lc BOOLEAN DEFAULT false
data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
ultima_atualizacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
```

### user_account_exchange
```sql
-- Per-user exchange account mapping
id SERIAL PRIMARY KEY
nome VARCHAR(100)
id_corretora INT REFERENCES corretoras(id)
api_key VARCHAR(255)
api_secret VARCHAR(255)
ativa BOOLEAN
telegram_chat_id BIGINT
```

## CORS Allowed Origins (Fastify)

**File**: `backend/server/api.js`

```javascript
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.BACKTEST_URL,
  process.env.DASHBOARD_URL,
  process.env.PAINEL_URL,
  // Domínios Atius
  'https://aion.atius.com.br',
  'https://trade.atius.com.br',
  'https://backtest.atius.com.br',
  'https://dashboard.atius.com.br',
  'https://painel.atius.com.br',
  'https://admin.atius.com.br',
  'https://api.atius.com.br',
  'https://strategy.atius.com.br',
  'https://trade.horistic.com',
  // localhost dev
  'http://localhost:3000',
  'http://localhost:3015',
  'http://localhost:8050',
];
```

## Security Notes

| Concern | Mitigation |
|---------|------------|
| XSS → steal cookie | httpOnly cookie (inaccessível via document.cookie) |
| CSRF | sameSite: 'lax' + CORS whitelist |
| Token in URL | Bearer token only in Authorization header, not URL |
| Weak passwords | bcrypt + min 6 chars client-side |
| Unvalidated webhook auth | Webhook (8099) has no auth — HIGH RISK per CONCERNS.md |
| Session expiry | silent refresh 5min before expiry |