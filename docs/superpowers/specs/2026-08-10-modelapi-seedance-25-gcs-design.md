# ModelAPI Seedance 2.5 白标接入与 GCS 下载设计

日期：2026-08-10

## 目标

把 ModelAPI 的 `doubao-seedance-2-5-260628` 作为 Flatkey 的独立 Seedance 2.5 上游渠道。客户端继续使用 Flatkey 现有的 `POST /v1/videos`、官方 Seedance `content[]` 入参和任务查询协议。

成功任务对外始终返回 Flatkey 自己的内容地址：

```text
/v1/videos/{public_task_id}/content
```

客户端访问该地址时，Flatkey 生成短时 Google Cloud Storage V4 Signed URL 并返回 `302 Found`。因此 API 地址和品牌归属保持为 Flatkey，实际视频字节由 Google 下载链路承载。

## 已确认约束

- 上游创建接口：`POST https://api.modelapi.co/v1/tasks`。
- 上游查询接口：`GET https://api.modelapi.co/v1/tasks/{task_id}`。
- 鉴权使用 `Authorization: Bearer <key>`。
- 上游模型固定为 `doubao-seedance-2-5-260628`，不透传客户端模型名。
- 上游状态为 `pending | polling | running | succeeded | failed`。
- 成功视频从 `result.assets[]` 中选择 `type == "video"` 的项目，不能依赖数组顺序。
- 成功任务必须先完成 GCS 归档，再通过现有 CAS 路径进入最终成功状态和结算。
- 上游真实任务 ID、响应 URL、品牌、主机名、GCS 桶名和 Signed URL 不得出现在客户端 JSON 或应用日志中。
- 新渠道的任务数据不得保存可恢复的上游视频 URL；`TaskPrivateData.ResultURL` 只保存 Flatkey `/content` 地址。
- 对本渠道，缺少有效 `VideoResult` 元数据时 `/content` 返回安全错误，不回退到上游直链或 Cloud Run 字节代理。
- 生产为多节点；归档依赖现有确定性对象键、GCS generation precondition 和任务状态 CAS，不引入进程内正确性锁。

## 方案选择

### 采用：独立渠道适配器 + 复用现有 GCS 结果归档

新增独立 `ChannelTypeModelAPISeedance` 和 `relay/channel/task/modelapiseedance` 适配器。入站继续复用 `dto.SeedanceVideoRequest` 与 `taskcommon.BindSeedanceRequest`，只在适配器内完成 ModelAPI wire-format 映射。结果复用现有 `ArchiveVideoResult`、`SignVideoResultDownload` 和 `TaskPrivateData.VideoResult`，仅将原先 TechMobi 专用的调用点泛化为固定白名单渠道。

该方案最小化新增安全面，并保留现有 GCS 幂等、MP4 校验、SSRF 防护、保留期和签名逻辑。

### 未采用：直接把上游 URL 返回给客户端

会暴露供应商和真实资源地址，失去 Flatkey 白标边界，并让可用期依赖上游临时 URL。

### 未采用：新增第二套 Google 存储实现或公开桶

会重复已有归档与签名能力。公开桶或永久对象 URL无法满足短时授权和隐藏存储标识的要求。

## 请求映射

客户端仍发送 `dto.SeedanceVideoRequest`。适配器生成：

```json
{
  "model": "doubao-seedance-2-5-260628",
  "input": {
    "text": [{"role": "prompt", "content": "..."}],
    "image": [{"role": "reference", "url": "..."}],
    "video": [{"role": "reference", "url": "..."}],
    "audio": [{"role": "reference", "url": "..."}]
  },
  "params": {
    "duration": 5,
    "resolution": "720p",
    "aspect_ratio": "adaptive",
    "seed": 1,
    "generate_audio": false,
    "watermark": false,
    "return_last_frame": false
  }
}
```

可选标量使用指针和 `omitempty`，保证显式 `false`、`0` 与未提供字段语义不同。所有 JSON 编解码调用 `common.*` 包装函数。

Seedance 素材角色映射如下：

| Seedance role | ModelAPI role |
| --- | --- |
| `reference_image` | `reference` |
| `reference_video` | `reference` |
| `reference_audio` | `reference` |
| 空 role | `reference` |
| `first_frame` | `first_frame` |
| `last_frame` | `last_frame` |

非法 role 在提交前返回 `400 invalid_request`。同时提前验证：`duration` 4–30、`resolution` 为 `480p|720p`、宽高比为官方集合、图片不超过 30、视频不超过 10、音频不超过 10、总素材不超过 50、首帧和尾帧各最多一项、尾帧必须与首帧同时出现。

