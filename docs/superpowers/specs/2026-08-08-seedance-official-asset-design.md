# Seedance 官方素材直连 API 设计

日期：2026-08-08  
状态：已确认（待实现）

## 目标

在保留现有 **83zi 素材网关**（`/api/seedance/*`）的前提下，新增一条 **火山方舟官方私域素材库** 直连链路，供管理员使用控制台 **AK/SK** 配置上游，客户仍用本站 `sk-` 调用与现有契约镜像的 REST 接口。

## 决策摘要

| 项 | 选择 |
|----|------|
| 与 83zi 关系 | **并行共存**（方案 C），不互相替换 |
| 对外形态 | 镜像 REST：`/api/seedance/official/*`（方案 A） |
| 一期范围 | 全量对齐现有 **12** 个接口（含真人活体） |
| 上游凭证 | 单独渠道，Key=`AK\|SK` 或 `AK\|SK\|Region`；运营填「官方素材渠道 ID」 |
| 真人 CallbackURL | 运营配置默认值；请求体可覆盖（方案 B） |
| 实现结构 | 上游适配器接口 + 双路由前缀（方案 1） |
| 租户隔离 | 本地按 `user_id` + `provider`；列表只读本地库 |
| 计费 | 本期不计费；沿用空钩子 |

## 范围

### 做

对外路径（均需 `Authorization: Bearer sk-...`）：

| 方法 | 路径 | 官方 Action |
|------|------|-------------|
| `POST` | `/api/seedance/official/asset-groups` | `CreateAssetGroup` |
| `POST` | `/api/seedance/official/asset-groups/query` | 本地库（`provider=official`） |
| `GET` | `/api/seedance/official/asset-groups/{group_id}` | 本地 + 可选 `GetAssetGroup` |
| `PATCH` | `/api/seedance/official/asset-groups/{group_id}` | `UpdateAssetGroup` |
| `DELETE` | `/api/seedance/official/asset-groups/{group_id}` | `DeleteAssetGroup` |
| `POST` | `/api/seedance/official/assets` | `CreateAsset` |
| `POST` | `/api/seedance/official/assets/query` | 本地库（`provider=official`） |
| `GET` | `/api/seedance/official/assets/{id}` | 本地 + 可选 `GetAsset` |
| `PATCH` | `/api/seedance/official/assets/{id}` | `UpdateAsset` |
| `DELETE` | `/api/seedance/official/assets/{id}` | `DeleteAsset` |
| `POST` | `/api/seedance/official/real-person-auth/sessions` | `CreateVisualValidateSession` |
| `POST` | `/api/seedance/official/real-person-auth/asset-group` | `GetVisualValidateResult` → 绑定本地 LivenessFace |

- 响应形状与现有 83zi 网关一致：`{ "success", "message", "data", "code"? }`
- 状态对外统一小写：`processing` / `active` / `failed` / `deleted` 等
- `asset_uri` = `asset://` + 官方素材 `Id`
- 管理后台：运营设置增加「Seedance 官方素材」区块

### 不做

- 修改现有 `/api/seedance/*`（83zi）行为
- 修改 `/v1/video/generations` 创建/查询协议
- `POST /api/seedance/official/upload` 本地文件上传
- 直连官方素材单独计费
- 大改 `seedance-debug.html`（可选后续加 official 入口）
- 对客户暴露 Volc Action 透传路径

## 架构

```text
客户 sk-
  ├─ /api/seedance/*            → Upstream83zi（Bearer sk-）      【现有】
  └─ /api/seedance/official/*   → UpstreamOfficial（V4 + Action） 【新增】

TokenAuth → controller → service 编排
  → SeedanceAssetUpstream 接口
  → 本地 seedance_asset_groups / seedance_assets（provider 区分）
```

| 层 | 职责 |
|----|------|
| `router` | 新增 `SetSeedanceOfficialRouter`；`TokenAuth`；**不走** `Distribute` |
| `controller` | 可复用现有 handler 或薄包装，注入 `provider=official` |
| `service` | 归属校验、列表本地读、写成功后 upsert；按路径选择 upstream |
| `service/seedance_asset_upstream.go` | 上游接口定义 |
| `service/seedance_asset_upstream_83zi.go` | 现有 Bearer 转发迁入（行为不变） |
| `service/seedance_asset_upstream_official.go` | Volc OpenAPI 客户端 + 字段映射 |
| `pkg/volc/sign`（或 `common/volc_sign.go`） | 火山 V4 HMAC-SHA256 签名（无现成依赖则自研最小实现） |
| `model` | 表结构加 `provider`；查询带 provider 过滤 |
| `setting/operation_setting` | `seedance_asset_official` 配置 |

### 官方上游约定

| 项 | 值 |
|----|-----|
| Host（默认） | `ark.cn-beijing.volcengineapi.com` |
| 方法 | `POST` |
| Query | `Action={Name}&Version=2024-01-01` |
| Region | `cn-beijing`（可由 Key 第三段覆盖） |
| Service | `ark` |
| 鉴权 | V4：`Authorization` + `X-Date` + `X-Content-Sha256` |
| 成功体 | `ResponseMetadata` + `Result` |
| 错误体 | `ResponseMetadata.Error.{Code,Message}` |

渠道 Base URL 为空时使用默认 Host；若填写则以其 host 为准（便于代理）。

签名必须基于最终发送的 method/path/query/headers/body；JSON 一律 `common.Marshal`，签名后不得再改 body。

