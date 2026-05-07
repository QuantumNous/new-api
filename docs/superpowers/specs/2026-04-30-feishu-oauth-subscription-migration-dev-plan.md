# 飞书 OAuth 迁移开发计划与任务清单

> 关联设计文档：`2026-04-30-feishu-oauth-subscription-migration-design.md`

## 开发依赖关系

```
任务1(飞书Provider) ──→ 任务2(回调路由) ──→ 任务3(默认分组) ──→ 任务4(密码拦截)
                                                        ↘
任务5(绑定管理接口) ←─────────────────────────────────────┘
任务6(分组联动接口) ←─────────────────────────────────────┘

任务7(图标组件) ──→ 任务8(登录页改造)
任务9(OAuth设置Tab) ←── 任务7
任务10(分组映射) ←── 任务6(后端)
任务11(绑定管理) ←── 任务5(后端)
任务12(i18n) ←── 任务8,9,10,11

任务13(联调) ←── 全部
```

## 建议开发顺序

| 批次 | 任务 | 说明 |
|------|------|------|
| 1 | 任务1 + 任务7 | 后端 Provider + 前端图标组件（并行） |
| 2 | 任务2 + 任务3 | 回调路由 + 默认分组机制 |
| 3 | 任务4 | 密码拦截 + 策略开关 |
| 4 | 任务5 + 任务6 | 管理端后端接口（可并行） |
| 5 | 任务8 | 登录页改造 |
| 6 | 任务9 + 任务10 + 任务11 | 三个管理端页面（可并行） |
| 7 | 任务12 | i18n 收尾 |
| 8 | 任务13 | 联调灰度 |

---

## 阶段一：飞书 OAuth 后端基础

### 任务1：飞书 OAuth Provider 实现

**目标**：在 `oauth/` 包中实现飞书 OAuth Provider，遵循现有 `Provider` 接口。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 新增 | `oauth/feishu.go` |
| 修改 | `oauth/registry.go`（注册飞书 provider） |
| 修改 | `setting/system_setting/` 相关（新增飞书配置项读取） |

**开发内容**：
- 实现 `Provider` 接口的全部方法
- `ExchangeToken`：调用飞书 `https://open.feishu.cn/open-apis/authen/v1/oidc/access_token` 换 token
- `GetUserInfo`：调用飞书 `https://open.feishu.cn/open-apis/authen/v1/user_info` 获取用户信息
- 飞书返回的 `open_id`、`union_id`、`name`、`avatar_url` 映射到 `OAuthUser`
- `union_id` 作为 `ProviderUserID`（主键），`open_id` 存入 `Extra`
- 新增系统配置项：`FeishuOAuthEnabled`、`FeishuAppID`、`FeishuAppSecret`
- `GetProviderPrefix` 返回 `"feishu_"`

**验证**：单元测试 `ExchangeToken` 和 `GetUserInfo` 的 HTTP mock

---

### 任务2：飞书 OAuth 回调路由 + 登录/注册流程

**目标**：在 `controller/oauth.go` 中处理飞书 OAuth 回调，完成登录/注册/绑定。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 修改 | `controller/oauth.go` |
| 修改 | `router/` 相关路由注册 |
| 修改 | `model/user.go`（`InsertWithTx` 增强） |

**开发内容**：
- 新增路由 `GET /oauth/feishu`（回调地址）
- 回调流程：
  1. 用 `code` 换 token → 获取飞书用户信息
  2. 按 `union_id` 查 `user_oauth_bindings` → 命中则登录
  3. 未命中 → 创建新用户（`Group = pending`，`Quota = 0`）→ 写绑定 → 登录
  4. 用户名同步为飞书用户名（冲突加后缀 `_fs_{uid尾4位}`）
- 存量用户匹配：灰度阶段可通过飞书邮箱匹配存量账号（可配置开关）

**验证**：手动测试飞书 OAuth 完整流程

---

### 任务3：飞书登录默认分组 + 零额度机制

**目标**：确保飞书新注册用户进 `pending` 分组、零额度、无 API 能力。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 修改 | `controller/oauth.go`（飞书注册分支） |
| 修改 | `setting/system_setting/`（新增 `FeishuDefaultGroup` 配置项） |

