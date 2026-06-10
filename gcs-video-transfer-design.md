# 视频任务结果转存 GCS 设计文档

> 状态：方案确认，待实现
> 日期：2026-06-10

## 1. 背景与目标

视频生成类渠道的上游返回的多为**有时效性的 CDN 直链**（通常几小时到几天过期），网关目前原样透传给用户，存在链接过期、上游不可控等问题。

**目标**：任务成功后，将上游结果文件转存到 GCS，向用户返回 **12 小时有效的 V4 签名链接**；且**必须转存完成后才能把任务标记为成功返回给用户**。

### 已确认的配置决策

| 项 | 值 |
|----|----|
| GCS Bucket | `taluna-api-result` |
| 对象前缀 | `api/video/` |
| 签名链接有效期 | 12 小时（V4 签名，上限 7 天，满足） |
| 结果保留期 | 30 天（bucket 生命周期规则删除；保留期是**对外 API 契约**的一部分，见 4.5） |
| 返回语义 | **转存完成才返回成功**（任务对外保持 in_progress，直到 GCS 转存完成才置 success） |
| 转存方式 | **异步**：goroutine/worker 池转存，不阻塞轮询循环 |
| 上游回调 | **转存模式下统一剥离**用户传入的 webhook/callback 字段（见 2.2），否则上游直推会绕过转存语义 |
| new api 级联 | **本期排除**（取流链路与本设计假设不符，维持现状透传，单独立项；见 4.2） |

## 2. 现状调研

### 2.1 视频生成：各渠道上游返回形式

| 渠道 | 上游结果形式 | 转存取流方式 | 代码位置 |
|------|---------|---------|---------|
| Kling（可灵） | `video_url` 直链 | 直接下载 | `relay/channel/task/kling/adaptor.go:356` |
| Vidu | `creations[].url` + `cover_url`，**可能多文件** | 直接下载（多对象，需枚举全部资产，见 4.2/4.4） | `relay/channel/task/vidu/adaptor.go:57` |
| Ali（通义万相视频） | `video_url` 直链 | 直接下载 | `relay/channel/task/ali/adaptor.go:472` |
| Jimeng（即梦视频） | `video_url` 直链 | 直接下载 | `relay/channel/task/jimeng/adaptor.go:450` |
| Doubao（豆包 seedance） | `content.video_url` 直链 | 直接下载 | `relay/channel/task/doubao/adaptor.go:327` |
| Pollo | `generations[]` 数组，**可能多文件**（用户可经 `metadata.videoNum` 请求 1-4 个视频，按上游全量 credit 结算 `pollo/adaptor.go:453-458`） | 直接下载（多对象，需枚举全部 succeed generation，见 4.2/4.4） | `relay/channel/task/pollo/adaptor.go:244,445` |
| Hailuo（海螺） | 网关 `buildVideoURL` 构造链接 | 直接下载 | `relay/channel/task/hailuo/adaptor.go:211` |
| Sora / OpenAI | **无直链**，需请求 `{base}/v1/videos/{id}/content` + Bearer | 带鉴权请求 content 端点 | `relay/channel/task/sora/adaptor.go:307`、`controller/video_proxy.go:109` |
| Gemini | 文件 URI，下载需附 API key | 带鉴权下载 | `controller/video_proxy.go:101`、`controller/video_proxy_gemini.go:283` |
| Vertex（Veo） | `bytesBase64Encoded`，仅存在于查询响应；`task.Data` 中已被 redact 删除 | 重新 FetchTask 后解码 | `relay/channel/task/vertex/adaptor.go:259`、`service/task_polling.go:504-528` |

> 结论：取流方式因渠道而异（直链 / 带鉴权端点 / base64 重取），转存不能用统一的 `http.Get(url)`，必须做成 **adaptor 级接口**（见 4.2）。
>
> 「new api 级联」分支（`task_polling.go:381-390`）**不在上表**：级联解析用 `dto.TaskResponse[model.Task]`，而 `model.Task.PrivateData` 标记 `json:"-"`、且 `model.Task` 没有映射 `result_url` 的 JSON 字段，对端返回的结果 URL 反序列化不进来（`taskResult.Url` 实际回退到空串，随后被写成本机 `BuildProxyURL`）。级联的取流需要专门设计（按 `dto.TaskDto` 解析对端 `result_url`，或带渠道 key 调对端 content 端点），**本期排除、维持现状**。
>
> **Midjourney 视频任务（mj_video）同样本期显式排除**：MJ 是独立于 `model.Task` 的另一套任务系统（`constant/midjourney.go:25,46`、`relay/mjproxy_handler.go:402,449`，独立轮询 `controller/midjourney.go`、独立读取出口），结果直链存 `midjourney` 表的 `VideoUrl`/`VideoUrls` 字段（`model/midjourney.go:17-18`）原样返回用户，本设计 3.2/4.5 的收口均覆盖不到。维持现状，如需转存单独立项；**「30 天保留 + 过期明确报错」的对外契约不适用于 MJ 视频，用户文档需注明**。

### 2.2 上游回调旁路（必须收口）

至少 5 个视频渠道允许用户通过请求 metadata 把回调地址透传给上游，上游完成时会把含**上游时效直链**的 payload 直接 POST 到用户回调地址，完全绕过「转存完成才返回成功」语义和读取侧收口；此外 Veo 的 `storageUri` 允许用户让上游把结果**直接写进用户自己的 GCS bucket**，性质相同：

| 渠道 | 透传点 |
|------|--------|
| Pollo | metadata 的 `webhookUrl`/`webhook_url`/`callback_url` → 上游 `WebhookUrl`（`pollo/adaptor.go:837-842`） |
| Doubao | `requestPayload.CallbackURL` + `UnmarshalMetadata` 整体灌入（`doubao/adaptor.go:46,288-291`） |
| Vidu | `requestPayload.CallbackUrl`（`vidu/adaptor.go:39,237`） |
| Hailuo | `VideoRequest.CallbackURL`（`hailuo/models.go:15`、`adaptor.go:162`） |
| Kling | 结构体字面量置空 `CallbackUrl: ""`（`kling/adaptor.go:279`）**随后被 `:286` 的 `UnmarshalMetadata` 整体灌入覆盖**——用户传 `metadata.callback_url`（json tag `callback_url`，`kling/adaptor.go:72`）照样透传上游，同为旁路 |
| Gemini/Vertex（Veo） | `metadata.storageUri` 经 `UnmarshalMetadata` 灌入 `VeoParameters.StorageUri`（`gemini/dto.go:26`、`gemini/adaptor.go:90`、`vertex/adaptor.go:161`）。Vertex 通道上（若用户 bucket 对渠道服务身份可写）结果直达用户 bucket、不经网关任何出口；且上游查询响应变为 `gcsUri` 而非 `bytesBase64Encoded`，4.2 设计的 Vertex 取流必然失败 → transferDeadline 误退款一个上游已成功的任务，是确定性资损路径 |

