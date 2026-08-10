# 凭证盲部署与 publish workflow

本文档说明 new-api 的 Kubernetes 部署如何在**仓库不持有任何明文凭证**的前提下完成：凭证只存在于 GitHub Actions Secrets 中，由 publish workflow 在部署时注入集群，生成集群内 Kubernetes Secret；manifests 只通过 `secretKeyRef` 引用 Secret 名称。

对应 issue #70。基础 workflow 与 Secret 引用骨架已由 PR #77（issue #73）交付，见 `.github/workflows/deploy.yml` 与 `k8s/README.md`。本文档做原理说明与运维深化，不重写基础 workflow。

## 1. 需要在 GitHub 配置的 Secret

在仓库 `Settings → Secrets and variables → Actions → New repository secret` 添加下表所有条目。值只填在 GitHub，不写入仓库任何文件。

| Secret 名称 | 用途 | 示例占位格式 |
|---|---|---|
| `KUBE_CONFIG_B64` | base64 编码的 kubeconfig，供 runner 访问集群 API server | `base64 -w0 < ~/.kube/config` 的输出 |
| `SQL_DSN` | 主数据库连接串（PostgreSQL/MySQL） | `postgresql://<user>:<pass>@<db-host>:5432/<db>` |
| `REDIS_CONN_STRING` | Redis 端点连接串 | `redis://:<pass>@<redis-host>:6379` |
| `SESSION_SECRET` | 会话与 Token 摘要密钥，所有 Pod 必须一致 | 高强度随机字符串 |
| `CRYPTO_SECRET` | 缓存键 HMAC 密钥，共享 Redis 时所有 Pod 一致 | 高强度随机字符串 |
| `POSTGRES_DB` | 自建 PG 数据库名 | `<db-name>` |
| `POSTGRES_USER` | 自建 PG 用户名 | `<db-user>` |
| `POSTGRES_PASSWORD` | 自建 PG 密码 | `REPLACE_ME` |
| `REDIS_PASSWORD` | 自建 Redis 密码 | `REPLACE_ME` |

生成 base64 kubeconfig：

```bash
base64 -w0 < ~/.kube/config
```

> 提示：`SESSION_SECRET` 不能填 `random_string`，程序会拒绝启动。多副本部署所有 Pod 必须使用同一个值。

## 2. 零明文原理

凭证在三个位置流转，任何一处都不落地明文到仓库：

```
GitHub Actions Secrets（加密存储）
        │  ${{ secrets.* }} 注入为环境变量，日志自动脱敏为 ***
        ▼
publish workflow（.github/workflows/deploy.yml）
        │  kubectl create secret ... --dry-run=client -o yaml | kubectl apply -f -
        ▼
集群内 Kubernetes Secret（new-api-secrets）
        │  Deployment/StatefulSet 通过 secretKeyRef 引用
        ▼
Pod 环境变量
```

三条保证：

1. **仓库零明文**：`k8s/*.yaml` 只写 `secretKeyRef.name: new-api-secrets` 与 `key: <字段名>`，从不写值。可用如下命令验证仓库无明文连接串：

   ```bash
   grep -rnE "postgres(ql)?://[^ ]*:[^ @]+@|redis://[^ ]*:[^ @]+@" k8s/ .github/
   ```

   预期无输出。

2. **日志脱敏**：GitHub Actions 对注册过的 Secret 值在日志中自动替换为 `***`，`kubectl` 命令行里的 `${{ secrets.X }}` 不会以明文出现在 run log。

3. **幂等注入**：workflow 用

   ```bash
   kubectl create secret generic new-api-secrets \
     --from-literal=sql-dsn="${{ secrets.SQL_DSN }}" \
     ... \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

   `--dry-run=client -o yaml | kubectl apply` 的组合让「首次创建」和「后续更新」走同一条命令，重复运行不报 `AlreadyExists`，也不会在 shell 历史或中间文件留下明文。

## 3. Secret 轮换

轮换任一凭证时，只需在 GitHub 改对应 Secret 值，重新触发 workflow：`kubectl apply` 会更新 `new-api-secrets`。已运行的 Pod 不会自动加载新值（env 在启动时注入），需要滚动重启：

```bash
kubectl rollout restart deployment/new-api-master
kubectl rollout restart deployment/new-api-worker
```

轮换 `SESSION_SECRET` 会使所有已登录会话失效，属预期行为。

## 4. runner 可达集群的两种方式

workflow 通过 `KUBE_CONFIG_B64` 里的 kubeconfig 连接集群 API server。runner 必须能网络到达该 API server，二选一：

| 方式 | 适用场景 | 代价 | 注意 |
|---|---|---|---|
| GitHub 托管 runner（`runs-on: ubuntu-latest`） | 集群 API server 有公网可达入口 | 无需自建机器 | API server 需暴露公网端点，应配合 IP 白名单 / mTLS；kubeconfig 里的 server 地址必须是公网可达的 |
| self-hosted runner | 集群在内网、API server 不公网暴露 | 需在能访问集群的机器上部署 runner | 把 `runs-on` 换成自托管标签（如 `runs-on: [self-hosted, k8s]`）；runner 机器与集群同内网即可，kubeconfig 用内网地址 |

对于「全是内网从属服务器、不想暴露 API server」的部署，推荐 **self-hosted runner**：在其中一台能 `kubectl` 到集群的服务器上注册 runner，workflow 就地执行，凭证不出内网。

## 5. 安全边界

- 不要把 kubeconfig、连接串、密码提交进仓库任何文件（包括示例文件、注释、测试夹具）。
- 不要在 workflow 里 `echo` 或 `cat` 出 Secret 值用于调试；如需排查，改用 `kubectl get secret new-api-secrets -o jsonpath=...` 在集群侧本地查看。
- `KUBE_CONFIG_B64` 等价于集群管理员凭证，泄露即集群失守；应使用最小权限的 ServiceAccount kubeconfig 而非 admin kubeconfig（后续可在 #76 runbook 细化 RBAC）。
