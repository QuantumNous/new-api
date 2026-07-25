# new-api 视频生成 API

> 本文档**完全依据代码生成**，是 new-api 视频接口的权威说明。
> 关联代码：`router/video-router.go`、`controller/relay.go`(`RelayTask`/`RelayTaskFetch`)、`relay/relay_task.go`、`relay/common/relay_info.go`(`TaskSubmitReq`)、`dto/openai_video.go`(`OpenAIVideo`)、`relay/channel/task/*`(各渠道适配器)。
>
> ⚠️ 仓库内 `docs/openapi/relay.json` 的视频部分是泛化占位示例（含 `width`/`height` 等代码里不存在的字段），`docs/api/flatkey-video-api.md` 是早期 kuaizi 渠道专用、与官方差异大。**两者均不可作为契约依据，以本文档为准。**

---

## 1. 总体模型：提交 → 轮询 → 下载

所有视频渠道都是**异步任务**：客户端先 `POST` 提交任务，拿到统一的任务 ID（`task_xxxx`），再 `GET` 轮询状态，成功后从结果 URL 或代理接口取视频。

```
POST /v1/video/generations        →  { "id": "task_xxx", "status": "queued", ... }
GET  /v1/video/generations/{id}   →  { "status": "in_progress" | "completed" | "failed", ... }
                                       成功后视频地址在 metadata.url，或经 /v1/videos/{id}/content 代理下载
```

关键机制（`relay/relay_task.go`）：
- **任务 ID 隔离**：返回给客户端的永远是 `task_` + 32 位随机字符（`model.GenerateTaskID`），上游真实任务 ID 保存在服务端 `task.PrivateData.UpstreamTaskID`，不外泄。
- **提交即全额预扣费**：异步任务在提交前锁定全额配额（`info.ForcePreConsume = true`），任务失败再退。
- **白标渠道**（如 kuaizi）：结果 URL 不直接返回，必须经 `/v1/videos/{id}/content` 代理；错误信息经品牌脱敏（`taskcommon.ScrubBrandedText`）。

---

## 2. 认证

所有接口需在请求头携带令牌（new-api 的 API Key）：

```
Authorization: Bearer sk-xxxxxxxx
```

> 上游渠道各自的鉴权（火山 Bearer、Kling JWT、即梦 HMAC 签名、Vertex 服务账号、kuaizi 的 `ApiKey` 头等）由 new-api 在服务端处理，**客户端只需用 new-api 令牌**。
>
> **例外**：视频下载代理 `GET /v1/videos/{task_id}/content` 为**匿名**接口（不需要令牌）——不可猜的 `task_id` 即访问凭证（详见 §7）。

---

## 3. 路由总览（`router/video-router.go`）

| 方法 & 路径 | 用途 | Handler |
|---|---|---|
| `POST /v1/video/generations` | 创建视频任务（通用） | `RelayTask` |
| `GET /v1/video/generations/:task_id` | 查询任务状态（通用） | `RelayTaskFetch` |
| `POST /v1/videos` | 创建视频任务（OpenAI/Sora 兼容） | `RelayTask` |
| `GET /v1/videos/:task_id` | 查询任务（OpenAI/Sora 兼容） | `RelayTaskFetch` |
| `POST /v1/videos/:video_id/remix` | Sora 重混（remix） | `RelayTask` |
| `GET /v1/videos/:task_id/content` | 代理下载视频二进制（白标必经） | `VideoProxy` |
| `POST /kling/v1/videos/text2video` | Kling 原生文生视频 | 经 `KlingRequestConvert` |
| `POST /kling/v1/videos/image2video` | Kling 原生图生视频 | 经 `KlingRequestConvert` |
| `GET /kling/v1/videos/{text2video,image2video}/:task_id` | Kling 原生查询 | `RelayTaskFetch` |
| `POST /jimeng/?Action=CVSync2AsyncSubmitTask` | 即梦原生提交 | 经 `JimengRequestConvert` |
| `POST /jimeng/?Action=CVSync2AsyncGetResult` | 即梦原生查询 | 经 `JimengRequestConvert` |

