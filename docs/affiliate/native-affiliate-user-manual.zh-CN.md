# 原生分销中心与分销管理平台使用手册

更新日期：2026-06-04

适用项目：`/home/rain/projects/new-api-rain021217`

适用分支：`feature/native-affiliate-minimal`

## 1. 文档范围

本文面向运营、财务、管理员、超级管理员、一级分销商、二级分销商和后续开发接手人员，说明原生分销模块的使用方式、规则含义、测试数据、常见问题和运维注意事项。

本文覆盖：

- 分销商端“分销中心”的入口、指标、关系树、日志、佣金和结算。
- 管理员端“分销管理”的分销商身份、规则集、分佣、人头费、KPI、风控和结算。
- 当前默认规则口径和字段解释。
- 本地 dev 环境、测试账号和合成测试数据的使用方式。
- 生产发布、缓存、端口和常见故障排查。

本文不包含真实密码、生产 DSN、cookie、token、完整手机号、服务器地址或支付凭据。涉及本地账号密码的内容只引用 `.codex-local` 下的 secret 文件路径，不在文档中展开。

## 2. 入口与角色

### 2.1 页面入口

classic 前端：

- 分销中心：`http://127.0.0.1:5174/console/affiliate`
- 分销管理：`http://127.0.0.1:5174/console/affiliate/admin`

default 前端：

- 分销中心：`http://127.0.0.1:5173/affiliate/`
- 分销管理：`http://127.0.0.1:5173/affiliate/admin`

本地 dev 后端：

- API 后端：`http://127.0.0.1:3000`
- `3000` 根页面显示 `use frontend dev server` 是预期行为。dev 模式前端页面由 `5173` 和 `5174` 的 Rsbuild dev server 提供。

### 2.2 角色说明

普通用户：

- 没有 active 分销 profile 时不能查看分销中心业务数据。
- 如果分销模块关闭或账号未开通，页面展示友好提示。

一级分销商：

- 可查看自己直接邀请用户、名下二级分销商，以及二级分销商的下线。
- 当前 scope 最大深度为 2。
- 可查看自己 scope 内的团队树、使用日志、佣金事件和结算记录。

二级分销商：

- 可查看自己的直接下线。
- 不能越权查看一级上级的其他团队成员。

管理员和超级管理员：

- 可进入分销管理页面。
- 可全局查看分销商、规则集、分佣事件、结算、用户邀请关系。
- 可指定或禁用分销商身份，发布或归档规则集，发起结算和调整。

## 3. 启用前置条件

分销中心正常显示需要满足：

- 系统设置中 `AffiliateEnabled` 已开启。
- 当前用户已登录。
- 分销商用户存在 `affiliate_profiles` active 记录。
- 管理员已发布至少一个 `published` 规则集。
- 后端部署包含 `/api/affiliate/*` 路由。
- 前端 dev 模式下 `5173` / `5174` 正常代理 `/api` 到 `3000`。

如果未登录访问：

- `/api/affiliate/team` 应返回 401。
- 不应返回 `Invalid URL (GET /api/affiliate/team)`。

如果浏览器仍显示 `/api/affiliate/team` 404：

- 优先检查浏览器 Network 是否命中旧缓存。
- 在 DevTools 勾选 Disable cache 后硬刷新。
- 确认浏览器访问的是当前 WSL 的 `5173` 或 `5174` dev server。
- 确认 `3000` 是本地 `new-api:dev` 容器，不是旧服务或官方 latest 镜像。

## 4. 分销中心使用说明

### 4.1 页面结构

分销中心主要包含：

- 顶部状态区：显示当前账号是否有分销 scope。
- 指标看板：展示团队、有效新增、净消耗、预估佣金、人头费、待结算和 KPI 档。
- 趋势图：展示按日聚合的有效新增、净消耗和佣金相关走势。
- 团队关系树：展示当前 scope 内的一级、二级和下线关系。
- scoped 使用日志：只展示当前分销商可见团队内的消耗日志。
- 佣金事件：展示当前分销商相关分佣事件。
- 结算记录：展示当前分销商相关结算单。

### 4.2 核心指标解释

团队人数：

- 当前分销商可见 scope 内的用户数量。
- 一级分销商通常包含直接下线、二级分销商和二级下线。
- 二级分销商通常只包含自己的直接下线。

有效新增用户：

- 由已发布规则集中的人头费规则决定。
- 默认口径要求邀请来源为 affiliate，并在资格窗口内有 paid 来源净消耗。
- 默认 seed 中首笔 paid 消耗至少 10 元，周期净 paid 消耗至少 10 元，资格窗口 14 天。
- 异常、退款、纯赠金或未标记 paid 来源的用户不会计为有效新增。

