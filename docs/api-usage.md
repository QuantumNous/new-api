# API 调用文档

本文档面向合作方接入和 AI agent 自动调用，覆盖视频生成、图片生成、图像编辑、文本对话、模型列表、错误处理和价格参考。所有接口兼容 OpenAI API 格式，可直接使用 OpenAI SDK 或兼容客户端调用。

> **最后验证：2026-06-07**。当前分支已合并 `origin/main` 最新代码并重新部署远端服务；`/api/status`、`/v1/models`、视频推荐模型、SiliconFlow 图片模型，以及 `gpt-image-2` ListenHub 优先路由和 xgapi 图片兜底均已通过远端真实接口验证。

---

## 连接信息

| 项目 | 值 |
|------|-----|
| Base URL | `http://192.129.209.36:3001/v1` |
| 认证方式 | HTTP Header `Authorization: Bearer <api-key>` |
| 兼容协议 | OpenAI API (Chat Completions, Models, Images, Video Generations) |
| 内部测试 API Key | `EW93ybOP6Zr1axAPYNEu8VpehQzdTkZBTATszAGYEDiwpCmJ` |
| 测试 Key 额度 | 当前测试 Key 为无限额度（unlimited_quota）；生产 Key 以实际配置为准 |

当前入口运行在 2026-05-26 迁移后的新服务器上，由 Coolify 资源 `new-api-video-gateway` 管理。2026-05-28 完成 upstream 合并（78 commits）后重新部署并完成视频全模型回归测试；2026-06-06 再次合并 upstream 最新代码、重新部署远端服务，并完成 SiliconFlow 图片模型实测。

所有请求必须在 HTTP Header 中携带 API Key：

```
Authorization: Bearer EW93ybOP6Zr1axAPYNEu8VpehQzdTkZBTATszAGYEDiwpCmJ
```

本文档保留的是本服务内部测试 Key，供联调和 AI agent 读取。生产 Key、上游供应商 Key 和个人 Key 不要写入代码、日志、Prompt 或截图。

---

## 给 AI agent 的读取规则

- 模型名必须逐字使用表格中的值，不要翻译、改大小写、替换斜杠或自动补后缀。
- 上游调用方优先使用推荐的标准模型名；不要为了指定供应商自行拼接线路后缀或平台名。
- 同一个对外模型名可能由多个内部 channel 承载，服务会按配置自动路由、重试和做模型名映射。
- 带“线路”或供应商风格的模型名通常是历史兼容或排障别名，只有表格明确推荐时才给业务方使用。
- 所有请求统一使用 `http://192.129.209.36:3001/v1` 作为 Base URL，并携带上方 `Authorization` Header。
- 图片生成返回可能是 `data[0].url` 或 `data[0].b64_json`；客户端必须同时兼容两种字段，不要假设只有一种。
- 视频生成是异步任务：先 `POST /v1/videos` 获取 `task_id`，再 `GET /v1/videos/{task_id}` 轮询，完成后用 `GET /v1/videos/{task_id}/content` 下载。
- 不要在日志中打印完整 `b64_json`、签名图片 URL、视频下载 URL 或 API Key；排障只记录模型名、HTTP 状态、耗时、`task_id` 和返回字段是否存在。
- 优先调用“现有可用模型合集”中的推荐模型；“暂不推荐/不建议”的模型不要主动推荐给业务方。
- 如果 `/v1/models` 中出现本文档未列出的模型，先小流量真实验证，再更新本文档。

---

## 现有可用模型合集（2026-06-07）

本节是给人和 AI agent 的快速索引。详细参数、轮询方式、错误处理和价格见后续章节。

### 模型命名与自动路由

对外模型名是本服务给上游的稳定调用名，不等同于下游供应商内部模型名。调用方只需要传推荐模型名，系统会自动选择可用 channel，并在需要时把模型名映射成下游实际名称。

| 场景 | 上游推荐传参 | 内部处理 |
|------|--------------|----------|
| `gpt-image-2` 直接生图 | `model: "gpt-image-2"` | 优先走 ListenHub 图片 channel，返回 `data[0].b64_json`；xgapi 保留为直出生图兜底 |
| `gpt-image-2` 带参考图 | `model: "gpt-image-2"` + `image` / `images` | 优先走 ListenHub 参考图接口；大体积 `data:image/...;base64,...` 参考图需压缩或改用 URL |
| 历史图片别名 | `gpt-image-2(线路XF)` / `gr-image-2` / `nano-banana-pro` | 作为兼容别名映射到 xgapi 上游 `gpt-image-2` |
| `grok-video-3` 视频 | `model: "grok-video-3"` | 走 LK888 视频 channel；`/v1/models` 已暴露该标准名 |

除非是在排障或兼容旧调用方，不建议上游主动选择带线路后缀的别名。

### 视频模型

| 推荐模型 | 入口 | 类型 | 远端实测 | 返回方式 | 适用场景 |
|----------|------|------|----------|----------|----------|
| `veo3.1-fast` | `POST /v1/videos` | 文生视频、图生视频 | 约 1.5 分钟 | `task_id` 后轮询 | 默认首选，速度和成本均衡 |
| `xb-sora2` | `POST /v1/videos` | 文生视频、参考图视频 | 约 3.5 分钟 | `task_id` 后轮询 | Sora 2 主路径 |
| `grok-imagine-1.0-video` | `POST /v1/videos` | 文生视频、参考图视频 | 约 2 分钟 | `task_id` 后轮询 | Grok Imagine；建议使用稳定尺寸 |
| `ss-sora-2` | `POST /v1/videos` | 文生视频 | 约 3 分钟 | `task_id` 后轮询 | Sora 2 备用路径 |
| `veo3.1-4k` | `POST /v1/videos` | 文生视频、图生视频 | 约 4 分钟 | `task_id` 后轮询 | 4K 高质量输出 |

### 图片生成与编辑模型

| 推荐模型 | 入口 | 类型 | 远端实测耗时 | 返回字段 | 适用场景 |
|----------|------|------|--------------|----------|----------|
| `Tongyi-MAI/Z-Image` | `POST /v1/images/generations` | 生图 | 12.20 秒 | `data[0].url` | SiliconFlow 通义图片路径，当前实测最快 |
| `Qwen/Qwen-Image` | `POST /v1/images/generations` | 生图 | 18.76 秒 | `data[0].url` | SiliconFlow Qwen 生图，高质量通用 |
| `baidu/ERNIE-Image-Turbo` | `POST /v1/images/generations` | 生图 | 20.89 秒 | `data[0].url` | SiliconFlow 文心快速生图 |
| `Qwen/Qwen-Image-Edit-2509` | `POST /v1/images/edits` | 图像编辑 | 24.60 秒 | `data[0].url` | SiliconFlow 图像编辑、风格转换 |
| `gemini_3.1_flash_image_preview` | `POST /v1/images/generations` | 生图 | 约 29 秒 | `data[0].b64_json` | Apexer 快速生图 |
| `gemini_3.0_pro_image_preview` | `POST /v1/images/generations` | 生图 | 约 58 秒 | `data[0].b64_json` | Apexer 高质量图片、产品图 |
| `gemini_3.1_flash_image_preview_4K` | `POST /v1/images/generations` | 生图 | 约 65 秒 | `data[0].b64_json` | Apexer 快速高清输出 |
| `gemini_3.0_pro_image_preview_4K` | `POST /v1/images/generations` | 生图 | 约 383 秒 | `data[0].b64_json` | Apexer 4K 高质量，耗时较长 |
| `gemini-3.1-flash-image-preview` | `POST /v1/images/generations` | 生图 | 约 93 秒 | `data[0].b64_json` | ListenHub 横线命名快速生图 |
| `gemini-3-pro-image-preview` | `POST /v1/images/generations` | 生图 | 约 67 秒 | `data[0].b64_json` | ListenHub 横线命名高质量生图 |
| `gpt-image-2` | `POST /v1/images/generations` | 生图 | 约 20-40 秒 | `data[0].b64_json` / `data[0].url` | 优先 ListenHub；xgapi 保留为直出生图兜底 |
| `gpt-image-2(线路XF)` | `POST /v1/images/generations` | 生图 | 48-50 秒 | `data[0].url` | 映射到 xgapi `gpt-image-2` |
| `gr-image-2` | `POST /v1/images/generations` | 生图 | 46-55 秒 | `data[0].url` | 映射到 xgapi `gpt-image-2` |
| `nano-banana` | `POST /v1/images/generations` | 生图 | 8-9 秒 | `data[0].url` | bltcy 快速生图 |
| `nano-banana-hd` | `POST /v1/images/generations` | 生图 | 10-11 秒 | `data[0].url` | bltcy 高清生图 |
| `nano-banana-pro` | `POST /v1/images/generations` | 生图 | 46-48 秒 | `data[0].url` | 映射到 xgapi `gpt-image-2` 兜底 |

### 文本模型

| 推荐模型 | 入口 | 类型 | 说明 |
|----------|------|------|------|
| `gemini-2.5-flash` | `POST /v1/chat/completions` | 文本对话 | 快速文本对话，响应格式与 OpenAI Chat Completions 一致 |

### 暂不推荐直接调用的模型

| 模型 | 原因 | 替代建议 |
|------|------|----------|
| `openai-sora-2`、`sora-2-image-to-video`、`sora-2-pro-text-to-video`、`sora-2(线路BF)` | 真实创建失败或下游未开放 OpenAPI | 使用 `xb-sora2` 或 `ss-sora-2` |
| `grok-video-3(线路W)` | 下游未开放 OpenAPI | 使用 `grok-imagine-1.0-video` |
| `veo3.1-lite`、`全能视频2.0` | 远端创建失败 | 使用 `veo3.1-fast` 或 `veo3.1-4k` |
| `seedance-*`、`gen4-*`、`wan-*`、`kling-*`、`happyhorse-*`、`pixverse`、`vidu` | Runway 私有适配器当前未就绪 | 等 Runway 渠道上线后再验证 |
| `gemini-2.5-flash-image*` | 模型列表可能暴露，但未完成本服务真实生成验证 | 使用上表已验证图片模型 |

---

## 快速开始

以下是已通过真实验证的最小调用示例，可直接替换 API Key 后调用。视频提交后返回 `task_id`，轮询 `GET /v1/videos/{task_id}` 即可获取生成结果；图片接口同步返回 `data` 数组。

### SiliconFlow 生图 — Qwen 图片生成（实测 18.76 秒）

```bash
curl -s "http://192.129.209.36:3001/v1/images/generations" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen-Image",
    "prompt": "A clean product photo of a white ceramic coffee cup on a wooden desk, soft studio lighting",
    "size": "1024x1024",
    "n": 1
  }'
```

### SiliconFlow 图像编辑 — Qwen Image Edit（实测 24.60 秒）

