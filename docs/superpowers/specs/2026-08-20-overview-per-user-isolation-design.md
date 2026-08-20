# 概览页按用户隔离 — 设计文档

- 日期：2026-08-20
- 状态：待评审
- 主题：`/dashboard/overview` 概览页在「超级管理员之外」的所有角色下，仅展示与当前用户自身相关的数据（前端 + 后端双重隔离）

## 1. 背景与目标

当前 `/dashboard/overview` 概览页中，模型性能面板（`PerformanceHealthPanel`）与「Channels」渠道管理快捷入口对所有 `role >= 10`（管理员）用户展示的是**系统全局**数据，未按用户隔离。本设计在不破坏公开定价页与超级管理员全局视图的前提下，让**非超级管理员**只能看到与其自身「用户分组」关联的数据。

### 角色模型

| 角色 | 常量（后端 / 前端） | 隔离策略 |
| --- | --- | --- |
| 超级管理员 | `RoleRootUser=100` / `ROLE.SUPER_ADMIN` | 不做任何分组过滤，可见全部（现状） |
| 普通管理员 | `RoleAdminUser=10` / `ROLE.ADMIN` | 隔离到其自身「用户分组」可用的分组链数据 |
| 普通用户 | `RoleCommonUser=1` / `ROLE.USER` | 隔离到自身数据；**不进入**渠道页 |
| 游客/匿名 | `RoleGuestUser=0` / `ROLE.GUEST` | 维持公开行为（定价页），不受本设计影响 |

### 隔离链（关键概念）

```
用户 user.Group（单个字符串）
   └─(service.GetUserUsableGroups) 展开→ 可用「定价分组」集合（含 special usable group 增删）
          └─(渠道 Channel.Group 逗号分隔列表 / abilities 表) → 该批定价分组下的渠道
```

`perf_metrics` 采样仅按 `model + group` 两个维度存储（无 user / channel 维度，见 `pkg/perf_metrics/types.go`），因此「用户关联渠道的模型性能」在数据上等价于「按用户可用分组集合过滤性能采样」。

## 2. 总体设计原则

**隔离逻辑几乎全部在后端完成**，前端仅渲染后端返回结果，不做角色分支判断（Part B 表单结构调整除外）。理由：

- 后端可从鉴权中间件写入的上下文（`c.GetInt("role")`、`c.GetString("group")`，见 `middleware/auth.go:196-200`）稳定地识别调用者，天然区分「超级管理员=不限」与「普通管理员/用户=受限」。
- 前端不再需要引入 `isSuperAdmin` 阈值分支，降低复杂度与遗漏风险（YAGNI）。

### 2.1 共享后端函数（本设计的地基）

在 `service/group.go` 新增一个纯函数，作为 Part A / B / C 共用的「可见分组」判定入口：

```go
// GetUserVisibleGroups 返回某用户在「分组维度」上可见的分组集合。
//   unrestricted=true 表示超级管理员（或匿名公开访问），不做任何分组过滤；
//   否则 groups 为该用户 user.Group 经 GetUserUsableGroups 展开后的分组名集合，
//   该集合恒包含用户自身分组，因此对受限用户至少返回一个分组（fail-closed）。
func GetUserVisibleGroups(role int, userGroup string) (groups []string, unrestricted bool)
```

判定规则：

- `role >= common.RoleRootUser`（超级管理员）→ `unrestricted = true`。
- `role < common.RoleCommonUser`（未登录 / 游客）→ `unrestricted = true`（保持公开定价页现状，见 Part A 说明）。
- 其余（普通管理员 / 普通用户）→ `unrestricted = false`，`groups = lo.Keys(service.GetUserUsableGroups(userGroup))`。

该函数不引入新的持久化状态，不改动 `GetUserUsableGroups` 的既有语义，仅做一层角色封装。

## 3. Part A — 概览页模型性能面板隔离

### 3.1 现状

- 前端 `overview-dashboard.tsx:771` `{isAdmin && <PerformanceHealthPanel/>}`，`isAdmin = role >= ROLE.ADMIN`。
- 面板经 `getPerfMetricsSummary(24)` 调用 `GET /api/perf-metrics/summary` → `controller.GetPerfMetricsSummary`。
- 该 controller 现固定使用**全部**活跃分组：`activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")`，再 `perfmetrics.QuerySummaryAll(hours, activeGroups)`。
- 路由 `perf-metrics/summary` 使用 `HeaderNavModulePublicOrUserAuth("pricing")`：定价模块公开时走 `TryUserAuth()`（可选鉴权），否则走 `UserAuth()`。

### 3.2 变更

**仅改后端** `controller.GetPerfMetricsSummary`，改为「上下文感知」的分组过滤：

```go
role := c.GetInt("role")
userGroup := c.GetString("group")
visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)

activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
groups := activeGroups
if !unrestricted {
    groups = intersect(activeGroups, visible) // 仅保留既活跃又对该用户可见的分组
}
result, err := perfmetrics.QuerySummaryAll(hours, groups)
```