**开发内容**：
- 新增系统 option `FeishuDefaultGroup`（默认值 `pending`）
- 飞书 OAuth 新建用户时：
  - `user.Group = FeishuDefaultGroup`
  - `user.Quota = 0`（跳过 `QuotaForNewUser`）
  - 跳过邀请码奖励
- 确保 `pending` 分组在 `group_ratio` 中无模型倍率配置
- 写审计日志：`飞书OAuth创建用户，分组=pending，额度=0`

**验证**：飞书新用户注册后验证 group 和 quota 值，尝试调 API 确认被拒绝

---

### 任务4：密码登录拦截 + 登录策略开关

**目标**：已绑定飞书的用户禁止密码登录；提供全局 `parallel / feishu_only` 开关。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 修改 | `controller/user.go`（`Login` 函数增加拦截） |
| 修改 | `setting/system_setting/`（新增 `AuthPolicy` 配置项） |
| 修改 | `controller/option.go` 或相关（`PUT /api/option/auth-policy`） |

**开发内容**：
- 密码登录拦截逻辑：
  - 查询用户是否有飞书绑定（`user_oauth_bindings` 中 `provider_slug = feishu`）
  - 有绑定 → 返回错误 "请使用飞书登录"
- `AuthPolicy` 开关：
  - `parallel`：密码 + 飞书并行（已绑定飞书的用户仍禁密码）
  - `feishu_only`：所有密码登录禁用
- `PUT /api/option/auth-policy` 接口，仅 Root 权限

**验证**：已绑定飞书用户密码登录被拒；切换 `feishu_only` 后所有密码登录被拒

---

## 阶段二：管理端后端接口

### 任务5：飞书绑定导入/查询/重放接口

**目标**：管理员可批量导入飞书绑定、查询、重放失败记录。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 新增 | `controller/feishu_admin.go` |
| 新增 | `model/feishu_binding.go`（或扩展 `user_oauth_binding.go`） |
| 修改 | `router/` 路由注册 |

**开发内容**：
- `POST /api/user/admin/oauth/feishu/import`：批量导入绑定（幂等）
- `GET /api/user/admin/oauth/feishu/bindings`：分页查询，支持按 user_id/username/union_id 筛选
- `POST /api/user/admin/oauth/feishu/replay`：按批次重试失败记录
- 导入时同步用户名（按冲突规则）
- 所有接口仅 AdminAuth/RootAuth，写操作日志

**验证**：批量导入测试数据，查询、重放

---

### 任务6：分组联动重算接口

**目标**：套餐绑定分组变更时，可触发用户订阅批量同步。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 新增/修改 | `controller/subscription_admin.go` |
| 修改 | `model/subscription.go`（`HandleUserGroupChange` 增强） |
| 修改 | `router/` 路由注册 |

**开发内容**：
- `POST /api/subscription/admin/group-sync`：支持 `group_name` / `plan_id` / `full=true` 三种维度
- 扫描受影响用户 → 执行订阅切换（幂等）→ 记录审计
- 与现有 `HandleUserGroupChange` 复用逻辑

**验证**：修改套餐分组绑定后调用接口，验证用户订阅已同步

---

## 阶段三：前端页面开发

### 任务7：飞书品牌图标组件

**目标**：创建 `IconFeishu` SVG 组件。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 新增 | `web/classic/src/assets/brand-icons/icon-feishu.tsx` |
| 修改 | `web/classic/src/assets/brand-icons/index.ts` |

**开发内容**：
- 从飞书官方获取 SVG path 数据（品牌 logo，蓝绿色 `#3370FF`）
- 遵循 `IconGithub` / `IconWeChat` 的组件模式
- `viewBox="0 0 24 24"`，`width='24'`，`height='24'`
- 在 `index.ts` 中导出 `IconFeishu`

**验证**：在测试页面渲染图标

---

### 任务8：登录页改造（飞书专属登录）