**决策：转存模式开启时，所有视频渠道统一剥离用户传入的旁路字段**——回调类（`webhookUrl`/`webhook_url`/`callback_url`/`callbackUrl`）与 Veo 的 `storageUri`。**剥离必须发生在 `UnmarshalMetadata` 之前**，在 metadata map 上删除相应键（`taskcommon.UnmarshalMetadata` 已有 `delete(metadata, "model")` 防计费绕过的先例，`taskcommon/helpers.go:16-28`）——结构体字面量置空会像 Kling 一样被随后的 unmarshal 覆盖。由于仅转存模式开启时才剥离，需把开关状态传入该函数，或在各 adaptor unmarshal 之后按开关强制清零字段。

### 2.3 图像生成（本期不做，备查）

- 上游返回 URL（可转 b64）：OpenAI DALL-E、Zhipu 4V（`relay/channel/zhipu_4v/image.go:100`）、Replicate（`relay/channel/replicate/adaptor.go:302`）、Ali（`relay/channel/ali/dto.go:113`）
- URL/Base64 混合：Jimeng（`image_urls` + `binary_data_base64`）、MiniMax（`image_urls` + `image_base64`）
- 纯 Base64：Gemini/Vertex（`BytesBase64Encoded`）

### 2.4 音频（本期不做，备查）

无返回 URL 的渠道：OpenAI TTS 返回二进制流，VolcEngine TTS 返回 Base64。

## 3. 现有架构：关键代码路径

### 3.1 写入点（任务状态的产生处）

1. **后台轮询**（仅 master 节点运行，`main.go:134`）：`service/task_polling.go:437-451`（`updateVideoSingleTask` 的 `TaskStatusSuccess` 分支）
2. **同步查询**（任意实例，仅 Gemini/Vertex 渠道，用户查询触发）：`relay/relay_task.go:461-477`（`tryRealtimeFetch`）。注意它在 `relay_task.go:486-499` **同时用上游数据直接组装响应体**——改造必须同时覆盖"写库"和"响应组装"两段，否则会出现 DB 还是 in_progress 而响应已显示 succeeded 的不一致。
3. **渠道获取失败的批量 FAILURE**：每轮轮询进入 per-task 循环前，`CacheGetChannel` 失败（渠道被删除/缓存异常）会用 `TaskBulkUpdateByID` 把该渠道全部未完成任务直接置 FAILURE + progress=100%（`task_polling.go:305-323`）——**无 CAS、不退款**（`model/task.go:431-443` 的注释明确警告该函数禁止用于计费流转）。这条路径会绕过状态机直接杀死转存中的任务，**本期必须纳入改造**（见 4.4）。另一处上游 task ID 为空的 bulk FAILURE（`task_polling.go:119-128`）打不中转存中的任务（`GetUpstreamTaskID` 回退到永非空的 TaskID，且进入转存阶段的任务必已成功提交），无需改动。

> `controller/task_video.go:21-279` 存在一套旧版 `UpdateVideoTaskAll`/`updateVideoSingleTask`，已无任何调用者，但与 service 层同名且自带独立结算逻辑，极易误接线绕过转存。**本期一并删除。**

### 3.2 读取点（用户能拿到结果 URL 的全部路径）

| # | 路径 | 现状 | 位置 |
|---|------|------|------|
| 1 | `GET /v1/videos/{task_id}`（OpenAI 格式，**主要用户路径**） | 各渠道 adaptor 的 `ConvertToOpenAIVideo` **直接从 `task.Data` 抽上游 URL，绕过 `GetResultURL()`** | doubao `adaptor.go:355`、kling `:392`、ali `:504`、jimeng `:464`、pollo `:1021`、vidu `:288`、sora `:324`（回吐原始 Data） |
| 2 | `model/task.go:518` `ToOpenAIVideo` | 走 `GetResultURL()`，**仅 hailuo 使用**（`hailuo/adaptor.go:232`）。vertex/gemini 各有独立 `ConvertToOpenAIVideo`：vertex 在 `adaptor.go:370` 直接调 `GetResultURL`（仅 `data:` 前缀时写 `metadata.url`），是独立读取点，需单独收口；gemini 不输出 url | |
| 3 | 任务查询响应组装 | `relay/relay_task.go:493,555` | |
| 4 | `TaskModel2Dto` 的 `Data` 字段 + 任务列表接口 | **原样返回 `task.Data`**（含上游 URL，仅 base64 被 redact） | `relay_task.go:563`、`controller/task.go` |
| 5 | 视频代理端点 | Gemini/Vertex/OpenAI/Sora 分支直接回源上游，default 分支读 `GetResultURL` | `controller/video_proxy.go:87-115` |
| 6 | Vertex 代理辅助路径（`getVertexVideoURL`，仅被 video_proxy 的 Vertex 分支调用） | 读 `GetResultURL` 当 http URL 用。注意真正的 Gemini 路径是 `getGeminiVideoURL`（`:15-67`），不读 `GetResultURL` 而是从 `task.Data` 抽文件 URI 或重新 FetchTask 取 `RemoteUrl`，其 gs:// 收口完全依赖出口 5 的 video_proxy 分支统一改造，不能以本行改造为已收口依据 | `controller/video_proxy_gemini.go:148-199` |
| 7 | **上游回调直推用户** | 上游完成时直接 POST 用户回调地址，不经网关任何出口 | 见 2.2，转存模式下统一剥离 |

> 结论：写入侧收口不够——**必须同时在读出侧收口**（见 4.5），否则用户仍会从路径 1/4/5/7 拿到上游直链。

### 3.3 轮询集合与状态机约束（设计的硬边界）

- 轮询集合：`progress != '100%' AND status NOT IN (FAILURE, SUCCESS)`，按 id 升序取前 `TASK_QUERY_LIMIT`（默认 1000）条（`model/task.go:311`、`common/init.go:152`）
- 超时清扫集合：同样过滤 `progress != '100%'`（`model/task.go:295-300`），按 `submit_time + TASK_TIMEOUT_MINUTES`（默认 1440 分钟）兜底退款
- **推论：任何「status=in_progress 且 progress=100%」的任务会同时退出轮询与清扫，永久卡死、资金悬置。** 转存期间 progress 绝不能到 100%（见 4.4）。
- `UpdateWithStatus`（`model/task.go:412-418`）：`WHERE status = ?` 的 CAS 全列 UPDATE，`RowsAffected > 0` 判赢——是防止重复结算/退款的唯一互斥机制，**所有终态翻转和计费动作必须以"CAS 赢"为前提**（现有正确范式：`task_polling.go:474-484`）。
- **隐性地基**：worker 把任务 CAS 翻成 SUCCESS 后，轮询循环陈旧内存副本的回写之所以不会覆盖回 IN_PROGRESS，完全依赖「所有落库都走 `UpdateWithStatus(snap.Status)`、snap 取自周期开头快照」这条纪律（陈旧回写因 `WHERE status` 不匹配而 0 行生效）。**红线：转存改造涉及的任何任务落库禁止使用 `task.Update()`/`DB.Save`**——仓库内 Suno 路径（`task_polling.go:244`）就是无 CAS 落库的反例先例，不可参照。
- `RefundTaskQuota`（`service/task_billing.go:152`）与结算函数均**非幂等**，没有自带去重。

