# INTEGRATIONS — Atius AI Router

## AI Providers (Relay Channels)

The gateway relays requests to 40+ upstream AI providers via channel adapters in `relay/channel/`:

### Major Providers

| Channel | Dir | Type | Streaming | Notes |
|---------|-----|------|-----------|-------|
| OpenAI | `relay/channel/openai/` | OpenAI-compatible | Yes | Base adapter |
| Claude | `relay/channel/claude/` | Anthropic | Yes | |
| Gemini | `relay/channel/gemini/` | Google | Yes | |
| AWS Bedrock | `relay/channel/aws/` | AWS | Yes | |
| MiniMax | `relay/channel/minimax/` | MiniMax | Yes | Atius uses this |
| DeepSeek | `relay/channel/deepseek/` | DeepSeek | Yes | |
| Ollama | `relay/channel/ollama/` | Local | Yes | |
| Azure OpenAI | `relay/channel/openai/` | Azure | Yes | |

### Additional Providers

```
relay/channel/
├── ai360
├── ali (Alibaba)
├── baidu / baidu_v2 (Baidu)
├── cohere
├── coze
├── dify
├── jimeng (Jimeng)
├── jina
├── lingyiwanwu (Lingyi Wanwu / Kimi)
├── mistral
├── mokaai
├── moonshot
├── openrouter
├── palm (Google PaLM)
├── perplexity
├── replicate
├── siliconflow
├── codex (OpenAI Codex)
├── cloudflare
└── (more)
```

---

## External APIs

### OAuth Providers

| Provider | File | Protocol | Scopes |
|----------|------|----------|--------|
| GitHub | `oauth/github.go` | OAuth 2.0 | `user:email` |
| Discord | `oauth/discord.go` | OAuth 2.0 | — |
| OIDC | `oauth/oidc.go` | OpenID Connect | — |
| LinuxDO | `oauth/linuxdo.go` | OAuth 2.0 | — |
| Custom | `oauth/generic.go` | OAuth 2.0 | Configurable |
| WeChat | `controller/oauth.go` (WeChatAuth) | WeChat OAuth | — |
| Telegram | `controller/oauth.go` (TelegramLogin) | Bot API | — |
| Codex | `controller/codex_oauth.go` | OpenAI OAuth | — |

### Payment Providers

| Provider | File | Notes |
|----------|------|-------|
| epay | `go-epay` (Calcium-Ion/go-epay) | Main payment gateway |
| Stripe | `controller/stripe.go` | Credit card payments |
| Creem | `controller/creem.go` | Credit card payments |
| Waffo | `controller/waffo.go` | — |
| Waffo Pancake | `controller/waffo_pancake.go` | — |

---

## Databases

| DB | Driver | Usage |
|----|--------|-------|
| SQLite | `glebarez/sqlite` | Default, local dev |
| MySQL | `gorm.io/driver/mysql` | Production |
| PostgreSQL | `gorm.io/driver/postgres` | Production |
| Redis | `go-redis/redis/v8` | Cache, rate limiting |

### Auth-Related Tables

- `users` — username, password (bcrypt), email, role, status, group
- `tokens` — API keys with quota tracking
- `oauth_bindings` — OAuth provider → user mapping
- `passkeys` — WebAuthn credentials (credential_id, public_key)
- `two_fa` — TOTP secrets
- `custom_oauth_providers` — DB-driven OAuth provider configs
- `options` — Key-value store for all settings (password_login_enabled, etc.)

---

## Authentication Providers

### Built-in (env vars)

| Provider | Env vars |
|----------|---------|
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| OIDC | `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_AUTH_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL` |
| LinuxDO | `LINUXDO_CLIENT_ID`, `LINUXDO_CLIENT_SECRET` |
| Telegram | `TELEGRAM_BOT_TOKEN` |

### DB-driven (admin-configurable)

| Provider | Config source |
|----------|--------------|
| Custom OAuth | `custom_oauth_providers` table |

### Auth Methods

| Method | Backend | Frontend |
|--------|---------|----------|
| Password | `controller/user.go:Login` | `api.ts:login()` |
| OAuth (6+ providers) | `controller/oauth.go:HandleOAuth` | `useOAuthLogin` hook |
| Passkey/WebAuthn | `controller/passkey.go` | `lib/passkey.ts`, `passkey/api.ts` |
| 2FA/TOTP | `controller/user.go:Verify2FALogin` | `api.ts:login2fa()` |
| Turnstile | `middleware/turnstile-check.go` | `useTurnstile` hook |

---

## Webhooks

| Endpoint | Handler | Purpose |
|----------|---------|---------|
| `POST /api/waffo-pancake/webhook/:env` | `controller.WaffoPancakeWebhook` | Waffo Pancake payment webhook |
| `POST /api/user/epay/notify` | `controller.EpayNotify` | epay payment notification |

---

## Third-Party Services

| Service | Package | Purpose |
|---------|---------|---------|
| Cloudflare Turnstile | — | Bot protection on login/register |
| Grafana Pyroscope | `grafana/pyroscope-go` | Continuous profiling |
| Prometheus | `prometheus/client_golang` | Metrics |
| S3/MinIO | `github.com/minio/minio-go/v7` | File storage |
| Go profiling | `net/http/pprof` | CPU/memory via `common/pprof.go` |

---

## Key Integration Points

1. **OAuth callback URL**: `{SERVER_ADDRESS}/api/oauth/{provider}` — must be registered in provider's app settings
2. **Telegram OAuth**: Uses `SERVER_ADDRESS/api/oauth/telegram/login` — bot-based auth
3. **WeChat OAuth**: Uses QR code flow — `{SERVER_ADDRESS}/api/oauth/wechat`
4. **Custom OAuth**: `redirect_uri` = `{SERVER_ADDRESS}/api/oauth/{slug}`
5. **epay IPN**: `{SERVER_ADDRESS}/api/user/epay/notify` — HTTP callback for payment confirmation
6. **Redis**: Used for rate limiting counters and caching (no session storage — cookie-only)
7. **MinIO**: S3-compatible object storage for uploaded files