**目标**：登录页仅展示飞书登录按钮（+ 可选密码表单），隐藏所有其他 OAuth。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 修改 | `web/classic/src/features/auth/sign-in/components/user-auth-form.tsx` |
| 修改 | `web/classic/src/features/auth/components/oauth-providers.tsx` |
| 修改 | `web/classic/src/features/auth/hooks/use-oauth-login.ts` |
| 修改 | `web/classic/src/features/auth/lib/oauth.ts` |
| 修改 | `web/classic/src/features/auth/types.ts` |

**开发内容**：
- `types.ts`：`SystemStatus` 新增 `feishu_oauth: boolean`、`auth_policy: string`
- `lib/oauth.ts`：新增 `buildFeishuOAuthUrl`
- `use-oauth-login.ts`：新增 `handleFeishuLogin`
- `oauth-providers.tsx`：
  - 飞书按钮独立渲染，使用品牌样式（`bg-[#3370FF] text-white`，非 `variant='outline'`）
  - 飞书启用时隐藏其他所有 OAuth 按钮
- `user-auth-form.tsx`：
  - `auth_policy === 'feishu_only'`：隐藏密码表单，仅渲染飞书按钮
  - `auth_policy === 'parallel'`：飞书按钮在上 + 密码表单在下（无其他 OAuth）

**验证**：`feishu_only` 模式下登录页仅有一个飞书按钮；`parallel` 模式下飞书按钮 + 密码表单

---

### 任务9：管理端 OAuth 设置 - 飞书 Tab

**目标**：在 OAuth Settings 页面新增飞书配置 Tab。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 修改 | `web/classic/src/features/system-settings/auth/oauth-section.tsx` |

**开发内容**：
- TabsList 从 6 列变 7 列，新增"飞书"Tab
- 飞书 Tab 表单字段：
  - `FeishuOAuthEnabled`：开关
  - `FeishuAppID`：输入框
  - `FeishuAppSecret`：密码输入框
  - `AuthPolicy`：RadioGroup（`parallel` / `feishu_only`），含说明文字和警告
  - `FeishuDefaultGroup`：Select 下拉（从 `/api/group` 获取分组列表）
- 切换 `feishu_only` 时弹出确认对话框
- schema 新增对应字段

**验证**：飞书 Tab 配置可保存、可重置、策略切换有确认

---

### 任务10：管理端套餐分组可视化配置

**目标**：管理端可查看和修改"分组-套餐"映射关系。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 新增 | `web/classic/src/features/subscriptions/components/group-plan-mapping.tsx` |
| 修改 | `web/classic/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx` |
| 修改 | `web/classic/src/features/subscriptions/api.ts` |
| 修改 | 订阅管理主页面（添加 Tab 切换） |

**开发内容**：
- 订阅管理页面新增 Tabs：`[套餐列表] [分组映射]`
- 分组映射 Tab：
  - 表格展示：分组名 | 当前绑定套餐 | 操作
  - "更改绑定"弹出 Dialog（Select 套餐 + 影响提示 + 确认）
  - "全量同步"按钮
- `SubscriptionsMutateDrawer` 增强：
  - `upgrade_group` 下拉旁添加"查看映射"按钮
  - 展开显示分组-套餐映射预览面板
  - 保存时如有分组变更，弹出确认提示

**验证**：分组映射 Tab 可查看、可更改、全量同步可用

---

### 任务11：管理端飞书绑定管理界面

**目标**：管理员可查看飞书绑定、批量导入、重放失败。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 新增 | `web/classic/src/features/auth/components/feishu-binding-management.tsx` |
| 新增 | `web/classic/src/features/auth/api-feishu-admin.ts` |
| 修改 | 管理端路由或用户管理页面（嵌入/新 Tab） |

**开发内容**：
- 绑定列表表格：用户ID | 用户名 | 飞书用户名 | union_id(脱敏) | 当前分组 | 绑定时间
- 搜索：按用户名/union_id
- "导入绑定"对话框：JSON 粘贴 → 预览校验 → 确认导入
- "重放失败"按钮
- 支持直接修改用户分组（从 `pending` → 正式分组）

**验证**：导入测试数据、查询、修改分组

---

### 任务12：前端 i18n 适配

**目标**：所有新增文案完成 i18n 翻译。

