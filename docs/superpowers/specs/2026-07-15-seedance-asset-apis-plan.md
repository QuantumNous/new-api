# Seedance 素材管理 API 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans (or implement step-by-step below). Steps use checkbox (`- [ ]`) syntax.

**Goal:** 在 `new-api` 落地 12 个 `/api/seedance/*` 接口：鉴权后转发 83zi Gateway，并用本地表按 `user_id` 做归属隔离。

**Architecture:** 独立路由组（`TokenAuth`，不走 `Distribute`）→ controller → service（渠道解析 + HTTP 转发 + 归属编排）→ model 两表。配置走 `operation_setting` 风格的 `seedance_asset.*`。

**Tech Stack:** Go / Gin / GORM；`service.GetHttpClient`；`common.Marshal`/`Unmarshal`；前端 Bun + 现有系统设置表单模式。

**Spec:** `docs/superpowers/specs/2026-07-15-seedance-asset-apis-design.md`

---

## File map

| 文件 | 动作 |
|------|------|
| `setting/operation_setting/seedance_asset_setting.go` | 新建 |
| `model/seedance_asset_group.go` | 新建 |
| `model/seedance_asset.go` | 新建 |
| `model/main.go` | AutoMigrate 注册 |
| `service/seedance_asset.go` | 新建（转发 + 编排 + 计费钩子） |
| `service/seedance_asset_test.go` | 新建（归属/过滤单测） |
| `controller/seedance_asset.go` | 新建 |
| `router/seedance-router.go` | 新建 |
| `router/main.go` | 挂载 |
| `web/default/...` 系统设置（models 或 general） | 最小表单项 |
| `web/classic/...` 对应设置 | 最小表单项 |

---

### Task 1: 运营配置

**Files:**
- Create: `setting/operation_setting/seedance_asset_setting.go`

- [ ] 定义：
  ```go
  type SeedanceAssetSetting struct {
      Enabled           bool `json:"enabled"`
      GatewayChannelId  int  `json:"gateway_channel_id"`
      RefreshOnGet      bool `json:"refresh_on_get"`
  }
  ```
- [ ] 默认：`Enabled=false`, `GatewayChannelId=0`, `RefreshOnGet=true`
- [ ] `init()`：`config.GlobalConfig.Register("seedance_asset", &seedanceAssetSetting)`
- [ ] 导出 `GetSeedanceAssetSetting()` / `IsSeedanceAssetEnabled()`

---

### Task 2: Model 两表 + 迁移

**Files:**
- Create: `model/seedance_asset_group.go`
- Create: `model/seedance_asset.go`
- Modify: `model/main.go`

- [ ] `SeedanceAssetGroup` 字段对齐 design（`user_id`, `group_id` unique, `group_type`, `group_name`, `description`, `status`, `channel_id`, timestamps）
- [ ] 方法：`Insert` / `Update` / `SoftDelete` / `GetByUserAndGroupID` / `ListByUser`（分页 + type/ids 过滤）
- [ ] `SeedanceAsset` 同上；`GetByUserAndIDOrAiccID`；`ListByUser`（group/type/status）
- [ ] `migrateDB` / 测试库迁移列表中加入两张表（与 `Midjourney` 同级）
- [ ] JSON 只用 `common.Marshal`/`Unmarshal`（若有 JSON 列则走 TEXT）

---

### Task 3: Service — 网关客户端与编排

**Files:**
- Create: `service/seedance_asset.go`
- Create: `service/seedance_asset_test.go`

