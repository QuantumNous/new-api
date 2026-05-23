# 恢复快照

## 主线目标
启用并改造 aiapi114 的上游状态展示链路：定时同步 Ikun 与 Foxcode 状态数据入库，公共接口基于同步数据和 Redis 缓存展示最近 5 小时的分组+模型状态，并记录生产启用步骤与动态调度预案。

## 正在做什么
实现、文档和针对性验证已完成，进入提交与最终汇报。

## 关键上下文
- 新增同步表模型 `SupplierStatusSync`，表名 `supplier_status_syncs`，唯一键为 `provider + monitor_id + checked_at`。
- 新增 `service/upstream_status*.go`：默认同步 Ikun 与 Foxcode；同步任务仅主节点启动，默认 180 秒，可用 `UPSTREAM_STATUS_SYNC_ENABLED=false` 关闭。
- `/api/uptime/status` 已改为读取同步数据，经 Redis key `upstream_status:public:v1` 缓存 60 秒后返回。
- 展示窗口为最近 5 小时，按供应商、分组、模型/线路聚合，返回 `history` 点位。
- 生产步骤和环境需求记录在 `docs/channel/upstream-status-sync-production.md`。
- 动态调度本轮仅记录方案，不执行自动禁用/启用/调权重。

## 下一步
提交本次变更并向用户汇报验证结果、生产操作步骤和未覆盖范围。

## 阻塞项
无。

## 方案
不改动既有手动渠道配置；先建立状态同步与展示基础设施，后续动态调度通过映射表和覆盖层接入。

## 已标记技能
hello-data、hello-api、hello-perf、hello-arch、hello-errors、hello-test、hello-write、hello-verify、test-driven-development。
