# 原生分销外部验收 Runbook

更新日期：2026-06-03

## 1. 适用范围

本 runbook 用于完成本地开发之外的剩余验收项：

- 服务器 compose 网络内 PostgreSQL 快照。
- 短信宝真实通道 smoke。
- 外接控制台与原生模块双跑一个完整结算周期。
- 灰度启用原生分销入口。
- 外接控制台只读归档。

本 runbook 不替代本地单元测试、schema impact、本地恢复库 smoke 或发布审批。任何输出、截图、报告和 commit 都不得包含服务器地址、DSN、账号密码、短信宝凭据、cookie、token、完整手机号或验证码。

## 2. 全局安全规则

- 执行前先确认 `git status --short` 干净，且不会提交 `.codex-local/`、`runtime/`、dump、账号密码或生产 DSN。
- 所有 Docker 命令必须带 `timeout`，不要并发执行 Docker 命令，不要反复轮询 `docker info`、`docker ps`、`docker compose ps`。
- 真实凭据只通过运维批准的密钥管理、服务器环境变量、交互式输入或后台表单填写，不写入 shell history、文档、commit、测试日志或截图。
- 验收记录只写脱敏证据：命令是否通过、HTTP 状态、`success=true/false`、provider code、脱敏手机号、记录 ID、sha256、行数和截图文件名。
- 如果任何步骤需要生产或 staging 写操作，必须先确认回滚路径和执行窗口。

## 3. 服务器快照验收

### 3.1 需要运维提供的信息

- SSH 入口或已授权的服务器 shell。
- compose 文件路径或 compose project 名。
- PostgreSQL 容器名。
- 数据库名和只读/备份用户。
- dump 落盘目录，要求不在仓库 tracked 路径下。

这些值只能在执行现场使用，不写入本仓库文档。

### 3.2 服务器侧快照命令模板

在服务器上执行，按实际 compose/container 信息替换占位符：

```bash
timeout 600s docker compose -p <compose_project> exec -T <postgres_container> \
  pg_dump --format=custom --no-owner --no-privileges \
  --username <db_user> --dbname <db_name> \
  > <server_runtime_dir>/new-api-prod-<yyyymmdd-hhmmss>.dump
```

如果服务器使用独立 PostgreSQL 客户端而不是容器内 `pg_dump`，仍必须保持 `--format=custom --no-owner --no-privileges`，并避免把密码放进命令行。

### 3.3 本地接收与验证

将 dump 复制到 `runtime/prod-pg-snapshots/` 后执行：

```bash
sha256sum runtime/prod-pg-snapshots/<dump_file> > runtime/prod-pg-snapshots/<dump_file>.sha256
sha256sum -c runtime/prod-pg-snapshots/<dump_file>.sha256
/usr/lib/postgresql/18/bin/pg_restore --list runtime/prod-pg-snapshots/<dump_file> >/dev/null
git check-ignore -v runtime/prod-pg-snapshots/<dump_file> runtime/prod-pg-snapshots/<dump_file>.sha256
```

验收证据：

- dump sha256 校验通过。
- `pg_restore --list` 可读。
- dump 和 sha256 被 `.gitignore` 忽略。
- 后续本地恢复库 smoke 通过，并记录核心表行数。

## 4. 短信宝真实通道 Smoke

### 4.1 前置条件

- 短信签名已备案或审核通过，后台签名状态配置为 `approved`。
- 注册、登录、绑定、换绑、重置密码模板至少配置 smoke 需要的场景。
- 短信宝账号、凭据模式、凭据、发送 endpoint、查询 endpoint、专用通道产品 ID 已由管理员在后台填写。
- 使用专用测试手机号，验收记录中只保留脱敏手机号。
- 已配置合理限流窗口和阈值，避免测试发送影响生产用户。

### 4.2 UI Smoke 步骤

推荐优先通过管理员后台页面执行，避免在命令行处理 cookie/token：

1. 登录管理员账号，进入 classic 运营设置 SMS 卡片或 default 系统设置 SMS section。
2. 确认凭据字段不回显既有值，留空保存不会覆盖已有凭据。
3. 查询短信宝状态，页面应显示 provider code、发送条数和剩余条数，不显示账号、凭据、endpoint 或请求 URL。
4. 对专用测试手机号执行一次测试发送，选择已审核通过的场景模板。
5. 确认测试手机号实际收到验证码短信，后台响应不显示完整验证码或短信正文。
6. 连续触发超过限流阈值的测试发送，确认后续请求在 provider 调用前被限流拒绝。

### 4.3 数据库与日志验收

在本地或 staging 数据库查询发送日志时，只允许输出脱敏字段：