- 超级管理员 / 匿名 → `groups = activeGroups`，行为与现状完全一致。
- 普通管理员 / 普通用户 → `groups` 为「活跃分组 ∩ 用户可见分组」。因 `GetUserVisibleGroups` 恒含用户自身分组，交集为空时（用户分组无对应 group ratio）返回**空性能数据**，绝不回退为全量（fail-closed）。
- `intersect` 为 controller 内的小工具（或复用 `lo.Intersect`），不新增导出 API。

前端 `PerformanceHealthPanel` 的展示门槛**保持不变**（仍 `role >= ROLE.ADMIN`）：普通用户维持现状不见此面板，普通管理员见到的是被后端隔离后的数据，超级管理员见全量。本设计不扩大面板的可见人群，只收窄数据。

`SummaryCards`（余额/用量/请求数卡片）已自隔离（走 `/api/data/self` + 用户 store 字段），**无需改动**。

### 3.3 跨页副作用（需在评审中确认）

`GET /api/perf-metrics/summary` 同时被**公开定价页** `pricing/components/model-card-grid.tsx` 调用。改造后：

- 匿名访客访问定价页 → `unrestricted`，性能数据不变。
- **已登录的普通用户/普通管理员**访问定价页 → 性能数据同样被收窄到其可用分组。此行为与定价页**既有的**模型列表过滤（`controller/pricing.go` `filterPricingByUsableGroups`）一致，属于语义对齐（登录用户在定价页看到的性能与其能用的分组匹配），非回退。

若评审认为绝不能触碰定价页，可选备选方案：新增专用只读端点 `GET /api/perf-metrics/summary/self`（`UserAuth`，强制按调用者可见分组过滤），仅概览面板指向该端点，定价页维持原端点。默认推荐**共享端点上下文感知**（改动更小、语义更一致），备选方案作为「零定价页影响」的保守选项。

## 4. Part B — 新建用户时的「用户分组」下拉框

### 4.1 现状

`web/src/features/users/components/users-mutate-drawer.tsx`：`group` 表单字段位于 `{isUpdate && (...)}` 的「Group & Quota」区块内，**仅编辑态**出现；新建态不展示，`group` 默认取 `USER_FORM_DEFAULT_VALUES.group = DEFAULT_GROUP`（`"default"`）。分组选项来自 `getGroups()` → `GET /api/group/` → `controller.GetGroups`，该 controller 目前返回**全部**分组（`lo.Keys(GetGroupRatioCopy())`），未按调用者隔离。

### 4.2 变更

**前端**（`users-mutate-drawer.tsx`）：

- 将 `group` 的 `FormField` 从「仅编辑态」区块中拆出，改为**新建态与编辑态都渲染**的独立分组下拉框；`quota_dollars`（额度）仍保留为**仅编辑态**（维持现状，避免扩大范围）。
- 新建态默认选中 `"default"`（沿用 `USER_FORM_DEFAULT_VALUES.group`，无需改默认值）。
- 选项列表继续来自 `getGroups()`，前端不做角色过滤（由后端收窄，见下）。

**后端**（`controller.GetGroups`，`/api/group/`，`AdminAuth`）：按调用者可见分组收窄返回列表：

```go
role := c.GetInt("role")
userGroup := c.GetString("group")
visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)
// unrestricted → 返回全部分组（现状）；否则仅返回 visible ∩ 全部分组
```

**后端写入校验**（`controller/user.go` 新建/更新用户处理）：当**非超级管理员**为用户指定 `group` 时，服务端必须校验该分组在调用者的可见分组集合内，越界则拒绝（400），防止普通管理员绕过 UI 指派隔离边界外的分组。这是「后端隔离」的强制点，不能仅依赖前端下拉收窄。

## 5. Part C — 渠道列表按用户隔离（仅普通管理员）

### 5.1 现状

- 渠道路由组 `channelRoute.Use(middleware.AdminAuth())`（`role >= 10`）：普通用户**已**无访问权限，满足「仅普管可见」，**路由层无需改动**。
- 概览页「Channels」快捷入口 `adminOnly: true`（`role >= ROLE.ADMIN`），普通用户已不可见，**前端门槛无需改动**。
- 列表接口 `GET /api/channel/` → `controller.GetAllChannels`：经 `buildChannelListQuery(groupFilter, ...)` 查询，`groupFilter` 来自 URL `?group=` 参数（`NormalizeChannelGroupFilter`）；已 `.Omit("key")` 且逐条 `clearChannelInfo(datum)` 抹除敏感信息。分组过滤 `model.ApplyChannelGroupFilter` 目前**只接受单个分组**，对 `Channel.Group` 逗号分隔列表做 `LIKE` 子串匹配。

### 5.2 变更

**新增多分组 OR 过滤器**（`model/channel.go`），供受限用户按「任一可见分组」匹配：

