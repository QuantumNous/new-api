<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-10 -->

# i18n

## Purpose

提供后端国际化（i18n）支持，基于 `nicksnyder/go-i18n/v2` 库，将错误消息和系统提示翻译为用户首选语言后返回给客户端。

**注意**：这是后端 Go i18n，与前端 `web/default/src/i18n/`（i18next）完全独立，两套系统翻译文件格式和管理方式均不同：
- 后端：YAML 格式，嵌入到 Go 二进制，通过 `go:embed` 加载
- 前端：JSON 格式，由 i18next 在浏览器运行时加载

当前支持语言：
- **完整 locale**（覆盖全部消息键）：`zh-CN`（简体中文）、`zh-TW`（繁体中文）、`en`（英文，默认回退语言）、`pt`（葡萄牙语，2026-06-10 新增）。
- **仅邮件 locale**（只含 `email.*` 键，其余键由 go-i18n 回退英文）：`es`、`fr`、`ru`、`ja`、`vi`（2026-06-13 新增，仅用于验证码/密码重置邮件本地化）。这些 locale 的 `localizers` 以 `NewLocalizer(bundle, lang, DefaultLang)` 创建，缺失键自动回退 `en`。

## Key Files

| File | Description |
|------|-------------|
| `i18n.go` | 初始化（`Init()`）、`T()`/`Translate()` 翻译函数、语言检测（`GetLangFromContext()`）、`ParseAcceptLanguage()` |
| `keys.go` | 翻译消息键常量定义 |
| `locales/zh-CN.yaml` | 简体中文翻译文件（完整） |
| `locales/zh-TW.yaml` | 繁体中文翻译文件（完整） |
| `locales/en.yaml` | 英文翻译文件（完整，默认回退） |
| `locales/pt.yaml` | 葡萄牙语翻译文件（完整，2026-06-10 新增） |
| `locales/{es,fr,ru,ja,vi}.yaml` | 仅含 `email.*` 邮件文案，其余键回退英文（2026-06-13 新增） |
| `email_i18n_test.go` | 邮件文案 i18n 单元测试：9 语言渲染、模板变量替换、各语言标题去重、邮件 locale 非邮件键回退英文 |

## For AI Agents

### Working In This Directory

- 所有翻译消息键定义在 `keys.go` 中，添加新消息时先在此文件定义常量，再在四个**完整** locale（`zh-CN`/`zh-TW`/`en`/`pt`）中同步添加翻译；仅邮件 locale（`es`/`fr`/`ru`/`ja`/`vi`）只需在新增 `email.*` 键时同步，其余键自动回退英文。
- `T(c *gin.Context, key string, args ...map[string]any)` 是 controller 层的主入口，自动从 gin context 提取用户语言。
- 语言检测优先级（`GetLangFromContext`）：用户设置 > 懒加载用户 DB 语言 > `Accept-Language` 请求头 > 默认 English。
- `SetUserLangLoader(loader)` 由 `model` 包在初始化时注入，避免 `i18n → model` 的循环依赖。
- 翻译文件通过 `//go:embed locales/*.yaml` 编译时嵌入二进制，无需运行时文件系统访问，修改 YAML 后须重新编译生效。
- 新增语言支持时：在 `i18n.go` 的 `SupportedLanguages()`、`normalizeLang()`、`Init()` 的文件加载列表和 `localizers` 初始化映射中同步添加，并在 `locales/` 下新建对应 YAML 文件。仅邮件 locale 的 `localizers` 必须传 `DefaultLang` 作为回退（`NewLocalizer(bundle, lang, DefaultLang)`），否则缺失键会返回裸键名。

### Testing Requirements

- `email_i18n_test.go`：邮件文案 i18n 测试，修改 `email.*` 键或新增邮件 locale 后须跑 `go test ./i18n/`。
- 新增翻译键时，手动验证四个完整语言文件（`zh-CN`、`zh-TW`、`en`、`pt`）均已添加对应翻译条目，避免 key-not-found 回退到消息键本身。
- 修改 `normalizeLang()` 时，验证各语言标签变体（`zh`、`zh-cn`、`zh-Hans`）均能正确归一化。

### Common Patterns

```go
// controller 层翻译错误消息
msg := i18n.T(c, i18n.KeySomeError, map[string]any{"Field": "email"})

// 直接按语言翻译（非 gin 上下文场景）
msg := i18n.Translate("zh-CN", i18n.KeySomeError)

// 检查语言是否支持
if i18n.IsSupported(lang) { ... }
```

## Dependencies

### Internal

- `common/` — `TranslateMessage` 函数注入点、`GetContextKeyType`
- `constant/` — `ContextKeyUserSetting`、`ContextKeyLanguage` 上下文键
- `dto/` — `UserSetting` 结构（含 `Language` 字段）

### External

- `github.com/nicksnyder/go-i18n/v2` — i18n 核心库
- `golang.org/x/text/language` — 语言标签解析
- `gopkg.in/yaml.v3` — YAML 翻译文件解析
- `github.com/gin-gonic/gin` — HTTP 上下文

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
