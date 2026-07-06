# 按岗位自动分组 - 实现计划

基于 spec：`docs/superpowers/specs/2026-07-06-auto-group-by-jobtitle-design.md`

## 模块拆解与依赖顺序

```
阶段 1 (后端基础) ──┐
  1.1 数据模型          │
  1.2 配置项注册        │
  1.3 核心决策 service  │◀── 依赖 1.1, 1.2
                    │
阶段 2 (后端 API) ──┤
  2.1 规则 CRUD API    │◀── 依赖 1.1
  2.2 配置读写 API      │◀── 依赖 1.2
  2.3 一键初始化 API    │◀── 依赖 1.1, 1.2
  2.4 路由注册          │◀── 依赖 2.1-2.3
                    │
阶段 3 (触发点接入) ─┤
  3.1 feishu_fetch      │◀── 独立，依赖飞书 SDK
  3.2 定时同步 hook     │◀── 依赖 1.3
  3.3 OAuth 创建 hook   │◀── 依赖 1.3, 3.1
  3.4 批量创建 hook     │◀── 依赖 1.3, 3.1
  3.5 管理员创建 hook   │◀── 依赖 1.3, 3.1
                    │
阶段 4 (前端) ──────┤
  4.1 映射规则页        │◀── 依赖 2.4
  4.2 一键初始化弹窗    │◀── 依赖 2.3
  4.3 受保护分组配置    │◀── 依赖 2.2
  4.4 用户详情展示岗位  │◀── 独立
  4.5 i18n             │◀── 依赖 4.1-4.4
                    │
阶段 5 (测试与验证) ─┘
  5.1 单元测试          │◀── 依赖 1.3
  5.2 集成测试          │◀── 依赖 阶段 3
  5.3 跨库兼容验证      │◀── 依赖 1.1, 2.3
```

---

## 阶段 1：后端基础

### 1.1 数据模型

**文件**：`model/group_mapping.go`（新建）

**任务**：
1. 定义 `GroupMappingRule` 结构体（按 spec）
2. 实现 CRUD 方法：
   - `GetAllGroupMappingRules() ([]GroupMappingRule, error)`
   - `CreateGroupMappingRule(rule *GroupMappingRule) error`
   - `UpdateGroupMappingRule(rule *GroupMappingRule) error`
   - `DeleteGroupMappingRule(id int) error`
   - `GetGroupMappingRuleByJobTitle(jobTitle string) (*GroupMappingRule, error)`
3. 在 `model/main.go` 的 `AutoMigrate` 调用中注册 `GroupMappingRule{}`

**验证**：
- 启动服务，确认 `group_mapping_rules` 表在 SQLite/MySQL/PostgreSQL 均能创建
- 手动插入/查询/删除一条规则

**AGENTS.md 合规**：
- 字段类型用 `varchar`，无 DB 专有类型
- `Enabled` 不用 `gorm:"default:true"`，在 service/controller 层设默认值
- 时间戳用 `int64` + `common.GetTimestamp()`，与现有 model 一致

### 1.2 配置项注册

**文件**：`model/option.go`（修改）

**任务**：
1. 在 `OptionMap` 初始化处注册 `auto_group.protected_groups`，默认空字符串
2. 参照现有 `AutoGroups` 等配置项的注册模式（字符串类型，逗号分隔）

**验证**：
- 启动后 `options` 表有该 key
- 修改后内存缓存能刷新（参照现有 OptionMap reload 机制）

### 1.3 核心决策 service

**文件**：`service/auto_group.go`（新建）

**任务**：
1. 实现 `ResolveGroupByJobTitle(jobTitle string) (string, error)`
   - 空字符串返回 `("", nil)`
   - 查 `group_mapping_rules WHERE job_title=? AND enabled=true`
   - 未命中返回 `("", nil)`，其他错误返回 err
2. 实现 `IsProtectedGroup(group string) bool`
   - 读 `model.OptionMap["auto_group.protected_groups"]`
   - 按逗号分割，trim 后比较
3. 实现 `ResolveAndCheckAutoGroup(currentGroup, jobTitle string) (newGroup string, changed bool, err error)`
   - 组合上述两者 + 白名单检查
4. 实现 `ApplyAutoGroupChange(userId int, oldGroup, newGroup string) error`
   - Update `group` 列用 `model.CommonGroupCol`（确认导出名，可能是 `commonGroupCol` 在 model 包内，需导出或在 model 层封装）
   - 调 `model.SyncUserBindGroupSubscriptions(userId, oldGroup, newGroup)`
   - 调 `model.InvalidateUserCache(userId)`
   - 调 `model.RecordLog(...)` 写系统日志
