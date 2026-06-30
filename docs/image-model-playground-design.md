# 图片模型（图片生成）页面设计文档

> 适用前端：`web/classic`（React 18 + Vite + Semi Design）
> 关联入口：左侧栏「体验区域 / 爱芯AI智能助手」下的「图片模型」页签
> 状态：设计稿，待评审确认后再继续完善实现

## 1. 目标与范围

为「图片模型」提供一个类似「文本模型（操练场）」风格的体验页：用户选择分组 / 模型 / 尺寸后，用对话方式输入提示词生成图片，右侧保留生成历史。

- **本期范围**：文生图（text-to-image）。
- **预留**：顶部标签页预留「图生图」（image-to-image），本期置灰「敬请期待」，不实现。
- **风格**：复用文本模型页的视觉语言（左配置 / 中对话 / 顶部标题、卡片、渐变头像等）。

## 2. 页面布局

顶部标签页 + 三栏布局：

```
┌───────────────────────────────────────────────────────────────┐
│  [文生图]  [图生图（敬请期待，置灰）]                              │  ← Tabs
├──────────────┬───────────────────────────────┬────────────────┤
│ 模型配置      │        对话区                   │   对话历史      │
│  - 分组       │  欢迎语 / 用户提示词气泡         │  + 新对话       │
│  - 模型       │  助手：模型名 + 图像 + 操作按钮   │  历史列表       │
│  - 图片尺寸   │                                 │  （状态/模型/   │
│              │  ┌─────────────────────────┐   │   提示词/时间） │
│              │  │ 提示词输入框        [↑] │   │                │
│              │  └─────────────────────────┘   │                │
└──────────────┴───────────────────────────────┴────────────────┘
```

- 左栏固定宽 ~300px，右栏 ~320px，中间自适应；移动端纵向堆叠。
- 左栏顶部沿用文本模型页的「模型配置」标题（齿轮渐变图标）。

> 关于左栏字段：参考设计图里出现过「API key」，但按口头需求与文本模型一致，**不放 API key**，改用「分组」。鉴权走会话（见 §6），用户无需粘贴密钥。

## 3. 模型 / 分组发现与能力过滤

核心诉求：**分组里只显示有图片生成能力的分组；模型里只显示有图片生成能力的模型。**

数据来源（复用文本模型页同款接口）：

| 用途 | 接口 |
|------|------|
| 分组列表 | `GET /api/user/self/groups` |
| 某分组下模型 | `GET /api/user/models?group=<group>` |
| 模型能力 | `GET /api/pricing` |

**图片模型集合 = 后端按名称识别 ∪ 管理员声明**（已确认决策）：

- 后端识别：`/api/pricing` 每个模型含 `supported_endpoint_types`，包含 `"image-generation"` 即图片模型。但后端识别基于硬编码名称表（`common/model.go` 的 `ImageGenerationModels`：`dall-e`、`gpt-image-1`、`imagen-`、`flux-` 等），**不认识** `z-image`、`Doubao-Seedream` 这类模型。
- 管理员声明：在「运营设置 → 图片模型尺寸配置」里列出的模型（`ImageModelSizeConfig.models` 的键）也视为图片模型。这样无需改后端代码即可纳入自有图片模型。
- **严格过滤（不再 fail-open）**：模型下拉 = 当前分组可用模型 ∩ 图片模型集合；不会再混入聊天模型。若集合为空（未声明、后端也未识别），下拉为空并提示，需管理员先在尺寸配置里声明图片模型。
- **分组过滤**：对图片模型集合取其 `enable_groups`（来自 pricing，覆盖全部模型）的并集，得到「含图片模型的分组集合」，与用户可用分组取交集（`auto` 始终保留）。

## 4. 图片尺寸：按模型可配置（管理员）

诉求：尺寸要可配置，且**按模型**配置。

### 4.1 存储

- 新增系统配置项 `ImageModelSizeConfig`（沿用现有 Option 机制，与 `SidebarModulesAdmin` 同一套保存/下发方式）。
- 值为 JSON 字符串：

