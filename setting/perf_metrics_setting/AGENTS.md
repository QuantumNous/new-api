<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# setting/perf_metrics_setting

## Purpose

管理性能指标采集（Performance Metrics）的运行时配置，控制指标数据的采集开关、写入频率、时间桶精度和数据保留周期。该配置作用于指标聚合层，与运行时性能监控（`performance_setting`）职责不同：
- `perf_metrics_setting`：指标数据如何采集和存储
- `performance_setting`：服务进程本身的资源监控和磁盘缓存

## Key Files

| File | Description |
|------|-------------|
| `config.go` | `PerfMetricsSetting` 结构体、默认值、`GlobalConfig` 注册、桶时间秒数和刷新间隔 getter |

## For AI Agents

### Working In This Directory

- 注册键为 `perf_metrics_setting`，DB 键如 `perf_metrics_setting.enabled`。
- `BucketTime` 取值：`"minute"`（60s）、`"5min"`（300s）、`"hour"`（3600s，默认）；`GetBucketSeconds()` 将字符串转换为秒数整型。
- `FlushInterval` 单位为分钟，`GetFlushIntervalMinutes()` 保证最小值为 1。
- `RetentionDays` 为 0 表示永久保留。
- 修改时间桶逻辑须同步更新指标写入层的聚合 SQL。

### Testing Requirements

- 目前无独立单元测试；通过指标采集集成路径验证。
- 修改 `GetBucketSeconds()` 的分支逻辑后，添加简单的表驱动单元测试。

### Common Patterns

```go
cfg := perf_metrics_setting.GetSetting()
if cfg.Enabled {
    bucket := perf_metrics_setting.GetBucketSeconds()  // e.g. 3600
    interval := perf_metrics_setting.GetFlushIntervalMinutes() // e.g. 5
}
```

## Dependencies

### Internal

- `setting/config/` — `GlobalConfig` 注册框架

### External

无

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
