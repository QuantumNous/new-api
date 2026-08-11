# Mao（catertx）Seedance 自适应分辨率视频渠道设计

日期：2026-08-11  
状态：已确认设计，待实现

## 1. 背景与目标

上游厂商（catertx）的 Doubao Seedance 系列按分辨率拆成多个模型 ID（如 `sd-2-0-480p` / `sd-2-0-720p` / …）。平台希望对外只暴露 3 个逻辑模型，由适配器按请求分辨率自动选择上游模型。

**对外逻辑模型：**

| 逻辑模型 | 对应上游系列 |
|----------|--------------|
| `guanzhuan-seedance2.0` | Seedance 2.0 |
| `guanzhuan-seedance2.0-mini` | Seedance 2.0 Mini |
| `guanzhuan-seedance2.5` | Seedance 2.5 |

**渠道命名：** `mao`  
**渠道类型 ID：** `ChannelTypeMao = 68`  
**默认 Base URL：** `https://api.catertx.com`

## 2. 上游 API 结论

鉴权：`Authorization: Bearer <API_KEY>`  
协议形态：`/v1/video/generations`（与 7tai / Doubao OpenAI 兼容路径同类）

| 接口 | 方法 | 路径 |
|------|------|------|
| 创建任务 | POST | `/v1/video/generations` |
| 查询任务 | GET | `/v1/video/generations/{task_id}` |

### 2.1 上游模型 ID（按系列）

**Seedance 2.0：** `sd-2-0-480p` / `sd-2-0-720p` / `sd-2-0-1080p` / `sd-2-0-4k`  
能力：文生视频、首尾帧、多张参考图、参考视频、参考音频。

**Seedance 2.0 Mini：** `sd-2-0-mini-480p` / `sd-2-0-mini-720p`  
能力：文生视频、单张首帧、首尾帧、多模态参考；时长 4～15 秒；**不接收** `metadata.camera_fixed`。

**Seedance 2.5：** `sd-2-5-480p` / `sd-2-5-720p`  
能力接近 2.0；最大时长 30 秒；**仅** 480p / 720p（不支持 1080p / 4k，平台不做静默降级）。

### 2.2 上游扩展参数（metadata）

| 字段 | 类型 | 说明 |
|------|------|------|
| `metadata.generate_audio` | boolean | 是否生成同步音频 |
| `metadata.camera_fixed` | boolean | 固定镜头；**仅 2.0 / 2.5**；mini 禁止传入 |
| `metadata.watermark` | boolean | 是否水印 |
| `metadata.execution_expires_after` | integer | 任务超时，3600～259200 秒 |
| `metadata.video_contain_person` | boolean | 参考视频含真人时为 true；由 catertx 网关识别，不转发上游生成接口 |
| `metadata.reference_images` | string[] | 多模态参考图（URL / Data URL / Base64） |

参考视频 / 音频必须公网 HTTP(S) URL，不能用 Base64 视频。

## 3. 选定方案

在 `mao` TaskAdaptor 内做 **逻辑模型 + 分辨率 → 上游模型 ID** 的自适应映射（方案 1）。

不采用：

- 渠道 `model_mapping` 静态罗列全部带后缀 ID（用户体验差）
- 抽通用分辨率路由框架（超出本次范围）

参考实现：`relay/channel/task/task7tai/`（`/v1/video/generations`）、分辨率归一化可参考 `megabyai` / `zzdh` 的解析习惯。

## 4. 分辨率自适应映射

### 4.1 分辨率解析顺序

1. `resolution`（如 `720p`、`1080p`、`4k`）
2. 若无，再读 `size`（支持 `720p` 或 `1280x720` / `1920x1080` 等，归一到档位）
3. 都没有 → 默认 **`720p`**

归一化档位集合：`480p` / `720p` / `1080p` / `4k`（大小写不敏感；`4K` → `4k`）。

### 4.2 映射表

| 逻辑模型 | 480p | 720p | 1080p | 4k |
|----------|------|------|-------|-----|
| `guanzhuan-seedance2.0` | `sd-2-0-480p` | `sd-2-0-720p` | `sd-2-0-1080p` | `sd-2-0-4k` |
| `guanzhuan-seedance2.0-mini` | `sd-2-0-mini-480p` | `sd-2-0-mini-720p` | ❌ | ❌ |
| `guanzhuan-seedance2.5` | `sd-2-5-480p` | `sd-2-5-720p` | ❌ | ❌ |

### 4.3 校验（本地，不打上游）

- 未知逻辑模型 → 400
- 档位不在该系列白名单 → 400，错误信息列出支持档位
- **不做** 不支持档位的静默降级（例如 2.5 + 1080p 直接报错）
- 上游请求体使用改写后的模型 ID；对外响应 / 日志中的客户端模型仍为逻辑名（`OriginModelName`）

### 4.4 时长校验（初版）

| 系列 | 时长 |
|------|------|
| mini | 4～15 秒 |
| 2.0 | 按上游；缺省预扣用平台默认（通常 15） |
| 2.5 | 最长 30 秒；缺省预扣同上 |

超出范围 → 400。

## 5. 请求体构造与字段透传

创建 URL：`{ChannelBaseUrl 规范化后}/v1/video/generations`  
（Base URL 若已带 `/v1` 或完整 path，需像 7tai 一样 strip 后再拼，避免重复。）

