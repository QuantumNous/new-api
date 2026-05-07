# 身份与订阅迁移设计方案（灰度到飞书-only）

## 1. 目标与范围

本方案覆盖三块：

1. 订阅套餐与分组、用户之间的双向联动
2. 飞书 OAuth 灰度迁移到飞书-only 登录
3. 前端页面适配：登录页飞书优先入口、管理端套餐分组可视化配置

## 2. 需求确认结论

### 2.1 登录与身份规则

- 采用灰度切换：先支持"密码 + 飞书并行"，最终切飞书-only
- 一旦用户已有飞书关联 ID（union_id/open_id/provider_user_id），立即禁止密码登录，仅允许飞书授权登录
- 飞书身份键策略：同时存 `union_id` 与 `open_id`，`union_id` 为主键，`open_id` 为辅键
- 存量用户首次飞书登录后，平台用户名强制同步为飞书用户名
- **飞书登录默认分组隔离**：通过飞书 OAuth 首次登录创建的新用户，自动分配至"待授权"默认分组（如 `pending`），该分组不绑定任何可用套餐、不分配额度、不关联模型倍率。用户在管理员手动将其分组变更为正式分组后，才获得对应额度和模型访问权限。这确保未经审批的飞书用户无法消耗平台资源。

### 2.2 订阅与分组联动规则

- 用户分组变化时：自动匹配该分组绑定的订阅套餐并同步用户订阅
- 套餐绑定分组变化时：该分组下用户的订阅同步变更
- 联动需幂等、可追踪、可回滚（至少支持重放任务）

### 2.3 前端页面适配规则

- 登录页飞书入口必须使用飞书官方品牌图标，按钮视觉优先级高于其他 OAuth 入口
- 管理端套餐管理需提供"分组-套餐"映射关系的可视化配置能力
- 管理端需提供登录策略（`parallel / feishu_only`）的可视化开关
- 管理端需提供飞书绑定导入/查询/重放的操作界面

## 3. 现状评估

当前仓库已有部分基础：

- 订阅模型已有分组关联和用户分组变化处理雏形（`HandleUserGroupChange`）
- 已有管理端订阅绑定接口
- OAuth 已有 custom provider 与用户绑定结构（`user_oauth_bindings`）
- 前端已有 OAuth 组件体系（`OAuthProviders`、`useOAuthLogin`）和品牌图标体系（`assets/brand-icons/`）
- 前端已有订阅套餐管理组件（`SubscriptionsMutateDrawer`）含 `upgrade_group` 下拉选择

后端缺口：

- 缺少"存量用户批量回填飞书绑定"接口
- 缺少"已绑定飞书即禁用密码登录"的强约束
- 缺少"套餐分组变更后批量同步用户订阅"的管理任务接口
- 缺少迁移审计与冲突处理规范

前端缺口：

- 登录页缺少飞书 OAuth 优先入口（飞书品牌图标 + 突出按钮）
- 缺少飞书品牌图标组件（`IconFeishu`，需飞书官方 SVG logo）
- 管理端缺少"套餐-分组绑定关系"的可视化配置界面（当前 `SubscriptionsMutateDrawer` 的 `upgrade_group` 仅为下拉选择，无法直观查看分组与套餐的映射全貌）
- 管理端缺少"登录策略"的可视化切换入口（`parallel / feishu_only` 开关）
- 管理端缺少"飞书绑定导入/查询/重放"操作界面

## 4. 总体方案

## 4.1 模块拆分

A. `Auth Policy`：登录策略控制（并行/飞书-only）
B. `Feishu Binding Migration`：存量用户绑定导入与自动关联
C. `Subscription Group Sync`：分组与套餐、用户订阅联动
D. `Audit & Replay`：迁移审计、失败重试与回放
E. `Frontend - Login Page`：登录页飞书优先入口与品牌图标
F. `Frontend - Admin Subscription Group Config`：管理端套餐分组可视化配置
G. `Frontend - Admin Auth Policy & Feishu Management`：管理端登录策略与飞书绑定管理界面