## 4. 方案设计

### 4.1 总体流程

「转存完成才返回成功」约束的是**用户可见的任务状态**，不要求转存阻塞轮询循环。
因此采用异步转存：上游完成 ≠ 对外成功，**GCS 转存完成才是对外成功**。

```
轮询/查询发现上游任务完成（upstream success）
  → 轮询循环调用 ExtractUpstreamAssets 枚举全部资产（基于脱敏前的原始响应）
    出错或资产为空 → 本轮不落库、不写 UpstreamDoneAt，留待下一轮 FetchTask 重试
    （上游偶发 success 但 URL 未就绪时自然获得补全机会；计 extract-fail 指标）
  → 轮询循环落库（首次）：UpstreamDoneAt、UpstreamAssets（全部资产 URL 清单）、
    SettleTokens 等结算输入存入 PrivateData
    status 保持 IN_PROGRESS，progress 钉死在 "95%"（绝不写 100%）
  → Submit 异步转存（进程内 inflight 去重 + 失败退避，不阻塞轮询循环）
       ↓ （worker goroutine）
     重新从 DB 加载任务并做状态预检（非 IN_PROGRESS 或 UpstreamDoneAt==0 即退出）
     通过 adaptor.FetchResultContent 取流（直链 / 带鉴权端点 / 重新 FetchTask 解 base64）
     逐对象流式上传 GCS（If-GenerationMatch:0 条件写；"已存在"=该对象已完成，续传其余）
     全部对象就绪 → CAS 翻转 SUCCESS + progress=100% + ResultURL=gs://...，
                    CAS 赢才结算
     失败 → 仅删除 inflight 标记并记录内存退避，不写库
            （重试由下一轮轮询驱动：发现"上游已完成且未终态"→ 重新 Submit）
            轮询侧判断超过 transferDeadline → CAS 翻 FAILURE，CAS 赢才退款

用户查询任务
  → in_progress（转存中；Data 字段经 URL 脱敏，拿不到上游直链）
  → success 时读到 gs:// 对象路径 → 现签 12h V4 签名 URL 返回（多文件按 Index 重组）
  → success 但超过保留期 → 返回明确的"结果已过期"错误，不签死链
```

### 4.2 内容获取接口（adaptor 级）

取流方式因渠道而异（见 2.1），在任务 adaptor 接口上新增两个钩子：

```go
// ExtractUpstreamAssets 在"上游成功"时由轮询循环调用，枚举本任务全部结果资产。
// rawRespBody 是上游查询响应的原始字节（脱敏前）——多资产渠道（Vidu/Pollo）只能从原始响应解析，
// 不得依赖 task.Data（其内容受脱敏时序影响）。调用点硬顺序：先 Extract 暂存，后 URL 脱敏，再落库。
// 暂存进 PrivateData 后，转存重试不再依赖 task.Data。
ExtractUpstreamAssets(task *model.Task, taskResult *relaycommon.TaskInfo, rawRespBody []byte) ([]UpstreamAsset, error)

type UpstreamAsset struct {
    Index int    // 对象序号，决定 GCS 对象名与读取侧重组顺序；封面等附属文件也占一个 Index
    URL   string // 上游直链；无直链渠道（Sora/Vertex）留空
    Ext   string // 扩展名，按渠道静态映射在暂存时定死（视频 mp4、封面 jpg，未知 bin），不随下载的 Content-Type 漂移
}

// FetchResultContent 返回任务结果内容流。可能发起带鉴权的上游请求。
FetchResultContent(ctx context.Context, task *model.Task, ch *model.Channel, asset UpstreamAsset) (io.ReadCloser, string, error)
```

- 直链单文件渠道（Kling/Ali/Doubao/Jimeng/Hailuo）：`ExtractUpstreamAssets` 默认实现取单 `video_url`；`FetchResultContent` 默认实现下载 `asset.URL`。实现时逐渠道核对上游数组形态作防御（如 Kling 的 `videos[]` 现取 `[0]`，本网关请求结构无数量参数、多视频不可达，但 Extract 实现应枚举数组以防上游演进）
- Vidu：`ExtractUpstreamAssets` 枚举 `creations[].url` + `cover_url` 全部条目（现有 `ParseTaskResult` 只取 `creations[0].URL`，不够）
- Pollo：枚举 `generations[]` 全部 succeed 条目（每个占一个 Index）——用户可经 `metadata.videoNum` 请求 1-4 个视频且按上游全量 credit 结算（`pollo/adaptor.go:166,453-458`），现有只取首个非空 URL（`:445-450`）会"付 N 拿 1"
- Sora/OpenAI：请求 `{base}/v1/videos/{id}/content` + `Authorization`
- Gemini：下载文件 URI 时附 API key（按下方凭证解析顺序）
- Vertex：重新 FetchTask 拿 `bytesBase64Encoded` 并解码（`task.Data` 中的 base64 已被 redact，不能依赖）；若响应为 `gcsUri` 形态（`storageUri` 注入未被剥离的存量任务），按转存失败处理，不得盲等
- **取流凭证解析顺序**：`PrivateData.Key` 优先、`ch.Key` 兜底（单 key 渠道），与现有轮询（`task_polling.go:358-361`）和 video_proxy（`controller/video_proxy.go:89-94`）口径一致。**所有带鉴权取流的渠道（Gemini/Vertex/Pollo/Sora）都必须在 InitTask 时快照提交 key**（`model/task.go:175-180`，Sora 并入该快照分支）——多 key 渠道会轮转且 Gemini 文件 URI 与创建它的 key/项目绑定，多 key 模式下 `ch.Key` 是换行拼接的全部 key 原始串，直接使用是确定性无效凭证，会反复 403 → transferDeadline 误退款实际成功的任务。`controller/video_proxy.go:111` 现有的 Sora 分支也是直接用 `channel.Key` 作 Bearer，同属此隐患，一并改读 `PrivateData.Key`

**下载硬约束**：

