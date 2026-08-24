# BytePlus 虚拟人像素材库设计

日期：2026-07-29
状态：已完成会话设计确认，等待书面规格审阅

## 1. 背景与目标

Flatkey 已通过现有 `ChannelTypeBytePlus` 及其 Seedance 任务适配器成功调用 BytePlus Seedance 2.0。下一步是在不新增渠道 Type 的前提下接入 BytePlus 虚拟人像素材库，并让 Flatkey API Token 用户可以创建、查询和安全引用自己的素材。

本设计的目标是：

- 复用现有 BytePlus 视频渠道及其生命周期；
- 由 Flatkey 内部管理 BytePlus 资产组，不向客户暴露上游 `GroupId`；
- 向客户返回 Flatkey 自有资产 ID，不暴露上游 `AssetId`；
- 使用数据库持久化资产归属，保证生产多节点下的一致权限判断；
- 在 Seedance 2.0 视频提交前完成资产归属校验、状态校验和渠道固定；
- 保持旧纯字符串渠道 Key 和现有非素材视频请求兼容。

## 2. 范围

### 2.1 本期包含

1. 内部创建或复用 BytePlus 资产组；
2. 对外提供创建资产接口；
3. 对外提供查询资产状态接口；
4. 支持 `Image`、`Video`、`Audio` 三种资产类型；
5. 创建资产时默认使用 `Moderation.Strategy=Default`，调用方可显式使用 `Skip`；
6. Seedance 2.0 视频请求支持 `asset://<flatkey_asset_id>`；
7. 视频提交前校验用户归属、资产状态及渠道兼容性，并将 Flatkey 资产 ID 改写为 BytePlus 上游资产 ID；
8. 使用渠道 131 完成真实的创建、轮询和生视频冒烟验证，但代码不得硬编码生产渠道 ID。

### 2.2 本期不包含

- 不新增视频渠道 Type；
- 不向客户开放资产组 CRUD 或 BytePlus `GroupId`；
- 不允许共享 Flatkey BytePlus 账号的客户直接进入 BytePlus 控制台管理资产；
- 不支持客户自带 BytePlus AK/SK（BYOK）；
- 不实现资产删除、资产组删除或资产列表接口；
- 不改变 Seedance 2.0 视频 Content Pre-filter 的现有行为；资产创建的 `Moderation.Strategy` 与视频 Content Pre-filter 是两个独立机制；
- 不为 `seedance-2.0-fast` 或 `seedance-2.0-mini` 承诺跨渠道复用资产；本期验收模型为 `seedance-2.0`。

## 3. 方案选择

### 3.1 采用方案：复用现有 BytePlus 渠道 Type

视频 API Key、BytePlus AK/SK 和 ProjectName 作为结构化凭据保存在现有 `ChannelTypeBytePlus` 的 `Channel.Key` 中。资产组绑定具体渠道，资产继承资产组渠道，使用资产的视频请求固定到该渠道。现有 BytePlus 适配器继续复用 Doubao/Ark 的协议映射，但资产能力不开放给其他渠道 Type。

选择该方案的原因：

- 凭据、启停状态、模型能力和渠道生命周期保持在同一配置对象中；
- 支持未来配置多个 BytePlus 账号或项目；
- 不需要复制一套资产专用渠道协议和后台配置；
- `Channel.Key` 已有现成的后台隐藏处理，而 `Channel.OtherSettings` 会作为 `settings` 返回前端，不适合保存 AK/SK。

### 3.2 未采用方案

1. **全局系统配置**：实现较简单，但凭据脱离渠道生命周期，不利于多账号、多项目和故障隔离。
2. **新增资产专用渠道 Type**：边界独立，但与现有 BytePlus 渠道重复配置及协议，当前三个资产操作不足以抵消维护成本。
3. **客户直接使用 BytePlus 控制台，Flatkey 仅拦截权限**：共享 BytePlus 账号无法可靠证明某个上游资产属于哪个 Flatkey 用户，且客户可以绕过 Flatkey 的创建记录和状态同步。本期不采用；未来若支持 BYOK，可重新评估。

