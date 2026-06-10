# New API 监控体系 (Prometheus + Grafana + AlertManager → 飞书)

## 架构概览

```
New API (Go) ──metrics──> Exporter (.py) ──scrape──> Prometheus ──query──> Grafana
                                     │                       │
                                     ▼                       ▼
                               (HTTP /metrics)          AlertManager
                                                              │
                                                              ▼
                                                         Feishu Relay
                                                              │
                                                              ▼
                                                          飞书群
```

## 服务清单

| 服务 | 端口 | 说明 |
|------|------|------|
| `exporter` | 9099 | Python Exporter：从 New API 采集指标后暴露 `/metrics` |
| `prometheus` | 9090 | Prometheus：时序数据库 + 告警引擎 |
| `alertmanager` | 9093 | AlertManager：告警分组、抑制、路由到飞书 |
| `feishu-relay` | 9098 | AlertManager Webhook → 飞书卡片转换 |
| `grafana` | 3003 | Grafana：可视化仪表盘 |
| `report` | — | 定时报表：从 Prometheus 查询后发送飞书卡片 |

## 快速启动

### 1. 配置飞书 Webhook

编辑 `docker-compose.yml`，替换飞书 Webhook URL：

```yaml
feishu-relay:
  environment:
    - FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/你的机器人hook地址

report:
  environment:
    - FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/你的机器人hook地址
```

### 2. 配置管理员账号

编辑 `docker-compose.yml` 中的 exporter 环境变量：

```yaml
exporter:
  environment:
    - NEW_API_ADMIN_USER=你的管理员用户名
    - NEW_API_ADMIN_PASS=你的管理员密码
```

### 3. 启动

```bash
cd monitoring
docker compose up -d
```

### 4. 访问

| 面板 | 地址 | 账号/密码 |
|------|------|-----------|
| Grafana | http://localhost:3003 | admin / newapi123 |
| Prometheus | http://localhost:9090 | —（无认证） |
| Exporter Metrics | http://localhost:9099/metrics | — |

---

## 场景一：内部 Agent（员梦）走中转

**目标**：员梦的 AGENT 都通过中转站调用，避免研发环境直接影响生产，保证生产稳定性。

### 配置步骤

1. **在 New API 管理后台创建专用 Token**：
   - 创建一个 Token，设置 `group=internal`
   - 分配适当的模型权限和额度

2. **员梦 Agent 配置**：
   ```bash
   # 将 Agent 的 API Base URL 指向中转站
   export OPENAI_BASE_URL=http://你的中转站地址:3002/v1
   # 使用刚刚创建的 internal Token
   export OPENAI_API_KEY=中转站分配的Token
   ```

3. **监控分组**：
   - `internal` 组会被 Prometheus 自动采集（通过 `NEW_API_GROUP_LIST=internal,personal`）
   - Grafana 面板 "Group Usage Breakdown" 会展示 internal vs personal 的占比
   - 当 internal 组额度 > 500万时会触发告警推送到飞书

4. **环境隔离**：
   - 研发环境 Agent 用 `group=internal-dev` 的 Token
   - 生产环境 Agent 用 `group=internal-prod` 的 Token
   - 在 `docker-compose.yml` 中将分组列表设为：`NEW_API_GROUP_LIST=internal-dev,internal-prod,personal`

---

## 场景二：个人账号接入中转站个人使用

**目标**：支持个人拿个人账号接入中转站，中转站只做统计，统计结果自动发布飞书群。

### 配置步骤

1. **个人用户注册/创建 Token**：
   - 在 New API 管理后台为用户创建账号
   - 为每个用户创建 Token，设置 `group=personal`
   - 分配额度（用于统计限制）

2. **用户接入**：
   ```bash
   # 用户配置自己的客户端指向中转站
   export OPENAI_BASE_URL=http://你的中转站地址:3002/v1
   export OPENAI_API_KEY=个人Token
   ```