**涉及文件**：
| 操作 | 文件 |
|------|------|
| 修改 | `web/classic/src/i18n/static-keys.ts` |
| 修改 | `web/classic/src/i18n/locales/en.json` |
| 修改 | `web/classic/src/i18n/locales/zh.json` |
| 修改 | `web/classic/src/i18n/locales/fr.json`、`ja.json`、`ru.json`、`vi.json` |

**开发内容**：
- 在 `static-keys.ts` 注册所有新增 key（约 25 条）
- 英文 key 即为默认值
- 中文翻译按设计文档中的 i18n 表填写
- 其他语言可用英文占位
- 运行 `bun run i18n:sync` 同步

**验证**：中英文切换正常，无遗漏 key

---

## 阶段四：联调与灰度上线

### 任务13：端到端联调 + 灰度发布

**开发内容**：
1. 飞书开放平台创建应用，配置回调 URL
2. 后端配置 `FeishuAppID` / `FeishuAppSecret`
3. 端到端测试：飞书登录 → 新用户创建（pending 分组） → 管理员授权分组 → 用户获得额度
4. 测试密码登录拦截
5. 测试分组映射变更同步
6. 测试批量导入
7. 切换 `feishu_only` 模式验证
8. 监控关键指标：飞书登录成功率、密码拒绝率、用户名冲突率

---

## 补充变更记录（2026-05-07 前端订阅管理迭代）

### 变更 B：订阅管理页需求对齐与入口收敛

**目标**：按最新业务口径收敛页面入口，减少误操作与未开放模块曝光。

**变更点**：
- 订阅管理页 Tab 调整为：`套餐管理 / 套餐用量 / 非活跃用户`。
- 移除“组织用量”入口（后续再开放）。
- 保留套餐管理主流程与编辑流程不变。

### 变更 C：手动同步入口下沉到套餐行级

**目标**：让“手动补齐同步”在业务语义上直接对应某个绑定分组套餐。

**变更点**：
- 在套餐管理列表操作列新增`手动同步`按钮。
- 仅当`bind_group`存在时可点击。
- 调用`/api/user/group-sync`，参数按分组定向：`full=false, group_name=<bind_group>, only_missing=true`。

### 变更 D：非活跃用户查询交互改造

**目标**：避免自由输入导致的参数歧义，统一查询粒度。

**变更点**：
- 查询条件由输入框改为固定时间段选择（7/15/30/60/90天）。
- 默认值为15天。

### 变更 E：套餐用量功能重开发（稳定优先）

**目标**：在 React #130 反复出现背景下，先确保功能稳定可用。

**变更点**：
- 重构`SubscriptionUsageView`渲染实现，保留原有后端接口与数据结构。
- 套餐用量：支持按月份查询并展示用户-套餐-用量表格。
- 同步提供非活跃用户查询与列表展示。
- 在稳定版基础上追加样式优化（卡片容器、工具栏、表头/斑马纹、空态提示）。

### 变更 F：排障与验证规范补充

**执行规范**：
1. 每次前端改动后必须构建并确认新 hash 生效。
2. 服务重启后先确认3000端口监听，再验证页面。
3. 遇到登录态异常（401 / securecookie invalid）先重新登录再判定前端问题。
4. 对 #130 类问题优先采用“单页面最小渲染面”定位法。


---

## 补充变更记录（2026-04-30 第二轮迭代）

### 变更 A：绑定分组（bind_group）功能

**目标**：订阅套餐可绑定到一个分组，该分组下所有用户自动拥有此套餐。分组变更时自动同步。

**设计决策**：采用「虚拟订阅」方案——查询时动态合并，而非在分组变更时批量创建/删除订阅记录。

| 层 | 文件 | 变更 |
|---|---|---|
| 模型 | `model/subscription.go` | `SubscriptionPlan` 新增 `BindGroup` 字段 |
| 模型 | `model/subscription.go` | 新增 `GetBindGroupSubscriptions()` 查询绑定分组虚拟订阅 |
| 迁移 | `model/main.go` | `ensureSubscriptionPlanTableSQLite()` 新增 `bind_group` 列（CREATE TABLE + ALTER TABLE） |
| 控制器 | `controller/subscription.go` | `AdminCreateSubscriptionPlan` / `AdminUpdateSubscriptionPlan` 新增 bind_group 验证 |
| 控制器 | `controller/subscription.go` | `GetSubscriptionSelf` 查询时合并 bind_group 虚拟订阅（去重） |
| 前端表单 | `web/classic/.../AddEditSubscriptionModal.jsx` | 新增「绑定分组」Select 下拉 |
| 前端列表 | `web/classic/.../SubscriptionsColumnDefs.jsx` | 新增「绑定分组」列 |