## 4. 外部 API

所有接口位于 `/v1`，使用 `middleware.TokenAuth()`。资产接口不挂载普通视频请求使用的 `middleware.Distribute()`，而是在资产服务内选择并固定有素材库能力的渠道。

### 4.1 创建资产

```http
POST /v1/assets
Authorization: Bearer <flatkey-api-key>
Content-Type: application/json
```

```json
{
  "url": "https://example.com/portrait.mp4",
  "asset_type": "Video",
  "moderation": {
    "strategy": "Default"
  }
}
```

请求规则：

- `url` 必填，必须是 BytePlus 可访问的绝对 HTTPS 公网地址；Flatkey 不主动下载该 URL；
- `asset_type` 必须是 `Image`、`Video` 或 `Audio`；
- `moderation` 可省略；省略时发送 `Default`；
- `moderation.strategy` 只允许 `Default` 或 `Skip`；
- 客户不能提交 `GroupId`、ProjectName、渠道 ID 或上游 AssetId。

成功响应只返回 Flatkey 资产标识：

```json
{
  "id": "ast_xxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "asset",
  "asset_type": "Video",
  "status": "Processing",
  "moderation": {
    "strategy": "Default"
  },
  "created_at": 1785292000
}
```

### 4.2 查询资产

```http
GET /v1/assets/ast_xxxxxxxxxxxxxxxxxxxxxxxx
Authorization: Bearer <flatkey-api-key>
```

处理流程：

1. 按当前 `user_id` 和 Flatkey 资产 ID 查询本地记录；
2. 加载资产绑定渠道的凭据；
3. 使用本地保存的上游 AssetId 调用 BytePlus `GetAsset`；
4. 将 `Processing`、`Active` 或 `Failed` 及脱敏错误信息同步到本地；
5. 返回 Flatkey 资产对象，不返回上游 AssetId、GroupId、渠道 ID、ProjectName 或供应商主机名。

## 5. 数据模型

### 5.1 BytePlusAssetGroup

资产组是纯内部实体，不提供外部路由。

建议字段：

- `id`：本地主键；
- `user_id`：Flatkey 用户 ID，建立索引；
- `channel_id`：创建资产组所使用的渠道，建立索引；
- `upstream_group_id`：BytePlus GroupId，不对外返回；
- `status`：`Creating`、`Active` 或 `Failed`；
- `error_message`：脱敏后的最近错误；
- `created_time`、`updated_time`：Unix 时间；
- `lease_updated_time`：内部创建租约更新时间，用于多节点崩溃恢复。

约束：

- 对 `(user_id, channel_id)` 建唯一索引；
- 不依赖数据库外键级联，保持与仓库现有 GORM 和三数据库兼容策略一致；
- 上游名称使用不包含邮箱、用户名等个人信息的内部标识。

### 5.2 BytePlusAsset

建议字段：

- `id`：本地主键；
- `public_id`：对外的不透明 `ast_...` 标识，建立唯一索引；
- `user_id`：资产所有者，建立组合查询索引；
- `asset_group_id`：本地资产组主键；
- `channel_id`：冗余保存固定渠道，便于视频分发前快速校验；
- `upstream_asset_id`：BytePlus AssetId，不对外返回；
- `asset_type`：`Image`、`Video` 或 `Audio`；
- `source_url`：调用方提交的源 URL；
- `moderation_strategy`：最终发送的 `Default` 或 `Skip`；
- `status`：本地创建阶段为 `Creating`，上游阶段为 `Processing`、`Active` 或 `Failed`；
- `error_message`：脱敏后的最近错误；
- `created_time`、`updated_time`：Unix 时间。

`public_id` 必须使用密码学安全的随机值，不得使用可枚举的自增主键编码。

两个模型都加入 `model/main.go` 的普通和快速 AutoMigrate 路径，并且只使用 GORM 可跨 SQLite、MySQL 5.7.8+、PostgreSQL 9.6+ 表达的字段与索引。

## 6. 渠道凭据