```json
{
  "default": ["1024x1024", "1024x1792", "1792x1024", "512x512"],
  "models": {
    "Doubao-Seedream-4.0": ["1024x1024", "2048x2048", "2304x1728"],
    "dall-e-3": ["1024x1024", "1024x1792", "1792x1024"]
  }
}
```

- 解析规则：某模型尺寸 = `models[model]` ⇒ 否则 `default` ⇒ 否则内置兜底 `FALLBACK_IMAGE_SIZES`。

### 4.2 下发

- 在 `/api/status` 中暴露 `ImageModelSizeConfig`（与 `SidebarModulesAdmin` 并列），页面从 `statusState.status` 读取，无需管理员权限。

### 4.3 管理端

- 运营设置新增「图片模型尺寸配置」卡片：
  - 「默认尺寸」：多选标签输入（可回车自定义，如 `1024x1024`）。
  - 「按模型配置」：可增删的行，每行 = 模型名 + 该模型尺寸（多选标签输入）。
  - 保存时拼成上面的 JSON，PUT 到 `/api/option/`。

### 4.4 页面端

- 选中模型变化时，按 §4.1 规则解析出该模型可选尺寸，填充「图片尺寸」下拉；当前 size 不在列表时自动回退首项。

## 5. 对话历史（右栏）

- 字段：**生成状态**（生成中 / 已完成 / 失败）、**模型**、**提示词内容**、**提交时间**。
- 操作：顶部「+ 新对话」（清空中间对话区）；标题行「清空」（清空全部历史）；每条右上角删除图标；点击某条 → 中间区回显该次生成。
- **持久化**：localStorage（key `image_playground_history`）。
  - url 模型：历史存 url，很轻，点历史可回显图片。
  - base64 模型：base64 也存进历史以便回显，但因体积大，**历史上限调小为 20 条**，超出丢弃最旧（连带其 base64），避免撑爆 localStorage（~5MB）。
  - 写入失败（超配额）时静默降级，不影响生成主流程。
- 状态标签配色：已完成=绿、失败=红、生成中=蓝。

## 6. 后端：会话鉴权的图片生成路由

文本模型页通过 `POST /pg/chat/completions` → `controller.Playground`（为登录用户临时签发 token，按 §body 的 `group` 路由），浏览器无需 API key。图片需要同样能力，但原 `/pg` 组只有 chat。

设计：

- 新增 `controller.PlaygroundImage`：与 `Playground` 同构，仅把中继格式换成 `RelayFormatOpenAIImage`。
- 新增路由 `POST /pg/images/generations`（挂在已有 `/pg` 组：`UserAuth + KYCRequired + Distribute`）。
- 分组路由：请求体带 `group` 字段，`Distribute` 中间件已支持从 body 读取 `group`，与 chat 一致。

请求体（页面 → `/pg/images/generations`）：

```json
{ "model": "...", "group": "...", "prompt": "...", "size": "1024x1024", "n": 1 }
```

- **不强制 `response_format`**：不同供应商原生格式不同（如 `z-image` 返回 base64，其余从上游代理来的多返回 url），写死反而可能导致部分供应商报错。请求里不带 `response_format`，让每家返回自己的原生格式。

响应（OpenAI images 格式）：`{ "created": ..., "data": [ { "url": "..." } | { "b64_json": "..." } ] }`
页面同时兼容 `url` 与 `b64_json`（后者转 `data:image/png;base64,...`）。

### 6.1 图片代理（用于复制/下载）

远程 `url` 图片直接在浏览器 `fetch` 取字节会受供应商 CDN 的 CORS 限制，导致复制/下载拿不到二进制。为此新增**会话鉴权的图片代理**：

- 路由：`GET /pg/images/proxy?url=<urlencoded>`（挂 `/pg` 组，复用会话鉴权）。
- 行为：后端拉取该 url，原样把字节流回前端，带正确的 `Content-Type`；因同源，前端 `fetch` 不再受 CORS 限制。
- 用途：复制、下载统一走代理 → **url 与 base64 模型都能稳定复制/下载**（base64 本就同源，可不走代理）。
- **安全（SSRF 防护）**：仅允许 `http/https`；拒绝内网/环回地址（`127.0.0.0/8`、`10/8`、`172.16/12`、`192.168/16`、`::1` 等）；设置超时与最大体积上限；响应仅当 `Content-Type` 为图片时透传。