```bash
curl -s "http://192.129.209.36:3001/v1/images/edits" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen-Image-Edit-2509",
    "prompt": "Turn the input image into a clean watercolor illustration while preserving the main subject",
    "image": "https://example.com/input.png",
    "n": 1
  }'
```

### veo3.1-fast — 快速视频生成（≈1.5 分钟，$0.30/次）

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model":"veo3.1-fast","prompt":"A golden retriever running on a beach at sunset, cinematic quality"}'
```

### xb-sora2 — Sora 2 主路径（≈3.5 分钟，$0.40/次）

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model":"xb-sora2","prompt":"A cat walking through a neon-lit cyberpunk alley at night"}'
```

### grok-imagine-1.0-video — Grok 视频（≈2 分钟，$0.025/次）

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-imagine-1.0-video","prompt":"A green sphere floating over a white table, clean studio lighting","seconds":"6","size":"720x1280"}'
```

> **⚠️ 尺寸约束**：Grok 稳定验证过的尺寸是 `720x1280`、`1280x720`、`1024x1024`、`1024x1792`、`1792x1024`。`aspect_ratio` 也会映射 `4:3`、`3:4`、`21:9`，但这 3 个比例未完成同等生产抽检。

### ss-sora-2 — Sora 2 备用路径（≈3 分钟，$0.40/次）

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model":"ss-sora-2","prompt":"A drone flying over a misty mountain landscape at sunrise"}'
```

### veo3.1-4k — 4K 高质量（≈4 分钟，$1.50/次）

```bash
curl -s "http://192.129.209.36:3001/v1/videos" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"model":"veo3.1-4k","prompt":"Aerial view of a tropical island with crystal clear water, cinematic 4K quality"}'
```

轮询查询、完整参数说明和 Python SDK 示例见下方章节。

---

## 一、视频生成（OpenAI Video 兼容）

视频生成采用**异步任务模式**：先提交任务获取 task_id，然后轮询任务状态，直到视频生成完成。

### 1.1 提交视频生成任务

**请求：**

```
POST {Base URL}/videos
Content-Type: application/json
Authorization: Bearer <api-key>
```

`POST {Base URL}/video/generations` 仍保留兼容，但新接入方推荐统一使用 `/videos`。

Sora/Hongniao 渠道的专项说明见 [Sora 视频生成渠道调用文档](./sora-video-api.md)。AI 聚合站 / LK888 的 `grok-video-3` 线路说明见 [AI 聚合站 / LK888 视频渠道接入文档](./lk888-video-api.md)。

