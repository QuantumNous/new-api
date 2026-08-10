# TechMobi 生成视频 GCS 24 小时归档设计

## 状态

- 日期：2026-08-06
- 用户选择：方案 1，使用独立视频结果桶
- 范围：渠道记录 106 当前对应的 `ChannelTypeTechMobiVideo`（类型 105）
- 目标环境：生产与 staging；生产先在 staging 验证后发布

## 背景

TechMobi 任务成功后，上游返回约 24 小时有效的签名视频 URL。当前任务轮询把完整上游响应保存到 `task.Data`，把客户可见结果写成 `/v1/videos/{task_id}/content`。下载接口再从 `task.Data` 解析上游 URL，由 Cloud Run 回源并将视频字节转发给客户端。

该实现有三个直接后果：

1. 上游签名 URL 过期后，任务仍显示成功，但内容接口无法继续下载。
2. 国内用户的完整下载经过 Cloud Run 中转，实测首包和吞吐均弱于 GCS 直连。
3. Cloud Run 承担整个视频下载流量，且当前代理没有为 TechMobi 结果提供持久副本。

现有 `vocai-gemini-prod-flatkey-assets` 是输入资产源文件桶。它启用版本控制和 7 天软删除，输入资产保留由数据库清理任务控制，不能把生成结果的 24 小时策略混入该桶。

## 目标

1. TechMobi 任务成功后，把生成视频流式归档到私有 GCS，不在内存或本地磁盘缓存完整文件。
2. 用户下载时直接访问 `storage.googleapis.com`，不再让 Cloud Run 转发已归档视频字节。
3. 用户可下载窗口严格为归档成功后的 24 小时；短期签名 URL 不超过该剩余窗口。
4. 使用独立桶隔离生命周期，关闭版本控制和软删除，减少删除后的继续占用。
5. 在生产多实例下保证同一任务只形成一个有效对象，重复轮询和并发归档保持幂等。
6. 旧任务没有归档信息时保持现有上游代理行为，不做破坏性迁移。

## 非目标

- 本次不把所有视频渠道统一迁移到 GCS。
- 本次不改变输入资产 `asset://`、30 天源文件保留或 BytePlus 资产绑定流程。
- 本次不把结果桶公开，也不返回永久公开 URL。
- 本次不承诺 GCS 生命周期动作在到期瞬间完成；应用访问层负责精确的 24 小时可下载窗口。
- 本次不建立长期视频媒体库或用户手工续期能力。

## 方案取舍

### 采用：独立结果桶，任务完成即归档

独立桶允许关闭版本控制和软删除，并把 24 小时生命周期限制在生成结果范围内。任务完成即归档保证无人下载的视频也不会因为上游 URL 过期而丢失于有效窗口内，且首位下载用户不会承担首次复制延迟。

### 未采用：共用输入资产桶加路径前缀

共用桶会继承现有 7 天软删除和版本控制，删除后的对象仍继续占用存储；修改共享桶策略也增加误删输入资产的风险。

### 未采用：首次下载时再缓存

懒缓存减少从未被下载的视频对象数量，但首位用户仍经过慢链路，并且视频可能在首次下载前已经接近或超过上游签名期限。

## 架构

### 独立 GCS 桶

生产桶命名为 `vocai-gemini-prod-video-results`，staging 桶命名为 `vocai-gemini-prod-video-results-staging`，位置与运行时保持 `US-WEST1`。

桶配置：

- Uniform bucket-level access：开启
- Public access prevention：`enforced`
- Versioning：关闭
- Soft delete：显式设置 `retention_duration_seconds = 0`；不能通过省略配置块表达关闭
- Lifecycle：当前对象创建满 1 天后删除
- `force_destroy`：关闭，避免 Terraform 销毁时批量删除仍存在的结果
- 标签：`app=newapi`、对应环境、`data_class=generated-video-results`

