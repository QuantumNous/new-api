# new-api 品牌替换为「数科 / 大晟」交付报告

> 适用对象：产品经理 / UI / 前后端开发 / 运维
> 分析范围：整仓库静态资源与品牌元素
> 核心原则：**只换"运行时系统标识 + 可定制资源"，绝不动"源码层项目 / 组织署名"**

---

## 〇、一句话结论

new-api 是一套**可白标系统**：系统名、Logo、页脚、首页 / 关于页、**邮件落款**均走「后台配置 → 运行时覆盖」，**主体换品牌 0 代码**。剩余工作分四类：

| 类别 | 内容 | 工作量 | 谁来做 |
|---|---|---|---|
| ① 改后台配置（最优先，0 代码） | 系统名、Logo URL、页脚、首页/关于页、文档链接 | 部署后填表即可 | 运维 / 运营 |
| ② 改源码（需重新打包） | 两套前端 `index.html` title/meta/theme-color、前端 fallback 常量、后端启动日志、反馈/更新检查链接、主题色变量、Electron 桌面端 | 中 | 开发 |
| ③ 需 UI / 产品出素材 | favicon、Logo（明/暗）、主题色板、(可选) PWA/apple-touch/og、Electron 图标 | 中 | **产品经理 / UI** |
| ④ 受保护·禁改红线 | `.go` 版权头、`go.mod` 与全量 import `github.com/QuantumNous/new-api`、LICENSE/NOTICE、README 署名、Electron author/repository | 不动 | — |

---

## 一、改后台配置即可（无需改代码 · 最优先）

管理后台「**系统设置 → 站点**」即可改，保存入库 → `/api/status` 下发 → 前端运行时覆盖默认值（含 `document.title`）：

| 可配置项 | 后端默认值（源码） | 运行时链路 |
|---|---|---|
| 系统名称 SystemName | `common/constants.go:17` `= "New API"` | DB → `/api/status` `system_name` → 前端品牌名/标题 |
| Logo | `common/constants.go:19` `= ""` | DB → `OptionMap["Logo"]` → 前端 Logo |
| 页脚 Footer | `common/constants.go:18` `= ""` | DB → `OptionMap["Footer"]`（支持 HTML） |
| 公告/关于/首页 Notice/About/HomePageContent | `model/option.go:69-71` 全为 `""` | DB 存储，前端渲染 |
| 文档链接 docs_link | 未设时 fallback `https://docs.newapi.pro` | DB → `/api/status` |
| **邮件品牌（标题 + 正文 + 发件人）** | **自动 = SystemName** | `controller/misc.go:289/291/318`、`common/email.go:96` |

> **落地第一步**：部署后在后台填入「数科/大晟」系统名、上传新 Logo、填页脚/文档链接、自定义首页/关于页——这一步即可覆盖绝大多数用户可见品牌文字 **和全部邮件品牌**，无需等开发。

---

## 二、需改源码的硬编码点（运行时覆盖不到的）

### 2.1 HTML 标题 / meta（两套前端都要改 · 影响首屏闪现与 SEO）

| 位置 | 当前值 |
|---|---|
| `web/default/index.html:9-13` | `<title>New API</title>`、meta title、`description="Unified AI API gateway..."` |
| `web/default/index.html:16` | `<meta name="theme-color" content="#fff">` |
| `web/classic/index.html:18-19` | `<meta name="generator" content="new-api">`、`<title>New API</title>` |
| `web/classic/index.html:7` | `theme-color #ffffff` |

### 2.2 前端默认 fallback 常量

| 位置 | 当前值 |
|---|---|
| `web/default/src/lib/constants.ts:24` | `DEFAULT_SYSTEM_NAME = 'New API'` |
| `web/default/src/lib/constants.ts:25` | `DEFAULT_LOGO = '/logo.png'`（保留路径，换文件即可） |
| `web/default/src/features/system-settings/site/index.tsx:30` | 表单默认 `SystemName: 'New API'` |
| `web/default/src/components/layout/components/system-brand.tsx:53` | 末级 fallback `... || 'New API'` |
| i18n locales `web/default/src/i18n/locales/*.json` | **每语言 9–10 处 `New API` 字面量，6 语言共 ~56 处**（多为「例如 New API」类示例文案） |

### 2.3 后端文案 / 反馈链接 / 更新检查