> **2026-05-28 全模型回归验证结论**：当前推荐上游使用 `veo3.1-fast`、`xb-sora2`、`grok-imagine-1.0-video`、`ss-sora-2`、`veo3.1-4k`。这 5 个模型已通过真实创建、轮询完成和 `/content` 视频下载验证。`grok-video-3` 在 2026-05-24 可用但今天 LK888 上游参数验证失败，暂降级为"尝试"状态。Runway 系列（seedance/gen4/wan/kling/happyhorse/runway）均未就绪。`openai-sora-2`、`sora-2(线路BF)`、`grok-video-3(线路W)`、`veo3.1-lite`、`全能视频2.0` 虽然可能出现在模型列表中，但真实创建失败，见 [1.3 可用视频模型](#13-可用视频模型)。

#### 1.1.1 文生视频

最基础的调用方式，仅提供文字描述即可生成视频。

```json
{
  "model": "veo3.1-fast",
  "prompt": "A golden retriever running on a beach at sunset, cinematic quality, slow motion"
}
```

#### 1.1.2 图生视频（首帧）

提供一张图片作为视频的首帧，模型会基于图片内容生成后续视频。

```json
{
  "model": "veo3.1",
  "prompt": "The character starts walking forward slowly",
  "images": [
    "https://example.com/first_frame.jpg"
  ]
}
```

#### 1.1.3 图生视频（首尾帧）

提供两张图片分别作为视频的首帧和尾帧，模型会生成从首帧过渡到尾帧的视频。**仅部分模型支持首尾帧**（见下方模型列表）。

```json
{
  "model": "veo3.1",
  "prompt": "Smooth transition from the first pose to the second pose",
  "images": [
    "https://example.com/first_frame.jpg",
    "https://example.com/last_frame.jpg"
  ]
}
```

#### 1.1.4 多图参考（Components 模式）

提供 1-3 张参考图片，模型会将这些图片作为视频中的元素融合生成。使用 `veo3.1-components` 或 `veo3.1-fast-components` 模型。

```json
{
  "model": "veo3.1-components",
  "prompt": "A person wearing the outfit in front of the building",
  "images": [
    "https://example.com/person.jpg",
    "https://example.com/outfit.jpg",
    "https://example.com/building.jpg"
  ]
}
```

#### 1.1.5 带额外参数

```json
{
  "model": "veo3.1",
  "prompt": "A cat walking across the room",
  "images": [
    "https://example.com/first_frame.jpg"
  ],
  "aspect_ratio": "16:9",
  "enhance_prompt": true
}
```

#### 1.1.6 Grok 视频（多参、参考图、首尾帧）

937qq / Qilin 的 Grok 视频模型已按统一 OpenAI Video 入口接入。上游仍然传 JSON，不需要知道 937qq 的真实接口、令牌或返回字段。

**文生视频 + 多参数：**

```json
{
  "model": "grok-imagine-1.0-video",
  "prompt": "A green sphere floating over a white table, clean studio lighting",
  "seconds": "6",
  "size": "1792x1024",
  "quality": "standard"
}
```

**单参考图：**

```json
{
  "model": "grok-imagine-1.0-video",
  "prompt": "Use the provided reference image as the visual basis and animate it subtly",
  "seconds": "6",
  "images": [
    "https://example.com/reference.png"
  ]
}
```

**首尾帧：**

```json
{
  "model": "grok-imagine-1.0-video",
  "prompt": "Create a smooth transition from the first frame to the last frame",
  "seconds": "6",
  "images": [
    "https://example.com/start.png",
    "https://example.com/end.png"
  ]
}
```

`images` 也支持 `data:image/png;base64,...` 形式。2026-05-15 已用 base64 红圆首帧 + 蓝方块尾帧做抽帧验证，确认参考图和首尾帧视觉生效。

本服务会把上游常用参考图字段自动转换成 937qq/Grok 更偏好的 `image_reference` 结构。普通调用方继续传 `images` 即可，不需要直接依赖 937qq 私有字段。2026-05-16 用只包含 `images` 的医生参考图请求复测，任务 `task_QFcwttd20S49mJUdM9Y7wTDNM5XhBdtM` 输出 720×1280，抽帧确认参考图身份、黑色服装、诊室场景和指膝腿动作生效。

真实医生讲解 query 建议按参考图优先写法改造：明确写出 `elderly Chinese woman`、`gray hair`、`black traditional Chinese medical clothing`、`indoor clinic room`，并明确排除 `man` / `white-coat western doctor`。不要用 `him` / `his` 描述医生。2026-05-16 复测任务 `task_k6Id9R1pS3LbK22GHLLnDbUHFVPfsF5x` 输出 720×1280，抽帧确认灰发老年女性、黑色中式服装、诊室环境和指背/指脸/指膝腿动作保留较好。

Grok 渠道注意事项：

- `aspect_ratio: "9:16"` 或 `ratio: "9:16"` 会自动补 `size: "720x1280"`。
- `aspect_ratio: "16:9"` 或 `ratio: "16:9"` 会自动补 `size: "1280x720"`。
- `aspect_ratio: "1:1"` 或 `ratio: "1:1"` 会自动补 `size: "1024x1024"`。
- `aspect_ratio: "4:3"`、`"3:4"`、`"21:9"` 会按新版麒麟插件分别补 `size: "1152x864"`、`"864x1152"`、`"1680x720"`。
- 本服务会同时补齐 `seconds` 和 Grok 官方风格的 `duration`，默认补 `resolution: "720p"`，并按 `resolution` 补 `quality`。
- `grok-imagine-1.0-video` 传 `duration` / `seconds` 为 20 或 30 秒时，会自动转发到 `grok-imagine-1.0-video-20s` / `grok-imagine-1.0-video-30s`；直接请求这两个模型时会锁定对应时长。
- 实测 `720x1280` 可以输出 720×1280 或 416×752 这类竖屏结果，`1280x720` 输出过 752×416 横屏结果，`1:1` 映射后任务 `task_EocEzfLxfQGPZ04Y7nYKgga7l0hYnpZ6` 输出 960×960；下游可能按自身编码规格缩放，不保证像素级严格等于目标尺寸。
- `4:3`、`3:4`、`21:9` 已按新版麒麟插件映射透传，但还没有像 9:16 / 16:9 / 1:1 一样完成生产视频抽检。
- 人物参考图是软约束，适合保留构图/动作/颜色等显著视觉特征；对“同一个人/医生身份完全一致”的锁定能力不稳定。

### 1.2 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| model | string | 是 | 视频生成模型名称，见下方模型列表 |
| prompt | string | 是 | 视频内容描述，建议用英文，描述越详细效果越好 |
| images | array[string] | 否 | 参考图片 URL 或 base64 编码。Grok 新版插件上限为 7 张；传图后自动启用图生视频/参考图模式 |
| aspect_ratio | string | 否 | 视频比例，可选 `16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`21:9`。Grok 渠道会自动映射为像素 `size` |
| enhance_prompt | boolean | 否 | 是否优化提示词。由于 Veo 只支持英文提示词，开启后会自动将中文提示词翻译为英文并优化。默认 false |
| enable_upsample | boolean | 否 | 是否提升分辨率至 1080p。仅文生视频支持。默认 false |
| seconds | string | 否 | 视频时长。Grok 支持 `6`、`10`、`15`、`20`、`30` |
| duration | integer | 否 | 视频时长（秒）。Grok 渠道会和 `seconds` 互补；20/30 秒会自动转长时长传输模型 |
| ratio | string | 否 | 兼容麒麟插件字段。Grok 渠道未传 `size` 时会按 `aspect_ratio` 同样规则映射 |
| resolution | string | 否 | Grok 渠道未传时默认 `720p` |
| quality | string | 否 | Qilin/Grok 原生画质字段。未传时按 `resolution` 自动补 `high` 或 `standard` |
| size | string | 否 | 输出尺寸。Grok 横屏建议 `1280x720`，竖屏建议 `720x1280`，方形建议 `1024x1024`；`aspect_ratio=4:3/3:4/21:9` 会映射 `1152x864`、`864x1152`、`1680x720`，但未完成同等生产抽检。不要直接传未验证尺寸（如 `1920x1080`） |

### 1.3 可用视频模型

#### 真实验证可用模型（推荐上游使用）

以下模型已做过真实生成测试：提交任务成功、轮询到 `completed`、并且 `GET /v1/videos/{task_id}/content` 返回 `200 video/mp4`。

| 推荐模型 | 下游链路 | 本次验证 task_id | 结果 | 说明 |
|----------|----------|------------------|------|------|
| `veo3.1-fast` | Apexer / Veo | `task_kPRJVkUnFmkznGZbKaUAY8UAy5daQTaS` | ✅ 完成并可下载 | 当前推荐的 Veo 快速模型，约 1.5 分钟完成 |
| `xb-sora2` | Hongniao / Sora | `task_AnRb9zA2TNPKnUl3WjK0ep2yvbBgdaoD` | ✅ 完成并可下载 | 当前推荐的 Sora 主路径，约 3.5 分钟完成 |
| `grok-imagine-1.0-video` | 937qq / Qilin Grok | `task_0N4mwgTkQS8mlV8iYiTa1D385u2o2CRf` | ✅ 完成并可下载 | 推荐的 Grok Imagine 路径；稳定验证尺寸见 [1.2 请求参数](#12-请求参数) |
| `grok-video-3` | LK888 / AI 聚合站 | `task_fjCxJlZ18U0eQIQOfXy077K4HHMzNHum` | ✅ 完成并可下载 | 2026-06-07 复测完成，`/content` 返回 `video/mp4` |
| `ss-sora-2` | Hongniao / Sora | `task_s4H8Mwn0LwsUMviZTWviEH2GVBHvC7V4` | ✅ 完成并可下载 | Sora 2 备用路径，约 3 分钟完成 |
| `veo3.1-4k` | Apexer / Veo 4K | `task_mDFMyYk4fXPREqIZad9ZFTSNvEhQ46Wz` | ✅ 完成并可下载 | 4K 高质量，约 4 分钟完成，$1.5/次 |

下载抽查结果：

| 模型 | `/content` 状态 | Content-Type | 下载大小 |
|------|-----------------|--------------|----------|
| `veo3.1-fast` | `200` | `video/mp4` | 约 3.3 MB |
| `xb-sora2` | `200` | `video/mp4` | 约 6.4 MB |
| `grok-imagine-1.0-video` | `200` | `video/mp4` | 约 3.8 MB |
| `ss-sora-2` | `200` | `video/mp4` | 约 7.8 MB |
| `veo3.1-4k` | `200` | `video/mp4` | 约 23 MB |

#### 可尝试但未逐一真实验证的同族模型

这些模型属于当前可用链路的同族模型，可能出现在 `/v1/models` 中，但本次没有逐个消耗额度真实生成。业务上建议先使用上方 5 个推荐模型；如需使用下列模型，请先小流量单独验证。

| 模型名 | 链路 | 说明 |
|--------|------|------|
| `veo3.1`、`veo3.1-pro`、`veo3.1-4k`、`veo3.1-fast-4k`、`veo3.1-pro-4k` | Apexer / Veo | 同属 Veo/Apexer 链路；高质量和 4K 成本更高 |
| `veo3.1-components`、`veo3.1-fast-components`、`veo3.1-components-4k`、`veo3.1-fast-components-4k` | Apexer / Veo | 多图参考/Components 模式，本次未做真实生成 |
| `ss-sora-2`、`je-grok`、`全能视频2.0` | Hongniao | `ss-sora-2` 已升级为验证模型；`je-grok` 今天 429 限流；`全能视频2.0` 今天上游返回模型不存在 |
| `grok-imagine-1.0-video-20s`、`grok-imagine-1.0-video-30s` | 937qq / Qilin Grok | 长时长 Grok 模型，成本按秒增加，但今天 `20s` 返回 `model_not_found`（渠道未注册） |

#### 暴露但当前不建议上游调用的模型

| 模型名 | 本次真实结果 | 处理建议 |
|--------|--------------|----------|
| `openai-sora-2` | 创建失败：请求 8 秒仍被兼容层归一化成 10 秒，下游返回“仅支持 8 秒、12 秒” | 不建议上游使用；请直接用 `xb-sora2` |
| `sora-2-image-to-video` | 与 `openai-sora-2` 属同一兼容映射链路 | 不建议上游使用；请直接用 `xb-sora2` |
| `sora-2-pro-text-to-video` | 兼容映射到 Hongniao BF 线路；BF 线路本次创建被下游拒绝 | 暂不建议上游使用 |
| `sora-2(线路BF)` | 创建失败：下游返回“当前未开放给 OpenAPI 使用” | 不要直接调用 |
| `grok-video-3(线路W)` | 创建失败：下游返回“当前未开放给 OpenAPI 使用” | 不要直接调用；需要 Grok 请用 `grok-video-3` 或 `grok-imagine-1.0-video` |
| `veo3.1-lite` | 创建失败：`multipart: NextPart: EOF` | 暂不建议上游使用 |
| `全能视频2.0` | 创建失败：上游返回"Model does not exist or is not available" | 不要推荐给上游 |
| `seedance-2`、`gen4-turbo`、`gen4.5`、`wan-2.6*`、`kling-*`、`happyhorse-1`、`pixverse`、`vidu` | Runway 私有适配器系列，当前未部署，不具备可用性 | 不要推荐给上游 |
| `香蕉2(线路V)`、`香蕉pro(线路G)` | 模型列表暴露，但未完成真实 OpenAPI 生成验证 | 不要推荐给上游 |

> **2026-05-28 补充**：Runway 渠道当前未配置。代码中已注册的新 Kling 3.0/O3 系列模型（`kling-3.0-pro`、`kling-3.0-standard`、`kling-3.0-4k`、`kling-3.0-motion-control`、`kling-o3-pro`、`kling-o3-standard`、`kling-o3-4k`、`kling-2.6-motion-control`）以及 `qilin-video-storyboard-pro` 均在 `constants.go` 注册了但模型列表未暴露，待 Runway 就绪后统一上线。

### 1.4 模型自动映射规则

系统根据请求中是否包含 `images` 字段，自动将基础模型映射为合适的下游模型：

| 基础模型 | 无 images（文生视频） | 有 images（图生视频） |
|----------|---------------------|---------------------|
| veo3.1 | veo3.1 | veo3.1（自带首尾帧支持） |
| veo3.1-fast | veo3.1-fast | veo3.1-fast（自带首尾帧支持） |
| veo3.1-pro | veo3.1-pro | veo3.1-pro（自带首尾帧支持） |
| veo3.1-components | veo3.1-components | veo3.1-components（多图参考） |
| veo3 | veo3 | veo3-pro-frames |
| veo3-fast | veo3-fast | veo3-fast-frames |
| veo2-fast | veo2-fast | veo2-fast-frames |
| xb-sora2 | xb-sora2 | xb-sora2 |
| openai-sora-2 | xb-sora2（当前不建议使用该别名） | xb-sora2（当前不建议使用该别名） |
| sora-2-image-to-video | xb-sora2（当前不建议使用该别名） | xb-sora2（当前不建议使用该别名） |
| sora-2-pro-text-to-video | sora-2-pro(线路BF)（当前不可用） | sora-2-pro(线路BF)（当前不可用） |

> **设计原则**：上游调用方无需感知下游中转站的模型命名、端点和参数差异。只需使用基础模型名 + `images` 字段，系统自动处理路由、模型映射以及 Apexer 的 `type=1/2/3` 参数。后续对接新的中转站时，只需在内部映射表中添加规则，上游调用方式不变。

#### Hongniao AI / xb-sora2 接入说明

Hongniao AI 使用独立接口协议，当前通过 OpenAI Video 类型 58 的 `xb-sora2` Provider 适配：

| 项目 | 配置 |
|------|------|
| Base URL | `https://open.hongniaoai.com/v1` |
| 鉴权 | `X-API-Key` |
| 创建任务 | `POST /videos/generate` |
| 查询任务 | `GET /videos/{task_id}` |
| 模型发现 | `GET /models` |

调用方仍使用本项目统一的 `/v1/videos` 和 `/v1/videos/{task_id}`。Provider 内部会处理：

- `Authorization: Bearer <用户 token>` → 下游 `X-API-Key`
- 下游外层响应 `{"code":"0000","data":{"code":200,"data":...}}` → 本项目任务状态
- `seconds` / `duration` → 下游 `duration`
- `aspect_ratio` / `ratio` / `size` → 下游 `orientation`
- `images` / `image` / `input_reference` / `image_url` → 下游 `images`

参考图能力：Hongniao 文档说明 `images` 最多 5 张；本项目已把统一参考图字段收敛为下游 `images` 数组。当前已验证 `xb-sora2` 文生视频生产链路，以及带 1 张 `images` 参考图的生产链路。2026-05-24 追加真实验证 `xb-sora2` 文生视频任务 `task_DT2laJX2fCTBFeg8VvIx7DxTCllJZpOG`，最终 `completed` 且 `/content` 可下载。具体“身份一致性/首尾帧效果”仍取决于 Hongniao 下游模型本身。

### 1.5 成功响应（HTTP 200）

```json
{
  "id": "task_cIfhoNBQFqDcgxcpr969DQVXw0ApwGpH",
  "task_id": "task_cIfhoNBQFqDcgxcpr969DQVXw0ApwGpH"
}
```

返回的 `task_id` 用于后续查询任务状态。

### 1.6 查询视频生成状态

**请求：**

```
GET {Base URL}/videos/{task_id}
Authorization: Bearer <api-key>
```

`GET {Base URL}/video/generations/{task_id}` 仍保留兼容。

将 `{task_id}` 替换为提交任务时返回的 task_id。

**响应（生成中）：**

```json
{
  "id": "task_cIfhoNBQFqDcgxcpr969DQVXw0ApwGpH",
  "object": "video",
  "model": "grok-imagine-1.0-video",
  "status": "in_progress",
  "progress": 50,
  "created_at": 1778855922
}
```

**响应（生成成功）：**

```json
{
  "id": "task_cIfhoNBQFqDcgxcpr969DQVXw0ApwGpH",
  "object": "video",
  "model": "grok-imagine-1.0-video",
  "status": "completed",
  "progress": 100,
  "video_url": "https://example.com/video.mp4",
  "created_at": 1778855922,
  "completed_at": 1778855936
}
```

**响应（生成失败）：**

```json
{
  "id": "task_xxx",
  "object": "video",
  "model": "grok-imagine-1.0-video",
  "status": "failed",
  "progress": 0,
  "error": {
    "message": "Content policy violation",
    "code": "generation_error"
  }
}
```

**任务状态流转：**

```
queued → in_progress → completed
                  → failed
```

| 状态 | 含义 | 是否终态 |
|------|------|----------|
| queued | 任务排队中，等待处理 | 否 |
| in_progress | 视频正在生成中 | 否 |
| completed | 生成成功，视频 URL 在 `video_url` | 是 |
| failed | 生成失败，失败原因在 `error.message` | 是 |

**轮询建议：** 每隔 10-15 秒查询一次状态，veo3.1-fast 通常 30-60 秒完成，veo3.1-pro 可能需要 2-5 分钟。

### 1.7 完整调用示例（Python）

```python
import requests
import time

BASE_URL = "http://192.129.209.36:3001/v1"
API_KEY = "your-api-key-here"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def generate_video(prompt, model="veo3.1-fast", images=None, aspect_ratio=None, enhance_prompt=False, poll_interval=15, max_wait=600):
    """
    提交视频生成任务并等待完成。

    Args:
        prompt: 视频描述（英文效果更好）
        model: 模型名称，默认 veo3.1-fast
        images: 参考图片 URL 列表。1张=首帧，2张=首尾帧（需模型支持），3张=元素参考（需 components 模型）
        aspect_ratio: 视频比例 "16:9" 或 "9:16"
        enhance_prompt: 是否自动优化/翻译提示词
        poll_interval: 轮询间隔（秒），默认 15 秒
        max_wait: 最大等待时间（秒），默认 600 秒（10 分钟）

    Returns:
        成功时返回视频 URL，失败时返回 None
    """
    body = {"model": model, "prompt": prompt}
    if images:
        body["images"] = images
    if aspect_ratio:
        body["aspect_ratio"] = aspect_ratio
    if enhance_prompt:
        body["enhance_prompt"] = True

    submit_resp = requests.post(
        f"{BASE_URL}/videos",
        headers=headers,
        json=body
    )
    submit_data = submit_resp.json()

    if "task_id" not in submit_data:
        print(f"提交失败: {submit_data}")
        return None

    task_id = submit_data["task_id"]
    print(f"任务已提交，task_id: {task_id}")

    start_time = time.time()
    while time.time() - start_time < max_wait:
        time.sleep(poll_interval)

        poll_resp = requests.get(
            f"{BASE_URL}/videos/{task_id}",
            headers=headers
        )
        poll_data = poll_resp.json()
        status = poll_data.get("status", "unknown")
        progress = poll_data.get("progress", 0)
        print(f"状态: {status}, 进度: {progress}")

        if status == "completed":
            video_url = poll_data.get("video_url", "")
            print(f"视频生成成功: {video_url}")
            return video_url

        elif status == "failed":
            fail_reason = poll_data.get("error", {}).get("message", "未知原因")
            print(f"视频生成失败: {fail_reason}")
            return None

    print("超时，视频未在指定时间内完成")
    return None

# 文生视频
video_url = generate_video("A golden retriever running on a beach at sunset")

# 图生视频（首帧）
video_url = generate_video(
    "The character starts walking forward",
    model="veo3.1",
    images=["https://example.com/first_frame.jpg"]
)

# 图生视频（首尾帧）
video_url = generate_video(
    "Smooth transition from sitting to standing",
    model="veo3.1",
    images=["https://example.com/sitting.jpg", "https://example.com/standing.jpg"]
)

# 多图参考
video_url = generate_video(
    "A person wearing the outfit in front of the building",
    model="veo3.1-components",
    images=["https://example.com/person.jpg", "https://example.com/outfit.jpg", "https://example.com/building.jpg"]
)

# 带中文提示词 + 自动翻译
video_url = generate_video(
    "一只金毛犬在日落的海滩上奔跑",
    model="veo3.1-fast",
    enhance_prompt=True
)

# Grok 首尾帧
video_url = generate_video(
    "Create a smooth transition from the first frame to the last frame",
    model="grok-imagine-1.0-video",
    images=["https://example.com/start.png", "https://example.com/end.png"]
)
```

### 1.8 完整调用示例（cURL）

```bash
#!/bin/bash
API_KEY="your-api-key-here"
BASE_URL="http://192.129.209.36:3001/v1"

# 文生视频
echo "提交视频生成任务..."
TASK_ID=$(curl -s "${BASE_URL}/videos" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"veo3.1-fast","prompt":"A cat playing piano in a jazz bar"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")

echo "Task ID: ${TASK_ID}"

# 轮询任务状态
while true; do
    sleep 15
    RESULT=$(curl -s "${BASE_URL}/videos/${TASK_ID}" \
      -H "Authorization: Bearer ${API_KEY}")

    STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status'))")
    PROGRESS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('progress',''))")
    echo "状态: ${STATUS}, 进度: ${PROGRESS}"

    if [ "$STATUS" = "completed" ]; then
        VIDEO_URL=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('video_url',''))")
        echo "视频 URL: ${VIDEO_URL}"
        break
    elif [ "$STATUS" = "failed" ]; then
        echo "生成失败"
        break
    fi
done
```

#### cURL 图生视频示例（首尾帧）

```bash
curl -s "${BASE_URL}/videos" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo3.1",
    "prompt": "Smooth transition from the first pose to the second pose",
    "images": [
      "https://example.com/first_frame.jpg",
      "https://example.com/last_frame.jpg"
    ],
    "aspect_ratio": "16:9"
  }'
```

---

## 二、图片生成

图片生成推荐使用 OpenAI 兼容的 **Images** 接口调用，统一入口是 `/v1/images/generations`；图像编辑使用 `/v1/images/edits`。当前内部主用三类模型：

- 下划线模型：`gemini_3.*_image_preview`，走 Apexer OpenAI 兼容通道。
- 横线模型：`gemini-3.*-image-preview` 当前可通过 ListenHub 通道跑通；`gpt-image-2` 当前优先走 ListenHub，xgapi 保留为直接生图兜底。
- SiliconFlow 模型：`Qwen/Qwen-Image`、`baidu/ERNIE-Image-Turbo`、`Tongyi-MAI/Z-Image` 和 `Qwen/Qwen-Image-Edit-2509`，返回 `data[0].url`。

Chat Completions 形式仍保留兼容：部分上游会把图片 URL 放在 `choices[0].message.content` 的 Markdown 图片语法中返回。新接入和业务调用优先使用 Images 接口。

### 2.1 请求

```
POST {Base URL}/images/generations
Content-Type: application/json
Authorization: Bearer <api-key>
```

**请求体（JSON）：**

```json
{
  "model": "gemini_3.1_flash_image_preview",
  "prompt": "Generate an image of a cute cat wearing a tiny hat, studio lighting",
  "n": 1,
  "size": "1024x1024"
}
```

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| model | string | 是 | 图片生成模型名称，见下方模型列表 |
| prompt | string | 是 | 图片描述，建议用英文，描述越详细效果越好 |
| n | integer | 否 | 生成图片数量，默认 1 |
| size | string | 否 | 输出尺寸，常用 `1024x1024`；4K 模型建议使用模型默认高清能力 |
| response_format | string | 否 | OpenAI 兼容字段，支持情况取决于下游；调用方需要同时兼容 `data[0].b64_json` 和 `data[0].url` |
| image / images | string / array | 否 | 图像编辑或参考图。SiliconFlow 支持 URL、`data:image/...;base64,...`，最多映射到 `image`、`image2`、`image3` |
| extra_body | object | 否 | 下游扩展参数。SiliconFlow 支持 `seed`、`num_inference_steps`、`guidance_scale`、`cfg`、`negative_prompt`、`image_size`、`batch_size` 等 |
| extra_body.google.image_config.aspect_ratio | string | 否 | Apexer 兼容参数，例如 `1:1`、`16:9`、`9:16` |
| extra_body.google.image_config.image_size | string | 否 | Apexer 兼容参数，例如 `1K`、`4K` |

**当前已通过统一入口验证的图片模型（更新至 2026-06-07）：**

| 模型名 | 通道 | 单次价格 | 本次耗时 | 返回 | 建议场景 |
|--------|------|----------|----------|------|----------|
| `gemini_3.1_flash_image_preview` | Apexer OpenAI 兼容 | $0.25 | 约 29 秒 | `b64_json` | 首选快速生图 |
| `gemini_3.0_pro_image_preview` | Apexer OpenAI 兼容 | $0.3 | 约 58 秒 | `b64_json` | 高质量图片、产品图 |
| `gemini_3.1_flash_image_preview_4K` | Apexer OpenAI 兼容 | $0.3 | 约 65 秒 | `b64_json` | 快速高清输出 |
| `gemini_3.0_pro_image_preview_4K` | Apexer OpenAI 兼容 | $0.35 | 约 383 秒 | `b64_json` | 4K 高质量，耗时明显更长 |
| `gemini-3.1-flash-image-preview` | ListenHub | $0.2 | 约 93 秒 | `b64_json` | 横线命名快速生图 |
| `gemini-3-pro-image-preview` | ListenHub | $0.3 | 约 67 秒 | `b64_json` | 横线命名高质量生图 |
| `gpt-image-2` | ListenHub / xgapi-images | $0.5 | 约 20-40 秒 | `b64_json` / `url` | 优先 ListenHub；xgapi 保留为直出生图兜底 |
| `gpt-image-2(线路XF)` | xgapi-images | $0.3 | 48-50 秒 | `url` | 映射到 xgapi `gpt-image-2` |
| `gr-image-2` | xgapi-images | $0.3 | 46-55 秒 | `url` | 映射到 xgapi `gpt-image-2` |
| `nano-banana` | bltcy-images | $0.18 | 8-9 秒 | `url` | 快速生图 |
| `nano-banana-hd` | bltcy-images | $0.22 | 10-11 秒 | `url` | 高清生图 |
| `nano-banana-pro` | xgapi-images | $0.3 | 46-48 秒 | `url` | 映射到 xgapi `gpt-image-2` 兜底 |
| `baidu/ERNIE-Image-Turbo` | SiliconFlow | 按后台配置 | 20.89 秒 | `url` | 快速通用生图 |
| `Qwen/Qwen-Image` | SiliconFlow | 按后台配置 | 18.76 秒 | `url` | 通用高质量生图 |
| `Tongyi-MAI/Z-Image` | SiliconFlow | 按后台配置 | 12.20 秒 | `url` | 通义图像模型路径 |
| `Qwen/Qwen-Image-Edit-2509` | SiliconFlow | 按后台配置 | 24.60 秒 | `url` | 图像编辑、风格转换 |

> **2026-06-02 远端验证方式**：使用远端测试 Key 直接请求 `POST http://192.129.209.36:3001/v1/images/generations`，上述 7 个非 SiliconFlow 图片模型均返回 HTTP 200，`data` 数组长度为 1。4K 响应体可能超过 20 MB，不要在日志或终端中直接打印完整 `b64_json`。
>
> **2026-06-06 SiliconFlow 远端验证方式**：通过本服务统一入口验证 4 个 SiliconFlow 模型；`baidu/ERNIE-Image-Turbo`、`Qwen/Qwen-Image`、`Tongyi-MAI/Z-Image` 走 `/v1/images/generations`，`Qwen/Qwen-Image-Edit-2509` 走 `/v1/images/edits`，均返回 HTTP 200，`data` 数组长度为 1，结果在 `data[0].url`。本次实测耗时分别为 20.89 秒、18.76 秒、12.20 秒、24.60 秒。
>
> **2026-06-07 xgapi 图片兜底验证方式**：修复部署后，通过公网统一入口连续 2 轮验证 `gpt-image-2`、`gpt-image-2(线路XF)`、`gr-image-2`、`nano-banana`、`nano-banana-hd`、`nano-banana-pro`，共 12 次请求全部 HTTP 200，均返回标准 `data[0].url`。其中 `gpt-image-2`、`gpt-image-2(线路XF)`、`gr-image-2`、`nano-banana-pro` 命中 `xgapi-images` 渠道，后三个别名映射到上游 `gpt-image-2`。
>
> **2026-06-07 xgapi 比例与参考图兼容验证**：远端部署后复测 `gpt-image-2`，直接生图请求 `size=1792x1024` 且 prompt 不写比例，命中 `channel_id=14`，HTTP 200，46.33 秒，返回 PNG `1659x948`，比例约 `1.75`。服务端会把 `size` / `aspect_ratio` 推导出的比例自动追加到 xgapi 上游 prompt。带 `image` 参考图字段的同模型请求自动避开 xgapi，命中 ListenHub `channel_id=12`，HTTP 200，45.08 秒，返回 `b64_json` PNG `2048x2048`。
>
> **2026-06-07 生产自测补充**：修剪 Apexer channel 6/7 的 `gpt-image-2` 后再次验证当前路径：`gpt-image-2` 直接生图命中 channel 14，46.51 秒，PNG `1659x948`；`gpt-image-2` 带 `image` 参考图命中 channel 12，93.63 秒，PNG `2048x2048`；`Qwen/Qwen-Image-Edit-2509` 图像编辑命中 channel 13，29.97 秒，返回 PNG；`grok-video-3` 视频任务命中 channel 11，轮询到 `completed`，`/content` 返回 `200 video/mp4`。
>
> **2026-06-07 ListenHub 专项复测**：按 ListenHub 文档格式直连 `https://api.marswave.ai/openapi/v1/images/generation`，`provider=openai`、`model=gpt-image-2`、`imageConfig.aspectRatio=1:1`、`imageConfig.imageSize=1K` 连续 10 次全部 HTTP 200，均返回 `candidates[].content.parts[].inlineData`，平均 21.41 秒。通过本服务统一入口强制 channel 12 复测 `gpt-image-2` 直接生图 10 次全部 HTTP 200，均返回标准 `data[0].b64_json`，平均 40.13 秒；再用 `image` data URI 参考图强制 channel 12 复测 3 次全部 HTTP 200，平均 24.48 秒。同期普通 `poc_key` 日志仍出现 channel 12 的 `413 request entity too large`，说明 ListenHub 对大请求体/大参考图需要控制输入体积；本轮小图和标准请求未复现 504。追加大参考图实测：`2048x2048` JPEG 约 3.33 MB（JSON 请求体约 4.44 MB）成功，耗时 82.19 秒；`4096x4096` JPEG 约 13.32 MB（JSON 请求体约 17.75 MB）返回 `413 request entity too large`，耗时 9.5 秒。
>
> **2026-06-07 ListenHub 优先级切换验证**：生产配置已调整为 ListenHub channel 12 priority `140`、xgapi channel 14 priority `130`。重启刷新 channel cache 后，普通入口 `model=gpt-image-2` 连续 10 次客户端请求全部 HTTP 200，均返回标准 `data[0].b64_json`，平均 25.08 秒；服务端成功日志均命中 channel 12。xgapi channel 14 仍保留在 `gpt-image-2` 能力表中，作为无参考图直出生图兜底。

**SiliconFlow 图片平台：**

SiliconFlow 已作为既有渠道类型 `SiliconFlow` / `type=40` 扩展图片能力，远端渠道配置如下：

| 配置项 | 值 |
|--------|----|
| 渠道名称 | `siliconflow-images` |
| 渠道 ID | `13` |
| Base URL | `https://api.siliconflow.cn` |
| 上游接口 | `/v1/images/generations` |
| 对外生图入口 | `/v1/images/generations` |
| 对外编辑入口 | `/v1/images/edits` |
| 返回格式 | OpenAI Images 兼容，图片在 `data[0].url` |

SiliconFlow 支持模型：

| 模型名 | 类型 | 说明 |
|--------|------|------|
| `baidu/ERNIE-Image-Turbo` | 生图 | 文心图像快速模型 |
| `Qwen/Qwen-Image` | 生图 | Qwen 图片生成模型；常用 OpenAI 尺寸会自动映射到 SiliconFlow 推荐尺寸 |
| `Tongyi-MAI/Z-Image` | 生图 | 通义 Z-Image 图片生成模型 |
| `Qwen/Qwen-Image-Edit-2509` | 图像编辑 | SiliconFlow 使用 `/v1/images/generations` 上游接口接收 `image`、`image2`、`image3` |

SiliconFlow 参数映射：

| 上游 OpenAI 兼容参数 | SiliconFlow 参数 |
|----------------------|------------------|
| `model` | `model` |
| `prompt` | `prompt` |
| `n` | `batch_size` |
| `size` | `image_size`；`Qwen/Qwen-Image` 会将常见 OpenAI 尺寸映射到官方推荐尺寸 |
| `output_format` | `output_format` |
| `image` / `images` / multipart `image` | `image`、`image2`、`image3`，最多 3 张 |
| `extra_body.seed` | `seed` |
| `extra_body.num_inference_steps` | `num_inference_steps` |
| `extra_body.guidance_scale` | `guidance_scale` |
| `extra_body.cfg` | `cfg` |
| `extra_body.negative_prompt` | `negative_prompt` |

SiliconFlow 生图示例：

```bash
curl -s "http://192.129.209.36:3001/v1/images/generations" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen-Image",
    "prompt": "A simple red square icon on a white background",
    "size": "1024x1024",
    "n": 1,
    "extra_body": {
      "seed": 1,
      "cfg": 4,
      "num_inference_steps": 20
    }
  }'
```

SiliconFlow 图像编辑示例：

```bash
curl -s "http://192.129.209.36:3001/v1/images/edits" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen-Image-Edit-2509",
    "prompt": "Turn the image into a clean watercolor style while preserving the main subject",
    "image": "https://example.com/input.png",
    "n": 1,
    "extra_body": {
      "seed": 2,
      "num_inference_steps": 20
    }
  }'
```

**ListenHub 图片平台：**

ListenHub 已作为独立渠道类型接入，后台创建渠道时使用：

| 配置项 | 值 |
|--------|----|
| 渠道类型 | `ListenHub` / `type=59` |
| Base URL | `https://api.marswave.ai/openapi` |
| 上游接口 | `/v1/images/generation` |
| 对外入口 | `/v1/images/generations` |
| 返回格式 | OpenAI Images 兼容，图片在 `data[0].b64_json` |

支持模型：

| 模型名 | ListenHub provider | 说明 |
|--------|--------------------|------|
| gemini-3-pro-image-preview | google | 默认高质量图片模型 |
| gemini-3.1-flash-image-preview | google | 更快，支持额外长宽比 |
| gpt-image-2 | openai | OpenAI 图片模型，最多 4 张参考图 |

ListenHub 验证状态：

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 本项目渠道适配 | 已接入 | 新增 `type=59`，对外走 `/v1/images/generations` |
| 远端统一入口 | 已跑通 | 2026-06-07 已将 `gpt-image-2` 切为 ListenHub 优先；普通入口 10 次客户端请求全部成功，均返回 `data[0].b64_json` |
| 返回格式 | OpenAI Images 兼容 | 当前返回 `data[0].b64_json`，不是 URL |
| 参考图限制 | 已验证 | 小图和约 4.44 MB JSON 请求体可成功；约 17.75 MB JSON 请求体返回 `413 request entity too large`，大图建议压缩或改用 URL |

ListenHub 上游直连验证结果（2026-06-01，历史记录）：

| provider | 模型 | 结果 | 耗时 | 返回 |
|----------|------|------|------|------|
| google | gemini-3-pro-image-preview | ✅ 成功 | 约 21 秒 | 1 张 PNG base64 |
| google | gemini-3.1-flash-image-preview | ✅ 成功 | 约 14 秒 | 1 张 PNG base64 |
| openai | gpt-image-2 | ✅ 成功 | 约 22 秒 | 1 张 PNG base64 |

ListenHub 参数映射：

| 上游 OpenAI 兼容参数 | ListenHub 参数 |
|----------------------|----------------|
| `prompt` | `prompt` |
| `model=gemini-3-pro-image-preview` | `provider=google`, `model=gemini-3-pro-image-preview` |
| `model=gemini-3.1-flash-image-preview` | `provider=google`, `model=gemini-3.1-flash-image-preview` |
| `model=gpt-image-2` | `provider=openai`, `model=gpt-image-2` |
| `size=1024x1024` | `imageConfig.aspectRatio=1:1` |
| `size=1792x1024` | `imageConfig.aspectRatio=16:9` |
| `size=1024x1792` | `imageConfig.aspectRatio=9:16` |
| `quality=1K/2K/4K` | `imageConfig.imageSize=1K/2K/4K` |
| `extra_body.listenhub.imageConfig` | 覆盖 `imageConfig` |
| `image` / `images` / `referenceImages` | `referenceImages`，支持 URL 和 `data:image/...;base64,...` |

Apexer 统一入口真实探测结果（2026-06-02）：

| 渠道 | 模型 | 端点 | 结果 | 耗时 |
|------|------|------|------|------|
| apexer-images-openai | `gemini_3.1_flash_image_preview` | `/v1/images/generations` | ✅ 成功，返回 `b64_json` | 约 29 秒 |
| apexer-images-openai | `gemini_3.0_pro_image_preview` | `/v1/images/generations` | ✅ 成功，返回 `b64_json` | 约 58 秒 |
| apexer-images-openai | `gemini_3.1_flash_image_preview_4K` | `/v1/images/generations` | ✅ 成功，返回 `b64_json` | 约 65 秒 |
| apexer-images-openai | `gemini_3.0_pro_image_preview_4K` | `/v1/images/generations` | ✅ 成功，返回 `b64_json` | 约 383 秒 |

> 2026-06-07 生产日志显示 `gpt-image-2` 在 Apexer 图片 OpenAI/Gemini 渠道上会分别出现上游 distributor 503 和 `only imagen models are supported`，因此已从 channel 6/7 的模型列表和能力表移除。`gpt-image-2` 当前由 ListenHub 优先承载，xgapi 仅作为无参考图直出生图兜底。

暂不推荐模型：

| 模型名 | 当前状态 |
|--------|----------|
| `gemini-2.5-flash-image` / `gemini-2.5-flash-image-preview` | 模型列表暴露，但本次未做统一入口真实生成；如需使用先单独验证 |

ListenHub 调用示例：

```bash
curl -s "http://192.129.209.36:3001/v1/images/generations" \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.1-flash-image-preview",
    "prompt": "A serene mountain landscape at sunset with a reflective lake",
    "quality": "2K",
    "size": "1792x1024"
  }'
```

带参考图示例：

```json
{
  "model": "gpt-image-2",
  "prompt": "Transform this scene into a watercolor painting style",
  "images": ["https://example.com/my-photo.jpg"],
  "extra_body": {
    "listenhub": {
      "imageConfig": {
        "aspectRatio": "1:1",
        "imageSize": "2K"
      }
    }
  }
}
```

**Apexer 图片接口兼容层：**

上游可以继续使用统一入口，不需要感知 Apexer 的 Google 原生/OpenAI 兼容格式差异：

| 上游入口 | 下游渠道 | 说明 |
|----------|----------|------|
| `/v1beta/models/{model}:generateContent` | `apexer-images-gemini` | Gemini 原生格式，支持 `generationConfig.imageConfig`，图生图使用 `inlineData` |
| `/v1/chat/completions` | `apexer-images-openai` | OpenAI 对话格式，最多 3 张 `image_url` 参考图 |
| `/v1/images/generations` | `apexer-images-openai` | OpenAI 图片格式，支持 1 张 `image` 参考图；`extra_body.google.image_config` 会透传给下游 |

路由层会按端点类型选择通道：Gemini 原生入口固定选择 Gemini 类型通道；OpenAI 对话和图片入口优先选择 OpenAI 兼容通道，避免同名模型在不同下游格式之间随机分发。

参数映射规则：

| 上游参数 | 下游处理 |
|----------|----------|
| `extra_body.google.image_config.aspect_ratio` | 透传到 Apexer OpenAI 兼容接口 |
| `extra_body.google.image_config.image_size` | 透传到 Apexer OpenAI 兼容接口 |
| `generationConfig.imageConfig.aspectRatio` | Gemini 原生格式原样透传 |
| `generationConfig.imageConfig.imageSize` | Gemini 原生格式原样透传 |
| `size` / `quality` / `output_format` / `background` | GPT Image 系列在 `/v1/images/generations` 中原样透传 |

**Images 成功响应（HTTP 200）：**

```json
{
  "created": 1770000000,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUg..."
    }
  ]
}
```

SiliconFlow 等下游会返回 URL：

```json
{
  "created": 1770000000,
  "data": [
    {
      "url": "https://example.com/generated-image.png"
    }
  ]
}
```

调用方应同时兼容 `data[0].b64_json` 和 `data[0].url` 两种格式。

如果使用 Chat Completions 兼容入口，成功响应通常如下：

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here is the image you requested:\n\n![image1](https://example.com/generated-image.png)"
      },
      "finish_reason": "stop"
    }
  ],
  "model": "nano-banana",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 100,
    "total_tokens": 115
  }
}
```

**图片结果提取方式：** Images 接口读取 `data[0].b64_json` 或 `data[0].url`。Chat Completions 兼容入口中，图片 URL 通常嵌入在 `choices[0].message.content`，格式为 Markdown 图片语法 `![image1](url)`，可通过正则表达式 `!\[.*?\]\((.*?)\)` 提取。

### 2.2 完整调用示例（Python）

```python
import base64
import requests
import re

