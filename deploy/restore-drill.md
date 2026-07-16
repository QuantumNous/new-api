# 备份恢复演练 SOP（New API 企业内部 AI 网关 v1）

> 对应研发任务卡 **T7**。目标：确保每日备份**可恢复**、数据**完整**，上线前至少演练一次。
> 恢复演练**必须**在隔离库（非生产）进行，避免污染/覆盖生产数据。

## 1. 前置

- 备份文件：`/var/backups/newapi/newapi-YYYYMMDD-HHMMSS.sql.gz`（由 `backup.sh` 产出）。
- 一个**隔离**的 MySQL 实例（可用临时容器 `newapi-mysql-drill`，或独立测试库）。
- 与生产相同的字符集/版本（MySQL 8）。

## 2. 演练步骤

```bash
# 2.1 准备隔离库（临时容器，用独立卷，演练完即删）
docker run -d --name newapi-mysql-drill \
  -e MYSQL_ROOT_PASSWORD=drillpass \
  -e MYSQL_DATABASE=new-api \
  -p 13306:3306 mysql:8

# 2.2 等就绪
docker exec newapi-mysql-drill sh -c 'until mysqladmin ping -pdrillpass --silent; do sleep 2; done'

# 2.3 选一个备份还原（解压后导入隔离库）
BACKUP=/var/backups/newapi/newapi-20250715-030000.sql.gz
gunzip -c "$BACKUP" | docker exec -i newapi-mysql-drill \
  mysql -pdrillpass new-api

# 2.4 校验关键表与行数（与生产侧记录对比）
docker exec newapi-mysql-drill mysql -pdrillpass new-api -e \
  "SELECT 'user', COUNT(*) FROM user
   UNION ALL SELECT 'token', COUNT(*) FROM token
   UNION ALL SELECT 'channel', COUNT(*) FROM channel
   UNION ALL SELECT 'budget_pool', COUNT(*) FROM budget_pool
   UNION ALL SELECT 'quota_application', COUNT(*) FROM quota_application
   UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log;"
```

## 3. 校验清单

- [ ] 导入无报错（无 `ERROR` / `errno`）。
- [ ] 上述各表行数与备份时生产侧记录**一致**（偏差需在误差范围，并解释）。
- [ ] `budget_pool` 总额（`total_balance`）与备份时点一致（元）。
- [ ] 抽样用户 `quota` 字段值与备份时点一致。
- [ ] 任意抽样一条 `audit_log` / `logs` 可正常 `SELECT` 且字段完整。

## 4. 收尾

```bash
# 清理隔离容器与卷，避免遗留
docker rm -f newapi-mysql-drill
```

## 5. 排期与待决

- **频率**：建议每季度至少一次正式演练；CI/变更大版本前加做一次（待运维/SRE 与安全确认）。
- **保留期**：备份保留天数默认 30 天（见 `backup.sh` 的 `RETENTION_DAYS`），最终值待安全/合规负责人拍板。
- **恢复时间目标（RTO）/ 恢复点目标（RPO）**：基于每日 03:30 备份，RPO≈1 天；RTO 取决于库体量与导入速度，需在演练中实测记录。
