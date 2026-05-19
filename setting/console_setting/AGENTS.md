<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# setting/console_setting

## Purpose

管理管理控制台 UI 面板的显示配置，控制以下面板的内容与开关：
- API 信息面板（`api_info`）
- Uptime Kuma 状态监控面板（`uptime_kuma_groups`）
- 系统公告（`announcements`）
- 常见问题 FAQ（`faq`）

配置存储键前缀为 `console_setting.*`，通过 `GlobalConfig` 从数据库动态加载。

## Key Files

| File | Description |
|------|-------------|
| `config.go` | `ConsoleSetting` 结构体、默认值、`GlobalConfig` 注册、`GetConsoleSetting()` 访问器 |
| `validation.go` | 配置值合法性校验逻辑 |

## For AI Agents

### Working In This Directory

- 内容字段（`ApiInfo`、`UptimeKumaGroups`、`Announcements`、`FAQ`）存储为 JSON 数组字符串，由前端渲染解析。
- 开关字段（`*Enabled`）控制对应面板是否在控制台显示。
- 通过 `GetConsoleSetting()` 获取当前配置指针，修改面板行为时不要直接赋值包级变量。
- 新增面板类型时，需同时在 `ConsoleSetting` 结构体增加内容字段和开关字段，并更新 `validation.go`。

### Testing Requirements

- 目前无独立单元测试；通过控制台 API 接口（`controller/`）进行集成验证。
- 修改 `validation.go` 后，手动验证非法配置是否被正确拒绝。

### Common Patterns

```go
setting := console_setting.GetConsoleSetting()
if setting.AnnouncementsEnabled {
    // 渲染公告内容
}
```

## Dependencies

### Internal

- `setting/config/` — `GlobalConfig` 注册框架

### External

无

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