BASE_URL = "http://192.129.209.36:3001/v1"
API_KEY = "your-api-key-here"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def generate_image(prompt, model="gemini_3.1_flash_image_preview"):
    response = requests.post(
        f"{BASE_URL}/images/generations",
        headers=headers,
        json={
            "model": model,
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
        }
    )

    result = response.json()

    if "error" in result:
        print(f"生成失败: {result['error']}")
        return None

    if result.get("data"):
        first = result["data"][0]
        if first.get("b64_json"):
            image_bytes = base64.b64decode(first["b64_json"])
            return {"type": "b64_json", "bytes": image_bytes}
        if first.get("url"):
            return {"type": "url", "url": first["url"]}

    # 兼容少数下游按 Chat Completions 格式返回 Markdown 图片 URL 的情况
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

    urls = re.findall(r'!\[.*?\]\((.*?)\)', content)
    if urls:
        return {"type": "url", "url": urls[0]}

    url_pattern = r'(https?://[^\s\)]+\.(png|jpg|jpeg|webp))'
    urls = re.findall(url_pattern, content)
    if urls:
        return {"type": "url", "url": urls[0][0]}

    print(f"未找到图片结果，原始响应: {str(result)[:300]}")
    return None

image_result = generate_image("A sunset over snow-capped mountains, oil painting style")
if image_result:
    if image_result["type"] == "b64_json":
        print(f"图片 base64 已解码，字节数: {len(image_result['bytes'])}")
    else:
        print(f"图片 URL: {image_result['url']}")