**PostgreSQL 兼容性**：PG/MySQL 走 `DB.AutoMigrate(&SubscriptionPlan{})`，GORM 自动添加新列，无需手动处理。仅 SQLite 因使用 `ensureSubscriptionPlanTableSQLite()` 需手动添加列定义。

**分组变更同步逻辑**：
- 用户分组变更后，`GetSubscriptionSelf` 查询时根据新 group 自动计算 bind_group 订阅
- 旧 group 的套餐自动消失，新 group 的套餐自动出现
- `AdminSetUserGroup` 接口增加 `InvalidateUserCache` 刷新缓存
- `User.Edit()` 方法已有 `updateUserCache` 确保 group 变更后缓存同步

### 变更 B：用户模型统计页面可见性修复

**问题**：admin 账号登录后侧边栏不显示「用户模型统计」。

**原因**：`useSidebar.js` 的 `DEFAULT_ADMIN_CONFIG.admin` 和 `SettingsSidebarModulesAdmin.jsx` 的默认配置中缺少 `userModelStats` 模块。

**修复文件**：
| 文件 | 变更 |
|---|---|
| `web/classic/src/hooks/common/useSidebar.js` | `DEFAULT_ADMIN_CONFIG.admin` 新增 `userModelStats: true` |
| `web/classic/src/pages/Setting/Operation/SettingsSidebarModulesAdmin.jsx` | 默认配置 + 模块定义 + 重置默认值 均新增 `userModelStats` |

### 变更 C：飞书设置 UI 可操作性修复

**问题**：飞书 OAuth 设置在系统设置页面可能无法正确操作。

**修复内容**：
| 文件 | 变更 |
|---|---|
| `web/classic/.../SystemSetting.jsx` | 飞书 checkbox 增加 `checked={feishuEnabled}` 受控属性 |
| `web/classic/.../SystemSetting.jsx` | options 加载时同步 `feishuEnabled` state |
| `web/classic/.../SystemSetting.jsx` | `submitFeishuSettings` 改用 `formApiRef` 取值（与 `submitPasskeySettings` 一致） |
| `controller/option.go` | `UpdateOption` 新增 `feishu.enabled` case，校验 App ID 非空 |
| `controller/feishu_admin.go` | `AdminSetUserGroup` 增加 `InvalidateUserCache` 刷新用户缓存 |

### 变更 D：开发计划任务补充

以下任务需要补充到原计划中：

**任务 6 更新**：分组联动不再需要单独的批量同步接口。`GetSubscriptionSelf` 查询时自动合并 bind_group 虚拟订阅，分组变更后无需手动触发同步。`GroupSync` 接口保留用于一次性全量同步场景。

**新增任务 6.5**：用户分组变更时订阅套餐同步
- 涉及 `controller/user.go`（`UpdateUser` → `Edit` 方法）和 `controller/feishu_admin.go`（`AdminSetUserGroup`）
- `Edit` 方法已有 `updateUserCache`，分组变更后缓存自动刷新
- `AdminSetUserGroup` 已补充 `InvalidateUserCache` 调用
- 查询侧（`GetSubscriptionSelf`）自动根据新 group 计算 bind_group 订阅

---

## 补充变更记录（2026-05-01 第三轮迭代）

### 变更 E：飞书绑定管理 API 接口文档

所有接口需要管理员权限（`AdminAuth` 中间件），基础路径为 `/api/user/admin`。

---

#### 1. 查询飞书绑定列表

获取已绑定飞书账号的用户列表，支持关键词搜索和分页。

```
GET /api/user/admin/feishu/bindings
```

**权限**：管理员

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 否 | 搜索关键词，匹配 `username`、`display_name`、`feishu_id`（模糊匹配） |
| `page` | int | 否 | 页码，默认 1 |
| `page_size` | int | 否 | 每页条数，默认 10 |