净消耗：

- 只统计 paid 来源消耗。
- gift、trial、legacy_unknown 不默认计佣。
- 退款会抵扣净消耗。
- 页面主显示单位为 RMB。

预估佣金：

- 根据分佣规则、单用户累计净 paid 区间、KPI 系数和 cap 计算。
- 后端会记录规则集版本，历史结算不应被当前规则变更自动改写。

人头费：

- 针对达到有效用户规则的邀请事件发放。
- 金额由人头费规则按分销等级和 KPI 档位配置。
- 观察档默认可配置为 0，人头费可能为 0 是正常规则结果。

待结算：

- 来自结算单或可结算事件的汇总。
- 结算状态、冻结期、最小结算金额和支付标记由管理员端结算配置和操作决定。

KPI 档：

- 根据已发布规则集中的 KPI 档位实时匹配。
- 常见档位包括观察档、合格档、增长档、卓越档。
- 如果规则已发布但用户没有通过任何 KPI 档的门槛，应显示“未达标”。
- 如果没有已发布规则集，才显示“待配置”或“等待管理员发布分销规则”。

### 4.3 团队关系树

团队关系树用于核对：

- 下线是否归属到正确分销商。
- 二级分销商是否挂在正确一级分销商下面。
- 分销商状态是否 active。
- scope 是否越权或少查。

常见情况：

- 一级分销商看到团队 total 大于二级分销商。
- 二级分销商只看到自己的下线。
- 管理员全局视角可能看到全局或管理聚合数据。

### 4.4 scoped 使用日志

分销 scoped 使用日志与系统使用日志不同：

- 只展示当前分销 scope 内的用户。
- 不允许通过前端传任意 user_id 越权查询。
- CSV 导出会脱敏敏感字段，不应暴露 channel、token、IP、request id 或 upstream request id。
- 金额主显示 RMB，原始 quota 只作为辅助字段或导出附加信息。

### 4.5 分销商端常见提示

未开通分销：

- 说明当前账号没有 active 分销 profile。
- 需要管理员在分销管理中指定为一级或二级分销商。

分销模块未开启：

- 说明 `AffiliateEnabled` 关闭。
- 需要管理员在系统配置中开启。

等待管理员发布分销规则：

- 表示没有匹配到已发布规则集。
- 如果管理员确认已发布规则但仍显示该文案，应检查后端是否已重建、浏览器是否旧缓存、API 是否打到当前容器。

未达标：

- 表示规则已发布，但当前有效新增、净 paid 消耗、赠金比例、异常比例或二次付费比例没有通过任何 KPI 档。
- 这是业务状态，不是系统错误。

## 5. 分销管理使用说明

### 5.1 分销商身份管理

管理员可指定：

- 一级分销商。
- 二级分销商。

创建或更新分销 profile 时需要关注：

- 用户 ID：目标用户的系统用户 ID。
- 用户名：前端应辅助显示，避免输错 ID。
- 分销等级：一级或二级。
- 上级用户 ID：二级分销商必须填写 active 一级分销商作为上级。
- 邀请码：用于分销邀请归因。
- 状态：active 表示启用，disabled 表示禁用。

注意：

- 不向 `users.role` 新增分销商角色。
- 分销身份来自 `affiliate_profiles.status=active`。
- 二级分销商不能把自己作为上级。
- 二级分销商上级必须是 active 一级分销商。
- 禁用分销商不等于删除历史结算、历史佣金和审计记录。

### 5.2 分销商列表

列表可用于：

- 按用户 ID 筛选。
- 按分销等级筛选。
- 按状态筛选。
- 查看邀请关系、邀请码、更新时间和操作入口。

建议运营核对：

- 一级分销商 parent 是否为空。
- 二级分销商 parent 是否指向正确一级分销商。
- 禁用操作是否符合业务流程。
- 状态标签是否清晰可读。

### 5.3 用户邀请关系管理

用户管理中可支持修改邀请人：

- 先预览变更影响。
- 再执行更新。
- 后端记录审计日志。

适用场景：

- 用户注册时未携带邀请码，需要人工归属。
- 历史邀请关系错误，需要修正。
- 分销商线下导入用户，需要补归属。

不建议直接改数据库：

- 直接改数据库容易破坏关系闭包、审计和历史结算口径。
- 应使用管理员 API 或前端操作入口。

## 6. 规则集管理

### 6.1 规则集生命周期

规则集状态：