```

---

## 三、文本对话

文本对话使用标准 OpenAI Chat Completions 接口。

```
POST {Base URL}/chat/completions
Content-Type: application/json
Authorization: Bearer <api-key>
```

**请求体：**

```json
{
  "model": "gemini-2.5-flash",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "你好，请介绍一下你自己"}
  ],
  "max_tokens": 100,
  "temperature": 0.7
}
```

**可用文本模型：**

| 模型名 | 说明 |
|--------|------|
| gemini-2.5-flash | Gemini 2.5 Flash，快速文本对话 |

响应格式与 OpenAI Chat Completions 完全一致。

---

## 四、列出可用模型

```
GET {Base URL}/models
Authorization: Bearer <api-key>
```

返回当前 API Key 可访问的所有模型列表，格式同 OpenAI Models API。

---

## 五、错误处理

### 5.1 常见错误码

| HTTP 状态码 | 错误信息 | 原因 | 解决方案 |
|-------------|----------|------|----------|
| 401 | Invalid authentication | API Key 无效 | 检查 Authorization Header |
| 403 | No available channel | 无可用渠道 | 检查模型名是否正确 |
| 429 | Rate limit exceeded | 请求频率过高 | 降低请求频率 |
| 500 | Internal server error | 服务器内部错误 | 稍后重试 |

### 5.2 视频生成特殊错误

| 场景 | 原因 | 解决方案 |
|------|------|----------|
| 提交后 task_id 为空 | 上游中转站不可用 | 稍后重试或换模型 |
| 状态一直 QUEUED | 上游排队中 | 耐心等待，veo3.1-pro 可能排队较久 |
| 状态 FAILURE，`fail_reason=upstream returned unrecognized message` | 上游返回的状态字符串未在 `statusToTaskStatus` 中映射（旧版漏映射 `IN_PROGRESS` 已修复） | 检查 `relay/channel/task/openaivideo/provider.go:statusToTaskStatus` 是否覆盖了上游所有状态值 |
| 状态 FAILURE | 内容违规或上游错误 | 修改 prompt 或重试 |
| 图生视频 images 数量超限 | 不同模型对图片数量限制不同 | veo3.1 系列最多 2 张，components 最多 3 张，veo3-pro-frames 最多 1 张 |
| `veo_3_1-* / sora_2 model_not_found` | bltcy/xgapi 上游 distributor 在查找前会把 `.` 替换为 `_`，但注册表里没有对应条目 | 不要把 `veo3.1*` / `sora-2` 走 bltcy 主路径；通过 `model_mapping` 或 fallback 改走 Apexer |

---

## 六、价格与上游采购价参考

### 对外定价

| 模型 | 类型 | 单次价格 | 说明 |
|------|------|----------|------|
| veo2 | 视频 | $0.3 | Veo2 基础版 |
| veo2-fast | 视频 | $0.3 | Veo2 快速版 |
| veo2-pro | 视频 | $0.6 | Veo2 高质量版 |
| veo2-fast-frames | 视频 | $0.3 | Veo2 首尾帧 |
| veo2-fast-components | 视频 | $0.3 | Veo2 多图参考 |
| veo3 | 视频 | $0.4 | Veo3 基础版，支持音频 |
| veo3-fast | 视频 | $0.3 | Veo3 快速版 |
| veo3-pro | 视频 | $1.5 | Veo3 高质量版 |
| veo3-pro-frames | 视频 | $1.5 | Veo3 图生视频 |
| veo3-fast-frames | 视频 | $0.3 | Veo3 快速图生视频 |
| veo3.1-fast | 视频 | $0.3 | 快速生成，性价比最高 |
| veo3.1 | 视频 | $0.4 | 标准质量，支持首尾帧 |
| veo3.1-pro | 视频 | $1.5 | 高质量，支持首尾帧 |
| veo3.1-pro-4k | 视频 | $15 | 4K 最高质量 |
| veo3.1-components | 视频 | $0.4 | 多图参考模式（1-3张） |
| veo3.1-fast-components | 视频 | $0.3 | 快速多图参考 |
| veo3.1-lite | 视频 | $0.6 | 暂不推荐；2026-05-24 创建失败 |
| veo3.1-lite-4k | 视频 | $0.65 | 暂不推荐；未完成真实生成验证 |
| veo3.1-fast-4k | 视频 | $1.5 | 快速 4K |
| veo3.1-4k | 视频 | $1.5 | 标准 4K |
| veo3.1-components-4k | 视频 | $1.5 | 多图参考 4K |
| veo3.1-fast-components-4k | 视频 | $1.5 | 快速多图参考 4K |
| nano-banana | 图片 | $0.18 | 快速生图 |
| nano-banana-hd | 图片 | $0.22 | 高清生图 |
| nano-banana-pro | 图片 | $0.3 | 专业生图 |
| gemini-2.5-flash-image-preview | 图片 | $0.14 | 最便宜 |
| gemini-2.5-flash-image | 图片 | $0.14 | 最便宜 |
| gemini-3-pro-image-preview | 图片 | $0.3 | 最高质量 |
| gemini_3.0_pro_image_preview | 图片 | $0.3 | Apexer Pro |
| gemini_3.0_pro_image_preview_4K | 图片 | $0.35 | Apexer Pro 4K |
| gemini_3.1_flash_image_preview | 图片 | $0.25 | Apexer Flash |
| gemini_3.1_flash_image_preview_4K | 图片 | $0.3 | Apexer Flash 4K |
| gpt-image-2 | 图片 | $0.5 | OpenAI 图片模型，当前 ListenHub 优先路由和 xgapi 兜底均已验证 |
| baidu/ERNIE-Image-Turbo | 图片 | 按后台配置 | SiliconFlow 快速通用生图 |
| Qwen/Qwen-Image | 图片 | 按后台配置 | SiliconFlow Qwen 生图 |
| Tongyi-MAI/Z-Image | 图片 | 按后台配置 | SiliconFlow 通义 Z-Image |
| Qwen/Qwen-Image-Edit-2509 | 图片 | 按后台配置 | SiliconFlow Qwen 图像编辑 |
| gemini-2.5-flash | 文本 | 按 token 计费 | 快速对话 |

### 上游采购价（内部参考）

| 模型 | 上游价格 | 上游来源 |
|------|----------|----------|
| veo2 | ≈$0.2 | Apexer |
| veo2-fast | ≈$0.2 | Apexer |
| veo2-pro | ≈$0.5 | Apexer |
| veo3 | ≈$0.3 | Apexer |
| veo3-fast | ≈$0.2 | Apexer |
| veo3-pro | ≈$1 | Apexer |
| veo3.1 | ≈$0.3 | Apexer |
| veo3.1-pro | ≈$1 | Apexer |
| veo3.1-fast | $0.2 | bltcy.ai |
| veo3.1 | $0.3 | bltcy.ai |
| veo3.1-pro | $1 | bltcy.ai |
| veo3.1-pro-4k | $13 | bltcy.ai |
| veo3.1-components | $0.3 | bltcy.ai |
| veo3.1-fast-components | $0.2 | bltcy.ai |
| veo3.1-lite | $0.5 | xgapi.top（当前创建失败，不建议采购/推荐） |
| veo3.1-fast-4k | $1.5 | bltcy.ai |
| veo3.1-4k | $1.5 | bltcy.ai |
| veo3.1-components-4k | $1.5 | bltcy.ai |
| veo3-pro-frames | ≈$1 | bltcy.ai |
| veo3-fast-frames | ≈$0.2 | bltcy.ai |
| veo2-fast-frames | ≈$0.2 | bltcy.ai |
| nano-banana | $0.08 | bltcy.ai |
| nano-banana-hd | $0.12 | bltcy.ai |
| nano-banana-pro | $0.2 | bltcy.ai |
| gemini-2.5-flash-image | $0.04 | bltcy.ai |
| gemini-3-pro-image-preview | $0.2 | bltcy.ai |
| gemini_3.0_pro_image_preview | $0.18 | Apexer |
| gemini_3.0_pro_image_preview_4K | $0.25 | Apexer |
| gemini_3.1_flash_image_preview | $0.15 | Apexer |
| gemini_3.1_flash_image_preview_4K | $0.2 | Apexer |
| baidu/ERNIE-Image-Turbo | 按 SiliconFlow 账号计费 | SiliconFlow |
| Qwen/Qwen-Image | 按 SiliconFlow 账号计费 | SiliconFlow |
| Tongyi-MAI/Z-Image | 按 SiliconFlow 账号计费 | SiliconFlow |
| Qwen/Qwen-Image-Edit-2509 | 按 SiliconFlow 账号计费 | SiliconFlow |

### 已对接平台

| 平台 | Base URL 关键词 | 优先级 | 支持模型 | 特点 |
|------|----------------|--------|----------|------|
| bltcy.ai / ablai.top | 默认（无匹配时） | 100（最高） | MiniMax-Hailuo-02/2.3*, doubao-seedance-*, wan*, 生图模型（注：veo3.1*/sora-2 受上游 BUG 影响不可用） | 统一格式接口，支持首尾帧、多图参考 |
| www.937qq.cn | 937qq / qilin | 80（Grok 专用） | grok-imagine-1.0-video, grok-imagine-1.0-video-20s, grok-imagine-1.0-video-30s | 麒麟 API，xAI Grok 视频专用；已验证 JSON 直传、多参数、1 张参考图、2 张首尾帧；新版插件支持 7 张参考图和 20/30 秒长时长模型 |
| open.hongniaoai.com | xb-sora2 / hongniao | 90（Sora2 主路径） | 推荐 `xb-sora2`；其他线路模型需单独验证 | Hongniao AI 视频平台，使用 `X-API-Key`、`/videos/generate`、`/videos/{task_id}`；2026-05-24 真实验证 `xb-sora2` 完成并可下载 |
| api.marswave.ai / ListenHub | listenhub | 140（图片主路径） | `gemini-3-pro-image-preview`、`gemini-3.1-flash-image-preview`、`gpt-image-2` | ListenHub 图片平台，2026-06-07 专项复测和优先级切换验证均通过；`gpt-image-2` 当前直接生图优先命中该渠道，返回 `data[0].b64_json` |
| xgapi.top | xgapi-images | 130（图片兜底） | `gpt-image-2`、`gpt-image-2(线路XF)`、`gr-image-2`、`nano-banana-pro` | xgapi 图片平台，作为 `gpt-image-2` 无参考图兜底以及历史别名主路径；直接生图会把比例自动补到上游 prompt |
| api.siliconflow.cn / SiliconFlow | siliconflow-images | 0（默认） | `baidu/ERNIE-Image-Turbo`、`Qwen/Qwen-Image`、`Tongyi-MAI/Z-Image`、`Qwen/Qwen-Image-Edit-2509` | SiliconFlow 图片平台，2026-06-06 已通过本服务 `/v1/images/generations` 和 `/v1/images/edits` 验证，返回 `data[0].url` |
| api.lk888.ai | lk888 / AI聚合站 | 35（Grok 线路） | 推荐 `grok-video-3` | AI 聚合站媒体生成平台，使用 Bearer Token、`/v1/media/generate`、`/v1/skills/task-status`；2026-05-24 真实验证 `grok-video-3` 完成并可下载 |
| www.aiapexers.com | apexer | 50（第二） | 视频：veo3.1_*；图片：gemini_3.*_image_preview | Apexer new-api 实例，视频和图片均已按统一入口适配 |
| xgapi.top | xgapi | 10（兜底） | `veo3.1-lite`, `sora-2` | 当前不可作为主路径；2026-05-24 `veo3.1-lite` 创建失败 |
| runway-api | runway | 暂不启用 | seedance/gen4/wan/kling/happyhorse 系列 | 当前暂不可用，不推荐给上游 |

> **路由实务（2026-05-28 验证）**:
> - `veo3.1-fast` 请求 → Apexer/Veo 链路真实生成完成，`/content` 返回 `200 video/mp4` ✅
> - `xb-sora2` 请求 → Hongniao（90）真实生成完成，`/content` 返回 `200 video/mp4` ✅
> - `ss-sora-2` 请求 → Hongniao（90）真实生成完成，`/content` 返回 `200 video/mp4` ✅
> - `veo3.1-4k` 请求 → Apexer/Veo 4K 链路真实生成完成，`/content` 返回 `200 video/mp4` ✅
> - `grok-imagine-1.0-video` → 937qq / Qilin（80）真实生成完成，注意仅支持 `720x1280`/`1280x720`/`1024x1024`/`1024x1792`/`1792x1024` ✅
> - `grok-video-3` → AI 聚合站 / LK888（35）今天上游返回"参数验证失败"，2026-05-24 曾可用，疑似上游临时问题 ⚠️
> - `je-grok` → Hongniao 今天上游返回 429（限流），路由正常但高峰期不可用 ⚠️
> - `openai-sora-2` 当前不要推荐给上游：真实创建失败，兼容层 duration 映射仍需修复 ⚠️
> - `sora-2(线路BF)` / `grok-video-3(线路W)` / `全能视频2.0` 虽出现在模型列表，但真实创建失败 ⚠️
> - xgapi 与 Runway 暂不在主路径上，不推荐给上游

### 渠道优先级与自动故障转移

系统内置了渠道优先级和自动故障转移机制，上游调用方无需感知下游中转站的差异或故障：

**优先级规则：**
1. 请求首先路由到优先级最高的可用渠道（如 bltcy, priority=100）
2. 如果该渠道请求失败（5xx、429 等可重试错误），自动降级到下一优先级渠道（如 Apexer, priority=50）
3. 如果所有渠道都失败，返回错误

**自动故障转移配置：**

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| RetryTimes | 2 | 失败后最多重试 2 次（覆盖 3 个优先级层级） |
| AutomaticDisableChannelEnabled | true | 渠道持续失败时自动禁用 |
| AutomaticEnableChannelEnabled | true | 被禁用的渠道恢复后自动启用 |

**故障转移覆盖模型：**

以下模型在多个渠道注册，支持自动故障转移：

| 模型 | 主渠道（优先级 100） | 备用渠道（优先级 50） |
|------|---------------------|---------------------|
| veo3.1-fast | bltcy-veo | apexer-veo |
| veo3.1 | bltcy-veo | apexer-veo |
| veo3.1-pro | bltcy-veo | apexer-veo |
| veo3.1-fast-4k | bltcy-veo | apexer-veo |
| veo3.1-4k | bltcy-veo | apexer-veo |
| veo3.1-pro-4k | bltcy-veo | apexer-veo |
| veo3.1-fast-components | bltcy-veo | apexer-veo |
| veo3.1-components | bltcy-veo | apexer-veo |
| veo3.1-fast-components-4k | bltcy-veo | apexer-veo |
| veo3.1-components-4k | bltcy-veo | apexer-veo |

以下模型仅在一个渠道注册，无故障转移：

| 模型 | 唯一渠道 |
|------|----------|
| veo3.1-lite | xgapi-veo（当前创建失败，不建议上游调用） |
| grok-imagine-1.0-video | qilin-grok-video |
| grok-imagine-1.0-video-20s | qilin-grok-video |
| grok-imagine-1.0-video-30s | qilin-grok-video |

> **扩展提示**：要增加故障转移覆盖的模型，需要在多个渠道的模型列表中注册同一模型，并配置正确的 model_mapping（模型名映射）。

**模型名映射（model_mapping）：**

不同中转站使用不同的模型命名约定。系统通过渠道的 `model_mapping` 字段自动转换：

| 我们的模型名 | Apexer OpenAI 视频格式模型名 |
|-------------|-----------------|
| veo3.1 | veo3.1_relaxed |
| veo3.1-fast | veo3.1_fast |
| veo3.1-pro | veo3.1_pro |
| veo3.1-4k | veo3.1_relaxed_4k |
| veo3.1-fast-4k | veo3.1_fast_4k |
| veo3.1-pro-4k | veo3.1_pro_4k |
| veo3.1-components | veo3.1_relaxed + `type=3` |
| veo3.1-fast-components | veo3.1_fast + `type=3` |
| veo3.1-components-4k | veo3.1_relaxed_4k + `type=3` |
| veo3.1-fast-components-4k | veo3.1_fast_4k + `type=3` |

bltcy 使用与系统相同的命名，无需映射。

### 定价策略

- 视频生成：在采购价基础上加 $0.1/次
- 超过 $1 的模型：按采购价 ×1.5 定价
- $13 以上的模型：按 $15 定价
- 图片生成：在采购价基础上加 $0.1/次

---

## 七、视频生成架构分析

### 7.1 整体架构

视频生成采用 **Provider 模式**，将不同中转站的差异封装在 Provider 接口背后，对上游调用方完全透明：

```
上游调用方
    │
    ▼