> `/kling/...` 与 `/jimeng/...` 是兼容上游原生协议的入口：中间件把原生 JSON 整体塞进 `metadata`，再改写到统一的 `/v1/video/generations`。**推荐统一用 `/v1/video/generations`**，原生入口仅为兼容已有客户端。

---

## 4. 统一请求体（`TaskSubmitReq`，`relay/common/relay_info.go:689`）

`POST /v1/video/generations` 接受的通用字段。**渠道专属参数一律放进 `metadata`**（适配器通过 `taskcommon.UnmarshalMetadata` 把 metadata 按各自上游字段名解出来；`metadata.model` 会被删除以防绕过计费）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `prompt` | string | 提示词，**必填** |
| `model` | string | 模型名（见各渠道模型列表） |
| `mode` | string | 模式（Kling 用：`std`/`pro`） |
| `image` | string | 单张输入图（图生视频；URL 或 base64） |
| `images` | []string | 多张输入图 |
| `size` | string | 分辨率/尺寸（语义随渠道，见下） |
| `duration` | int | 时长（秒），整数 |
| `seconds` | string | 时长（秒），字符串形式（OpenAI 风格；doubao/sora 用） |
| `input_reference` | string | Sora 参考图字段；也用于 multipart 文件上传字段名 |
| `metadata` | object | 渠道专属参数容器 |

也支持 `multipart/form-data`（上传图片/视频文件，如 Sora、即梦的 `input_reference` 文件）。

---

## 5. 统一响应体（`OpenAIVideo`，`dto/openai_video.go:16`）

提交和查询都返回该结构：

```json
{
  "id": "task_abc123...",
  "task_id": "task_abc123...",
  "object": "video",
  "model": "doubao-seedance-2-0-260128",
  "status": "queued",
  "progress": 0,
  "created_at": 1730000000,
  "completed_at": 0,
  "seconds": "5",
  "size": "1080p",
  "error": null,
  "metadata": { "url": "https://.../result.mp4" }
}
```

**状态枚举**（`status` 字段，`dto/openai_video.go:8`）：

| 值 | 含义 |
|---|---|
| `queued` | 排队中 |
| `in_progress` | 生成中 |
| `completed` | 已完成（视频地址在 `metadata.url`） |
| `failed` | 失败（详情在 `error.{message,code}`） |
| `unknown` | 未知 |

- **取视频**：成功后读 `metadata.url`；白标渠道该值是 `…/v1/videos/{task_id}/content` 代理地址。
- `progress` 为 0–100 整数；`error` 仅失败时存在。

---

## 6. 各渠道契约（按代码核实）

> 表中“metadata 键”即在统一请求的 `metadata` 对象里可填的字段；适配器会映射到对应上游字段。

### 6.1 豆包 / Seedance（火山引擎）

- **渠道类型**：`DoubaoVideo`(54)、`VolcEngine`(45) — 适配器 `relay/channel/task/doubao/adaptor.go`
- **默认 BaseURL**：`https://ark.cn-beijing.volces.com`（可在渠道配置覆盖为中转站地址）
- **上游提交**：`POST {baseURL}/api/v3/contents/generations/tasks`
- **上游查询**：`GET {baseURL}/api/v3/contents/generations/tasks/{id}`
- **鉴权**：`Authorization: Bearer <key>`
- **模型**：`doubao-seedance-1-0-pro-250528`、`doubao-seedance-1-0-lite-t2v`、`doubao-seedance-1-0-lite-i2v`、`doubao-seedance-1-5-pro-251215`、`doubao-seedance-2-0-260128`、`doubao-seedance-2-0-fast-260128`（另 `volcengine/constants.go` 含 `seedance-1-0-pro-250528`）
- **输入图**：`images` 数组 → 转为上游 `content` 的 `image_url` 条目
- **时长**：`seconds`（字符串）→ 上游 `duration`
- **metadata 键**（映射到火山字段，均可选）：`resolution`、`ratio`、`frames`、`seed`、`camera_fixed`(bool)、`watermark`(bool)、`return_last_frame`(bool)、`service_tier`、`generate_audio`(bool)、`draft`(bool)、`tools`、`execution_expires_after`、`callback_url`
- **上游状态映射**：`pending`/`queued`→queued，`processing`/`running`→in_progress，`succeeded`→completed，`failed`→failed；结果 URL 来自上游 `content.video_url`