3. **统计查看**：
   - 每个用户的 Token 消耗、RPM 会被采集为 Prometheus 指标
   - Grafana "User Quota Usage" 表格展示所有用户的使用排行
   - 定时报表会推送到飞书群，包含 Top 10 用户排行
   - "Quota Usage by User (Trend)" 面板展示每个用户的用量趋势

4. **统计飞书自动发布**：
   - `report` 服务定时（默认 60 分钟）从 Prometheus 查询数据
   - 自动生成飞书卡片推送到群
   - 卡片包含：服务状态、全局 Token 消耗、实时流量、模型性能、用户用量排行

---

## 配置参考

### Exporter 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NEW_API_BASE` | `http://host.docker.internal:3002` | New API 地址 |
| `SCRAPE_INTERVAL` | `30` | 采集间隔（秒） |
| `NEW_API_ADMIN_USER` | — | 管理员用户名（必填） |
| `NEW_API_ADMIN_PASS` | — | 管理员密码（必填） |
| `NEW_API_USER_LIST` | `""` | 要监控的用户名列表（逗号分隔，为空则自动检测） |
| `NEW_API_GROUP_LIST` | `internal,personal` | 要监控的分组列表（逗号分隔） |

### Report 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PROMETHEUS_URL` | `http://prometheus:9090` | Prometheus 地址 |
| `FEISHU_WEBHOOK` | — | 飞书机器人 Webhook URL（必填） |
| `REPORT_INTERVAL` | `60` | 发送间隔（分钟） |

---

## Prometheus 指标说明

| 指标名 | 维度 | 说明 |
|--------|------|------|
| `newapi_up` | instance | 服务可用性 (1=正常, 0=异常) |
| `newapi_rpm` / `newapi_tpm` | instance | 全局请求/Token 速率 |
| `newapi_token_consumed` | instance | 累计 Token 消耗 |
| `newapi_quota_used_total` | instance | 全局已用额度 |
| `newapi_user_quota_used` | username | **按用户**的已用额度 |
| `newapi_user_rpm` | username | **按用户**的请求速率 |
| `newapi_user_tpm` | username | **按用户**的 Token 速率 |
| `newapi_group_quota_used` | group | **按分组**的已用额度 |
| `newapi_group_rpm` / `newapi_group_tpm` | group | **按分组**的速率 |
| `newapi_model_latency_ms` | model | 模型延迟 |
| `newapi_model_success_rate` | model | 模型成功率 |
| `newapi_model_tps` | model | 模型吞吐 |

---

## 目录结构

```
monitoring/
├── docker-compose.yml          # 所有服务编排
├── prometheus.yml              # Prometheus 配置
├── alerts.yml                  # 告警规则
├── alertmanager.yml            # AlertManager 配置
├── exporter.py                 # Prometheus Exporter
├── report.py                   # 飞书定时报表
├── feishu-relay.py            # Alert → 飞书转发
├── grafana-dashboard.json     # Grafana 仪表盘
├── grafana-datasources.yml    # Grafana 数据源
├── grafana-dashboards.yml     # Grafana Dashboard 配置
├── Dockerfile.exporter        # Exporter 镜像
├── Dockerfile.relay           # Feishu Relay 镜像
├── Dockerfile.report          # Report 镜像
├── templates/
│   └── feishu.tmpl            # AlertManager 飞书模板
├── .env.example               # 环境变量示例
└── README.md                  # 本文件
```

## 故障排查

1. **Exporter 无数据**：检查管理账号密码是否正确，访问 http://localhost:9099/metrics 确认有输出
2. **飞书收不到告警**：检查 `FEISHU_WEBHOOK` 是否正确，查看 `newapi-feishu-relay` 容器日志
3. **Grafana 无面板**：检查 `grafana-dashboard.json` 是否挂载正确，重新启动 Grafana 容器
4. **用户指标为空**：确认有用户产生过 API 调用（数据库中有 log 记录），或指定 `NEW_API_USER_LIST` 环境变量
