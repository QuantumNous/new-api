# BytePlus 真人素材本地上传 GCS 回退设计

## 背景与决定

真人素材 API 已支持公网 HTTPS URL 和 `multipart/form-data` 本地文件。当前 multipart 路径只能使用渠道凭据中的 BytePlus TOS 配置，而现有账号不能创建 TOS Bucket，因此即使真人档案已经认证为 `active`，本地文件仍会返回 `asset_channel_unavailable`。

本设计选择复用 Flatkey 已有的私有 GCS 临时媒体桶作为回退存储。staging 默认使用 `vocai-gemini-prod-flatkey-temp-media-staging`；对象始终保持私有，只通过 12 小时 V4 签名 GET URL 交给 BytePlus `CreateAsset` 下载。URL 模式保持不变。

## 目标

- 同时保留三条摄取路径：客户公网 HTTPS URL、multipart 经 GCS 临时存储、multipart 经 TOS 临时存储。
- 当 BytePlus 渠道没有完整可用的 TOS 配置时，真人素材 multipart 上传自动使用 GCS。
- 保持当前图片、视频、音频格式、大小、幂等和真人档案状态校验不变。
- 不公开 Bucket，不把云存储凭据、对象 key 或签名 URL返回给客户。
- BytePlus 完成素材摄取或签名 URL 到期后，沿用现有清理任务删除临时对象。
- 已完整配置 TOS 的渠道继续使用 TOS，避免改变其既有存储路径。

## 非目标

- 不增加客户可见的“选择存储后端”参数。
- 不让客户提供 GCS、TOS 或其他云厂商凭据。
- 不修改公网 HTTPS URL 创建素材的路径。
- 不改变真人档案和素材按 Flatkey `user_id` 隔离的现状。
- 不把 GCS 临时对象当作长期素材源；长期素材仍由 BytePlus 私有素材库持有。

## 架构

### 三条摄取路径

| 客户请求 | 临时存储 | 使用条件 | 最终结果 |
| --- | --- | --- | --- |
| JSON 公网 HTTPS URL | 无 Flatkey 临时对象 | 客户已有可匿名下载的 URL | BytePlus 摄取后返回 Flatkey `ast_...` |
| multipart 本地文件 | 私有 GCS | TOS 尚未配置时的默认回退 | BytePlus 摄取后返回 Flatkey `ast_...` |
| multipart 本地文件 | 私有 TOS | 渠道以后具备完整 TOS 配置 | BytePlus 摄取后返回 Flatkey `ast_...` |

客户只需要选择 URL 或 multipart，不需要知道 multipart 最终走 GCS 还是 TOS。TOS 配置完整时优先使用 TOS；未配置时使用 GCS，因此以后建立 TOS Bucket不会移除或破坏 GCS 回退能力。

### 存储适配器

保留 `BytePlusTempObjectStore` 作为 multipart 上传的统一边界，新增 GCS 实现：

- `PutObject`：使用 Application Default Credentials 流式写入私有 GCS Bucket。
- `PresignGet`：通过 Cloud IAM `SignBlob` 生成 V4 GET 签名 URL，TTL 保持 12 小时。
- `DeleteObject`：删除临时对象；失败时进入现有重试清理队列。
- `TempObjectBucket`：返回实际 Bucket，并继续持久化到 `byte_plus_asset_temp_objects.bucket`。

GCS 实现复用 `service/temp_media.go` 的 Bucket 选择、服务账号发现和 IAM 签名逻辑，不引入新 SDK 或新凭据。

### 后端选择

创建 multipart 素材时：

1. 渠道的 ModelArk 凭据仍需有效，且真人档案必须归属当前用户。
2. 如果渠道包含完整且校验通过的 TOS 配置，使用现有 TOS store。
3. 如果 TOS 配置缺失，使用当前环境的 GCS 临时媒体配置。
4. 如果 GCS 也不可用，返回稳定的 `503 asset_channel_unavailable`，不读取文件主体、不创建上游素材。