**示例：**
```bash
curl https://你的服务/v1/video/generations \
  -H "Authorization: Bearer sk-xxx" -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2-0-260128",
    "prompt": "宇航员在月球漫步，电影感，镜头缓慢推近",
    "seconds": "5",
    "metadata": { "resolution": "1080p", "ratio": "16:9", "watermark": false }
  }'
```

### 6.2 可灵 Kling（快手）

- **渠道类型**：`Kling`(50) — `relay/channel/task/kling/adaptor.go`
- **默认 BaseURL**：`https://api.klingai.com`
- **上游提交**：`POST {baseURL}/v1/videos/text2video`（文生）或 `/v1/videos/image2video`（图生，有 `image` 时）；经 new-api 中转(key 以 `sk-` 开头)时路径前缀加 `/kling`
- **上游查询**：`GET {baseURL}[/kling]/v1/videos/{text2video|image2video}/{id}`
- **鉴权**：JWT（HS256）。Key 格式 `accessKey|secretKey`，服务端签发 `iss/exp/nbf` 令牌；若 key 以 `sk-` 开头则直接透传
- **模型**：`kling-v1`、`kling-v1-6`、`kling-v2-master`
- **字段映射**：`prompt`→prompt；`image`(取 images 首张)→image；`mode`→mode(默认 `std`)；`duration`(int)→duration(字符串，默认 5)；`size`→`aspect_ratio`（`1024x1024`→`1:1`、`1280x720`→`16:9`、`720x1280`→`9:16`）；`cfg_scale` 固定 0.5
- **metadata 键**（可选）：`negative_prompt`、`image_tail`、`static_mask`、`dynamic_masks`、`camera_control`、`callback_url`、`external_task_id`
- **上游状态映射**：`submitted`→submitted，`processing`→in_progress，`succeed`→completed，`failed`→failed；结果 URL 来自 `data.task_result.videos[0].url`

### 6.3 即梦 Jimeng

- **渠道类型**：`Jimeng`(51) — `relay/channel/task/jimeng/adaptor.go`
- **上游提交**：`POST {baseURL}[/jimeng]/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31`
- **上游查询**：`Action=CVSync2AsyncGetResult&Version=2022-08-31`
- **鉴权**：key 以 `sk-` 开头→`Bearer`；否则 `accessKey|secretKey` 走 HMAC-SHA256（AWS V4 风格）签名
- **模型**：`jimeng_vgfm_t2v_l20`（`req_key`；`jimeng_v30` 系列会按图片数自动改写为 `jimeng_t2v_v30`/`jimeng_i2v_first_v30`/`jimeng_i2v_first_tail_v30`/`jimeng_ti2v_v30_pro`）
- **字段映射**：`prompt`→prompt；`images[0]` 为 URL→`image_urls`，为 base64→`binary_data_base64`；`duration`=10→241帧、否则121帧(24fps)
- **metadata 键**（可选）：`seed`(int64)、`aspect_ratio`(string)
- **上游状态映射**：`in_queue`→queued，`done`→completed，成功码 `code==10000`否则 failed；结果 URL 来自 `data.video_url`
- **文件上传**：multipart 字段 `input_reference`（单文件→普通图生，多文件→首尾帧），上限 4.7 MB，自动转 base64

### 6.4 Sora（OpenAI 视频）

- **渠道类型**：`Sora`(55)、`OpenAI`(1) — `relay/channel/task/sora/adaptor.go`
- **上游提交**：`POST {baseURL}/v1/videos`；remix 为 `POST {baseURL}/v1/videos/{originId}/remix`
- **上游查询**：`GET {baseURL}/v1/videos/{id}`
- **鉴权**：`Authorization: Bearer <key>`
- **模型**：`sora-2`、`sora-2-pro`
- **字段**：透传 `prompt`/`size`/`seconds`/`duration`/`input_reference`/`image`/`images`/`metadata`（`model` 必被替换为上游名）；`size` 默认 `720x1280`（sora-2 支持 `720x1280`/`1280x720`；sora-2-pro 另支持 `1792x1024`/`1024x1792`）；`duration`/`seconds` 归一为秒
- **支持 multipart**（上传参考图/视频）
- **上游状态映射**：`queued`/`pending`→queued，`processing`/`in_progress`→in_progress，`completed`→completed，`failed`/`cancelled`→failed
- **取视频**：完成后 URL 留空，由 new-api 构造代理地址 `/v1/videos/{task_id}/content`
- **remix**：仅需 `prompt`，不重复预估计费