- **SSRF 防护**：所有 URL 下载前必须过 `common.ValidateURLWithFetchSetting`（`common/ssrf_protection.go:333`，与 `controller/video_proxy.go:133` 的调用同一套校验）
- **http client**：必须使用 `service.GetHttpClient`/`GetHttpClientWithProxy`（继承 `checkRedirect` 的重定向逐跳重校验，`service/http_client.go:24-34`），**禁止自建裸 `http.Client`**；单次转存超时（`GCS_TRANSFER_TIMEOUT`，默认 10 分钟）必须通过 `context` 强制，不能依赖 `client.Timeout`（`RelayTimeout=0` 时共享 client 无 Timeout）
- **已知残余风险**：现有校验是"请求前一次性校验"，与建连时的 DNS 解析之间存在 DNS rebinding TOCTOU 窗口；如需封堵可在 `DialContext` 层做连接时 IP 复检，本期接受该残余风险（级联分支已排除，剩余 URL 均来自已校验渠道的上游响应）
- **体积上限**：默认 2 GiB（`GCS_MAX_OBJECT_SIZE` 可配）。检测必须用 `LimitReader(N+1)` + 字节计数判断超限（仓库既有模式：`common/body_storage.go:140-150`、`service/file_service.go:178`）——裸 `io.LimitReader(r, N)` 在 N 字节处**静默 EOF 不报错**，照字面实现会把超限文件静默截断成"成功"对象。超限判转存失败，且必须按 4.3 的放弃纪律 abort 上传，不得 finalize
- **Content-Type 白名单**：仅用于上传时的对象 metadata；**对象扩展名一律取自暂存时定死的 `asset.Ext`**，禁止把上游响应字段拼进对象名（扩展名漂移会破坏条件写的幂等，见 4.3）

### 4.3 GCS 存储服务

新增 `service/gcs_storage.go`：

- 依赖：`cloud.google.com/go/storage`（go.mod 目前无对象存储 SDK，需新引入）
- **client 生命周期**：`storage.NewClient` 在进程启动时初始化（仅当 `GCS_TRANSFER_ENABLED` 开启）；初始化失败（凭证缺失/格式错/网络不可达）**直接 fatal 退出、阻止进程启动**——转存是计费关键路径，绝不静默带病启动。运行期 SA 凭证过期/吊销表现为上传与签名持续失败，须与「GCS 服务故障」区分上报（见 4.8），由运维经 `GCS_TRANSFER_ENABLED` 紧急开关止血
- 对象命名：`api/video/{task_id}_{index}.{ext}`（单文件渠道 index=0；Vidu 的多视频/封面各占一个 index；`ext` 来自暂存时定死的 `UpstreamAsset.Ext`，跨重试稳定）
- **写入用 `If-GenerationMatch: 0` 前置条件**：对象已存在则写入失败返回特定错误码，调用方视为"**该对象**已转存，直接复用"。幂等是**逐对象语义**：worker 每次尝试必须遍历任务的全部资产，对每个对象独立做条件写/复用判断，**全部对象就绪后才允许 CAS 翻 SUCCESS**——这天然覆盖多文件部分成功后崩溃的续传、多实例并发与进程重启的重复触发，无 check-then-act 竞窗
- **上传放弃纪律（上一条幂等语义的 load-bearing 前提）**：「已存在 = 已完成」成立的前提是对象只可能在完整写入后才存在。`storage.Writer` 在 `Close()` 时 finalize——任何错误路径（下载流中断、超限、context 超时）**必须通过 cancel context 放弃上传，禁止错误后调用 `Close()`**。`defer w.Close()` 的自然写法会把半截数据 finalize 成合法的截断对象，被后续所有重试按"已完成"永久复用、签名返回给用户并完成结算，无自愈。防御纵深：复用已存在对象前校验其 size（与下载侧字节计数一致，能取到 Content-Length 时一并核对）/CRC32C，不一致视为损坏对象——告警并判转存失败（计 corrupt-object 指标），不得复用
- 全程流式（`io.Copy` 到 `bucket.Object(...).NewWriter`），不落盘、不缓冲整对象（SDK Writer 的 ChunkSize 默认 16MiB/对象属流式上传固有窗口，4-8 并发合计 64-128MiB，可接受）
- 单次转存（整任务全部对象）超时默认 10 分钟（`GCS_TRANSFER_TIMEOUT`），经 context 强制
- `SignURL(objectName string, ttl time.Duration) (string, error)`：V4 签名，TTL 12h

### 4.4 状态机与写模型（核心）

#### 状态表示

`PrivateData` 新增字段（**只能用可比较类型**——`TaskPrivateData.Value()` 用 `==` 与零值比较，`model/task.go:153`，map/slice 会编译失败；多值数据序列化成 JSON 字符串存单个 string 字段）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `UpstreamDoneAt` | int64 | 上游完成时间戳；非零即表示"上游已成功，进入转存阶段"；同时是 `transferDeadline` 的锚点 |
| `UpstreamAssets` | string | 资产清单 JSON（`[]UpstreamAsset` 序列化）；含全部上游直链（按 `Index` 排序），**仅供转存与读取侧重组，绝不对外返回** |
| `SettleTokens` | int64 | 上游完成时的 TotalTokens 快照（结算输入持久化，进程重启后无需依赖内存中的 taskResult） |

转存阶段的对外表示：`status = IN_PROGRESS`，`progress = "95%"`（固定专用值）。

**两条硬规则**（对应 3.3 的卡死陷阱）：

1. `UpstreamDoneAt != 0` 时，**禁止任何路径把 progress 写成 "100%"**——必须跳过 `task_polling.go:469-471` 的 `taskResult.Progress` 覆盖逻辑。SUCCESS 终态由 worker 的 CAS 连同 `progress=100%` 一并写入。
2. `taskSnapshot`（`model/task.go:367-397`）必须扩展覆盖上述新字段，否则 `snap.Equal` 判"无变化"会跳过落库，`UpstreamDoneAt` 可能根本写不进 DB。

#### 重试模型：墙钟截止驱动，无持久化重试计数

转存重试**不维护持久化的失败计数**——轮询周期 15 秒一轮（`task_polling.go:92-93`），任何按轮递增的计数器都无法区分"worker 正在正常转存"与"上一次尝试已失败"，会系统性误杀长转存任务（计数预算与单次转存 10 分钟超时直接矛盾）。取而代之：

- **转存阶段专属的持久化止损条件是墙钟截止**：`now - UpstreamDoneAt > transferDeadline`（`GCS_TRANSFER_DEADLINE`，默认 2h，必须远大于单次转存超时与最坏排队时间，且小于各渠道直链最短时效）→ CAS 翻 FAILURE，CAS 赢才退款。注意全局 sweep（`submit_time + TASK_TIMEOUT_MINUTES`）仍覆盖转存阶段任务（progress=95% 在其过滤集合内）并构成最终兜底，由此产生一条**配置约束：`TASK_TIMEOUT_MINUTES` 必须显著大于「最长上游生成时间 + transferDeadline」**（默认 24h vs 2h 满足）——否则 sweep 会先于 transferDeadline 误杀在途转存，并可能抢在 4.6 紧急开关的降级完成之前退款。sweep 对转存阶段任务退款时同样遵守 CAS 单赢家纪律（见下）。
- **失败退避在转存管理器内存中维护**（per-task `lastFailAt`，指数退避，下限 15s 上限 5min）：worker 失败退出后，轮询的 re-Submit 在退避期内不启动新尝试。进程重启退避归零，可接受（重启后至多多打一次上游）。
- 已知损耗：恰在 2h 截止边界 worker 仍在上传时会被误杀退款（worker 随后 CAS 失败不结算），窗口极窄，列为可接受。