不会在 TOS 客户端运行时错误后静默切换到 GCS；只有“未配置 TOS”才触发回退，以免掩盖已配置渠道的权限或区域错误。

### 持久化与清理路由

临时对象表已经保存 `bucket` 和 `object_key`，无需数据库迁移。清理任务根据持久化 Bucket 选择后端：

- Bucket 等于当前 GCS 临时媒体 Bucket时，使用 GCS 删除。
- 其他 Bucket继续按渠道 TOS 配置删除。

这样即使渠道稍后补上 TOS 配置，先前写入 GCS 的对象仍会由正确后端清理。幂等恢复在重新签名原对象时也按原对象 Bucket 选择后端，不能用新的默认后端处理旧对象。

## 数据流

1. 客户使用 Flatkey API Key 提交 multipart 文件。
2. Flatkey 在流式读取过程中嗅探媒体类型、计算 SHA-256，并执行现有大小限制。
3. Flatkey 将对象写入选定的私有临时存储，并在数据库记录 Bucket、对象 key、摘要和大小。
4. Flatkey生成 12 小时签名 URL，只在服务端调用 BytePlus `CreateAsset` 时使用。
5. 客户收到现有的 `ast_...` 和 `asset://ast_...`，不会看到签名 URL。
6. 清理任务在签名 URL 到期后探测最终素材状态并删除临时对象；删除失败继续按现有 CAS/退避机制重试。

### 临时对象与长期素材的关系

GCS/TOS Bucket本身不会被删除；清理任务只删除每次 multipart 上传产生的临时对象。该对象是 BytePlus `CreateAsset` 的一次性摄取源，不是视频生成时反复读取的长期素材。

BytePlus 摄取成功后会生成并持有自己的上游 `AssetId`。Flatkey 将其映射为客户可见的 `ast_...` / `asset://ast_...`。后续 Seedance 请求解析的是这个上游素材资产，而不是原始 GCS/TOS 签名 URL。因此，在素材状态已经进入 `Active` 后，即使临时对象和签名 URL被清理，`asset://ast_...` 仍可继续使用。

签名 URL和临时对象至少保留现有 12 小时摄取窗口。清理任务先执行最终状态探测，再按现有到期清理流程处理对象；上传、签名或上游创建失败产生的孤儿对象也由同一队列重试删除。

## 安全与错误处理

- GCS Bucket和对象保持私有；不设置 `public-read`。
- 对象 key 使用现有随机生成逻辑并按用户分区，日志不得打印对象 key 或签名 URL。
- 上传失败返回 `500 asset_storage_error`；存储后端不可选返回 `503 asset_channel_unavailable`。
- 签名失败不得调用 BytePlus；已写入对象进入现有清理流程。
- 幂等冲突、重放和未知结果继续使用现有请求摘要与账本语义。
- 不记录或复用用户此前提供的 TOS Secret。

## 测试策略

测试必须先失败再实现，覆盖：

1. 缺少 TOS 配置时，multipart 选择 GCS，而不是返回 503。
2. 完整 TOS 配置仍选择 TOS。
3. GCS store 正确流式写入、按请求 TTL 签名和删除对象。
4. 清理任务依据持久化 Bucket 删除 GCS 对象；后续补充 TOS 配置不会误删到 TOS。
5. GCS 不可用时返回稳定错误且不调用上游。
6. 原有 URL 模式、TOS multipart、格式/大小、幂等和清理测试全部保持通过。
7. GCS/TOS 临时对象删除后，已为 `Active` 的 Flatkey 素材仍保留 `asset://ast_...` 映射且可通过引用校验。

## 发布与验证

先在功能分支完成目标测试、相关 service 测试、`go vet ./service`、格式和 diff 检查，再只把本功能提交推广到 `staging`。部署后使用已认证的 staging 真人档案上传一张本地图片，确认：

- API 返回素材 ID，状态进入 `Processing` 或后续成功状态；
- 客户响应和普通日志中没有 GCS 对象 key 或签名 URL；
- 临时对象使用 staging GCS Bucket；
- 到期清理仍能由后台任务处理。

生产和 `main` 不在本次授权范围内。