## 4.2 状态机（身份迁移）

用户状态：

- `legacy_password_user`：无飞书绑定，允许密码
- `bound_feishu_user`：已有飞书绑定，禁止密码
- `feishu_only_enforced`：全局飞书-only 模式下用户

迁移动作：

1. 批量导入绑定：`legacy_password_user -> bound_feishu_user`
2. 首次飞书登录自动绑定：`legacy_password_user -> bound_feishu_user`
3. 全局开关切换：`* -> feishu_only_enforced`

## 5. 数据与约束设计

## 5.1 用户 OAuth 绑定数据

在 `user_oauth_bindings` 保证：

- `provider_slug = feishu`
- 主唯一键：`(provider_slug, union_id)`（建议通过 provider_user_id 承载 union_id）
- 辅助索引：`(provider_slug, open_id)`（可放 extra JSON 或扩展字段）

约束：

- 同一 `union_id` 只能绑定一个平台用户
- 一个用户可有一个飞书绑定（允许历史覆盖需审计）

## 5.2 用户名同步规则

当飞书登录返回用户名 `feishu_username` 时：

- 平台 `username` 强制更新为 `feishu_username`
- 若冲突，按规则自动生成安全后缀（如 `_fs_{uid尾号}`）
- 同步写入审计日志：旧用户名、新用户名、触发方式

## 5.3 订阅分组联动数据

新增或复用"分组-套餐映射"关系：

- 一个分组对应一个主套餐（MVP）
- 套餐改绑分组时，触发该分组用户订阅重算

### 5.4 飞书登录默认分组（待授权分组）

新增系统配置项 `FeishuDefaultGroup`（默认值 `pending`），用于指定通过飞书 OAuth 首次登录自动创建的用户所属分组。

"待授权"分组的设计约束：

| 属性 | 值 | 说明 |
|------|------|------|
| 分组名 | `pending`（可配置） | 管理员可在设置中自定义分组名 |
| 绑定套餐 | 无 | 不绑定任何订阅套餐 |
| 模型倍率 | 不配置（或极高倍率） | 该分组用户调用 API 时无可用模型或倍率极高，实际无法使用 |
| 额度 | 0 | `QuotaForNewUser` 在飞书注册场景下覆盖为 0 |
| 可用模型范围 | 空 | 该分组不关联任何渠道/模型 |

分组授权流程：

1. 飞书 OAuth 回调 -> 创建/关联用户 -> `user.Group = FeishuDefaultGroup` -> `user.Quota = 0`
2. 管理员在用户管理或飞书绑定管理界面，将用户分组从 `pending` 变更为正式分组（如 `basic`、`vip`）
3. 分组变更触发 `HandleUserGroupChange` -> 自动匹配正式分组绑定的订阅套餐 -> 用户获得额度
4. 审计日志记录：`pending -> 正式分组` 的变更操作

后端实现要点：

- 飞书 OAuth 注册用户时，`user.Group` 使用 `FeishuDefaultGroup` 而非全局默认分组
- 飞书 OAuth 注册用户时，`user.Quota` 强制设为 0，不触发 `QuotaForNewUser` 赠送逻辑
- 新增后端配置项 `FeishuDefaultGroup`（系统 option，默认 `pending`），若该分组在 `group_ratio` 中不存在则自动创建（倍率为空）
- 管理端变更用户分组时，已有的 `HandleUserGroupChange` 逻辑自动处理订阅联动

## 6. 接口设计（MVP）

## 6.1 飞书绑定导入接口（管理员）

`POST /api/user/admin/oauth/feishu/import`

- 入参：数组 `{ user_id | username, union_id, open_id, feishu_username }`
- 行为：
  - 绑定写入/更新（幂等）
  - 用户名同步为飞书用户名（按冲突规则）
  - 返回成功/失败明细

