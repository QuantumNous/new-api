# yk-sd（KYY Seedance 折扣 / special）渠道设计

日期：2026-08-13  
状态：已确认设计（待写实现计划）

## 1. 背景与目标

在已有 **`yk-video`（type 69）** 之外，为 KYY Model Center 的另两个 Seedance 2.0 模型新建渠道 **`yk-sd`**：

| 对外逻辑模型 | 上游 `model` | 分辨率 |
|--------------|--------------|--------|
| `seedance2.0-yk-special` | `sd_2.0_special` | `720p` / `1080p` / `2k` / `4k` |
| `seedance2.0-yk-discount` | `sd_2.0_discount` | `480p` / `720p` / `1080p` |

客户端也可直接传上游原名；未知名原样透传。

### 为何不扩 yk-video

| 维度 | yk-video | yk-sd |
|------|----------|-------|
| 上游 model | `videos_933_c1` / `videos_stable` | `sd_2.0_special` / `sd_2.0_discount` |
| 计费 | 按次 | 按秒（本站 `model_price × 秒`） |
| 素材库 | 首版不做 | **强制**：图/视/音一律入素材库后再生成 |
| `watermark` | 提交前删除 | 透传 |

任务提交/轮询路径相同，但计费与素材策略不兼容，故独立渠道。

### 已确认产品决策

| 项 | 决策 |
|----|------|
| 接入方案 | 新建渠道 `yk-sd`（type `70`），不改 `yk-video` |
| 对外视频入口 | `POST/GET /v1/video/generations` |
| 素材策略 | **强制**：用户请求中的图片、视频、音频全部经素材库；公网 URL 自动 upload + 等到 `ACTIVE` 后改写为 `assetId://` |
| 对外素材 API | 薄代理：`POST /api/yk-sd/assets/upload`、`POST /api/yk-sd/assets/detail` |
| 本地归属库 | 不做（无素材组 / 真人认证 / 本地 DB 隔离） |
| 计费 | 按秒；预扣用请求 `duration`；完成用上游 `actualDuration` 回结算 |
| 上游积分 / Token 调平 | 本站不对账；`amount` 仅可透传/日志 |
| 火山 `content[]` | 支持（先规范化为扁平字段，再强制素材） |
| remix / 取消 / 余额 | 不做 |

## 2. 上游 API 摘要

- Base URL：`https://zcbservice.aizfw.cn/kyyReactApiServer`
- 鉴权：`Authorization: Bearer <API_KEY>`
- Content-Type：`application/json`

| 接口 | 方法 | 路径 |
|------|------|------|
| 素材提交 | POST | `/asset/seedance2/assetUpload` |
| 素材详情 | POST | `/asset/seedance2/assetDetail` |
| 创建任务 | POST | `/v2/model-center/tasks` |
| 查询任务 | GET | `/v2/model-center/tasks/{id}` |

### 2.1 素材提交

请求：`assetType`（`Image` / `Video` / `Audio`）、`url`（公网可访问）、可选 `name`。  
响应：`assetId`、`status`（通常 `PROCESSING`）、`errorMessage` 等。

状态：`NONE` / `UPLOADING` / `PROCESSING` / `ACTIVE` / `FAILED` / `EXPIRED` / `DELETED`。  
**仅 `ACTIVE` 可用于视频生成。**

### 2.2 视频创建（字段摘要）

两模型共用创建路径。典型字段：

- `model`、`prompt`（必填）
- `reference_images`（0–9）、`reference_videos`（0–3）、`reference_audios`（0–3）
- `first_image` / `last_image`（0–1）
- `duration`（4–15，默认 5）、`aspect_ratio`、`resolution`
- `seed`、`generate_audio`、`tools`、`watermark`

媒体 URL 可为公网地址或 `assetId://{assetId}`。本渠道在出站前把非 `assetId` 媒体全部换成 `assetId://`。

场景互斥（上游约束，本渠道做文档级校验即可，硬失败交给上游亦可）：首帧 / 首尾帧 / 多模态参考不可混用；音频不可单独输入。

### 2.3 查询响应

