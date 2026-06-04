# Google OAuth 登录 — 设计方案 (Spec)

- **日期**: 2026-06-04
- **状态**: 已确认（用户通过选择题确认全部 4 项关键决策）
- **分支**: `feat/google-oauth-login`（在 git worktree 中开发）
- **参考**: flatkey.ai/system-settings/auth/oauth 的 OAuth 设置页

## 1. 目标

为 new-api 新增一等公民的「使用 Google 登录」方式：登录页出现独立的「Continue with Google」按钮；管理员后台可配置 Google OAuth（启用开关 + Client ID + Client Secret）；用户个人设置页可绑定/解绑 Google 账号。实现方式照搬现有 **OIDC 现代 Provider 模式**，而非旧的 `common/constants.go` + `model/option.go` 写法。

## 2. 关键决策（已确认）

| 决策 | 选择 |
|---|---|
| 后端实现 | **专用 GoogleProvider**（照搬 `oauth/oidc.go` 模式，新建 `oauth/google.go` + `setting/system_setting/google.go`） |
| 前端范围 | **仅 web/default**（React 19 默认主题），不改 web/classic |
| Google 端点 | **硬编码标准端点**，管理员只填 Client ID/Secret + 启用开关 |
| 账号校验 | **要求 `email_verified == true`** 才允许登录/绑定。账号标识以 Google `sub` 为唯一键；**不做按邮箱自动合并**（与现有 OIDC/GitHub/Discord 一致：邮箱相同的既有账号不会自动关联，会按 `sub` 新建独立账号）。是否需要按邮箱合并是独立产品决策，见 §9。 |

## 3. 架构与数据流

```
登录页「Continue with Google」按钮（仅当 status.google_oauth=true 显示）
  → 前端 buildGoogleOAuthUrl() 跳转 https://accounts.google.com/o/oauth2/v2/auth
     (client_id, redirect_uri={ServerAddress}/oauth/google,
      response_type=code, scope="openid email profile", state)
  → Google 用户授权后回调 → 前端泛型路由 routes/oauth/$provider.tsx
     → GET /api/oauth/google?code=...&state=...
       → controller.HandleOAuth → oauth.GetProvider("google")
         → ExchangeToken: POST https://oauth2.googleapis.com/token
            (client_id, client_secret, code, grant_type=authorization_code, redirect_uri)
         → GetUserInfo: GET https://openidconnect.googleapis.com/v1/userinfo
            校验 email_verified==true；取 sub 作为稳定 GoogleId
         → findOrCreateOAuthUser（泛型，已存在）→ setupLogin
```

### 端点（硬编码）
- Authorization: `https://accounts.google.com/o/oauth2/v2/auth`
- Token: `https://oauth2.googleapis.com/token`
- UserInfo: `https://openidconnect.googleapis.com/v1/userinfo`
- Scope: `openid email profile`
- redirect_uri: `{system_setting.ServerAddress}/oauth/google`

### 稳定标识
Google 的 `sub`（OIDC subject identifier）作为 `user.GoogleId`，**绝不可用 email 当主键**（email 可变）。

## 4. 改动清单

### 后端（走 OIDC 现代模式，不碰 constants.go / option.go）

| 文件 | 改动 |
|---|---|
| `oauth/google.go` | **新建** — `GoogleProvider` 实现 `oauth.Provider` 接口（8 个方法）+ `init()` 调 `Register("google", &GoogleProvider{})`；定义 `googleOAuthResponse` / `googleUser`(含 `email_verified`) DTO |
| `setting/system_setting/google.go` | **新建** — `GoogleSettings{Enabled, ClientId, ClientSecret}` + `config.GlobalConfig.Register("google", ...)` + `GetGoogleSettings()` |
| `model/user.go` | `User` 加 `GoogleId string` 字段（`gorm:"column:google_id;index"`）；新增 `FillUserByGoogleId()`、`IsGoogleIdAlreadyTaken()`（照搬 Oidc 版） |
| `controller/oauth.go` | `findOrCreateOAuthUser` 的事务 `Updates(map)` 加 `"google_id": user.GoogleId` |
| `controller/misc.go` | `GetStatus` 返回 `"google_oauth": GetGoogleSettings().Enabled`、`"google_client_id": GetGoogleSettings().ClientId` |

DB 迁移：GORM `AutoMigrate` 依据结构体 tag 自动加 `google_id` 列（SQLite/MySQL/PostgreSQL 三库兼容，符合 Rule 2，无需手写迁移）。

### 前端（仅 web/default，约 8–9 个文件）