| 平台字段 | 上游字段 | 说明 |
|----------|----------|------|
| 映射后 model | `model` | 如 `sd-2-0-1080p` |
| prompt | `prompt` | |
| duration / seconds | `duration` | 整数秒 |
| ratio / aspect_ratio | `ratio` | 如 `16:9` |
| seed | `seed` | 可选 |
| image | `image` | 首帧 |
| last_frame | `last_frame` | 尾帧 |
| videos | `videos` | 参考视频 URL 数组 |
| audios | `audios` | 参考音频 URL 数组 |
| n | `n` | 透传 |
| response_format | `response_format` | 缺省 `url` |
| metadata / 顶层 generate_audio 等 | `metadata` | 见下 |

**关键：** `resolution` / `size` **仅用于选模型**，不原样写入上游 body（上游靠模型名区分分辨率）。

### 5.1 metadata 规则

- 透传：`generate_audio`、`watermark`、`execution_expires_after`、`reference_images`、`video_contain_person`
- `camera_fixed`：仅逻辑模型为 **2.0 / 2.5** 时透传；**mini 丢弃**（避免上游拒收）
- 顶层 `generate_audio` 若存在，合并进 `metadata.generate_audio`

## 6. 创建响应与轮询

### 6.1 创建

- 从上游响应解析 `task_id`（兼容 `task_id` / `data.task_id` / `id` / `data.id`）
- 对外返回 OpenAI Video 形态：`id` = 本站 `PublicTaskID`，`status=queued`，`model` = 逻辑名
- 上游 `queued` 仅表示接收成功，最终结果靠 GET 查询

### 6.2 查询

`GET {base}/v1/video/generations/{upstream_task_id}`

状态映射：

| 上游 status（示意） | 本站 |
|---------------------|------|
| `queued` / `pending` / `submitted` / `preparing_reference_video` / `processing_reference_video` / `submitting` / `processing` / `running` / `in_progress` | 进行中 |
| `success` / `completed` / `succeeded` | 成功（需有视频 URL） |
| `failed` / `failure` / `error` / `cancelled` | 失败 |

视频 URL 兼容解析常见路径：`data.result_url` / `data.video_url` / `video_url` / `url` / `data.url` 等。

失败原因兼容：`fail_reason` / `message` / `error.message` 等。

## 7. 计费

- 模式：`per_second` + 分辨率档位倍率（与现有 Seedance 类渠道一致）
- `EstimateBilling`：按请求时长预扣；缺省用 `taskcommon.DefaultPerSecondPrechargeSeconds`
- 分辨率档位经现有 `NormalizeResolutionTier` → `480p` / `720p` / `1080p` / `4k`
- `AdjustBillingOnComplete`：成功后按上游实际 duration 结算（若响应可解析）

后台需将三个逻辑模型配置为 `per_second`，并配置各分辨率倍率；本设计不写入具体价格数字。

## 8. 非目标

- 不改 7tai / Doubao / megabyai / zzdh 等现有渠道行为
- 不抽通用「逻辑模型→分辨率上游 ID」框架
- 不做 remix / 取消任务专用接口
- 文档与代码中不落真实卡密
- 不强制 `/content` 鉴权代理（成片若为公网 URL 直接透传；若后续发现需鉴权再单独立项）

## 9. 代码落点

| 区域 | 变更 |
|------|------|
| `constant/channel.go` | `ChannelTypeMao = 68`、名称、默认 Base URL；保持 `ChannelTypeDummy` 在最后 |
| `relay/channel/task/mao/` | 适配器：`adaptor.go`、`constants.go`、分辨率映射、payload 构造、轮询解析、单测 |
| `relay/relay_adaptor.go` | `GetTaskAdaptor` 注册 |
| `web/default` 渠道常量 / 类型配置 / 图标 | 渠道选项 |
| `web/classic` `CHANNEL_OPTIONS` + EditChannel 默认模型 | 经典主题对等 |

建议包内拆分：

- `constants.go` — ChannelName、ModelList、映射表
- `resolve.go` — 分辨率归一化、`resolveUpstreamModel(logic, tier)`
- `adaptor.go` — TaskAdaptor 实现
- `parse.go` — 创建 / 查询响应解析
- `*_test.go` — 映射表、不支持档位报错、mini 丢弃 camera_fixed、状态解析

## 10. 测试要点

- 默认分辨率：无 `resolution`/`size` → `720p` → 正确上游 ID
- 优先 `resolution`：同时有 `resolution=1080p` 与 `size=720p` → 走 1080p
- `size=1920x1080` → `1080p`
- mini / 2.5 + `1080p`/`4k` → 400
- 2.0 + `4k` → `sd-2-0-4k`
- mini 请求含 `camera_fixed` → 上游 body 无该字段
- 创建响应缺 task_id → 明确错误
- 轮询 `preparing_reference_video` → 进行中；completed + url → 成功

## 11. 示例（客户端 → 上游）

客户端：

```json
{
  "model": "guanzhuan-seedance2.0",
  "prompt": "电影级航拍",
  "duration": 10,
  "ratio": "16:9",
  "resolution": "1080p",
  "metadata": {
    "generate_audio": false,
    "watermark": false
  }
}
```

发往上游：

```json
{
  "model": "sd-2-0-1080p",
  "prompt": "电影级航拍",
  "duration": 10,
  "ratio": "16:9",
  "response_format": "url",
  "metadata": {
    "generate_audio": false,
    "watermark": false
  }
}
```