- draft：草稿，可编辑。
- published：已发布，参与分销商端 KPI、佣金、人头费和结算计算。
- archived：已归档，不再作为当前规则使用。

推荐流程：

1. 使用默认种子创建草稿。
2. 在可视化表格中修改分佣、KPI、人头费、风控和结算配置。
3. 保存规则草稿。
4. 预览变更。
5. 发布规则集。
6. 新周期按已发布规则计算。

注意：

- 已发布规则不应直接编辑。
- 需要修改时应复制或回滚为新草稿，发布新版本。
- 规则集需要记录版本、名称、生效时间、发布人、发布时间和原因。
- 历史结算应绑定当时规则集版本，不随当前规则变化自动改变。

### 6.2 分佣规则

分佣规则按分销等级配置：

- 一级默认分佣比例。
- 一级封顶比例。
- 二级默认分佣比例。
- 二级封顶比例。
- 最小结算金额。
- 是否允许人工审核比例。

分佣不是按充值金额直接计算，而是按下线用户实际 paid 消耗计算。

### 6.3 分佣区间

分佣区间按单用户累计净 paid 消耗金额划分。

默认 seed 示例：

- 0 到 200 元。
- 200 到 800 元。
- 800 到 1500 元。
- 1500 到 5000 元。
- 5000 元以上。

字段说明：

- 最小净付费：区间起点。
- 最大净付费：区间终点。
- 基准比例：该区间默认分佣比例。
- 封顶比例：允许达到的最高比例。
- 需要人工审核：该区间是否需要人工确认。

重要说明：

- `max_net_paid_amount_cents=0` 在最后一档表示“无上限/不限”。
- 前端应显示“0 表示不限”，避免误解为最大值 0 元。
- 第 5 档“最大净付费”为 0 是设计口径，不是 bug。

### 6.4 KPI 档位

KPI 档位用于给分销商计算系数。

常见字段：

- 档位编码：如 observe、qualified、growth、excellent。
- 档位名称：可显示为观察档、合格档、增长档、卓越档。
- 分销等级：一级或二级。
- 最小有效新增用户数。
- 最小净 paid 消耗金额。
- KPI 系数。
- 最大纯赠金用户占比。
- 最大异常用户占比。
- 最小二次付费用户占比。
- 排序。

编码和名称原则：

- 编码用于规则引用，尤其是人头费规则按 KPI 档位选择。
- 名称用于前端展示，可按运营需要本地化。
- 编码可以自定义，但发布后不建议随意改，因为人头费规则会引用该编码。
- 如果改编码，需要同步修改人头费规则中的 KPI 档位选择。

### 6.5 人头费规则

人头费规则按分销等级和 KPI 档位配置。

常见字段：

- 分销等级。
- KPI 档位编码。
- 状态。
- 人头费金额。
- 首笔 paid 消耗门槛。
- 周期净 paid 消耗门槛。
- 资格天数。
- 解锁延迟天数。

使用方式：

- 先定义 KPI 档位。
- 人头费规则选择对应 KPI 档位编码。
- 某分销商匹配到某 KPI 档后，再用对应人头费规则计算金额。

### 6.6 风控规则

风控规则用于控制刷量和异常质量。

常见字段：

- 最大纯赠金用户占比。
- 最大异常用户占比。
- 最大退款占比。
- 最小二次付费占比。
- 自刷策略。
- 批量滥用策略。
- 处理动作。

运营解释：

- 纯赠金占比过高说明团队消耗可能没有真实 paid 价值。
- 异常用户占比过高可能说明刷量或滥用。
- 退款占比过高会影响净 paid 结果。
- 二次付费占比可反映用户质量。

### 6.7 结算配置

常见字段：

- 结算周期。
- 冻结天数。
- 最小结算金额。
- 是否人工审核。
- 是否自动结算。
- 审核备注。

当前默认周期字段可能为 `monthly`。运营展示时应显示中文说明，例如“按月”或“30 天周期”。如后续需要更灵活配置，可以把周期单位改为“天”并由管理员输入周期天数。

## 7. 佣金与结算管理

### 7.1 佣金事件

佣金事件记录每笔可计佣消耗或调整。

常见类型：

- accrual：正常计提。
- clawback：退款或扣回。
- manual_adjustment：人工调整。

常见状态：

- pending：待处理。
- ready：可结算。
- settled：已结算。
- void：已作废。

管理员可操作：

- 按分销商、下线、状态、规则集筛选。
- 重算佣金。
- 创建人工调整。
- 作废错误佣金事件。

### 7.2 结算单

结算单聚合某分销商在一个周期内的佣金和人头费。