## 6.2 飞书绑定查询接口（管理员）

`GET /api/user/admin/oauth/feishu/bindings`

- 支持分页、按 user_id/username/union_id 查询

## 6.3 飞书绑定修复重放接口（管理员）

`POST /api/user/admin/oauth/feishu/replay`

- 对失败记录按批次重试

## 6.4 分组联动重算接口（管理员）

`POST /api/subscription/admin/group-sync`

- 入参：`group_name` 或 `plan_id` 或 `full=true`
- 行为：重算并同步受影响用户订阅

## 6.5 登录策略开关接口（Root）

`PUT /api/option/auth-policy`

- `mode = parallel | feishu_only`
- 并行模式下：已绑定飞书用户仍禁密码
- 飞书-only：所有密码登录禁用

## 7. 关键流程

## 7.1 密码登录拦截

登录前检查：

- 若用户存在飞书绑定 -> 直接拒绝密码登录并返回"请使用飞书登录"
- 否则按既有逻辑

## 7.2 飞书登录自动绑定与用户名同步

- 按 `union_id` 先查绑定
- 未命中时，可按受控规则尝试匹配存量账号（仅灰度阶段开启）
- 成功后写绑定并同步用户名

### 7.2.1 新用户创建时的默认分组与零额度

当飞书 OAuth 回调发现是全新用户（无存量账号匹配）时：

1. 创建用户记录，`Group = FeishuDefaultGroup`（默认 `pending`）
2. `Quota = 0`（跳过 `QuotaForNewUser` 赠送）
3. 跳过邀请码奖励（`QuotaForInvitee` / `QuotaForInviter`）
4. 写入审计日志：`飞书OAuth创建用户，分组=pending，额度=0`
5. 用户可登录系统，但因 `pending` 分组无模型倍率、无额度，无法调用任何 API
6. 管理员审核后在用户管理界面将分组改为正式分组，触发 `HandleUserGroupChange` 自动分配额度

当飞书 OAuth 回调匹配到存量用户时：

- 保持原分组和额度不变
- 仅同步飞书绑定和用户名

## 7.3 套餐绑定分组变更同步

- 套餐更新事件触发异步任务
- 扫描受影响用户分组
- 执行订阅切换（幂等）
- 记录审计

## 8. 安全与审计

- 所有导入/重算接口仅 `AdminAuth` 或 `RootAuth`
- 批量接口必须写操作日志（操作者、批次号、影响行数、失败原因）
- 对 `union_id/open_id` 做最小化展示（脱敏）

## 9. 前端页面设计

### 9.1 飞书品牌图标组件

**文件位置**：`web/classic/src/assets/brand-icons/icon-feishu.tsx`

**图标来源**：飞书官方品牌 logo SVG，取自飞书品牌配置接口（`applink.feishu.cn/api/tenant/applink/brand_config`）返回的 `logo_url`，或从飞书开放平台下载官方 SVG 矢量图。

**组件规范**（与现有 `IconGithub`、`IconWeChat` 保持一致）：

```
export function IconFeishu({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      className={cn('fill-current', className)}
      {...props}
    >
      <title>Feishu</title>
      {/* 飞书官方 SVG path 数据 */}
    </svg>
  )
}
```

**导出注册**：在 `assets/brand-icons/index.ts` 中新增 `export { IconFeishu } from './icon-feishu'`。

### 9.2 登录页 - 飞书专属登录

**涉及文件**：
- `web/classic/src/features/auth/components/oauth-providers.tsx`
- `web/classic/src/features/auth/hooks/use-oauth-login.ts`
- `web/classic/src/features/auth/lib/oauth.ts`（新增 `buildFeishuOAuthUrl`）
- `web/classic/src/features/auth/types.ts`（status 新增 `feishu_oauth` 字段）
- `web/classic/src/features/auth/sign-in/components/user-auth-form.tsx`

