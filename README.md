<div align="center">

![new-api](/web/default/public/logo.png)

# New API

🍥 **Next-Generation LLM Gateway and AI Asset Management System**

<p align="center">
  <a href="./README.zh_CN.md">简体中文</a> |
  <a href="./README.zh_TW.md">繁體中文</a> |
  <strong>English</strong> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="license">
  </a><!--
  --><a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="release">
  </a><!--
  --><a href="https://hub.docker.com/r/CalciumIon/new-api">
    <img src="https://img.shields.io/badge/docker-dockerHub-blue" alt="docker">
  </a><!--
  --><a href="https://goreportcard.com/report/github.com/Calcium-Ion/new-api">
    <img src="https://goreportcard.com/badge/github.com/Calcium-Ion/new-api" alt="GoReportCard">
  </a>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/20180" target="_blank">
    <img src="https://trendshift.io/api/badge/repositories/20180" alt="QuantumNous%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/>
  </a>
  <br>
  <a href="https://hellogithub.com/repository/QuantumNous/new-api" target="_blank">
    <img src="https://api.hellogithub.com/v1/widgets/recommend.svg?rid=539ac4217e69431684ad4a0bab768811&claim_uid=tbFPfKIDHpc4TzR" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" />
  </a><!--
  --><a href="https://www.producthunt.com/products/new-api/launches/new-api?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-new-api" target="_blank" rel="noopener noreferrer">
    <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1047693&theme=light&t=1769577875005" alt="New API - All-in-one AI asset management gateway. | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" />
  </a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-deployment">Deployment</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-help-support">Help</a>
</p>

</div>

## 📝 Project Description

> [!IMPORTANT]
> - This project is intended solely for lawful and authorized AI API gateway, organization-level authentication, multi-model management, usage analytics, cost accounting, and private deployment scenarios.
> - Users must lawfully obtain upstream API keys, accounts, model services, and interface permissions, and must comply with upstream terms of service and applicable laws and regulations.
> - Users should ensure their use complies with upstream terms of service and applicable laws and regulations.
> - When providing generative AI services to the public, users should comply with applicable regulatory requirements and fulfill all filing, licensing, content safety, real-name verification, log retention, tax, and upstream authorization obligations required by their jurisdiction.

---

## APIMaster Operations Notes

### 2026-07-22 Affiliate Commission Ratio Snapshot

APIMaster fork note. Affiliate commission settlement now freezes the commission ratio on the invitee at registration time, while preserving historical behavior for existing users.

- `users.aff_ratio_override`: inviter-level nullable override percentage.
  - `NULL`: inherit global `AffRatio`.
  - `0`: explicitly disable commission for future invitees.
  - `1-100`: override percentage for future invitees.
- `users.aff_ratio_snapshot`: invitee-level nullable frozen percentage.
  - no inviter: `NULL`.
  - inviter override exists: freeze that override.
  - otherwise: freeze the current global `AffRatio`.

Settlement reads the invitee snapshot first. `snapshot > 0` pays commission by the frozen ratio, `snapshot == 0` pays no commission and writes no `AffLog`, and historical `snapshot == NULL` invitees keep the old global-`AffRatio` fallback. This means old users keep their previous behavior, while newly registered invitees keep the ratio that applied at registration.

Admin users can edit `aff_ratio_override` from the user edit drawer. `aff_ratio_snapshot` is displayed read-only for audit. `/api/status` keeps returning global `aff_ratio` and now also returns `effective_aff_ratio` for frontend referral copy.

This change does not touch reseller logic, including `reseller_model_rule`, `is_reseller`, `reseller_user_id`, or reseller accounting.

Deployment record:

- NewAPI commit: `698d9da feat: snapshot affiliate commission ratios`.
- Workspace pointer commit: `5d96cd2 chore: bump new-api affiliate ratio snapshot`.
- Production deploy: root `/opt/scripts/go-live.sh` on `master-prod`.
- Validation: targeted controller/model tests passed; production smoke test passed with `16 PASS / 0 FAIL`.

---

## 🤝 Trusted Partners

<p align="center">
  <em>No particular order</em>
</p>

<p align="center">
  <a href="https://www.cherry-ai.com/" target="_blank">
    <img src="./docs/images/cherry-studio.png" alt="Cherry Studio" height="80" />
  </a><!--
  --><a href="https://github.com/iOfficeAI/AionUi/" target="_blank">
    <img src="./docs/images/aionui.png" alt="Aion UI" height="80" />
  </a><!--
  --><a href="https://bda.pku.edu.cn/" target="_blank">
    <img src="./docs/images/pku.png" alt="Peking University" height="80" />
  </a><!--
  --><a href="https://www.compshare.cn/?ytag=GPU_yy_gh_newapi" target="_blank">
    <img src="./docs/images/ucloud.png" alt="UCloud" height="80" />
  </a><!--
  --><a href="https://www.aliyun.com/" target="_blank">
    <img src="./docs/images/aliyun.png" alt="Alibaba Cloud" height="80" />
  </a><!--
  --><a href="https://io.net/" target="_blank">
    <img src="./docs/images/io-net.png" alt="IO.NET" height="80" />
  </a>
</p>

---

## 🙏 Special Thanks

<p align="center">
  <a href="https://www.jetbrains.com/?from=new-api" target="_blank">
    <img src="https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.png" alt="JetBrains Logo" width="120" />
  </a>
</p>

<p align="center">
  <strong>Thanks to <a href="https://www.jetbrains.com/?from=new-api">JetBrains</a> for providing free open-source development license for this project</strong>
</p>

---

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone the project
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# Edit docker-compose.yml configuration
nano docker-compose.yml

# Start the service
docker-compose up -d
```

<details>
<summary><strong>Using Docker Commands</strong></summary>

```bash
# Pull the latest image
docker pull calciumion/new-api:latest

# Using SQLite (default)
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest

# Using MySQL
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 Tip:** `-v ./data:/data` will save data in the `data` folder of the current directory, you can also change it to an absolute path like `-v /your/custom/path:/data`

</details>

---

🎉 After deployment is complete, visit `http://localhost:3000` to start using!

> [!WARNING]
> When operating this project as a public generative AI service or API resale service, users should first complete all required filing, licensing, content safety, real-name verification, log retention, tax, payment, and upstream authorization obligations.

