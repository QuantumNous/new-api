# 恢复快照

## 主线目标
完成 Foxcode 状态接口接入适配，让 `https://status.rjj.cc/api/status-page/heartbeat/foxcode` 可作为 Uptime Kuma 状态源直接配置和聚合。

## 正在做什么
实现和针对性验证已完成，正在收尾。

## 关键上下文
- Foxcode heartbeat 接口返回 `heartbeatList` 与 `uptimeList`，不包含线路名称。
- 适配器会从 direct heartbeat URL 自动推导 `https://status.rjj.cc/api/status-page/foxcode`，再用 `monitorList[].id` 关联心跳和可用率。
- 控制台 `UptimeKumaGroups` 校验已允许 direct heartbeat URL 省略 `slug`。
- 新增文档：`C:\work\aiapi114\docs\channel\foxcode-status-adapter.md`。
- 新增测试覆盖 direct heartbeat URL 聚合和配置校验。

## 下一步
提交或保留本次变更；最终回复时说明验证结果和未纳入本次提交的既有工作区变更。

## 阻塞项
无。

## 方案
不引入新的动态调度表；本轮完成 Foxcode / Uptime Kuma heartbeat 接口的接入适配。

## 已标记技能
hello-api、hello-test、hello-verify、test-driven-development。
