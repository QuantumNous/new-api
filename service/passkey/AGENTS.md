<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# service/passkey

## Purpose

封装 WebAuthn/Passkey 认证的核心服务逻辑：构建符合当前系统配置的 `webauthn.WebAuthn` 实例、管理注册/登录/验证三阶段的 gin session 存储、以及将 `model.User` + `model.PasskeyCredential` 适配为 `go-webauthn` 库所需的 `webauthn.User` 接口。controller 层直接调用本包完成 Passkey 注册与登录流程，无需了解 WebAuthn 协议细节。

## Key Files

| File | Description |
|------|-------------|
| `service.go` | `BuildWebAuthn(r *http.Request) (*webauthn.WebAuthn, error)`：每次请求动态构建 WebAuthn 实例，从 `system_setting.GetPasskeySettings()` 读取配置（RPID、Origins、用户验证级别、附件偏好），自动推导 Origin 和 RPID（支持反向代理的 `X-Forwarded-Proto`），拒绝非 HTTPS 的非 localhost 请求（除非 `AllowInsecureOrigin` 开启）；登录/注册超时均硬编码为 2 分钟 |
| `session.go` | `SaveSessionData` / `PopSessionData`：将 `webauthn.SessionData` 序列化为 JSON 后存入 gin session，`Pop` 操作读取后立即删除（一次性消费，防重放）；支持 string 和 []byte 两种 session 存储后端格式；定义三个 session key 常量：`RegistrationSessionKey`、`LoginSessionKey`、`VerifySessionKey` |
| `user.go` | `WebAuthnUser`：组合 `*model.User` 和 `*model.PasskeyCredential`，实现 `webauthn.User` 接口（`WebAuthnID`返回用户数字 ID 的字节序列、`WebAuthnName`、`WebAuthnDisplayName`、`WebAuthnCredentials`）；提供 `ModelUser()` 和 `PasskeyCredential()` 访问器供 controller 层读取认证结果 |

## For AI Agents

### Working In This Directory

- `BuildWebAuthn` 每次请求都新建实例（非单例），因为 RPID/Origins 可能被管理员在运行时修改，且需要从 `*http.Request` 中动态推导 Origin。
- Origin 推导优先级：`settings.Origins`（手动配置，逗号分隔）> 请求 Host 自动推导 > `system_setting.ServerAddress` fallback。RPID 推导优先级：`settings.RPID`（手动）> 从 Origin 提取 host（去端口）。
- `session.go` 中 `json.Marshal`/`json.Unmarshal` 直接使用 `encoding/json` 而非 `common.*`，原因是操作对象是 `webauthn.SessionData`（第三方库类型），属于框架边界，不受 Rule 1 约束。
- `WebAuthnID()` 返回的是用户数字 ID（`strconv.Itoa`）的字节表示，**不是** UUID；修改时须保证与已注册 credential 中存储的 ID 格式一致，否则已有 passkey 全部失效。
- `WebAuthnCredentials()` 每次只返回传入的单条 credential，不批量加载；controller 层负责在验证前按用户查出所有 credential 并逐一尝试（或由调用方决定策略）。
- 新增配置项须同步修改 `setting/system_setting` 中的 `PasskeySettings` 结构体，本包只读取，不写入。

### Testing Requirements

- 构建验证：`go build ./service/passkey/...`
- 当前无独立测试文件；WebAuthn 流程通过 controller 层集成测试覆盖。
- `BuildWebAuthn` 的 Origin/RPID 推导逻辑分支较多，建议对 `resolveOrigins` 和 `resolveRPID` 添加单元测试（mock `*http.Request`）。

### Common Patterns

- 所有函数在入参为 nil 时安全返回（`WebAuthnUser` 方法均有 nil 守卫），不 panic。
- session key 常量（`RegistrationSessionKey` 等）集中定义在 `service.go`，controller 层应通过包常量引用，不硬编码字符串。
- `PopSessionData` 是**破坏性读取**（读后即删），与 `SaveSessionData` 必须配对使用；不要在同一请求中多次 Pop 同一 key。

## Dependencies

### Internal

- `model/` — `model.User`（用户基础信息）、`model.PasskeyCredential`（credential 存储与 `ToWebAuthnCredential()` 转换）
- `setting/system_setting` — `GetPasskeySettings()`、`PasskeySettings` 结构体、`ServerAddress`
- `common/` — `SystemName`（RP 显示名称 fallback）、`DebugEnabled`（WebAuthn debug 模式）

### External

- `github.com/go-webauthn/webauthn/webauthn` — WebAuthn 核心库（`WebAuthn`、`Config`、`SessionData`、`User` 接口、`Credential`）
- `github.com/go-webauthn/webauthn/protocol` — `AuthenticatorSelection`、`ResidentKey*`、`UserVerificationRequirement`、`AuthenticatorAttachment`
- `github.com/gin-contrib/sessions` — gin session 中间件
- `github.com/gin-gonic/gin` — `*gin.Context`

<!-- MANUAL: -->