5. 实现 `TryAutoGroupOnCreate(userId int, feishuId string)` 便捷函数
   - 封装「拉飞书 → 决策 → 应用」的完整流程，供触发点 3.3-3.5 调用
   - 内部 `defer recover()` 防 SDK panic

**关键决策**：`commonGroupCol` 当前在 `model/main.go` 是小写未导出。service 层调用 Update group 有两种方案：
- **方案 A（推荐）**：在 model 层加一个导出的 helper `model.UpdateUserGroup(userId, newGroup) error`，service 只调它。隔离 SQL 细节。
- 方案 B：导出 `commonGroupCol` 为 `CommonGroupCol`。改动面更小但破坏封装。

**验证**：
- 单测覆盖 `ResolveGroupByJobTitle` 的 4 个分支
- 单测覆盖 `IsProtectedGroup` 的 3 个分支
- 单测覆盖 `ResolveAndCheckAutoGroup` 的 4 个分支

---

## 阶段 2：后端 API

### 2.1 规则 CRUD API

**文件**：`controller/auto_group.go`（新建）

**任务**：
1. `GetGroupMappingRules` — `GET /api/auto-group/rules`
2. `CreateGroupMappingRule` — `POST /api/auto-group/rules`
   - 校验：job_title 非空且不重复、target_group 在 UserUsableGroups
   - 唯一索引冲突返回 409
3. `UpdateGroupMappingRule` — `PUT /api/auto-group/rules/:id`
4. `DeleteGroupMappingRule` — `DELETE /api/auto-group/rules/:id`
5. `ResolveGroupTest` — `GET /api/auto-group/resolve?job_title=xxx`
   - 返回 `{matched: bool, target_group: string}`

**验证**：
- 手动 curl/Postman 测试每个端点
- 唯一索引冲突返回正确错误码

### 2.2 配置读写 API

**任务**：
1. `GetAutoGroupConfig` — `GET /api/auto-group/config`
   - 返回 `{protected_groups: ["vip", "partner"]}`（字符串 split 后返回数组）
2. `UpdateAutoGroupConfig` — `PUT /api/auto-group/config`
   - 入参 `{protected_groups: ["vip", "partner"]}`
   - join 成逗号串写入 OptionMap，调 `model.UpdateOption`

### 2.3 一键初始化 API

**任务**：
1. `InitializePreview` — `POST /api/auto-group/initialize/preview`
   - 用 GORM `Select` + `Group` 聚合查询（避免裸 SQL 的保留字问题）
   - 排除 job_title 空、group 空、group 在白名单
   - 计算众数 suggested_group、分布 group_distribution、冲突标记
   - 查现有 rules 标记 exists
2. `InitializeApply` — `POST /api/auto-group/initialize/apply`
   - 单事务批量 upsert

**验证**：
- 构造测试数据（多个 job_title + group 分布），验证众数计算
- 验证白名单用户被排除

### 2.4 路由注册

**文件**：`router/api-router.go`（修改）

**任务**：在 `adminRoute` 组下注册 2.1-2.3 的所有路由。

---

## 阶段 3：触发点接入

### 3.1 feishu_fetch service

**文件**：`service/feishu_fetch.go`（新建）

**任务**：
1. 实现 `FetchFeishuJobTitle(feishuUserId string) (string, error)`
   - 复用 `service/feishu_user_info_sync.go` 里的 lark client 构造方式
   - 调 `contact/v3/users/:user_id`，仅取 `job_title` 字段
   - 飞书未配置时返回 `("", errFeishuNotConfigured)`，调用方据此跳过

**验证**：用一个真实 feishu_id 调用，确认返回 job_title

### 3.2 定时同步 hook

**文件**：`service/feishu_user_info_sync.go`（修改，L185 之后）

**任务**：
1. 在 `Updates` 之后、缓存刷新之前插入（spec 代码片段）
2. 从 updates map 取 job_title，调 `ResolveAndCheckAutoGroup`
3. 命中且 changed 则调 `ApplyAutoGroupChange`
4. 更新 user.Group 内存值

### 3.3 OAuth 创建 hook

**文件**：`controller/oauth.go`（修改）

**任务**：在飞书 OAuth 创建用户的 `FinalizeOAuthUserCreation` 之后：
1. 异步或同步调 `service.TryAutoGroupOnCreate(user.Id, user.FeishuId)`
2. 失败静默（已记日志）

### 3.4 批量创建 hook

**文件**：`controller/feishu_admin_api.go`（修改，L692-695）

