# 恢复快照

## 主线目标
修复 aiapi114 `/api/uptime/status` 返回空数据的问题，确保上游状态同步表缺失时可自动补建，定时同步能写入 Ikun 和 Foxcode 数据，公共接口能返回按供应商、分组、模型组织的最近 5 小时状态数据。

## 正在做什么
已定位根因并完成修复、验证和本地接口复测，准备提交本次修复并汇报。

## 关键上下文
- 根因：本地运行服务未创建 `supplier_status_syncs` 表，公共接口读表失败后静默返回空数组。
- 修复：新增 `model.EnsureSupplierStatusSyncTable()`，读写同步表前自动执行 `AutoMigrate(&SupplierStatusSync{})`。
- 修复：`StartUpstreamStatusSyncTask()` 启动时先确保同步表存在，失败时记录错误并停止任务。
- 修复：`controller.GetUptimeKumaStatus` 在构建公共状态失败时写入错误日志，避免服务端静默吞错。
- 验证：本地重启后访问 `http://localhost:3001/api/uptime/status` 已返回 Ikun/Foxcode 聚合状态数据。
- 本地 SQLite 当前 `supplier_status_syncs` 数据量：1340 条，其中 `foxcode=800`、`ikun=540`。

## 下一步
提交本次四个相关文件的修复变更，并向用户汇报根因、修改内容、验证结果和本地恢复动作。

## 阻塞项
无。