┌──────────────────────────────────────────────────┐
│  统一 API 入口 (POST /v1/videos 或 /v1/video/generations)│
│  统一查询入口 (GET  /v1/videos/{id} 或 /v1/video/generations/{id})│
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  TaskAdaptor (relay/channel/task/openaivideo/)   │
│  ┌─────────────────────────────────────────────┐ │
│  │  provider 接口                               │ │
│  │  ├─ submitURL()        提交任务 URL          │ │
│  │  ├─ queryURL()         查询任务 URL          │ │
│  │  ├─ parseSubmitResponse()  解析提交响应      │ │
│  │  ├─ parseQueryResponse()   解析查询响应      │ │
│  │  ├─ buildSubmitResponseBody() 构建统一响应   │ │
│  │  ├─ needsMultipart()  是否需要 multipart     │ │
│  │  ├─ mapModelForImages() 模型名自动映射       │ │
│  │  └─ normalizeRequest() 平台参数归一化        │ │
│  └─────────────────────────────────────────────┘ │
│  ┌──────┐ ┌──────────┐ ┌──────┐ ┌────────┐     │
│  │bltcy │ │Apexer │ │xgapi │ │newapi  │     │
│  └──────┘ └──────────┘ └──────┘ └────────┘     │
└──────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│  渠道选择 + 优先级 + 自动重试 + 自动禁用/恢复    │
│  (service/channel_select.go + controller/relay.go)│
└──────────────────────────────────────────────────┘
```

### 7.2 Provider 路由机制

Provider 通过 `getProviderByBaseURL(baseURL)` 自动选择，匹配规则：

| Base URL 包含关键词 | 选择的 Provider | 说明 |
|---------------------|----------------|------|
| `xgapi` | xgapiProvider | 星光站 |
| `937qq` / `qilin` | qilinProvider | 麒麟 API / Grok 视频专用 |
| `apexer` | apexerapiProvider | Apexer 站 |
| `newapi` | newapiProvider | 通用 new-api 实例 |
| 其他（默认） | bltcyProvider | 柏拉图站 |

**设计原则**：Provider 在 `TaskAdaptor.Init()` 阶段一次性确定，后续提交、查询、解析全部使用同一个 Provider，避免自动检测带来的路由错误。

### 7.3 各平台能力对比

| 能力 | bltcy.ai | www.937qq.cn | www.aiapexers.com | xgapi.top | 通用 new-api |
|------|----------|--------------|---------------|-----------|-------------|
| 提交端点 | `/v2/videos/generations` | `/v1/videos` | `/v1/videos` | `/v1/videos` | `/v1/video/generations` |
| 查询端点 | `/v2/videos/generations/{id}` | `/v1/videos/{id}` | `/v1/videos/{id}` | `/v1/videos/{id}` | `/v1/video/generations/{id}` |
| 需要 Multipart | ❌ | ❌ | ❌ | ✅ | ✅ |
| 模型名映射 | frames 自动映射 | 原样 | 横线→下划线 + type 自动推断 | 原样 | 原样 |
| 提交响应格式 | `{task_id}` | `{id}` | `{id}` | `{id, object, ...}` | `{id, task_id, ...}` |
| 查询响应格式 | `{data: {output}}` | `{url}` / `{video_url}` | `{video_url}` | `{video_url}` | `{status, progress}` |
| 文生视频 | ✅ | ✅（Grok） | ✅ | ✅ | ✅ |
| 首帧图生视频 | ✅ | ✅（2026-05-15 验证） | ✅ | ✅ | ✅ |
| 首尾帧图生视频 | ✅ | ✅（2026-05-15 验证） | ✅（自动 `type=2`） | ❓ | ⚠️ 需验证 |
| 多图 Components | ✅ | ⚠️ 已验证 1-2 张；3 张未验证 | ✅（自动 `type=3`，pro 系列不支持） | ❓ | ❓ |
| sora-2 | ✅ | ❌ | ❓ | ✅ | ❓ |

> ✅ 已验证支持 | ❓ 未验证 | ⚠️ 需验证 | ❌ 不支持

### 7.4 上游屏蔽感知机制

系统在多个层面屏蔽了下游中转站的差异，上游调用方只需使用统一的 API：

**1. 统一 API 格式**
- 上游只看到 OpenAI Video 格式：`POST /v1/videos`（兼容 `POST /v1/video/generations`）+ `GET /v1/videos/{id}`（兼容 `GET /v1/video/generations/{id}`）
- 不同中转站的端点差异（`/v2/` vs `/v1/`、`/videos` vs `/video/generations`）完全透明

**2. 统一模型名**
- 上游使用标准模型名（如 `veo3.1-fast`），系统自动映射到各中转站的实际模型名
- 映射分两层：
  - **Provider 层**：`mapModelForImages()` 和 `normalizeRequest()` 处理 images 相关映射、下游特殊字段（如 bltcy 的 frames 映射、Apexer 的下划线转换和 `type=1/2/3` 推断）
  - **Channel 层**：`model_mapping` 处理平台间命名差异（如 `veo3.1` → `veo3.1_relaxed`）

**3. 统一响应格式**
- 提交响应统一返回 `{id, task_id}` 格式
- 查询响应统一转换为 `TaskInfo` 结构（status, url, progress, reason）
- 上游无需关心下游是 `{data: {output}}` 还是 `{video_url}` 格式

**4. 统一状态码**
- 各平台的状态字符串（`SUCCESS`/`completed`/`succeed`/`NOT_START`/`queued` 等）统一映射为 4 种内部状态：QUEUED / IN_PROGRESS / SUCCESS / FAILURE

### 7.5 自动重试机制

系统在两个阶段提供自动重试：

**阶段一：任务提交时（同步重试）**

```
请求 → 选择最高优先级渠道 → 提交失败？
  → shouldRetryTaskRelay() 判断是否可重试
  → 选择下一优先级渠道 → 再次提交
  → 最多重试 RetryTimes 次
