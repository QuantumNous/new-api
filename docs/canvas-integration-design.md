# 无限画布（infinite-canvas）集成设计文档

> 版本：v1.0
> 适用项目：new-api
> 日期：2026-07-05
> 状态：设计已定稿（入口形态、权限模型、数据持久化与功能范围已经产品确认），待实施
>
> **本文档面向执行者（人或 agent）自包含编写**：所有关键代码锚点（文件路径 + 行号 + 关键片段）都在设计阶段实际核实过，执行时若发现行号漂移以语义定位为准。

---

## 一、背景与目标

把开源项目 [infinite-canvas](https://github.com/basketikun/infinite-canvas)（Next.js 16 无限画布 AI 创作应用，AGPL-3.0，本地克隆位于 `/Users/reputationly/Desktop/code/api/infinite-canvas`）集成进 new-api，成为平台内置功能：

1. **顶部导航新增「画布」入口**（与「文档」「模型广场」同级），admin 可在后台开关；
2. **iframe 内嵌形态**（与现有「聊天」页 `chat/$chatId` 同模式）：保留 new-api 顶部导航，画布在下方全幅呈现；
3. **免创建 API key**：登录用户直接使用自己可用的模型，复用操练场（Playground）`/pg` 的会话鉴权 + 临时 token 机制，**计费走 new-api 正常扣费链路**；
4. **只出一个 Docker 镜像**：画布改为 Next.js 静态导出，Go 二进制 `go:embed` 伺服，**运行时不引入 Node**。

**功能范围（已确认，全量）**：图片生成/编辑、视频生成/播放、模型列表、画布助手/问图（流式）、音频生成（TTS）、提示词库（需 Go 移植一个服务端抓取路由）、画布项目服务端持久化、画布素材库 OBS 存储与用户级容量限制。

**产品拍板约束（2026-07-05）**：
- 内置版不允许用户在画布内添加外部渠道或 BYO API key；画布只使用 new-api 后台已配置渠道与用户可用模型。
- `/api/prompts` 仅登录可见；画布顶部导航入口、iframe 入口页、`/canvas-app/*` 静态应用均仅登录可见。
- `/canvas-app/*` 永远由 Go 单二进制内置伺服，即使部署设置了 `FRONTEND_BASE_URL` 外置前端，也不得把画布重定向到外置前端。
- 内置模式隐藏 WebDAV 整块功能；v1 不提供 WebDAV direct/proxy。
- 入口关闭后做强门禁：导航隐藏、`/_authenticated/canvas` 拒绝、`/canvas-app/*` 拒绝。
- 模型分类使用 new-api 的 `SupportedEndpointTypes`，不依赖画布原有模型名关键词推断。
- v1 开始将画布项目 JSON 服务端持久化到数据库，浏览器 IndexedDB/localforage 仅作为本地缓存/草稿缓存。
- 画布素材库的图片/视频/音频二进制存 OBS，不进数据库；按用户限制总存储空间，普通用户默认 200MB，高级用户默认 1TB，具体值做成后台/订阅可配置。

### 非目标

- 不允许画布用户自行配置外部渠道、API key、Gemini 原生格式或 Seedance/火山方舟直连格式；如需使用对应能力，必须由 admin 在 new-api 后台配置为平台渠道后，通过 `/pg` 统一调用、计费、限权。
- 不做 WebDAV 同步/代理；上游 WebDAV UI 在内置模式下隐藏。
- 不把素材二进制直接存数据库；图片、视频、音频等媒体文件进入 OBS，数据库只保存项目结构、素材元数据、OBS key、大小、归属用户与引用关系。
- 不绕过 new-api 现有 relay/计费逻辑；画布所有 AI 能力必须经 `/pg` 或明确新增的登录态 API 进入统一鉴权、分发、计费链路。

### 选型补充：同类开源项目调研

调研时间：2026-07-05。使用 GitHub `gh search repos` / `gh repo view` 与仓库 README 做筛选，评估标准不是单纯 star，而是：

1. 能否嵌入 new-api 单 Go 服务、单 Docker 镜像；
2. 能否复用 new-api 登录、模型权限、渠道分发、计费；
3. 是否覆盖图片/视频/音频/助手/提示词/项目管理等画布场景；
4. 是否允许内置商业部署与二次开发；
5. 改造量是否可控。

| 项目 | 当前情况 | 与 new-api 集成适配度 | 结论 |
|---|---|---|---|
| [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas) | TypeScript / Next.js，AGPL-3.0；已覆盖图片生成/编辑、视频、音频、助手、提示词库、素材管理；兼容 OpenAI 接口生态并明确提到 newapi 渠道接入 | 已有 OpenAI-compatible 请求面，AI 请求集中，适合改成 `/pg` 同源调用；可静态导出后由 Go embed；改造主要集中在鉴权、渠道锁定、静态导出和项目持久化 | **v1 首选** |
| [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Python / GPL-3.0；约 119k stars；成熟节点图工作流，支持图片、编辑、视频、音频、3D，且有 API/队列/工作流 JSON | 能力最强，但核心价值是 Python/PyTorch 模型运行时和 ComfyUI 自有后端。直接嵌入会引入 Python/GPU/runtime/custom nodes，破坏单 Go 镜像；把它改造成 `/pg` 前端等于重写大半执行层 | 不替代 v1；后续可做“ComfyUI 工作流/远程执行适配器” |
| [Comfy-Org/ComfyUI_frontend](https://github.com/Comfy-Org/ComfyUI_frontend) | TypeScript / GPL-3.0；ComfyUI 官方前端 | 前端可单独研究，但协议、节点、队列、文件管理都强绑定 ComfyUI 后端；替换成 new-api `/pg` 工作量大 | 不作为 v1 基座 |
| [invoke-ai/InvokeAI](https://github.com/invoke-ai/InvokeAI) | Apache-2.0；约 27.5k stars；成熟 Stable Diffusion 创作 WebUI，覆盖 txt2img/img2img/inpainting/outpainting | 授权友好、产品成熟，但定位是本地/服务器 SD 创作引擎，后端重，偏图片；不是 OpenAI-compatible relay 前端 | 可参考图片编辑、图库、项目管理 UX；不作为嵌入基座 |
| [bytedance/flowgram.ai](https://github.com/bytedance/flowgram.ai) | TypeScript / MIT；约 8.1k stars；AI 工作流画布开发框架，不是成品应用 | 适合自研一套 new-api 原生工作流编辑器，但需要从节点体系、运行时、素材管理、模型选择、项目存储重新做产品 | v2 重构候选框架，不适合 v1 快速集成 |
| [vercel-labs/tersa](https://github.com/vercel-labs/tersa) | TypeScript / MIT；Next.js + ReactFlow + Vercel AI SDK Gateway；支持文本/图片/视频节点，本地浏览器持久化 | 形态接近，但强绑定 Vercel AI SDK Gateway、Vercel Blob 和 BYO provider；要接入 new-api 仍需重做鉴权、模型能力、计费、项目持久化 | 可参考节点交互；不比 infinite-canvas 更省改造 |
| [mrslimslim/gpt-image-canvas](https://github.com/mrslimslim/gpt-image-canvas) | TypeScript / MIT；tldraw + Hono + SQLite，本地优先；图片生成、参考图、Agent DAG、图库、S3/R2/COS 备份 | 工程清晰，项目/资产持久化设计值得参考；但聚焦 GPT Image 2 图片工作流，缺视频/音频/提示词库，且自带 Hono API/SQLite 服务 | 可参考 DB 持久化与 Agent DAG；不替代 v1 |
| [ashuoAI/AI-CanvasPro](https://github.com/ashuoAI/AI-CanvasPro) | Electron 桌面应用；README 明确“不是开源软件”，非开源/非商业授权；能力覆盖文本/图像/视频/音频/剪辑/ComfyUI | 能力方向很接近，但授权直接排除内置到 new-api；Electron 桌面形态也不适合 Go embed | **不能集成** |
| [xpnobug/CanvasMind](https://github.com/xpnobug/CanvasMind) / [SankaiAI/TwitCanva-Video-Workflow](https://github.com/SankaiAI/TwitCanva-Video-Workflow) / [fal-ai-community/infinite-kanvas](https://github.com/fal-ai-community/infinite-kanvas) / [markfulton/NanoBananaEditor](https://github.com/markfulton/NanoBananaEditor) | 多为 Vue/Next/React 的单供应商或小体量画布/图片/视频 demo，star 与维护体量较小，常绑定 Gemini/Veo/fal/Nano Banana 等具体平台 | 可以参考交互，但能力覆盖、成熟度、授权或供应商绑定均不优于 infinite-canvas | 不作为主线 |
| [Acly/krita-ai-diffusion](https://github.com/Acly/krita-ai-diffusion) | Python / GPL-3.0；约 10k stars；Krita 插件，图像生成/修图体验成熟，后端依赖 ComfyUI | 桌面插件，不是 Web 静态应用；不覆盖 new-api 的视频/音频/助手/统一计费场景 | 只作为图像编辑 UX 参考 |

**选型结论**：

- v1 继续采用 `basketikun/infinite-canvas`。它不是最强工作流引擎，但最贴近 new-api 的集成目标：OpenAI-compatible、功能面覆盖、前端可 vendor、可以静态导出并由 Go 服务统一鉴权/计费。
- ComfyUI 是能力天花板，但不适合作为内置画布替代品。正确位置是后续做“管理员配置的 ComfyUI/工作流后端适配”，让画布中的某些高级节点调用外部 ComfyUI，而不是把 ComfyUI 整套塞进 new-api。
- FlowGram/Tersa 更像未来自研工作流引擎参考。如果后续要把画布升级成 new-api 原生节点工作流平台，可以单独立项评估；不建议影响 v1 的集成路线。
- `gpt-image-canvas` 的 SQLite 项目持久化、生成历史、图库、Agent DAG 执行设计值得借鉴，尤其可用于完善本方案 §5.4 的项目表与后续素材表。
- AI-CanvasPro 虽然产品能力接近，但授权明确不是开源且限制商业/SaaS/二次分发，不能进入 new-api。

---

## 二、总体架构

```
┌────────────────────────── 浏览器（同源）───────────────────────────┐
│  new-api SPA (web/default)                                        │
│    顶部导航「画布」 → /_authenticated/canvas 路由                    │
│         └── <iframe src="/canvas-app/">                            │
│               │  同源: session cookie + localStorage['uid'] 直通    │
│               ▼                                                    │
│  画布静态应用 (Next.js output:"export", basePath:"/canvas-app")     │
│    内置渠道 baseUrl="/pg", apiKey=""                                │
│    请求头: Cookie(session) + New-Api-User: <uid>                    │
│    项目缓存: IndexedDB/localforage (服务端 DB 为准，本地仅缓存/草稿) │
└────────────────────────────────┬───────────────────────────────────┘
                                 ▼
┌────────────────────────── new-api (Go 单二进制) ────────────────────┐
│  /canvas-app/*  ← CanvasStaticAuth + 开关门禁 + go:embed 静态伺服    │
│  /pg/*          ← UserAuth(session) + 临时 token + Distribute       │
│     chat/completions | images/generations | images/edits(新)        │
│     responses(新) | audio/speech(新) | videos | videos/:id          │
│     videos/:id/content(新) | models(新) | images/proxy              │
│  /api/prompts   ← UserAuth + 提示词库 Go 移植(新)                   │
│  /api/canvas/projects ← UserAuth + 画布项目 JSON 持久化(新)          │
│  /api/canvas/assets   ← UserAuth + 素材库上传/签名/删除/配额(新)     │
│  计费: playgroundSetupContext 合成临时 token → 正常 relay 扣费       │
└─────────────────────────────────────────────────────────────────────┘
```

**关键机制（设计阶段已核实）**：

- `middleware.UserAuth()`（`middleware/auth.go`）先读 session cookie，**并强制要求请求头 `New-Api-User: <uid>` 且与 session 用户一致**（约 :96-104，缺失直接 401）。new-api SPA 登录后把 uid 写在 `localStorage['uid']`（`web/default/src/features/auth/lib/storage.ts`）。画布与 SPA 同源，iframe 内可直接读同一个 localStorage。
- `controller/playground.go` 的 `playgroundSetupContext()` 从 session 取 userId，合成临时 `model.Token`（无真实 key），`middleware.SetupContextForToken` 注入上下文后走正常 relay → **计费、渠道分发、OBS 落盘全部自动生效**，无需为画布写任何计费代码。
- 画布所有 AI 请求 URL 都汇合在一个函数 `buildApiUrl`（见 §4.4），是内置模式最小侵入的关键。
- `/canvas-app/*` 静态资源请求不能使用现有 `UserAuth()`，因为浏览器加载 JS/CSS/图片时不会附带 `New-Api-User` 自定义头。需新增轻量 `CanvasStaticAuth`：只校验 session cookie 中的登录态与用户状态，并校验画布模块开关；未登录重定向 `/login`，关闭模块返回 404/403。
- `FRONTEND_BASE_URL` 只影响 default/classic SPA 的 NoRoute 回退；画布静态路由必须在该回退之前全局挂载，确保单 Docker 镜像部署下 `/canvas-app/*` 始终由 Go 服务。

---

## 三、Phase 1 — Vendor 画布源码到 `web/canvas/`

**来源**：`/Users/reputationly/Desktop/code/api/infinite-canvas` 的 `web/` 子目录（先 `cd` 到该仓库 `git rev-parse HEAD` 记下基线 commit）。

**操作**：

1. 拷贝 `infinite-canvas/web/` → `new-api/web/canvas/`（含 `src/`、`public/`、`package.json`、`bun.lock`、`tsconfig.json`、`postcss.config.mjs`、`components.json`、`next-env.d.ts` 等；**排除** `node_modules/`、`.next/`）。
2. 追加文件：
   - `web/canvas/LICENSE`：从上游仓库根目录拷贝 AGPL-3.0 原文（上游与 new-api 同为 AGPL，兼容；**保留上游版权署名**）。
   - `web/canvas/NOTICE.md`（新建）：写明 vendored 自 `github.com/basketikun/infinite-canvas` @ `<基线 commit>`，以及本地修改清单（随实施过程补充，改动点全部可用 `BUILTIN_MODE` 关键字 grep 到）。
   - `web/canvas/VERSION`、`web/canvas/CHANGELOG.md`：从上游**仓库根目录**（不是 web/ 下）拷入——上游 `next.config.ts` 读取 `../VERSION` 与 `../CHANGELOG.md`，vendor 后需把读取路径改为 `./VERSION`、`./CHANGELOG.md`（见 Phase 2.1）。
3. `.gitignore` 追加：`web/canvas/out`、`web/canvas/.next`、`web/canvas/node_modules`。
4. 遵守项目 CLAUDE.md Rule 5：不动 new-api 既有品牌信息；本 fork 新建文件不加 QuantumNous 版权头。

---

## 四、Phase 2 — 画布侧改造（全部改动用 `BUILTIN_MODE` 收敛）

> 原则：对 vendored 代码的每一处修改要么由 `BUILTIN_MODE` 常量控制、要么是静态导出的必要改造，保持 grep-able，便于日后 rebase 上游。

### 4.1 静态导出配置 `web/canvas/next.config.ts`

现状：`output: "standalone"`（约 :17），无 basePath。改为：

```ts
output: "export",
basePath: "/canvas-app",
trailingSlash: true,          // 每个路由导出为 <route>/index.html, Go http.FileSystem 原生可服务
```

并：
- `env` 中追加 `NEXT_PUBLIC_BUILTIN_MODE: process.env.NEXT_PUBLIC_BUILTIN_MODE || ""`（构建期烘焙）;
- 把 `../VERSION`、`../CHANGELOG.md` 的读取改为 `./VERSION`、`./CHANGELOG.md`。

产物目录变为 `web/canvas/out/`（Next 16 的 `output:"export"` 由 `next build` 直接产出，无单独 export 命令）。

**basePath 语义**：`next/link`、`useRouter().push`、静态资源引用自动加 `/canvas-app` 前缀，导航代码无需逐处改；但**手写的 `fetch("/api/prompts")`、`fetch("/api/canvas/projects")` 等字面量 URL 不受 basePath 影响**——它们会打到 Go 服务根路径，这正是我们要的（`/api/prompts`、`/api/canvas/*`、`/pg/*` 都由 Go 提供）。这些登录态 API 必须显式带 `New-Api-User` 头，不能裸 fetch。

### 4.2 删除两个 Next.js 服务端路由（静态导出硬阻塞，留着构建必失败）

1. **删 `src/app/api/prompts/route.ts`**（258 行，GitHub 提示词抓取代理）→ 逻辑移植到 Go（见 §5.3）。前端调用点是字面量 `/api/prompts`（`src/services/api/prompts.ts:35`），静态导出后自然打到 Go 的同名端点；但该 fetch 必须改为带 `builtinHeaders()`，因为 Go 端 `/api/prompts` 仅登录可见并使用 `middleware.UserAuth()`。
2. **删 `src/app/webdav-proxy/route.ts`**（WebDAV 备份代理）。内置模式下隐藏整个 WebDAV tab 与同步入口，不保留 direct-only，也不提供 Go 代理。`src/services/webdav-sync.ts` 可保留源码但 UI 不可触达；若被调用应抛出「内置模式不支持 WebDAV 同步」。

### 4.3 动态路由 `/canvas/[id]` → 查询参数（静态导出不支持无 generateStaticParams 的动态段）

改造为静态页 `/canvas/editor?id=<projectId>`：

1. 新建 `src/app/(user)/canvas/editor/page.tsx`：`<Suspense>` 包裹后渲染现有 `CanvasClientPage`（**`useSearchParams` 在静态导出下必须有 Suspense 边界，否则构建报错**）。
2. 移动 `src/app/(user)/canvas/[id]/canvas-client-page.tsx` → `editor/` 下；删除 `[id]/` 目录。
3. `canvas-client-page.tsx` 内（约 :222）`useParams<{id:string}>()` 取 projectId 改为 `useSearchParams().get("id") ?? ""`（该文件 :224 已在用 `useSearchParams`，无需新 import）。
4. 导航调用点共 4 处，全部改为 `/canvas/editor?id=${id}`：
   - `src/app/(user)/canvas/page.tsx:35`（注意原代码拼接了 `agentQuery`，它以 `?` 开头，改造后要合并成 `&` 连接）
   - `src/components/canvas/canvas-project-card.tsx:25`
   - `canvas-client-page.tsx:1035`（另 :1041、:2507 是跳 `/canvas` 列表页，不用改）
5. 其他用到 `useSearchParams` 的页面（`canvas/page.tsx`、`canvas-local-agent-panel.tsx`、`canvas-project-card.tsx`、`client-root-init.tsx`）按 `bun run build` 的报错逐个补 `<Suspense>` 边界，预计 2–4 处。

### 4.4 内置模式：配置 store（核心补丁面 `src/stores/use-config-store.ts`）

**现状核实**：
- 多渠道结构 `ModelChannel[] {id, name, baseUrl, apiKey, apiFormat, models}`（:10-16），模型选择格式 `"channelId::modelName"`；
- URL 拼接汇合点 `buildApiUrl`（:373）：

```ts
export function buildApiUrl(baseUrl: string, path: string) {
    let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    ...
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || ...
        ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;   // ← 会把 "/pg" 拼成 "/pg/v1/..."
    return `${apiBaseUrl}${path}`;
}
```

传入的 path 均为 `/models`、`/images/generations`、`/images/edits`、`/responses`、`/videos`、`/videos/{id}`、`/videos/{id}/content`、`/audio/speech`（`/v1` 由该函数追加）。

**改动**：
1. 顶部导出常量：
   ```ts
   export const BUILTIN_MODE = process.env.NEXT_PUBLIC_BUILTIN_MODE === "1";
   export const BUILTIN_CHANNEL_ID = "newapi-builtin";
   ```
2. `BUILTIN_MODE` 时 `defaultConfig.channels` 首位预置：`{id: BUILTIN_CHANNEL_ID, name: "站内", baseUrl: "/pg", apiKey: "", apiFormat: "openai", models: []}`。
3. persist 的 `merge`（:201）/ `normalizeChannels`（:325）：`BUILTIN_MODE` 下每次**强制重播种且只保留内置渠道**（锁定 baseUrl/apiKey/apiFormat 不被用户改坏），删除/忽略所有用户持久化的外部渠道与 BYO key 配置。保留内置渠道已拉取的 `models` 列表、`modelMeta`/能力信息与用户的模型选择。
4. `buildApiUrl` 的「已完整」判断追加 `|| lowerBaseUrl.endsWith("/pg")` → `/pg` + `/images/generations` = `/pg/images/generations`（相对 URL，axios/fetch 同源直达）。
5. `isAiConfigReady`（:167）：内置渠道豁免 `apiKey.trim()` 非空检查（只要选了模型即 ready）。
6. 渠道管理 UI（`app-config-modal.tsx`）：内置模式隐藏新增渠道、删除渠道、baseUrl、apiKey、apiFormat 等外部渠道配置能力；仅保留「站内」渠道模型刷新与模型选择。`updateChannel`/`deleteChannel` 仍需加守卫，防止通过旧 localStorage 或开发者工具破坏内置渠道。
7. `/pg/models` 响应中的 `supported_endpoint_types` 必须保存在画布侧模型元数据中，替代 `isImageModelName`/`isVideoModelName`/`isAudioModelName` 的关键词推断。能力映射建议：
   - `image-generation` → 图片生成节点；
   - `openai-video` → 视频节点；
   - `openai-response` → 文本/画布助手候选；仅 `openai` 的模型只有在 new-api 已能稳定转换/代理到 Responses 时才可作为助手候选；
   - 音频 TTS 需新增 endpoint type（建议 `audio-speech`）或模型元数据能力，否则无法可靠筛选。
8. 内置渠道必须禁用 Seedance/火山方舟直连判断：即使模型名包含 seedance/ark，也不能走画布的 `/contents/generations/tasks` 路径，必须经 new-api `/pg/videos` 或由模型能力筛选隐藏。

### 4.5 内置模式：请求头与 401 处理

**现状核实**：三个 service 各有一份 `aiHeaders`，无条件发 `Authorization: Bearer ${config.apiKey}`：
- `src/services/api/image.ts:235-240`（另 `fetchImageModels` :732 内联拼头、`requestStreamingResponse` :390 复用 aiHeaders）
- `src/services/api/video.ts:30-34`
- `src/services/api/audio.ts:13-17`

**改动**：
1. 新建 `src/lib/builtin-auth.ts`：
   ```ts
   export function builtinHeaders(): Record<string, string> {
     const uid = typeof localStorage !== "undefined" ? localStorage.getItem("uid") : null;
     return uid ? { "New-Api-User": uid } : {};
   }
   export function handleBuiltinAuthError(status: number, isBuiltinChannel: boolean) {
     if (isBuiltinChannel && status === 401) window.location.href = "/login?expired=true";
   }
   ```
2. 三处 `aiHeaders` + `fetchImageModels` 内联头统一改为：`apiKey 非空 → Bearer 头；为空 → builtinHeaders()`。
3. `src/services/api/prompts.ts` 的 `/api/prompts` fetch 也必须附带 `builtinHeaders()`；否则 `middleware.UserAuth()` 会因缺少 `New-Api-User` 返回 401。
4. 视频/音频的配置断言 `assertVideoConfig`（video.ts:231）、`assertAudioConfig`（audio.ts:52）现抛「请先配置 API Key」→ 内置渠道豁免（推荐做法：让 `resolveModelRequestConfig` 一并返回 `channelId`，用 `channelId === BUILTIN_CHANNEL_ID` 判断，比字符串比对 baseUrl 干净）。
5. 各错误读取路径（image.ts:220 `readStatusError`、video.ts:285、audio.ts:80 附近）对内置渠道的 401 调 `handleBuiltinAuthError`（session 过期跳登录；`/login` 是 new-api SPA 路由，同源整页跳转）。

### 4.6 内置模式修饰（低优先，同 PR 内完成）

- 版本检查（`use-version-check.ts` 拉 raw.githubusercontent）与 GitHub 链接等 UI 在 `BUILTIN_MODE` 下隐藏——生产环境出不了网，噪音。
- `src/constant/navigation-tools.ts`：提示词库入口保留（本次做全量，Go 端点会就位）。
- 首页 `(user)/page.tsx:32` 的 `fetchPrompts` 调用确认有 `.catch` 兜底（Go 端点失败返回空列表时首页不崩）。

### 4.7 服务端项目持久化接入

画布原有 IndexedDB/localforage 仍保留，但内置模式下改为“服务端为准、本地为缓存”：

1. 新建 `src/services/api/canvas-projects.ts`，封装 `/api/canvas/projects` 的 list/get/put/delete/sync，所有请求带 `builtinHeaders()`。
2. `use-canvas-store.ts` hydrate 流程改为：
   - 先从本地缓存快速渲染；
   - 登录态可用后拉服务端项目列表；
   - 服务端数据较新时覆盖本地缓存；
   - 本地有未同步草稿时触发 sync/冲突处理。
3. 项目创建、重命名、节点/连线变更、删除动作需要 debounce 保存到服务端（建议 800-1500ms），并保留本地即时写入，避免 UI 卡顿。
4. 前端保存 body 不直接传 File/Blob；项目 JSON 中只保存素材引用（`asset_id`、节点引用关系、可选缩略图缓存 key），大二进制统一进入素材库 OBS。历史 dataUrl/blob URL 只作为本地临时预览，不作为服务端项目持久化内容。
5. 409 冲突时不要静默覆盖：保留本地副本，提示用户选择覆盖服务端或加载服务端版本。v1 可先用 modal 简化处理。

---

## 五、Phase 3 — new-api 后端新增

### 5.1 `/pg` 路由扩展（`router/relay-router.go`）

现状（:65-80）：`playgroundRouter`（`UserAuth + KYCRequired + Distribute`）已有 `POST /pg/chat/completions`、`POST /pg/images/generations`、`POST /pg/videos`、`GET /pg/videos/:task_id`；`playgroundUtilRouter`（仅 `UserAuth`）已有 `GET /pg/images/proxy`。

追加：

```go
// playgroundRouter 组内 (带 Distribute, POST 有模型可分发):
playgroundRouter.POST("/images/edits", controller.PlaygroundImage)      // RelayFormatOpenAIImage 已覆盖 edits, 复用现有函数
playgroundRouter.POST("/responses", controller.PlaygroundResponses)     // 画布助手/问图 流式
playgroundRouter.POST("/audio/speech", controller.PlaygroundAudioSpeech)

// playgroundUtilRouter 组内 (仅 UserAuth, GET 无模型不走 Distribute):
playgroundUtilRouter.GET("/videos/:task_id/content", controller.VideoProxy)
playgroundUtilRouter.GET("/models", func(c *gin.Context) {
    controller.ListModels(c, constant.ChannelTypeOpenAI)
})
```

**已核实的复用依据**：
- `/v1` 侧同格式路由已存在（relay-router.go :114 `/responses` → `RelayFormatOpenAIResponses`，:128 `/images/edits` → `RelayFormatOpenAIImage`，:144 `/audio/speech` → `RelayFormatOpenAIAudio`），playgroundRelay 对 RelayFormat 泛化，无新逻辑。
- `controller.VideoProxy`（`controller/video_proxy.go`）仅依赖 `c.GetInt("id")` 查 (userID, taskID)，`UserAuth()` 恰好注入 `id`，可直接复用（内部已是 302 到 OBS 签名 URL 的逻辑）。
- `controller.ListModels(c, ChannelTypeOpenAI)`（`controller/model.go:112`）在无 token 上下文时按用户组可用模型返回，OpenAI 格式 `{"data":[{"id":...,"supported_endpoint_types":[...]}],"object":"list"}`——画布 `fetchImageModels` 读 `response.data.data`（image.ts:732-740），结构匹配；需扩展画布侧模型结构保存 `supported_endpoint_types`。
- gin 路由树：`GET /pg/videos/:task_id`（A 组）与 `GET /pg/videos/:task_id/content`（B 组）不同路径不冲突。

**必须同步修**：
- `relay/constant/relay_mode.go` 的 `Path2RelayMode` 补 `/pg/images/edits`、`/pg/audio/speech`、`/pg/responses`。否则 `/pg/audio/speech` 会落到默认文本 relay，`/pg/images/edits` 也无法稳定进入图片编辑模式。
- `middleware/distributor.go` 的 multipart model 解析补 `/pg/images/edits`。现状只覆盖 `/v1/images/edits`，`/pg/images/edits` 会读不到 multipart 里的 `model`。
- `router/web-router.go` NoRoute 的 API 前缀守卫（约 :35）补 `/pg` 前缀 → 打错的 /pg 路径返回 API 404 而非 HTML fallback。

### 5.2 `controller/playground.go` 追加两个一行函数

```go
func PlaygroundResponses(c *gin.Context)   { playgroundRelay(c, types.RelayFormatOpenAIResponses) }
func PlaygroundAudioSpeech(c *gin.Context) { playgroundRelay(c, types.RelayFormatOpenAIAudio) }
```

计费自动生效：`playgroundSetupContext` 合成临时 token → 正常 relay 预扣/结算链路（`service/pre_consume_quota.go`），与操练场一致。

### 5.3 提示词库 Go 移植：`GET /api/prompts`（新文件 `controller/canvas_prompts.go`）

移植上游 `src/app/api/prompts/route.ts`（258 行，vendor 前先留档参考）。行为规格：

- **生产原则**：生产环境默认不能访问 `raw.githubusercontent.com`，因此 v1 提示词库必须本地化发布，不能依赖运行时从 GitHub raw 抓取。GitHub 源只作为开发/运营离线同步来源。
- **数据源优先级**：
  1. 数据库表 `canvas_prompts`（推荐主路径，便于后续运营增删改、排序、上下架）；
  2. 服务端内置 seed 快照（建议新文件 `data/canvas/prompts_seed.json`，用 `go:embed` 打进二进制，作为首次启动/迁移兜底）；
  3. 运行时内存缓存（从 DB 或 seed 加载）。
  首次启动或迁移时，如果 `canvas_prompts` 为空，则从 seed 快照导入数据库。之后 `/api/prompts` 只读 DB/缓存，不访问 GitHub raw。
- **seed 生成**：实施时新增离线脚本（建议 `scripts/canvas_prompts_sync` 或 `go run ./cmd/canvas-prompts-sync`），在有外网的开发/CI/运营环境运行：并发抓 6 个 GitHub 仓库的 raw 文件（EvoLinkAI/awesome-gpt-image-2-API-and-Prompts 的 `data/ingested_tweets.json` + 8 个 case markdown、ZeroLu/awesome-gpt-image、ImgEdify/Awesome-GPT4o-Image-Prompts、YouMind-OpenLab 两个仓、davidwuw0811-boop/awesome-gpt-image2-prompts），markdown 正则解析出 {title, prompt, image, githubUrl, category, tags}。正则模式直接从 route.ts 翻译（如 `### Case \d+: \[...\]\(...\)` + ```` ```prompt``` ```` 代码块提取）。脚本输出稳定 JSON seed，不在生产请求链路执行。
- **DB 模型（建议新表 `canvas_prompts`）**：`Id`、`Source`、`SourceId`、`Title`、`Prompt`、`Category`、`Tags TEXT`、`GithubUrl`、`CoverUrl`、`CoverAssetUrl`、`Sort`、`Enabled`、`CreatedAt`、`UpdatedAt`。`Tags` 用 JSON 字符串存 TEXT，兼容 SQLite/MySQL/PostgreSQL；`Source + SourceId` 建唯一索引避免重复导入。
- **图片本地化**：离线同步脚本同时下载提示词封面图，上传到腾讯云对象存储/EdgeOne 可访问域名，生成稳定 `CoverAssetUrl`。数据库只存 URL 和元数据，不存图片二进制。生产前端优先展示 `CoverAssetUrl`；没有则显示占位图。
- **EdgeOne 定位**：EdgeOne 适合作为提示词封面图、可选静态 JSON 快照的 CDN/边缘承载，不建议把“提示词库页面”整体做成独立 EdgeOne 静态页替代 `/api/prompts`，否则会绕开 new-api 的登录态、导航开关和权限模型。若要用 EdgeOne 静态展示，也应作为公开营销/示例页；站内画布仍走 `/api/prompts`。
- **缓存**：Go 启动时从 DB 加载到进程内存，TTL 6h 或按更新时间主动失效；数据库为空时加载 seed 并尝试导入 DB。任何外部网络失败都不应导致 `/api/prompts` 返回空列表。
- **查询参数**：`keyword`（标题/prompt 模糊，小写）、`tag`（可多值）、`category`、`page`（默认 1）、`pageSize`（默认 20，上限 100）；响应 JSON 结构与 route.ts 完全一致，但画布前端 `src/services/api/prompts.ts` 需要补 `New-Api-User` 头。
- **路由**：挂在 `/api` 组，`middleware.UserAuth()`（登录可见）。已核实 new-api `/api` 组无 `/api/prompts` 冲突。
- **前端要求**：`src/services/api/prompts.ts` 必须带 `New-Api-User`，不能裸 `fetch`。提示词卡片优先读 `coverAssetUrl`；没有图片时渲染占位态；不要在前端硬编码 GitHub raw 镜像规则。
- **运营更新**：v1 可先通过离线脚本生成 seed + SQL/JSON 导入；后续如需要后台维护提示词库，再新增 admin CRUD 页面。脚本更新时必须保留 `githubUrl/source` 做来源追踪与授权审计。
- **工程规约**：JSON 一律 `common.Marshal/Unmarshal`（Rule 1）；新文件不加版权头（Rule 5 例外条款）。

### 5.4 画布项目服务端持久化：`/api/canvas/projects`

v1 即做数据库持久化，避免用户清浏览器缓存、换设备或 Safari 清站点数据后丢失画布。

**数据模型（建议新表 `canvas_projects`）**：

```go
type CanvasProject struct {
    Id        int64  `gorm:"primaryKey" json:"id"`
    UserId    int    `gorm:"index;not null" json:"user_id"`
    ProjectId string `gorm:"size:64;index;not null" json:"project_id"` // 画布前端 nanoid/uuid
    Title     string `gorm:"size:255" json:"title"`
    Data      string `gorm:"type:text;not null" json:"data"`            // 项目 JSON，跨 DB 用 TEXT
    Version   int    `gorm:"not null;default:1" json:"version"`
    CreatedAt int64  `json:"created_at"`
    UpdatedAt int64  `gorm:"index" json:"updated_at"`
}
```

**DB 兼容要求**：
- `Data` 使用 `TEXT`，不要用 JSONB；SQLite/MySQL/PostgreSQL 同时兼容。
- `(user_id, project_id)` 建唯一索引；不要依赖数据库特定 UPSERT 语法，优先用 GORM 查询后 Create/Updates，或按三库兼容写分支。
- JSON marshal/unmarshal 使用 `common.Marshal` / `common.Unmarshal`。

**API 设计（均 `middleware.UserAuth()`）**：
- `GET /api/canvas/projects`：返回当前用户项目列表，可只返回轻量字段 + data，也可支持 `?summary=1`。
- `GET /api/canvas/projects/:project_id`：读取单个项目 JSON。
- `PUT /api/canvas/projects/:project_id`：创建或覆盖保存，body 包含 `{title,data,version,updatedAt}`。
- `DELETE /api/canvas/projects/:project_id`：删除单个项目。
- `POST /api/canvas/projects/sync`：可选批量同步，接收本地变更数组，返回服务端最新快照与冲突信息。

**冲突策略（v1 简化）**：
- 以 `updated_at` / `version` 做乐观并发。服务端版本更新时递增 `version`。
- 单设备常规使用直接覆盖；多设备并发时返回 `409` + 服务端项目，让前端提示用户保留本地副本或覆盖服务端。
- IndexedDB/localforage 仍保留为本地缓存；首次进入画布先拉服务端，离线或失败时才读本地缓存，并在 UI 中提示未同步。

### 5.5 画布素材库：OBS 存储 + 用户级容量限制

画布项目 JSON 只保存结构，素材库负责保存用户私有图片/视频/音频资产。这里不能沿用现有 relay 结果落 OBS 的“功能-模型/日期/user/task”规则作为素材库主规则；那套规则适合生成结果归档，不适合用户素材管理、配额统计、删除和跨项目复用。

**存储原则**：
- 素材二进制统一存 new-api 已配置的 OBS/对象存储；数据库不存 File/Blob/base64。
- OBS key 使用用户隔离命名空间，例如 `canvas/assets/{user_id}/{yyyy}/{mm}/{asset_id}.{ext}`。`asset_id` 使用 uuid/nanoid，不使用用户原始文件名，防路径注入和重名覆盖。
- 数据库保存 `obs_key`，对前端返回短期签名 URL 或 CDN URL；不要把永久 AK/SK、bucket 内部路径或可枚举 key 暴露给前端。
- 提示词库封面图是平台公共资产，不计入用户容量；画布上传、画布生成后保留、用户导入到素材库的图片/视频/音频计入用户容量。

**容量策略（产品默认值，可配置）**：
- 普通用户：`200MB`。
- 高级用户：`1TB`。
- 规则按“用户总占用”限制，而不是按单项目、单文件夹或旧的模型计费 quota 限制。AI 调用额度与素材存储额度分开，上传/保存素材不扣 token quota。
- 配额来源建议优先级：
  1. 用户级覆盖值（admin 单独给某用户设置）；
  2. 当前有效订阅计划字段（建议给 `subscription_plans` 新增 `canvas_storage_limit_bytes`）；
  3. 用户组配置映射（如 `default=209715200`, `premium=1099511627776`）；
  4. 系统默认值（普通 200MB）。
- `0` 不建议表示无限，避免和“未配置”混淆；如需无限用 `-1` 或显式布尔字段 `unlimited_canvas_storage`。

**数据模型（建议）**：

```go
type CanvasAsset struct {
    Id         int64  `gorm:"primaryKey" json:"id"`
    UserId     int    `gorm:"index;not null" json:"user_id"`
    AssetId    string `gorm:"size:64;uniqueIndex;not null" json:"asset_id"`
    ProjectId  string `gorm:"size:64;index" json:"project_id,omitempty"`
    Name       string `gorm:"size:255" json:"name"`
    MediaType  string `gorm:"size:32;index" json:"media_type"` // image/video/audio
    MimeType   string `gorm:"size:128" json:"mime_type"`
    SizeBytes  int64  `gorm:"not null;default:0" json:"size_bytes"`
    Width      int    `json:"width,omitempty"`
    Height     int    `json:"height,omitempty"`
    DurationMs int64  `json:"duration_ms,omitempty"`
    ObsKey     string `gorm:"size:512;not null" json:"-"`
    Hash       string `gorm:"size:128;index" json:"hash,omitempty"`
    Source     string `gorm:"size:32;index" json:"source"` // upload/generated/import
    Status     string `gorm:"size:32;index" json:"status"` // active/deleted/pending
    CreatedAt  int64  `json:"created_at"`
    UpdatedAt  int64  `json:"updated_at"`
    DeletedAt  int64  `gorm:"index" json:"deleted_at,omitempty"`
}

type CanvasStorageUsage struct {
    UserId       int   `gorm:"primaryKey" json:"user_id"`
    UsedBytes    int64 `gorm:"not null;default:0" json:"used_bytes"`
    LimitBytes   int64 `gorm:"not null;default:0" json:"limit_bytes"` // 快照/缓存，可由订阅变更刷新
    AssetCount   int   `gorm:"not null;default:0" json:"asset_count"`
    UpdatedAt    int64 `json:"updated_at"`
}
```

**API 设计（均 `middleware.UserAuth()`）**：
- `GET /api/canvas/assets`：分页列出当前用户素材，支持 `media_type`、`project_id`、`keyword`。
- `POST /api/canvas/assets/upload`：multipart 上传素材；先用 `Content-Length`/文件头做预检查，再以实际写入字节数最终扣占用。
- `POST /api/canvas/assets/import`：把画布生成结果或已有 OBS 对象登记进素材库；若已有对象可复用，不重复上传，但必须校验 owner/userId。
- `GET /api/canvas/assets/:asset_id/url`：返回短期签名 URL/CDN URL。
- `DELETE /api/canvas/assets/:asset_id`：软删除 DB 记录并扣减 `used_bytes`，异步删除 OBS 对象；失败进入重试队列，不阻塞用户操作。
- `GET /api/canvas/storage`：返回 `{usedBytes, limitBytes, remainingBytes, assetCount}`，前端用于进度条和上传前提示。

**配额扣减与并发**：
- 上传前：如果 `used_bytes + incoming_size > limit_bytes`，直接 413/429 类错误，提示升级或清理素材。
- 上传中：不能只信 `Content-Length`，服务端要限制最大读取字节，实际写入后再以真实 `SizeBytes` 入库。
- 并发上传：同一用户需要事务级串行化更新 `CanvasStorageUsage`。实现上可在事务内锁用户 usage 行，或用 `users` 行 `quota+0` 类似项目现有锁行模式，但不要复用 token quota 字段。
- OBS 上传成功但 DB 事务失败时，要 best-effort 删除刚上传对象；DB 成功但 OBS 删除失败时，用异步清理任务兜底。
- 删除/覆盖项目 JSON 不自动删除素材；只有用户从素材库删除，或后台垃圾回收确认无项目引用后，才释放容量。

**前端接入**：
- 画布节点里的媒体引用从 dataUrl/blob URL 改为 `asset_id` + 临时展示 URL；项目 JSON 保存 `asset_id`，不保存大 base64。
- 本地 IndexedDB 可继续缓存缩略图/最近素材，但服务端素材库是权威来源。
- 上传入口、生成结果“保存到素材库”、素材库面板都要展示剩余容量；超过配额时禁止上传/保存，给出清理或升级入口。

### 5.6 强门禁与画布模块开关

新增轻量中间件（建议 `middleware.CanvasStaticAuth()`）供 `/canvas-app/*` 使用：

- 只校验 session cookie 中的 `id`、`status`、`role`，不要求 `New-Api-User` 头；
- 校验 HeaderNavModules 中 `canvas !== false`，关闭后拒绝访问；
- 未登录访问 `/canvas-app/*`：浏览器请求返回 302 到 `/login`；非 HTML/资源请求也可返回 401；
- 已登录但被禁用/无权限：返回 403；
- 不接受 access token 作为静态页面登录态，避免用户用系统 token 直接打开内置 UI。

`/_authenticated/canvas` 仍由 default SPA 路由保护；classic 外链 `/canvas-app/` 也依赖本中间件兜底。`/api/prompts`、`/api/canvas/projects`、`/pg/*` 继续使用 `UserAuth()`，必须带 `New-Api-User`。

### 5.7 gpustackplus 与自建渠道能力补齐

当前代码核实（2026-07-07 更新：已对齐 GPUStack M4 门面契约）：
- `relay/channel/gpustackplus` 支持同步图片生成 `/v1/images/generations`（t2i）**与图片编辑 `/v1/images/edits`（i2i，qwen-image-edit，底图走 JSON image 字段或 multipart image 文件）**；两者内部经门面 `POST /v1/videos` + 阻塞轮询实现。
- `relay/channel/task/gpustackplus` 支持视频任务 `/v1/videos`，可经 `/pg/videos`、`/pg/videos/:id`、`/pg/videos/:id/content` 给画布使用。
- `common.GetEndpointTypesByChannelType` 已对 ChannelTypeGPUStackPlus 按模型名区分能力：图片系（含 image 且非 i2v/t2v）→ `image-generation`，视频系 → `openai-video`。
- 当前不支持音频 TTS，也不支持 OpenAI Responses/画布助手。

为了让 gpustackplus 在画布中完整可用，需补：
- 图片编辑 mask：`/v1/images/edits` 的底图已支持，mask（image_mask）转换尚未接（门面/引擎侧字段为 image_mask，qwen-edit 当前不用 mask）；如画布需要按"可编辑"细分，可再引入独立 `image-edit` endpoint type。
- 音频：若 gpustackplus 上游提供 TTS，新增/扩展 audio adaptor，补 endpoint type（建议 `audio-speech`），并让 `/pg/audio/speech` 正确分发。
- 画布助手：若希望 gpustackplus 模型作为助手模型，需支持 `openai-response` 或至少 `openai` chat/completions；否则助手模型列表应隐藏 gpustackplus-only 模型。
- 能力展示：`common.GetEndpointTypesByChannelType` 和模型元数据要能表达上述能力，`/pg/models` 返回给画布后由前端分类。

---

## 六、Phase 4 — 导航 + iframe 入口页

### 6.1 web/default（Rsbuild + TanStack Router）

1. `src/features/system-settings/maintenance/config.ts`：`HeaderNavModulesConfig` 加 `canvas: boolean`；`HEADER_NAV_DEFAULT` 加 `canvas: true`。（`HeaderNavModules` 是自由 JSON option，**后端零改动**。）
2. `src/features/system-settings/maintenance/header-navigation-section.tsx`：admin 开关表单加「画布」行（zod schema、`toFormValues`、`onSubmit`、`simpleModules` 四处）。
3. `src/hooks/use-top-nav-links.ts`：`DEFAULT_HEADER_NAV_MODULES` 加 canvas；`modules.canvas !== false` 时 `links.push({ title: t('Canvas'), href: '/canvas' })`。
4. 新路由 `src/routes/_authenticated/canvas.tsx`（仿 `src/routes/_authenticated/chat/$chatId.tsx` 的 iframe 模式，但无需取 key）：

   ```tsx
   <iframe src="/canvas-app/" className="h-full w-full border-0" title="Canvas" />
   ```

   全幅布局、去内边距；同源 cookie + `localStorage['uid']` 直通 iframe，无需注入任何凭证。
5. 路由级开关门禁：如果 `modules.canvas === false`，直接 redirect 到 `/dashboard` 或渲染 404/403，不能只隐藏导航。
6. i18n：`web/default/src/i18n/locales/*.json` 补 `Canvas` 键（en 为键名；zh: 画布，其余语言给对应翻译）。

### 6.2 web/classic（Vite + Semi）

- `src/hooks/common/useNavigation.js`：`modules.canvas !== false` 时加导航项，v1 从简用外链形态 `<a href="/canvas-app/" target="_blank">`（不建 classic iframe 路由）。
- `src/pages/Setting/Operation/SettingsHeaderNavModules.jsx`：classic 后台顶栏管理也要把 `canvas: true` 加入默认值、解析、重置、保存与开关卡片。否则 classic admin 保存 HeaderNavModules 时会丢失 `canvas` 键。
- `src/hooks/common/useHeaderBar.js` / `src/App.jsx` 中解析 HeaderNavModules 的兼容逻辑也要保留未知键，不要只重建白名单导致 `canvas` 丢失。
- classic i18n：翻译键必须放 `locales/{lang}.json` 顶层 `translation` 对象**内部**（CLAUDE.md classic i18n 规则，放外面会静默丢失）。

---

## 七、Phase 5 — Go 伺服 + Docker 打包

### 7.1 `main.go`

```go
//go:embed all:web/canvas/out
var canvasBuildFS embed.FS
```

**必须用 `all:` 前缀**——Next 导出产物含 `_next/` 下划线目录，普通 `//go:embed` 静默跳过下划线开头路径，构建成功但运行时资源全部 404（经典坑）。`router.ThemeAssets` 结构体加 `CanvasBuildFS embed.FS` 字段传入 `SetWebRouter`。

### 7.2 `router/web-router.go` + `common/embed-file-system.go`

1. 在 SPA 静态伺服与 NoRoute fallback **之前**挂：
   ```go
   canvasGroup := router.Group("/canvas-app")
   canvasGroup.Use(middleware.CanvasStaticAuth())
   canvasGroup.Use(static.Serve("/", canvasFS))
   ```
   实现时可按 gin-contrib/static 的实际挂载方式调整，但必须满足：`/canvas-app/*` 先过 `CanvasStaticAuth`，再访问 embed FS。
2. **已核实的坑**：现有 `common.EmbedFolder` 的 `Open("/")` 特判返回 `ErrNotExist`（`embed-file-system.go:26-31`），会让 `/canvas-app/` 根路径落进 SPA fallback 返回 new-api 的 index.html（错误页面）。→ 在 `embed-file-system.go` 新增一个**不带根特判**的变体（如 `EmbedFolderServeRoot`）给画布用。`trailingSlash: true` 使每个画布路由都是 `目录/index.html`，`http.FileSystem` 原生支持目录 index。
3. NoRoute handler 加 `/canvas-app` 前缀分支：未知深链返回画布导出的 `404.html`（静态导出无 SPA fallback 语义，不要回落到画布 index.html 以免路由错乱）。
4. `FRONTEND_BASE_URL` 分支：`SetRouter` 当前在外置前端模式下不调用 `SetWebRouter`，只做 NoRoute 重定向。画布必须抽成独立挂载函数（如 `SetCanvasRouter(router, assets)`），在判断 `FRONTEND_BASE_URL` 前调用，确保 `/canvas-app/*` 永远由 Go 服务。

### 7.3 `Dockerfile` / `makefile` / `.gitignore` / CI

1. **Dockerfile** 新增 builder 阶段（对齐现有 web/default、web/classic 两个 bun 阶段的写法）：
   ```dockerfile
   FROM oven/bun:1 AS builder-canvas
   WORKDIR /build
   COPY web/canvas/package.json web/canvas/bun.lock ./
   RUN bun install
   COPY ./web/canvas .
   RUN NEXT_PUBLIC_BUILTIN_MODE=1 bun run build
   ```
   Go 构建阶段加 `COPY --from=builder-canvas /build/out ./web/canvas/out`。最终镜像不变：单 Go 二进制，无 Node。
2. **makefile**：加 `build-frontend-canvas` target（`cd web/canvas && bun install && NEXT_PUBLIC_BUILTIN_MODE=1 bun run build`），纳入总构建目标。
3. **本地开发**：`go build` 前必须存在 `web/canvas/out`（与 `web/default/dist` 同状况），在 README 或开发文档注明。
4. **CI 核查**：`.github/workflows/` 中凡是直接 `go build` 的工作流（如 electron-build.yml）需要同步加画布构建步骤——`go:embed` 目录缺失会编译失败；仅走 Dockerfile 的 docker 工作流自动覆盖。

---

## 八、验证清单（端到端）

1. `cd web/canvas && bun install && NEXT_PUBLIC_BUILTIN_MODE=1 bun run build` 通过；`bunx serve out` 本地可点开各页面（注意 basePath，直接访问 `/canvas-app/`）。
2. 三个前端构建后 `go build` 通过，本地起服务：登录 → 顶部导航出现「画布」→ 点击 iframe 正常加载。
3. 画布设置里只存在「站内」渠道；新增渠道、API key、baseUrl、apiFormat、WebDAV 入口不可见且不可通过旧 localStorage 恢复。
4. 「刷新模型」→ 列表等于该用户可用模型（走 `/pg/models`），且画布按 `supported_endpoint_types` 分类，而不是按模型名关键词。
5. 文生图（`/pg/images/generations`）成功且**扣费日志出现**；图生图/编辑（multipart `/pg/images/edits`）实测——重点验证 `Path2RelayMode` 与 `middleware.Distribute()` 已覆盖 `/pg/images/edits` 并能从 multipart 取 model。
6. 视频生成 → 轮询（`/pg/videos/:task_id`）→ 播放（`/pg/videos/:task_id/content` 302 到 OBS 签名 URL）。
7. 画布助手对话/问图流式返回（`/pg/responses`，验证 SSE 不被 gzip 中间件缓冲——`/pg/chat/completions` 已证明该链路可行）。
8. 音频节点出声（`/pg/audio/speech`），并确认 `Path2RelayMode` 进入 `RelayModeAudioSpeech`。
9. 提示词库加载（`/api/prompts` 带 `New-Api-User`）；模拟生产无外网 → 仍从 `canvas_prompts` DB 或内置 seed 返回提示词，不访问 GitHub raw。
10. 提示词图片加载：优先展示已预同步到腾讯云对象存储/EdgeOne 的 `coverAssetUrl`；没有图片时显示占位图；浏览器不直接访问 GitHub raw。
11. 画布项目新建/编辑/删除后刷新页面、换浏览器登录，项目仍从 `/api/canvas/projects` 恢复；模拟冲突返回 409。
12. 素材库上传图片/视频/音频 → OBS 对象 key 落在 `canvas/assets/{user_id}/...` 命名空间；项目 JSON 只保存 `asset_id`，不保存 base64。
13. 存储配额：普通用户默认 200MB，高级用户默认 1TB；上传超过额度时拒绝并提示清理/升级；删除素材后 `used_bytes` 正确下降。
14. 未登录直接开 `/canvas-app/` → `CanvasStaticAuth` 立即跳 `/login`，不是等首次 AI 请求才 401。
15. admin 后台关「画布」模块 → 顶部导航项消失；`/_authenticated/canvas` 与 `/canvas-app/` 都拒绝访问（default 与 classic 都验）。
16. 设置 `FRONTEND_BASE_URL` 后，普通 SPA NoRoute 仍按外置前端规则重定向，但 `/canvas-app/` 仍由 Go 服务可登录访问。
17. `docker build .` 成功，容器内复测 2–16。

---

## 九、风险与已知坑

| 风险/坑 | 说明 | 处置 |
|---|---|---|
| `useSearchParams` + 静态导出 | 无 Suspense 边界会**构建失败**（会点名文件） | 按报错补 `<Suspense>`，预计 2–4 处 |
| `go:embed` 下划线目录 | `_next/` 会被普通 embed 静默跳过，构建过但运行时 404 | 必须 `all:web/canvas/out` |
| `EmbedFolder` 根路径特判 | `/canvas-app/` 会掉进 SPA fallback | 新增无特判变体（§7.2） |
| `New-Api-User` 头缺失 | `localStorage['uid']` 不存在（极老会话）→ 401 | 401 统一跳登录重建会话；可选：iframe 路由以 `?uid=` 兜底传入 |
| `/pg/images/edits` multipart | 当前 Distribute 只覆盖 `/v1/images/edits`，`/pg` 会读不到 model | 必须扩展路径判断并加单测 |
| `/pg/audio/speech` relay mode | 当前 `Path2RelayMode` 不识别 `/pg/audio/speech`，会落到默认 text relay | 必须补 `/pg/audio/speech` mode 映射 |
| `/api/prompts` 裸 fetch | Go 端 `UserAuth()` 需要 `New-Api-User`，裸 fetch 会 401 | `prompts.ts` 使用 `builtinHeaders()` |
| 提示词库远程源不可达 | 生产 HCSO 默认访问不了 `raw.githubusercontent.com`，不能在请求链路实时抓 GitHub 提示词 | 提示词文本/标签/分类预同步到 `canvas_prompts` DB；内置 seed 用于首次导入和兜底；GitHub 抓取只在离线脚本执行 |
| 提示词图片不可达 | GitHub raw 图片在服务端和用户浏览器侧都可能不可达 | 离线脚本提前下载图片并上传腾讯云对象存储/EdgeOne，DB 存 `coverAssetUrl`；前端不直连 raw，无图显示占位 |
| 素材库滥用 OBS 空间 | 如果只把生成/上传结果落 OBS，不做用户容量限制，会被少数用户占满 bucket | 新增 `canvas_assets` + `canvas_storage_usage`，按用户总量限制，普通 200MB/高级 1TB，上传前后双校验 |
| 旧 OBS key 规则不适合素材库 | 现有 relay key 偏生成结果归档，无法可靠表达素材 owner、复用、删除和配额 | 素材库使用 `canvas/assets/{user_id}/...` 独立命名空间，DB 持有 owner/size/status |
| 素材删除与容量不一致 | OBS 删除失败或 DB 事务失败会导致容量统计漂移 | DB 事务先软删并扣容量，OBS 删除异步重试；上传成功但 DB 失败时 best-effort 删除对象 |
| `FRONTEND_BASE_URL` | 外置前端模式会绕过 `SetWebRouter` | 画布静态路由抽成独立挂载，早于 NoRoute 重定向 |
| 静态资源鉴权 | `UserAuth()` 要求 `New-Api-User`，不能用于 JS/CSS 请求 | 新增 `CanvasStaticAuth()` 只验 session + 模块开关 |
| 模型能力粒度不足 | 现有 endpoint type 没有 `audio-speech` / `image-edit` | 扩展 endpoint type 或模型元数据能力后再给画布筛选 |
| gpustackplus 能力缺口 | 当前仅支持图片生成与视频，不支持图片编辑/音频/Responses | 按 §5.7 补能力，未补前对应模型必须从相关节点隐藏 |
| 上游同步 | vendored fork 会与上游漂移 | NOTICE.md 记基线 commit；改动全部 `BUILTIN_MODE` 收敛可 grep |
| 二进制体积 | antd 6 全量静态产物预计 10–30 MB 进 embed | 可接受；上线后关注镜像体积变化 |
| AGPL 合规 | 上游要求保留作者信息与前端标识 | 保留 LICENSE/署名/页面标识；new-api 同为 AGPL 无冲突 |
| 项目持久化冲突 | 多设备同时编辑同一画布可能覆盖 | `version`/`updated_at` 乐观并发，冲突返回 409 |

---

## 十、实施顺序与交付切分

建议按依赖顺序切 8 步，每步可独立验证：

| 步骤 | 内容 | 验证 |
|---|---|---|
| S1 | Phase 1 vendor + Phase 2.1/2.2/2.3（静态导出跑通） | `bun run build` 出 `out/`，本地 serve 可浏览 |
| S2 | Phase 2.4/2.5/2.6（内置模式、禁 BYO key、隐藏 WebDAV） | 构建通过；请求打向 `/pg/*` 或 `/api/*` 且带 `New-Api-User` |
| S3 | Phase 3.1/3.2（/pg 路由 + relay mode/distribute 修复） | curl + session/header 逐端点通；扣费日志正确 |
| S4 | Phase 3.3（提示词库 Go） | `/api/prompts` 登录可见；无 header 401；生产无外网仍从 DB/seed 返回；图片走腾讯云/EdgeOne 资产 URL 或占位态 |
| S5 | §5.4 + §5.5（画布项目 DB 持久化 + 素材库 OBS/配额） | 刷新/换浏览器项目仍恢复；素材上传进 OBS；普通 200MB/高级 1TB 配额生效 |
| S6 | Phase 4（导航 + iframe 页 + classic 管理开关） | 两主题导航可见/可关；关闭后强门禁生效 |
| S7 | Phase 5（embed + Docker + FRONTEND_BASE_URL 兼容） | `go build` / `docker build` 通过；外置前端模式下 `/canvas-app/` 仍由 Go 服务 |
| S8 | gpustackplus 能力补齐 | 图片编辑、音频、助手能力按 §5.7 补齐或在画布中隐藏不可用模型 |

S3/S4/S5（后端）与 S1/S2（画布前端）可并行；S6/S7 依赖前后端基础能力；S8 可独立开发，但上线前必须决定未补能力的模型隐藏策略。

---

## 十一、实施进度记录(2026-07-07,S1–S7 已完成)

> 本节由实施会话追加。S1–S7 已全部实施并在本地 SQLite 实例端到端验证通过;S8 未做(见「注意事项」)。

### 11.1 完成状态

| 步骤 | 状态 | 验证结果 |
|---|---|---|
| S1 vendor + 静态导出 | ✅ | `bun run build` 出 `out/`(4.4MB);basePath/trailingSlash 生效;补了 2 处 Suspense 边界(`canvas/page.tsx`、editor 包装页) |
| S2 内置模式 | ✅ | 全部改动可 grep `BUILTIN_MODE`;`bunx tsc --noEmit` 无新增错误(上游存量错误不计) |
| S3 /pg 路由 | ✅ | 冒烟:`/pg/models` 无登录 401、登录+头 200;`/pg` 打错路径返回 API 404 |
| S4 提示词库 | ✅ | 离线脚本实跑抓到 **877 条** 生成 seed;`/api/prompts` 无头 401、带头返回数据;DB 空时自动导 seed |
| S5 项目持久化 + 素材库 | ✅ | PUT→409(旧 version)→200(对 version)→DELETE 全链路实测;storage 返回默认 200MB |
| S6 导航(**仅 classic**) | ✅ | classic 构建通过;**default 主题按用户指示未动**(中途指示"只做 classic",已回滚 default 全部改动) |
| S7 embed + Docker | ✅ | 未登录 `/canvas-app/` 302 /login;登录后全页面+`_next` 资源 200;深链 404.html;admin 关模块后 404;`go build`/`go vet`/`gofmt` 干净 |
| S8 gpustackplus 能力补齐 | ✅(2026-07-07 合并 main 后闭环) | 见 11.3 更新说明 |

### 11.2 与设计稿的实现偏差(均有理由,执行时以此为准)

1. **seed 位置**:`controller/canvas_prompts_seed.json`(随 `controller/canvas_prompts.go` 一起 `go:embed`),不是设计稿的 `data/canvas/prompts_seed.json` —— 仓库 `.gitignore` 忽略了 `data/`,放那里无法提交、CI 构建必失败。
2. **画布静态伺服未用 `EmbedFolder` 变体 + group 中间件**,改为显式 catch-all 路由(`router/canvas-router.go`:`GET/HEAD /canvas-app/*filepath` + 无斜杠 `/canvas-app` 301 重定向)。原因:引擎级中间件方案下 `/canvas-app/` 会被 gin trailing-slash 内部处理拦截(实测 301 绕过鉴权链);catch-all 保证 `CanvasStaticAuth` 一定先行,且 `canvasFileExists` 处理了 `http.FS` 不接受尾斜杠、目录必须含 index.html(防目录列表)两个坑。
3. **配额并发不用 `FOR UPDATE`**(SQLite 不支持,项目约定是条件更新抢占):`CreateCanvasAssetWithQuota` 先条件 UPDATE usage 行(带上限判断),`RowsAffected=0` 即超额;软删同理(status active→deleted 条件翻转)。
4. **`POST /api/canvas/assets/import` 未实现**:服务端无法可靠校验既有 OBS 对象的大小/归属(mediastore 无 Head 接口),留待与素材库前端接入一起设计。upload/list/url/delete/storage 五个端点已就绪。
5. **音频能力标注**:新增 `EndpointTypeAudioSpeech = "audio-speech"`(`constant/endpoint_type.go`),`common.IsAudioSpeechModel` 按模型名(`tts`、前缀 `speech-`)标注,`GetEndpointTypesByChannelType` 前插。画布侧 text/助手分类规则:`openai-response` 或(`openai` 且非纯图/视频/音频)。
6. **配额来源优先级简化为三级**:用户组 JSON 映射(`canvas.group_storage_limits`)> 有生效订阅(`HasActiveUserSubscription`→1TB)> 系统默认(200MB);设计稿的"用户级覆盖值"与"订阅计划新字段"未做(v1 不需要,后续要做时在 `controller/canvas_asset.go:canvasStorageLimitBytes` 扩展)。
7. **项目 JSON 上限 8MB**(`canvasProjectMaxDataBytes`),超限提示走素材库;Data 列不打 type 标签走方言默认映射(MySQL longtext / PG text / SQLite text),因 MySQL `TEXT` 只有 64KB。
8. **409 冲突前端处理**:v1 用 `window.confirm`(覆盖服务端 / 加载服务端)而非 modal(`canvas-server-sync.ts:resolveConflict`),服务端语义与设计一致(409 响应体 data 带服务端最新版本)。
9. **default 主题完全未动**:画布入口只在 classic(外链 `/canvas-app/` 新标签打开)。若后续要给 default 加 iframe 路由,按 §6.1 做即可(本次已实现过又回滚,方案可行)。

### 11.3 注意事项(重要)

- **S8 基线"丢失"结论已更正(2026-07-07 晚)**:先前判断的"gpustackplus 未提交改动丢失"不成立——那批改动在并行会话中提交为 `feat/gpustackplus-m4-facade` 等分支并已合入 main(PR #26 起)。本分支已合并 main(merge commit `8d8ef8b32`,唯一冲突 `router/relay-router.go` 已解决:main 侧也加了 `/pg/images/edits`,保留画布侧 responses/audio 两行)。合并后 S8 状态:
  - 图片生成(t2i)与图片编辑(i2i,multipart 底图)已支持,画布 `requestEdit` 的 multipart `/pg/images/edits` 与 S3 的 distributor multipart 解析链路匹配;
  - `GetEndpointTypesByChannelType` 的 GPUStackPlus 分支(图片→image-generation、视频→openai-video)与画布侧 `audio-speech` 标注共存;
  - TTS(上游不提供)与助手(不支持 responses/chat)按"未补前隐藏"策略闭环——gpustackplus 模型不带对应 endpoint type,画布音频/助手节点自动不展示;
  - mask(image_mask)转换仍未接(qwen-edit 当前不用 mask),保留为低优先待办。
- **`go build` 前置条件**:必须先存在 `web/canvas/out`(`make build-frontend-canvas` 或 `cd web/canvas && bun install && NEXT_PUBLIC_BUILTIN_MODE=1 bun run build`),否则 `go:embed` 编译失败。与 `web/default/dist` 同状况。
- **`docker build` 未实测**(本机耗时),Dockerfile 的 `builder-canvas` 阶段与现有两个 bun 阶段写法一致,CI 首跑注意。
- 提示词源之一(EvoLinkAI 的 `data/ingested_tweets.json`)上游已 404,seed 少这一类;封面图目前仍是 GitHub raw URL(`cover_url`),`cover_asset_url` 为空 —— 生产内网展示会缺图(前端有占位逻辑),需运营侧跑图片预同步后回填 DB。
- 画布静态资源目前不走 gzip(canvas 路由在 gzip 中间件之外),体积可接受,后续可优化。
- 提示词内存缓存 TTL 6h;运营改库后最迟 6h 生效,如需立即生效可重启或后续加失效接口。

### 11.3.1 灰度策略(2026-07-08)

画布功能合入 main 后转为**默认隐藏**灰度发布:`HeaderNavModules` 未配置 canvas 键(含选项为空/解析失败)时,后端 `CanvasStaticAuth` 对 `/canvas-app/*` 返回 404,classic 导航不展示画布入口;仅当 admin 在 后台-顶栏管理 显式打开画布开关(canvas=true)后功能可用。充分测试后如需默认开放,恢复 `canvasModuleEnabled` 与 classic 导航的 `!== false` 语义即可(改动点:`middleware/canvas_auth.go`、`web/classic/src/hooks/common/useNavigation.js`、`SettingsHeaderNavModules.jsx`)。

注意:画布开关的 UI 入口**仅存在于 classic 后台**(default 主题按约束未做任何改动,无开关也无导航入口)。若生产切换为 default 主题,控制画布开关需临时切 classic 后台操作,或直接 `PUT /api/option` 写 `HeaderNavModules`。已核实 default 后台保存顶栏配置不会丢失 `canvas` 键(default 的 `parseHeaderNavModules` 保留未知 boolean 键,`onSubmit` spread 完整配置,`serializeHeaderNavModules` 全量序列化)。

### 11.4 待办(按优先级)

1. ~~S8 重做~~(已随 main 合并闭环,见 11.3);残留低优先项:gpustackplus mask(image_mask)转换、若上游未来提供 TTS 则补 audio adaptor + `audio-speech` 标注。
2. ~~素材库前端接入~~(2026-07-07 完成最小闭环):媒体写入汇合点 `uploadImage`/`uploadMediaFile` 在内置模式下优先上传 `/api/canvas/assets/upload`,storageKey 变为 `ca:<asset_id>`(本地 IndexedDB 仅缓存);`resolveImageUrl`/`resolveMediaUrl` 本地 miss 经签名 URL 恢复,项目 JSON 中的 storageKey 引用跨设备可还原;素材库删除同步释放服务端配额;「我的素材」页有云端容量条。残留:`assets/import` 端点(现路径下已不需要——生成结果经 upload 直接入库)、上传失败仅回退本地的离线补传队列。
3. **提示词封面图本地化**:运营环境跑下载→传腾讯云 COS/EdgeOne→回填 `cover_asset_url` 的脚本(可扩展 `cmd/canvas-prompts-sync` 加 `-upload` 参数)。
4. default 主题画布入口(如需要):§6.1 方案已验证可行。
5. 提示词后台 admin CRUD 页面(运营增删改、排序、上下架)。
6. 冲突处理从 `window.confirm` 升级为 modal;素材 OBS 删除失败的持久化重试队列(当前为进程内 3 次重试 + 日志)。

### 11.5 本次落盘的关键文件清单

后端:`controller/canvas_prompts.go`(+seed)、`controller/canvas_project.go`、`controller/canvas_asset.go`、`model/canvas_prompt.go`、`model/canvas_project.go`、`model/canvas_asset.go`、`middleware/canvas_auth.go`、`router/canvas-router.go`、`setting/system_setting/canvas.go`、`cmd/canvas-prompts-sync/`;改动:`router/{main,web-router,relay-router,api-router}.go`、`relay/constant/relay_mode.go`、`middleware/distributor.go`、`controller/playground.go`、`constant/endpoint_type.go`、`common/{model,endpoint_type}.go`、`model/main.go`、`main.go`、`Dockerfile`、`makefile`、`.github/workflows/electron-build.yml`。
前端:`web/canvas/`(vendored + `BUILTIN_MODE` 改造,见 `web/canvas/NOTICE.md`);classic:`useNavigation.js`、`SettingsHeaderNavModules.jsx`、i18n 六语言。
