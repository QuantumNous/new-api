# New API 生产定制说明

## 版本与变更边界

本分支 `custom/production-20260719` 基于官方 New API `v1.0.0-rc.21`，对应提交：

```text
bde9b2f44887d34ec54799ae191d50f97914359e
```

2026-07-19 的生产导出显示，线上 New API 使用官方 Docker 镜像：

```text
calciumion/new-api@sha256:428018a37c0b26c163a3367c18401161707cd0e08d0f26a3dde9ff0caa05e34c
```

当前可确认的定制不是 New API Go 源码内补丁，而是以下部署层适配：

1. `deploy/retry-proxy/gpt56_retry_proxy.py`：Responses API 重试、排队、SSE 转发和上游并发限制。
2. `deploy/systemd/`：生产并发 `800`，进程文件句柄上限 `65536`。
3. `deploy/channel-overrides/` 与 `deploy/sql/`：复现四个生产渠道的完整参数兼容规则。
4. `deploy/env/new-api.env.example`：PostgreSQL 连接池参数模板。

2026-07-20 发布本分支时，原生产服务器的 SSH 端口在认证前连接超时。因此定制文件来自 2026-07-19 的服务器导出，尚未完成发布时刻的在线哈希复核。

## 请求链路

```text
客户端 -> :3000 retry proxy -> :3001 New API -> PostgreSQL / 上游渠道
```

代理只对 `POST /v1/responses` 使用并发信号量。非流式请求遇到 HTTP `500/502/503/504` 或 SSE 内容中的 `response.failed` 会重试。流式请求会短暂缓冲 `response.created`、`response.in_progress` 和心跳；在有效输出开始前遇到 `response.failed` 会重试，一旦输出已经发给客户端则不重放。

`GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD` 都会透明转发，因此后台创建分组、创建用户和修改密码不会因代理缺少 HTTP 方法而返回 501。`/v1/messages` 不进入 Responses 重试逻辑，保持原路径透明转发给 New API。

## 安装代理

```bash
sudo install -d -m 0755 /opt/gpt56-retry-proxy
sudo install -m 0755 deploy/retry-proxy/gpt56_retry_proxy.py \
  /opt/gpt56-retry-proxy/gpt56_retry_proxy.py
sudo install -m 0644 deploy/systemd/gpt56-retry-proxy.service \
  /etc/systemd/system/gpt56-retry-proxy.service
sudo install -d -m 0755 \
  /etc/systemd/system/gpt56-retry-proxy.service.d
sudo install -m 0644 deploy/systemd/gpt56-retry-proxy.service.d/*.conf \
  /etc/systemd/system/gpt56-retry-proxy.service.d/
sudo systemctl daemon-reload
sudo systemctl enable --now gpt56-retry-proxy.service
```

确认最终生效参数：

```bash
systemctl cat gpt56-retry-proxy.service
systemctl show gpt56-retry-proxy.service -p ExecStart -p LimitNOFILE
```

`800` 是代理允许进入 New API 的最大并发，不代表单条上游 Key 一定支持 800 并发。实际吞吐仍受渠道权重、Key 限制、RPM、TPM、New API 连接池和 PostgreSQL 容量约束。

## New API 与 PostgreSQL

从模板创建仅保存在服务器上的环境文件：

```bash
install -m 0600 deploy/env/new-api.env.example deploy/env/new-api.env
```

将 `SQL_DSN` 替换为真实连接串后注入容器。生产连接池值为：

```text
SQL_MAX_OPEN_CONNS=400
SQL_MAX_IDLE_CONNS=100
SQL_MAX_LIFETIME=60
```

不要将填写后的 `deploy/env/new-api.env` 提交到 Git。

## 渠道参数兼容

仓库保存两份脱敏参数配置：

- `azure-gpt-5.6-sol.json`：按模型删除 `temperature`、`top_p`。
- `claude-fable-5.json`：按模型删除 `temperature`、`top_p`、`top_k`；当 `max_tokens < 512` 时提升到 512。

安装脚本按生产渠道名称应用配置：

- `AWS-B`、`0718-OR` 使用 Fable 5 配置。
- `az-ch0718`、`07-19-AZ-COLIN-OF-001` 使用 Azure gpt-5.6-sol 配置。

设置数据库连接串后执行：

```bash
export SQL_DSN='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'
deploy/sql/apply_channel_param_overrides.sh
```

安装脚本需要 `python3` 和 PostgreSQL 客户端 `psql`，不依赖 `jq`。

脚本会在事务中显示修改前后的 `param_override`，然后将目标渠道设置为版本控制中的完整规则。例如 Fable 5 的核心规则为：

```json
{
  "operations": [
    {"path": "temperature", "mode": "delete"},
    {"path": "top_p", "mode": "delete"},
    {"path": "top_k", "mode": "delete"},
    {"path": "max_tokens", "mode": "set", "value": 512}
  ]
}
```

执行前应保存脚本首次 `SELECT` 的结果，以便按原值回滚。该脚本会替换四个目标渠道的 `param_override`，不应直接用于同名但承载其他自定义覆盖的渠道。执行后在后台逐个测试四个渠道。

## 历史问题覆盖矩阵

| 问题 | 处理方式 |
|---|---|
| 后台操作 HTTP 501 | 代理支持并转发全部后台所需 HTTP 方法 |
| Responses HTTP 500/502/503/504 | 有限次数重试和退避 |
| 非流式 `response.failed` | 检测 SSE 错误事件后重试 |
| 流式 `response.created` 后立即失败 | 有效输出前缓冲并重试 |
| `Too many open files` | 关闭代理连接并设置 `LimitNOFILE=65536` |
| gpt-5.6-sol 参数不兼容 | 条件删除 `temperature`、`top_p` |
| Claude Fable 5 参数不兼容/空回 | 删除三个采样参数并设置最小 `max_tokens=512` |
| 401 Token、402 余额、503 无渠道 | 属于凭据、余额或数据库状态，不伪装成源码修复 |

## 验证

```bash
python3 -m py_compile deploy/retry-proxy/gpt56_retry_proxy.py
python3 -m unittest discover -s deploy/tests -v
curl -fsS http://127.0.0.1:3001/api/status
curl -fsS http://127.0.0.1:3000/api/status
```

压力测试应从较低并发逐步增加，并分别统计成功率、HTTP 状态码、TTFT、总耗时、RPM 和 TPM。不要仅凭代理并发值判断稳定容量。

## 回滚

1. 入口切回 New API 的 `3001` 端口，或停用 `gpt56-retry-proxy.service`。
2. 恢复执行 SQL 前保存的目标渠道 `param_override`。
3. 恢复原连接池环境变量并重建 New API 容器。
4. Git 分支可直接重置到基线提交 `bde9b2f44887d34ec54799ae191d50f97914359e`。

## 敏感信息

仓库不得包含 Azure Key、New API Token、数据库密码、SQL DSN、用户数据、渠道数据、SSH 私钥或数据库 dump。真实配置应通过服务器环境文件或密钥管理服务注入。