## 7. 对话框内操作按钮

助手生成的图片下方提供三个小图标按钮：

| 按钮 | 行为 |
|------|------|
| 复制 | base64 图直接写剪贴板（`ClipboardItem`）；url 图经 §6.1 代理取字节后写剪贴板 |
| 下载 | base64 直接下载；url 图经 §6.1 代理取 blob 触发下载 |
| 重新生成 | 用同一提示词再次调用生成 |

> 统一经代理后，url / base64 两类模型的复制、下载均稳定可用，不再有"退化为复制链接"的情况。

## 8. 图片预览（点击放大）

点击图片打开自定义预览浮层（深色遮罩 + 底部胶囊工具条），提供 6 个功能（与需求图一致）：

- 上下翻转、左右翻转、向左旋转、向右旋转、缩小、放大。
- 实现：纯 CSS `transform`（`rotate` + `scale` + 翻转用 `scaleX/scaleY` 取负），不依赖第三方预览组件，保证 6 个功能齐全可控；`Esc` / 点击遮罩关闭。

## 9. 显示 / 隐藏（已有机制）

「图片模型」入口的显示隐藏复用既有侧边栏模块开关：`chat` 区域下的 `image` 模块，默认隐藏（`DEFAULT_ADMIN_CONFIG.chat.image = false`），管理员在「运营设置 → 侧边栏管理」开启。

## 10. 国际化

- 新增中文文案的英文翻译统一加到 `web/classic/src/i18n/locales/en.json`（key 为中文源串）。其余语言回退到中文，与现有约定一致。

## 11. 涉及文件清单

后端：
- `controller/playground.go`：新增 `PlaygroundImage`（抽出公共 `playgroundRelay`）。
- `router/relay-router.go`：新增 `POST /pg/images/generations`、`GET /pg/images/proxy`。
- `controller/playground.go`（或新文件）：新增图片代理 handler（带 SSRF 防护）。
- `controller/misc.go`：`/api/status` 暴露 `ImageModelSizeConfig`。

前端：
- `pages/Image/index.jsx`：页面骨架（标签页 + 三栏）。
- `hooks/imagePlayground/useImageGeneration.js`：数据加载（分组/模型/能力过滤）、尺寸解析、生成、历史。
- `constants/imagePlayground.constants.js`：端点、兜底尺寸、尺寸解析、历史存储常量。
- `components/imagePlayground/ImageConfigPanel.jsx`：左栏（分组/模型/尺寸）。
- `components/imagePlayground/ImageChatArea.jsx`：中间对话区 + 输入 + 操作按钮。
- `components/imagePlayground/ImageHistoryPanel.jsx`：右栏历史。
- `components/imagePlayground/ImagePreviewModal.jsx`：图片预览浮层（翻转/旋转/缩放）。
- `pages/Setting/Operation/SettingsImageSizes.jsx` + `components/settings/OperationSetting.jsx`：尺寸配置管理端。

## 12. 已确认决策 / 后续扩展

已确认：
1. **复制/下载**：url 模型经后端图片代理（§6.1）取字节，url 与 base64 模型均稳定可用，无"退化为复制链接"。
2. **response_format**：请求不强制，原样接收 url / base64，前端兼容。
3. **历史持久化**：localStorage；url 存链接、base64 也存但上限调小为 20 条（§5）。

待后续：
4. **跨设备历史**：当前仅本机 localStorage，后续若需跨设备再考虑落库。
5. **n（生成张数）**：本期固定 1 张，后续可扩展多张。
6. **质量/风格等高级参数**（quality/style/seed 等）：本期不放，后续可以「高级参数」折叠形式加入。
7. **图生图**：需明确上游接口（`/v1/images/edits` 或厂商参数）与上传交互后再实现。
