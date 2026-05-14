# flatkey 渠道接入流程图

本图描述 newapi 接入 flatkey 作为上游 AI 中转渠道时，请求从最终用户出发，经 newapi 转发到 flatkey 公网入口，再下沉到 flatkey 后端执行节点的完整链路。

`api.flatkey.ai` 同时兼容 OpenAI `/v1/chat/completions` 与 Anthropic `/v1/messages` 协议，newapi 在 `relay/channel/flatkey/` 中按请求路径分别走 OpenAI-format 与 Claude-format 两条转换链。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ① newapi 侧（本项目）                              │
└─────────────────────────────────────────────────────────────────────────────┘

   终端用户 / 业务系统
   (Node / Python / OpenAI SDK / Anthropic SDK / curl)
            │
            │  Authorization: Bearer <newapi-token>
            │  POST /v1/chat/completions  或  /v1/messages
            ▼
   ┌──────────────────────────────────────────────────────────┐
   │              newapi  Gin HTTP Server                     │
   │  router/  →  middleware/(auth, ratelimit, distribute)    │
   │     │                                                    │
   │     ▼                                                    │
   │  controller/relay  →  service/  →  relay/                │
   │                                                          │
   │  ┌────────────────────────────────────────────────────┐  │
   │  │  relay/channel/flatkey   ← 新增渠道适配器           │  │
   │  │  - 协议判定: OpenAI-format / Claude-format          │  │
   │  │  - BaseURL: https://api.flatkey.ai                  │  │
   │  │  - 路径映射: /v1/chat/completions | /v1/messages    │  │
   │  │  - Header 透传: Authorization=<flatkey-key>         │  │
   │  │  - Stream / Non-stream 处理                         │  │
   │  │  - 用量统计 → billing / log                         │  │
   │  └────────────────────────────────────────────────────┘  │
   │     │                                                    │
   │     ▼                                                    │
   │  GORM (MySQL/PG/SQLite) + Redis     用于配额、限流、日志  │
   └──────────────────────────────────────────────────────────┘
            │
            │  HTTPS  (出站请求)
            │  Host: api.flatkey.ai
            ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                       ② flatkey 公网入口（原架构）                            │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────┐
   │  Cloudflare Edge  (SJC POP)                          │
   │   • Universal SSL                                    │
   │   • Argo Smart Routing                               │
   └──────────────────────────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────────────┐
   │  CF Load Balancer  (zone = flatkey.ai)               │
   │   steering = random      weights = 0.8 / 0.2         │
   │   fallback_pool = nas    health = GET /health  (60s) │
   └──────────────────────────────────────────────────────┘
        │  80%                              │  20%
        ▼                                    ▼
   ┌─────────────────────┐            ┌─────────────────────┐
   │  nas-pool           │            │  mac-pool           │
   │  origin = 94859718  │            │  origin = 3a41c5ed  │
   │  .cfargotunnel.com  │            │  .cfargotunnel.com  │
   │  status: ✅ healthy │            │  status: ✅ healthy │
   └─────────────────────┘            └─────────────────────┘
        │                                   │
        │ CF Tunnel #1                      │ CF Tunnel #2
        │ (sub2api-claudecode)              │ (sub2api-mac)
        ▼                                   ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                       ③ flatkey 后端执行节点                                 │
└─────────────────────────────────────────────────────────────────────────────┘

   ┌────────────────────────────┐     ┌────────────────────────────┐
   │  NAS  192.168.1.80         │     │  Mac mini  192.168.x.x     │
   │  DXP 4800 / x86_64         │     │  M4 / arm64 / macOS        │
   │                            │     │                            │
   │  • cloudflared        (↑↓) │     │  • flatkey-cloudflared     │
   │  • sub2api      :8080      │     │  • flatkey-sub2api-mac     │
   │  ENV FLATKEY_HOST_TAG=nas  │     │  ENV FLATKEY_HOST_TAG=mac  │
   │                            │     │                            │
   │  ↓ 调用上游真实模型         │     │  ↓ 调用上游真实模型         │
   │  Claude / OpenAI / Gemini  │     │  Claude / OpenAI / Gemini  │
   └────────────────────────────┘     └────────────────────────────┘

   响应沿原路返回:   后端 → CF Tunnel → LB → CF Edge → newapi(relay/flatkey)
                  → newapi 统计用量/记账 → 流式或非流式回给最终用户
```

## 接入要点（newapi 侧）

- **渠道适配器位置**：`relay/channel/flatkey/`，可参考已有 OpenAI 兼容渠道（如 `relay/channel/openai`）。如果同时支持 `chat/completions` 与 `messages`，按请求路径分别走 OpenAI-format / Claude-format 两条转换链。
- **Channel Type 注册**：在 `constant/` 中登记新的 channel type，并在管理后台渠道类型下拉中新增 “flatkey”。
- **默认 BaseURL**：`https://api.flatkey.ai`。
- **鉴权方式**：与 OpenAI 兼容，`Authorization: Bearer <flatkey-key>` 透传。
- **StreamOptions**（CLAUDE.md Rule 4）：确认 flatkey 是否支持 `stream_options`，若支持则把此 channel type 加入 `streamSupportedChannels`。
- **重试/容灾**：跨 POP、跨 Pool 的切换由 Cloudflare LB 的 `fallback_pool=nas` 自动完成，newapi 侧不需要重复实现，只关注 HTTP 层错误码与超时即可。