运行时服务账号只获得该桶的 `roles/storage.objectUser`。签名继续使用现有运行时服务账号对自身的 `roles/iam.serviceAccountTokenCreator`，不新增公开 IAM、项目级 Storage Admin 或静态服务账号密钥。

### 应用配置

新增以下配置，生产和 staging 使用不同桶名：

- `VIDEO_RESULT_STORAGE_BUCKET`
- `VIDEO_RESULT_SIGNED_URL_TTL_SECONDS`，默认 900 秒，上限 3600 秒
- `VIDEO_RESULT_RETENTION_SECONDS`，固定默认 86400 秒；生产配置也设为 86400
- `VIDEO_RESULT_FETCH_TIMEOUT_SECONDS`，默认 1800 秒，上限 3600 秒
- `VIDEO_RESULT_MAX_BYTES`，默认 500 MiB

Terraform 只创建资源并为首次启动提供默认值。由于生产 Cloud Run 环境变量由 CI/CD 与 `gcloud` 管理且在 Terraform 中 `ignore_changes`，部署工作流必须把结果桶配置同步写入 `newapi-console`、`newapi-router`、staging 服务和兼容部署目标。

### 任务私有数据

在 `model.TaskPrivateData` 增加可选的 `VideoResult` 结构，不新增数据库列：

- `bucket`
- `object`
- `generation`
- `content_type`
- `size`
- `stored_at`
- `expires_at`

该结构位于 `private_data` JSON 中，不通过任务 DTO、日志或客户响应暴露。现有 `ResultURL` 继续保存本站 `/v1/videos/{task_id}/content` 地址，保持 API 合同和白标行为不变。

对象键使用确定性格式：

`video-results/{YYYYMMDD}/{public_task_id}.mp4`

日期取归档开始时间的 UTC 日期，任务 ID 经过既有公开任务 ID 校验，不接受调用方提供任意对象路径。

## 数据流

### 任务完成与归档

1. 主节点后台轮询按现有流程调用 TechMobi `FetchTask`。
2. 适配器解析到成功状态和真实上游视频 URL。
3. 在把任务推进到最终成功状态前，TechMobi 专用结果归档器验证 URL 和下载策略。
4. 归档器使用渠道代理配置创建 HTTP 客户端，从上游流式读取并写入 GCS writer。
5. 读取使用有界流，超过 `VIDEO_RESULT_MAX_BYTES` 时中止；GCS writer 通过 `CloseWithError` 放弃不完整对象。
6. 写入使用“对象不存在”前置条件。并发写入中只有一个请求创建对象；其余请求读取既有对象属性并复用。
7. 写入完成后读取对象 generation、大小和内容类型，计算 `expires_at = stored_at + 86400`，写入 `TaskPrivateData.VideoResult`。
8. 归档元数据与任务成功状态通过现有 CAS 更新持久化；胜出的状态转换负责一次性计费结算。

如果归档失败，本轮不把任务推进到最终成功状态，返回错误让后台下一轮重新查询并重试。这样不会创建“API 显示成功但新结果没有可用副本”的任务。上游成功响应仍只保存在本轮内存中，下一轮重新查询上游获得当前可用 URL。

### 用户下载

1. 客户仍访问 `/v1/videos/{public_task_id}/content`。
2. 下载接口加载任务并完成现有任务、渠道和状态校验。
3. TechMobi 任务存在 `VideoResult` 时，先判断 `now < expires_at`。
4. 接口生成 V4 签名 GET URL，TTL 为配置值、3600 秒上限和对象剩余有效时间三者的最小值。
5. 接口返回 `302 Found`，`Location` 指向 GCS；响应设置 `Cache-Control: no-store`，不把签名 URL写入日志。
6. 客户端直接从 GCS 下载。GCS 负责 `Range`、`Content-Length`、ETag 和传输吞吐。

到达 `expires_at` 后，即使生命周期动作尚未物理删除对象，内容接口也返回 `410 Gone`，不再签发新 URL。签名 URL本身不会超过对象的剩余有效窗口。

