# PingXingShiJie（渠道 58）下游 API 参考

本文档描述 **经本网关（new-api）** 访问平行视界能力时的 HTTP 接口：请求参数、默认值、取值范围说明、成功/失败响应与字段含义。  
上游原始规范见厂商文档（本地可参考 `Pingxingshijie-AI接口.md`，默认不纳入版本库以免示例链接触发密钥扫描）。网关将请求转发至渠道配置的 Base URL（默认 `https://api.pingxingshijie.cn`），并对异步任务做统一落库与轮询。

**相关文档**

- [OpenAI 兼容性说明](./pingxingshijie-openai-compatibility.md)

---

## 1. 通用约定

### 1.1 认证与请求头

| 参数名 | 位置 | 必填 | 值范围 / 格式 | 默认值 | 含义 |
|--------|------|------|----------------|--------|------|
| `Authorization` | Header | 是 | `Bearer <token>` | — | 与本系统其它 API 一致的访问令牌 |
| `Content-Type` | Header | POST 时建议固定 | `application/json` | — | JSON 请求体 |
| `Accept` | Header | 否 | `application/json` | — | 响应一般为 JSON |

**说明**：下列路由挂在 `router/video-router.go` 的 `/v1` 分组上，使用 **Token 认证** + **Distribute（按模型选渠道）**。调用方必须在渠道中配置 **渠道类型 58（PingXingShiJie）**，且令牌对该渠道上的 **model** 有权限。

### 1.2 模型与选路（Distributor）

| 参数名 | 位置 | 必填 | 含义 |
|--------|------|------|------|
| `model` | Body（JSON） | 对 **POST 提交类**接口为 **是**（分发器强校验） | 与后台渠道/模型配置一致的模型 ID；用于选择渠道与映射上游模型名 |

**说明**：`GET` 查询任务状态类接口 **不需要** 在 Body 中带 `model`（分发器对对应路径 `shouldSelectChannel = false`）。

### 1.3 常见 HTTP 状态码（任务类接口）

| HTTP | 含义（摘要） |
|------|----------------|
| 200 | 成功（GET/POST 业务成功） |
| 400 | 请求体非法、缺少 `model`/`prompt`、任务不存在等 |
| 401 | 未授权或 Token 无效 |
| 402 / 403 / 429 | 额度、权限、限流等（与本系统全局策略一致） |
| 5xx | 网关或上游异常 |

### 1.4 统一错误响应 Body（任务类失败时）

业务错误通过 `dto.TaskError` 返回（常见字段如下）。

| 字段名 | 类型 | 含义 |
|--------|------|------|
| `code` | string | 机器可读错误码，如 `invalid_request`、`get_channel_failed`、`task_not_exist` |
| `message` | string | 人类可读说明 |
| `data` | any | 附加数据，可为 `null` |

**说明**：部分场景下上游返回 HTTP 200 但 JSON `code != 0`，网关会转换为任务错误，不视为成功。

### 1.5 成功提交时的附加响应头

| 头名称 | 含义 |
|--------|------|
| `X-New-Api-Other-Ratios` | JSON 字符串：计费相关的其它倍率（如视频含视频输入时的 `video_input` 等），用于客户端或调试观测 |

### 1.6 文本对话（Chat Completions）

| 项目 | 说明 |
|------|------|
| 客户端路由 | 与其它渠道一致，使用全局 **`POST /v1/chat/completions`**（见 `router/relay-router.go`），认证与分组规则不变。 |
| 网关 → 上游 | 渠道类型 **58** 复用 **Volcengine** adaptor 做请求/鉴权/部分响应处理；文本上游路径为 **`{Base URL}/v2/chat/completions`**（与视频/图等 **`/v2/*`** 同一 API 族）。**不要**使用 `{Base URL}/v1/chat/completions` 或 `/api/v3/chat/completions`：在该域名下会返回 HTTP 400「接口不存在」。Base URL 默认 `https://api.pingxingshijie.cn`。 |
| `model` | Body 必填；值为控制台/方舟侧 **endpoint 模型 ID**（与后台模型映射一致）。 |
| 响应包装 | 若上游 JSON **根级含 `code`**（含 **`/v2/chat/completions`** 业务错误如 **`{"code":401,"message":"..."}`**），网关在 **非流式** 下会：对 **`code != 0`** 直接返回对应 HTTP 状态与文案；对 **`code == 0`** 且含 **`data`** 时解包 **`data`** 后再按 OpenAI Chat Completion 解析。无根级 **`code`** 的纯 OpenAI 形体会原样解析。流式（SSE）仍透传上游字节流（若上游对流也包装，需客户端或后续版本单独适配）。 |
| 后台「测试渠道」 | 已支持 58：模型名 **含 `seedream`**（不区分大小写）时走 **`/v1/images/generations`** 测同步图；否则默认走 **`/v1/chat/completions`** 测文本。 |

