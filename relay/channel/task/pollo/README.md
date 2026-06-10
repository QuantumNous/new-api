# Pollo Seedance 视频生成 — Doubao 兼容参考文档

> 适配器位置：`relay/channel/task/pollo/`
> Channel 类型：`ChannelTypePollo = 58`
> 上游平台：Pollo AI `https://pollo.ai/api/platform`（文档 https://docs.pollo.ai/m/seedance/seedance-2-0）
> API 范式：**异步 Task**（提交 → 后台轮询 → 完成时按实际 credit 结算）

本渠道的设计目标：**对 Doubao seedance 渠道（`relay/channel/task/doubao/`，参考其 README）
在输入参数与输出参数上 100% 兼容**——同一个客户端请求体无论路由到 Doubao 还是 Pollo，
消费的字段语义一致、返回的响应形态一致。覆盖全部四种客户端请求格式：

| 格式 | 入口 | 请求体去向 |
|------|------|-----------|
| new-api 原生 | `POST /v1/video/generations` | `TaskSubmitReq`（prompt/model/images/seconds/metadata） |
| Sora / OpenAI | `POST /v1/videos`（JSON 或 multipart） | 同上（`input_reference`→images，未知表单键→metadata） |
| 可灵 Kling | `POST /kling/v1/videos/{text2video,image2video}` | 原始可灵请求体整体进入 `metadata` |
| 即梦 Jimeng | `POST /jimeng/?Action=CVSync2AsyncSubmitTask` | 原始即梦请求体整体进入 `metadata`（`req_key`→model） |

四种格式的具体调用契约见 `docs/`：
- [docs/openapi-newapi.yaml](docs/openapi-newapi.yaml) — new-api 原生格式（含完整字段映射表）
- [docs/openapi-sora.yaml](docs/openapi-sora.yaml) — Sora / OpenAI Video API 格式
- [docs/openapi-kling.yaml](docs/openapi-kling.yaml) — 可灵格式
- [docs/openapi-jimeng.yaml](docs/openapi-jimeng.yaml) — 即梦格式

---

## 1. 输入参数兼容矩阵（Doubao 为基准）

### 顶层字段（`TaskSubmitReq`）

| 字段 | Doubao 行为 | Pollo 行为 | 一致性 |
|------|------------|-----------|:------:|
| `prompt` | 唯一文本来源（metadata text 项被剔除） | 同左：`input.Prompt` 强制取顶层 | ✅ |
| `model` | 选路 + 模型映射 | 同左（`modelBasePaths` 校验在映射后） | ✅ |
| `image` / `images[0]` | content[] image_url | `input.image`（首帧） | ✅ |
| `images[1]` | content[] image_url（无 role 透传） | `input.imageTail`（尾帧） | ✅* |
| `seconds` | 覆盖 duration | 同左（`resolveSeconds` 优先级最高） | ✅ |
| `duration`（顶层） | **不消费** | 消费（seconds 之后）— 超集 | ✅⁺ |
| `size` / `mode` / `input_reference` | 不消费（multipart 路径 input_reference→images） | 同左 | ✅ |

### metadata 字段

| metadata 键 | Doubao | Pollo | 说明 |
|------------|--------|-------|------|
| `resolution` | ✅ | ✅ | 480p/720p/1080p（fast 不支持 1080p） |
| `ratio` | ✅ | ✅ → `aspectRatio` | |
| `duration`（int 或字符串） | ✅（`dto.IntValue` 容忍字符串） | ✅（同样容忍） | 可灵格式发 `"5"` |
| `frames` | ✅ 透传 | ✅ 换算秒数 `(frames-1)/24` | 121→5s、241→10s |
| `seed`（含显式 0） | ✅ | ✅（`*dto.IntValue` 保零值；ref 路径上游无此参数） | Rule 6 |
| `generate_audio` | ✅ | ✅ → `generateAudio` | ref 路径显式补默认 `false` 对齐 Doubao（Pollo 上游默认 true） |
| `tools:[{type:web_search}]` | ✅ | ✅ → `webSearch:true` | |
| `callback_url` | ✅ 透传 | ✅ → `webhookUrl` | 仅映射地址；回调载荷为各上游原生格式 |
| `content[]` image_url（role: first_frame/缺省、last_frame、reference_image） | ✅ 透传 | ✅ → image / imageTail / refs[{type:image}] | refs 触发 /ref2video |
| `content[]` video_url | ✅ 透传（命中视频输入折扣） | ✅ → refs[{type:video}] | |
| `content[]` audio_url | ✅ 透传 | ✅ → refs[{type:audio}] | |
| `content[]` text | 剔除后用顶层 prompt | 忽略（同效） | ✅ |
| `camera_fixed` / `watermark` / `return_last_frame` / `service_tier` / `draft` / `execution_expires_after` | ✅ 透传 | ⚠️ **静默忽略**（Pollo 上游无对应参数） | 上游能力差异，无法映射 |
| `aspect_ratio` / `image` / `image_tail` / `image_urls[]`（可灵/即梦键） | ❌ 忽略 | ✅ 映射（超集） | 即梦/可灵格式可用性 |
| `aspectRatio` / `length` / `videoNum` / `refs[]` / `imageMeta` / `imageTail` / `webSearch` / `generateAudio`（Pollo 原生键） | ❌ 忽略 | ✅ | Pollo 原生透传 |