### 6.1 兼容格式

旧渠道继续允许纯视频 API Key：

```text
ark-...
```

启用素材库的渠道使用 JSON：

```json
{
  "api_key": "ark-...",
  "access_key_id": "...",
  "secret_access_key": "...",
  "project_name": "..."
}
```

解析规则：

- 非 JSON 字符串按旧 `api_key` 处理；
- JSON 必须由统一解析器读取，业务代码使用仓库 `common.*` JSON 包装函数；
- JSON 只要被识别为结构化凭据但格式错误或字段类型错误，就返回配置错误，不把整段 JSON 当作 Bearer Key；
- 视频提交、视频轮询和后台任务轮询都只向 Authorization Header 写入解析后的 `api_key`；
- 只有启用状态、类型为 `ChannelTypeBytePlus`、支持目标模型且 AK、SK、ProjectName 完整的渠道才具备资产能力；
- 缺少资产字段的旧渠道仍可处理不含 Flatkey 资产引用的普通视频请求。

### 6.2 安全边界

- 不把 AK/SK 放进 `Channel.OtherSettings`；
- API 响应、普通日志、上游错误和测试输出中不得出现任何完整凭据或签名头；
- 延用现有 `Channel.Key` 存储和后台掩码机制。本期不改变数据库静态加密能力；
- 凭据解析错误只返回字段级的通用配置说明，不回显 Key 内容。

## 7. BytePlus Client 与签名

资产 Client 封装三个操作：

- `CreateAssetGroup`
- `CreateAsset`
- `GetAsset`

固定协议参数：

- Host：`ark.ap-southeast-1.byteplusapi.com`
- Version：`2024-01-01`
- Service：`ark`
- Region：`ap-southeast-1`
- Algorithm：`HMAC-SHA256`

实现应提取或泛化现有 Jimeng 火山签名逻辑，形成可传入 service、region、时间和请求内容的可测试签名器；不得复制一份难以校验的签名实现，也不新增依赖。所有 JSON 编解码使用 `common.*`。

上游请求：

### 7.1 CreateAssetGroup

```json
{
  "Name": "<opaque-internal-name>",
  "Description": "Flatkey managed virtual portrait assets",
  "GroupType": "AIGC",
  "ProjectName": "<channel-project-name>"
}
```

### 7.2 CreateAsset

```json
{
  "GroupId": "<stored-upstream-group-id>",
  "URL": "https://example.com/portrait.mp4",
  "AssetType": "Video",
  "Moderation": {
    "Strategy": "Default"
  },
  "ProjectName": "<channel-project-name>"
}
```

### 7.3 GetAsset

请求使用本地保存的上游 AssetId 和渠道 ProjectName。响应状态只接受 `Processing`、`Active`、`Failed`；未知状态不得被当作成功，应记录为可诊断的上游协议错误。

## 8. 资产组创建与多节点一致性

生产环境有多个应用实例，不能使用进程锁或内存状态保证资产组唯一性。

创建资产时执行以下流程：

1. 选择一个满足 Seedance 2.0、渠道启用、凭据完整条件的资产渠道；
2. 查询 `(user_id, channel_id)` 的 Active 资产组；
3. 不存在时尝试插入 `Creating` 占位记录，唯一约束决定唯一创建者；
4. 唯一创建者调用 BytePlus `CreateAssetGroup`，成功后写入 GroupId 并改为 `Active`；
5. 其他节点发现 `Creating` 时进行有上限的短暂等待和重读，超时后返回可重试错误；
6. `Creating` 租约超过恢复阈值时，后续请求可通过数据库条件更新取得恢复权，不依赖单节点定时器；
7. `Failed` 状态保存脱敏原因，并允许后续请求通过条件更新重试。

BytePlus `CreateAssetGroup` 没有纳入本期的删除或幂等补偿能力。如果上游成功后本地持久化永久失败，可能产生一个无法自动回收的上游孤立资产组。实现必须记录可关联的 Request ID 和渠道 ID 供运维定位，但不能向客户返回 GroupId；下一次恢复可创建新组，不得把未知结果伪报为成功。