### 旧任务兼容

没有 `VideoResult` 的 TechMobi 历史任务继续走现有逻辑：从 `task.Data` 解析上游 URL，经 Cloud Run 代理。该兼容路径不承诺超过原上游 URL 的有效期，也不会在本次变更中自动补归档。

## 幂等与多实例

生产可能有多个 console 实例同时执行主节点后台逻辑。正确性不依赖进程内锁：

- 确定性对象键把同一任务映射到同一对象。
- GCS generation precondition 保证对象只创建一次。
- 已存在对象必须读取并验证内容类型和非零大小后才能复用。
- 任务状态和私有元数据使用现有 `UpdateWithStatus` CAS；只有状态转换胜者执行结算。
- 归档请求超时或实例终止留下的不完整 writer 不会形成可复用对象。

## 安全

- 结果桶始终私有并强制 Public Access Prevention。
- 上游 URL 和 GCS 签名 URL 不进入客户 JSON、应用日志、GitHub 输出或 Terraform state。
- 上游 URL 继续通过现有 SSRF 校验；只允许配置中的协议、端口、域名/IP 策略。
- 对象路径由服务端生成，防止路径穿越或跨任务读取。
- 下载签名只允许 `GET`，不授予写入或列桶权限。
- GCS 对象设置 `Content-Type: video/mp4` 或经过验证的 `video/*`，并设置安全的 `Content-Disposition: attachment` 文件名。

## 错误语义

- 上游下载失败、超时或非 2xx：归档失败，任务保留可轮询状态，下一轮重试。
- 内容超过上限或 MIME 明确不是视频：归档失败并记录脱敏错误；不保存部分对象。
- GCS 写入失败：归档失败并重试，不把任务标成成功。
- 并发对象已存在且属性有效：视为幂等成功。
- 并发对象已存在但大小为零或类型无效：返回存储错误并告警，不覆盖未知对象。
- 已归档对象在 24 小时内意外缺失：返回 `502` 存储错误并记录 task ID、bucket/object 哈希化标识，不回显签名或上游 URL。
- 已到 `expires_at`：返回 `410 Gone`。
- 签名服务暂时失败：返回 `503`，客户端可重试；不回退到 Cloud Run 全量转发。

## 生命周期语义

应用层的可下载截止时间是精确的 `stored_at + 24h`。Google 官方文档说明 `age=1` 从对象上传完成时间计算，对象在满 24 小时后满足删除条件；Lifecycle 动作异步执行，没有删除完成的硬 SLA。对于简单的 age-based Delete 规则，即使物理删除稍有延迟，对象在过期时间后也停止产生存储费用。Lifecycle 配置变更本身最多可能需要 24 小时生效，因此它不能作为精确到秒的访问控制。因此：

- 访问控制以 `expires_at` 为准。
- 签名 URL 永远不会越过 `expires_at`。
- 桶通过 `retention_duration_seconds = 0` 显式关闭软删除，并关闭版本控制，使生命周期动作执行后不再保留可恢复副本。
- 监控对象数量、总字节数以及超过 48 小时仍存在的对象；出现异常时告警，而不是自动扩大公开权限或保留周期。

## 可观测性

新增结构化指标：

- `video_result_archive_total{channel,outcome}`
- `video_result_archive_bytes_total{channel}`
- `video_result_archive_duration_seconds{channel}`
- `video_result_redirect_total{channel,outcome}`
- `video_result_archive_retry_total{channel,reason}`

日志只记录公开 task ID、渠道类型、阶段、状态码、字节数和耗时。上游 URL、签名 URL、Authorization、对象签名参数及渠道密钥必须脱敏或不记录。

## 测试策略

### 单元测试

