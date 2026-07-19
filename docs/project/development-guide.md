# 功能开发指南

本文用于新增或修改功能时快速确定改动位置、设计约束和验证范围。

## 开始前

1. 在 [功能地图](features.md) 找到所属领域。
2. 使用 `rg` 搜索现有路由、控制器、服务、模型和前端调用，不仅查看同名文件。
3. 阅读对应专项文档；Relay 修改读 [relay-pipeline.md](relay-pipeline.md)，计费修改读 [billing-and-data.md](billing-and-data.md) 和 [Billing Expression System](../../pkg/billingexpr/expr.md)。
4. 确认是否已有 helper、DTO、设置项或前端组件可复用。
5. 定义可观察结果和最小回归验证，再开始编辑。

## 修改管理面功能

通常沿以下路径定位：

```text
web/default/src/features/<feature>
  -> router/api-router.go
  -> controller/<feature>.go
  -> service/<feature>.go（存在跨控制器逻辑时）
  -> model/<feature>.go
```

实施原则：

- 路由声明 HTTP 方法、权限和边界中间件。
- Controller 处理输入输出，不复制可复用业务规则。
- Service 承载跨控制器或跨模型业务流程；简单 CRUD 不必强行增加 Service。
- Model 使用 GORM 并保持三种数据库兼容。
- 前端 API、类型、组件和查询键放在同一 feature 内。

## 修改 Relay 公共行为

先判断变化属于哪个层级：

| 变化 | 优先修改位置 |
| --- | --- |
| 新增兼容路径 | `router/relay-router.go` 或 `router/video-router.go` |
| 请求 DTO 或显式零值语义 | `dto/` 与对应验证测试 |
| 鉴权、限流、模型提取或初始选渠 | `middleware/` |
| 公共请求生命周期、重试或错误输出 | `controller/relay.go` |
| 公共价格、预扣、结算或日志 | `relay/helper/`、`service/` |
| 单供应商协议、认证或响应差异 | `relay/channel/<provider>/` |
| 跨供应商请求格式转换 | `relay/` 或 `service/openaicompat/` |

修改共享函数前搜索所有调用者。能在公共链路修复的问题，不在每个供应商重复加分支。

## 新增同步渠道

1. 在 `constant/channel.go` 定义渠道类型和默认 Base URL，并检查 `constant/api_type.go` 的映射。
2. 优先复用现有 OpenAI 兼容适配器；只有协议或鉴权不同才新增 `relay/channel/<provider>/`。
3. 在 `relay/relay_adaptor.go` 注册适配器。
4. 实现模型列表、请求 URL/Headers、所需请求格式转换、上游调用和响应/usage 转换。
5. 确认 `StreamOptions` 支持；支持时加入 `streamSupportedChannels`。
6. 补充渠道配置界面、图标或 i18n，仅在用户确实需要配置差异时添加。
7. 添加一个能覆盖请求转换或响应 usage 的小型回归测试。

可选标量必须使用指针配合 `omitempty`，确保客户端显式传入的 `0`、`0.0` 和 `false` 会发送给上游。

## 新增异步任务渠道

异步任务实现 `relay/channel.TaskAdaptor`。除请求构造与响应解析外，还需要明确：

- 提交前如何估算时长、分辨率等计费倍率。
- 上游提交响应是否会修正估算参数。
- 轮询如何识别成功、失败和进行中状态。
- 完成态是否需要二次调整实际额度。
- 任务 ID、私有查询数据和计费快照如何持久化。

任务可能由后台轮询处理，所有状态更新与结算必须考虑重复轮询和多实例执行。

## 修改数据模型

- 优先使用 GORM `AutoMigrate` 和现有迁移模式。
- 原始 SQL 必须处理三种数据库的列引用、布尔值和语法差异。
- 不使用无回退方案的数据库专属 JSON、聚合或 ALTER 语法。
- 额度、订阅、订单和任务状态更新应在事务或原子更新中完成。
- 新字段需要确认缓存对象、序列化、脱敏、列表查询和软删除行为。

## 修改系统配置

运行时设置通常经过：

```text
前端设置表单 -> /api/option -> model.Option -> setting/<domain> -> 运行时读取
```

新增设置前确认它确实需要配置。需要配置时，提供默认值、校验、存储键、读取入口和前端说明，并确认 Option 热更新是否足够，还是必须重启。

## 验证顺序

按影响范围选择最小有效集合：

1. 新增或受影响的 Go 定向测试：`go test ./path/to/package`
2. 跨包公共行为：`go test ./...`
3. Go 格式与静态检查：`gofmt`、仓库已有检查或 CI 脚本
4. 前端类型：`bun run typecheck`
5. 前端 lint、相关测试与构建
6. 路由、流式输出、支付回调或任务轮询等关键路径的最小运行时验证

不要修复与本次改动无关的基线失败；记录它们并说明本次验证边界。

## 何时更新本文档集

以下变化应在同一改动中更新 `docs/project/`：

- 新增、删除或改变用户可见功能。
- 新增入口、权限级别、核心实体或配置领域。
- 改变 Relay、渠道选择、重试、计费、退款或任务状态链路。
- 改变前端模块、路由、全局状态或权限设计。
- 现有开发入口、约束或验证命令失效。

仅实现细节调整且行为、数据含义和扩展方式不变时，不必更新。