---

## 2. 视频生成

### 2.1 提交任务

**`POST /v1/video/generations`**

网关将 Body 解析为统一任务结构 `TaskSubmitReq`，再转换为上游 `/v2/video/generations` 所需的 Ark 形请求（`content` 数组 + 顶层参数）。**未显式设置 `generate_audio` 时，网关会默认置为 `true`** 再转发上游。

#### 2.1.1 Body 顶层字段（网关 `TaskSubmitReq`）

| 参数名 | 类型 | 必填 | 默认值 | 值范围 / 说明 |
|--------|------|------|--------|----------------|
| `model` | string | **是** | — | 须在渠道可用模型列表中；示例见 `Pingxingshijie-AI接口.md` §视频生成（如 `doubao-seedance-2-0-fast-260128` 等） |
| `prompt` | string | **是**（非空） | — | 文生视频主提示词；会与 `metadata` 中的多模态 `content` 合并（见下） |
| `metadata` | object | 否 | — | 与上游视频请求对齐的扩展字段；见 **2.1.2** |
| `images` | string[] | 否 | — | 便捷图生通道：每个元素映射为一条 `type: image_url` 的 content 项（URL / Base64 / `asset://...` 等规则见上游文档） |
| `image` | string | 否 | — | 单图；会并入 `images` |
| `seconds` | string | 否 | — | 可解析为整数的秒数字符串，映射上游 `duration`（秒） |
| `duration` | number | 否 | — | 与 `seconds` 二选一语义，整数秒 |
| `size` | string | 否 | — | 其它任务类型复用字段；本链路主要尺寸信息见 `metadata` / 上游 |
| `mode` | string | 否 | — | 预留 |
| `input_reference` | string | 否 | — | 与其它任务类型对齐的参考图字段 |

**`prompt` 与 `metadata.content` 的合并规则（实现摘要）**

- 若 `metadata.content` 中已含 **`draft_task`**，则不再自动追加文本项。
- 否则：先合并 `metadata` 解析出的 `content`/`resolution`/`ratio` 等，再追加一条 `type: text`、`text: prompt` 的条目（并过滤掉仅用于占位的旧 text 项）。

**Seedance 1.5 Pro：草稿任务 ID 放大（仅 `draft_task`，不需要 `metadata.draft`）**

「草稿 id 放大」只需在 **`metadata.content`** 里提供 **`type: "draft_task"`** 与 **`draft_task.id`**（指向上游已返回的 **draft 预览**任务 id，如 `cgt-...`）。**不需要**单独设置 **`metadata.draft`**；该布尔字段与「引用草稿任务 id 做放大」不是同一语义。网关仍会校验顶层 **`prompt` 非空**（可与业务无关的占位文案），但不会把 `prompt` 当作 `content` 文本发给上游。

`resolution` 在 Seedance 1.5 Pro 放大场景下应为 **`720p`** 或 **`1080p`**（若误传 `480p` 等，网关会对该模型归一为合法放大档位）。其它 `metadata` 字段（如 **`watermark`**、**`return_last_frame`**）按上游支持情况原样合并。

示例（下游 OpenAI 风格任务体）：

```json
{
  "model": "doubao-seedance-1-5-pro-251215",
  "prompt": "Generate from draft",
  "metadata": {
    "content": [
      {
        "type": "draft_task",
        "draft_task": {
          "id": "cgt-20260416103233-xccct"
        }
      }
    ],
    "watermark": false,
    "resolution": "720p",
    "return_last_frame": true
  }
}
```

#### 2.1.2 `metadata` 内常用字段（与上游 `requestPayload` 对齐）

下列字段由网关合并进上游 JSON（与 `Pingxingshijie-AI接口.md` 中 POST body 一致；具体枚举与约束以该文档为准）。