**任务**：调整 group 赋值逻辑为：
```
if item.Group != "" { group = item.Group }       // 管理员显式指定优先
else {                                             // 否则自动决策
    jobTitle := fetchJobTitle(item.FeishuId)      // 可能批量已有，复用
    if target, ok := resolve(jobTitle); ok { group = target }
    else { group = "default" }
}
```

### 3.5 管理员创建 hook

**文件**：`controller/user.go`（修改，L1052 之后）

**任务**：在 `FinishInsert` 之后：
1. 仅当 `user.FeishuId != ""` 时调 `TryAutoGroupOnCreate`
2. 普通注册用户（无 FeishuId）跳过

---

## 阶段 4：前端

### 4.1 映射规则页

**文件**：`web/default/src/features/auto-group/`（新建目录）
- `rules-page.tsx` — 主页面
- `rule-edit-dialog.tsx` — 新增/编辑弹窗
- `api.ts` — API 调用封装

**任务**：
1. 表格展示规则列表（岗位/目标分组/启用/优先级/备注/操作）
2. 新增/编辑表单（岗位名称、目标分组下拉、启用开关、备注）
3. 删除确认
4. 目标分组下拉选项来自 `GET /api/group/`
5. 路由注册到 `/auto-group-rules`，仅管理员可见（参照现有 admin 路由守卫）

### 4.2 一键初始化弹窗

**文件**：`web/default/src/features/auto-group/init-dialog.tsx`（新建）

**任务**：
1. 「一键初始化」按钮调 preview
2. 批量编辑表格：勾选/岗位/建议分组(下拉可改)/用户数/分布/冲突标记
3. 冲突行置顶 + ⚠️ 高亮
4. 已存在行默认不勾选
5. 「保存勾选项」调 apply

### 4.3 受保护分组配置

**文件**：`web/default/src/features/auto-group/protected-config.tsx`（新建）

**任务**：映射规则页顶部配置区，标签式多选（选项来自所有分组），保存到 config API。

### 4.4 用户详情展示岗位

**文件**：`web/default/src/features/users/`（修改 user detail 组件）

**任务**：
1. 在用户信息区增加只读字段：标签「岗位」，值 `user.job_title`
2. 为空时不显示该行

### 4.5 i18n

**文件**：`web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi}.json`

**新增 key**（以英文为 key）：
- `"Job Title"` → zh: "岗位", en: "Job Title", ...
- `"Auto Group Rules"` → zh: "自动分组规则"
- `"Protected Groups"` → zh: "受保护分组"
- `"Initialize from Existing"` → zh: "一键初始化"
- `"Suggested Group"` → zh: "建议分组"
- `"Conflict"` → zh: "冲突"
- 等等（按页面实际文案补全）

---

## 阶段 5：测试与验证

### 5.1 单元测试

**文件**：`service/auto_group_test.go`

**用例**：
- `TestResolveGroupByJobTitle_Hit` — 命中规则
- `TestResolveGroupByJobTitle_NotFound` — 未命中
- `TestResolveGroupByJobTitle_Empty` — 空字符串
- `TestResolveGroupByJobTitle_Disabled` — 规则禁用
- `TestIsProtectedGroup_InList` / `TestIsProtectedGroup_NotInList` / `TestIsProtectedGroup_EmptyConfig`
- `TestResolveAndCheckAutoGroup_NotMatched` / `_SameGroup` / `_Protected` / `_ShouldChange`

### 5.2 集成测试

**文件**：`controller/auto_group_test.go`

**用例**：
- 创建用户（带 FeishuId）→ 验证 group 被自动设为规则目标
- 修改用户 job_title → 触发同步 → 验证 group 变更
- 白名单用户 → job_title 变更 → 验证 group 不变
- 一键初始化 preview → 验证众数与冲突标记

### 5.3 跨库兼容验证

**任务**：
- SQLite（默认）：建表 + CRUD + 一键初始化聚合查询
- MySQL：同上（特别验证 `group` 列的引号处理）
- PostgreSQL：同上（特别验证 `group` 列的双引号）

---

## 实施顺序建议

1. **阶段 1** 全部完成 + 单测 → 确认基础逻辑正确
2. **阶段 2** 完成 → 用 Postman 验证 API
3. **阶段 3.1 + 3.2** → 验证定时同步路径（最容易测）
4. **阶段 3.3-3.5** → 验证创建路径（需要飞书测试账号）
5. **阶段 4** → 前端联调
6. **阶段 5** → 补全测试 + 跨库验证

每个阶段完成后提交一次，便于回滚。
