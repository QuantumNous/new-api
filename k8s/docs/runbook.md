# 部署验证 Runbook 与故障演练

本文档是 Kubernetes 部署的端到端验证清单与故障演练手册，把前置各文档的产物串成一条可复现流程。

对应 issue #76。部署步骤见 `k8s/README.md`（由 PR #77 交付），本文档只做验证与演练深化，不重复部署步骤。

前置文档：

| 文档 | 内容 |
|---|---|
| `k8s/README.md` | 角色划分、Secret 清单、部署顺序 |
| `k8s/docs/runtime-constraints.md` | 多副本运行约束与环境变量矩阵 |
| `k8s/docs/secrets-and-deploy.md` | 凭证盲部署与 runner 可达性 |
| `k8s/docs/data-layer.md` | 数据层高可用、备份恢复 |
| `k8s/docs/ingress-baremetal.md` | 裸金属入口层 |
| `k8s/docs/cache-strategy.md` | 多副本缓存策略 |

## 1. 部署前检查

- [ ] 集群所有节点 `Ready`：`kubectl get nodes`
- [ ] StorageClass 可用且支持所需访问模式：`kubectl get storageclass`
- [ ] Nginx Ingress Controller 已安装且 Pod Running
- [ ] 入口已有外部地址（MetalLB VIP 或 NodePort + 边缘转发）
- [ ] 9 个 GitHub Actions Secrets 已配置（清单见 `k8s/docs/secrets-and-deploy.md`）
- [ ] `k8s/ingress.yaml` 的占位域名已替换为真实域名
- [ ] `SQL_DSN` 指向 PostgreSQL/MySQL，不是 SQLite

## 2. 部署后逐层验证

### 2.1 数据层

```bash
kubectl get statefulset postgres redis
kubectl get pvc
kubectl exec statefulset/postgres -- pg_isready
```

预期：两个 StatefulSet `READY 1/1`，PVC 状态 `Bound`，`pg_isready` 返回 accepting connections。

### 2.2 应用层角色划分

```bash
kubectl get pods -l app=new-api -o wide
```

预期：

- `new-api-master-*` 恰好 1 个 Running
- `new-api-worker-*` N 个 Running，且尽量分布在不同 `NODE`（由 `podAntiAffinity` 实现）

确认 master 未被 Service 选中：

```bash
kubectl get endpoints new-api -o jsonpath='{.subsets[*].addresses[*].targetRef.name}'
```

预期：只出现 `new-api-worker-*`，不出现 `new-api-master-*`。这是「master 不接外部流量」的直接证据。

### 2.3 环境变量注入

```bash
kubectl exec deploy/new-api-worker -- printenv NODE_TYPE NODE_NAME
kubectl exec deploy/new-api-master -- printenv NODE_NAME
```

预期：worker 的 `NODE_TYPE=slave`；master 无 `NODE_TYPE`（命令对该变量返回非零）；两者 `NODE_NAME` 均为各自 Pod 名称且互不相同。

> 不要 `printenv SQL_DSN` 之类的凭证变量，避免把明文打到终端与日志。

### 2.4 实例上报

```bash
kubectl exec deploy/new-api-master -- wget -qO- http://localhost:3000/api/status
```

预期返回 JSON 且 `success` 为 true。管理员登录面板后，「系统信息 → 实例」应能看到所有 Pod（依据：`service/system_instance.go` 每 30 秒 upsert 一次，`model.SystemInstanceStaleAfterSeconds` 为 90 秒）。

### 2.5 入口与流式

```bash
# 非流式
curl -s -o /dev/null -w '%{http_code}\n' https://<your-domain>/api/status

# 流式：应逐块到达，而非一次性返回
curl -N -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"model":"<model>","messages":[{"role":"user","content":"hi"}],"stream":true}' \
  https://<your-domain>/v1/chat/completions
```

预期：`/api/status` 返回 200；流式请求能看到分块 SSE 输出。若一次性返回，检查 `proxy-buffering: off` 是否生效。

### 2.6 流量确实分散到多个 worker

连续发起若干请求后，分别查看各 worker 日志：

```bash
for p in $(kubectl get pods -l app=new-api,role=worker -o name); do
  echo "=== $p ==="
  kubectl logs "$p" --tail=20 | grep -c "relay" || true
done
```

预期：多个 worker 都有请求记录，而不是集中在同一个。这是负载均摊生效的证据。

> 注意：不要用数据库里的 `NodeName` 字段判断请求分发。该字段只记录任务发起节点，不是请求路由记录。

