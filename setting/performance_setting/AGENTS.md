<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# setting/performance_setting

## Purpose

管理服务进程运行时性能优化配置，涵盖两个子领域：
1. **磁盘缓存**：将超大请求体（超过阈值的）溢出到磁盘，减少内存压力
2. **资源监控**：CPU / 内存 / 磁盘使用率阈值告警

配置变更后须调用 `UpdateAndSync()` 将新值同步到 `common` 包的运行时变量，因为实际缓存逻辑在 `common/` 中执行。

## Key Files

| File | Description |
|------|-------------|
| `config.go` | `PerformanceSetting` 结构体、默认值（`DiskCacheEnabled=false`、`DiskCacheThresholdMB=10`、`DiskCacheMaxSizeMB=1024`、`MonitorEnabled=true`、CPU/内存/磁盘阈值分别为 90/90/95%）、`GlobalConfig` 注册、`GetPerformanceSetting()`、`UpdateAndSync()`、`GetCacheStats()`、`ResetStats()` |

## For AI Agents

### Working In This Directory

- 注册键为 `performance_setting`，DB 键如 `performance_setting.disk_cache_enabled`。
- `init()` 注册配置的同时调用 `syncToCommon()` 完成初始同步；后续从数据库热加载后，**必须**显式调用 `UpdateAndSync()` 才能使新配置生效（`LoadFromDB` 本身不会触发同步）。
- `DiskCachePath` 为空字符串时使用系统临时目录。
- 磁盘缓存阈值单位为 MB，默认触发阈值 10 MB，最大总缓存 1024 MB。
- 监控阈值单位为百分比（0-100）；默认 CPU/内存告警阈值 90%，磁盘告警阈值 95%。
- 磁盘缓存统计信息通过 `GetCacheStats()` 代理到 `common.GetDiskCacheStats()`；重置通过 `ResetStats()` → `common.ResetDiskCacheStats()`。

### Testing Requirements

- 目前无独立单元测试；通过 `common/` 层的集成路径验证磁盘缓存行为。
- 修改 `syncToCommon()` 后，手动验证 `common.GetDiskCacheConfig()` 是否返回预期值。

### Common Patterns

```go
// 配置热加载后同步
config.GlobalConfig.LoadFromDB(options)
performance_setting.UpdateAndSync()

// 获取缓存统计
stats := performance_setting.GetCacheStats()

// 重置统计
performance_setting.ResetStats()
```

## Dependencies

### Internal

- `setting/config/` — `GlobalConfig` 注册框架
- `common/` — `DiskCacheConfig`、`PerformanceMonitorConfig`、`SetDiskCacheConfig()`、`SetPerformanceMonitorConfig()`、`GetDiskCacheStats()`、`ResetDiskCacheStats()` 接口

### External

无

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
