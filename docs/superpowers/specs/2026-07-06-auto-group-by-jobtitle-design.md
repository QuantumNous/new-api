# 按岗位自动分组设计

## 背景

当前系统的新用户分组完全依赖管理员手动分配。飞书 OAuth 登录的新用户统一进入 `pending` 分组（`setting/system_setting/feishu.go` 的 `DefaultGroup`），之后由管理员通过 `PUT /api/user/:id/group`（`controller/feishu_admin.go:131` `AdminSetUserGroup`）手动改分组。

系统已经从飞书 `contact/v3` 接口同步了用户的 `job_title`（岗位）、`feishu_department_name`（部门）等字段（`service/feishu_user_info_sync.go:113` `syncOneFeishuUserInfo`），但这些字段仅作展示，没有反向驱动 group 赋值。

同时系统已存在「分组绑定套餐」机制：`SubscriptionPlan.BindGroup`（`model/subscription.go:188`）+ `SyncUserBindGroupSubscriptions`（`model/subscription.go:862`），只要用户的 group 变了，对应套餐会自动同步。因此「自动分配套餐」不需要新建逻辑，只需让 group 在用户创建/同步时按岗位自动决定即可。

## 目标

1. 新用户创建时（OAuth 登录、飞书批量创建、管理员手动创建），根据飞书岗位（`job_title`）自动分配分组。
2. 定时同步飞书用户信息时，根据岗位变更重新计算分组（用户调岗的兜底）。
3. 支持管理员维护「岗位 → 分组」映射规则表。
4. 支持配置「受保护分组」白名单，白名单内的用户不被自动规则覆盖。
5. 提供一键初始化功能：基于现有用户的岗位与分组分布生成映射规则草稿，管理员确认后批量入库。
6. 在用户个人信息页展示「岗位」字段（中文标签）。

## 非目标

1. 不改变 `bind_group` 订阅的「删旧建新」额度处理逻辑——分组切换时 bind_group 订阅仍是删除旧的、新建新的（`AmountUsed` 归零），历史消耗日志不受影响（`logs` 表与 `user_subscriptions` 无外键关联）。
2. 不修改计费链路（`PreConsumeUserSubscription` / `PostConsumeUserSubscriptionDelta` / `RecordConsumeLog` 等）。
3. 不按组织/部门维度做分组匹配，仅按岗位（`job_title`）匹配。
4. 不做用户级「锁定」标记，保护机制仅采用分组级白名单。
5. 不处理岗位的模糊匹配/正则匹配，本轮只做精确匹配。

## 现状关键事实

### 消耗日志与订阅的独立性（已验证）

- `Log` 表（`model/log.go:75-97`）只按 `UserId` + `CreatedAt` 索引，**没有** `UserSubscriptionId` 外键，全仓搜索 `OnDelete|CASCADE` 零命中。
- 删除 `UserSubscription`（`model/subscription.go:1123-1161` `AdminDeleteUserSubscription`）只硬删除 `user_subscriptions` 表一行，`logs` 表完全不受影响。
- 因此「分组切换 → 删旧 bind_group 订阅 → 历史消耗日志丢失」的担忧**不成立**，历史记录天然保留。

### 订阅同步的幂等性（已验证）

- `SyncUserBindGroupSubscriptions`（`model/subscription.go:862-917`）创建新订阅前会 `Count` 检查（line 891-897），同一 `plan_id` 不会重复创建。
- 边界场景：用户岗位 A→B→A 循环切换时，离开 A 删订阅、回到 A 时 `count=0` 会重新建一份新额度。但只影响 `bind_group` 来源（组织福利套餐），不影响用户自购套餐；实际中岗位很少来回切。本轮按用户决策保持现状。

### 创建路径

| 创建路径 | 位置 | 现状 group 赋值 |
|---------|------|----------------|
| OAuth 登录创建 | `controller/oauth.go:~452-543` | `feishu.default_group`（`pending`） |
| 飞书批量创建 | `controller/feishu_admin_api.go:580,692-695` | `item.Group` 或 `default` |
| 管理员手动创建 | `controller/user.go:1002,1052` | DB 默认 `'default'` |
| 普通注册 | `controller/user.go:188` | DB 默认 `'default'` |

### 创建时拿不到 JobTitle