### 6.5 Vidu

- **渠道类型**：`Vidu`(52) — `relay/channel/task/vidu/adaptor.go`
- **上游提交**：`POST {baseURL}/ent/v2/{text2video|img2video|start-end2video|reference2video}`（按图片数自动选择：0 张文生、1 张图生、2 张首尾帧、≥3 张参考帧；也可用 `metadata.action` 指定）
- **上游查询**：`GET {baseURL}/ent/v2/tasks/{id}/creations`
- **鉴权**：`Authorization: Token <key>`
- **模型**：`viduq2`、`viduq1`、`vidu2.0`、`vidu1.5`（默认 `viduq1`）
- **字段映射**：`images`→images；`prompt`→prompt；`duration`(默认 5)；`size`→`resolution`(默认 `1080p`)；`movement_amplitude` 固定 `auto`、`bgm` 固定 false
- **metadata 键**（可选）：`seed`(int)、`payload`(string)、`callback_url`、`bgm`(bool)、`movement_amplitude`
- **上游状态映射**：`created`/`queueing`→submitted，`processing`→in_progress，`success`→completed，`failed`→failed；结果 URL 来自 `creations[0].url`

### 6.6 海螺 / MiniMax Hailuo

- **渠道类型**：`MiniMax`(35) — `relay/channel/task/hailuo/adaptor.go`
- **上游提交**：`POST {baseURL}/v1/video_generation`
- **上游查询**：`GET {baseURL}/v1/query/video_generation?task_id={id}`；结果再经 `/v1/files/retrieve?file_id=` 取下载地址
- **鉴权**：`Authorization: Bearer <key>`
- **模型**：`MiniMax-Hailuo-2.3`、`MiniMax-Hailuo-2.3-Fast`、`MiniMax-Hailuo-02`、`T2V-01-Director`、`T2V-01`、`I2V-01-Director`、`I2V-01-live`、`I2V-01`、`S2V-01`
- **字段映射**：`prompt`→prompt；`duration`(默认 6)；`size`→`resolution`
- **metadata 键**（可选）：`prompt_optimizer`(bool)、`fast_pretreatment`(bool)、`callback_url`、`aigc_watermark`(bool)、`first_frame_image`、`last_frame_image`、`subject_reference`(数组，含 `type`/`image`)
- **上游状态映射**：`Preparing`/`Queueing`→in_progress(30%)，`Processing`→in_progress(50%)，`Success`→completed，`Fail`→failed

### 6.7 Google Veo（Gemini / Vertex）

公用 `instances[].prompt` + `parameters` 结构（`relay/channel/task/gemini/dto.go`）。两个渠道模型相同：`veo-3.0-generate-001`、`veo-3.0-fast-generate-001`、`veo-3.1-generate-preview`、`veo-3.1-fast-generate-preview`。

| 维度 | Gemini（渠道 `Gemini`/24） | Vertex（渠道 `VertexAI`） |
|---|---|---|
| 提交 URL | `{baseURL}/{ver}/models/{model}:predictLongRunning` | `…/projects/{proj}/locations/{region}/publishers/google/models/{model}:predictLongRunning` |
| 鉴权 | `x-goog-api-key: <key>` | 服务账号 JWT → `Authorization: Bearer`，加 `x-goog-user-project` |
| 轮询 | `GET {操作名}` | `POST …:fetchPredictOperation`，body `{operationName}` |
| 结果 | URI：`response.generateVideoResponse.generatedVideos[0].video.uri` | base64 内嵌：`response.videos[0].bytesBase64Encoded` → data URI |

