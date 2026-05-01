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
| 新增 | `web/default/src/assets/brand-icons/icon-feishu.tsx` |
| 修改 | `web/default/src/assets/brand-icons/index.ts` |

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
| 修改 | `web/default/src/features/auth/sign-in/components/user-auth-form.tsx` |
| 修改 | `web/default/src/features/auth/components/oauth-providers.tsx` |
| 修改 | `web/default/src/features/auth/hooks/use-oauth-login.ts` |
| 修改 | `web/default/src/features/auth/lib/oauth.ts` |
| 修改 | `web/default/src/features/auth/types.ts` |

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
| 修改 | `web/default/src/features/system-settings/auth/oauth-section.tsx` |

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
| 新增 | `web/default/src/features/subscriptions/components/group-plan-mapping.tsx` |
| 修改 | `web/default/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx` |
| 修改 | `web/default/src/features/subscriptions/api.ts` |
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
| 新增 | `web/default/src/features/auth/components/feishu-binding-management.tsx` |
| 新增 | `web/default/src/features/auth/api-feishu-admin.ts` |
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
| 修改 | `web/default/src/i18n/static-keys.ts` |
| 修改 | `web/default/src/i18n/locales/en.json` |
| 修改 | `web/default/src/i18n/locales/zh.json` |
| 修改 | `web/default/src/i18n/locales/fr.json`、`ja.json`、`ru.json`、`vi.json` |

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