📖 For more deployment methods, please refer to [Deployment Guide](https://docs.newapi.pro/en/docs/installation)

---

## 📚 Documentation

<div align="center">

### 📖 [Official Documentation](https://docs.newapi.pro/en/docs) | [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

</div>

**Quick Navigation:**

| Category | Link |
|------|------|
| 🚀 Deployment Guide | [Installation Documentation](https://docs.newapi.pro/en/docs/installation) |
| ⚙️ Environment Configuration | [Environment Variables](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables) |
| 📡 API Documentation | [API Documentation](https://docs.newapi.pro/en/docs/api) |
| ❓ FAQ | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |
| 💬 Community Interaction | [Communication Channels](https://docs.newapi.pro/en/docs/support/community-interaction) |

---

## ✨ Key Features

> For detailed features, please refer to [Features Introduction](https://docs.newapi.pro/en/docs/guide/wiki/basic-concepts/features-introduction)

### 🎨 Core Functions

| Feature | Description |
|------|------|
| 🎨 New UI | Modern user interface design |
| 🌍 Multi-language | Supports Simplified Chinese, Traditional Chinese, English, French, Japanese |
| 🔄 Data Compatibility | Fully compatible with the original One API database |
| 📈 Data Dashboard | Visual console and statistical analysis |
| 🔒 Permission Management | Token grouping, model restrictions, user management |

### 💰 Authorized Usage Accounting and Billing

- ✅ Internal top-up and quota allocation for lawful authorized scenarios (EPay, Stripe)
- ✅ Organization-level per-request, usage-based, and cache-hit cost accounting
- ✅ Cache billing statistics for OpenAI, Azure, DeepSeek, Claude, Qwen, and supported models
- ✅ Flexible billing policies for internal management or authorized enterprise customers

### 🔐 Authorization and Security

- 😈 Discord authorization login
- 🤖 LinuxDO authorization login
- 📱 Telegram authorization login
- 🔑 OIDC unified authentication
- 🔍 Key quota query usage (with [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool))

### 🚀 Advanced Features

**API Format Support:**
- ⚡ [OpenAI Responses](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/create-response)
- ⚡ [OpenAI Realtime API](https://docs.newapi.pro/en/docs/api/ai-model/realtime/create-realtime-session) (including Azure)
- ⚡ [Claude Messages](https://docs.newapi.pro/en/docs/api/ai-model/chat/create-message)
- ⚡ [Google Gemini](https://doc.newapi.pro/en/api/google-gemini-chat)
- 🔄 [Rerank Models](https://docs.newapi.pro/en/docs/api/ai-model/rerank/create-rerank) (Cohere, Jina)

**Intelligent Routing:**
- ⚖️ Channel weighted random
- 🔄 Automatic retry on failure
- 🚦 User-level model rate limiting

**Format Conversion:**
- 🔄 **OpenAI Compatible ⇄ Claude Messages**
- 🔄 **OpenAI Compatible → Google Gemini**
- 🔄 **Google Gemini → OpenAI Compatible** - Text only, function calling not supported yet
- 🚧 **OpenAI Compatible ⇄ OpenAI Responses** - In development
- 🔄 **Thinking-to-content functionality**

**Reasoning Effort Support:**

<details>
<summary>View detailed configuration</summary>

**OpenAI series models:**
- `o3-mini-high` - High reasoning effort
- `o3-mini-medium` - Medium reasoning effort
- `o3-mini-low` - Low reasoning effort
- `gpt-5-high` - High reasoning effort
- `gpt-5-medium` - Medium reasoning effort
- `gpt-5-low` - Low reasoning effort

**Claude thinking models:**
- `claude-3-7-sonnet-20250219-thinking` - Enable thinking mode

**Google Gemini series models:**
- `gemini-2.5-flash-thinking` - Enable thinking mode
- `gemini-2.5-flash-nothinking` - Disable thinking mode
- `gemini-2.5-pro-thinking` - Enable thinking mode
- `gemini-2.5-pro-thinking-128` - Enable thinking mode with thinking budget of 128 tokens
- You can also append `-low`, `-medium`, or `-high` to any Gemini model name to request the corresponding reasoning effort (no extra thinking-budget suffix needed).

</details>

---

## 🤖 Model Support

> For details, please refer to [API Documentation - Gateway Interface](https://docs.newapi.pro/en/docs/api)

| Model Type | Description | Documentation |
|---------|------|------|
| 🤖 OpenAI-Compatible | OpenAI compatible models | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/createchatcompletion) |
| 🤖 OpenAI Responses | OpenAI Responses format | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/createresponse) |
| 🎨 Midjourney-Proxy | [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) | [Documentation](https://doc.newapi.pro/api/midjourney-proxy-image) |
| 🎵 Suno-API | [Suno API](https://github.com/Suno-API/Suno-API) | [Documentation](https://doc.newapi.pro/api/suno-music) |
| 🔄 Rerank | Cohere, Jina | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/rerank/creatererank) |
| 💬 Claude | Messages format | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/chat/createmessage) |
| 🌐 Gemini | Google Gemini format | [Documentation](https://docs.newapi.pro/en/docs/api/ai-model/chat/gemini/geminirelayv1beta) |
| 🔧 Dify | ChatFlow mode | - |
| 🎯 Custom upstream | Supports configuring legally authorized upstream endpoints | - |

### 📡 Supported Interfaces

<details>
<summary>View complete interface list</summary>

- [Chat Interface (Chat Completions)](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/createchatcompletion)
- [Response Interface (Responses)](https://docs.newapi.pro/en/docs/api/ai-model/chat/openai/createresponse)
- [Image Interface (Image)](https://docs.newapi.pro/en/docs/api/ai-model/images/openai/post-v1-images-generations)
- [Audio Interface (Audio)](https://docs.newapi.pro/en/docs/api/ai-model/audio/openai/create-transcription)
- [Video Interface (Video)](https://docs.newapi.pro/en/docs/api/ai-model/audio/openai/createspeech)
- [Embedding Interface (Embeddings)](https://docs.newapi.pro/en/docs/api/ai-model/embeddings/createembedding)
- [Rerank Interface (Rerank)](https://docs.newapi.pro/en/docs/api/ai-model/rerank/creatererank)
- [Realtime Conversation (Realtime)](https://docs.newapi.pro/en/docs/api/ai-model/realtime/createrealtimesession)
- [Claude Chat](https://docs.newapi.pro/en/docs/api/ai-model/chat/createmessage)
- [Google Gemini Chat](https://docs.newapi.pro/en/docs/api/ai-model/chat/gemini/geminirelayv1beta)

</details>

---

## 🚢 Deployment

> [!TIP]
> **Latest Docker image:** `calciumion/new-api:latest`

### 📋 Deployment Requirements

| Component | Requirement |
|------|------|
| **Local database** | SQLite (Docker must mount `/data` directory)|
| **Remote database** | MySQL ≥ 5.7.8 or PostgreSQL ≥ 9.6 |
| **Container engine** | Docker / Docker Compose |

### ⚙️ Environment Variable Configuration

<details>
<summary>Common environment variable configuration</summary>

| Variable Name | Description | Default Value |
|--------|------|--------|
| `SESSION_SECRET` | Session secret (required for multi-machine deployment) | - |
| `CRYPTO_SECRET` | Encryption secret (required for Redis) | - |
| `SQL_DSN` | Database connection string | - |
| `REDIS_CONN_STRING` | Redis connection string | - |
| `STREAMING_TIMEOUT` | Streaming timeout (seconds) | `300` |
| `STREAM_SCANNER_MAX_BUFFER_MB` | Max per-line buffer (MB) for the stream scanner; increase when upstream sends huge image/base64 payloads | `64` |
| `MAX_REQUEST_BODY_MB` | Max request body size (MB, counted **after decompression**; prevents huge requests/zip bombs from exhausting memory). Exceeding it returns `413` | `32` |
| `AZURE_DEFAULT_API_VERSION` | Azure API version | `2025-04-01-preview` |
| `ERROR_LOG_ENABLED` | Error log switch | `false` |
| `PYROSCOPE_URL` | Pyroscope server address | - |
| `PYROSCOPE_APP_NAME` | Pyroscope application name | `new-api` |
| `PYROSCOPE_BASIC_AUTH_USER` | Pyroscope basic auth user | - |
| `PYROSCOPE_BASIC_AUTH_PASSWORD` | Pyroscope basic auth password | - |
| `PYROSCOPE_MUTEX_RATE` | Pyroscope mutex sampling rate | `5` |
| `PYROSCOPE_BLOCK_RATE` | Pyroscope block sampling rate | `5` |
| `HOSTNAME` | Hostname tag for Pyroscope | `new-api` |

📖 **Complete configuration:** [Environment Variables Documentation](https://docs.newapi.pro/en/docs/installation/config-maintenance/environment-variables)

</details>

### 🔧 Deployment Methods

<details>
<summary><strong>Method 1: Docker Compose (Recommended)</strong></summary>

```bash
# Clone the project
git clone https://github.com/QuantumNous/new-api.git
cd new-api

# Edit configuration
nano docker-compose.yml

# Start service
docker-compose up -d
```

</details>

<details>
<summary><strong>Method 2: Docker Commands</strong></summary>

**Using SQLite:**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

**Using MySQL:**
```bash
docker run --name new-api -d --restart always \
  -p 3000:3000 \
  -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" \
  -e TZ=Asia/Shanghai \
  -v ./data:/data \
  calciumion/new-api:latest
```

> **💡 Path explanation:**
> - `./data:/data` - Relative path, data saved in the data folder of the current directory
> - You can also use absolute path, e.g.: `/your/custom/path:/data`

</details>

<details>
<summary><strong>Method 3: BaoTa Panel</strong></summary>

1. Install BaoTa Panel (≥ 9.2.0 version)
2. Search for **New-API** in the application store
3. One-click installation

📖 [Tutorial with images](./docs/BT.md)

</details>

### ⚠️ Multi-machine Deployment Considerations

> [!WARNING]
> - **Must set** `SESSION_SECRET` - Otherwise login status inconsistent
> - **Shared Redis must set** `CRYPTO_SECRET` - Otherwise data cannot be decrypted

### 🔄 Channel Retry and Cache

**Retry configuration:** `Settings → Operation Settings → General Settings → Failure Retry Count`

**Cache configuration:**
- `REDIS_CONN_STRING`: Redis cache (recommended)
- `MEMORY_CACHE_ENABLED`: Memory cache

---

## 🔗 Related Projects

### Upstream Projects

| Project | Description |
|------|------|
| [One API](https://github.com/songquanpeng/one-api) | Original project base |
| [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy) | Midjourney interface support |

### Supporting Tools

| Project | Description |
|------|------|
| [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool) | Key quota query tool |
| [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon) | New API high-performance optimized version |

---

## 💬 Help Support

### 📖 Documentation Resources

| Resource | Link |
|------|------|
| 📘 FAQ | [FAQ](https://docs.newapi.pro/en/docs/support/faq) |
| 💬 Community Interaction | [Communication Channels](https://docs.newapi.pro/en/docs/support/community-interaction) |
| 🐛 Issue Feedback | [Issue Feedback](https://docs.newapi.pro/en/docs/support/feedback-issues) |
| 📚 Complete Documentation | [Official Documentation](https://docs.newapi.pro/en/docs) |

### 🤝 Contribution Guide

Welcome all forms of contribution!

- 🐛 Report Bugs
- 💡 Propose New Features
- 📝 Improve Documentation
- 🔧 Submit Code

---

## 📜 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

Additional terms under AGPLv3 Section 7 apply. Modified versions must preserve
the author attribution notice `Frontend design and development by New API
contributors.` in the appropriate legal notices and in any prominent about,
legal, footer, or attribution location presented by the user interface.

Modified versions that present a user interface must also preserve a visible
link to the original project: <https://github.com/QuantumNous/new-api>.

This is an open-source project developed based on [One API](https://github.com/songquanpeng/one-api) (MIT License).

If your organization's policies do not permit the use of AGPLv3-licensed software, or if you wish to avoid the open-source obligations of AGPLv3, please contact us at: [support@quantumnous.com](mailto:support@quantumnous.com)

---

## 🌟 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)

</div>

---

<div align="center">

### 💖 Thank you for using New API

If this project is helpful to you, welcome to give us a ⭐️ Star！

**[Official Documentation](https://docs.newapi.pro/en/docs)** • **[Issue Feedback](https://github.com/Calcium-Ion/new-api/issues)** • **[Latest Release](https://github.com/Calcium-Ion/new-api/releases)**

<sub>Built with ❤️ by QuantumNous</sub>

</div>

---

## APIMaster 集成进度存档

> 最后更新：2026-05-12。本节记录 new-api 嵌入 apimaster.ai 的改造进展，供明天继续。

### 目标

- apimaster.ai 的导航栏固定在顶部
- 用户登录 apimaster 后，进入 `/console` 路由，iframe 内自动登录 new-api 控制台
- new-api 的 AppHeader 隐藏，只保留左侧 Sidebar + 内容区
- 管理员可通过 `?as=admin` 进入 admin 视图

### 已完成的改造

#### new-api 前端 (`/opt/newapi/new-api/web/default/`)

| 文件 | 改动 |
|------|------|
| `src/main.tsx` | `basepath: '/_panel'` |
| `rsbuild.config.ts` | `assetPrefix: '/_panel/'` |
| `src/components/layout/components/authenticated-layout.tsx` | 移除 `AppHeader`，只保留 `SidebarProvider → AppSidebar + SidebarInset` |
| `src/routes/(auth)/sign-in.tsx` | session 过期时重定向到 `/_panel/dashboard`（避免 iframe 内嵌套加载 Next.js `/console` 层） |

#### new-api 后端 (`/opt/newapi/new-api/`)

| 文件 | 改动 |
|------|------|
| `router/web-router.go` | `static.Serve("/_panel", themeFS)`；NoRoute 前缀改为 `/_panel/assets` |

#### apimaster-ai (`/opt/apimaster-ai/`)

| 文件 | 改动 |
|------|------|
| `app/console/[[...slug]]/page.tsx` | 新建；读取 session cookies，无 `session` cookie → 跳 console-bridge；渲染 full-height iframe 指向 `/_panel/{slug}` |
| `app/api/console-bridge/route.ts` | `safeRedirect` 允许 `/_panel/` 前缀；按 userId HMAC 派生 new-api 密码；首次自动建账号 |
| `middleware.ts` | `/console/*` 仅检查 `apimaster_session`，无 cookie → redirect `/login` |
| `lib/server/auth-cookies.ts` | `clearAuthCookies` 同时清除 `session`（new-api session）确保退出登录彻底 |
| `lib/auth/constants.ts` | 删除废弃的 `COOKIE_NA_ACCESS` / `COOKIE_NA_USER_ID` |

#### nginx (`/etc/nginx/sites-enabled/apimaster.ai`)

- `/_panel/` → `proxy_pass http://127.0.0.1:3001/;`（**末尾斜杠**，nginx 会剥离 `/_panel` 前缀再转发给 Go）
- `/api/user/`、`/api/channel/` 等 → new-api port 3001
- `/console` → Next.js port 3000

#### 删除的旧代码（apimaster-ai）

- `app/console/` 下所有旧子页面（channels/dashboard/gateway/keys/... 各自的 `page.tsx`）
- `components/console/ConsoleShell.tsx`、`ConsoleDashboardClient.tsx`、`ConsoleGatewayClient.tsx` 等
- `app/api/newapi/tokens/`
- `lib/server/newapi-user-fetch.ts`、`lib/newapi/panel-url.ts`、`lib/console-target.ts`

### 当前状态与遗留 Bug

#### 已解决

1. **黑屏**：nginx `proxy_pass http://127.0.0.1:3001/_panel/;` 没剥离前缀，Go 收到 `/_panel/static/js/index.js` → 匹配不到静态文件 → 返回 HTML。
   修复：改为 `proxy_pass http://127.0.0.1:3001/;`（末尾斜杠）。

2. **双层导航栏**：旧镜像的 `sign-in.tsx` 还在重定向到 `?redirect=/console/dashboard`，iframe 内加载了 Next.js `/console` 页（含 apimaster nav）。
   修复：重新 build + `docker compose pull && up -d`，新镜像重定向到 `/_panel/dashboard`。

3. **退出登录**：`clearAuthCookies` 未清除 `session`，new-api 侧仍保持登录。
   修复：已加 `res.cookies.set("session", "", { maxAge: 0 })`。

#### 待解决：**iframe 内白屏**

症状：`/_panel/dashboard` HTML 正常返回（200），JS/CSS 资源全部 200 加载，但页面内容为白色。

已排查：
- 无 X-Frame-Options / CSP 阻断
- nginx `/_panel/` → Go 路由正常（JS 返回 `text/javascript`）
- `authenticated-layout.tsx` 的 `SidebarInset` 高度用 `calc(100svh - var(--app-header-height,0px))`，默认值 `0px` 不会高度塌陷
- axios `baseURL = ''`，请求走同源，session cookie 会随请求发出

**最可能原因**：`beforeLoad` 在 `/_authenticated/route.tsx` 调用 `getSelf()` → `GET /api/user/self`。
若 session cookie 值不被 Go 接受（格式错误或已过期），会 redirect 到 `/sign-in` → console-bridge → `/_panel/dashboard` → 无限循环，React 渲染白屏。

**下一步调试步骤**：
1. 用 devtools Network 面板在 iframe 里查看 `/api/user/self` 的实际请求和响应（需在浏览器中打开 `/_panel/dashboard` 直接访问，而不是通过 iframe）
2. 确认 `session` cookie 值格式：new-api Go 后端用 gin-session 读 cookie，值应是 gin-session 生成的 token，不是 JWT
3. 若 401：检查 console-bridge 解析 `set-cookie` 的正则 `/(?:^|,)\s*session=([^;,]+)/i` 是否提取到了正确值
4. 若是循环：检查 Go 日志 `docker logs apimaster-new-api --tail 50`

### 环境信息

| 组件 | 路径 / 端口 |
|------|------------|
| Next.js (apimaster) | `/opt/apimaster-ai`，port 3000，systemd `apimaster` |
| new-api Go + SPA | Docker `apimaster-new-api`，port 3001 |
| new-api DB | Docker `apimaster-new-api-postgres` |
| nginx | `/etc/nginx/sites-enabled/apimaster.ai` |
| new-api 源码 | `/opt/newapi/new-api/` |
| Docker compose | `/opt/newapi/docker-compose.yml` |

---

## Step 2 & 3 进度存档（2026-05-14）

> 本节接续上面 5-12 的存档，记录"自动检测 + 模型数据页"的完整落地、相关 bug 修复、以及未结闭环。

### Step 2：自动检测（fingerprint + 运行状态）

按模型粒度的两类定时检测，配置写入 `options` 表 key=`detect_config_{model}`。

| 文件 | 作用 |
|------|------|
| [service/model_detect_config.go](service/model_detect_config.go) | 新增。读取/列举 per-model 配置：`LoadDetectConfig(model)` / `LoadAllConfiguredModels()` / `DetectConfigKey(model)` |
| [service/auto_detect.go](service/auto_detect.go) | "模型检测"（fingerprint）调度，遍历 `(channel × model)`，1 分钟 tick |
| [service/uptime_check.go](service/uptime_check.go) | 新增。"运行状态"探针调度，独立 ticker；端口/路径/模型 ID 全兼容 |
| [main.go](main.go) | 启动两个 task：`StartAutoDetectTask()` / `StartUptimeCheckTask()` |
| [model/channel_detect_log.go](model/channel_detect_log.go) | 增加 `ClaimedModel` / `PredictedModel` / `Top1Score` / `LatencyMeanMs` / `Note` |

**`uptime_check.go` 的 URL/模型 兼容（已对齐 Flask）**：

- `urlSuffixes = ["", "/api", "/v1", "/api/v1"]`
- `stripKnownAPIPath()` → 剥掉 `/v1/chat/completions`、`/api/v1/chat/completions`、`/chat/completions`、`/v1`、`/api/v1`、`/api`
- `baseURLCandidates()` → 原始 + 所有 `site_root + suffix` 组合 + 一份 `api.<domain>` 变体（例 `apimart.ai` → `api.apimart.ai`）
- `_MODEL_ID_CANDIDATES`：`claude-haiku-4-5` → `claude-haiku-4-5-20251001`、`anthropic/claude-haiku-4.5`
- 双重循环：外层走 URL 候选，内层走 model 候选；按 `probeErrURL` / `probeErrModel` / `probeErrOther` 分类，URL 错才换 URL，模型错才换 model

### Step 3：模型数据页面 `/_panel/model-data`

| 文件 | 作用 |
|------|------|
| [controller/model_data.go](controller/model_data.go) | 返回 `fingerprint_history[]` + `uptime_history[]`（各最多 24 条，含 `{status, detect_time, note}`），按 `source` 字段拆分 |
| [web/default/src/features/model-data/index.tsx](web/default/src/features/model-data/index.tsx) | 主页面：MODEL_TABS、24 点 2×12 DotGrid、自动检测开关 + 间隔按钮 |

**UI 细节**：

- MODEL_TABS 顺序：Haiku 4.5 → Sonnet 4.6 → Opus 4.7 → GPT5.4 → GPT5.5
- DotGrid：2 行 × 12 列；时间从老到新（左→右、上→下）；hover 走 `TooltipProvider delay={0}`，显示时间 + 状态 + 错误原因
- 价格列保留 4 位小数；除了汇率（如 packyapi 1rmb=1usdt）
- 间隔按钮：1 分钟自动检测开关放在页面而非设置里
- "更新渠道"按钮触发 `service.FetchChannelPricing()` 异步刷新该渠道价格（[controller/channel.go](controller/channel.go) UpdateChannel）

### 跨模块 Bug 修复（5-12 → 5-14 期间）

| 现象 | 根因 | 修复 |
|------|------|------|
| 改完渠道分组后 model 价格没刷新 | `UpsertChannelModelPricings` 用了 `DB.Save`，新行 id=0 全部命中 unique idx_ch_model | [model/channel_model_pricing.go](model/channel_model_pricing.go) 改用 `clause.OnConflict{Columns:[channel_id,model_name], DoUpdates: AssignmentColumns(...)}` |
| 模型映射输入框输入一个字母就失焦 | 父组件 echo 回 value → useEffect 重新 parse → `Date.now()` 生成新 row.id → React 重挂载 `<Input>` | [web/default/src/features/channels/components/model-mapping-editor.tsx](web/default/src/features/channels/components/model-mapping-editor.tsx) 加 `lastEmittedRef` + `emit()` helper，5 处 onChange 全切 emit |
| 历史页点站点跳到 `/v1/chat/completions` | 链接直接拼 base_url | apimaster `lib/site-url.ts` 加 `getSiteHomepage()` 抽 scheme+hostname；historyall 全部走它 |
| 编辑渠道页要等点击"获取上游分组"才拉模型 | 没有自动 fetch | [web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx](web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx) `KeyGroupField` 加 `useEffect` + `fetchedForRef` 防重复，500ms debounce |
| Apimart 运行状态 fail 但 fingerprint pass | base_url 是 `apimart.ai`，实际 API 在 `api.apimart.ai`；Go 没复刻 Flask 的 fallback | uptime_check.go 全量端口 Flask URL 兼容（见 Step 2 表） |
| Hover 价格 tooltip 700ms 才出 | 用 HTML title 属性 | 改 `TooltipProvider delay={0}` |
| 输入框默认 1 清不掉 | 没让它支持空 | onFocus 自动 select；编辑期间允许空字符串 |
| Docker 容器连不上 Flask | Gunicorn 只 bind 127.0.0.1 | [/etc/systemd/system/detect.service](/etc/systemd/system/detect.service) 加第二个 `--bind 172.17.0.1:7860` |
| 控制台 admin 默认进 dashboard | 期望默认进 model-data | [/opt/apimaster-ai/app/console/[[...slug]]/page.tsx](/opt/apimaster-ai/app/console/%5B%5B...slug%5D%5D/page.tsx) 在 admin && landing 时 redirect `/console/model-data` |

### 错误文案优化（apimaster 后端）

| 文件 | 改动 |
|------|------|
| [/opt/apimaster-ai/backend/app/providers/openai_compat.py](/opt/apimaster-ai/backend/app/providers/openai_compat.py) | (1) 空 body / 非 JSON 给中文具体描述；(2) packyapi cc 类 key 识别后提示"该 API Key 仅限 Claude Code CLI 客户端使用"；(3) b.ai deposit_required → "访问受限，需要充值解锁高级模型" |
| [/opt/apimaster-ai/backend/web/server.py](/opt/apimaster-ai/backend/web/server.py) | 403 access_denied 自动 fallback openai-compatible → anthropic（排除余额/充值类） |
| [/opt/apimaster-ai/lib/fingerprint.ts](/opt/apimaster-ai/lib/fingerprint.ts) | `normalizeBaseUrl` 剥 `/chat/completions` 后缀，scheme 小写 |

### 已知未结

- **codextopapi 部分检测返回空 body**：错误提示已优化，但根因（限流？超时？）未定位，留作单独议题

### 模型别名兼容（跨 newapi / apimaster）

权威定义在 apimaster backend：[/opt/apimaster-ai/backend/model_registry/models.yaml](/opt/apimaster-ai/backend/model_registry/models.yaml)，每个模型有 `name` / `api_id` / `fingerprint_aliases`。

newapi 这边 [service/uptime_check.go](service/uptime_check.go) 维护了对齐的 `ModelIDCandidates` map（外加 OpenRouter 风格的 `anthropic/claude-...` 变体），并 export 了 `ModelNameCandidates(canonical) []string` 给其他包用。

已使用方：
- `service/uptime_check.go` 探针重试时按 candidate 列表回退
- `controller/model_data.go` SQL `IN ?` 查询 `channel_model_pricings` 跨变体匹配，并对 channel_id 去重保留最低价（修复了 Haiku 4.5 tab 只显示 roma 一个渠道的问题——Apimart/packyapi-claude 在 pricing 表存的是 `claude-haiku-4-5-20251001`，旧的严格 `=` 匹配漏掉了）

后续新增 alias 时只需在 [service/uptime_check.go:35](service/uptime_check.go#L35) 加一行。

---

## 当前指纹自动禁用语义

- `service/auto_detect.go` 和 `service/detection_sync.go` 都按 `(channel_id, claimed_model)` 处理指纹结果。
- fingerprint `suspicious` 只关闭该渠道下对应模型的 `abilities.enabled`，并在 `channels.other_info.auto_disabled_models` 记录恢复计数；同渠道其他模型保持可路由。
- fingerprint `pass` 只恢复此前由 fingerprint 自动关闭的同一 `(channel_id, model)`；人工关闭的模型不会被自动恢复。
- `notcomplete` 和 `uptime` 不触发 fingerprint 自动禁用。
- 普通请求失败的 `AutomaticDisableChannelEnabled` 属于渠道健康保护：invalid key / 欠费等全局错误仍禁用整渠道；连续 5xx/timeout/429 先用原始请求模型做确认探针，确认失败后只关闭该 `(channel_id, model)`。
- 通用自动恢复会扫描 `channels.other_info.auto_disabled_models`，逐个用被封模型探测；哪个模型探测通过只恢复哪个模型，不会恢复同渠道其他模型或整渠道。

---

## 路由算法 0.1 存档（2026-05-14）

第一版"按价格最便宜可用渠道优先 + 检测自动禁用 + 自动恢复"的最简路由。只做 cheapest 一种策略，跑在 newapi distributor 端；apimaster 不参与决策。

### 规则矩阵（用户确认）

| 维度 | 决策 |
|------|------|
| 算法位置 | newapi distributor |
| 候选池排序 | `actual_price = input_price × COALESCE(recharge_rate, 1)` 升序 |
| Fallback | 复用 newapi 现有 retry 机制（默认 retry 2 次） |
| 自动禁用触发 | 一次 fingerprint **suspicious** 即 status=3 AutoDisabled（notcomplete 不触发，uptime 不触发） |
| 自动恢复 | status=3 + counter 累计达 12 次 fingerprint pass → status=1 + counter 重置 |
| Counter 语义 | 纯 int：pass +1；suspicious 归零；notcomplete 不动；不带时间窗 |
| 手动禁用 | status=2 ManuallyDisabled（不被自动恢复，不进候选池） |
| 手动启用 | status=1 + counter 重置 |
| 请求失败（5xx/timeout） | 只走 retry，**不影响 status** |
| 生效范围 | 仅 token group = `auto-cheapest`，其他 group 行为完全不变 |

### 使用方法

1. 「管理员后台 → 站点与品牌 → 系统信息 → 服务器地址」确认已填写公开 URL（如 `https://apimaster.ai`）。当前 DB 已写入。
2. 在 token 管理页创建 token，"分组"下拉选 `auto-cheapest`（描述："智能路由（按价格选最便宜的可用渠道，失败自动 fallback）"）。
3. 客户端用 `<ServerAddress>/v1/chat/completions` + 该 token 发请求；newapi 自动按价升序挑渠道，失败自动顺延。

### 关键文件

| 文件 | 作用 |
|------|------|
| [model/channel.go:62](model/channel.go#L62) | `ConsecutiveFingerprintPass` 字段 (gorm auto-migration) |
| [service/auto_detect.go:267](service/auto_detect.go#L267) | suspicious→3 / status=3+pass→counter+1 / counter==12→1 状态机 |
| [service/auto_detect.go:64](service/auto_detect.go#L64) | 检测范围扩到 `status IN (1, 3)` 让 AutoDisabled 也被持续检测 |
| [service/uptime_check.go:83](service/uptime_check.go#L83) | uptime 同样扩到 1,3 |
| [service/channel_select_cheapest.go](service/channel_select_cheapest.go) | 新建：`SelectCheapestEnabledChannel` + `AutoCheapestGroup` 常量 + `bannedChannelIDsFromContext` |
| [service/channel_select.go:84](service/channel_select.go#L84) | `CacheGetRandomSatisfiedChannel` 入口加 `auto-cheapest` 分支 |
| [middleware/distributor.go:102](middleware/distributor.go#L102) | distributor 对 auto-cheapest 跳过 affinity（粘性选择会破坏 cheapest 语义） |
| [controller/model_data.go](controller/model_data.go) | 返回 `status` + `consecutive_fingerprint_pass`；新增 `ToggleChannelStatus` |
| [router/api-router.go:222](router/api-router.go#L222) | 注册 `POST /api/admin/model-data/toggle` |
| [setting/ratio_setting/group_ratio.go:12](setting/ratio_setting/group_ratio.go#L12) | `defaultGroupRatio` 加 `auto-cheapest: 1` |
| [setting/user_usable_group.go:10](setting/user_usable_group.go#L10) | `userUsableGroups` 加 `auto-cheapest` 中文描述 |
| `options.UserUsableGroups` (DB) | 手动 UPDATE 加 `auto-cheapest` 中文 desc——启动时 DB 值会覆盖代码默认 map |
| [web/default/src/features/model-data/index.tsx](web/default/src/features/model-data/index.tsx) | 表格末尾"操作"列：启用/禁用按钮 + 状态徽章 `自动禁用 N/12` / `手动禁用` |
| [web/default/src/features/keys/components/api-keys-table.tsx](web/default/src/features/keys/components/api-keys-table.tsx) | API 密钥页工具栏加 `ApiBaseUrlBadge`（点击复制 ServerAddress 到剪贴板） |

### 价格公式备忘

当前 `channel_model_pricings` 只有 `input_price` + `output_price` 两列，**没有** cache_read / cache_write。路由 0.1 SQL 排序键统一**只用 `input_price`**（用户确认）。未来扩 cache 字段后，公式回来加权（cache 价格通常是 input 的 0.1x / 1.25x，对 chat 场景实际成本影响显著）。

### 不在 0.1 范围

- 多策略（fastest / balanced 等）—— 后续版本
- apimaster 用户级 API key 体系（用户在 apimaster 拿 key 转发到 newapi）
- 计费分账
- 流式响应 mid-stream fallback（首字节后技术上不可能）
- per-token 自定义"12 次 / 24h"阈值（先全局硬编码 `fingerprintRecoveryThreshold = 12`）

---

## Step 4 计价系统改造存档（2026-05-14）

路由 0.1 上线后立刻碰到 `model_price_error`：用户用 `auto-cheapest` token 请求，路由选好渠道但计价器拒收（newapi 计价走另一套 `ModelRatio` option，跟 `channel_model_pricings` 不通）。Step 4 解决两件事：(1) 让计价直接消费成本价；(2) 用 `GroupRatio = 1.05` 实现 5% 运营毛利。

### 决策矩阵（用户确认）

| 维度 | 决策 |
|------|------|
| 计价模型 | **per-request × per-channel**：每次请求按命中那个 channel 的 input_price 计费 |
| ratio 公式 | `model_ratio = input_price / 2.0`，`completion_ratio = output_price / input_price` |
| 5% 毛利落地 | `GroupRatio["auto-cheapest"] = 1.05`（不在充值环节抽，避免退款倒推） |
| Fallback 触发 | `ModelRatio` / `ModelPrice` 都缺失时 → 自动从 `channel_model_pricings` 反查 |
| 运营覆盖 | 后台手填 `ModelRatio` 仍优先（fallback 让位，作为应急通道） |
| 默认 token group | `auto-cheapest`（新建 token 默认选） |
| 用户可见 group | 仅 `auto-cheapest`（`default/vip/svip` 在用户面隐藏，代码层保留兜底） |
| 使用日志 | 普通用户能看到 `channel_name`（透明转售卖点），admin 看完整 `#id` + chain + affinity |

### 关键文件

| 文件 | 改动 |
|------|------|
| [service/channel_pricing_lookup.go](service/channel_pricing_lookup.go) | **新建** `ChannelModelPriceRatio()` — 按 channel_id + model 反查 ratio |
| [relay/helper/price.go](relay/helper/price.go#L96) | `ModelPriceHelper()` 在 `GetModelRatio` 失败时调上面 helper；`ratioFromChannel` 标志阻止后续覆盖 |
| [setting/ratio_setting/group_ratio.go](setting/ratio_setting/group_ratio.go#L12) | `defaultGroupRatio["auto-cheapest"] = 1.05`（**5% 毛利在此**） |
| [setting/user_usable_group.go](setting/user_usable_group.go#L10) | `userUsableGroups` 只留 `auto-cheapest`（用户面只显示这一个） |
| DB `options.GroupRatio` | `INSERT '{"default":1,"vip":1,"svip":1,"auto-cheapest":1.05}'` |
| DB `options.UserUsableGroups` | `UPDATE '{"auto-cheapest":"智能路由（…含 5% 服务费）"}'` |
| [web/default/src/features/keys/constants.ts](web/default/src/features/keys/constants.ts#L77) | `DEFAULT_GROUP = 'auto-cheapest'` |
| [web/default/src/features/keys/lib/api-key-form.ts](web/default/src/features/keys/lib/api-key-form.ts#L63) | 简化默认值逻辑，统一用 `DEFAULT_GROUP` |
| [web/default/src/features/usage-logs/components/columns/common-logs-columns.tsx](web/default/src/features/usage-logs/components/columns/common-logs-columns.tsx#L292) | 非 admin 用户加简化 channel 列（只显示 `channel_name`） |

### 端到端验证（已通过）

```bash
curl -sS -X POST https://apimaster.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-<auto-cheapest token>" \
  -d '{"model":"claude-sonnet-4-6","messages":[{"role":"user","content":"hi"}],"max_tokens":20}'
# → SSE stream, msg id 前缀 msg_bdrk_... 命中 Apimart（最便宜，input_price=0.8）
# → 扣费 quota=123, channel_id=3, ratio = 0.8/2 × 1.05 = 0.42
```

### 配置陷阱

**channel.base_url 必须是上游真实 API 端点**。例：apimart 的 API 在 `https://api.apimart.ai`（带 api 子域），不是主站 `https://apimart.ai`（主站没 /v1 路径，会返回 404 + Next.js HTML）。新加 channel 时确认 `curl -X POST <base_url>/v1/chat/completions` 能拿到 401 而不是 HTML 404。

### 已知未结

- **404 不自动 retry 到次贵渠道**：理论上 newapi `shouldRetry()` 默认 404 在 retry 范围（401-407），但实测没触发。下次再碰到时深挖
- **relay 转发缺 base_url 子域 fallback**：`uptime_check.go` 已有 `api.<domain>` 候选 + `_strip_known_api_path` 兜底逻辑，但仅探针自己用；relay 转发请求时直接信任 `channel.base_url`。治本要在 `controller/relay.go` 转发处接同一套 candidates，但每请求多次试 URL 性能不佳，暂搁置

### 不在 step 4 范围

- **充值/退款 UI + 订单流**：5% 已通过 GroupRatio 落地，但充值入口、退款 UI、订单流是独立 step
- **缓存价格**（`cache_read` / `cache_write`）：schema 没字段，公式重调留给后续
- **多策略路由**（fastest / balanced）：路由 0.2 再做
- **隐藏后台「分组与模型定价」页**：保留作为应急覆盖入口

---

## 钱包页面改造（APIMaster 定制）

> 最后更新：2026-05-16 | 开发者：MaChuang

### 布局

```
[账户余额卡片 — full width]
[充值区域 left ~60%] | [兑换码卡片 right ~40%]
                     | [推荐计划卡片 right ~40%]
[交易历史表格 — full width]
```

### 支付方式

| 方式 | 状态 | 说明 |
|------|------|------|
| 支付宝 | ✅ 已接入 | 易支付 Epay，后台填 EpayId/EpayKey/PayAddress 即开启 |
| 微信支付 | ✅ 已接入 | 同上 |
| Crypto (USDT/USDC/ETH/BNB/POL) | ✅ 已接入 | Go 后端链上验证，MetaMask 直连 |
| Stripe | 占位 | 显示"即将上线"，SDK 未接入 |

### 涉及文件

| 文件 | 变更 |
|------|------|
| `web/default/src/features/wallet/index.tsx` | 重写：新布局 + i18n 同步 |
| `web/default/src/features/wallet/components/wallet-stats-card.tsx` | 重写：简洁余额卡片 |
| `web/default/src/features/wallet/components/recharge-panel.tsx` | 重写：支付宝/微信/Crypto 卡片，动态读 topupInfo |
| `web/default/src/features/wallet/components/transaction-history.tsx` | 重写：正式表格布局，含复制订单号、正确货币符号 |
| `web/default/src/features/wallet/components/crypto-deposit-modal.tsx` | 新建：链上充值弹窗（chain/token chip 选择） |
| `web/default/src/features/wallet/components/redemption-code-card.tsx` | 新建：兑换码卡片 |
| `web/default/src/features/wallet/components/referral-card.tsx` | 新建：推荐计划卡片 |
| `web/default/src/features/wallet/hooks/use-crypto-payment.ts` | 新建：MetaMask 连接/切链/转账/轮询 |
| `web/default/src/features/wallet/api.ts` | 追加：`submitCryptoDeposit` / `getCryptoDepositStatus` |
| `web/default/src/i18n/config.ts` | 修改：初始化前同步 APIMaster `localStorage["apimaster-locale"]` |
| `web/default/src/i18n/locales/zh.json` | 追加：~45 条钱包相关翻译 |
| `controller/topup_crypto.go` | 新建：链上验证 Go 控制器 |
| `router/api-router.go` | 追加：`/crypto/submit` + `/crypto/deposit/:id` 路由 |
| `/opt/newapi/docker-compose.yml` | 追加：钱包地址 + 各链 RPC 环境变量 |

### 技术要点

**Epay（支付宝/微信）**

new-api 已内置完整 Epay 集成。前端 `recharge-panel.tsx` 挂载时调用 `getTopupInfo()`，只有当 `enable_online_topup=true` 且 `pay_methods` 中存在对应 type 时才显示卡片。点击后调用 `POST /api/user/pay`，后端返回 `url`，前端 `window.open` 跳转收银台。

> **安全警告**：GitHub Issue #4279 报告了 Epay 签名验证绕过漏洞，上线前确认是否已修复。

**Crypto 支付流程**

1. 用户选链（ETH/BSC/Polygon/Arbitrum/Base）和 Token
2. `eth_requestAccounts` 连接钱包
3. `wallet_switchEthereumChain` 切链
4. ERC-20：手动编码 `0xa9059cbb` calldata → `eth_sendTransaction`
5. 原生币：CoinGecko 查价 → 算 wei 数量 → `eth_sendTransaction` 带 `value`
6. txHash → `POST /api/user/crypto/submit` → 后台异步验证
7. 每 3s 轮询 `GET /api/user/crypto/deposit/:id`

**后端验证（`controller/topup_crypto.go`）**

- 等 receipt（120s 超时）→ 扫 ERC-20 `Transfer` event → fallback native 转账
- 原生币：CoinGecko 实时查价计算 USD
- 写 `TopUp` 记录 + `IncreaseUserQuota`
- 内存去重（txHash → depositId，2h TTL）

**链/Token 配置**

| 链 | chainId | Token |
|----|---------|-------|
| ETH | 1 | ETH / USDT / USDC |
| BSC | 56 | BNB / USDT / USDC |
| Polygon | 137 | POL / USDT / USDC |
| Arbitrum | 42161 | ETH / USDT / USDC |
| Base | 8453 | ETH / USDC |

平台收款地址：`0x33de43dad6955655ec0543f32069ac331e633c9c`（`PLATFORM_WALLET_ADDRESS` 可覆盖）

**交易历史金额显示（两条路径 amount 单位不同）**

- `crypto`：`amount = quota 原始值` → 除以 `500000` 还原 USD
- Epay/其他：`amount = USD 美元整数` → 直接显示
- `money` 货币符号：alipay/wxpay → `¥`，其他 → `$`

**i18n 同步**

APIMaster 语言存于 `localStorage["apimaster-locale"]`，`i18n/config.ts` 初始化前同步读取防闪烁，运行期间监听 `storage` 事件跟随切换。

**环境变量（`docker-compose.yml`）**

```env
PLATFORM_WALLET_ADDRESS=0x33de43dad6955655ec0543f32069ac331e633c9c
CRYPTO_RPC_ETH=https://eth.llamarpc.com
CRYPTO_RPC_BSC=https://bsc-dataseed.binance.org
CRYPTO_RPC_POLYGON=https://polygon-rpc.com
CRYPTO_RPC_ARBITRUM=https://arb1.arbitrum.io/rpc
CRYPTO_RPC_BASE=https://mainnet.base.org
```

### 待办 / 已知问题

- **Stripe**：占位，未接入 SDK
- **Epay 安全漏洞**：Issue #4279 签名绕过，上线前核查
- **CoinGecko 限流**：50 req/min，高并发可加 30s 内存缓存
- **Crypto 重启丢状态**：`sync.Map` 不持久化，重启后 pending 记录丢失，用户需重新提交 txHash

## 官方原价统一改造存档（2026-07-06）

### 背景

之前"模型官方原价"没有统一存储：Model Data 页每渠道用 `input_price ÷ group_ratio` 反推、公开 marketplace 从抓 roma 的 `public_model_prices` 表取、apimaster-ai 前端还有一份硬编码表兜底，三处经常对不上。目标：与标准 newapi 一致——**全局模型倍率（系统设置→模型定价）作为官方原价唯一来源**，自己维护，不再抓 roma。

### 改动

**`service/global_model_pricing.go`**（既有文件，此次修复一个 bug）
- `GlobalModelPricingUSD` 原来对 quota_type=1（按次计费，如 sora/kling/gpt-image）也会调用 `fillGlobalDerivedPrices` 算"输出价"，但 `GetCompletionRatio` 对未配置模型会兜底成 newapi 内置的通用值，导致按次计费模型被算出一个不该存在的输出价（例：gpt-image-2 显示 output=0.5）。修复：价格型分支直接返回 `output=0`，跳过 completion_ratio 推导

**`controller/pricing_backfill.go`**（新文件）
- `POST /api/admin/channel-data/backfill-global-ratios`：一次性/增量回填全局倍率
- body `{"overwrite": bool, "prices": {model: {input, output}}}`，逐 key 合并（不是整模型跳过）：已有 `model_ratio` 的模型，缺失的 `completion_ratio`/`cache_ratio` 仍会补上
- **⚠️ 踩坑记录**：`overwrite:true` 是全局开关，不是"只覆盖 body 里这几个模型"——body 之外的模型仍会走 source #2（`public_model_prices` 旧 roma 快照表）重新合并，且 `overwrite:true` 时一样会覆盖。上线当天曾因为后续小范围修正调用（只带 1-3 个模型 + overwrite:true）把 `minimax-m3` 从已修正的 0.3 打回旧快照的 0.15。**教训：任何 overwrite:true 调用都要带完整的模型清单，不能只传"这次要改的几个"**

**`controller/model_data.go`**
- `GetModelData` 新增 `official_input_price`/`official_output_price`/`base_price_mismatch_pct`/`suggested_group_ratio`，>5% 偏差标红报警（"该渠道自改原厂价"），提供"按官方价反推 gratio"操作（`FixGroupRatio`，只精确修正 Channel Data 页实际展示的那一行，用跟 `GetModelData` 完全一致的选行逻辑，避免多 variant 渠道改错行）
- `GetPublicMarketplace` 官方价源从 `public_model_prices`（roma 快照）切到 `GlobalModelPricingUSD`（全局倍率）

**`service/channel_pricing.go` / `service/channel_pricing_lookup.go`**
- 删除"刷新公开价"整条抓 roma 链路（`RefreshPublicModelPrices` 及路由）
- **手动渠道（`model_price_ratio`+`manual_group_ratio`，无 `/api/pricing` 接口）不再写价格快照**：之前 `fetchModelPriceRatioFallback` 会把 `官方价×比例` 算好写进 `channel_model_pricings`，官方价改了这行就冻结不动，除非再点"刷新价格"。现在改成官方价×比例**实时计算**（显示 `applyPublicManualPricingToRow`、计费 `ChannelModelPriceData` 都读现在的官方价），`fetchModelPriceRatioFallback` 只负责清理旧快照行

**Web SPA**：`features/model-data/` → `features/channel-data/` 改名（Model Data → Channel Data），表格新增"渠道原价"/"官方原价"双列 + 报警，路由/侧边栏/i18n 同步改名，旧 `/model-data` 路径保留 redirect

### 数据核实记录（人工+官网信源交叉验证，2026-07-06）

| 模型 | 值 | 来源 |
|---|---|---|
| Claude 全系列 | 官网标价 | apimaster-ai 硬编码表，用 packyapi.com `/api/pricing` 独立验证 Claude/GPT/Gemini 8/8 完全匹配 |
| Claude 缓存 | 读×0.1，5分钟写×1.25（全系列通用） | Anthropic 官方文档 `platform.claude.com/.../prompt-caching` |
| DeepSeek v4-flash/pro | 输入/输出/缓存命中价 | DeepSeek 官方文档 `api-docs.deepseek.com` |
| Gemini 3.1 Flash Image | $0.0672/张（1024px） | Google 官方 `ai.google.dev/gemini-api/docs/pricing`（$0.067/1K image 标准档，硬编码表旧值 $0.03 才是错的） |
| GPT 缓存输入折扣 | ×0.1（90% off，非 50%） | OpenAI 官方 `developers.openai.com/api/docs/pricing` |
| sora-2 / sora-2-pro | $0.1/秒、$0.3/秒 | 人工确认；回填前 `ModelPrice` 里存的 $0.08/$0.24 是历史遗留错误值，与本次改造无关但顺带修正 |
| OpenRouter 渠道价格分歧 | 非 bug | OpenRouter 定价接口硬编码 `group_ratio=1`，不吃渠道 `manual_group_ratio`；`deepseek/deepseek-v4-flash` 在 OpenRouter 上就是比官方参考价低 36%（$0.09 vs $0.14），已用 OpenRouter 官方 `/v1/models` 实时核实原始字符串 `"0.00000009"` 无误 |

### 已知遗留

- `claude-haiku-4-5`（不带日期后缀的规范名）缺 `cache_ratio`/`create_cache_ratio`，其带日期变体 `claude-haiku-4-5-20251001` 已有
- 系统里 `abilities` 表出现的模型名一律要有自己的倍率条目（`/api/pricing` 不做别名换算），新增渠道用了新的日期变体名时记得同步在"模型定价"里配一份，否则会吃 newapi 内置默认兜底比例 37.5（曾在 haiku 变体上出现过）
- `/console/pricing` 页面默认按"default"分组的 1.05（5%）加价展示，用户反馈这个页面不该带这个加价，尚未处理（不影响实际计费，只是这个展示页面本身要不要单独去掉分组倍率）
- **Crypto 重启丢状态**：`sync.Map` 不持久化，重启后 pending 记录丢失，用户需重新提交 txHash

## 渠道采购价四件套与完整性告警修复（2026-07-09）

### 背景

渠道数据页展示的"采购价"是后续记账、结算、毛利统计的基础。一次请求最终会涉及多套价格：

- 渠道采购价：我们向上游采购的价格
- 用户价格：采购价乘 apimaster 渠道加价倍率后的用户展示基础价
- 用户最终结算价格：用户价格再乘 group ratio 后的实际扣费价
- 分销商记账价：分销商与下线结算的拿货价（官方原价 × 下线模型折扣比例）

本节只记录 **渠道数据页最终展示出来的渠道采购价四件套** 的修复和审计口径；使用日志金额快照、分销商结算规则另见记账改造记录。

### 最终口径

渠道数据页每个 `(channel, model)` 最终只认一套采购价，来源优先级固定为：

```text
pricing > manual > global
```

含义：

- `pricing`：来自 `channel_model_pricings`，包括普通 `/api/pricing` 采集、OpenRouter `/v1/models` 采集，以及 model mapping 命中的价格。底层历史字段值可能是 `api`，审计展示时统一归一为 `pricing`。
- `manual`：渠道没有 pricing 行时，按渠道设置里的 `model_price_ratio` + `manual_group_ratio`，基于系统官方原价实时计算。
- `global`：前两者都没有时，用系统设置里的官方原价兜底。**global 是合法来源**，有些官方渠道本来就应该按官方价格，不再因为触发 global 报警。
- `none`：三层都没有拿到价格，才是真正异常。

页面最终展示和审计检查的是已经乘过 `recharge_rate` 的实际采购价字段：

- `actual_price`：输入采购价
- `actual_output_price`：输出采购价
- `actual_cache_price`：缓存读采购价
- `actual_cache_creation_price`：缓存写采购价

### 完整性规则

LLM / 文本模型要求四件套都存在且 `> 0`：

- 输入
- 输出
- 缓存读
- 缓存写

图片、视频、按张、按秒、按次模型只要求主价格存在：

- 图片模型按张收费
- 视频模型按秒收费
- 这类模型没有输出 token、缓存读、缓存写轴，缺这些字段不报警

当前按媒体模型处理的渠道数据 tab：

- `gemini-3.1-flash-image-preview`
- `gpt-image-2`
- `sora-2`
- `sora-2-pro`
- `kling-v3-motion-control`

### 修复内容

**`controller/model_data_audit.go`**

- 新增单模型审计接口：`GET /api/admin/channel-data/audit`
- 新增全部 tab 批量审计接口：`GET /api/admin/channel-data/audit-batch?models=...`
- 批量接口直接复用渠道数据页同一套价格解析逻辑，避免"页面显示一套，审计另一套"
- `normalizedChannelDataAuditSource` 将底层 `api` 归一为审计口径的 `pricing`
- `channelDataAuditShouldAlert` 只在缺价格字段时报警，不再因为 `global` 报警
- LLM 要求四件套；媒体模型只要求主价格

**`web/default/src/features/channel-data/index.tsx`**

- 渠道数据页顶部增加跨全部模型 tab 的价格完整性汇总
- 正常时显示：`全部渠道价格齐全`
- 有问题时显示：`xxmodel，xx渠道 缺价格数据`
- 行内采购价单元格增加 `缺价` 标记，tooltip 展示缺少的字段
- 顶部告警不是当前 tab，而是 `MODEL_TABS` 全部模型 + 全部渠道

**`service/channel_pricing.go`**

- `/api/pricing` 返回缺缓存读或缓存写时，按官方原价比例补齐：
  - `cache_read = 渠道输入价 × 官方缓存读价 / 官方输入价`
  - `cache_write = 渠道输入价 × 官方缓存写价 / 官方输入价`
- 只在渠道输入价、输出价有效，且官方四件套可用时补齐
- 避免上游 `/api/pricing` 缺 `create_cache_ratio` 导致写缓存采购价为 0

**`service/channel_pricing_openrouter.go`**

- OpenRouter `/v1/models` 采集路径也走同一套 `fillMissingCachePricesFromOfficial`
- 修复 OpenRouter 刷新后再次把写缓存价刷成 0 的问题

### 数据修复与审计结果

2026-07-09 在 master 当前渠道数据页按正确口径重审：

```text
总渠道-模型行：143
pricing：81
manual：56
global：6
none：0
缺价报警：0
```

结论：

- 当前渠道数据页在用的这批模型和渠道，采购价完整性通过
- `global=6` 是合法官方价兜底，不算异常
- `none=0`，说明没有渠道最终完全拿不到价格
- LLM 渠道当前最终展示的输入、输出、缓存读、缓存写四件套齐全
- 图片/视频渠道按主价格检查，不误报输出和缓存字段缺失

### 使用日志金额口径修复

本次价格修复前，使用日志新增的金额字段曾出现过两类口径问题：

1. 缓存读 token 被重复计入输入金额
   - 错误口径：`prompt_tokens` 全量按输入价算，同时又额外把 `cache_tokens` 按缓存读价算
   - 正确口径：
     - 普通输入 token = `prompt_tokens - cache_tokens`
     - 缓存读 token = `cache_tokens`
     - 输出 token = `completion_tokens`
   - 这样用户最终结算金额才能和实际扣费 quota 对齐

2. 图片 / 视频模型不能按 token 金额公式算
   - 图片按张收费，金额 = 张数 × 主价格
   - 视频按秒收费，金额 = 秒数 × 主价格
   - 输出、缓存读、缓存写对图片/视频不适用，不参与金额计算

修复后的原则：

- 使用日志里存的是每次请求的价格快照和金额快照，方便后续报表直接汇总
- LLM 金额按输入、输出、缓存读、缓存写分别计算后求和
- 图片/视频金额按业务单位计算，后台展示的最终用户扣费金额和日志金额保持一致
- 账务异常不影响请求；价格/金额快照缺失只用于后续告警和对账排查

### 踩坑记录

- 审计时必须先初始化 `options`，即服务启动链路里的 `model.InitOptionMap()`。否则 `GlobalModelPricingUSD` 只能看到默认内存值，看不到数据库里的官方原价，会把本应命中 `global` 或 `manual` 的渠道误判为 `none`。
- `api` 和 `pricing` 是同一个来源层级的不同命名：底层 `channel_model_pricings.pricing_source` 多数存 `api`，业务审计口径叫 `pricing`。统计时必须归一，否则会把 pricing 行误算成 `none`。
- `global` 不是错误。之前曾按"触发 global 就不对"理解过重，最终用户确认：官方渠道可以用官方原价兜底，只有最终价格字段缺失才报警。
- `/api/pricing` 和 OpenRouter 可能只给输入/输出/缓存读，缺缓存写。对 LLM 记账而言写缓存不能为 0，应该按官方四件套比例补齐。