```

可重试的条件：
- 5xx 服务器错误（超时除外）
- 429 限流
- 307 重定向
- 其他非 2xx/400/408 错误

不可重试的条件：
- 400 Bad Request（请求本身有问题）
- 408 Request Timeout（超时不重试）
- 2xx 成功
- LocalError（本地校验错误）

**阶段二：任务轮询时（异步容错）**

```
定时轮询 → FetchTask() 获取上游状态
  → 首先尝试 dto.TaskResponse[model.Task] 格式解析（new-api 标准格式）
  → 失败则使用 Provider.parseQueryResponse() 解析（平台特定格式）
  → 更新任务状态
```

**阶段三：渠道自动禁用/恢复**

```
渠道连续失败 → processChannelError() → ShouldDisableChannel()
  → 自动禁用该渠道（AutoBan=true 时）
  → 后续请求自动跳过该渠道

定时检查 → AutomaticEnableChannelEnabled=true
  → 被禁用渠道恢复后自动重新启用
```

### 7.6 接入新平台指南

要接入一个新的中转站，需要以下步骤：

**步骤 1：创建 Provider 文件**

在 `relay/channel/task/openaivideo/` 目录下创建新文件，如 `newstation.go`：

```go
package openaivideo

type newstationProvider struct{}

func (p *newstationProvider) submitURL(baseURL string) string {
    return baseURL + "/v1/video/generations"
}