## 3. 扩缩容验证

```bash
kubectl scale deployment new-api-worker --replicas=5
kubectl rollout status deployment/new-api-worker --timeout=180s
kubectl get pods -l role=worker -o wide
```

预期：新 Pod 逐个 Running 并被加入 Service Endpoint；扩容期间已有请求不中断（`maxUnavailable: 0`）。

缩容：

```bash
kubectl scale deployment new-api-worker --replicas=3
```

缩容前确认无长连接正在该 Pod 上传输大响应，否则客户端会看到连接中断。

## 4. 故障演练

每项演练前记录基线状态，演练后确认恢复。

### 4.1 worker Pod 故障

```bash
kubectl delete pod -l app=new-api,role=worker --wait=false
kubectl get pods -l role=worker -w
```

预期：被删 Pod 进入 Terminating，新 Pod 自动创建并 Running；期间其余 worker 继续服务，入口不中断。

### 4.2 master Pod 故障

```bash
kubectl delete pod -l app=new-api,role=master --wait=false
kubectl get pods -l role=master -w
```

预期：新 master Pod 起来后重新启动系统任务 Runner；异步任务（视频/Suno/MJ）轮询恢复。因为 `strategy: Recreate` 且副本数 1，短暂空窗期内后台任务暂停，不影响 relay 请求。

未完成任务不会丢失：任务状态存于数据库，轮询恢复后继续推进（依据：`service/task_polling.go` 从数据库读取未完成任务）。

### 4.3 Redis 故障

```bash
kubectl delete pod -l app=redis --wait=false
```

预期：Redis 重启期间会话校验回源数据库，功能可用但数据库压力上升、限流退化为各副本本地内存（依据：`k8s/docs/runtime-constraints.md` 第 1 节）。Redis 恢复后缓存冷启动。

### 4.4 PostgreSQL 故障

```bash
kubectl delete pod -l app=postgres --wait=false
```

预期：**这是最严重的故障**。PG 不可用期间鉴权与计费无法完成，relay 请求失败。Pod 重新调度并挂载 PVC 后恢复。

若使用本地存储 provisioner，节点宕机时 PVC 无法在其他节点挂载，必须等节点恢复——这正是 `k8s/docs/data-layer.md` 建议升级到 CloudNativePG 的原因。

### 4.5 节点故障

```bash
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
```

预期：该节点上的 worker Pod 被驱逐并在其他节点重建；若 PG Pod 在该节点且用本地存储，PG 将无法重建，需 `kubectl uncordon <node>` 恢复。

演练结束务必恢复：

```bash
kubectl uncordon <node>
```

## 5. 滚动更新验证

```bash
kubectl set image deployment/new-api-worker new-api=calciumion/new-api:<new-tag>
kubectl rollout status deployment/new-api-worker
```

预期：`maxUnavailable: 0` + `maxSurge: 1` 逐个替换，期间服务不中断。

回滚：

```bash
kubectl rollout undo deployment/new-api-worker
```

## 6. 备份恢复演练

按 `k8s/docs/data-layer.md` 的备份与恢复流程，至少完整演练一次：

- [ ] 执行一次 `pg_dump` 备份并确认文件非空
- [ ] 在非生产环境导入该备份，确认数据完整
- [ ] 确认恢复前已把 new-api 副本缩容到 0

## 7. 最终验收清单

- [ ] master 1 副本、worker N 副本均 Running，worker 分布在多个节点
- [ ] Service Endpoint 只含 worker
- [ ] worker `NODE_TYPE=slave`，master 无该变量，`NODE_NAME` 各自唯一
- [ ] 面板实例列表能看到所有 Pod
- [ ] 入口非流式返回 200，流式逐块返回
- [ ] 多个 worker 都有请求记录（流量已分散）
- [ ] 扩缩容与滚动更新期间服务不中断
- [ ] worker/master/Redis 故障均可自愈，PG 故障影响范围已知
- [ ] 备份恢复流程已完整演练一次

## 8. 已知局限

- 本 runbook 的命令未在真实集群执行过，属待执行清单而非已通过的验证记录。首次部署时应逐项执行并记录实际输出。
- `/api/status` 返回站点配置，不代表数据库连通性（依据：`k8s/docs/runtime-constraints.md` 第 4 节），因此探针通过不等于数据层健康。
- 单副本 PG/Redis 的故障恢复时间取决于存储与调度，未在本文档给出 SLA 数字。
