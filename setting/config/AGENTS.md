<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# setting/config

## Purpose

提供统一的配置管理框架，是所有 `setting/*` 子目录的基础设施。核心功能：
- `ConfigManager`：配置注册中心，以 `name → *struct` 方式管理所有配置模块
- DB 序列化：将配置结构体展平为 `name.field` 键值对写入数据库
- DB 反序列化：从数据库键值对还原到结构体字段（支持 string/bool/int/uint/float/ptr/slice/map/struct 类型）
- 导出函数：`ConfigToMap` / `UpdateConfigFromMap` 供外部（如测试）直接使用单个配置结构体

## Key Files

| File | Description |
|------|-------------|
| `config.go` | `ConfigManager` 实现，`GlobalConfig` 单例，`LoadFromDB`/`SaveToDB`/`ExportAllConfigs`/`ConfigToMap`/`UpdateConfigFromMap` 方法 |
| `config_test.go` | 序列化/反序列化单元测试 |

## For AI Agents

### Working In This Directory

- `GlobalConfig` 是包级单例，所有配置模块在各自 `init()` 中调用 `config.GlobalConfig.Register(name, &structPtr)` 注册。
- DB 存储键格式：`<name>.<json_tag>`，例如 `billing_setting.billing_mode`。
- `LoadFromDB(options map[string]string)` 由上层（controller/model）在启动和热更新时调用，将 DB 读取的选项批量还原到注册的配置结构体。
- `SaveToDB(updateFunc)` 将所有注册配置序列化后逐一调用 `updateFunc(key, value)` 写入 DB。
- 复杂类型（slice、map、struct）使用 JSON 序列化为字符串存储；map 字段在反序列化时分配全新 map 再填充（避免遗留旧 key）。
- 指针类型（`reflect.Ptr`）：nil 序列化为字符串 `"null"`；非 nil 序列化为 JSON；反序列化时若值为 `"null"` 则置 nil，否则按需 `reflect.New` 初始化后反序列化。
- int 字段兼容 float 格式字符串（如 `"2.000000"`），uint 字段同理。
- 导出函数 `ConfigToMap` / `UpdateConfigFromMap` 可直接操作单个结构体指针，用于测试或外部调用（`monitor_setting_test.go` 使用了 `UpdateConfigFromMap`）。
- 注意：`config.go` 内部使用了 `encoding/json`（序列化基础设施），这是唯一允许直接使用标准库 json 的例外场景，业务代码仍须通过 `common/json.go`。

### Testing Requirements

- 运行 `go test ./setting/config/...` 验证序列化往返正确性。
- 新增字段类型支持时，必须在 `config_test.go` 中补充对应测试用例。

### Common Patterns

```go
// 其他子包注册配置（在 init() 中）
config.GlobalConfig.Register("my_setting", &mySetting)

// 上层加载全部配置
options, _ := model.GetOptions()
config.GlobalConfig.LoadFromDB(options)

// 导出所有配置（用于调试或全量同步）
all := config.GlobalConfig.ExportAllConfigs()

// 测试中直接操作单个结构体
err := config.UpdateConfigFromMap(&mySetting, map[string]string{"some_field": "value"})
```

## Dependencies

### Internal

- `common/` — `SysError` 日志

### External

- `encoding/json` — 仅限此框架文件内部使用，用于复杂类型的序列化

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