**成功响应**：

```json
{
  "success": true,
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 3,
    "items": [
      {
        "id": 1,
        "username": "admin",
        "display_name": "管理员",
        "email": "",
        "feishu_id": "ou_xxxxxxxxxxxxxxxx",
        "group": "vip",
        "quota": 0,
        "status": 1
      }
    ]
  }
}
```

**说明**：
- 仅返回 `feishu_id` 不为空的用户（即已绑定飞书的用户）
- 响应中 `password` 字段已脱敏（Omit）
- 用户对象完整字段与 `/api/user/admin/` 接口一致

---

#### 2. 批量导入飞书绑定

将飞书账号与系统用户建立绑定关系，支持批量操作，幂等。

```
POST /api/user/admin/feishu/bindings/import
```

**权限**：管理员

**请求体**：

```json
{
  "bindings": [
    {
      "user_id": 1,
      "union_id": "ou_xxxxxxxxxxxxxxxx",
      "open_id": "oc_yyyyyyyyyyyyyyyy",
      "group_name": "vip"
    },
    {
      "user_id": 2,
      "union_id": "ou_zzzzzzzzzzzzzzzz"
    }
  ]
}
```

**请求字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bindings` | array | 是 | 绑定列表，不能为空 |
| `bindings[].user_id` | int | 是 | 系统用户 ID |
| `bindings[].union_id` | string | 是 | 飞书 union_id，作为主绑定标识 |
| `bindings[].open_id` | string | 否 | 飞书 open_id（可选，仅记录） |
| `bindings[].group_name` | string | 否 | 建议分组（可选，不会自动修改用户分组） |

**成功响应**：

```json
{
  "success": true,
  "data": {
    "total": 3,
    "success": 1,
    "skipped": 1,
    "failed": 1,
    "errors": [
      "user_id=99 not found: record not found"
    ]
  }
}
```

**响应字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | int | 总提交条数 |
| `success` | int | 成功绑定数 |
| `skipped` | int | 跳过数（用户已绑定相同 union_id） |
| `failed` | int | 失败数 |
| `errors` | string[] | 失败原因列表 |

**业务规则**：
- 用户不存在 → 失败
- 用户已绑定相同 union_id → 跳过（幂等）
- 用户已绑定不同 union_id → 失败
- union_id 已被其他用户绑定 → 失败
- 成功绑定时写入系统日志：`管理员导入飞书绑定，union_id=xxx`

---

#### 3. 修改用户分组

管理员修改指定用户的分组，并自动同步 bind_group 订阅。

```
PUT /api/user/admin/:id/group
```

**权限**：管理员

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | int | 用户 ID |

**请求体**：

```json
{
  "group": "vip"
}
```

**请求字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `group` | string | 是 | 目标分组名称 |

**成功响应**：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "display_name": "管理员",
    "feishu_id": "ou_xxxxxxxxxxxxxxxx",
    "group": "vip",
    "quota": 0,
    "status": 1
  }
}
```

**副作用**：
- 如果分组发生变更，自动调用 `SyncUserBindGroupSubscriptions`：
  - 删除旧分组对应的 bind_group 订阅记录
  - 创建新分组对应的 bind_group 订阅记录
- 自动刷新用户缓存（`InvalidateUserCache`）
- 写入系统日志：`管理员修改分组: {oldGroup} -> {newGroup}`

---

#### 4. 分组订阅全量同步

触发分组与订阅套餐的全量同步，用于一次性补齐数据或修复不一致。

```
POST /api/user/admin/group-sync
```

**权限**：管理员

**请求体**：

```json
{
  "group_name": "vip",
  "full": false
}
```

**请求字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `group_name` | string | 否 | 指定分组名称（`full=false` 时必填） |
| `full` | bool | 否 | 是否全量同步所有分组，默认 false |

**成功响应**：

```json
{
  "success": true,
  "data": {
    "affected_users": 15,
    "updated": 10,
    "errors": []
  }
}
```

**响应字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `affected_users` | int | 受影响的用户总数 |
| `updated` | int | 实际更新的用户数（有飞书绑定且非 pending 分组） |
| `errors` | string[] | 错误列表 |