## 9. 视频引用、权限校验与固定路由

客户在官方 Seedance `content[]` 中使用：

```json
{
  "type": "image_url",
  "image_url": {
    "url": "asset://ast_xxxxxxxxxxxxxxxxxxxxxxxx"
  },
  "role": "reference_image"
}
```

现有 `/v1` 视频路由顺序为 `TokenAuth()` 后执行 `Distribute()`。资产解析必须发生在随机渠道选择之前，不能等随机分发完成后再比较渠道，否则同一资产会出现偶发成功和偶发失败。

设计要求：

1. `Distribute()` 读取可复用请求体并仅对 Seedance 视频创建请求解析 `asset://ast_...`；
2. service 层按当前 Token 的 `user_id` 批量查询资产，不在 middleware 中直接执行 SQL；
3. 任何资产不存在或不属于当前用户时统一返回 404，防止枚举；
4. 所有资产必须为 `Active`；
5. 一个请求中的全部 Flatkey 资产必须绑定同一渠道；
6. 该渠道必须仍为启用状态、允许当前用户组、支持请求模型及当前请求端点，并正常取得渠道并发额度；
7. Token 已固定渠道时，固定渠道必须与资产渠道一致，否则拒绝；
8. 分发器把资产渠道作为本次请求的强制渠道，不参与随机选择，也不因失败静默切换其他 BytePlus 账号；
9. service 把 `public_id -> upstream_asset_id` 映射放入请求 context；
10. BytePlus 适配器复用的 Ark 请求构建逻辑将 `asset://ast_...` 改写为 `asset://<upstream_asset_id>`；
11. 不含 Flatkey 资产引用的请求完全沿用现有分发和内容透传行为。

失败或重试时必须保持资产渠道亲和性。资产渠道禁用、并发耗尽或模型不兼容时返回明确错误，不能切换到无法访问该上游资产的渠道。

## 10. 错误语义

| 场景 | HTTP | 稳定错误码 |
| --- | ---: | --- |
| URL、类型、Moderation 或资产 URI 非法 | 400 | `invalid_asset_request` |
| Token 无效 | 401 | 延用现有鉴权错误 |
| 资产不存在或不属于当前用户 | 404 | `asset_not_found` |
| 资产仍为 Creating/Processing | 409 | `asset_not_ready` |
| 资产已 Failed | 422 | `asset_failed` |
| 同一视频请求混用不同渠道的资产 | 409 | `asset_channel_conflict` |
| 资产渠道被禁用或不支持请求模型 | 503 | `asset_channel_unavailable` |
| 资产组正在由其他节点初始化 | 503 | `asset_group_initializing` |
| BytePlus 超时、非成功响应或协议异常 | 502 | `asset_upstream_error` |
| 数据库失败 | 500 | `asset_storage_error` |

错误正文使用现有 OpenAI 兼容错误结构。上游响应在写日志和返回前都要脱敏，不返回上游 Host、ProjectName、GroupId、AssetId、AK、SK、API Key、Authorization 或完整签名信息。

## 11. 测试与验收

### 11.1 单元测试

- 旧纯字符串 Key、新 JSON Key、结构化 Key 错误及缺字段；
- 视频提交与轮询均只使用 `api_key`；
- BytePlus HMAC 签名固定测试向量，包括 query 排序、header 排序、payload hash 和固定时间；
- CreateAssetGroup、CreateAsset、GetAsset 请求映射；
- Moderation 缺省为 `Default`，显式 `Skip` 原样发送；
- 资产状态映射和未知状态处理；
- `asset://ast_...` 解析、批量归属查询与上游 URI 改写；
- Processing、Failed、跨用户、跨渠道、渠道禁用、模型不兼容和 Token 固定渠道冲突；
- 不含 Flatkey 资产的普通 URL 请求保持原样。

### 11.2 数据与并发测试