状态：`queued` → `processing` → `completed` | `failed`。  
成片优先 `video_url`，其次 `result_url`。  
可选：`progress`、`amount`、`actualDuration`；discount 可能另有 `upstream_url` / `upstream_urls`（成功时对外可写入 metadata，非必须）。

## 3. 强制素材流水线

在任务 `BuildRequestBody` 完成扁平化与火山规范化之后、序列化提交之前执行。

### 3.1 扫描字段

对下列字段中的每个媒体项处理：

- `reference_images`、`first_image`、`last_image`
- `reference_videos`、`reference_audios`

字段值形态：字符串或字符串数组（以及火山规范化后的字符串 URL）。扫描时统一抽成 URL 列表；写回时：

- `reference_images` / `reference_videos` / `reference_audios` → `[]string`（`assetId://...`）
- `first_image` / `last_image` → **单个字符串** `assetId://...`（与上游 Submit curl 示例一致；若客户端传入数组则取第一项）

### 3.2 单条处理规则

| 输入 | 行为 |
|------|------|
| `http://` / `https://` | `assetUpload` → 轮询 `assetDetail` 至 `ACTIVE` → 替换为 `assetId://{assetId}` |
| 已是 `assetId://{id}` | 不重复 upload；`assetDetail` 确认 `ACTIVE`；非 ACTIVE 则轮询直至 ACTIVE / FAILED / 超时 |
| 纯 `asset-...` ID（无 scheme） | 视为素材 ID，同上校验后规范为 `assetId://{id}` |
| base64 / data URL / 空 | 本地错误返回，不提交视频任务 |

`assetType` 由字段推断：`Image` / `Video` / `Audio`。  
`name` 可选截断（≤50 Unicode），可用短 hash 或固定前缀。

### 3.3 并发与超时

- 同一请求内多个媒体：**并行** upload + 轮询
- 轮询间隔：约 2s
- 单素材总超时：约 120s（包内常量）
- 任一 `FAILED`、超时或不可达：整次创建失败，返回明确错误（含 `errorMessage` 若有），**不**调用 `/v2/model-center/tasks`
- 无媒体的文生视频：跳过本流水线

### 3.4 与对外素材 API 的关系

- `/api/yk-sd/assets/*` 供客户端预上传
- **即使用户直传公网 URL，服务端创建任务时仍强制走素材库**（已 ACTIVE 的 `assetId` 只校验）

## 4. 请求映射（客户端 → 上游）

| 客户端 | 上游 | 规则 |
|--------|------|------|
| `model` | `model` | 见 §1 映射；未知名透传 |
| `prompt` | `prompt` | 透传 |
| `duration` / `seconds` | `duration` | 优先 `duration`，否则解析 `seconds` |
| `aspect_ratio` / `ratio` | `aspect_ratio` | `ratio` 回填 |
| `resolution` / `size` | `resolution` | 小写；按模型校验合法集合，非法本地 400 |
| `images` / `image` / `reference_images` | `reference_images` | URL 数组，再强制素材 |
| `videos` / `reference_videos` | `reference_videos` | 同上 |
| `audios` / `reference_audios` | `reference_audios` | 同上 |
| `first_image` / `last_image` | 同名 | 强制素材后写出 |
| `seed` / `generate_audio` / `tools` / `watermark` | 同名 | 有则透传（**保留 watermark**） |
| `metadata.*` | 合并进 body | 不覆盖已有顶层键 |

火山 `content[]` 规范化规则对齐 yk-video（text→prompt；`role=first_frame|last_frame`→首尾帧；其余 image/video/audio→reference_*；缺省 `generate_audio=true`）。规范化后再跑强制素材。

remix：本地 `not_supported`。

## 5. 响应与状态映射

与 yk-video 相同：

| 上游 `status` | 内部 | 对外 OpenAI |
|---------------|------|-------------|
| `queued` | Queued | `queued` |
| `processing` | InProgress | `in_progress` |
| `completed` + URL | Success | `completed` |
| `failed` | Failure | `failed` |

成片：`video_url` > `result_url`。进度：数字→`N%`；缺省 queued≈10%、processing≈50%。

