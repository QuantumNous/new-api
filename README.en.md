# 🍥 New API — Next-Generation LLM Gateway & AI Asset Management System

[![License](https://img.shields.io/badge/license-AGPL--3.0-brightgreen)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/calciumion/new-api)](https://hub.docker.com/r/calciumion/new-api)
[![Go Report](https://goreportcard.com/badge/github.com/QuantumNous/new-api)](https://goreportcard.com/report/github.com/QuantumNous/new-api)
[![Stars](https://img.shields.io/github/stars/QuantumNous/new-api?style=social)](https://github.com/QuantumNous/new-api)

**The open-source AI API gateway for teams.** Route to any model — OpenAI, Claude, Gemini, DeepSeek, Qwen, Llama — through a single OpenAI-compatible endpoint. Self-host or use our managed service.

📖 [Documentation](https://docs.newapi.pro/en/docs) · 🚀 [Quick Start](#quick-start) · ✨ [Features](#key-features) · 🚢 [Deployment](#deployment) · ☁️ [Managed Hosting](https://aipossword.cn)

[中文](README.md) | [Français](README.fr.md) | [日本語](README.ja.md)

---

## Why New API?

Stop managing 10 different API keys, SDKs, and billing dashboards. New API gives you:

| Before | After New API |
|--------|---------------|
| 🔑 6+ API keys from different vendors | 🔑 **One API key** for everything |
| 💸 Separate billing for each provider | 💰 **Unified billing** with cost tracking |
| 🔧 Different SDKs per model | ✅ **Single OpenAI-compatible endpoint** |
| 📊 No visibility into team usage | 📈 **Per-team analytics & quotas** |
| 😰 Vendor lock-in | 🔄 **Swap models in one line** |

---

## Quick Start

### ☁️ Managed (No Setup Required)

Get started instantly at **[aipossword.cn](https://aipossword.cn)** — fully managed, $5 free credits, zero platform markup.

### 🐳 Self-Hosted (Docker)

```bash
# Clone and start
git clone https://github.com/QuantumNous/new-api.git
cd new-api
docker-compose up -d

# Or pull directly
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

Open `http://localhost:3000` → configure your first model → start making API calls.

```bash
# Your first API call
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'
```

---

## Key Features

### 🎯 Core Platform

| Feature | Description |
|---------|-------------|
| **Modern UI** | Clean dashboard with real-time analytics and cost tracking |
| **Multi-language** | English, 简体中文, 繁體中文, Français, 日本語 |
| **Data Migration** | Fully compatible with One API databases |
| **Team Management** | Role-based access, per-member API keys, usage quotas |
| **Analytics Dashboard** | Visual cost breakdowns, token usage, latency metrics |

### 💰 Billing & Monetization

- Built-in Stripe & EPay integration
- Per-request, per-token, and cached-hit cost accounting
- Flexible pricing models (subscription, pay-as-you-go, quota-based)
- Model-specific pricing with automatic conversion
- Supports OpenAI, Azure, DeepSeek, Claude, Qwen cached billing

### 🔐 Authentication

- Discord OAuth
- LinuxDO OAuth
- Telegram OAuth
- OIDC (Generic OpenID Connect)
- Email/Password

### 🧠 Intelligent Routing

- **Weighted random**: Distribute traffic across multiple upstream channels
- **Auto-retry on failure**: Seamless failover when a provider goes down
- **Per-user rate limiting**: Prevent abuse without affecting other users
- **Model-level routing**: Route specific models to specific channels

### 🔄 Format Conversion

- OpenAI Compatible ⇄ Claude Messages
- OpenAI Compatible → Google Gemini
- Google Gemini → OpenAI Compatible (text only)
- Thinking/reasoning effort passthrough for all models

### 📡 Supported Endpoints

| Interface | Models Supported |
|-----------|-----------------|
| Chat Completions | OpenAI, Claude, Gemini, DeepSeek, Qwen, Llama, Mistral + custom |
| Responses API | OpenAI Responses format |
| Claude Messages | Native Claude API format |
| Gemini API | Native Google Gemini format |
| Image Generation | DALL-E, Midjourney (via proxy) |
| Audio | TTS, STT via OpenAI format |
| Video Generation | Supported providers |
| Embeddings | OpenAI, custom providers |
| Rerank | Cohere, Jina |
| Realtime | OpenAI Realtime API (including Azure) |
| Suno Music | Suno API integration |

---

## 🤖 Model Support

New API works with any OpenAI-compatible provider. First-class support for:

- **OpenAI** — GPT-4o, GPT-4.1, o3, o4-mini
- **Anthropic** — Claude Sonnet 4, Claude Opus 4.5, Claude Haiku 3.5
- **Google** — Gemini 3.0 Pro, Gemini 2.5 Flash, Gemini 3.0 Flash
- **DeepSeek** — DeepSeek V4, DeepSeek R1
- **Qwen (Alibaba)** — Qwen 3.7 Max, Qwen 3.6 Flash
- **Meta** — Llama 4, Llama 3.3
- **Mistral** — Mistral Large, Codestral
- **Custom** — Any OpenAI-compatible endpoint

[Full model list & pricing →](https://aipossword.cn/pricing)

---

## 🚢 Deployment

### Requirements

| Component | Minimum |
|-----------|---------|
| Database | SQLite (default) or MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6 |
| Container | Docker / Docker Compose |
| Redis (optional) | For caching, rate limiting, multi-node deployments |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Multi-node | Session encryption key |
| `CRYPTO_SECRET` | With Redis | Encryption key for shared Redis |
| `SQL_DSN` | MySQL/PG | Database connection string |
| `REDIS_CONN_STRING` | Optional | Redis for caching & rate limiting |
| `STREAMING_TIMEOUT` | Optional | Streaming timeout in seconds (default: 300) |

[Full environment variable reference →](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables)

### Multi-Node Deployment

1. Set `SESSION_SECRET` (same across all nodes)
2. Share a Redis instance, set `CRYPTO_SECRET`
3. Use MySQL/PostgreSQL (not SQLite)
4. Load balance across nodes

---

## 🆚 Self-Hosted vs Managed

|  | Self-Hosted | [aipossword.cn](https://aipossword.cn) |
|--|-------------|---------------------------------------|
| Setup | Requires Docker + configuration | Instant, no setup |
| Models | You bring your own API keys | Pre-configured, 100+ models |
| Billing | DIY or built-in Stripe | USD billing, auto-invoicing |
| Maintenance | You manage updates & uptime | Fully managed, 99.9% SLA |
| Cost | Server costs only | Model price + $0 markup |
| Best for | Enterprises, privacy-focused | Startups, indie devs, quick prototyping |

---

## 🔗 Related Projects

| Project | Description |
|---------|-------------|
| [One API](https://github.com/songquanpeng/one-api) | Original upstream project |
| [Midjourney-Proxy](https://github.com/trueai-org/midjourney-proxy) | Midjourney integration |
| [new-api-key-tool](https://github.com/QuantumNous/new-api-key-tool) | Key quota checker |
| [new-api-horizon](https://github.com/QuantumNous/new-api-horizon) | High-performance optimized fork |

---

## 📜 License

New API is licensed under **GNU AGPLv3**.

- ✅ Self-host freely
- ✅ Modify and extend
- ✅ Commercial use (with obligations)
- ⚠️ Modified versions must be open-sourced under AGPLv3
- ⚠️ Must retain attribution: `Frontend design and development by New API contributors.`

Built on [One API](https://github.com/songquanpeng/one-api) (MIT License).

For commercial licensing without AGPL obligations, contact `support@quantumnous.com`.

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=QuantumNous/new-api&type=Date)](https://star-history.com/#QuantumNous/new-api&Date)

---

**Built with ❤️ by [QuantumNous](https://github.com/QuantumNous) and the open-source community.**

*Try the managed version at [aipossword.cn](https://aipossword.cn) — $5 free credits, zero setup.*