#### 单写者模型（避免写写冲突）

`UpdateWithStatus`/`Save` 都是全列 UPDATE，轮询循环的内存副本可陈旧数十秒（cycle 开头批量加载 + 每任务 sleep 1s 串行，`task_polling.go:97,339`）。转存阶段任务 status 恒为 IN_PROGRESS，`UpdateWithStatus` 的 CAS 对 IN_PROGRESS→IN_PROGRESS 的写不提供任何互斥（WHERE 恒真，退化为无条件覆盖），因此**写权必须收敛到单一写者**：

- **轮询循环（master，单线程）独占写转存阶段字段**：`UpstreamDoneAt`、`UpstreamAssets`、`SettleTokens`、progress、以及超截止判 FAILURE。
- **worker 只做一种写**：转存成功后，重新 `GetByOnlyTaskId` 加载任务（**禁止捕获轮询循环的 `*model.Task` 指针**，那是 data race），**先做状态预检**（非 IN_PROGRESS 或 `UpstreamDoneAt==0` 即清 inflight 退出，不取流），转存完成后设置 `ResultURL`/`FinishTime`/`progress=100%`，`UpdateWithStatus(IN_PROGRESS → SUCCESS)` CAS 翻转，**CAS 赢了才调用 `settleTaskBillingOnComplete`**（结算输入用 `PrivateData.SettleTokens` 合成 `&TaskInfo{TotalTokens: SettleTokens}`。**接口契约**：转存模式下传给 `AdjustBillingOnComplete` 的 `taskResult` 仅保证 `TotalTokens` 有效——当前唯一非默认实现 pollo 只读该字段（`pollo/adaptor.go:525-541`），未来渠道的计费覆写不得读取其他字段，否则需先扩展 SettleTokens 的持久化集；该约束写入 `TaskPollingAdaptor.AdjustBillingOnComplete` 的接口注释。adaptor 通过 `service.GetTaskAdaptorFunc(platform)` 重建并 Init，不复用轮询循环的实例——部分 adaptor 有状态，如 hailuo 持有 apiKey/baseURL；带鉴权取流的渠道由 worker **自行 `CacheGetChannel`**，失败按转存失败处理，取流凭证按 4.2 的解析顺序 `PrivateData.Key` 优先）。结算在 CAS 翻 SUCCESS 之后执行，`RecalculateTaskQuota` 改写的内存 `task.Quota` 不再回写 DB，与既有 success 路径（风险 9）行为一致。worker **失败时不写库**，只删 inflight 标记并记录内存退避。
- **`tryRealtimeFetch`（任意实例、用户查询触发）对视频任务完全只读**：转存模式下不落库、不 Submit，发现上游成功也只对外返回 in_progress（响应组装同样不得用上游数据组装 succeeded）。首次暂存与转存触发完全由 master 轮询驱动，代价是 Gemini/Vertex 任务的对外成功最多延迟一个轮询周期（≤15s+），可接受。**理由**：tryRealtimeFetch 的读-写窗口横跨一次上游 HTTP 调用（`relay_task.go:440-451`），任何写入都会与 master 的陈旧副本互相整行覆盖（lost update），把它从写者集合中彻底移除是唯一不引入行级版本控制的消解方式。

#### 轮询循环改造

转存阶段（`UpstreamDoneAt != 0`）**直接跳过 FetchTask**——结算输入已持久化，上游状态不再重要，终态决定权完全归转存流程。这同时消解了两个问题：上游晚期清理任务记录导致的误杀（原 `task_polling.go:400-419` 会把空 status + 非 429 错误判 FAILURE 退款），以及对上游的无谓重复查询。

**分流位置硬约束：转存阶段分支必须在 `CacheGetChannel`/adaptor 构建之前执行。** 现行代码在渠道获取失败时对整组任务提前 return（`task_polling.go:305-322`），per-task 循环（`:334`）根本不会执行——若把转存分支放在循环内，渠道被删后转存中任务既不被 re-Submit（worker 失败后无人重试、master 重启丢失 inflight 后无人重新触发）也不做 transferDeadline 检查，只能等 24h sweep 兜底退款；`TASK_TIMEOUT_MINUTES<=0` 时（`task_polling.go:42-44` sweep 整体禁用）则永久卡死、资金悬置。deadline 检查与 Submit 均不依赖渠道（直链类转存无需渠道；带鉴权取流由 worker 自行 `CacheGetChannel`），因此按任务先分流：

```go
// 逐渠道处理之前（CacheGetChannel 之前），先按任务分流转存阶段
if task.PrivateData.UpstreamDoneAt != 0 {              // 转存阶段：跳过渠道获取与 FetchTask
    if now-task.PrivateData.UpstreamDoneAt > transferDeadline {
        // CAS 翻 FAILURE（UpdateWithStatus），CAS 赢才 RefundTaskQuota
    } else {
        gcsTransfer.Submit(task.TaskID)                // inflight 去重 + 内存退避，立即返回
    }
    continue
}

// success 分支（首次发现上游完成）
case model.TaskStatusSuccess:                          // 上游成功 ≠ 对外成功
    assets, err := adaptor.ExtractUpstreamAssets(task, taskResult, rawRespBody) // 脱敏前的原始响应
    if err != nil || len(assets) == 0 {
        // 不写 UpstreamDoneAt、不改 progress，本轮放弃：下一轮 FetchTask 重试，
        // 上游偶发 success 但 URL 未就绪时自然获得补全机会（计 extract-fail 指标，
        // 持续失败由 TASK_TIMEOUT_MINUTES sweep 兜底退款）
        break
    }
    task.PrivateData.UpstreamDoneAt = now
    task.PrivateData.UpstreamAssets = marshal(assets)  // common.Marshal
    task.PrivateData.SettleTokens = taskResult.TotalTokens
    task.Status = model.TaskStatusInProgress           // 对外仍 in_progress
    task.Progress = taskcommon.ProgressTransferring    // "95%"，绝不 100%
    // 落库（snapshot 已覆盖新字段，保证写入；URL 脱敏在 Extract 暂存之后才执行）：
    won, err := task.UpdateWithStatus(snap.Status)
    if won { gcsTransfer.Submit(task.TaskID) }         // CAS 输 = 已被 worker 翻终态，不再 Submit
```

注意最后一行：现有代码丢弃非终态落库的 CAS 结果（`task_polling.go:486` 的 `if _, err :=`），改造后 **`won==false` 必须跳过 Submit**，否则会对已 SUCCESS 的任务重复入队、白做一次下载+上传（带鉴权渠道还会产生真实上游调用）。

#### 渠道获取失败路径改造（3.1 第 3 写入点）

`CacheGetChannel` 失败时（`task_polling.go:305-323`）不再 `TaskBulkUpdateByID` 整批判死：

