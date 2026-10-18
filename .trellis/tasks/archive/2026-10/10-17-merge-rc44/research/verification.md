# rc.44 合并验证（未推送）

- 合并基线 `a1342d5bb`，上游标签 `v1.0.0-rc.44` → `633b4c5b1`；目标为独立双亲提交，不包含后续授权日志功能。冲突索引为 0，暂存差异 `git diff --cached --check` 通过。
- 在任务专用 Docker Go runner `rc44-merge-go` 中执行 `make test`，通过；`cd /src/relaykit && GOWORK=off go build ./...` 与 `cd /src/tokenkit && GOWORK=off go build ./...` 均通过。最终 Go 源文件宿主和只读容器挂载哈希核对 409 个文件，stale/missing 为 0。日志分别留在 runner `/tmp/rc44-quality-make-test.log`、`/tmp/rc44-relaykit-build-final.log`、`/tmp/rc44-tokenkit-build-final.log`；其余临时证据清单在 `.pi/rc44-temp.md`。
- 主库与独立日志库：真实 `v1.0.0-rc.43`（`c6741c36a`）版本创建代表性旧库，在同一任务隔离数据库上用当前代码升级并重复启动/迁移；SQLite 3.50.4、MySQL 5.7.44、PostgreSQL 9.6.24 均通过。历史行、索引与唯一约束保留，第三次迁移无 DDL；空库矩阵另行通过。ClickHouse 25.8.33.6 独立日志库空库与 rc.43 旧库升级均通过审计/用量读写、权限投影、重复迁移。其 MergeTree 不强制 `event_id` 唯一，不能据此承诺去重。
- 前端 `bun run typecheck`、`bun run build`、受改动文件的格式、lint 及聚焦回归通过。**全量 `bun run test` 未通过：56 失败、2862 通过、2 跳过**；同名失败均在 HEAD 分组基线复现，但基线全量运行超时，不宣称全量无回归。**全量 `bun run lint` 未通过：157 错误**，文件与规则对照均见于 HEAD 基线的 175 项；不称全量通过。最终日志 `.pi/rc44-final-check-web-after-fixtures.log`、`.pi/rc44-quality-lint-final.log`，以及基线分组对照日志见 `.pi/rc44-temp.md`。
- 范围外/未验证：真实 fork 生产备份升级、旧于所测镜像补丁版本的数据库、ClickHouse 非零 TTL 切换；这些结果不是对任意生产数据或所有数据库版本的兼容承诺。认证相关改动参考 OWASP ASVS 5.0 §6.3.4/§7.2.1/§7.5.3、认证/会话/OAuth Cheat Sheets，但上述缺口未消除，不宣称全面合规。
- 本任务的 Docker 容器/网络、runner 缓存、`.pi/rc44-*` 临时日志/脚本、`web/dist` 和 `web/node_modules` 仅在用户同意后清理；既存 `.pi/review-artifacts-be09fdb01.md` 不属于本任务，未暂存也不可清理。