- [ ] `resolveSeedanceGateway()`：读 setting → `enabled` 与 `gateway_channel_id` 校验 → `model.CacheGetChannel` / `GetChannelById` 取 BaseURL+Key；失败返回可映射为 `gateway_not_configured` 的错误
- [ ] `seedanceGatewayDo(method, path, body, apiKey)`：`service.GetHttpClient`，Header `Authorization: Bearer <channel.key>`，`Content-Type: application/json`；解析上游 JSON
- [ ] `MaybeChargeSeedanceAssetOp(...)`：空实现，注明后续计费
- [ ] `AssertGroupUsable(userId, groupId)`：本地 active 归属；空 groupId 允许（默认组）；否则 403 `group_forbidden`
- [ ] 编排函数（各对应一条 API）：
  - Create/List/Get/Patch/Delete AssetGroup
  - CreateRemoteAsset / List / Get(+可选 refresh) / Patch / Delete Asset
  - CreateRealPersonSession / ExchangeRealPersonAssetGroup（换组后 `bind` 本地 LivenessFace）
- [ ] 列表：**禁止**把 83zi 全量列表当结果；只读本地
- [ ] 单测：`AssertGroupUsable` 本人/他人/空；列表过滤只返回本 user（可用 sqlite 内存或纯函数测过滤逻辑）

---

### Task 4: Controller + Router

**Files:**
- Create: `controller/seedance_asset.go`
- Create: `router/seedance-router.go`
- Modify: `router/main.go`

- [ ] 统一响应：`success` / `message` / `data` / 可选 `code`
- [ ] 从 gin context 取 `id`（user_id），与现有 TokenAuth 写入的 key 对齐（查 `middleware/auth.go` 的 `c.Get` key）
- [ ] 12 个 handler；路径参数驼峰/下划线兼容参考 83zi（`group_name`/`groupName` 等在 service 层兼容）
- [ ] `router/seedance-router.go`：
  ```go
  g := router.Group("/api/seedance")
  g.Use(middleware.RouteTag("api"), middleware.TokenAuth())
  // 12 routes — 注意 /assets/query 与 /assets/:id 顺序：先注册 query
  ```
- [ ] `SetRouter` 中调用 `SetSeedanceRouter(router)`（建议在 `SetApiRouter` 之后）

---

### Task 5: 管理后台最小配置 UI

**Files (default):**
- Modify: `web/default/src/features/system-settings/types.ts`
- Modify: 合适 section（优先挂到 models/global 或新建小 section under general）
- Modify: 对应 `index.tsx` 默认值 map

**Files (classic):**
- 在运营/系统设置中增加同等 Option 字段（与 checkin 模式一致）

- [ ] 字段：`seedance_asset.enabled`、`seedance_asset.gateway_channel_id`、`seedance_asset.refresh_on_get`
- [ ] 文案简短说明：渠道 Base URL 需指向 83zi（如 `http://s.83zi.com`），Key 为该站 `sk-`
- [ ] 不跑全量 i18n 全语言也可先用中英 key；若改 UI 字符串则按项目惯例 `t('...')` 并为 zh/en 补译（其它语言可后续 `i18n:sync`）

---

### Task 6: 联调自检（手工 / curl）

- [ ] 配置：创建/选定渠道指向可访问 83zi，填写 `gateway_channel_id`，`enabled=true`
- [ ] 用户 A：创建 AIGC 组 → query 可见 → PATCH 改名 → 远程 URL `POST /assets` → GET 刷新 status
- [ ] 用户 B：query 为空/不含 A 的资源；用 A 的 `group_id` POST assets → 403
- [ ] 真人：sessions →（可选真活体）asset-group → 组出现在 A 的列表
- [ ] `enabled=false` → 503 `gateway_not_configured`

---

## 实现顺序建议

1 → 2 → 3（含单测）→ 4 → 5 → 6

## 风险与注意

- **路由注册顺序**：`POST /assets/query`、`POST /asset-groups/query` 必须在 `/:id` 之前。
- **共享 Key**：绝不能把 83zi `assets/query` 结果直接返回给终端客户。
- **DB 三端**：GORM 抽象；布尔/保留字按项目 Rule 2。
- **JSON**：业务代码走 `common/json.go`。
- **渠道 Key**：注意渠道表 Key 可能含多 key 换行取第一个的现有约定，复用 `channel.GetKey`/`GetFirstKey` 一类现有方法。
