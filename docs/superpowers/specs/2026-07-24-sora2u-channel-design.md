# Sora2U 异步视频渠道设计

日期：2026-07-24  
状态：已确认设计；实现计划见 `docs/superpowers/specs/2026-07-24-sora2u-channel-plan.md`

## 1. 背景与目标

将第三方站点 [Sora2U](https://sora2u.com) 作为独立上游渠道接入 new-api。  
上游实际能力为字节跳动 Seedance 系视频生成；Sora2U 自有 API 形态与 OpenAI Videos **不兼容**（响应包在 `{ success, task }` 下，成片为公开 `video_url`），故不能复用现有 `ChannelTypeSora` 直连，需独立 adaptor。

### 已确认产品决策

| 项 | 决策 |
|----|------|
| 对外接口 | OpenAI Videos：`POST/GET /v1/videos` |
| 能力范围 | 文生视频 + 参考素材（图/视频/音频） |
| 渠道余额 | 不对接 `GET /api/v1/credits` |
| 取消任务 | 首版不调上游 `DELETE` |
| remix | 不支持 |
| 图片生成模型 | 首版不做（`gemini-image` / `kontext-image`） |
| 模型列表同步 | 不做 `GET /api/v1/models` 自动同步 |

## 2. 上游 API 摘要

- Base URL：`https://sora2u.com`
- 鉴权：`Authorization: Bearer <sk_sora_...>`（上游亦支持 `x-api-key`；本渠道只用 Bearer）
- 创建成功 HTTP：**202 Accepted**（对客户端仍按现有视频渠道返回 200 + OpenAI Video）

| 方法 | 路径 | 用途 | 首版 |
|------|------|------|------|
| POST | `/api/v1/videos` | 创建任务 | ✅ |
| GET | `/api/v1/videos/{id}` | 查询状态 / `video_url` | ✅ |
| GET | `/api/v1/videos` | 列表 | ❌ |
| GET | `/api/v1/models` | 模型与计费 | ❌ |
| GET | `/api/v1/credits` | 积分余额 | ❌ |
| DELETE | `/api/v1/videos/{id}` | 取消并退积分 | ❌ |

### 创建请求字段（上游）

| 字段 | 必填 | 说明 |
|------|------|------|
| `prompt` | ✅ | ≥ 10 字符 |
| `model` | ❌ | 默认 `seedance-2.0` |
| `duration` | ❌ | 秒；上游按模型范围夹取 |
| `aspect_ratio` | ❌ | 如 `9:16` / `16:9` |
| `resolution` | ❌ | 如 `720p` |
| `mute` / `disable_audio` | ❌ | 静音，规避自动 BGM 版权失败 |
| `reference` | ❌ | 内联 base64 / data URL |
| `reference_url` | ❌ | 公开 https 直链 |
| `references` / `reference_urls` | ❌ | 多参考数组 |
| `image` / `image_base64` | ❌ | `reference` 兼容别名 |

无任何参考字段 → 上游自动文生（`mode=text-to-video`）；有参考 → 图/视频/音频驱动（`mode=image-to-video`）。

### 创建响应（202）

```json
{
  "success": true,
  "task": {
    "id": "ckxxx",
    "status": "pending",
    "model": "seedance-2.0",
    "mode": "text-to-video",
    "duration": 5,
    "estimated_credits": 100,
    "created_at": "2026-06-17T12:00:00.000Z"
  }
}
```

### 查询响应（完成）

`task.status=completed` 且 `task.video_url` 非空为成功。  
失败时读 `task.error` / `error_code` / `retryable`；预扣积分由上游自行退还。

`video_url` 多为平台自有持久签名直链；少数兜底中转地址可能短期失效。建议客户端尽快下载；本渠道 **不** 把该 URL 改写为本地鉴权代理（与 OpenAI `/content` 不同）。

## 3. 接入方案

新增 **`ChannelTypeSora2U = 66`**，名称 `sora2u`。

- 包：`relay/channel/task/sora2u/`
- 注册：`relay/relay_adaptor.go` 的 `GetTaskAdaptor`
- 端点类型：与 Sora/MegaByAI 同属 OpenAI Videos（`common/endpoint_type.go`）
- 默认 Base URL：`https://sora2u.com`（adaptor 拼 `/api/v1/videos`；若管理员已把 Base URL 配成带 `/api` 后缀，需做路径归一，避免双 `/api`）

不修改现有 Sora / MegaByAI / Seedance 渠道行为。

## 4. 请求映射（客户端 → 上游）

上游请求固定为 **JSON** + `Authorization: Bearer`。

| 客户端字段 | 上游字段 | 规则 |
|------------|----------|------|
| `prompt` | `prompt` | 必填；长度 `< 10` 本地 400，不转发 |
| `model` | `model` | 渠道上游模型名 |
| `seconds` / `duration` | `duration` | 优先显式 `duration`，否则 `seconds` 转 number |
| `aspect_ratio` | `aspect_ratio` | 透传 |
| `size`（如 `720x1280`） | `aspect_ratio`（可选 `resolution`） | 宽>高→`16:9`；高>宽→`9:16`；相等→`1:1`；已有 `aspect_ratio` 不覆盖。分辨率可由短边粗推 `720p`，无法确定则省略 |
| `resolution` | `resolution` | 透传 |
| `mute` / `disable_audio` | 同名 | 透传 boolean |
| `reference` / `reference_url` / `references` / `reference_urls` | 同名 | 已是上游形态则透传 |
| `image` / `image_base64` | `reference` | 补全 data URL 前缀（缺省按 image/png） |
| `image_url` / 单 URL | `reference_url` | https 直链 |
| multipart 图片/音视频文件 | `reference` | `data:<mime>;base64,...` |
| 多 URL / 多文件 | `reference_urls` / `references` | 合并；数量上限交给上游 400 |

不支持 remix：若 `Action=remix`，本地返回 `not_supported`。

## 5. 响应与状态映射

| 上游 `task.status` | 内部 TaskStatus | 对外 OpenAI `status` |
|--------------------|-----------------|----------------------|
| `pending` | Queued | `queued` |
| `processing` | InProgress | `in_progress` |
| `completed` | Success | `completed` |
| `failed`（及取消类） | Failure | `failed` |

| 上游 | 对外 / 内部 |
|------|-------------|
| `task.id` | 存上游 ID；客户端看到公开 `task_xxxx` |
| `task.progress` | `progress` |
| `task.video_url`（成功） | `TaskInfo.Url` + OpenAI `metadata.url` |
| `task.error` / `error_code` | `error.message` / `error.code`；`TaskInfo.Reason` |
| `estimated_credits` / `credits_charged` | 可原样落在存档 Data，**不参与**结算 |

`DoResponse`：解析 `{ success, task }`，缺 `task.id` → `invalid_response`。  
`FetchTask`：`GET {base}/api/v1/videos/{upstreamId}`。  
`ConvertToOpenAIVideo`：写入公开 task id；把 `video_url` 放到 `metadata.url`（公开直链，不走 content 代理改写）。

## 6. 计费

- 预扣：模型倍率 + `OtherRatios["seconds"] = duration`（与 Sora 视频时长倍率习惯一致）
- 不使用上游积分字段做多退少补
- 不实现渠道「更新余额」

## 7. 默认模型

| model | 说明 |
|-------|------|
| `seedance-2.0` | 全模态默认 |
| `seedance-2.0-character` | 角色向 |
| `seedance-1.5` | 仅图片参考 |

## 8. 错误处理

- 上游非 2xx：尽量提取 `message` / `error` / `error_code` 回传
- 参考素材类 400（`unsupported_reference`、`invalid_reference`、`too_many_references`、`invalid_reference_url`、`reference_too_large` 等）原样暴露
- 轮询失败：`Reason = task.error`（可附 `error_code`）
- 不吞掉上游业务错误

## 9. 前端与常量

- `constant/channel.go`：`ChannelTypeSora2U = 66`，`ChannelBaseURLs` / `ChannelTypeNames`
- classic：`channel.constants.js`、`EditChannelModal.jsx`、`render.jsx`、i18n
- default：`constants.ts`、`channel-type-config.ts`、`channel-utils.ts`、locales  
默认提示：Base URL `https://sora2u.com`，Key 为 `sk_sora_...` Bearer。

## 10. 验收标准

1. 文生：`POST /v1/videos`，`model=seedance-2.0`，无参考 → 轮询 `completed`，`metadata.url` 可访问  
2. 图生：multipart 或 `reference_url` → 上游 `mode=image-to-video`，同样能拿到成片  
3. `prompt` 不足 10 字符 → 本地 400  
4. 管理后台可选「Sora2U」，默认 Base URL / 模型正确  
5. 现有 Sora / MegaByAI 回归不受影响  

## 11. 非目标（明确不做）

- 渠道积分余额同步  
- 上游取消 / 列表 / 模型目录同步  
- remix、图片生成模型  
- 把 Sora2U 响应伪装成可被现有 Sora adaptor 直连的形态  

## 12. 实现落点（文件清单）

| 区域 | 路径 |
|------|------|
| 常量 | `constant/channel.go` |
| Adaptor | `relay/channel/task/sora2u/`（新建） |
| 注册 | `relay/relay_adaptor.go`、`common/endpoint_type.go` |
| 前端 classic | `web/classic/src/constants/channel.constants.js` 等 |
| 前端 default | `web/default/src/features/channels/*` |
| 单测 | 字段映射、状态解析、`{success,task}` 解包 |