#### 9.2.1 布局设计

登录页仅保留飞书登录入口，移除密码表单和其他 OAuth 按钮。

**`feishu_only` 模式（最终态，默认）**：

```
┌─────────────────────────────────┐
│                                 │
│         [平台 Logo]             │
│                                 │
│     欢迎使用，请登录以继续       │
│                                 │
│  ┌─────────────────────────┐    │
│  │   🔵  使用飞书登录       │    │  ← 飞书按钮居中突出
│  └─────────────────────────┘    │
│                                 │
│   需要飞书账号才能使用本服务     │
│                                 │
└─────────────────────────────────┘
```

**`parallel` 模式（灰度过渡期）**：

```
┌─────────────────────────────────┐
│                                 │
│         [平台 Logo]             │
│                                 │
│  ┌─────────────────────────┐    │
│  │   🔵  使用飞书登录       │    │  ← 飞书按钮突出（品牌色背景）
│  └─────────────────────────┘    │
│                                 │
│          ── 或使用密码 ──        │  ← 分隔线
│                                 │
│     📧 邮箱/用户名              │
│     🔒 密码                     │
│     [ 登录 ]                    │
│                                 │
└─────────────────────────────────┘
```

**关键决策：不展示其他 OAuth 登录方式**（GitHub / Discord / OIDC / Telegram / LinuxDO / WeChat 等按钮在登录页全部隐藏）。飞书是唯一的第三方登录入口。

#### 9.2.2 飞书按钮样式

- 按钮尺寸：`h-12 w-full`，居中显示
- 圆角：`rounded-xl`
- 配色：飞书品牌蓝绿色背景（`#3370FF`）+ 白色文字/图标
- hover：加深 `#2860E0`
- 左侧飞书图标（`<IconFeishu />`）+ 文字"使用飞书登录"
- 按钮 `variant` 不使用 `outline`，而是自定义 className 实现品牌色
- 在 `feishu_only` 模式下按钮更突出（可加大字号、增加间距）

#### 9.2.3 登录策略联动

- `feishu_only` 模式（推荐默认）：仅展示飞书登录按钮，无密码表单、无其他 OAuth
- `parallel` 模式（灰度过渡）：飞书按钮在顶部突出展示 + 下方保留密码表单（无其他 OAuth）

#### 9.2.4 前端状态检测

`SystemStatus` 接口新增字段：
- `feishu_oauth: boolean` — 飞书 OAuth 是否启用
- `auth_policy: 'parallel' | 'feishu_only'` — 当前登录策略模式

`useOAuthLogin` hook 新增：
- `handleFeishuLogin` — 调用 `buildFeishuOAuthUrl` 跳转飞书授权

#### 9.2.5 登录页组件改造要点

`user-auth-form.tsx` 改造：
- 当 `feishu_oauth === true` 时，飞书登录按钮位于表单最顶部、最突出位置
- 当 `auth_policy === 'feishu_only'` 时，隐藏整个密码表单（用户名/密码输入框、Passkey 按钮），仅渲染飞书登录按钮
- 移除 `<OAuthProviders>` 中 GitHub / Discord / OIDC / Telegram / LinuxDO / WeChat 等其他 OAuth 按钮的渲染（或通过条件判断隐藏）

`oauth-providers.tsx` 改造：
- 飞书按钮从 `providerButtons` 数组中独立出来，不与其他 OAuth 混排
- 飞书按钮使用自定义品牌样式（非 `variant='outline'`）
- 其他 OAuth provider 按钮在飞书启用时全部隐藏

### 9.3 管理端 - 套餐分组可视化配置

**涉及文件**：
- `web/classic/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx`（增强）
- 新增 `web/classic/src/features/subscriptions/components/group-plan-mapping.tsx`
- `web/classic/src/features/subscriptions/api.ts`（新增分组-套餐映射 API 调用）

