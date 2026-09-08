# 独立服务器容灾准备

状态：**待指定备用服务器，尚未启用容灾接管**。导出、在同一台主机隔离恢复、增加同机容器都不等于独立服务器容灾。

## 已核实的现状（2026-09-08）

- 主机：140.245.89.202 / a1-ubuntu-free，ARM64。
- new-api、PostgreSQL 15、Redis 7、Cloudflare Tunnel 均在该主机。
- PostgreSQL 数据库约 13 MB；`wal_level=replica`、`max_wal_senders=10`，当前复制连接数为 0，`archive_mode=off`。
- 图片及暂存响应在 `/opt/new-api/data`，容器内 `/data/drawing-temporary`；盘点时 data 约 5.1 MiB，日志约 14 MiB。
- 主机存在 selfhost-backup 定时器，其最近一次运行成功；脚本特征未显示 rsync/rclone/restic/scp/S3 传输，不能据此认定已经存在异地副本。

## 本次已准备的恢复产物

`export_recovery.py` 由管理员运行，验证主机身份后导出 PostgreSQL 自定义格式备份、实际应用镜像、data 目录及应用配置到 `/var/backups/hardy-dr/<时间戳>/`（root 私有）。随后在无网络、独立 tmpfs 数据目录的临时 PostgreSQL 中完整恢复并查询核心表；结束后移除演练容器。产物逐文件 SHA256 和验收结果写入 manifest.json。

该恢复包包含用户数据及运行凭据，不应进入 Git 或公网下载目录。日志和 Redis 缓存不作为账本恢复来源；恢复时新建 Redis，并重新验证登录会话。数据库备份具有事务一致性，但图片复制与数据库不构成同一时刻的原子快照，恢复时需核对图片过期和文件缺失状态。

已执行并完整恢复验证的产物：`/var/backups/hardy-dr/20260908T073057Z-be1d66`，321,035,467 字节，对应 `hardy-image-b64-20260908-104243`（本站非 JSON 修复发布前恢复点）。manifest 标记 `restore_verified=true`、`offsite_copy=false`。仅用 `--network none` 的临时 PostgreSQL 演练，无收费上游调用，原应用和网络在备份过程中未重启。

## 目标部署方式

1. **独立故障域**：使用另一台实际服务器，核实其主机身份、架构、空闲资源、现有业务和登录方式；不同机房更能隔离网络故障。未指定目标前不购买、不更改 DNS、不启动第二个生产 Tunnel。
2. **数据库副本**：同平台 PostgreSQL 15 流复制，单独的最小权限复制账号，链路加密和来源限制，监控复制延迟、WAL 磁盘占用及复制槽失效。异步复制不能承诺零账本丢失；如果要求每笔扣费都不丢，需确定同步复制及备用节点不可用时是否暂停写入的策略。
3. **图片和应用**：同步已验收的应用版本、必要配置以及图片/暂存响应；为备用机准备独立 Redis。不能只复制数据库，或者只增加 Tunnel 而仍依赖主机上的数据库和图片目录。
4. **防止双主和重复生图**：备用数据库先保持只读，备用应用不启动生图 worker；接管前必须确认旧主机被隔离（fencing）。失联不等于旧主停止写入。故障时正在生成的请求可能结果未知，不能自动重新生图；优先依据已保存响应及请求记录恢复。
5. **接管与回切**：确认副本延迟与允许的恢复点后，提升备用数据库、启用备用应用和入口。恢复后的旧主以副本身份重建，不直接重新接入流量。账户余额、代理价、图片、登录以及未完成任务都必须验收。

只把第二个 cloudflared 加到同一 Tunnel 会使其参与接收流量，因此不能在备用后端尚不可写或尚未同步时上线。需要根据备用服务器、Cloudflare 现有功能及恢复时间目标决定入口切换方式。

## 上线前需要确认的实际输入

- 备用服务器名称/IP及允许的访问方式；若没有服务器，先评估规格和费用。
- 客户端项目路径，才能把 JSON 保护接入报错的实际调用方。
- 对账本允许的数据损失（RPO）及恢复时间（RTO）；当前不能宣称零丢失或自动秒切。

参考：

- PostgreSQL 15 流复制与同步复制：https://www.postgresql.org/docs/15/warm-standby.html
- PostgreSQL 故障切换和防止双主：https://www.postgresql.org/docs/15/warm-standby-failover.html
- Cloudflare Tunnel 副本：https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/