| 参数名 | 类型 | 必填 | 默认值 | 含义 / 值范围（摘要） |
|--------|------|------|--------|------------------------|
| `content` | array | 条件必填 | — | 多模态条目：`type` 为 `text` \| `image_url` \| `video_url` \| `audio_url` \| `draft_task` 等；结构见上游文档 |
| `resolution` | string | 视模型而定 | 上游默认如 `720p` | 如 `480p`、`720p` |
| `ratio` | string | 视模型而定 | — | 如 `16:9`、`9:16`、`adaptive` 等 |
| `duration` | number | 视模型而定 | — | 整数秒；Seedance 2.0 等范围见上游文档（如 `[4,15]` 或 `-1`） |
| `generate_audio` | boolean | 否 | **网关默认 `true`** | 是否生成与画面对齐的声音；若客户端在 `metadata` 中显式传入，则以客户端为准 |
| `watermark` | boolean | 否 | — | 是否水印 |
| `draft` | boolean | 否 | — | 草稿任务相关 |
| `return_last_frame` | boolean | 否 | — | 是否返回尾帧等（BoolValue） |
| `service_tier` | string | 否 | — | 服务层级 |
| `execution_expires_after` | number | 否 | — | 执行过期（IntValue） |
| `frames` / `seed` | number | 否 | — | 帧数、随机种子等 |
| `camera_fixed` | boolean | 否 | — | 相机固定 |
| `tools` | array | 否 | — | 工具声明 |
| `callback_url` | string | 否 | — | 回调 URL |

**计费侧**：若 `metadata.content` 中存在 **视频输入**（`video_url` 等），网关可能对模型应用 **`video_input` 倍率**（见渠道侧配置与 `pingxingshijie` 常量中的映射）。

#### 2.1.3 成功响应 HTTP 200 — Body（`dto.OpenAIVideo`）

提交成功后返回 **网关公开任务 ID**（**不**直接暴露上游 `cgt-...` 在对外 id 字段中；上游 ID 存于任务私有数据用于轮询）。

| 字段名 | 类型 | 含义 |
|--------|------|------|
| `id` | string | 公开任务 ID（与 `task_id` 相同语义） |
| `task_id` | string | 与 `id` 一致，兼容字段 |
| `object` | string | 固定为 `video` |
| `model` | string | 请求中的业务模型名（映射前/后以网关实现为准，一般为客户端传入的模型别名） |
| `status` | string | 初始多为 `queued`（`dto.VideoStatusQueued`） |
| `progress` | number | 初始多为 `0` |
| `created_at` | number | Unix 时间戳（秒） |

**说明**：客户端应使用返回的 **`id` 或 `task_id`** 作为后续 **GET 查询** 的路径参数。

---

### 2.2 查询视频任务

**`GET /v1/video/generations/:task_id`**

| 参数名 | 位置 | 必填 | 含义 |
|--------|------|------|------|
| `task_id` | Path | 是 | 提交接口返回的 **公开** `task_id` |

**无 Body**。

#### 成功响应 HTTP 200 — Body（`dto.OpenAIVideo`）

| 字段名 | 类型 | 含义 |
|--------|------|------|
| `id` | string | 公开任务 ID |
| `task_id` | string | 同 `id` |
| `object` | string | `video` |
| `model` | string | 任务属性中的原始模型名 |
| `status` | string | `queued` \| `in_progress` \| `completed` \| `failed` \| `unknown`（由内部状态映射） |
| `progress` | number | 0–100，来自内部进度字符串 |
| `created_at` | number | 创建时间戳（秒） |
| `completed_at` | number | 更新时间戳（秒），有则返回 |
| `metadata` | object | 可选；其中常见 **`url`** 为视频可播放地址（来自上游 `content.video_url`） |
| `error` | object | 失败时存在：`message`、`code` |

---

### 2.3 OpenAI 风格视频路由（可选）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/v1/videos` | POST | 提交；Body 仍通过任务通道解析（multipart 等以网关实现为准） |
| `/v1/videos/:task_id` | GET | 查询；响应形状与 **2.2** 相同（`OpenAIVideo`） |

模型、Body 字段与 **2.1** 同源逻辑，仅路径不同。

---

### 2.4 视频 Remix（可选）

**`POST /v1/videos/:video_id/remix`**

| 参数名 | 位置 | 必填 | 含义 |
|--------|------|------|------|
| `video_id` | Path | 是 | **本系统内**已有任务的公开 ID（用于锁定渠道与继承计费上下文） |
| Body | JSON | 是 | 与其它任务提交类似的 `TaskSubmitReq`（`model`、`prompt`、`metadata` 等） |

成功/失败响应与任务提交通道一致；详细约束见 `relay/relay_task.go` 中 `ResolveOriginTask`。

---

## 3. 图片生成（异步）

### 3.1 提交任务