- `UpstreamDoneAt != 0` 的任务**已在进入逐渠道处理前被分流**（见上），不会到达本分支——转存分支的 Submit 与 transferDeadline 检查不依赖渠道存在，渠道被删不影响其驱动与兜底；带鉴权取流的渠道（Sora/Gemini/Vertex）由 worker 自行 `CacheGetChannel`，失败按转存失败处理，最终由 transferDeadline 退款兜底。
- 对其余任务（`UpstreamDoneAt == 0`）：改为**逐条 CAS（`UpdateWithStatus`）+ 赢者 `RefundTaskQuota`**，纳入 CAS 计费互斥体系。

#### 计费互斥与崩溃窗口

终态计费的互斥**完全由既有的 status CAS 单赢家提供**：所有对 `UpstreamDoneAt != 0` 任务做终态计费的路径（worker 结算、轮询超截止退款、sweep 超时退款、4.6 紧急开关降级结算）都先以 `UpdateWithStatus(IN_PROGRESS → 终态)` 抢 CAS，`RowsAffected > 0` 才执行计费。`IN_PROGRESS → SUCCESS/FAILURE` 的 CAS 保证这几条路径只有一个赢家、只有赢家计费——不存在跨路径重复计费，无需额外的去重标记或对账扫描。

唯一残余是"CAS 赢落库后、计费执行前进程崩溃"的窗口：任务已终态、退出轮询/清扫集合，该次计费丢失（资金悬置）。**本设计不为此新增对账补偿**——既有的 success 结算（`task_polling.go:474-496`）与 sweep 退款（`:70-82`）早已裸跑同一窗口、仓库长期接受，转存路径与之同级，不引入比基线更差的风险。资金调整失败（`RefundTaskQuota`/`RecalculateTaskQuota` 现有的吞错 return，`task_billing.go:159-162,209-212`）须打 error 级日志并计入 4.8 计费失败指标供人工核对，但不做自动补做。

> 取舍说明：不为该崩溃窗口引入"终态标记 + 定时对账扫描"的补偿机制。`PrivateData` 是 JSON TEXT 单列、跨三库无统一谓词（Rule 2），对账只能靠文本 LIKE + Go 侧过滤 + finish_time 宽限窗 + "枚举所有计费路径否则二次计费"的脆弱协议，且会把一个崩溃级窗口升级成需常驻规避的稳态竞态——复杂度与崩溃概率严重不匹配。既有计费路径本就接受同级窗口，对齐基线即可。

#### 并发与去重小结

| 竞争场景 | 保护机制 |
|---------|---------|
| 同进程内重复触发同一任务 | worker 管理器 `sync.Map` inflight 标记 + 内存退避 |
| 多实例并发转存 / 进程重启重复触发 | GCS `If-GenerationMatch: 0` 原子条件写（逐对象） |
| 转存成功结算 vs sweep 超时退款 vs 超截止退款 vs 紧急开关降级结算 | `UpdateWithStatus` CAS 单赢家，**赢者才执行计费动作**（终态 CAS 即计费互斥，无需额外标记） |
| worker 与轮询循环写同一行 | 单写者模型：worker 只做终态 CAS（赢者随后结算），转存阶段字段归轮询独占 |
| tryRealtimeFetch 与轮询/worker | tryRealtimeFetch 对视频任务完全只读，不构成写者 |
| 崩溃导致计费丢失（CAS 赢后、计费前崩溃） | 不补偿，与既有 success/sweep 路径同级、列为已知损耗 |

> 已知可接受损耗：sweep/超截止退款赢得 CAS 时，GCS 对象可能已生成但用户被退款——对象留待生命周期规则清理。

#### worker 池

`service/gcs_transfer.go`：信号量限制并发转存数（`GCS_TRANSFER_CONCURRENCY`，默认 4，建议 4-8），避免大量任务同时完成打满网关带宽；信号量满时 Submit 仍立即返回（任务已在 inflight 集合，goroutine 排队等槽）。排队时长计入单次转存的 context 超时之外（超时从实际开始取流起算），但整体受 transferDeadline 兜底。

### 4.5 读取侧收口（与写入侧同等重要）

`PrivateData.ResultURL` 存主文件（index=0）的 `gs://taluna-api-result/api/video/xxx.mp4`；多文件任务的其余对象路径由 `UpstreamAssets` 按 `Index` + 命名规则推导。所有出口在读取时换签名 URL。**不在写入时生成签名链接存库**——12 小时后再查会拿到死链；读时现签则每次查询都返回新鲜 12h 链接。

**统一入口**：`model/task.go` 新增 `GetSignedResultURL() (string, error)`，识别 `gs://` 前缀换签，否则原样返回（兼容旧数据/紧急开关模式）。三条统一规则：

1. **保留期检查**：任务 SUCCESS 且 `FinishTime + GCS_RESULT_RETENTION_DAYS < now` 时**不再签名**，返回明确的"结果已过期"错误（对象已被生命周期规则删除，V4 签名是离线计算、不校验对象存在性，照常签出的会是必 404 的死链）。**签名 TTL 同时按剩余保留期收口**：`ttl = min(GCS_SIGNED_URL_TTL, 保留期截止 - now - 安全余量)`，余量内直接返回过期错误——否则保留期最后 12 小时内签出的 URL 可能在有效期内被生命周期删除（删除按天批处理、只会延后不会提前，但不能依赖该无上界的延迟），且响应里的 `expires_at` 必然虚标，违反 4.6 的"不得虚标"要求。结果保留期是对外 API 契约，需写进用户文档。
2. **签名失败降级**：有错误通道的出口（video_proxy）返回 503 + 可重试语义；无错误通道的 JSON 出口（`TaskModel2Dto`、`ToOpenAIVideo` 均无 error 返回路径）把 url 降级为指向 `video_proxy` 的网关代理 URL（`BuildProxyURL` 已存在），**绝不返回裸 `gs://`**。
3. **多文件重组**：读取侧统一按 `UpstreamAssets` 的 `Index` 升序重组输出（主视频 index=0 写 `metadata.url`，其余资产按 Index 追加），各对象现签 12h URL。读取侧本就重组为标准 OpenAI Video 结构、不回吐原始 Data，因此无需按原始响应字段路径逐一回填。

