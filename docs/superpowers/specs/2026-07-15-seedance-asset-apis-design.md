# Seedance 素材组 / 素材管理 / 真人认证 API 设计

日期：2026-07-15  
状态：已确认（待实现）

## 目标

在 `new-api` 暴露与 [83zi customer-api §12](https://s.83zi.com/docs/customer-api.md) 对齐的 **12 个** Seedance 素材管理接口（**不含** `POST /api/seedance/upload`），供已接入豆包视频生成的客户完成素材组 CRUD、素材查询/更新/删除、远程 URL 认证与真人活体换组。

## 决策摘要

| 项 | 选择 |
|----|------|
| 上游 | 转发至现有 **83zi Gateway**（如 `http://s.83zi.com`），不直连火山官方素材 API |
| 上游凭证 | 管理员配置的**一条共享渠道** Key |
| 租户隔离 | 在 `new-api` **本地按 user_id** 做归属；不能依赖 83zi 侧隔离（共享 Key 下 83zi 只认一个客户） |
| 渠道选择 | 运营配置 `seedance_asset.gateway_channel_id`，不走模型 `Distribute` |
| 计费 | 本期**不计费**；写操作预留空钩子，后续可加 |

## 范围

### 做

对外路径（均需 `Authorization: Bearer sk-...`）：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/seedance/asset-groups` | 创建素材组（仅 AIGC） |
| `POST` | `/api/seedance/asset-groups/query` | 查询本人素材组列表 |
| `GET` | `/api/seedance/asset-groups/{group_id}` | 查询单个素材组 |
| `PATCH` | `/api/seedance/asset-groups/{group_id}` | 更新素材组（名称/描述） |
| `DELETE` | `/api/seedance/asset-groups/{group_id}` | 删除素材组 |
| `POST` | `/api/seedance/assets/query` | 查询本人素材列表 |
| `GET` | `/api/seedance/assets/{id}` | 查询素材状态 |
| `PATCH` | `/api/seedance/assets/{id}` | 更新素材（平台侧名称） |
| `DELETE` | `/api/seedance/assets/{id}` | 删除素材 |
| `POST` | `/api/seedance/assets` | 远程 URL 资产认证 |
| `POST` | `/api/seedance/real-person-auth/sessions` | 生成真人认证 H5 会话 |
| `POST` | `/api/seedance/real-person-auth/asset-group` | bytedToken 换 GroupId 并绑定用户 |

- 响应形状对齐 83zi：`{ "success", "message", "data" }`，错误可带 `code`
- 本地归属表 + 写操作转发 83zi
- 运营配置：网关渠道 ID、总开关、GET 是否回源刷新
- 管理后台最小改动：可配置渠道 ID

### 不做

- `POST /api/seedance/upload`（明确排除）
- 修改 `/v1/video/generations` 创建/查询逻辑
- 修改 83zi Gateway / 直连火山素材官方 API
- 本期扣 credits
- 大改 `seedance-debug.html`（可选后续）

## 架构

```text
客户 sk-
   → TokenAuth（user_id）
   → Seedance 控制器
       ├─ 读 seedance_asset 运营配置
       ├─ 取 gateway 渠道 BaseURL + Key
       ├─ 写操作：HTTP 转发 83zi /api/seedance/...
       │         成功后 upsert 本地归属（user_id）
       ├─ 列表 query：仅查本地库（防共享 Key 串户）
       └─ 单条 GET：校验归属 → 可选刷新 83zi status
```

| 层 | 职责 |
|----|------|
| `router` | `Group("/api/seedance")` + `TokenAuth`；**不走** `Distribute` |
| `controller` | 参数解析、统一响应、错误码 |
| `service` | 解析渠道、HTTP 客户端转发、归属编排、计费空钩子 |
| `model` | `seedance_asset_groups` / `seedance_assets` CRUD |

## 数据模型

兼容 SQLite / MySQL / PostgreSQL（GORM；枚举用 `TEXT`）。

### `seedance_asset_groups`

| 字段 | 说明 |
|------|------|
| `id` | 本地主键 |
| `user_id` | 归属用户（索引） |
| `group_id` | 上游/83zi `group-xxx`（唯一） |
| `group_type` | `AIGC` / `LivenessFace` |
| `group_name` / `description` | 平台侧可改 |
| `status` | `active` / `deleted`（软删） |
| `channel_id` | 创建时网关渠道 |
| `created_at` / `updated_at` | unix 时间戳 |

### `seedance_assets`

| 字段 | 说明 |
|------|------|
| `id` | 本地主键（也可按 `aicc_asset_id` 查） |
| `user_id` | 归属用户 |
| `group_id` | 所属组（空 = 平台默认 AIGC 组） |
| `aicc_asset_id` | 上游 asset id（唯一索引） |
| `filename` / `type` | 名称；`image`/`video`/`audio` |
| `status` | `uploaded`/`processing`/`active`/`failed`/`deleted`（软删） |
| `url` / `asset_uri` | 源 URL、`asset://...` |
| `error_message` | 失败原因 |
| `channel_id` | 创建渠道 |
| `created_at` / `updated_at` | |

### 归属约定

1. 列表接口只读本地表，强制 `user_id` 过滤。
2. 创建/远程认证/真人换组：83zi 成功后 upsert 本地行。
3. 他人 `group_id`：校验失败 → HTTP **403** `group_forbidden`。
4. 平台默认共享 AIGC 组：可不按用户绑定；不传 `group_id` 时视为默认组。
5. 同一账号下所有令牌共享素材（按用户隔离，不按 token）。

## 接口行为

未启用或未配置 `gateway_channel_id` → **503** `gateway_not_configured`。

### 素材组

| 接口 | 流程 |
|------|------|
| `POST .../asset-groups` | 转发 83zi → 本地 insert → 返回本地视图 |
| `POST .../asset-groups/query` | 仅本地分页；`group_type` / `group_ids` |
| `GET .../asset-groups/{id}` | 本地归属校验；无则 404 |
| `PATCH .../asset-groups/{id}` | 本地校验 → 更新 name/desc；83zi PATCH 尽力同步，失败不阻断本地 |
| `DELETE .../asset-groups/{id}` | 本地校验 → 转发 DELETE → 本地软删 |

### 素材

| 接口 | 流程 |
|------|------|
| `POST .../assets` | 有 `group_id` 时校验归属（或允许默认组）→ 转发 → 本地 insert |
| `POST .../assets/query` | 仅本地；group / type / status |
| `GET .../assets/{id}` | 本地 id 或 `aicc_asset_id`；可选回源刷新 status |
| `PATCH .../assets/{id}` | 本地校验 → 更新 `filename` |
| `DELETE .../assets/{id}` | 本地校验 → 转发 → 本地软删 |

### 真人认证

| 接口 | 流程 |
|------|------|
| `POST .../real-person-auth/sessions` | 转发 83zi，原样返回；不落库 |
| `POST .../real-person-auth/asset-group` | 转发换 `group_id` → 绑定当前 `user_id`（`LivenessFace`） |

### 计费钩子

写操作调用 `MaybeChargeSeedanceAssetOp(...)`（本期空实现，不扣费）。

### 与视频生成的关系

客户将 `asset_uri`（`asset://...`）自行填入 `POST /v1/video/generations` 的 `content`；本期不改视频链路。日后若接入 `upload`，复用同一套 `group_id` 归属校验。

## 配置

| 键 | 含义 | 默认 |
|----|------|------|
| `seedance_asset.enabled` | 总开关 | `false` |
| `seedance_asset.gateway_channel_id` | 网关渠道 ID（BaseURL+Key 指向 83zi） | `0` |
| `seedance_asset.refresh_on_get` | GET 素材时是否回源刷新 status | `true` |

渠道类型不强制；只要 Base URL 能访问 83zi 的 `/api/seedance/*`。

## 错误码

| 情况 | HTTP | code |
|------|------|------|
| 未配置/未启用 | 503 | `gateway_not_configured` |
| 他人 group | 403 | `group_forbidden` |
| 资源不存在或不属于本人 | 404 | `group_not_found` / `asset_not_found` |
| 83zi/上游失败 | 透传或 502 | 保留上游 message |
| 鉴权失败 | 401 | 现有 TokenAuth |

## 文件落点

```text
router/seedance-router.go
controller/seedance_asset.go
service/seedance_asset.go
model/seedance_asset_group.go
model/seedance_asset.go
setting/operation_setting/seedance_asset_setting.go
```

- `model/main.go`：AutoMigrate 注册两张表
- 管理后台（classic + default）：运营设置增加「Seedance 素材网关渠道 ID」等最小表单项
- `router/main.go`：挂载 `SetSeedanceRouter`

## 测试要点

1. 两用户共享同一上游渠道 Key：A 的 query 看不到 B 的组/素材。
2. B 使用 A 的 `group_id` 调用 `POST /api/seedance/assets` → 403 `group_forbidden`。
3. 真人换组成功后，该组出现在该用户的 `asset-groups/query` 中。
4. 未配置 `gateway_channel_id` 或 `enabled=false` → 503。
5. `GET /api/seedance/assets/{id}` 在 `refresh_on_get=true` 时可更新本地 `status`。

## 参考

- 对外契约：[customer-api.md §12](https://s.83zi.com/docs/customer-api.md)
- 参考实现：`d:\work\duanshipin\yidongmaas\gateway` 的 `src/routes/upload.js`、`src/services/customer-asset-groups.js`
- 现有视频路径：`relay/channel/task/doubao/`、`router/video-router.go`