| 位置 | 当前值 | 备注 |
|---|---|---|
| `main.go:59` | 启动日志 `"New API " + Version + " started"` | 品牌名硬编码 |
| `main.go:168` / `middleware/recover.go:20` | panic 反馈链接 `github.com/Calcium-Ion/new-api` | 指向**上游 Calcium-Ion**，非署名，可改自有渠道 |
| `web/default/src/features/errors/general-error.tsx` | `FEEDBACK_URL = .../QuantumNous/new-api/issues` | 运行时反馈链接可改（≠ 第四节署名） |
| `web/default/.../footer.tsx` / `web/classic/.../Footer.jsx` | 多个 `docs.newapi.pro/*`、`Calcium-Ion/new-api-key-tool` 链接 | 两套都有，勿漏 |
| `.../maintenance/update-checker-section.tsx:58` / classic `OtherSetting.jsx` | 更新检查 API `Calcium-Ion/new-api/releases/latest` | 指向自有发布仓库或关闭 |
| `web/classic/src/index.jsx:42-43` | 控制台彩蛋 `WE ❤ NEWAPI` + 链接 + `#10b981` | 可改可留 |

> **邮件无需在此处理**——已验证邮件标题/正文/发件人全部用 `common.SystemName` 变量，跟随后台系统名自动变化。

### 2.4 主题色（品牌色 · 两套前端 + 散落硬编码）

**集中定义（优先改）**：
- `web/default/src/styles/theme.css:49`（`--primary` OKLCH 明/暗）、`theme.css:143-144`（骨架屏）
- `web/default/src/styles/theme-presets.css:486-604`（10 预设，**建议新增「数科/大晟」预设而非覆盖 default**）
- `web/default/src/lib/theme-customization.ts:26-80`、`web/default/src/components/theme-switch.tsx:36-42`
- classic：`web/classic/src/index.css:402-470`（`.sbg-variant-*` 5 个 `--semi-color-primary`）

**散落硬编码**（多为 `#10b981` 绿 / 紫渐变）：
- `web/classic/src/index.css:810-858`、`web/classic/src/hooks/dashboard/useDashboardCharts.jsx`（图表 5 色板）
- `web/classic/src/constants/dashboard.constants.js:131` 等若干 `#10b981`
- `web/classic/.../playground/ThinkingContent.jsx`（紫渐变）、`web/default/src/features/performance-metrics/lib/format.ts`（评分色）

### 2.5 Electron 桌面端应用名（**仅当对外发桌面客户端时才需处理**）

> `electron/` 是 new-api 官方桌面客户端：Electron 壳内嵌 Go 后端 + 前端，本地起服务并加载 `http://127.0.0.1:3000`。Web-only 部署可整体跳过本节。

| 位置 | 当前值 | 备注 |
|---|---|---|
| `electron/main.js:400` | `title: 'New API'` | 窗口原生标题，硬编码 |
| `electron/package.json:33` | `productName: "New-API-App"` | 桌面应用显示名 |
| `electron/package.json:4` | `description: "New API - AI Model Gateway..."` | 应用描述 |
| `electron/package.json:32` | `appId: "com.newapi.desktop"` | **改 appId 影响更新/签名/安装路径与 App 数据目录名，高风险，谨慎** |
| `electron/package.json:2` | `name: "new-api-electron"` | 内部包名，可保留 |
| App 数据目录名「New API」 | mac `~/Library/Application Support/New API/`、Win `%APPDATA%/New API/`、Linux `~/.config/New API/` | 由 app 名派生 |

---

## 三、需要 产品经理 / UI 提供的素材清单（交付物）

> **仓库现有素材**：`web/{default,classic}/public/{favicon.ico, logo.png, pay-{apple,google,card}.png, waffo-logo-{dark,light}.svg}`（classic 另有 `azure_model_name.png, cover-4.webp, ratio.png`）。
> **Electron 图标真实路径为 `electron/` 根目录**（非 `electron/build/`）：`electron/icon.png`、`electron/tray-icon-windows.png`、`electron/tray-iconTemplate.png`、`electron/tray-iconTemplate@2x.png`。
> **仓库当前无 PWA manifest / apple-touch-icon**，故下列带「可选」。