OAuth 接口只返回 `open_id/union_id/user_id/name/email/mobile`，**不返回** `job_title`。详细的 JobTitle 需要额外调飞书 `contact/v3/users/:user_id` 接口获取。项目已有 SDK：`github.com/larksuite/oapi-sdk-go/v3`，且 `service/feishu_user_info_sync.go` 已有完整调用示例。

### 定时同步任务 hook 点

`service/feishu_user_info_sync.go:185` 的 `Updates` 调用之后、line 191 缓存刷新之前，是「拉到 JobTitle 后重算 group」的最佳插入点。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│  管理员后台                                                   │
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │ 岗位→分组映射规则页  │    │ 受保护分组配置       │         │
│  │ (CRUD + 一键初始化)  │    │ (逗号分隔分组名)     │         │
│  └──────────┬──────────┘    └──────────┬──────────┘         │
└─────────────┼──────────────────────────┼────────────────────┘
              │ 写入                       │ 写入
              ▼                            ▼
┌──────────────────────────┐  ┌────────────────────────────┐
│ group_mapping_rules 表    │  │ OptionMap:                  │
│ (job_title, target_group, │  │ auto_group.protected_groups │
│  enabled, priority)       │  │ = "vip,partner,trial"       │
└────────────┬─────────────┘  └─────────────┬───────────────┘
             │                              │
             │  ┌───────────────────────────┘
             ▼  ▼
    ┌────────────────────────────────────┐
    │  核心决策 service/auto_group.go     │
    │  ResolveGroupByJobTitle(jobTitle)   │
    │  IsProtectedGroup(group)            │
    │  ResolveAndCheckAutoGroup(...)      │
    │  ApplyAutoGroupChange(...)          │
    └────────────────┬───────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
 ┌──────────────┐         ┌──────────────┐
 │ 创建时拉一次   │         │ 定时同步重算  │
 │ (OAuth/批量/  │         │ (feishu_     │
 │  手动创建)    │         │  user_info_  │
 │              │         │  sync L185)  │
 └──────────────┘         └──────────────┘
        │                         │
        └──────────┬──────────────┘
                   ▼
    命中规则 && 目标group≠当前group && 当前group不在白名单
                   │
                   ▼
    Update group + SyncUserBindGroupSubscriptions (已有)
    (订阅套餐自动跟随,无需新写)
```

## 数据模型

### 新表 `group_mapping_rules`

```go
// model/group_mapping.go（新建）
type GroupMappingRule struct {
    Id          int    `json:"id" gorm:"primaryKey"`
    JobTitle    string `json:"job_title" gorm:"type:varchar(128);uniqueIndex"`
    TargetGroup string `json:"target_group" gorm:"type:varchar(64)"`
    Enabled     bool   `json:"enabled"`
    Priority    int    `json:"priority" gorm:"default:0"`
    Remark      string `json:"remark" gorm:"type:varchar(256)"`
    CreatedAt   int64  `json:"created_at"`
    UpdatedAt   int64  `json:"updated_at"`
}
```

设计要点：
- `JobTitle` 唯一索引：一个岗位只对应一个分组，避免歧义。
- `Enabled`：可禁用单条规则而不删除。
- `Priority` 预留：当前 JobTitle 唯一所以用不上，未来扩展到模糊匹配时可用。

表名：`group_mapping_rules`。在 `model/main.go` 的 `InitSysDB` / `InitLogDB` 注册到 `AutoMigrate`。

### 新配置项（走现有 OptionMap）

```
auto_group.protected_groups = ""   // 逗号分隔的分组名，默认空
```

放在 `model/option.go` 的 `OptionMap`，运行时可改，不新建表。初始化为空字符串（无保护分组）。

### 默认选择（已与用户确认）

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 匹配语义 | JobTitle 精确匹配（区分大小写） | 飞书岗位是枚举值 |
| JobTitle 为空 | 跳过（不改 group） | 没岗位信息无法决策 |
| 未命中规则 | 保持现状（不改 group） | 兜底用现有 `feishu.default_group=pending` |
| 白名单语义 | 当前 group 在白名单 → 跳过重算 | 分组级保护 |
| 创建时拉飞书失败 | 容忍失败，保持默认分组 | 不阻塞用户创建 |
| bind_group 订阅额度 | 保持「删旧建新」现状 | 历史日志不丢，边界场景可接受 |

## 核心决策逻辑

新建 `service/auto_group.go`：

```go
// 根据 jobTitle 算出目标 group，未命中返回 ""
func ResolveGroupByJobTitle(jobTitle string) (string, error) {
    if jobTitle == "" {
        return "", nil
    }
    // SELECT target_group FROM group_mapping_rules
    //   WHERE job_title = ? AND enabled = true
    // 精确匹配，区分大小写
    var rule model.GroupMappingRule
    err := model.DB.Where("job_title = ? AND enabled = ?", jobTitle, true).First(&rule).Error
    if errors.Is(err, gorm.ErrRecordNotFound) {
        return "", nil
    }
    if err != nil {
        return "", err
    }
    return rule.TargetGroup, nil
}