- **字段映射**：`prompt`→`instances[].prompt`；`images[0]`/上传文件→`instances[].image{bytesBase64Encoded,mimeType}`；`duration`→`parameters.durationSeconds`；`size`→`resolution`/`aspectRatio`
- **metadata 键**（可选）：`durationSeconds`、`resolution`、`aspectRatio`、`negativePrompt`、`personGeneration`、`storageUri`、`compressionQuality`、`resizeMode`、`seed`、`generateAudio`(bool)
- **状态**：上游 `done==true` 且无 error→completed，有 error→failed，否则 in_progress

### 6.8 kuaizi 立臻（白标渠道）

- **渠道类型**：`KuaiziLizhen` — `relay/channel/task/kuaizi/adaptor.go`
- **上游提交**：`POST {baseURL}/create`；查询 `POST {baseURL}/status`，body `{"task_id":"..."}`
- **鉴权**：`ApiKey: <key>` 请求头（**非** Bearer）
- **模型**：`kuaizi-lizhen-fast`、`kuaizi-lizhen-pro`（`mode` 映射为 `fast`/`pro`）
- **请求字段**（`generation_type` 固定 `video`）：`prompt`、`images`/`videos`/`audios`、`resolution`、`ratio`、`duration`(秒)、`generate_audio`(bool)、`seed`、`web_search`(bool)；metadata 可整体覆盖
- **上游状态映射**：`running`→in_progress，`succeeded`→completed，`failed`→failed
- **白标约束**：结果 URL **不返回真实上游地址**，`metadata.url` 为代理路径 `/v1/videos/{task_id}/content`；错误信息经 `ScrubBrandedText` 脱敏（屏蔽 `kuaizi`/`lizhen`/`volces`/`bytedance` 等品牌词）

### 6.9 BlockRunVideo（白标渠道，对接 api2/blockrun）

- **渠道类型**：`BlockRunVideo`(101) — `relay/channel/task/blockrunvideo/adaptor.go`
- **默认 BaseURL**：`https://api2.flatkey.ai`（api2 是 BlockRun 的 OpenAI 风格代理；生成的视频实际托管在 `blockrun.ai`）
- **上游提交**：`POST {baseURL}/v1/video/generations`；查询 `GET {baseURL}/v1/video/generations/{id}`
- **鉴权**：`Authorization: Bearer <key>`
- **模型**：`bytedance/seedance-2.0`、`bytedance/seedance-2.0-fast`（后台可手动增删；价格在「模型定价」设置）
- **请求字段**（客户端入参,均为顶层字段）：`model`、`prompt`、`duration`(秒,int)、`resolution`、`ratio`、`images`(图生视频取 `images[0]` → 上游 `image_url`)。适配器映射到上游 `model`/`prompt`/`seconds`/`resolution`/`ratio`/`image_url`。注意：上游代理**不转发** `watermark`/`seed`/`generateAudio`/`returnLastFrame`/`realFaceAssetId`/`budgetMs`，故不发送
- **响应**：`error` 为**字符串**（非对象）；上游状态 `queued`→queued，`in_progress`→in_progress，`completed`→completed（视频地址在顶层 `url`，回退 `data[0].url`），`failed`/查不到任务→failed
- **计费**：按次（嵌 `BaseBilling`）—— 提交全额预扣，`completed` 保留、`failed`/超时退款（api2 失败时上游也 "No payment was taken"，两边一致）
- **白标约束**：`metadata.url` 返回代理路径 `/v1/videos/{task_id}/content`，**绝不暴露 blockrun.ai 真实地址**；真实地址留在 `task.Data`，由 `controller.VideoProxy` 经 `ExtractUpstreamVideoURL` 在服务端取回；失败信息经 `ScrubBrandedText` 脱敏（品牌词含 `blockrun`/`flatkey`/`bytedance` 等）
- **取视频**：`/v1/videos/{task_id}/content` **全局匿名**可取（见 §7）；服务端拉取 blockrun.ai 直链时不带鉴权头（该直链为公开/预签名地址）

### 6.10 xAI Grok Imagine 视频（白标渠道）