## 创建与轮询

创建成功后仅把上游任务 ID保存为任务内部 ID，客户端拿到随机公开任务 ID。轮询状态映射：

| 上游状态 | Flatkey 状态 |
| --- | --- |
| `pending` | `QUEUED` |
| `polling`、`running` | `IN_PROGRESS` |
| `succeeded` | 先归档，成功后 `SUCCESS` |
| `failed` | `FAILURE`，错误信息脱敏 |

轮询响应进入 `task.Data` 前必须移除所有 asset URL。成功解析时，真实视频 URL只存在于当前轮询调用的内存对象中，供归档器立即读取；不得写日志。

## 成功数据流

1. 后台轮询 ModelAPI 任务。
2. 从 `result.assets[]` 选择 `type == "video"` 的 URL。
3. 调用现有 GCS 归档器，以固定指标标签 `modelapi` 流式下载、校验并写入私有结果桶。
4. 归档成功后，把 `VideoResult` 写入任务私有数据，并把 `ResultURL` 设置为 Flatkey `/v1/videos/{public_task_id}/content`。
5. 使用现有任务状态 CAS 完成成功转换和一次性结算。若其他节点已完成转换，本节点不重复结算。
6. 客户端查询任务时只看到 Flatkey 地址。
7. 客户端访问 `/content`；Flatkey 校验任务、渠道、过期时间和对象 generation，生成短时 Signed URL并返回 `302`。
8. 客户端跟随跳转后从 Google 下载，Google 处理 Range、Content-Length 和实际字节吞吐。

归档失败时本轮不推进成功状态，下一轮重新查询并重试。这样不会出现“任务显示成功但没有可下载副本”的状态。

## 下载与错误语义

ModelAPI 渠道采用严格归档模式：

- 有有效 `VideoResult`：`302` 到短时 GCS Signed URL，并设置 `Cache-Control: no-store`。
- 对象过期：`410 Gone`。
- 对象缺失或属性不匹配：`502 Bad Gateway`。
- 签名服务临时失败：`503 Service Unavailable`。
- 成功任务缺少 `VideoResult`：返回安全的 `502`，不尝试解析上游 URL，也不代理上游流量。

TechMobi 的历史任务兼容回退保持不变；严格禁止回退仅适用于新 ModelAPI 渠道。

## 注册与控制台

- 后端渠道类型值使用 `111`，默认 Base URL 为 `https://api.modelapi.co`。
- `GetTaskAdaptor` 注册新的任务适配器。
- endpoint 类型注册为 OpenAI Video。
- 加入 Seedance 白标渠道集合和品牌词脱敏集合。
- 默认控制台和 classic 控制台都显示独立渠道类型；模型列表固定为 `doubao-seedance-2-5-260628`，不调用通用模型抓取。

## 安全与可观测性

- 复用已有结果桶与运行时凭证，不新增公开 IAM、静态密钥或永久 URL。
- 指标只使用固定 `channel=modelapi` 标签，不使用任务 ID、URL、桶或对象名，避免高基数。
- 日志只记录公开任务 ID、阶段、状态码、字节数和耗时；不记录请求 Authorization、上游任务 ID、上游 URL或 Signed URL。
- 存储在 `task.Data` 的轮询快照必须经过 URL 清除；失败原因经过 `ScrubBrandedText`。

## 测试与验收

- 请求映射覆盖文本、图片、视频、音频、首尾帧和显式 `false/0`。
- 参数和素材限制在发送上游前失败。
- 创建、查询 URL、鉴权头和状态映射正确。
- 成功 asset 选择按 `type=video`，不依赖第一项。
- 成功轮询必须先归档；归档失败不成功、不结算。
- `task.Data` 与日志不包含上游 URL、主机名或品牌。
- 查询结果中的 URL始终为 Flatkey `/content`。
- `/content` 对归档结果返回 GCS `302`；缺元数据时不回退上游。
- 现有 TechMobi 历史回退测试继续通过。
- 运行相关 Go 测试、`go build ./...`、`go vet` 和控制台定向测试。

## 发布建议

- Router deploy：required。新增 `/v1/videos` 渠道路由、请求适配和 `/content` 下载分支均在 router 请求路径。
- Console deploy：required。主节点负责异步轮询、GCS 归档和任务状态持久化。
- Website：not required。
- Terraform / Cloudflare：not required；沿用已部署的私有结果桶和现有环境变量。
- 先在 staging 配置独立渠道与密钥，完成真实创建、轮询、GCS 对象、Flatkey 地址和 `302` 下载验证后再发布生产。