`*` Doubao 将多图全部透传由上游按位置处理；Pollo i2v 形态只有首帧+尾帧两个槽位。
`⁺` 超集：Pollo 额外消费、Doubao 忽略的字段不会造成 Doubao 请求失败。

**别名归一化**（`normalizeMetadataAliases`）：`generate_audio→generateAudio`、
`web_search→webSearch`、`video_num→videoNum`、`aspect_ratio→aspectRatio`、
`image_tail→imageTail`、`image_meta→imageMeta`；原生键优先。

**字符串数值容忍**：`polloInput` 的数值/布尔字段使用 `dto.IntValue`/`dto.BoolValue`，
与 Doubao 的 DTO 容忍度一致（`"duration":"5"`、`"seed":"42"` 不会报错）。

### ref 形态自动路由

与 Doubao「单模型双形态」设计一致：请求带 refs（来自 `metadata.refs` 原生透传，或
content[] 的 reference_image/video_url/audio_url 映射）即走 `/ref2video`
（`input.duration`+`refs[]`，必填 `aspectRatio` 自动补 `16:9`，首尾帧字段清空）；
否则走标准 t2v/i2v（`input.length`+可选 `image`/`imageTail`）。

## 2. 输出参数兼容

| 接口 | 响应 | 一致性 |
|------|------|:------:|
| 提交（所有格式） | OpenAI Video 对象（`id`=公开 task_id、`created_at`、`model`） | ✅ 与 Doubao 完全相同 |
| `GET /v1/videos/{id}`（Sora 格式查询） | `ConvertToOpenAIVideo`：`id/task_id/status/progress/created_at/completed_at/model/metadata.url`（键始终存在，未完成为空串）/失败时 `error.message` | ✅ 字段集合与 Doubao 对齐 |
| `GET /v1/video/generations/{id}`、可灵/即梦查询 | 统一 `TaskResponse<TaskDto>`（规范化字段渠道无关） | ✅（`data.data` 为上游原始响应，形态因上游而异，不建议客户端依赖） |

## 3. 计费（与 Doubao 的差异点，非输入/输出契约）

Pollo 按 **credit** 结算：提交时调免费 `/validate` 端点精确预扣，完成时按状态响应的
实际 `credit` 经 `AdjustBillingOnComplete` 结算（`settleModelRatio` 固定 $0.06/credit，
与后台展示 ModelRatio 解耦）。详见 `adaptor.go` 头部注释。Doubao 则按 `total_tokens`
差额重算。两者对客户端透明。

## 4. 测试

```bash
go test ./relay/channel/task/pollo/

# 真实上游冒烟（产生计费，需显式开启）：
POLLO_API_KEY=xxx POLLO_LIVE_TEST=1 go test ./relay/channel/task/pollo/ -run TestLive -v
```

- `adaptor_test.go` — 响应解析、计费、ref/standard 形态、seconds 优先级、Rule 6 零值
- `compat_test.go` — **四格式 Doubao 兼容**（可灵字符串 duration、即梦 image_urls/frames、
  doubao snake_case 别名、content[] video/audio refs、ConvertToOpenAIVideo 字段对齐）
- `live_matrix_test.go` — 真实 API 参数矩阵 + /validate 报价

## 5. 相关文档

- `relay/channel/task/doubao/README.md` — Doubao 渠道参考契约（本渠道兼容基准）
- `docs/openapi-*.yaml` — 四种调用格式的 OpenAPI 契约