## 字段映射

| 对外 REST | 官方 |
|-----------|------|
| `url` / `assetUrl` | `URL` |
| `type`: `image`/`video`/`audio` | `AssetType`: `Image`/`Video`/`Audio` |
| `name` / `filename` / `group_name` | `Name` |
| `description` | `Description` |
| `group_id` | `GroupId` 或资源 `Id` |
| `group_type`=`AIGC` | `GroupType`=`AIGC` |
| `byted_token` | `BytedToken` |
| `callback_url`（可选覆盖） | `CallbackURL` |
| 默认运营配置 | `CallbackURL`（sessions 未传时） |

官方状态 `Processing`/`Active`/`Failed` → 对外小写。

列表类接口（`*/query`）**一期只查本地库**并按 `provider=official` 过滤，不把官方全量列表透传给客户（共享 AK 防串户）。单条 GET 在 `refresh_on_get=true` 时回源刷新 status/url/error。

## 运营配置

新增配置组 `seedance_asset_official`（与现有 `seedance_asset` 并列）：

| Key | 类型 | 默认 | 说明 |
|-----|------|------|------|
| `seedance_asset_official.enabled` | bool | `false` | 官方素材总开关 |
| `seedance_asset_official.gateway_channel_id` | int | `0` | 渠道 ID；Key=`AK\|SK` 或 `AK\|SK\|Region` |
| `seedance_asset_official.refresh_on_get` | bool | `true` | GET 素材/组是否回源 |
| `seedance_asset_official.default_callback_url` | string | `""` | 真人会话默认 CallbackURL |

启用条件：`enabled && gateway_channel_id > 0` 且渠道 Key 可解析出 AK/SK。

前端：

- default：`SeedanceOfficialAssetSettingsSection`
- classic：`SettingsSeedanceOfficialAsset`（或并入运营设置页新区块）

文案需说明：此链路走火山官方管控面，**不是** 83zi `sk-`。

## 数据模型

复用现有表，增量字段（三库兼容；SQLite 用 `ADD COLUMN`）：

### `seedance_asset_groups`

| 字段 | 说明 |
|------|------|
| （现有字段不变） | |
| `provider` | `varchar(32)`，默认 `83zi`；官方写入 `official` |

### `seedance_assets`

| 字段 | 说明 |
|------|------|
| （现有字段不变） | |
| `provider` | 同上 |

查询 API：

- `/api/seedance/*` → `provider=83zi`（缺省旧数据视为 `83zi`）
- `/api/seedance/official/*` → `provider=official`

`group_id` / `aicc_asset_id` 唯一索引保持；业务隔离靠 `provider` + `user_id`。若官方 ID 与 83zi 偶然冲突，以后可再收紧为联合唯一，本期不改唯一约束以免破坏已有数据。

## 错误处理

| 场景 | HTTP | code |
|------|------|------|
| 未启用 / 渠道不存在 / 无 Key / Key 非 AK\|SK | 503 | `gateway_not_configured` |
| 真人会话无 callback 且无默认 | 400 | `callback_url_required` |
| 官方 `ResponseMetadata.Error` | 按语义 4xx/5xx | 上游 `Code` |
| `ValidatePending` / 尚无 GroupId | 404 | `group_not_found` |
| 他人 group/asset | 403 / 404 | `group_forbidden` / `*_not_found` |
| 网络或非 JSON | 502 | `upstream_error` |
| group 已被其他用户绑定 | 409 | `group_owned_by_other` |

## 配置与调用流程（管理员）

1. 渠道管理新建渠道：Key=`AK|SK`（可选 `|cn-beijing`），类型不强制；Base URL 可空或填官方/代理 host。
2. 运营设置 → Seedance 官方素材：启用、填写渠道 ID、配置默认 CallbackURL、按需开启 GET 回源。
3. 客户使用本站令牌调用 `/api/seedance/official/...`。
4. 视频生成仍走现有豆包/火山视频渠道；`content` 中填 `asset://...`（须与官方同账号/项目体系一致，否则上游可能无法解析）。

## 测试边界

1. 官方未启用 → 503 `gateway_not_configured`
2. Key 非 `AK|SK` → 503
3. 创建 AIGC 组 → 本地 `provider=official`
4. 远程 URL 认证 → `processing`；开启回源后 GET 可到 `active`
5. `/api/seedance` 与 `/api/seedance/official` 资源互不可见
6. 默认 CallbackURL 可建真人会话；未完成活体换组 → `group_not_found`
7. 跨用户使用 `group_id` → 403
8. 现有 83zi 路径回归：行为与改前一致

## 文件触点（预期）

```
router/seedance-router.go          # 或 seedance_official-router.go
controller/seedance_asset.go       # 官方路径入口 / 复用
service/seedance_asset.go          # 编排按 provider 分支
service/seedance_asset_upstream*.go
pkg/volc/sign/ 或 common/volc_sign.go
model/seedance_asset*.go           # provider + 迁移
setting/operation_setting/seedance_asset_official_setting.go
web/default/.../seedance-*-settings-section.tsx
web/classic/.../SettingsSeedance*.jsx
docs/seedance-official-asset-api-user-guide.md  # 实现期用户文档
```

## 与既有设计关系

- 既有：`docs/superpowers/specs/2026-07-15-seedance-asset-apis-design.md`（83zi 网关）**继续有效**
- 本文仅描述官方并行链路；不推翻 83zi 决策