| # | 出口 | 改造 |
|---|------|------|
| 1 | 各渠道 `ConvertToOpenAIVideo`（doubao/kling/ali/jimeng/pollo/vidu/sora） | **框架层统一覆写**：`relay_task.go:388-405` 调用 adaptor 转换后，若任务 SUCCESS 且 ResultURL 为 `gs://`，强制把 `metadata.url` 覆写为现签 URL，多文件按 `UpstreamAssets` 的 Index 重组（sora 的原始 Data 透传分支同样收口） |
| 2 | `model/task.go:518` `ToOpenAIVideo`（hailuo） + vertex 独立读取点（`vertex/adaptor.go:370`） | `GetResultURL` 处统一换签；vertex 的 `data:` 分支随转存统一为 gs:// 路径后自然消失 |
| 3 | `relay_task.go:493,555` 响应组装 | 同上 |
| 4 | `TaskModel2Dto.Data` / 任务列表 | **URL 脱敏**：扩展 `redactVideoResponseBody` 思路（`task_polling.go:395`，写库前执行），把 Data 中的 http(s) URL 字段删除/替换（转存中的任务不得泄露上游直链）。转存重试不受影响——重试的 URL 来源是 `UpstreamAssets`，暂存先于脱敏发生 |
| 5 | `controller/video_proxy.go` 全部分支（含 Gemini/Vertex/OpenAI/Sora 四个非 default 分支） | ResultURL 为 `gs://` 时统一 **302 重定向到签名 URL**（省网关带宽）；保留原回源逻辑仅作转存未完成期的兜底；超保留期返回 410 |
| 6 | `controller/video_proxy_gemini.go:148-199`（`getVertexVideoURL`，Vertex 辅助路径） | 识别 `gs://`，换签后再处理。Gemini 分支（`getGeminiVideoURL`）不读 `GetResultURL`，其收口由行 5 的 video_proxy 分支统一改造承担；它从 `task.Data` 抽 URI 的逻辑（`:20,69-77`）在 Data URL 脱敏后自然失效 |
| 7 | 上游回调 | 提交时统一剥离（见 2.2），无需读取侧处理 |

### 4.6 签名与凭证

| 配置 | 说明 |
|------|------|
| `GCS_RESULT_BUCKET` | `taluna-api-result` |
| `GCS_RESULT_PREFIX` | `api/video` |
| `GCS_SIGNED_URL_TTL` | 默认 `12h` |
| `GCS_RESULT_RETENTION_DAYS` | 默认 `30`，必须与 bucket 生命周期规则一致；读取侧据此判过期 |
| `GCS_TRANSFER_ENABLED` | **紧急开关**：关闭后回退直链透传（GCS 故障时止血），切换语义见下 |
| `GCS_TRANSFER_DEADLINE` | 转存墙钟截止，默认 `2h`（配置约束见 4.4 重试模型） |
| `GCS_TRANSFER_CONCURRENCY` | worker 并发转存数，默认 `4` |
| `GCS_TRANSFER_TIMEOUT` | 单次转存（整任务全部对象）超时，默认 `10m` |
| `GCS_MAX_OBJECT_SIZE` | 单对象体积上限，默认 `2GiB` |
| `GCS_SIGN_CACHE_TTL` | 签名缓存 TTL，默认 `10m`（仅 Workload Identity/SignBlob 路径需要） |
| `GOOGLE_APPLICATION_CREDENTIALS` | SA key 文件路径 |

以上运行参数（deadline、并发、超时、体积上限）是 4.8 指标上线后校准的对象——可校准的前提是可配置，不能只作为代码常量。

- **SA 对 bucket 的权限：`roles/storage.objectCreator` + `roles/storage.objectViewer`**（或自定义角色含 `storage.objects.create` + `storage.objects.get`）。签名 GET URL 在服务端以签名 SA 的身份鉴权，SA 自身必须持有 `storage.objects.get`，objectCreator 单独不够（只含 create，签出的链接全部 403）。不要 objectAdmin。
- **上线前验证步骤（实现清单必备）**：用目标 SA 实签一个 GET URL 并 curl 验证 200，再放量。
- **凭证必须部署到所有实例**：读取点（现签）跑在每个副本上，不只 master。
- 签名方式：SA key 文件本地 RSA 签名（~1ms，推荐）；Workload Identity 环境走 IAM `SignBlob` API，SA 需 `roles/iam.serviceAccountTokenCreator`，且每次签名一次网络调用——签名发生在用户同步查询路径上，高频轮询客户端会放大，需按对象做短 TTL（如 10 分钟）签名缓存。**缓存条目必须存 `(signedURL, expiresAt)` 二元组**，响应里的 `expires_at` 取真实签名过期时刻，不得虚标。
- **时钟**：V4 签名对本地时钟敏感（偏差 >15 分钟被 GCS 拒绝），实例需 NTP 保障。
- 客户端契约：返回的 URL **不保证稳定也不保证每次不同**（签名缓存命中期内相同），客户端不应做 URL 等值比较；响应附 `expires_at`，文档化"拿到即下载"；结果保留 30 天，过期后查询返回明确的过期错误。

#### 紧急开关切换语义

- **关闭后，新发现的上游成功**：直接按旧逻辑处理——写 `ResultURL=上游直链`、CAS 翻 SUCCESS、结算（即恢复直链透传）。
- **关闭后，存量转存中任务**（`UpstreamDoneAt != 0`、progress=95%）：下一轮轮询发现开关关闭，用 `UpstreamAssets` 主文件直链按旧逻辑降级完成（写直链、CAS SUCCESS、结算），**禁止走 transferDeadline 退款分支**——止血开关本身绝不能造成批量误退款。无直链渠道（Sora/Vertex）回退为现状的代理 URL（`BuildProxyURL`）。**降级结算同样遵守 4.4 的计费互斥：CAS 赢才结算**——`IN_PROGRESS → SUCCESS` 的终态 CAS 单赢家保证降级分支不与可能仍在途的 worker 重复结算。
- **重新打开**：不回溯已按直链完成的任务。

### 4.7 顺手统一的路径

- Vertex Veo 的 `data:` base64 视频不再经 `task.Data`/代理流出，统一为 GCS 路径。
- 上游 CDN 链接时效（Kling/Doubao 等通常几小时～几天）：有效期延长为保留期 30 天，且过期后返回**明确的过期错误**而非静默死链。

### 4.8 可观测性（实现清单必备项）

转存链路直接决定"任务何时对外成功"且带退款副作用，最低限度以结构化日志/计数器落地：

- 转存耗时直方图（按渠道）——用户感知成功延迟的直接构成
- 转存结果计数器：success / exists-reuse / download-fail / gcs-auth-fail（401/403/凭证失效）/ gcs-service-fail（5xx/网络/超时）/ oversize / deadline-exhausted / extract-fail（上游 success 但资产枚举失败或为空）/ corrupt-object（复用前 size/CRC32C 校验不一致）
- **超截止退款 quota 总量**（资损指标：上游已成功生成却退款）
- 签名失败计数（SignBlob 路径尤其需要）
- inflight 数、worker 排队时长、转存积压量（轮询集合中 progress=95% 的任务数）
- 卡死哨兵：`status=IN_PROGRESS AND progress='100%'` 的任务数应恒为 0

没有这些指标，`transferDeadline=2h`、worker 并发数等参数上线后无法校准，GCS 故障与上游 CDN 提前过期也无法区分。

## 5. 实现清单