常见状态：

- draft：草稿。
- frozen：冻结中。
- paid：已支付。
- void：已作废。

管理员可操作：

- 生成结算。
- 执行完整结算流水线。
- 冻结结算。
- 标记支付。
- 作废结算。

注意：

- 标记支付需要记录支付参考号。
- 作废结算应同步处理关联佣金事件状态。
- 生产执行前应先 dry run 或在 staging 验证。

## 8. 默认规则口径摘要

默认 seed 只是初始业务口径，可由管理员后续调整。

一级分销商：

- 默认分佣可高于二级。
- KPI 常见档位：观察档、合格档、增长档、卓越档。
- 卓越档默认要求更高有效新增、净 paid 消耗和二次付费质量。

二级分销商：

- 默认分佣低于一级。
- KPI 档位也可独立配置。
- 人头费金额可独立低于一级。

有效用户：

- 必须来自 affiliate invite。
- 必须在资格窗口内形成 paid 消耗。
- 默认首笔 paid 消耗和周期净 paid 消耗门槛均为 10 元。
- 异常、退款、纯赠金不计有效。

paid/gift/trial：

- paid 来源可计佣。
- gift 和 trial 不计佣。
- mixed source 日志只按 paid 部分计佣。
- 未标记且没有 sidecar 账本的旧日志不默认当 paid。

## 9. 本地测试数据

### 9.1 真实测试账号

本地真实测试账号信息在：

- `.codex-local/affiliate-test-accounts.secret.json`

使用原则：

- 可由本地脚本读取。
- 不输出密码。
- 不提交到 Git。
- 不复制到文档或聊天记录。

当前常用账号标签：

- super_admin：超级管理员。
- level_1_affiliate：一级分销商，当前用于 ChengyuWang0807 验证。
- level_2_affiliate：二级分销商。

### 9.2 合成测试数据

本地合成测试脚本在：

- `.codex-local/seed-affiliate-demo-data.py`

脚本输出账号清单在：

- `.codex-local/affiliate-demo-accounts.secret.json`

脚本特征：

- 只用于本地 dev PostgreSQL。
- 使用 `synthetic_affiliate_test` 标记。
- 清理并重建 `aff_demo_*` 合成用户。
- 不提交 `.codex-local` 文件。
- 生成一级、二级、下线、邀请事件、关系、日志、KPI 快照、佣金事件、人头费事件和结算单。

当前已生成规模：

- 236 个合成用户。
- 28 个合成分销 profile。
- 369 条合成关系。
- 231 条 invite event。
- 279 条 logs。
- 29 条 KPI snapshot。
- 455 条 commission event。
- 203 条 head fee event。
- 29 条 settlement。

ChengyuWang0807 当前本地验证结果：

- `/api/affiliate/summary` 返回 200。
- `rule_status=published_rules`。
- `kpi_tier_name=卓越档`。
- `team_user_count=85`。
- `effective_new_user_count=66`。
- `net_consumption_rmb` 约 5003。
- `/api/affiliate/team` 返回 200，`total=85`。

运行脚本：

```bash
cd /home/rain/projects/new-api-rain021217
python3 .codex-local/seed-affiliate-demo-data.py
```

## 10. 本地开发与验证

### 10.1 启动 dev 环境

后端：

```bash
cd /home/rain/projects/new-api-rain021217
docker compose -f docker-compose.dev.yml up -d --build new-api
```

前端：

```bash
cd /home/rain/projects/new-api-rain021217
./scripts/dev-web-tmux.sh
```

每次重建镜像、重启容器、重启 Docker Desktop、重启 WSL 或重启电脑后，都要运行或确认：

```bash
./scripts/dev-web-tmux.sh
```

### 10.2 端口检查

```bash
ss -ltnp | rg ':3000|:5173|:5174'
curl -i http://127.0.0.1:5173/api/affiliate/team
curl -i http://127.0.0.1:5174/api/affiliate/team
curl -i http://127.0.0.1:3000/api/affiliate/team
```

未登录期望：

- 401 Unauthorized。
- 不应是 404。
- 不应是 `Invalid URL`。

### 10.3 推荐测试命令

后端定向测试：

```bash
go test ./service ./controller -run "Affiliate"
```

分销摘要、KPI、佣金、结算相关测试：

```bash
go test ./service -run "AffiliateDashboardSummary|AffiliateKPI|AffiliateCommission|AffiliateSettlementRun"
```

classic 前端分销测试：

```bash
cd web/classic
bun test src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs src/pages/Affiliate/affiliateDashboardCards.test.mjs
pnpm run build
```