- 配置默认值、上下限和环境覆盖。
- 确定性对象键和非法任务 ID。
- 流式写入不读取超过大小上限。
- generation precondition 冲突复用有效对象。
- 部分写入失败调用 `CloseWithError`。
- 归档成功后填写完整 `VideoResult`。
- 归档失败时任务不进入成功状态且不结算。
- `TaskPrivateData` JSON、Snapshot 和 CAS 比较包含归档元数据。
- 下载签名 TTL 取配置、上限和剩余窗口的最小值。
- 24 小时到期返回 410；对象缺失返回 502；签名失败返回 503。
- 历史任务没有归档元数据时仍走现有上游代理。

### 集成与基础设施验证

- 使用 fake upstream 和 fake object store 验证完整“轮询成功 → 归档 → 任务成功 → 302”流程。
- 两个并发归档请求只形成一个对象并只结算一次。
- `terraform fmt -check`、`terraform validate`。
- 刷新真实 state 的 `terraform plan` 必须只显示预期的新桶、IAM 和配置引用；不允许出现 Cloud Run image、traffic、env 或 VPC drift。
- staging 生成真实 TechMobi 视频，验证对象私有、302 直连、Range 206、国内下载速度、到期阻断和生命周期清理。

## 发布顺序

1. 合并应用与 Terraform 代码，但不直接绕过生产审批。
2. Terraform 创建 staging/生产结果桶与 IAM；生产 apply 前审查完整 plan。
3. 部署工作流把结果桶环境变量写入 staging console/router。
4. staging 执行真实视频生成和下载验收。
5. 部署生产 console 和 router。两者都需要新代码：console 负责轮询归档，router/console 都可能服务内容接口并签发 URL。
6. 观察归档成功率、重试率、对象数量和下载 4xx/5xx。
7. 确认稳定后保持 106 渠道归档开启；本次不自动扩展到其他渠道。

## 回滚

- 应用回滚到旧版本后，已有 `VideoResult` 私有数据会被旧代码忽略，旧代理行为恢复。
- 不立即删除结果桶；等待生命周期清理现有对象，避免回滚操作扩大数据丢失范围。
- 环境变量可以保留，旧版本不会读取。
- Terraform 不对有对象的桶使用 `force_destroy`，因此误操作不会静默批量删除结果。

## 验收标准

1. 新 TechMobi 成功任务在 GCS 形成一个私有、非零大小的视频对象。
2. 客户任务响应仍只暴露本站 `/content` URL，不暴露上游或桶信息。
3. `/content` 返回短期 GCS 302，跟随跳转后支持 Range 206 和完整视频下载。
4. 对象归档后 24 小时不再获得下载签名，接口返回 410。
5. 桶未开启版本控制和软删除，生命周期最终删除满 1 天对象。
6. 并发轮询不会形成重复对象或重复结算。
7. 旧任务下载路径保持现状。
8. staging 真实任务通过后才允许生产部署。

## 官方依据

- [Google Cloud Storage Object Lifecycle Management](https://docs.cloud.google.com/storage/docs/lifecycle)：对象 age 计时、动作异步执行及 age-based Delete 的计费语义。
- [Manage object lifecycles](https://docs.cloud.google.com/storage/docs/managing-lifecycles)：Lifecycle 配置变更最多可能需要 24 小时生效。
- [Soft delete overview](https://docs.cloud.google.com/storage/docs/soft-delete) 与 [Disable soft delete](https://docs.cloud.google.com/storage/docs/disable-soft-delete)：软删除保留期间继续计费，保留期设为 0 表示关闭。
- [Terraform `google_storage_bucket`](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/storage_bucket)：`soft_delete_policy.retention_duration_seconds = 0` 的关闭方式；省略配置块不会主动清除服务端策略。
- [Cloud Storage Signed URLs](https://docs.cloud.google.com/storage/docs/access-control/signed-urls) 与 [V4 GET sample](https://docs.cloud.google.com/storage/docs/samples/storage-generate-signed-url-v4)：V4 签名 URL 和官方 15 分钟示例。