| # | 改动 | 文件 |
|---|------|------|
| 1 | 引入 `cloud.google.com/go/storage` | `go.mod` |
| 2 | GCS client 启动期初始化（失败 fatal 退出）+ 上传（逐对象条件写、错误路径 cancel context 放弃上传、复用前 size/CRC32C 校验）+ V4 签名服务（TTL 按剩余保留期收口） | `service/gcs_storage.go`（新增） |
| 3 | 异步转存 worker（inflight 去重、内存退避、并发上限、状态预检、单写者纪律、自行 CacheGetChannel + PrivateData.Key 优先取流） | `service/gcs_transfer.go`（新增） |
| 4 | adaptor 接口新增 `ExtractUpstreamAssets`（含 rawRespBody 参数）+ `FetchResultContent` + 各渠道实现（直链默认实现 / vidu+pollo 多资产枚举 / sora content 端点 / gemini 带 key / vertex 重取 base64 + gcsUri 防御）；`AdjustBillingOnComplete` 接口注释固化"转存模式下仅 TotalTokens 有效"契约 | `relay/channel/adapter.go` + 各 `relay/channel/task/*/adaptor.go` |
| 5 | 所有视频渠道统一剥离用户旁路字段（回调类 + Veo `storageUri`），剥离在 `UnmarshalMetadata` 之前的 metadata map 上做 | `taskcommon/helpers.go` + pollo/doubao/vidu/hailuo/kling/gemini/vertex 各 adaptor |
| 6 | 配置项 + 紧急开关（含切换语义与降级结算走 CAS 单赢家互斥） | `setting/` + 环境变量 |
| 7 | 轮询写入点：状态机改造（转存阶段分流提前到 CacheGetChannel 之前、Extract 失败不进转存阶段、暂存先于脱敏、progress 钉 95%、转存阶段跳过 FetchTask、超截止退款、`won==false` 跳过 Submit） | `service/task_polling.go:437-451,400-419,469-471,486` |
| 8 | 渠道获取失败路径：bulk FAILURE 改逐条 CAS + 赢者退款（转存中任务已提前分流，不经此路径） | `service/task_polling.go:305-323` |
| 9 | `tryRealtimeFetch` 改为视频任务完全只读（写库 + 响应组装两段都不得产出 succeeded） | `relay/relay_task.go:461-499` |
| 10 | `PrivateData` 新字段（`UpstreamDoneAt`/`UpstreamAssets`/`SettleTokens`）+ `taskSnapshot` 扩展 + InitTask 把 Sora 并入 key 快照分支 | `model/task.go` |
| 11 | 读取侧收口：框架层覆写 + 多文件按 Index 重组、`GetSignedResultURL`（含保留期检查与签名失败降级）、Data URL 脱敏、video_proxy 各分支 302/410 | `relay/relay_task.go`、`model/task.go`、`controller/video_proxy.go`、`controller/video_proxy_gemini.go` |
| 12 | SSRF 校验复用（`common.ValidateURLWithFetchSetting`）+ 强制共享 http client + context 超时 + 体积上限（LimitReader(N+1)+计数）+ Content-Type 白名单 | `service/gcs_transfer.go` |
| 13 | 计费失败须打 error 日志 + 计入失败指标（`RefundTaskQuota`/`RecalculateTaskQuota`/`settleTaskBillingOnComplete` 现有吞错 return）；不做自动补做——终态 CAS 单赢家已保证计费互斥 | `service/task_billing.go` |
| 14 | 可观测性指标（4.8 清单） | `service/gcs_transfer.go` 等 |
| 15 | 删除旧版死代码 | `controller/task_video.go` |
| 16 | 上线前 SA 实签验证 + 用户文档（保留期契约、expires_at、拿到即下载） | 部署/文档 |

预估规模：~1000-1500 行 Go 代码 + 配置（读取侧收口与 adaptor 接口占大头）。

## 6. 风险与注意事项

1. **用户感知的成功延迟**：对外 success 时间 = 上游完成 + 转存耗时（大文件几十秒到几分钟）；这是「转存完成才返回」语义的固有代价，需让业务方知晓。`FinishTime` 语义随之变为转存完成时刻，影响时长统计口径。Gemini/Vertex 因 tryRealtimeFetch 改为只读，额外多至一个轮询周期（≤15s+）的延迟。
2. **状态机红线**：`UpstreamDoneAt != 0` 的任务 progress 绝不可写 "100%"（终态除外），否则同时退出轮询与超时清扫集合，永久卡死且资金悬置（见 3.3）；任何任务落库禁止 `task.Update()`/`DB.Save`，必须走 `UpdateWithStatus(snap.Status)`。实现后以 4.8 的卡死哨兵监控。
3. **GCS 故障**：转存中任务积压会占据轮询集合（按 id 升序取前 `TASK_QUERY_LIMIT=1000` 条），积压过多会饿死新任务的轮询。需要：积压量告警 + `GCS_TRANSFER_ENABLED` 紧急开关止血（切换语义见 4.6，存量任务降级完成而非退款）；必要时调大 `TASK_QUERY_LIMIT`。
4. **截止窗口的三方配置约束**：`transferDeadline = 2h` 必须小于各渠道直链最短时效、远大于单次转存超时（10 分钟）与最坏排队时间；同时 `TASK_TIMEOUT_MINUTES` 必须显著大于「最长上游生成时间 + transferDeadline」（默认 24h vs 2h 满足），否则全局 sweep 会先于 transferDeadline 误杀在途转存并击穿紧急开关的"禁止退款"语义（见 4.4 重试模型）。截止边界误杀在途转存的窗口极窄，列为已知损耗。
5. **轮询单点**：转存触发与重试驱动只在 master 节点运行（`main.go:134`），master 宕机期间转存停摆（恢复后自动续上）；tryRealtimeFetch 已改为只读，slave 不参与转存。
6. **出口带宽与费用**：每个视频经网关下载 + 上传各一次；GCS 存储与出口流量产生费用。bucket 生命周期规则（30 天删除）与 `GCS_RESULT_RETENTION_DAYS` 必须保持一致，读取侧过期检查依赖它（见 4.5）。**不建议转 Coldline**：302 直连签名 URL 会把取回费打到项目账上且无限流。
7. **数据库兼容**：`PrivateData` 整列 JSON 存 TEXT，新增字段无 schema 迁移，SQLite/MySQL/PostgreSQL 天然兼容；但新字段仅限可比较类型（`Value()` 以 `==` 判零值），多值数据序列化为 JSON 字符串。
8. **计费互斥**：终态计费的互斥完全由既有 status CAS 单赢家提供（`UpdateWithStatus` 的 `IN_PROGRESS → 终态` 只有一个赢家、赢者才计费），无需去重标记或对账扫描。残余的"CAS 赢落库后、计费执行前崩溃→该次计费丢失"窗口与既有 success/sweep 路径同级、仓库长期接受，不引入比基线更差的风险（见 4.4）。
9. **既有隐患（本期知晓即可）**：结算后 `RecalculateTaskQuota` 更新的 `task.Quota` 不回写 DB（`service/task_billing.go:217`），若未来出现二次结算路径会按旧预扣额度重复算差额。