```go
// ApplyChannelGroupFilterAny 对 groups 中任一分组命中的渠道做 OR 过滤。
// groups 为空时 fail-closed（WHERE 1=0，返回空），避免退化为全量。
func ApplyChannelGroupFilterAny(query *gorm.DB, groups []string) *gorm.DB
```

- 复用既有 `channelGroupFilterCondition()` / `channelGroupFilterPattern()`，对每个分组拼 `OR`；跨库（MySQL 用 `CONCAT`、SQLite/PG 用 `||`）沿用现有实现，满足三库兼容。

**改造 `controller.GetAllChannels`**（同样逻辑覆盖 `total` 计数、`type_counts` 统计、tag 模式三处子查询，保证计数与列表一致）：

```go
role := c.GetInt("role")
userGroup := c.GetString("group")
visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)
```

- `unrestricted`（超级管理员）→ 维持现状：尊重可选 `?group=` 参数，无隔离。
- 受限（普通管理员）→ 忽略/收窄客户端 `?group=`：
  - `?group=` 为空 → 用 `ApplyChannelGroupFilterAny(query, visible)`。
  - `?group=` 指定了单个分组：若该分组 ∈ `visible`，按其过滤；否则视为越界 → 返回空（fail-closed）。

**只读单渠道加固** `controller.GetChannel`（`GET /api/channel/:id`）与列表型 `controller.SearchChannels`（`/api/channel/search`）：受限用户访问的渠道若其 `Channel.Group` 与 `visible` 无交集，则返回 404/空，防止通过直接 id 或搜索绕过列表隔离。

### 5.3 明确的非目标（本迭代不做）

- 渠道**写操作**（新增/编辑/删除/测试/批量等，`ChannelOperate` / `ChannelWrite` / `ChannelSensitiveWrite`）的分组级隔离**不在本次范围**，维持既有 authz 权限体系行为。本次仅做**读可见性**隔离（列表 / 搜索 / 单读）。若后续需要写隔离，另立 spec。
- 不改动 authz 权限目录（`/api/authz/catalog`）与角色基线。

## 6. 数据流小结

```
概览页
 ├─ SummaryCards ─────────────→ /api/data/self（已自隔离，不改）
 ├─ PerformanceHealthPanel ───→ /api/perf-metrics/summary
 │        后端按 GetUserVisibleGroups 过滤活跃分组（Part A）
 └─ Channels 快捷入口 ────────→ /api/channel/（AdminAuth）
          后端按 GetUserVisibleGroups OR 过滤渠道（Part C）

新建/编辑用户抽屉
 └─ Group 下拉 ───────────────→ /api/group/（后端按可见分组收窄，Part B）
          提交 → /api/user 写入校验分组在可见集合内（Part B 强制点）
```

## 7. 边界与错误处理

- **fail-closed 原则**：受限用户的可见分组交集为空时一律返回空数据，绝不回退为全量。
- **匿名/公开路径**：`role < RoleCommonUser` 视为 `unrestricted`，仅用于维持公开定价页，不暴露后台隔离逻辑。
- **三库兼容**：Part C 的 OR 过滤复用现有跨库分组条件；不引入库特定语法。
- **JSON**：如涉及序列化，统一走 `common.Marshal/Unmarshal`（现有 controller 未直接序列化分组列表，基本无新增序列化点）。
- **性能**：`GetUserVisibleGroups` 为内存 map 操作，`QuerySummaryAll` 已支持 `groups` 入参；渠道 OR 过滤命中既有索引/扫描路径，额外开销可忽略。

## 8. 测试计划（后端 testify）

- `service.GetUserVisibleGroups`：表驱动，覆盖 超级管理员=unrestricted、普通管理员/用户=其可用分组（含 special usable group 的 `+:`/`-:` 增删）、匿名=unrestricted、自身分组恒包含。
- `GetPerfMetricsSummary` 分组过滤：以显式 role/group 上下文 + 预置 group ratio，断言受限用户仅得到交集分组、空交集得到空数据、超级管理员得到全量。
- `ApplyChannelGroupFilterAny` + `GetAllChannels`：预置多分组渠道，断言普通管理员仅见可见分组渠道、越界 `?group=` 返回空、`total`/`type_counts` 与列表一致；超级管理员见全量。
- 用户写入分组校验：普通管理员指派越界分组返回 400；指派可见分组成功。
- 前端：Part B 表单结构改动以现有前端测试约定验证（新建态出现 Group 下拉、默认 `default`）。

## 9. 涉及文件清单（预期）

- `service/group.go`（新增 `GetUserVisibleGroups`）
- `controller/perf_metrics.go`（Part A）
- `controller/group.go`（Part B 后端收窄）
- `controller/user.go`（Part B 写入校验）
- `controller/channel.go`（Part C 列表/搜索/单读隔离）
- `model/channel.go`（新增 `ApplyChannelGroupFilterAny`）
- `web/src/features/users/components/users-mutate-drawer.tsx`（Part B 表单结构）
- 对应后端 `_test.go`

保护性约束：全程不改动 new-api / QuantumNous 相关标识、版权、模块路径等受保护信息。
