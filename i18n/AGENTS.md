<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# i18n

## Purpose

提供后端国际化（i18n）支持，基于 `nicksnyder/go-i18n/v2` 库，将错误消息和系统提示翻译为用户首选语言后返回给客户端。

**注意**：这是后端 Go i18n，与前端 `web/default/src/i18n/`（i18next）完全独立，两套系统翻译文件格式和管理方式均不同：
- 后端：YAML 格式，嵌入到 Go 二进制，通过 `go:embed` 加载
- 前端：JSON 格式，由 i18next 在浏览器运行时加载

当前支持语言：`zh-CN`（简体中文）、`zh-TW`（繁体中文）、`en`（英文，默认回退语言）。

## Key Files

| File | Description |
|------|-------------|
| `i18n.go` | 初始化（`Init()`）、`T()`/`Translate()` 翻译函数、语言检测（`GetLangFromContext()`）、`ParseAcceptLanguage()` |
| `keys.go` | 翻译消息键常量定义 |
| `locales/zh-CN.yaml` | 简体中文翻译文件 |
| `locales/zh-TW.yaml` | 繁体中文翻译文件 |
| `locales/en.yaml` | 英文翻译文件 |

## For AI Agents

### Working In This Directory

- 所有翻译消息键定义在 `keys.go` 中，添加新消息时先在此文件定义常量，再在三个 YAML 文件中同步添加翻译。
- `T(c *gin.Context, key string, args ...map[string]any)` 是 controller 层的主入口，自动从 gin context 提取用户语言。
- 语言检测优先级（`GetLangFromContext`）：用户设置 > 懒加载用户 DB 语言 > `Accept-Language` 请求头 > 默认 English。
- `SetUserLangLoader(loader)` 由 `model` 包在初始化时注入，避免 `i18n → model` 的循环依赖。
- 翻译文件通过 `//go:embed locales/*.yaml` 编译时嵌入二进制，无需运行时文件系统访问，修改 YAML 后须重新编译生效。
- 新增语言支持时：在 `i18n.go` 的 `SupportedLanguages()`、`normalizeLang()` 和 `localizers` 初始化中同步添加。

### Testing Requirements

- 目前无独立单元测试文件。
- 新增翻译键时，手动验证三个语言文件均已添加对应翻译条目，避免 key-not-found 回退到消息键本身。
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