**使用场景**：
- `full=true`：扫描所有用户，用于系统初始化或全量修复
- `group_name="vip"`：仅扫描指定分组的用户，用于定向修复

---

### 变更 F：bind_group 订阅数据修复与永久订阅支持

**问题**：bind_group 订阅的 `end_time=0`（永久有效）在活跃订阅查询中被遗漏。

**根因**：`GetAllActiveUserSubscriptions` 和 `HasActiveUserSubscription` 使用 `end_time > now` 条件，`end_time=0` 的记录不满足此条件。

**修复**：

| 文件 | 变更 |
|---|---|
| `model/subscription.go` | `GetAllActiveUserSubscriptions` 条件改为 `end_time > ? OR end_time = 0` |
| `model/subscription.go` | `HasActiveUserSubscription` 条件同步修复 |
| `model/subscription.go` | 新增 `RepairBindGroupSubscriptions()` 启动时自动补齐缺失的 bind_group 订阅 |
| `main.go` | 启动时异步调用 `go model.RepairBindGroupSubscriptions()` |
| `model/subscription.go` | 新增 `SyncUserBindGroupSubscriptions()` 用户分组变更时同步订阅 |
| `model/subscription.go` | 新增 `SyncPlanBindGroupChange()` 套餐 bind_group 变更时同步用户订阅 |

**RepairBindGroupSubscriptions 逻辑**：
1. 查询所有启用了 bind_group 的套餐
2. 按 bind_group 值分组
3. 查找每个分组下的所有用户
4. 对每个用户检查是否已有该套餐的订阅记录（`count > 0` 则跳过）
5. 缺失的自动创建 bind_group 订阅（`end_time=0`, `source="bind_group"`）

### 变更 G：飞书 OAuth 绑定入口 + 个人订阅查看

**前端变更**：

| 文件 | 变更 |
|---|---|
| `web/classic/.../AccountManagement.jsx` | 新增飞书绑定卡片，显示绑定状态，支持一键绑定 |
| `web/classic/.../MySubscriptions.jsx` | 新增个人订阅概览组件，调用 `GET /api/subscription/self` |
| `web/classic/.../PersonalSetting.jsx` | 在个人设置页引入 MySubscriptions 组件 |

**MySubscriptions 数据结构**：

API 返回 `SubscriptionSummary` 嵌套结构：
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "subscription": {
          "id": 1,
          "plan_id": 3,
          "amount_total": 500000,
          "amount_used": 10000,
          "start_time": 1746000000,
          "end_time": 0,
          "status": "active",
          "source": "bind_group"
        },
        "plan": {
          "id": 3,
          "title": "svip",
          "price_amount": 9.99,
          "currency": "USD"
        }
      }
    ],
    "all_subscriptions": [...],
    "billing_preference": "deduct_first"
  }
}
```

前端渲染时需通过 `item.subscription` 和 `item.plan` 访问具体字段。

### 变更 H：飞书 Token 交换端点升级

**问题**：飞书 OAuth Token 交换使用 v1 端点失败。

**修复**：
- Token 端点从 `https://open.feishu.cn/open-apis/authen/v1/oidc/access_token` 升级为 `https://open.feishu.cn/open-apis/authen/v2/oauth/token`
- v2 端点接受 `client_id` + `client_secret` 在请求体中（不需要 Authorization header）
- v2 响应格式为扁平结构（`code` 在顶层，而非嵌套在 `data` 中）
- 前端 Auth URL 使用 `https://accounts.feishu.cn/open-apis/authen/v1/authorize`（不是 `open.feishu.cn`）

### 变更 I：飞书配置字段 Semi Design Form 绑定修复

**问题**：Semi Design Form 的 `field="['feishu.app_id']"` 点号语法与 `initValues` 中的扁平 key 不匹配，导致表单字段不渲染。

**修复**：
- 飞书配置字段改用简单下划线命名：`feishu_app_id`, `feishu_app_secret`, `feishu_default_group`, `feishu_auth_policy`
- `getOptions` 加载数据时映射后端 key 到前端 field
- `submitFeishuSettings` 保存时映射前端 field 回后端 key
- `feishu.enabled` checkbox 不受影响（使用 `handleCheckboxChange` 即时保存，不走 submitFeishuSettings）

