# 裸金属入口层：Nginx Ingress + MetalLB / NodePort

本文档说明在**没有云负载均衡器**的自建集群里，如何把外部流量引到 new-api worker，并正确支持流式（SSE）与 WebSocket。

对应 issue #74。基础 `deploy/k8s/ingress.yaml` 已由 PR #77（issue #73）交付，本文档只做入口层深化，不重写基础 Ingress 清单。

## 1. 问题：自建集群没有 LoadBalancer

`deploy/k8s/ingress.yaml` 声明了一个 `ingressClassName: nginx` 的 Ingress，但 Ingress 本身只是路由规则，需要两样东西才能真正对外服务：

1. **Ingress Controller**：实际执行转发的组件（本方案用 Nginx Ingress Controller）
2. **让 Controller 可从集群外访问的入口**：云环境靠 `type: LoadBalancer` 自动拿到公网 IP；自建集群没有云 LB，`type: LoadBalancer` 会一直 `<pending>`

本文档解决第 2 点的两条落地路径。

## 2. 安装 Nginx Ingress Controller

```bash
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

安装后 Controller 的 Service 默认是 `type: LoadBalancer`。自建集群需要下面二选一让它拿到可达地址。

## 3. 入口方案对比

| 方案 | 原理 | 优点 | 代价 |
|---|---|---|---|
| MetalLB | 在集群内实现 `type: LoadBalancer`，从指定 IP 池分配可漂移的 VIP，用 ARP/BGP 宣告 | 体验接近云 LB，故障可自动转移 VIP | 需要一段可用的局域网/公网 IP，二层需支持 ARP |
| NodePort + DNS | Ingress Controller 用 `type: NodePort`，把域名解析到多台节点 IP | 零额外组件 | DNS 轮询无健康检查，端口非 80/443 需外层再套一层转发 |

对「多台普通服务器、希望接近云 LB 体验」的部署，推荐 **MetalLB**。

### 3.1 MetalLB（推荐）

安装：

```bash
helm upgrade --install metallb metallb \
  --repo https://metallb.github.io/metallb \
  --namespace metallb-system --create-namespace
```

配置一段可用地址池（把占位地址换成你实际可用的、与节点同网段且未被占用的 IP 范围）：

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: new-api-pool
  namespace: metallb-system
spec:
  addresses:
    - <START_IP>-<END_IP>   # 例如 <LAN-range>，需替换
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: new-api-l2
  namespace: metallb-system
spec:
  ipAddressPools:
    - new-api-pool
```

应用后 Nginx Ingress Controller 的 Service 会从池中拿到一个外部 IP：

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
# EXTERNAL-IP 不再是 <pending>，而是池中的一个地址
```

把域名 A 记录指向该 IP，流量路径：

```
客户端 → 域名(A→MetalLB VIP) → Nginx Ingress Controller → new-api Service(仅 worker) → worker Pod
```

### 3.2 NodePort + DNS（无额外组件）

把 Controller 改成 NodePort：

```bash
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=NodePort \
  --set controller.service.nodePorts.http=30080 \
  --set controller.service.nodePorts.https=30443
```

然后二选一对外暴露：

- 域名多 A 记录解析到各节点 IP（粗分流，无健康检查，节点宕机需手动摘 DNS）
- 在边缘另置一台轻量 Nginx/HAProxy，把 80/443 转发到各节点的 `30080/30443`（这台只做端口转发，压力极小）

NodePort 端口默认在 30000–32767，不能直接用 80/443，因此对外通常还要一层端口映射。

## 4. 流式与 WebSocket

`deploy/k8s/ingress.yaml` 已带以下 annotation（由 #77 交付），确保 SSE 流式与 realtime WebSocket 正常：

```yaml
nginx.ingress.kubernetes.io/proxy-buffering: "off"
nginx.ingress.kubernetes.io/proxy-request-buffering: "off"
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-body-size: "0"
```

要点：

- **流式**：`proxy-buffering: off` 是关键，否则 Nginx 会缓冲整个响应，客户端收不到增量 token 输出。
- **WebSocket**：Nginx Ingress 对 `/v1/realtime` 的 `Upgrade`/`Connection` 头自动处理，无需额外 annotation。长连接依赖上面的长 `proxy-read-timeout`。
- **大请求体**：`proxy-body-size: "0"` 表示入口层不限制，交由应用的 `MAX_REQUEST_BODY_MB` 控制。

## 5. TLS（可选）

需要 HTTPS 时配合 cert-manager 自动签发：

```bash
helm upgrade --install cert-manager cert-manager \
  --repo https://charts.jetstack.io \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true
```

再给 `deploy/k8s/ingress.yaml` 加 `tls` 段与 `cert-manager.io/cluster-issuer` annotation（本 PR 不改基础清单，仅说明路径）。

## 6. 验证

```bash
# 入口拿到外部地址
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Ingress 已绑定后端
kubectl describe ingress new-api

# 流式不被缓冲（应逐块返回，而非一次性返回）
curl -N -H "Authorization: Bearer <token>" \
  -d '{"model":"<model>","messages":[{"role":"user","content":"hi"}],"stream":true}' \
  https://<your-domain>/v1/chat/completions
```

流式正常时 `curl -N` 会看到分块到达的 SSE 数据，而不是等全部完成后一次性输出。

## 7. 入口层检查清单

- [ ] Nginx Ingress Controller 已安装且 Pod Running
- [ ] MetalLB 地址池在可用网段内，或 NodePort + 边缘转发已配置
- [ ] Controller Service 的 EXTERNAL-IP 不为 `<pending>`
- [ ] `deploy/k8s/ingress.yaml` 的占位域名已替换为真实域名
- [ ] `proxy-buffering: off` 生效，流式响应逐块返回
- [ ] WebSocket（realtime）可建立连接
