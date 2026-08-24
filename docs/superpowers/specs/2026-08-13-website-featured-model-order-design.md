# Website Featured Model Ordering Design

## Goal

让运营在后台维护一组“官网精选模型”及其顺序，并让官网模型目录（包括 `/zh/models`）将这些模型按运营顺序置顶；未精选模型继续使用现有自动排序。

## Scope

### In scope

- 后台管理员可查看公开模型候选列表。
- 管理员可将多个模型加入精选、移除精选、上移、下移并保存完整顺序。
- 后端以数据库持久化精选模型顺序，适配多实例部署。
- 官网公开定价接口和模型目录按精选顺序优先返回/展示。
- 精选模型下线、删除或不再属于公开 `plg` 分组时自动跳过。
- 无精选配置时保持现有供应商/系列排序。

### Out of scope

- 不改变 `/v1/models`、模型路由、计费、渠道选择或控制台普通模型列表的排序。
- 不引入基于访问量、点击量或发布时间的自动推荐算法。
- 不新增外部依赖；后台排序使用上移/下移按钮而非拖拽库。

## Architecture

新增独立的 `WebsiteFeaturedModel` 持久化实体，使用 `model_name` 作为稳定业务键，使用 `sort_order` 表示精选顺序。配置与模型元数据解耦，避免官网运营字段污染模型路由或计费模型。

管理接口挂在现有管理员 `/api/models` 路由组下：

- `GET /api/models/website-featured` 返回公开候选模型和当前精选顺序。
- `PUT /api/models/website-featured` 接收完整的 `model_names` 数组，在事务中删除旧配置并写入新顺序。

官网服务端在构建 `plg` 定价数据时读取精选模型名集合，先按精选顺序稳定排序，再对其余模型应用现有排序函数。排序配置读取失败时采用现有自动排序并记录服务端错误，不让官网页面整体不可用。

## Data model

```go
type WebsiteFeaturedModel struct {
    ID        int    `json:"id"`
    ModelName string `json:"model_name" gorm:"size:128;not null;uniqueIndex"`
    SortOrder int    `json:"sort_order" gorm:"not null;index"`
    CreatedAt int64  `json:"created_at" gorm:"bigint"`
    UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}
```

`model_name` 必须唯一；`sort_order` 从 0 开始连续生成。模型删除不会级联删除配置，官网读取时通过当前公开模型集合过滤掉无效条目，后台读取时将无效条目标记为不可用，允许运营清理。

## API contract

### GET `/api/models/website-featured`

Response:

```json
{
  "success": true,
  "data": {
    "featured": [
      { "model_name": "gpt-5.5", "sort_order": 0, "available": true },
      { "model_name": "claude-opus-4.7", "sort_order": 1, "available": true }
    ],
    "candidates": [
      { "model_name": "gpt-5.5", "vendor_name": "OpenAI", "available": true }
    ]
  }
}
```

候选列表只包含已启用、已配置元数据且当前可被官网公开分组使用的模型；现有精选但已失效的条目仍出现在 `featured`，并设置 `available: false`，方便运营清理。

### PUT `/api/models/website-featured`

Request:

```json
{ "model_names": ["gpt-5.5", "claude-opus-4.7", "gemini-3.5-flash"] }
```

服务端行为：去除首尾空白；拒绝空模型名、重复模型名、超过公开候选范围的模型名；在单个数据库事务中重建连续顺序；成功后刷新官网定价缓存。错误返回 400，数据库错误返回 500。

## Backend integration

- 在 `model/` 新增实体及查询/重写顺序函数，并加入 `orderedMigrationModels()`。
- 在 `controller/` 新增管理员 handler 与请求校验。
- 在 `router/api-router.go` 的 `/models` 管理员路由组注册两个 endpoint。
- 在官网定价 payload 构建前应用排序；排序函数接受精选配置和原有自动排序结果，保证精选项相对顺序稳定、未精选项排序结果不变。
- `InvalidateWebsitePricingCache()` 在成功保存配置后调用；多实例场景下数据库为事实来源，短缓存过期后各实例最终一致。

## Console interaction

在现有“模型”管理模块新增“官网精选”分区：

- 左侧/上方显示当前精选列表，序号、模型名、供应商、可用状态和上移/下移/移除按钮。
- 下方显示可加入精选的公开候选模型，提供搜索和“加入”按钮。
- 保存按钮提交完整数组；成功后刷新查询并提示“已保存”。
- 已失效精选项保留在列表顶部并显示警告，允许移除但不能继续上移到可用项之前。
- 初始加载无配置时显示空态，并解释未配置时官网沿用自动排序。

## Failure and consistency rules

- 官网精选配置为空：不改变现有排序。
- 精选模型不在当前公开 `plg` 数据中：跳过该项，不占用官网展示位置。
- 精选配置读取失败：记录错误并回退现有自动排序；公开接口仍返回可用模型。
- 保存请求包含重复或非法模型：整个请求失败，不部分保存。
- 两个后台管理员同时保存：后写请求覆盖前写请求；事务保证每次结果内部顺序连续且无半更新状态。

## Testing and acceptance

### Backend

- 模型层测试覆盖空配置、连续顺序、去重和事务重写结果。
- Controller 测试覆盖 GET 响应、PUT 成功、重复/非法模型 400、数据库失败 500。
- 官网 payload 测试覆盖精选顺序优先、未精选模型保持自动排序、失效精选跳过、缓存失效。
- Router 测试确认两个管理员 endpoint 已注册。

### Console

- API 类型和调用测试覆盖完整数组保存。
- 组件测试覆盖加入、上移、下移、移除、失效项提示和保存成功状态。

### Website

- 定价排序纯函数测试覆盖多个精选模型的顺序和筛选后的稳定性。
- 运行 website lint、typecheck、build；运行 Go controller/model/router 定向测试。

### Acceptance criteria

1. 运营可在后台一次配置多个精选模型，并明确控制它们的相对顺序。
2. 保存后官网 `/zh/models` 首屏模型顺序与后台一致。
3. 搜索、供应商、计费类型和端点筛选不会破坏精选模型的相对顺序。
4. 未配置或配置失效时，官网仍显示完整模型目录且沿用原排序。
5. 不影响 API 模型调用、计费和 `/v1/models` 返回顺序。
