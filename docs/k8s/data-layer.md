# 自建数据层：高可用、备份与恢复

本文档补充 `deploy/k8s/postgres.yaml` 与 `deploy/k8s/redis.yaml` 之外的运维内容：单点风险评估、高可用升级路径、备份与恢复流程、容量与参数建议。

对应 issue #71。基础 StatefulSet 清单已由 PR #77（issue #73）交付，本文档只做深化，不重写基础清单。

## 1. 当前拓扑与单点风险

`deploy/k8s/postgres.yaml` 与 `deploy/k8s/redis.yaml` 交付的是**单副本 StatefulSet + PVC**：

| 组件 | 副本 | 存储 | 对外端点 |
|---|---|---|---|
| PostgreSQL | 1 | `volumeClaimTemplates` 声明的 PVC，20Gi | ClusterIP Service `postgres:5432` |
| Redis | 1 | `volumeClaimTemplates` 声明的 PVC，5Gi，开启 `appendonly` | ClusterIP Service `redis:6379` |

风险明确如下：

- **PostgreSQL 单点**：Pod 或所在节点故障期间，所有 new-api 副本都无法读写数据库，relay 请求会因鉴权和计费无法完成而失败。恢复时间取决于 Pod 重新调度与 PVC 重新挂载。
- **PVC 绑定节点**：`ReadWriteOnce` 的 PVC 通常只能被同一节点挂载。若使用 local-path 一类的本地存储 provisioner，节点宕机后 Pod 无法在其他节点启动，必须等节点恢复。
- **Redis 单点**：Redis 是缓存而非权威数据源（依据：`docs/k8s/runtime-constraints.md` 第 1 节，数据库为唯一权威）。Redis 不可用时会话校验回源数据库，功能可用但数据库压力上升、限流退化为各副本本地内存。
- **不做多副本 Redis**：new-api 只识别单个 Redis 端点，不解析 Cluster/Sentinel 节点列表，因此不能简单把 Redis 扩成多副本来提高可用性。

结论：Redis 单点可以接受；PostgreSQL 单点是整个部署最关键的可用性瓶颈。

## 2. PostgreSQL 高可用升级路径

前提约束：无论采用哪种方案，`SQL_DSN` 必须指向**一个稳定的可写端点**。new-api 不做读写分离，也不接受多个数据库地址。

### 方案 A：CloudNativePG（推荐）

Operator 管理主备切换，对外暴露一个 `-rw` Service 作为可写端点。

```bash
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.25/releases/cnpg-1.25.0.yaml
```

集群声明骨架（占位值需替换，凭证仍从 Secret 读取）：

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: new-api-pg
spec:
  instances: 3
  storage:
    size: 20Gi
  bootstrap:
    initdb:
      database: <db-name>
      owner: <db-user>
      secret:
        name: new-api-secrets
```

切换后把 `SQL_DSN` 指向 `new-api-pg-rw:5432`。故障转移由 Operator 完成，应用侧只需重连。

### 方案 B：Patroni + HAProxy

自行编排 Patroni 集群，用 HAProxy 暴露单一写端点。灵活但运维成本高于 Operator 方案，适合已有 Patroni 经验的场景。

### 方案对比

| 方案 | 自动故障转移 | 运维成本 | 适用 |
|---|---|---|---|
| 当前单副本 | 无，依赖 Pod 重启 | 最低 | 可接受分钟级不可用的部署 |
| CloudNativePG | 有 | 中 | 多节点集群，希望声明式管理 |
| Patroni + HAProxy | 有 | 高 | 已有 Patroni 运维经验 |

升级到 A 或 B 时，`deploy/k8s/postgres.yaml` 的单副本 StatefulSet 应停用，避免两套 PG 同时写同一份数据。

## 3. 备份与恢复

单副本方案下备份是唯一的数据安全手段，必须配置。

### 手动逻辑备份

```bash
kubectl exec statefulset/postgres -- \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > newapi-backup.sql
```

`POSTGRES_USER` / `POSTGRES_DB` 由 Pod 内环境变量提供（来自 `new-api-secrets`），因此命令里不出现明文凭证。

### 定时备份（CronJob 骨架）

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 3 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: pg-dump
              image: postgres:17-alpine
              command: ["sh", "-c"]
              args:
                - 'pg_dump -h postgres -U "$POSTGRES_USER" "$POSTGRES_DB" > /backup/newapi-$(date +%F).sql'
              env:
                - name: POSTGRES_USER
                  valueFrom:
                    secretKeyRef:
                      name: new-api-secrets
                      key: postgres-user
                - name: POSTGRES_DB
                  valueFrom:
                    secretKeyRef:
                      name: new-api-secrets
                      key: postgres-db
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: new-api-secrets
                      key: postgres-password
              volumeMounts:
                - name: backup
                  mountPath: /backup
          volumes:
            - name: backup
              persistentVolumeClaim:
                claimName: postgres-backup
```

备份 PVC 应使用与数据 PVC **不同的物理存储**，否则磁盘故障会同时损失两者。

### 恢复

```bash
kubectl exec -i statefulset/postgres -- \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < newapi-backup.sql
```

恢复前应先把 new-api 副本缩容到 0，避免恢复过程中写入冲突：

```bash
kubectl scale deployment/new-api-master --replicas=0
kubectl scale deployment/new-api-worker --replicas=0
# 恢复完成后再按需恢复副本数
```

### Redis 数据

Redis 只是缓存，无需备份。`appendonly yes` 已在 `deploy/k8s/redis.yaml` 中开启，用于 Pod 重启后快速恢复缓存，不构成数据安全依赖。丢失 Redis 数据的后果是缓存冷启动，不丢业务数据。

## 4. 容量与参数建议

| 项目 | 建议 | 说明 |
|---|---|---|
| PG PVC 容量 | 起步 20Gi，按日志量增长 | 日志表是主要增长源；可用 `LOG_SQL_DSN` 把日志分到独立库 |
| PG 连接数 | 关注 `SQL_MAX_OPEN_CONNS`（默认 1000） | 每个 new-api 副本都会建连接池，副本数 × 连接数不应超过 PG `max_connections` |
| Redis PVC 容量 | 5Gi 通常足够 | 只存会话与限流计数等短期数据 |
| 日志分库 | 可选 `LOG_SQL_DSN` | 把日志写入独立数据库，降低主库体积与备份时长 |

副本扩容时特别注意连接数：worker 从 3 扩到 10 时，数据库连接总数按比例上升，必要时下调每副本的 `SQL_MAX_OPEN_CONNS` 或提高 PG `max_connections`。

## 5. 部署前检查清单

- [ ] PVC 使用的 StorageClass 支持所需的访问模式，且节点故障后可重新挂载
- [ ] 备份 PVC 与数据 PVC 位于不同物理存储
- [ ] 已配置定时备份并验证过一次完整恢复流程
- [ ] `SQL_DSN` 指向单一可写端点，与实际部署的 PG 方案一致
- [ ] 副本数 × 单副本连接池上限不超过 PG `max_connections`