#### 9.3.1 套餐编辑抽屉增强

当前 `SubscriptionsMutateDrawer` 中 `upgrade_group` 字段为普通下拉选择。

增强为：

```
┌───────────────────────────────────────┐
│  📦 编辑套餐 - 高级版                  │
├───────────────────────────────────────┤
│  基础信息                              │
│  套餐标题: [ 高级版 ]                  │
│  ...                                   │
│                                       │
│  分组绑定 ──────────────────────       │
│  绑定分组: [ ▼ vip ]  [查看映射]      │  ← 下拉 + 映射预览按钮
│                                       │
│  ┌ 分组-套餐映射预览 ────────────┐    │
│  │  default  → 免费版            │    │  ← 点击"查看映射"展开
│  │  basic     → 基础版           │    │
│  │  vip       → 高级版  ✅ 当前   │    │
│  │  enterprise → 企业版          │    │
│  └───────────────────────────────┘    │
│                                       │
│  ⚠️ 修改绑定分组将触发该分组下所有      │
│  用户订阅同步变更，请确认后操作         │
└───────────────────────────────────────┘
```

关键交互：
- 选择分组后，展示"该分组当前绑定的套餐"提示（若已绑定其他套餐则警告冲突）
- 保存时弹出确认对话框，提示影响范围（受影响用户数）
- 确认后调用 `POST /api/subscription/admin/group-sync` 触发同步

#### 9.3.2 分组-套餐映射管理页（独立 Tab/Section）

在管理端订阅管理页面新增"分组映射"Tab：

```
┌──────────────────────────────────────────────────────┐
│  [ 套餐列表 ]  [ 分组映射 ]                           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  分组        当前绑定套餐       操作                   │
│  ─────────  ───────────────    ────────              │
│  default     免费版            [ 更改绑定 ]           │
│  basic       基础版            [ 更改绑定 ]           │
│  vip         高级版            [ 更改绑定 ]           │
│  enterprise  （未绑定）        [ 绑定套餐 ]           │
│  new-group   （未绑定）        [ 绑定套餐 ]           │
│                                                      │
│  [+ 添加分组]  [🔄 全量同步]                         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

"更改绑定"弹出对话框：
- Select 选择目标套餐
- 显示影响范围：该分组下 N 个用户的订阅将被同步变更
- 确认后调用 group-sync 接口

"全量同步"按钮：
- 调用 `POST /api/subscription/admin/group-sync`（`full=true`）
- 显示进度/结果

### 9.4 管理端 - 登录策略与飞书绑定管理

#### 9.4.1 登录策略配置（OAuth Settings 页面增强）

**涉及文件**：`web/classic/src/features/system-settings/auth/oauth-section.tsx`

在现有 OAuth Integrations 页面中新增飞书 Tab：

```
TabsList: GitHub | Discord | OIDC | Telegram | LinuxDO | WeChat | 飞书
                                                                    ↑ 新增
