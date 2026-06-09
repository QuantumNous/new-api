<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# setting/system_setting

## Purpose

管理系统级基础设施配置，涵盖认证、安全、外观等核心系统行为：
- **OIDC**：OpenID Connect 单点登录配置
- **Passkey**：WebAuthn/Passkey 认证配置
- **Discord**：Discord OAuth 集成配置
- **Google OAuth**：Google 登录集成配置
- **主题**：前端界面主题配置
- **法律声明**：隐私政策、服务条款等法律文本配置
- **SSRF 防护**（`fetch_setting.go`）：外部 URL 请求的 IP/域名过滤规则

## Key Files

| File | Description |
|------|-------------|
| `fetch_setting.go` | `FetchSetting`：SSRF 防护配置（白/黑名单模式、域名/IP 过滤、允许端口），注册键 `fetch_setting` |
| `oidc.go` | OIDC 提供方配置（endpoint、client id/secret、scope 等） |
| `passkey.go` | WebAuthn Passkey 配置（relying party、允许来源等） |
| `discord.go` | Discord OAuth 配置（client id/secret、redirect URI） |
| `google.go` | `GoogleSettings`（`Enabled`、`ClientId`、`ClientSecret`），注册键 `google`，`GetGoogleSettings()` |
| `theme.go` | 前端主题配置 |
| `legal.go` | 法律声明文本配置（隐私政策、服务条款链接） |
| `system_setting_old.go` | 旧版系统设置兼容层（迁移过渡用，只读） |

## For AI Agents

### Working In This Directory

- `FetchSetting` 注册键为 `fetch_setting`，默认开启 SSRF 防护（`EnableSSRFProtection: true`）；`AllowedPorts` 默认为 `["80","443","8080","8443"]`。
- `DomainFilterMode=true` 为白名单模式（只允许列表内的域名），`false` 为黑名单模式。
- `IpFilterMode=true` 为白名单模式，`false` 为黑名单模式。
- OIDC/Passkey/Discord/Google 配置包含 OAuth 密钥，存储于 DB，不要硬编码到代码中。
- `google.go` 注册键为 `google`，结构体为 `GoogleSettings`；与 `oauth/` 包中的 Google OAuth 流程联动，启用前须将 `Enabled` 置为 `true`。
- `system_setting_old.go` 仅用于向后兼容旧版数据库记录的读取，不要向其中添加新配置。
- 新增系统级配置时，创建独立文件并在 `init()` 中注册到 `GlobalConfig`，遵循 `google.go` 的极简模式：结构体 + 默认值 + `init()` 注册 + 单个 getter。

### Testing Requirements

- 目前无独立单元测试文件。
- 修改 SSRF 过滤逻辑时，在 `common/` 层的网络请求路径中进行集成验证。
- 修改 OIDC/Passkey/Google 配置结构时，通过 OAuth 登录流程进行 E2E 验证。

### Common Patterns

```go
// 获取 SSRF 防护配置
fetchCfg := system_setting.GetFetchSetting()
if fetchCfg.EnableSSRFProtection {
    // 执行域名/IP 过滤检查
}

// 获取 Google OAuth 配置
googleCfg := system_setting.GetGoogleSettings()
if googleCfg.Enabled {
    // 使用 googleCfg.ClientId / googleCfg.ClientSecret
}
```

## Dependencies

### Internal

- `setting/config/` — `GlobalConfig` 注册框架

### External

无

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
