<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# perf_metrics

## Purpose
轻量级性能指标采集包，基于原子计数器（`sync/atomic`）实时采集每次 relay 请求的延迟、TTFT（首 token 延迟）、TPS（tokens per second）、成功率等指标。按时间桶（bucket）聚合，定期通过 `flushLoop` 持久化到数据库，供管理后台查询模型/分组维度的性能趋势。

## Key Files
| File | Description |
|------|-------------|
| `types.go` | 核心类型：`Sample`（单次采样数据）、`QueryParams`/`QueryResult`（查询参数与结果）、`BucketPoint`（时间序列数据点）、`GroupResult`、`ModelSummary`、`atomicBucket`（原子计数器桶）、`Store` 接口 |
| `metrics.go` | 主要逻辑：`Init`（启动后台 flush 协程）、`Record`（记录单次 sample）、`RecordRelaySample`（从 `RelayInfo` 提取指标并记录）、`Query`（按 model/group/hours 查询聚合结果）、`flushLoop`（定期持久化） |
| `flush.go` | 数据持久化逻辑：将内存中的 hot bucket 数据写入数据库 |
| `types.go` | 已包含 `atomicBucket` 的 `add`/`snapshot`/`drain`/`addCounters` 方法，无锁设计 |

## For AI Agents

### Working In This Directory
- `seriesSchema` 常量是客户端缓存/schema 版本标记，**禁止在仅做隐藏字段或隐私加固的变更时修改**，只在查询结果结构发生不兼容变化时才更新。
- `atomicBucket` 使用 `atomic.Int64` 实现无锁计数，多 goroutine 并发 `Record` 时安全；新增指标维度时需同时在 `Sample`、`atomicBucket`、`counters` 三个结构体中添加对应字段。
- `RecordRelaySample` 是 relay 层调用的入口，依赖 `RelayInfo.IsStream` 和 `HasSendResponse()` 判断 TTFT 可用性，修改时注意 nil 保护。
- **Rule 2**：`flush.go` 中的数据库写入必须兼容 SQLite/MySQL/PostgreSQL，使用 GORM 方法，不使用数据库特定 SQL。
- **Rule 1**：涉及 JSON 序列化（如查询结果）时使用 `common.Marshal`。

### Testing Requirements
- 此包目前无独立测试文件。
- 新增指标维度时建议添加单元测试，验证原子计数器的 `drain()` 行为。
- 运行命令：`go test ./pkg/perf_metrics/...`

### Common Patterns
- 在 relay 完成后调用：`perfmetrics.RecordRelaySample(info, success, outputTokens)`。
- 查询示例：`perfmetrics.Query(perfmetrics.QueryParams{Model: "gpt-4o", Group: "default", Hours: 24})`。
- 启动时需调用 `perfmetrics.Init()` 启动后台 flush 协程（在 `main.go` 或初始化链中）。

## Dependencies

### Internal
- `common` — 日志、数据库标志位
- `model` — 数据库 ORM 模型（持久化时使用）
- `relay/common` — `RelayInfo` 结构体（`RecordRelaySample` 参数类型）
- `setting/perf_metrics_setting` — 功能开关配置（`Enabled` 标志）

### External
- `sync/atomic` — 无锁原子计数器（标准库）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