| 素材 | 用途 / 位置 | 规格（含明/暗） | 优先级 |
|---|---|---|---|
| **favicon** | 浏览器标签 | `.ico` 多尺寸(16/32/48)，替换两套 public/favicon.ico | P0 |
| **主 Logo** | 站点品牌区 / 默认 `/logo.png` / 后台 Logo URL | PNG ≥512 透明底，替换两套 public/logo.png | P0 |
| **Logo 明/暗双版** | 页眉 / 侧边栏明暗主题 | SVG 优先，light/dark 两版 | P0 |
| **主题色板 + 设计规范** | theme.css / theme-presets / classic Semi 色值 | 主/辅/中性/图表 5 色，OKLCH + HEX，明暗双套 | P0 |
| Electron 应用图标 | 桌面端图标 / 安装包 | `electron/icon.png` 建议 1024×1024（.icns/.ico 由 builder 生成） | P1（交付桌面端才需） |
| Electron 托盘图标 | 系统托盘 | 替换 `tray-icon-windows.png` / `tray-iconTemplate.png` / `@2x`（macOS 需黑色透明 Template 格式） | P1 |
| (可选) PWA 192/512 | 「添加到主屏」/ PWA | PNG 192² 、512²（含 maskable 安全区）+ 需新增 webmanifest | P2 |
| (可选) apple-touch-icon | iOS 主屏 | PNG 180×180 不透明 + index.html 加 link | P2 |
| (可选) og 分享图 | 社交分享预览 | 1200×630 PNG/JPG | P2 |
| (可选) 登录页插画 / 首页 cover | 如 `cover-4.webp` | 按品牌调性出图，明暗适配 | P3 |
| 支付/合作图标处理意见 | `pay-{apple,google,card}.png`、`waffo-logo-*.svg` | **第三方商标，不重绘**；仅在更换支付渠道时换授权 logo | P3 |

---

## 四、受保护·禁止修改（红线）

按项目治理（`AGENTS.md` Protected project information）**只标注、绝不替换 / 删除 / 改名**：

- 每个 `.go` 文件**许可证版权头**（含 `QuantumNous`）
- `go.mod:1` `module github.com/QuantumNous/new-api` + **全量 import 路径**（`main.go:14-27` 及全项目）
- `Dockerfile:39` / `Dockerfile.dev:23` 的 `-X '...QuantumNous/new-api/common.Version=...'` ldflags
- `LICENSE`（AGPLv3）、`NOTICE`（含 §7(b) 强制归属）
- `README*.md` 多语言项目名 / 组织署名 / 徽章
- `electron/package.json` 的 `author: "QuantumNous"` 与 `repository`
- `.github/workflows/docker-*.yml` 镜像名 `ghcr.io/QuantumNous/new-api` 与 cosign 签名链

> 量级：仓库 `QuantumNous` 约 **1766 处**（.go 占约 1616），绝大多数为 import 路径与版权头，统一禁动。换品牌**只换运行时系统标识与可定制资源，不动源码层项目 / 组织署名**。

---

## 五、风险与落地顺序

- **第三方品牌授权**：Waffo（支付网关）、Apple/Google Pay、Card、云厂商 logo 均为他方商标，继续用需确认授权，**不得擅自重绘**。
- **双前端同步**：`web/default`（React19/Rsbuild）与 `web/classic`（React18/Vite/Semi）独立两套，title/meta/theme-color/footer/支付资源 **两边都要改**。
- **上游链接 ≠ 署名**：反馈 / 更新检查链接指向 `Calcium-Ion/new-api`（上游运行时链接，可改）；这与第四节受保护的 `QuantumNous` 署名是两回事。
- **改默认值 ≠ 强制**：源码改的多是默认 / fallback，部署方仍可后台覆盖，建议二者保持一致。
- **推荐顺序**：
  1. **后台配置**（即时上线）：系统名、Logo URL、Footer、docs_link、首页/关于页。
  2. **资源替换**（UI 出图后替换 public/electron 文件，**保持文件名以零改路径**）：favicon、logo（明/暗）、主题色板、(可选) PWA/og、Electron 图标。
  3. **源码默认值与硬编码**（最后，需重新打包部署）：两套 `index.html`、前端默认常量、后端日志 / 反馈链接、更新检查 API、主题色变量与散落色值、Electron 应用名。
  4. **全程不触碰第四节红线。**

---

## 附：关键文件路径速查

- **后端默认值**：`common/constants.go`、`model/option.go`、`controller/misc.go`、`main.go`、`middleware/recover.go`、`common/email.go`
- **default 前端**：`web/default/index.html`、`web/default/src/lib/constants.ts`、`web/default/src/styles/theme.css`、`web/default/src/styles/theme-presets.css`、`web/default/public/`
- **classic 前端**：`web/classic/index.html`、`web/classic/src/index.css`、`web/classic/public/`
- **桌面端**：`electron/main.js`、`electron/package.json`、`electron/icon.png` 及 `tray-icon*`
- **红线（仅标注）**：`go.mod`、`LICENSE`、`NOTICE`、`README*.md`、`.github/workflows/docker-*.yml`