**`POST /v1/images/generations/async`**

Body **原样转发**为上游 `POST /v2/image/generations` 的 JSON，仅将 **`model`** 替换为映射后的上游模型名。校验走 `ValidateBasicTaskRequest`：**`prompt` 必填非空**，且 **`model` 必填**（用于分发）。

#### 3.1.1 Body 字段（与上游 Seedream 对齐 — 摘要）

完整参数、枚举与约束以 **`Pingxingshijie-AI接口.md` §提交图片生成任务** 为准。常见字段如下：

| 参数名 | 类型 | 必填 | 默认值 | 含义 / 范围（摘要） |
|--------|------|------|--------|---------------------|
| `model` | string | **是** | — | 如 `doubao-seedream-5-0-260128`、`doubao-seedream-4-0-250828` 等 |
| `prompt` | string | **是** | — | 文生/图生提示词 |
| `image` | string 或 string[] | 视模式 | — | 参考图 URL 列表等（见上游） |
| `sequential_image_generation` | string | 视模型 | — | 如 `auto` |
| `sequential_image_generation_options` | object | 视模型 | — | 如 `max_images` |
| `size` | string | 视模型 | — | 如 `2K` |
| `output_format` | string | 视模型 | — | 如 `png` |
| `watermark` | boolean | 视模型 | — | 是否水印 |

#### 3.1.2 成功响应 HTTP 200

为兼容现有任务通道，提交成功时 Body 仍使用 **`dto.OpenAIVideo`** 外壳（`object: video`），便于客户端统一处理异步任务：

| 字段名 | 类型 | 含义 |
|--------|------|------|
| `id` | string | **公开任务 ID**（用于 GET 查询，**不是**上游 `I20...` 任务号） |
| `task_id` | string | 同 `id` |
| `object` | string | `video`（历史兼容） |
| `model` | string | 请求模型名 |
| `status` | string | 初始多为 `queued` |
| `progress` | number | 初始多为 `0` |
| `created_at` | number | Unix 秒 |

**说明**：上游返回的图片任务 ID 保存在服务端任务记录中，用于轮询上游 `GET /v2/image/generations/tasks/{id}`，**客户端只需保存公开 `task_id`**。

---

### 3.2 查询图片任务

**`GET /v1/images/generations/:task_id`**

| 参数名 | 位置 | 必填 | 含义 |
|--------|------|------|------|
| `task_id` | Path | 是 | 提交接口返回的 **公开** 任务 ID |

#### 成功响应 HTTP 200 — Body（扩展 JSON）

| 字段名 | 类型 | 含义 |
|--------|------|------|
| `object` | string | 固定 `pingxingshijie.image.generation.task` |
| `id` | string | 公开任务 ID |
| `task_id` | string | 同 `id` |
| `status` | string | `queued` \| `in_progress` \| `completed` \| `failed` \| `unknown` |
| `progress` | string | 内部进度，如 `50%` |
| `model` | string | 原始模型名 |
| `created_at` | number | 秒级时间戳 |
| `updated_at` | number | 秒级时间戳 |
| `url` | string | 成功时可能存在：结果图地址（来自上游 `content.image_url`） |
| `error` | object | 失败时可能存在：`message`、`code` |

---

## 4. 素材（Asset）异步

### 4.1 提交上传任务

**`POST /v1/assets/upload`**

Body **原样转发**至上游 `POST /v2/asset/upload`。分发器要求 JSON 中必须显式传入 **`model`**，且素材上传只允许专用模型名 **`pingxingshijie-asset`**，用于选路与计费。

#### 4.1.1 Body 字段（与上游一致 — 摘要）

详见 **`Pingxingshijie-AI接口.md` §素材上传**。

| 参数名 | 类型 | 必填 | 默认值 | 含义 / 范围（摘要） |
|--------|------|------|--------|---------------------|
| `model` | string | 是 | 无 | 必须为 `pingxingshijie-asset`；其它模型会被拒绝，避免素材上传错误使用生图/视频模型计费或归类 |
| `image_url` | string | **是**（上游） | — | 素材来源 URL（或其它上游允许的形式） |
| `asset_type` | string | **是**（上游） | — | `Image` \| `Video` \| `Audio` |

**网关行为摘要**

- 转发给上游的 JSON 为客户端 **原始请求体**（`image_url`、`asset_type` 等不会被网关改写）。
- 分发器需要 `model` 选渠道和计费；素材上传必须显式使用 **`pingxingshijie-asset`**。
- 适配器在校验阶段可能为内部 `TaskSubmitReq` 填入占位 `prompt`（如 `asset-upload`），**仅用于本网关任务校验/计费上下文**，**不要求**客户端在 Body 中携带 `prompt`。