| 文件 | 改动 |
|---|---|
| `web/default/src/lib/oauth.ts` | `buildGoogleOAuthUrl()` + `handleGoogleOAuth()` |
| `web/default/src/features/auth/hooks/use-oauth-login.ts` | `handleGoogleLogin()` + 导出 |
| `web/default/src/features/auth/components/oauth-providers.tsx` | Google 登录按钮（读 `status.google_oauth`） |
| `web/default/src/features/auth/components/oauth-callback-screen.tsx` | `providerDictionary` 加 `google`（SiGoogle 图标） |
| `web/default/src/features/auth/types.ts` | `SystemStatus` 加 `google_oauth?`、`google_client_id?` |
| `web/default/src/features/system-settings/auth/oauth-section.tsx` | Google 配置 tab（启用 toggle + ClientId + ClientSecret），含 schema/flatten/normalize 三处同步 |
| `web/default/src/features/profile/components/tabs/account-bindings-tab.tsx` | Google 绑定/解绑项 |
| `web/default/src/features/profile/types.ts` | `UserProfile` 加 `google_id?` |
| `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi}.json` | 新增文案：`"Continue with Google"`、`"Enable Google OAuth"`、`"Allow users to sign in with Google"`、`"Google"` |

回调路由 `web/default/src/routes/oauth/$provider.tsx` 为泛型，**无需改动**。

## 5. 错误处理

- `code` 为空 → `MsgOAuthInvalidCode`
- token 端点连接失败 → `MsgOAuthConnectFailed`（Provider=Google）
- access_token 为空 → `MsgOAuthTokenFailed`
- userinfo 返回非 200 → `MsgOAuthGetUserErr`
- `sub` 或 `email` 为空 → `MsgOAuthUserInfoEmpty`
- **`email_verified != true` → 拒绝**（复用 `MsgOAuthUserInfoEmpty` 或新增明确文案，实现时定）
- 复用现有 i18n key（`{"Provider": "Google"}` 参数），无需新增后端错误 key（email_verified 文案除外，按需）

## 6. 测试策略（TDD）

每个 task 先写测试、确认按正确原因失败、再实现最小代码、再跑验证。

- **model 层**：`FillUserByGoogleId` / `IsGoogleIdAlreadyTaken` 的存在性与查找逻辑（用现有 model 测试基建）
- **GoogleProvider 单测**：
  - token 响应 JSON 解析正确
  - userinfo 响应解析正确（`sub`/`email`/`email_verified`/`name`/`picture`）
  - `email_verified=false` 时返回错误、拒绝登录
  - `sub` 为空时返回 `MsgOAuthUserInfoEmpty`
- **controller**：`GetStatus` 含 `google_oauth`/`google_client_id`（可轻量断言）
- 前端：构建通过 + 关键组件按 `status.google_oauth` 条件渲染（按现有前端测试基建程度决定，无则手动验证 + 构建）

## 7. 任务拆分（每个 task 完成后做 omc code-review + `/code-review`，有问题修完再进下一个）

- **T1 — 后端 model 层**：`GoogleId` 字段 + `FillUserByGoogleId` + `IsGoogleIdAlreadyTaken`（先写 model 测试）
- **T2 — 后端 Provider + settings**：`oauth/google.go` + `setting/system_setting/google.go`（先写 provider 单测，含 email_verified 拒绝路径）
- **T3 — 后端 controller 接线**：`controller/misc.go` 状态暴露 + `controller/oauth.go` 事务字段
- **T4 — 前端登录链路**：`lib/oauth.ts` + `use-oauth-login.ts` + `oauth-providers.tsx` + `oauth-callback-screen.tsx` + `auth/types.ts`
- **T5 — 前端配置与绑定**：`oauth-section.tsx`（管理员配置 tab）+ `account-bindings-tab.tsx` + `profile/types.ts` + i18n 文案

## 8. 工作方式

- 在 git worktree（分支 `feat/google-oauth-login`）中隔离开发。
- 每个 task：TDD → 实现 → `oh-my-claudecode:code-reviewer` 子代理 review + `/code-review` → 修复问题 → 再进下一个 task。

## 9. 非目标 / YAGNI / 待决策

- 不做 Google Workspace `hd`（hosted domain）域名白名单。
- 不暴露可配置端点。
- 不改 web/classic 主题。
- 不引入 Google SDK，纯 HTTP（与现有 provider 一致）。
- **按邮箱自动合并账号（待产品决策）**：当前与所有现有 provider 一致——Google 登录若邮箱与既有账号相同，不自动合并，而是按 `sub` 新建独立账号。若未来希望"同邮箱自动登入既有账号"，需在 `findOrCreateOAuthUser` 增加按 `email_verified` 的邮箱关联逻辑，并评估账号接管风险（须仅在 `email_verified==true` 且谨慎处理同邮箱多账号场景下进行）。本期不实现。