- GORM AutoMigrate 在 SQLite 测试库成功；
- 唯一索引阻止两个节点为同一 `(user_id, channel_id)` 同时取得创建权；
- Creating 租约超时后的条件接管；
- 资产查询始终带 `user_id` 条件；
- 使用仓库现有数据库兼容检查覆盖 MySQL/PostgreSQL 生成或集成路径。

### 11.3 HTTP 与适配器测试

- `POST /v1/assets` 和 `GET /v1/assets/:id` 必须要求 Token；
- 对外响应不包含上游 ID、渠道 ID、ProjectName 或凭据；
- 视频分发在随机选渠道前固定到资产渠道；
- 现有 Seedance 创建、轮询、下载和非素材 `content[]` 回归通过；
- 运行相关包测试、`go test ./...`、`go vet ./...` 和 `go build ./...`。

### 11.4 真实冒烟验证

在获得明确的生产测试授权并配置渠道 131 的结构化 Key 后：

1. 使用一个无敏感内容的公网测试素材创建资产；
2. 轮询 Flatkey 资产 ID，直到 `Active`；
3. 使用 `asset://<flatkey_asset_id>` 创建 `seedance-2.0` 视频；
4. 确认实际渠道为 131；
5. 轮询任务并下载结果；
6. 使用另一用户 Token 验证同一资产返回 404；
7. 检查应用日志及客户端响应无上游 ID 和凭据泄漏。

## 12. 部署与运维影响

- 需要数据库 AutoMigrate 新增两张表；
- 需要将目标 BytePlus 渠道的 Key 从旧纯字符串更新为结构化 JSON；
- 改动影响 `/v1` 资产路由、视频分发、BytePlus 适配器及其复用的 Ark 请求构建逻辑和后台任务轮询；
- `Router deploy: required`，因为视频请求路由、上游鉴权和新 `/v1/assets` 接口均在 router 节点执行；
- `newapi-console` 同样需要部署，以保持共享数据库迁移和后台任务代码版本一致；
- `newapi-web`、Terraform 和 Cloudflare 不涉及；
- 应先部署 staging，执行迁移和真实或受控上游验证，再考虑生产 router/console 滚动发布；
- 回滚旧版本前必须确认新结构化 Key 不会被旧适配器当成 Bearer Token。安全回滚方式是先恢复渠道的旧纯字符串 Key，再回滚应用版本；新增数据表可以保留。

## 13. 安全说明

本设计文档不记录任何真实 API Key、AK、SK、Cookie 或 Session。实现和测试也不得把这些值写入仓库、测试快照或构建日志。曾通过聊天或临时命令传递过的凭据应在接入完成后轮换。

## 14. 验收条件

实现完成必须同时满足：

1. 客户无需知道或提交 BytePlus GroupId；
2. 客户只能看到 Flatkey 资产 ID；
3. 跨用户资产访问和视频引用均被阻止；
4. 资产视频请求稳定固定到资产渠道；
5. 旧渠道 Key 和普通 Seedance 请求无回归；
6. 多节点下资产组创建不会因进程本地锁而重复；
7. 数据库迁移兼容 SQLite、MySQL 和 PostgreSQL；
8. 自动测试、构建、静态检查及渠道 131 冒烟验证均通过；
9. 响应和日志中不泄露凭据或上游资产标识。

## 15. 官方参考

- [虚拟人像库接入总览](https://docs.byteplus.com/en/docs/ModelArk/2333565#assets-api-list)
- [创建资产组](https://docs.byteplus.com/en/docs/ModelArk/2318270)
- [创建资产](https://docs.byteplus.com/en/docs/ModelArk/2318271)
- [查询资产](https://docs.byteplus.com/en/docs/ModelArk/2318274)
- [使用人像资产生成视频](https://docs.byteplus.com/en/docs/ModelArk/2333565#generate-video-using-portrait-assets)
- [虚拟人像库 API 示例](https://docs.byteplus.com/en/docs/ModelArk/2333565#sample-code-in-other-programming-languages)
- [Seedance 2.0 Content Pre-filter](https://docs.byteplus.com/en/docs/ModelArk/Content_Pre-filter)