func (p *newstationProvider) queryURL(baseURL, taskID string) string {
    return baseURL + "/v1/videos/" + taskID
}

func (p *newstationProvider) parseSubmitResponse(body []byte) (string, error) {
    // 解析提交响应，返回上游 task ID
}

func (p *newstationProvider) parseQueryResponse(body []byte) (*relaycommon.TaskInfo, error) {
    // 解析查询响应，返回 TaskInfo
}

func (p *newstationProvider) buildSubmitResponseBody(info *relaycommon.RelayInfo, upstreamTaskID string) any {
    return map[string]any{
        "id":      info.PublicTaskID,
        "task_id": info.PublicTaskID,
    }
}

func (p *newstationProvider) needsMultipart() bool { return false }

func (p *newstationProvider) mapModelForImages(model string, hasImages bool) string {
    return model // 或添加平台特定的模型名映射逻辑
}
```

**步骤 2：注册 Provider**

在 `provider.go` 的 `getProviderByBaseURL()` 和 `getProvider()` 中添加关键词匹配：

```go
case containsAny(baseURL, "newstation"):
    return &newstationProvider{}
```

**步骤 3：配置渠道**

在管理后台或数据库中添加渠道：
- `type` = 58 (ChannelTypeOpenAIVideo)
- `base_url` = 新平台的 API 地址
- `priority` = 优先级数值
- `models` = 支持的模型列表
- `model_mapping` = 模型名映射（如需要）
- `auto_ban` = 1（启用自动禁用）

**步骤 4：验证**

1. 提交测试请求，确认任务提交成功
2. 查询任务状态，确认轮询正常
3. 模拟主渠道故障，确认自动故障转移
4. 确认模型名映射正确

### 7.7 当前架构的局限与改进方向

**已解决的问题：**

| 问题 | 状态 | 解决方案 |
|------|------|----------|
| parseQueryResponseAuto 字段碰撞导致路由错误 | ✅ 已修复 | 改用 Init 时确定的 Provider 直接解析 |
| getProvider 缺少 apexerapi 匹配 | ✅ 已修复 | 添加 apexer 关键词匹配 |
| getProviderByBaseURL 缺少 newapi 匹配 | ✅ 已修复 | 添加 newapi 关键词匹配 |

**当前局限：**

| 局限 | 影响 | 改进方向 |
|------|------|----------|
| Provider 路由依赖 baseURL 关键词匹配 | 如果两个平台 baseURL 相似可能误匹配 | 改为渠道配置字段指定 Provider 名 |
| 模型名映射分散在 Provider 和 Channel 两层 | 维护成本高，需要同时修改两处 | 统一由 Channel 的 model_mapping 处理 |
| `/v1/models` 会暴露部分下游线路模型 | 上游可能误以为 `sora-2(线路BF)`、`grok-video-3(线路W)` 等都能直接创建任务 | 模型列表按 OpenAPI 可用性过滤，或增加可用性标记 |
| Sora 兼容别名 duration 归一化异常 | `openai-sora-2` 请求 8 秒仍会被转成下游不接受的 10 秒 | 修复 `xb_sora` duration 映射；修复前上游直接使用 `xb-sora2` |
| Runway 私有适配器暂不可用 | `seedance-2`、`gen4`、`wan`、`kling` 等模型不应给上游推荐 | 从公开模型列表隐藏或禁用对应渠道 |
| 首尾帧/Components 等高级功能未在所有平台验证 | 部分平台可能不支持但未明确拒绝 | 添加平台能力声明，请求前校验 |
| 轮询阶段无重试 | 如果查询请求失败，只能等下一轮 | 添加查询失败重试机制 |
| 无主动健康检查 | 只有请求失败时才发现渠道不可用 | 添加定时健康检查探针 |

**扩展性评估：**

- ✅ 接入新平台：只需创建 Provider 文件 + 注册关键词 + 配置渠道，无需修改核心逻辑
- ✅ 新增模型：在 `constants.go` 的 ModelList 添加 + 在 `model_ratio.go` 添加定价 + 在渠道中注册
- ✅ 新增能力（如音频生成）：参考视频生成的 Provider 模式，创建新的 ChannelType 和 Adaptor
- ⚠️ 跨平台能力差异：当前没有平台能力声明机制，无法在请求前判断某平台是否支持特定功能