## 补充变更记录（2026-05-06 第四轮迭代）

### 变更 J：飞书身份键与姓名同步修复

- Feishu OAuth 绑定主键改为优先 `union_id`（缺失时回退 `open_id`）
- 登录回调增加 `username/display_name` 同步，避免残留 `feishu_xxx` 占位用户名
- 新增 `feishu_user_id` 字段用于管理员初始化和匹配

### 变更 K：手动分组套餐重同步入口增强

- 强化 `POST /api/user/group-sync` 为生产修复入口
- 新增 `only_missing` 参数（默认 `true`），支持“一键补齐未生效用户”
- 返回结构新增 `skipped`，便于统计覆盖面
- 修复该接口的跨数据库分组列兼容（PostgreSQL/MySQL/SQLite）

### 变更 L：套餐额度变更同步

- 当套餐 `total_amount` 变更且 `bind_group` 未变更时，自动同步更新该套餐下 `source=bind_group` 的用户订阅额度

## 补充变更记录（2026-05-06 第五轮迭代，当前工作区汇总）

> 本节用于对齐“中断后续做”的全部实际代码变更点，覆盖后端/前端/配置/文档。

### 变更 M：订阅管理新增“使用视图”能力（后端统计接口 + 前端看板）

- 新增后端接口：
  - `GET /api/subscription/admin/plan-usage`
  - `GET /api/subscription/admin/org-usage`
  - `GET /api/subscription/admin/inactive-users`
- 订阅页新增 `Usage View` Tab，并接入上述接口。

### 变更 N：飞书标识增强与组织字段落库

- 用户模型新增字段：
  - `feishu_union_id`
  - `feishu_user_id`
  - `org_name`
  - `org_path`
  - `job_title`
- OAuth 回调与管理员批量初始化/更新支持三类飞书标识协同：
  - `feishu_open_id` / `feishu_union_id` / `feishu_user_id`
- 飞书登录回调增加用户名与显示名同步，减少占位用户名残留。

### 变更 O：飞书批量初始化与批量更新能力增强

- 批量初始化：
  - 支持多标识输入与自动补齐（本地映射优先，飞书 API best-effort 补齐）
  - 支持组织字段写入
  - 支持分组赋值后自动触发 `bind_group` 订阅同步
- 批量更新：
  - 支持通过 `open_id/union_id/user_id/user_id(username)` 多维定位用户
  - 支持组织字段更新
  - 分组变更后自动同步订阅并刷新用户缓存

### 变更 P：第 8 点预警策略落地（飞书应用机器人 + 百分比阈值 + 每日限频）

- 新增通知类型：`feishu_app`（飞书应用机器人按用户推送）。
- 订阅额度预警阈值改为“剩余额度百分比”语义（默认 20，范围 1~100）。
- 预警频控改为：`quota_exceed` 同一用户每日最多一次。

### 变更 Q：第 12 点收尾（专用明文 Key 管理 + 细粒度权限）

- 用户管理页新增：
  - `Feishu Batch Init`（已完成）
  - `Feishu Keys` 专用管理入口（本轮完成）
- `Feishu Keys` 页能力：
  - 按 `feishu_open_id` 或 `feishu_user_id` 检索该用户全部 token（含明文 key）
  - 直接创建 token 并展示新明文 key
- 后端权限隔离：
  - 明文 key 相关接口默认仅 Root 可用
  - 新增配置 `feishu.allow_admin_manage_plaintext_tokens`，可选择放开给 Admin

### 变更 R：分组同步修复接口增强

- `POST /api/user/group-sync` 增加 `only_missing` 参数（默认 true）：
  - 仅补齐缺失订阅用户，避免重复覆盖
- 返回结构新增 `skipped`，便于执行结果评估。
- 查询条件改造为跨数据库兼容写法（避免保留字列名兼容风险）。

### 变更 S：前端与类型收尾

- Profile 通知设置新增 `feishu_app` 选项。
- 额度预警输入文案与交互改为百分比语义。
- 修复若干 TS 未使用变量/导入，保证 `bun run typecheck` 通过。