#### 4.1.2 成功响应 HTTP 200

| 字段名 | 类型 | 含义 |
|--------|------|------|
| `id` | string | 公开任务 ID |
| `task_id` | string | 同 `id` |
| `asset_id` | string | 上游素材 ID（用于后续 `asset://...` 引用） |
| `object` | string | `pingxingshijie.asset.upload` |

---

### 4.2 查询素材任务

**`GET /v1/assets/:task_id`**

| 参数名 | 位置 | 必填 | 含义 |
|--------|------|------|------|
| `task_id` | Path | 是 | 提交返回的 **公开** 任务 ID |

服务端周期性以 `POST /v2/asset/status`（body: `{"asset_id":"<上游ID>"}`）轮询上游；客户端只需轮询本 GET。

#### 成功响应 HTTP 200 — Body

| 字段名 | 类型 | 含义 |
|--------|------|------|
| `object` | string | `pingxingshijie.asset.task` |
| `id` | string | 公开任务 ID |
| `task_id` | string | 同 `id` |
| `status` | string | 内部任务状态枚举字符串，如 `QUEUED`、`IN_PROGRESS`、`SUCCESS`、`FAILURE` 等 |
| `progress` | string | 如 `50%`、`100%` |
| `created_at` | number | 秒 |
| `updated_at` | number | 秒 |
| `data` | object | 最近一次上游 **envelope 内层 data** 快照（含 `Result.Status`、`Result.URL` 等，字段名与上游一致） |
| `fail_reason` | string | 失败原因（若有） |

**上游 `Result.Status` 语义（轮询侧）**：`Processing` → 进行中；`Active` → 成功可用；`Failed` → 失败（详见上游文档）。

---

## 5. 内部任务状态与对外 `status` 映射（摘要）

| 内部 `TaskStatus` | 视频/图片 GET 中 `status`（`ToVideoStatus`） |
|-------------------|-----------------------------------------------|
| `QUEUED` / `SUBMITTED` | `queued` |
| `IN_PROGRESS` | `in_progress` |
| `SUCCESS` | `completed` |
| `FAILURE` | `failed` |
| 其它 | `unknown` |

素材 GET 的 `status` 字段为 **内部枚举字符串**，与上表不完全相同，请以 **4.2** 为准。

---

## 6. curl 示例（最佳实践）

```bash
export GATEWAY='https://your-new-api.example.com'
export TOKEN='your-token'

# 视频提交
curl -sS -X POST "${GATEWAY}/v1/video/generations" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"model":"doubao-seedance-2-0-fast-260128","prompt":"Hello","metadata":{"resolution":"720p","ratio":"16:9"}}'

# 视频查询（TASK_ID 为返回的 id/task_id）
curl -sS "${GATEWAY}/v1/video/generations/${TASK_ID}" -H "Authorization: Bearer ${TOKEN}"

# 图片异步提交
curl -sS -X POST "${GATEWAY}/v1/images/generations/async" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"model":"doubao-seedream-4-0-250828","prompt":"A red mug","size":"2K","output_format":"png","watermark":false}'

# 素材上传
curl -sS -X POST "${GATEWAY}/v1/assets/upload" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
-d '{"model":"pingxingshijie-asset","image_url":"https://example.com/a.jpg","asset_type":"Image"}'
```

---

## 7. 路径一览

| 能力 | 方法 | 路径 |
|------|------|------|
| 视频提交 | POST | `/v1/video/generations` |
| 视频查询 | GET | `/v1/video/generations/:task_id` |
| 视频（OpenAI 形） | POST/GET | `/v1/videos`、`/v1/videos/:task_id` |
| 视频 Remix | POST | `/v1/videos/:video_id/remix` |
| 图片异步提交 | POST | `/v1/images/generations/async` |
| 图片异步查询 | GET | `/v1/images/generations/:task_id` |
| 素材上传 | POST | `/v1/assets/upload` |
| 素材查询 | GET | `/v1/assets/:task_id` |
| 视频内容代理 | GET | `/v1/videos/:task_id/content`（`TokenOrUserAuth`，见 `video-router`） |

---

**文档版本**：与网关实现 `relay/channel/task/pingxingshijie`、`router/video-router.go` 同步；若行为变更，请以代码为准并更新本文档。
