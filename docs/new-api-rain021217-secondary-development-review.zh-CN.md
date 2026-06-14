# new-api-rain021217 二开审阅稿

更新日期：2026-06-14

项目路径：`/home/rain/projects/new-api-rain021217`

当前分支：`feature/native-affiliate-minimal`

## 1. 审阅目的

本文用于给外部审阅者快速了解当前 new-api 二开范围、业务目标、实现边界、运行方式、已知风险和后续规划。

本文不包含：

- 生产数据库 DSN、密码、token、cookie。
- 测试账号密码。
- `.codex-local` 下的 secret 文件内容。
- 生产 dump 或服务器连接细节。

如需真实账号 smoke，密码只能从本地 `.codex-local/affiliate-test-accounts.secret.json` 读取，不应复制进文档或聊天。

## 2. 仓库与上游状态

仓库关系：

- 用户 fork：`https://github.com/Rain021217/new-api.git`
- 官方上游：`https://github.com/QuantumNous/new-api.git`
- 本地开发分支：`feature/native-affiliate-minimal`

截至 2026-06-14：

- 当前分支 HEAD：`115a9116 fix: surface published affiliate kpi status`
- 当前 `origin/main`：`7aaa5332 fix(channels): reveal advanced validation errors #5239`
- 当前 `upstream/main`：`1ac0f580 feat(audit): add authentication method tracking in audit logs`
- `upstream/main` 已有新提交，需要合并到二开分支后重新构建验证。

治理原则：

- 官方最新基线优先。
- 二开功能尽量通过 sidecar 表、新 service、新 API 实现。
- 官方核心表和主链路只做薄 hook。
- 每次合并官方前先确保当前改动已提交或妥善暂存。
- 不提交 runtime dump、生产连接信息、账号密码、cookie 或截图大文件。

## 3. 当前二开目标

本轮二开的核心目标是把分销业务、手机号/SMS、邀请归因和相关运营能力纳入 new-api 原生模块，并保持长期可合并官方更新。

主要目标：

- 在 new-api 内提供分销中心和分销管理。
- 支持一级/二级分销商、团队关系树、scoped 使用日志。
- 管理员可维护分销商身份、规则集、KPI、人头费、结算和审计。
- 注册、OAuth、微信、手机号注册都能保留邀请归因。
- 区分 paid/gift/trial/legacy_unknown 等额度来源，佣金只按 paid 净消耗计算。
- 前端同时维护 classic 和 default 两套主题。
- 本地 dev 通过 WSL2 Docker Compose 运行后端、PostgreSQL、Redis，通过 WSL tmux 跑 default/classic dev server。

## 4. 已实现能力概览

### 4.1 分销身份与关系

已实现：

- `affiliate_profiles` 分销商档案。
- 一级/二级分销等级。
- active/disabled 状态。
- 管理员指定、启用、禁用分销商。
- 管理员编辑用户邀请人并记录审计。
- 团队关系树 API：`/api/affiliate/team`。

设计边界：

- 不新增 `users.role` 分销商角色。
- 分销商身份只看 `affiliate_profiles`。
- 分销关系和人工修正必须审计。

### 4.2 分销中心

已实现：

- 分销状态 API。
- 分销看板 summary。
- 14 天趋势。
- 推广关系树。
- scoped 使用日志。
- RMB 主显示。
- 未开通/模块关闭/接口异常的友好降级。

已处理的问题：

- 前端缓存旧 404 时，API 请求加 no-cache。
- 管理员无 profile 时不再把整个分销页渲染为错误。
- KPI 未发布时显示“待配置”，规则发布后显示实际档位或未达标。

### 4.3 分销管理

已实现：

- 分销商列表、筛选、启用/禁用。
- 管理员指定一级/二级分销商。
- 用户 ID 输入辅助展示用户名。
- 规则集草稿、发布、归档、回滚。
- 分佣区间、KPI 档位、人头费、质量门槛、结算配置。
- 分销 finance/settlement 管理。
- JSON 字段逐步表格化，避免裸露 `commission_rules_json` 等内部字段。

仍需优化：

- 继续检查每个字段的 i18n 覆盖。
- 继续提升表单按钮、筛选区、表格密度和移动端体验。
- 大客户、首付激励、降级机制仍处于规划阶段。

### 4.4 佣金、KPI、人头费与结算

已实现：

- 分佣规则集 backend。
- 默认 seed。
- 规则发布不可变。
- KPI 快照。
- 人头费事件。
- 佣金事件。
- 结算单。
- 结算 pipeline。
- job run 游标、失败恢复和部分进度保留。
- 结算 dry-run。
- 事件与结算审计关联。

业务口径：