```

飞书 Tab 内容：

```
┌─────────────────────────────────────────────┐
│  飞书 OAuth                                  │
│                                              │
│  [开关] 启用飞书 OAuth 登录                   │
│                                              │
│  App ID:           [ _______________ ]        │
│  App Secret:       [ _______________ ]        │
│                                              │
│  ── 登录策略 ──                               │
│                                              │
│  ○ 并行模式 (parallel)                        │
│    密码登录与飞书登录并行可用                   │
│    已绑定飞书的用户仅允许飞书登录               │
│                                              │
│  ● 飞书专属模式 (feishu_only)                 │
│    所有用户仅允许飞书授权登录                   │
│    密码登录完全禁用                            │
│                                              │
│  ── 注意 ──                                   │
│  ⚠️ 切换到飞书专属模式后，所有密码登录将被禁用  │
│     请确保所有用户已完成飞书绑定后再切换        │
│                                              │
│  [ 保存 ]  [ 重置 ]                           │
└─────────────────────────────────────────────┘
```

配置项对应后端 option：
- `FeishuOAuthEnabled`：布尔，启用飞书 OAuth
- `FeishuAppID`：飞书应用 App ID
- `FeishuAppSecret`：飞书应用 App Secret
- `AuthPolicy`：`parallel` | `feishu_only`
- `FeishuDefaultGroup`：字符串，飞书新用户默认分组名（默认 `pending`）

飞书 Tab 中新增"默认分组"配置区域：

```
│  ── 新用户默认分组 ──                       │
│                                              │
│  默认分组: [ ▼ pending ]                     │
│  新通过飞书登录的用户将分配到此分组           │
│  该分组应无额度、无模型权限，等待管理员授权   │
│                                              │
│  ⚠️ 请确保该分组在"分组倍率"中未配置任何     │
│     模型倍率，否则新用户可能直接获得 API 访问 │
```

#### 9.4.2 飞书绑定管理界面

新增管理页面或嵌入用户管理页面的 Tab：

```
┌──────────────────────────────────────────────────────────┐
│  飞书绑定管理                                             │
│                                                          │
│  [ 导入绑定 ]  [ 重放失败 ]  🔍 搜索用户/union_id...      │
│                                                          │
│  用户ID  用户名    飞书用户名    union_id(脱敏)  绑定时间   │
│  ───── ──────── ──────────── ──────────────── ──────────  │
│  1      admin     张三          uni***8a2f      2026-04-30 │
│  2      user01    李四          uni***3b1c      2026-04-30 │
│  3      user02    （未绑定）     -               -         │
│                                                          │
│  显示 1-20 / 共 156 条                   < 1 2 3 ... >   │
└──────────────────────────────────────────────────────────┘
```

"导入绑定"对话框：
- 支持 JSON 数组粘贴或 CSV 上传
- 格式：`[{ "username": "xxx", "union_id": "xxx", "open_id": "xxx", "feishu_username": "xxx" }]`
- 预览校验结果后确认导入
- 导入完成后显示成功/失败统计

### 9.5 前端 i18n 适配

新增翻译 key（登记到 `static-keys.ts` 并同步到 `locales/*.json`）：

| Key | 中文 |
|-----|------|
| `Continue with Feishu` | 使用飞书登录 |
| `Feishu` | 飞书 |
| `Enable Feishu OAuth` | 启用飞书 OAuth 登录 |
| `Allow users to sign in with Feishu` | 允许用户使用飞书登录 |
| `Feishu App ID` | 飞书 App ID |
| `Feishu App Secret` | 飞书 App Secret |
| `Login Policy` | 登录策略 |
| `Parallel Mode` | 并行模式 |
| `Feishu Only Mode` | 飞书专属模式 |
| `Group Mapping` | 分组映射 |
| `Bind Group` | 绑定分组 |
| `Change Binding` | 更改绑定 |
| `Bind Plan` | 绑定套餐 |
| `Full Sync` | 全量同步 |
| `Import Bindings` | 导入绑定 |
| `Replay Failed` | 重放失败 |
| `Feishu Binding Management` | 飞书绑定管理 |
| `Switching to Feishu-only will disable all password login` | 切换到飞书专属模式后，所有密码登录将被禁用 |
| `Please ensure all users have completed Feishu binding before switching` | 请确保所有用户已完成飞书绑定后再切换 |
| `Changing the bound group will trigger subscription sync for all users in this group` | 修改绑定分组将触发该分组下所有用户订阅同步变更 |
| `Please sign in with Feishu` | 请使用飞书登录 |
| `Default Group` | 默认分组 |
| `New Feishu users will be assigned to this group` | 新通过飞书登录的用户将分配到此分组 |
| `This group should have no quota or model permissions, awaiting admin authorization` | 该分组应无额度、无模型权限，等待管理员授权 |
| `Pending` | 待授权 |
| `User is in pending group, awaiting authorization` | 用户处于待授权分组，请等待管理员分配分组 |

## 10. 发布与灰度计划

阶段 1：并行 + 导入

- 上线导入接口与拦截逻辑
- 批量回填飞书绑定
- 上线前端飞书登录入口（并行模式）

阶段 2：观测

- 观测密码登录拒绝率、飞书登录成功率、用户名冲突率

阶段 3：切飞书-only

- 开启 `feishu_only`
- 前端登录页自动切换为飞书-only 模式（隐藏密码表单）
- 保留回放接口一段时间

## 11. 验收标准

### 后端验收

- 已绑定飞书的用户，密码登录必拒绝
- 存量用户导入绑定成功率可观测，可重放失败项
- 飞书登录后用户名完成同步且冲突可自动处理
- 分组变更与套餐分组变更均能触发用户订阅同步
- 关键链路有审计记录
- 飞书 OAuth 新注册用户自动分配至 `pending` 分组，额度为 0
- `pending` 分组用户无法调用任何 API（无模型权限）
- 管理员将用户从 `pending` 切换至正式分组后，用户自动获得对应额度和权限

### 前端验收

- 登录页飞书按钮使用飞书官方品牌图标，视觉优先级最高
- `parallel` 模式下飞书按钮突出显示，密码表单保留
- `feishu_only` 模式下密码表单隐藏，飞书按钮占据主区域
- 管理端套餐编辑页面可查看和修改分组-套餐映射关系
- 管理端分组映射 Tab 可查看全部分组的套餐绑定、触发同步
- 管理端 OAuth 设置页面包含飞书 Tab（启用/配置/策略切换）
- 管理端飞书绑定管理页面支持导入/查询/重放
- 管理端飞书绑定管理页面可查看用户当前分组，支持直接将 `pending` 用户变更至正式分组

---

## 附录B：2026-05-07 对话回顾与需求收敛（同步更新）

### B.1 最终确认需求

1. 手动同步未生效订阅用户按钮放在“套餐管理列表行级操作”，不放在用量页。
2. 组织用量暂不开放，不在订阅管理中展示入口。
3. 非活跃用户查询使用固定期间选择（默认最近15天），不使用自由输入。
4. 在 React #130 背景下，套餐用量模块可独立重开发，先保稳定再做美观。

### B.2 已实现状态（截至本次会话）

- 订阅管理入口：Tab 为`套餐管理 / 套餐用量 / 非活跃用户`。
- 行级手动同步：套餐行操作已接入 `/api/user/group-sync`（按 `group_name` 定向补齐）。
- 非活跃用户查询：固定 `7/15/30/60/90` 天，默认15天。
- 套餐用量模块：已独立重构前端实现，接口不变，并追加视觉优化（卡片容器、工具栏、表格样式、空态）。

### B.3 排障经验沉淀（React #130）

- 必须先确认构建哈希与线上加载哈希一致，再判断代码是否生效。
- 出现登录态异常（401 + securecookie invalid）时先重新登录，避免误判为渲染故障。
- 对该类问题优先采用“最小渲染面二分定位法”，一次仅变更一个可疑区块。

- 管理端 OAuth 设置飞书 Tab 包含"默认分组"配置项
- 所有新增文案均有 i18n 翻译

## 12. 实施顺序

1. 登录拦截策略 + 配置开关
2. 飞书绑定导入/查询/回放接口
3. 首次飞书登录自动绑定与用户名同步
4. 套餐分组变更触发用户订阅同步
5. **前端：飞书品牌图标组件 + 登录页飞书入口**
6. **前端：管理端 OAuth 设置飞书 Tab + 登录策略开关**
7. **前端：管理端套餐分组可视化配置（映射 Tab + 编辑增强）**
8. **前端：管理端飞书绑定管理界面**
9. 灰度发布与监控