## 6. 计费

- 嵌入 `taskcommon` 按秒能力：`EstimateBilling` 返回 `seconds` 倍率（取请求 `duration`；若缺省用 **5**，与上游文档默认一致）
- `AdjustBillingOnComplete`：优先读上游 `actualDuration`，否则保持预扣
- 分辨率差价：后台配置 `model_price` / billing OtherRatios；渠道代码不写死上游积分表
- 不解析上游 Token 调平；不对 `amount` 做本站结算依据

两模型建议在运营侧标记 `billing_mode=per_second`（与 doubao / mao 等一致）。

## 7. 对外素材薄代理

### 7.1 配置

`setting/operation_setting/yk_sd_asset_setting.go`：

- `yk_sd_asset.enabled`（bool）
- `yk_sd_asset.gateway_channel_id`（int，指向 type=70 渠道，取其 BaseURL + Key）

未启用或渠道无效：素材 API 返回明确配置错误。

### 7.2 路由

| 方法 | 本站路径 | 上游 |
|------|----------|------|
| POST | `/api/yk-sd/assets/upload` | `/asset/seedance2/assetUpload` |
| POST | `/api/yk-sd/assets/detail` | `/asset/seedance2/assetDetail` |

- 中间件：`TokenAuth`（对齐 `/api/seedance`，不走 Distribute）
- 请求/响应：基本透传上游 JSON；可选轻度字段校验（`assetType`/`url`/`assetId`）
- 任务适配器内强制素材直接用渠道 Key，不依赖该 setting；setting 仅服务公开素材 API

## 8. 包结构与注册

```
relay/channel/task/yksd/
  constants.go
  adaptor.go
  normalize.go
  volc_normalize.go
  asset_client.go
  force_assets.go
  *_test.go

controller/yk_sd_asset.go
service/yk_sd_asset.go
router/yk_sd-router.go
setting/operation_setting/yk_sd_asset_setting.go
```

| 位置 | 内容 |
|------|------|
| `constant/channel.go` | `ChannelTypeYkSd = 70`，名称 `yk-sd`，默认 BaseURL 同 KYY |
| `relay/relay_adaptor.go` | 注册 TaskAdaptor |
| 前端 default + classic | type 70、默认模型、Key 提示、渠道说明、icon |
| `router/main.go` | `SetYkSdRouter` |
| 运营设置 UI | 最小：enabled + gateway_channel_id（classic/default 同步） |

默认模型列表：`seedance2.0-yk-special`、`seedance2.0-yk-discount`（可附带上游原名）。

Key 提示：Bearer token（KYY / yk-sd API Key）。

## 9. 非目标

- 不修改 `yk-video` 行为与模型列表
- 不做素材本地归属 / 素材组 / 真人认证
- 不做上游积分余额、Token 调平对账
- 不支持 remix、上游取消
- 不落真实卡密到文档/测试

## 10. 测试要点

1. 模型别名：`seedance2.0-yk-special`→`sd_2.0_special`；`seedance2.0-yk-discount`→`sd_2.0_discount`
2. 公网 URL → mock upload+ACTIVE → body 为 `assetId://...`
3. 已是 `assetId://` → 只 detail，不二次 upload
4. `FAILED` / 超时 → 创建失败，不调 tasks
5. 无媒体文生 → 不调素材
6. 火山 `content[]` → 扁平 → 强制素材
7. `watermark`/`seed`/`tools` 透传；非法 resolution 本地错（special 无 480p；discount 无 2k/4k）
8. Base URL 去 `/v2/model-center/tasks` 等后缀
9. remix → `not_supported`
10. 素材代理：未配置 gateway → 错误；配置后转发 upload/detail

## 11. 实现顺序（概要）

1. `yksd` 任务适配器（仿 ykvideo）+ 单测  
2. `asset_client` + `force_assets` + mock 单测  
3. 渠道 type 70 注册 + 前端  
4. 素材 setting / service / controller / router + 运营 UI 最小集  
5. 按秒计费 Estimate / Adjust 单测  
6. `go test` 相关包