- **渠道类型**：`XaiGrokVideo`(108) — `relay/channel/task/xaigrok/adaptor.go`
- **默认 BaseURL**：`https://api.x.ai`（走 xAI 开发者 API，非订阅）
- **上游提交**：`POST {baseURL}/v1/videos/generations`，body `{"model":"grok-imagine-video-1.5","prompt":"...","image":{"url":"..."},"duration":6}` → `{"request_id":"..."}`
- **上游查询**：`GET {baseURL}/v1/videos/{request_id}` → `{"status":"pending|done|failed|expired","video":{"url":"..."}}`
- **鉴权**：`Authorization: Bearer <key>`
- **模型**：`grok-imagine-video`、`grok-imagine-video-1.5`
- **请求字段**：`prompt`（必填）→prompt；`image`/`images[0]`/`input_reference`（图生视频）→ 上游 `image.url`（含 SSRF 校验 `ValidateRemoteMediaURL`）；`duration`/`seconds`（秒，1–15，超范围直接 400）→duration
- **上游状态映射**：`done`/`completed`/`succeeded`→completed，`failed`/`expired`/`cancelled`→failed，其余→in_progress
- **计费**：**按秒**——`ModelPrice` 为每秒 USD 单价（`grok-imagine-video` 0.09、`grok-imagine-video-1.5` 0.11），`EstimateBilling` 返回 `{"seconds": 时长}`，最终额度 = 单价 × 秒数 × 组倍率；客户端省略时长时按 5 秒预扣（`defaultBillingSeconds`）。上游成本 $0.05/s（480p）–$0.07/s（720p）
- **白标约束**：`metadata.url` 返回代理路径 `/v1/videos/{task_id}/content`，**绝不暴露 `vidgen.x.ai` 真实地址**；真实地址留在 `task.Data`，由 `controller.VideoProxy` 经 `ExtractUpstreamVideoURL` 服务端取回；失败信息经 `ScrubBrandedText` 脱敏（品牌词含 `xai`/`grok`/`x.ai`/`vidgen.x.ai`）；公开任务 ID 为 `task_xxxx`，不透传上游 `request_id`
- **取视频**：`/v1/videos/{task_id}/content` **全局匿名**可取（见 §7）；服务端拉取 `vidgen.x.ai` 直链时不带鉴权头（该直链为公开/预签名地址，已实测 HTTP 200 免鉴权）

---

## 7. 视频代理下载（`GET /v1/videos/{task_id}/content`）

`controller/video_proxy.go`：**全局匿名可取**（免鉴权）——不可猜的 32 位随机 `task_id` 即访问凭证，代理地址可直接 `<video src>` 内嵌。用任务 ID 查任务（带令牌/会话时按 user 限定，否则 `GetByOnlyTaskId` 仅按 task_id 查）→ 仅当任务成功才放行 → 服务端从上游真实 URL 拉取视频（带 SSRF 防护）→ 以二进制 `video/mp4` 流式回传，设 `Cache-Control: public, max-age=86400`。客户端始终看不到上游域名。

> ⚠️ 部署提示：若开启了 SSRF 域名白名单(`DomainFilterMode`)，需把 `blockrun.ai`（及各上游视频直链域名）加入白名单，否则代理下载会被 403 拦截。

---

## 8. 错误响应

失败时统一返回（任务级错误在 `OpenAIVideo.error`）：

```json
{ "status": "failed", "error": { "message": "…", "code": "…" } }
```

提交阶段的请求/计费错误走标准 relay 错误体（`{"error":{"message","type","code"}}`），如配额不足、参数缺失（`prompt` 必填）、上游非 2xx（`bad_response_status_code`）等。

---

## 附：代码索引

| 主题 | 位置 |
|---|---|
| 路由 | `router/video-router.go` |
| 提交/查询入口 | `controller/relay.go` `RelayTask`/`RelayTaskFetch`；`relay/relay_task.go` |
| 统一请求体 | `relay/common/relay_info.go:689` `TaskSubmitReq` |
| 统一响应体 | `dto/openai_video.go` `OpenAIVideo` |
| metadata 解析 | `relay/channel/task/taskcommon/helpers.go` `UnmarshalMetadata` |
| 渠道适配器 | `relay/channel/task/{doubao,kling,jimeng,sora,vidu,hailuo,gemini,vertex,kuaizi}/adaptor.go` |
| 代理下载 | `controller/video_proxy.go` `VideoProxy` |
| 渠道默认 BaseURL | `constant/channel.go` `ChannelBaseURLs` |
