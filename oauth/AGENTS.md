<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# oauth

## Purpose

实现 OAuth 2.0 / OIDC 第三方登录功能，提供统一的 Provider 注册中心和多个具体 OAuth 提供方适配器。支持内置提供方（GitHub、Discord、LinuxDo、Google、OIDC）和从数据库动态加载的自定义通用 OAuth 提供方。

## Key Files

| File | Description |
|------|-------------|
| `registry.go` | Provider 注册中心：`Register`/`RegisterCustom`/`Unregister`、`GetProvider`/`GetAllProviders`、`GetEnabledCustomProviders`、`LoadCustomProviders`/`ReloadCustomProviders`、`RegisterOrUpdateCustomProvider`/`UnregisterCustomProvider`、`IsCustomProvider` |
| `provider.go` | `Provider` 接口定义及公共 OAuth 流程实现 |
| `types.go` | 核心类型：`OAuthToken`、`OAuthUser`、`OAuthError`、`AccessDeniedError` |
| `generic.go` | `GenericOAuthProvider`：通用 OAuth 适配器，支持从 DB 配置动态创建 |
| `github.go` | GitHub OAuth 适配器 |
| `discord.go` | Discord OAuth 适配器 |
| `linuxdo.go` | LinuxDo OAuth 适配器 |
| `google.go` | Google OAuth 适配器（`GoogleProvider`）；包含 `parseGoogleUserInfo`、`googleUsernameFromEmail` 工具函数；通过 `init()` 自注册 |
| `oidc.go` | OIDC（OpenID Connect）适配器 |
| `google_test.go` | Google 适配器单元测试：`parseGoogleUserInfo` 多场景覆盖（email_verified 字符串/缺失、empty sub/email 等） |

## For AI Agents

### Working In This Directory

- `Provider` 接口定义在 `provider.go`，新增内置提供方须实现该接口；内置提供方（如 `google.go`）通过包级 `init()` 调用 `Register(name, provider)` 自注册，无需外部显式调用。
- 自定义提供方（`GenericOAuthProvider`）从数据库加载，通过 `LoadCustomProviders()` 批量注册；动态增删时调用 `RegisterOrUpdateCustomProvider` / `UnregisterCustomProvider`。
- `registry.go` 内部用两个独立 map 分离内置提供方（`providers`）和自定义提供方（`customProviders`），`IsCustomProvider(slug)` 可区分；`ReloadCustomProviders` 只清理自定义提供方，不影响内置提供方。
- 错误类型分两种：`OAuthError`（包含 i18n 消息键，最终翻译后展示给用户）和 `AccessDeniedError`（直接展示原始消息）。
- OAuth 流程中涉及 i18n 翻译的错误，使用 `NewOAuthError(msgKey, params)` 构建，在 controller 层调用 `i18n.T(c, err.MsgKey, err.Params)` 翻译。
- 不要在此包中直接调用 `model` 包以外的数据库操作，保持依赖方向为 `controller → oauth → model`。
- Google 适配器中 `email_verified` 字段可能是 `bool` 或 `"true"`/`"false"` 字符串，`parseGoogleUserInfo` 做了兼容处理；新增提供方若用户信息字段有类型歧义时参考此模式。

### Testing Requirements

- 单元测试：`go test ./oauth/...`（`google_test.go` 覆盖 Google 用户信息解析的多种边界场景）
- 其余提供方目前无独立单元测试；通过 OAuth 登录 E2E 流程验证。
- 新增提供方时，参考 `google_test.go` 编写 mock HTTP 响应单元测试，覆盖 token 交换和用户信息解析。

### Common Patterns

```go
// 获取已注册的提供方
provider := oauth.GetProvider("github")
if provider == nil {
    // 提供方未注册或未启用
}

// 动态更新自定义提供方（来自 DB 变更）
oauth.RegisterOrUpdateCustomProvider(config)

// 重新加载所有自定义提供方
oauth.ReloadCustomProviders()

// 判断是否为自定义（动态）提供方
if oauth.IsCustomProvider(slug) { ... }
```

## Dependencies

### Internal

- `model/` — `GetAllCustomOAuthProviders()`、`CustomOAuthProvider` 结构
- `common/` — `SysError`、`SysLog` 日志函数
- `i18n/` — 错误消息翻译（在 controller 层调用，非直接依赖）

### External

无（HTTP 请求通过标准库 `net/http` 完成）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