// 判断 group 是否受保护（读 OptionMap: auto_group.protected_groups）
func IsProtectedGroup(group string) bool {
    if group == "" {
        return false
    }
    raw := model.OptionMap["auto_group.protected_groups"] // 内存缓存，注册到 OptionMap
    for _, g := range strings.Split(raw, ",") {
        if strings.TrimSpace(g) == group {
            return true
        }
    }
    return false
}

// 统一入口：算 group + 检查白名单 + 决定是否变更
// 返回 (newGroup, changed)。changed=false 表示无需动。
func ResolveAndCheckAutoGroup(currentGroup, jobTitle string) (newGroup string, changed bool, err error) {
    target, err := ResolveGroupByJobTitle(jobTitle)
    if err != nil {
        return currentGroup, false, err
    }
    if target == "" {
        return currentGroup, false, nil // 未命中规则
    }
    if currentGroup == target {
        return target, false, nil // 已是目标分组
    }
    if IsProtectedGroup(currentGroup) {
        return currentGroup, false, nil // 白名单保护
    }
    return target, true, nil
}

// 执行变更（复用现有机制）
func ApplyAutoGroupChange(userId int, oldGroup, newGroup string) error {
    // 1. Update group（用 commonGroupCol 处理保留字）
    if err := model.DB.Model(&model.User{}).Where("id = ?", userId).
        Update(commonGroupCol, newGroup).Error; err != nil {
        return err
    }
    // 2. 触发订阅同步（已有函数，幂等）
    if err := model.SyncUserBindGroupSubscriptions(userId, oldGroup, newGroup); err != nil {
        common.SysLog(fmt.Sprintf("auto-group: SyncUserBindGroupSubscriptions failed user %d: %s", userId, err.Error()))
    }
    // 3. 刷新缓存
    _ = model.InvalidateUserCache(userId)
    // 4. 写系统日志
    model.RecordLog(userId, model.LogTypeSystem,
        fmt.Sprintf("自动分组: %s -> %s", oldGroup, newGroup))
    return nil
}
```

## 触发点

### 触发点 1：创建时立即拉一次飞书

新建 `service/feishu_fetch.go`：封装「给 open_id，调 contact/v3 拿 JobTitle/Department」的函数，复用 `service/feishu_user_info_sync.go` 里已有的 SDK 调用模式（构造 `larkws.Client` + `contact.GetUser` Request）。

```go
// 拉取单个飞书用户的岗位信息（仅 JobTitle，最小化字段）
func FetchFeishuJobTitle(feishuUserId string) (string, error) { ... }
```

在三处创建路径，**事务提交后**调用（不阻塞事务）：

| 创建路径 | 位置 | 逻辑 |
|---------|------|------|
| OAuth 登录创建 | `controller/oauth.go` `FinalizeOAuthUserCreation` 之后 | 仅飞书 OAuth 路径：拉 JobTitle → `ResolveAndCheckAutoGroup` → `ApplyAutoGroupChange` |
| 飞书批量创建 | `controller/feishu_admin_api.go:692-695` | 若 `item.Group` 显式指定则用它（管理员意图优先）；否则拉飞书 + 自动决策；再否则 `default` |
| 管理员手动创建 | `controller/user.go:1052` `FinishInsert` 之后 | 仅当该用户有 `FeishuId` 时尝试；普通注册用户跳过 |

**失败容忍**：拉飞书失败 → `common.SysLog` warn → 保持现有默认分组，不向调用方报错。

### 触发点 2：定时同步任务重算

`service/feishu_user_info_sync.go:185` 的 `Updates` 之后插入：

```go
// 拉到 JobTitle 后重算 group（用户调岗的兜底）
if jobTitle, ok := updates["job_title"].(string); ok && jobTitle != "" {
    if newGroup, changed, err := ResolveAndCheckAutoGroup(user.Group, jobTitle); err == nil && changed {
        if err := ApplyAutoGroupChange(user.Id, user.Group, newGroup); err == nil {
            user.Group = newGroup
            common.SysLog(fmt.Sprintf("auto-group: user %d %q -> %q (JobTitle=%q)",
                user.Id, oldGroup, newGroup, jobTitle))
        }
    }
}
```

注意：`user.Group` 在 Updates 之后仍是旧值（GORM 不自动刷新），需在调用前用变量保存 `oldGroup := user.Group`。

### 触发点 3：管理员手动设置分组

不额外 hook。`AdminSetUserGroup`（`controller/feishu_admin.go:131`）已是最高优先级，且已正确触发订阅同步。

## 后端 API

新建 `controller/auto_group.go`，挂在 `adminRoute`（仅管理员）：

```
GET    /api/auto-group/rules               列出所有规则
POST   /api/auto-group/rules               新增规则
PUT    /api/auto-group/rules/:id           编辑规则
DELETE /api/auto-group/rules/:id           删除规则
GET    /api/auto-group/resolve             测试匹配（query: job_title）
                                         返回 {matched, target_group}