```sql
select id, masked_phone, scene, provider, provider_code, status, created_at
from sms_send_logs
order by id desc
limit 5;
```

验收证据：

- `GET /api/option/sms/status` 对真实短信宝配置返回成功或可解释 provider code。
- `POST /api/option/sms/test` 对专用测试手机号返回成功，且测试手机号实际收到短信。
- `sms_send_logs` 只保存脱敏手机号、场景、provider、provider code、状态和时间，不保存完整手机号、验证码、credential、endpoint 或短信正文。
- 限流触发时不调用 provider，且不泄露敏感字段。

## 5. 完整结算周期双跑

### 5.1 前置条件

- 原生规则集已发布，配置与外接控制台当前生效规则一致。
- 测试周期起止时间明确，且覆盖至少一批 paid 消费、退款/负向日志、有效新用户和人头费条件。
- 原生模块和外接控制台都能以只读方式导出同周期统计，导出文件不得进入 Git。

### 5.2 双跑步骤

1. 在原生管理员页面或 API 运行同一周期的 settlement pipeline。
2. 导出或记录原生 KPI snapshot、pending 佣金、人头费事件、draft settlement 的脱敏汇总。
3. 从外接控制台导出同周期汇总，保存在 runtime 或运维指定临时目录。
4. 对比一级/二级分销商维度的有效新用户、paid 净消耗、退款扣回、人头费、佣金和 payable。
5. 对差异逐条归因：规则版本不同、paid/gift/trial 来源缺失、外接控制台历史口径、退款归属、时间边界或数据缺失。
6. 差异归因完成后，冻结原生 settlement；如果业务批准，再标记 paid。

验收证据：

- 双跑周期、规则集版本和外接控制台规则版本明确。
- 原生与外接控制台核心金额差异在业务接受阈值内，或所有超阈值差异都有记录的归因。
- 原生 settlement snapshot 记录 `rule_set_id`、`rule_set_version`、事件数量和事件 ID。
- runtime 导出文件被 `.gitignore` 忽略，不进入 commit。

## 6. 灰度启用

### 6.1 灰度范围

建议灰度顺序：

1. 管理员和内部测试分销商。
2. 少量一级分销商。
3. 一级及其二级下线。
4. 全量 active affiliate profile。

### 6.2 灰度检查

每一批灰度至少验证：

- `/api/affiliate/status` 返回 `available=true` 的用户范围符合预期。
- 普通未开通用户仍返回友好不可用状态。
- scoped logs 不暴露 channel、token、IP、request_id 等不应出现的字段。
- classic `/console/affiliate` 和 default `/affiliate` 均可打开。
- 管理员模块关闭后，普通用户入口降级为不可用状态。

回滚方式：

- 将 `AffiliateEnabled=false`。
- 将异常 profile 置为 `disabled`。
- 如有 settlement 操作异常，先停止新 settlement pipeline，再按事件/结算状态设计回滚，不直接删除历史记录。

## 7. 外接控制台只读归档

归档前置条件：

- 至少一个完整结算周期双跑通过。
- 灰度期没有未归因的高优先级差异。
- 原生分销页面、管理员 profiles、规则集、佣金/结算操作和用户管理 inviter 变更均通过 staging 或生产 smoke。

归档步骤：

1. 外接控制台切只读，保留导出和查询能力。
2. 原生模块作为唯一写入口处理 profile、规则、佣金、结算和 inviter 变更。
3. 保留外接控制台只读观察窗口，记录所有查询和差异反馈。
4. 观察窗口结束后归档外接控制台变更权限和部署入口。

验收证据：

- 外接控制台写操作已关闭或权限撤销。
- 原生模块成为唯一写入口。
- 观察期差异列表为空，或所有差异已关闭。
- 归档决策记录不包含敏感数据。

## 8. 当前未决策/外部验证项

- 真实支付成功、relay 钱包扣费和退款 thin hook 已在本地接入 `user_quota_source_*`，并覆盖 paid top-up、wallet debit/refund、request_id 归因测试；外部验收仍需用真实支付网关回调、真实 relay 调用和退款失败路径确认 sidecar 事件持续写入。日志 `Other` 显式来源仍优先，缺失时按 sidecar 归因；未标记且无 sidecar 的日志仍不会默认当 paid。
- 是否需要超大规模 scoped export。当前已有后端 `/api/affiliate/logs/export` 复用后端 scope 做安全分页导出；如需超过当前安全上限，应设计异步任务或后台导出队列，不能绕过后端 scope。
- 是否启用手机号/SMS 注册登录入口。当前已具备 SMS provider、配置、测试发送、状态查询、限流、发送日志和手机号绑定 sidecar，但没有启用真实手机号注册/登录主链路。
