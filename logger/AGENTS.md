<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# logger

## Purpose

提供结构化日志写入功能，支持将日志输出到标准输出和可滚动的日志文件。当日志条数达到阈值（100 万条）时自动切换新文件。日志级别包括 `INFO`、`WARN`、`ERR`、`DEBUG`。

## Key Files

| File | Description |
|------|-------------|
| `logger.go` | 日志初始化（`SetupLogger()`）、日志文件滚动、`GetCurrentLogPath()`、各级别日志写入函数 |

## For AI Agents

### Working In This Directory

- `SetupLogger()` 在启动时由主程序调用，依赖 `common.LogDir` 命令行参数；若 `LogDir` 为空则只输出到标准输出。
- 日志文件路径通过 `GetCurrentLogPath()` 获取（加读锁保护并发访问）。
- 日志写入使用 `bytedance/gopkg/util/gopool` 异步执行，避免阻塞请求处理。
- `maxLogCount = 1000000`：单文件最多 100 万条日志，超出后自动滚动。
- 此包仅负责文件写入基础设施；具体日志调用（`common.SysLog`、`common.SysError`）在 `common/` 包中定义，`common` 内部会调用此包的写入函数。
- 不要在此包中引入业务逻辑依赖（已依赖 `operation_setting` 作为唯一例外，用于读取日志级别开关）。

### Testing Requirements

- 目前无独立单元测试文件。
- 修改滚动逻辑时，通过集成测试验证高并发场景下日志不丢失。

### Common Patterns

```go
// 启动时初始化（main.go 调用）
logger.SetupLogger()

// 获取当前日志文件路径（用于日志下载接口）
path := logger.GetCurrentLogPath()
```

## Dependencies

### Internal

- `common/` — `LogDir` 配置、工具函数
- `setting/operation_setting/` — 日志级别开关（如 Debug 日志是否启用）

### External

- `github.com/bytedance/gopkg/util/gopool` — 异步日志写入线程池
- `github.com/gin-gonic/gin` — HTTP 上下文（日志中间件使用）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