GET    /api/auto-group/config              读 protected_groups
PUT    /api/auto-group/config              写 protected_groups

POST   /api/auto-group/initialize/preview  一键初始化预览（见下节）
POST   /api/auto-group/initialize/apply    一键初始化保存（见下节）
```

路由注册在 `router/api-router.go` 的 `adminRoute` 组下。

### 一键初始化

#### preview 接口

`POST /api/auto-group/initialize/preview`

逻辑：
1. 查询所有用户：`SELECT job_title, group, COUNT(*) FROM users GROUP BY job_title, group`。
2. 排除：`job_title` 为空、`group` 为空、`group` 在白名单（`auto_group.protected_groups`）。
3. 按 `job_title` 聚合，每个 job_title 算出：
   - `suggested_group`：该 job_title 下用户最多的 group（众数）。
   - `user_count`：该 job_title 的总用户数。
   - `group_distribution`：如 `{ "dev": 45, "test": 5 }`。
   - `conflict`：`len(group_distribution) > 1`。
4. 查询 `group_mapping_rules` 表，已存在的 job_title 标记 `exists=true`（预览时默认不覆盖）。
5. 返回草稿列表，**不入库**。

响应示例：
```json
{
  "items": [
    {
      "job_title": "工程师",
      "suggested_group": "dev",
      "user_count": 50,
      "group_distribution": { "dev": 45, "test": 5 },
      "conflict": true,
      "exists": false
    },
    {
      "job_title": "产品经理",
      "suggested_group": "pm",
      "user_count": 12,
      "group_distribution": { "pm": 12 },
      "conflict": false,
      "exists": true
    }
  ],
  "protected_groups": ["vip", "partner"]
}
```

#### apply 接口

`POST /api/auto-group/initialize/apply`

入参：
```json
{
  "rules": [
    { "job_title": "工程师", "target_group": "dev" },
    { "job_title": "产品经理", "target_group": "pm" }
  ]
}
```

逻辑：单事务内批量 upsert（按 `job_title` 唯一键），已存在的更新 `target_group`，不存在的插入。`enabled` 默认 true。

## 前端设计

### 页面 A：岗位 → 分组映射规则

新页面 `/auto-group-rules`，仅管理员可见。

**表格列**：岗位名称 / 目标分组 / 启用 / 优先级 / 备注 / 操作（编辑、删除）

**新增/编辑表单**：
- 岗位名称（文本，必填，唯一）
- 目标分组（下拉，选项来自 `GET /api/group/` 的 `UserUsableGroups`）
- 启用开关
- 备注

**顶部工具区**：
- 「一键初始化」按钮 → 调 `preview` → 弹出批量编辑表格：
  - 列：勾选 / 岗位名称 / 建议分组（可改下拉）/ 用户数 / 分布 / 冲突标记
  - 冲突行（`conflict=true`）置顶 + 高亮 ⚠️，tooltip 提示"该岗位跨多个分组，请确认"
  - 已存在行（`exists=true`）默认不勾选
  - 管理员可批量改下拉、取消勾选
  - 「保存勾选项」→ 调 `apply`
- 「测试匹配」输入框：输入 JobTitle 实时调 `resolve`，显示匹配到的分组

### 页面 B：受保护分组配置

放在映射规则页顶部一个配置区：
- 标签式多选/逗号输入框，选项来自 `GET /api/group/` 的所有分组
- 保存到 `auto_group.protected_groups`

### 用户信息页展示「岗位」

在用户个人信息/编辑页（`web/default/` 的 user detail / profile 组件）展示 `job_title` 字段：
- 标签用中文「岗位」
- 只读展示
- i18n key 走现有体系（`web/default/src/i18n/locales/{lang}.json`），中文值「岗位」，英文值 "Job Title"，其余语种相应翻译

## 错误处理

| 场景 | 处理 |
|------|------|
| 创建时拉飞书超时/失败 | `SysLog` warn，保持默认分组，不阻塞创建流程 |
| JobTitle 在规则表里但 TargetGroup 不在 `UserUsableGroups` | 跳过 + `SysLog` error（配置错误提示） |
| 飞书 App 未配置（AppID/AppSecret 为空） | 自动分组功能静默关闭，所有触发点跳过 |
| 同一 JobTitle 重复新增 | DB 唯一索引拦截，返回 409 Conflict |
| 并发：创建 + 同时定时同步触发 | 依赖 `SyncUserBindGroupSubscriptions` 的 `count > 0` 幂等 |
| 一键初始化 apply 时 job_title 重复 | 单事务内按唯一键 upsert，无并发问题 |

## 测试

### 单元测试 `service/auto_group_test.go`

覆盖：
- `ResolveGroupByJobTitle`：命中 / 未命中 / 空字符串 / 禁用的规则
- `IsProtectedGroup`：在白名单 / 不在 / 空配置
- `ResolveAndCheckAutoGroup`：所有分支（未命中、已同组、白名单保护、应变更）

### 集成测试

- 构造用户 + 规则，验证创建路径触发 group 变更 + `SyncUserBindGroupSubscriptions` 被调用
- 构造 JobTitle 变更，验证定时同步 hook 重算 group
- 验证白名单用户不被覆盖
- 验证一键初始化 preview 的众数计算和冲突标记

### 跨库兼容

- `group_mapping_rules` 建表用 GORM `AutoMigrate`，字段类型用 `varchar`，无数据库专有类型。
- `group` 列在代码里是保留字，DB 操作统一走 `commonGroupCol`（`model/main.go`）。

## 文件清单

| 类型 | 路径 | 说明 |
|------|------|------|
| 新建 model | `model/group_mapping.go` | `GroupMappingRule` 结构 + CRUD 方法 |
| 新建 service | `service/auto_group.go` | 核心决策逻辑 |
| 新建 service | `service/feishu_fetch.go` | 创建时拉单个用户 JobTitle |
| 新建 controller | `controller/auto_group.go` | 规则 CRUD + 配置 + 一键初始化 |
| 修改 router | `router/api-router.go` | 注册 admin 路由 |
| 修改 model | `model/main.go` | `AutoMigrate` 注册新表 |
| 修改 model | `model/option.go` | 注册 `auto_group.protected_groups` 默认值 |
| 修改 controller | `controller/oauth.go` | OAuth 创建后拉飞书 + 自动分组 |
| 修改 controller | `controller/feishu_admin_api.go` | 批量创建路径接入自动分组 |
| 修改 controller | `controller/user.go` | 管理员创建后接入自动分组 |
| 修改 service | `service/feishu_user_info_sync.go` | 定时同步 hook（L185 之后） |
| 新建 controller test | `controller/auto_group_test.go` | API 层测试 |
| 新建 service test | `service/auto_group_test.go` | 决策逻辑测试 |
| 新建前端页面 | `web/default/src/features/auto-group/` | 映射规则页 + 一键初始化弹窗 |
| 修改前端 | `web/default/src/features/users/` | 用户详情展示「岗位」 |
| 修改 i18n | `web/default/src/i18n/locales/*.json` | 新增翻译 key |

## 复用清单

| 已有能力 | 复用点 |
|---------|-------|
| `SyncUserBindGroupSubscriptions` | group 变更后自动同步套餐 |
| `larkws.Client` + SDK | 拉飞书用户信息 |
| `InvalidateUserCache` | 刷新用户缓存 |
| `RecordLog` | 写系统日志 |
| `commonGroupCol` | group 列跨库兼容 |
| `UserUsableGroups` | 前端分组下拉选项 |
| `OptionMap` | 配置项读写 |