- 佣金按 paid 来源净消耗计算。
- gift/trial/legacy_unknown 不默认计佣。
- 单用户累计净付费消耗使用累进阶梯。
- KPI 系数最低为 1，更高档位大于 1。
- 5000 元以上用户建议进入大客户独立管控。

### 4.5 手机号/SMS

已实现：

- SMS provider 配置。
- 短信宝接入。
- 发送日志 sidecar。
- 速率限制 sidecar。
- 手机号绑定 sidecar。
- 注册短信验证码。
- 手机号注册。
- 登录短信验证码。
- 手机号登录。
- 短信测试发送。
- 统一 `SMSTemplate` 方案。

治理要求：

- 不输出完整手机号、验证码、ApiKey、短信正文中的验证码。
- 模板、签名、产品名和 provider 参数后台配置，不硬编码。
- 短信签名需遵循供应商审核要求。

### 4.6 微信登录

当前能力：

- 已有验证码式微信登录：`GET /api/oauth/wechat?code=...`。
- 已有微信绑定：`POST /api/oauth/wechat/bind`。
- 用户 openid 写入 `users.wechat_id`。
- 微信首次注册已接入分销邀请归因。

新增规划：

- 参考 `docs/native-wechat-scan-login-plan.zh-CN.md`。
- 目标新增创建二维码、代理二维码图片、轮询扫码状态、扫码成功后自动设置 session。

## 5. 前端范围

classic：

- 使用 React 18、Rsbuild、Semi Design。
- 分销中心入口：`/console/affiliate`。
- 分销管理入口：`/console/affiliate/admin`。
- 现阶段 classic 是主要验收界面之一。

default：

- 使用 React 19、TypeScript、Base UI、Tailwind。
- 分销中心入口：`/affiliate/`。
- 分销管理入口：`/affiliate/admin`。
- 新文案必须走 i18n。
- 不把 classic 的 Semi 组件复制到 default。

dev server：

- default：`http://127.0.0.1:5173/`
- classic：`http://127.0.0.1:5174/`
- 后端 API：`http://127.0.0.1:3000`
- `3000` 根页显示 `use frontend dev server` 是 dev 镜像预期行为。

## 6. 本地运行方式

后端容器：

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
```

前端 dev server：

```bash
./scripts/dev-web-tmux.sh
```

运行态验证：

```bash
curl -i http://127.0.0.1:3000/api/status
curl -i http://127.0.0.1:5173/api/affiliate/team
curl -i http://127.0.0.1:5174/api/affiliate/team
```

未登录访问 `/api/affiliate/team` 应返回 401，不应返回旧的 `Invalid URL` 404。

## 7. 数据与安全边界

本地 dev 使用：

- WSL2 Docker Compose。
- 本地 PostgreSQL 容器。
- 本地 Redis 容器。
- 已下载并校验的本地生产快照副本，存放于 Git 忽略目录。

禁止：

- 把 `.codex-local/sources.yml` 内容写入文档、commit、日志或聊天。
- 把生产 dump 提交或分享。
- 输出测试账号密码、cookie、token、完整手机号。
- 用生产 DSN 直接作为 compose 环境变量。

## 8. 业务口径与待审阅点

建议重点审阅：

- 分销商是否应在起步阶段启用自动降级。当前建议是不默认启用，只预留策略。
- 5000 元以上大客户是否应脱离自动分佣体系。当前建议是进入大客户候选池，超过阈值部分人工审批。
- 大额首次付费是否应增加一次性激励。当前建议采纳，但作为独立“首付激励”事件，不提高长期分佣比例。
- KPI 档位、人头费、质量门槛是否符合运营预期。
- 分销商端是否应显示更多规则摘要，还是仅显示当前档位和收益解释。
- 手机号/SMS 是否只保留短信宝，还是预留多 provider。
- 微信扫码登录是否强制 2FA。

## 9. 已知风险

- 官方上游持续更新，classic/default 前端、表格组件、审计日志和登录注册页面可能冲突。
- 当前分销功能已跨后端、classic、default、docs、ops，多文件合并需要谨慎。
- 分销规则配置仍较复杂，前端表格化与 i18n 需要继续打磨。
- 结算与大客户人工审批会影响财务口径，不能只做页面展示。
- 微信扫码登录依赖外部微信服务真实能力，本地只能 mock，最终需要真实公众号联调。
- 短信宝生产模板、签名审核状态会影响真实可用性。

## 10. 下一阶段建议

优先级建议：

1. 同步官方 `upstream/main` 并修复冲突。
2. 重建 WSL2 dev 容器和前端 dev server。
3. 完成微信扫码登录后端最小闭环和 mock 测试。
4. 接入 default/classic 扫码登录 UI。
5. 继续修复分销管理字段 i18n、筛选布局和表格体验。
6. 设计大额首次付费一次性激励和大客户独立管控 sidecar。
7. 产出生产 cutover 前的验收清单。