default 前端分销测试：

```bash
cd web/default
bun test src/features/affiliate/rule-array-editor.test.ts src/features/affiliate/admin-lib.test.ts src/features/affiliate/lib.test.ts
pnpm run build:check
```

## 11. 生产发布注意事项

生产不能使用官方 `calciumion/new-api:latest` 作为包含本仓库二开功能的应用镜像。

生产应：

- 从当前仓库根目录构建不可变 tag。
- 使用根目录生产 `Dockerfile`，该 Dockerfile 会构建并嵌入 default/classic 前端 dist。
- 保留旧镜像 tag 以便回滚。
- 在生产或 staging 执行外部验收 runbook。

参考：

- `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`
- `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`

## 12. 常见问题

### 12.1 为什么 3000 打开是 use frontend dev server

这是 dev 镜像的预期行为。

原因：

- `Dockerfile.dev` 只放置前端占位 dist。
- 真正前端由 `5173` default 和 `5174` classic dev server 提供。

解决：

- 访问 `http://127.0.0.1:5173/` 或 `http://127.0.0.1:5174/`。
- 确认 `scripts/dev-web-tmux.sh` 已启动。

### 12.2 为什么 5173 或 5174 拒绝连接

原因：

- 电脑、WSL、Docker Desktop 重启后，前端 dev server 进程不会自动恢复。
- 这些端口不是 Docker 容器长期服务。

解决：

```bash
cd /home/rain/projects/new-api-rain021217
./scripts/dev-web-tmux.sh
```

### 12.3 为什么分销中心显示关系树 404

优先排查：

- 浏览器是否缓存了旧 404。
- Network 中响应是否 from disk cache。
- Response body 是否是旧的 `Invalid URL (GET /api/affiliate/team)`。
- Request URL 是否是当前 `5173` 或 `5174`。
- 后端 `3000` 是否是本仓库 `new-api:dev` 容器。

当前正确状态：

- 未登录访问 `/api/affiliate/team` 返回 401。
- 登录后带合法 session 和 `New-Api-User` 返回 200。

### 12.4 为什么 KPI 显示待配置

只有一种正常含义：

- 当前没有已发布规则集。

如果管理员已发布规则仍显示待配置：

- 检查后端是否重建。
- 检查前端是否旧 bundle。
- 检查浏览器缓存。
- 检查接口是否打到旧容器。

如果规则已发布但指标不达标，应显示“未达标”，不是“待配置”。

### 12.5 为什么最大净付费第 5 档为 0

第 5 档 `max_net_paid_amount_cents=0` 表示无上限。

业务含义：

- 起点为 5000 元。
- 终点不限。
- 前端应显示“0 表示不限”。

### 12.6 为什么有效新增比团队人数少

有效新增需要同时满足：

- 来自 affiliate invite。
- 在统计周期内。
- 在资格窗口内完成 paid 消耗。
- paid 消耗达到规则门槛。
- 没有退款或异常标记。
- 不是纯赠金或 trial 用户。

团队人数只是关系树人数，不等于有效新增。

### 12.7 为什么佣金或结算为 0

可能原因：

- 下线消耗不是 paid 来源。
- 规则集没有发布。
- 分佣事件尚未重算。
- 结算周期未生成结算单。
- 金额低于最小结算金额。
- 事件被作废或已经 settled。
- 人头费档位金额本身配置为 0。

### 12.8 为什么手机号登录注册入口看不到

需要同时检查：

- 系统设置中短信是否启用。
- 前端登录注册组件是否展示手机号入口。
- 短信宝配置是否完整。
- 手机号注册/登录业务策略是否允许开放。

短信宝配置本地文件在 `.codex-local/smsbao-config.secret.yml`，不得提交。

## 13. 操作建议

运营配置建议：

- 规则上线前先在本地或 staging 使用合成数据跑通。
- 修改 KPI 编码时同步检查人头费规则。
- 最后一档净付费区间保留 0 表示不限。
- 结算前先检查分佣事件状态和异常比例。
- 禁用分销商前确认未完成结算。

开发建议：

- 不重复实现已有 `/api/affiliate/team` 路由。
- 修问题先看 Network、API、DB、服务层数据流。
- 前端新增字段必须做 i18n。
- classic 和 default 要保持 parity。
- 后端规则变更补 service/controller 测试。
- 每次重建后端镜像后确认 `scripts/dev-web-tmux.sh`。

安全建议：

- `.codex-local`、`runtime`、dump、secret 文件不提交。
- 不输出密码、cookie、DSN、生产端点。
- 真实生产验收只输出脱敏证据。

