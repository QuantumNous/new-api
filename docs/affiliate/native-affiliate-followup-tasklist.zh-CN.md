# 原生分销后续接手 Tasklist

更新日期：2026-06-04

适用分支：`feature/native-affiliate-minimal`

目标：接手已提交的原生分销 MVP 后，优先收口本线程暴露的环境、缓存、安全脱敏、规则管理可用性、结算可靠性和发布治理问题，避免重复实现已经存在的后端路由。

## 0. 接手前必须读取

- [x] 先读取 `docs/affiliate/native-affiliate-master-plan.zh-CN.md`，确认业务口径、分销层级、Feishu 方案和验收目标。（2026-06-04 已重读）
- [x] 先读取 `docs/affiliate/native-affiliate-development-principles.zh-CN.md`，严格遵守最小侵入、sidecar、TDD、脱敏、RMB 单位、权限和发布证据原则。（2026-06-04 已重读）
- [x] 先读取 `docs/affiliate/native-affiliate-new-thread-tasklist.zh-CN.md`，理解 Phase 1 到 Phase 13 的已完成项、残留风险和历史复盘。（2026-06-04 已重读）
- [x] 先读取 `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`，确认 WSL2 Docker Compose dev 的启停、重建、dump 恢复和清理方式。（2026-06-04 已重读）
- [x] 先读取 `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`，外部验收不得用本地 smoke 冒充 staging/生产验收。（2026-06-04 已重读）
- [x] 先读取 `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`，新增或修改 GORM model 前后必须重新做 schema impact。（2026-06-04 已重读）
- [x] 先读取 `docs/affiliate/native-affiliate-sms-reference-audit.zh-CN.md`，手机号/SMS 只走 provider/sidecar 路线，不能直接迁移旧 fork 的侵入式实现。（2026-06-04 已重读）
- [x] 继续按 `.agents/skills` 和可用 MCP/plugin/CLI 工作。当前项目相关技能至少包括 `classic-to-default-sync`、`i18n-translate`、`shadcn-ui`、`vercel-react-best-practices`、`superpowers:systematic-debugging` 和飞书文档相关 skill。（2026-06-04 已读取 Superpowers 调试、TDD、验证与收口流程；前端改动前仍需按具体任务读取对应 `.agents/skills`。）
- [x] 飞书资料作为业务口径来源继续复核，但不得把内部账号、密码、DSN、cookie、完整手机号、生产地址或敏感截图写入仓库、tasklist、commit message 或测试日志。（2026-06-04 已确认该安全边界，后续飞书口径变更仍需单独脱敏记录。）

## 1. 当前运行态基线

- [x] 后端路由 `/api/affiliate/team` 已存在，不要重复实现。源码位置包括 `router/api-router.go`、`controller/affiliate.go`、`service/affiliate.go`。
- [x] WSL 内未登录访问 `http://127.0.0.1:3000/api/affiliate/team` 已返回 401，不再是旧 `Invalid URL` 404。
- [x] 使用 `ChengyuWang0807` 登录并带 `New-Api-User` header 后，`3000`、`5173`、`5174` 的 `/api/affiliate/team` 均已返回 200 且 `total=9`。
- [x] 当前前端 dev server 已在 WSL 内用 `tmux` 启动，session 为 `new-api-web`，window 为 `default` 和 `classic`。
- [x] 当前端口约定：`5173` 是 default 前端，`5174` 是 classic 前端，`3000` 是 new-api 后端容器 HTTP 入口。
- [x] P0 收口前曾有两处未提交的前端缓存规避改动：`web/default/src/features/affiliate/api.ts` 和 `web/classic/src/pages/Affiliate/index.jsx`；已随本线程 P0 提交收口。
- [x] 后续开始任何代码改动前先运行 `git status --short --branch`，明确区分用户已有改动、上一轮缓存规避改动和本轮新增改动。

## 2. Dev 前端运行与重启后恢复

- [x] 明确给后续线程和用户说明：`5173`、`5174` 是临时前端 dev server 进程，不是类似 `new-api` 的 Docker 容器；电脑重启后端口拒绝连接是正常现象。（见 P0-3 复盘）
- [x] 所有前端端口启动命令优先在 WSL 内执行，不使用 Windows 侧 `Start-Process` 作为默认路径。（见 P0-3 复盘）
- [x] 保留或新增 WSL 启动脚本，例如 `scripts/dev-web-tmux.sh`，一键启动 `tmux new-session -s new-api-web` 并分别运行 default/classic dev server。（见 P0-3 复盘）
- [x] 在 runbook 中补齐 `tmux attach -t new-api-web`、`tmux ls`、`tmux kill-session -t new-api-web`、查看 default/classic 日志和重启单个 window 的命令。（见 P0-3 复盘）
- [x] 修正 `docker-compose.dev.yml` 或相关文档里旧的前端端口说明，避免继续写 `3001` 之类与当前 `5173`/`5174` 不一致的提示。（见 P0-3 复盘）
- [x] 前端启动后必须验证 `curl -I http://127.0.0.1:5173/` 和 `curl -I http://127.0.0.1:5174/` 返回 200。（见 P0-3 复盘）
- [x] 前端启动后必须验证 `curl -i http://127.0.0.1:5173/api/affiliate/team` 和 `curl -i http://127.0.0.1:5174/api/affiliate/team` 未登录返回 401 而不是 404。（见 P0-3 复盘）

## 3. Dev 与生产镜像治理

- [x] 明确 dev compose 的 `new-api` 服务当前应从仓库本地源码构建 `new-api:dev`，不是直接跑官方 `calciumion/new-api:latest` 应用镜像。
- [x] 明确 dev compose 中 Redis/PostgreSQL 使用官方 `latest` 只代表基础设施镜像是最新，不代表应用代码来自官方 latest。
- [x] 明确生产 `docker-compose.yml` 如果仍使用 `calciumion/new-api:latest`，则不会包含当前仓库的二开代码，分销路由和前端改动都会丢失。
- [x] 给生产切换准备独立 compose override 或发布文档，把生产应用镜像改为本仓库 `Dockerfile` 构建出的带 tag 镜像，例如 `new-api-rain:YYYYMMDD-HHMM`，不要依赖浮动 latest。
- [x] 发布前确认生产 `Dockerfile` 同时构建并嵌入 default/classic 前端 dist，避免只发布后端而页面仍是旧 bundle。
- [x] 发布前确认生产环境变量、PostgreSQL、Redis、日志、反代、HTTPS、备份和回滚策略，不把 dev volume 或本地 dump 带到生产。
- [x] 提供从 dev 切回生产模式的 checklist：停止 dev compose，备份生产库，构建本地生产镜像，切 compose image，`docker compose up -d`，验证 `/api/status`、登录、分销中心、管理端规则页和结算任务。

## 4. `/api/affiliate/team` 旧 404 缓存收口

- [ ] 在 Windows 浏览器 DevTools Network 中复核 `/api/affiliate/team` 的 Request URL、Status、是否 from disk cache/from memory cache、Response Body 和 Request Headers。
- [ ] 如果 Response Body 仍是 `Invalid URL (GET /api/affiliate/team)`，优先判断为旧后端 404 HTTP 缓存或命中错误端口，不要先改后端路由。
- [x] 使用 in-app Browser fresh context 复核 default/classic dev server 的 `/api/affiliate/team` Network：`5173` 与 `5174` 均为 401 JSON，不是旧 `Invalid URL` 404；该证据不能替代用户 Windows 既有浏览器缓存状态。（见 P0-6 复盘）
- [x] 继续验证未登录 curl：`http://127.0.0.1:5173/api/affiliate/team`、`http://127.0.0.1:5174/api/affiliate/team`、`http://127.0.0.1:3000/api/affiliate/team` 均应返回 401，不应返回 404。（见 P0-1 复盘）
- [x] 登录后用浏览器控制台、DevTools request replay 或 curl 带 cookie 与 `New-Api-User` header 验证 `/api/affiliate/team` 返回 200 且 `total` 非 0。（见 P0-1 复盘）
- [ ] 如果 Network 显示缓存，先让浏览器勾选 Disable cache 并硬刷新，必要时清站点缓存。
- [x] 评估当前前端 `_t` cache buster 和 `Cache-Control: no-cache` 临时修复是否保留、改成统一 API no-cache 封装，或改为后端对 `/api/*` 返回 `Cache-Control: no-store`。（见 P0-1 复盘；当前保留前端规避）
- [x] 如果保留前端 cache buster，必须补 default/classic 对应测试或至少用浏览器 Network 证明 Request URL 已带 `_t` 且不再命中 disk cache。（见 P0-1 复盘）
- [x] 如果改为后端 no-store，必须覆盖 `/api/affiliate/team`、登录态 API 和通用 API 响应，避免缓存 401/404/敏感 JSON。（见 P0-5 复盘）
- [x] 收口后提交一个独立 commit，说明这是缓存/部署链路修复，不是后端路由实现。（已按 P0-1/P0-3 分主题提交）

## 5. Scoped 使用日志脱敏优先级

- [x] 立即复核 `service/affiliate_logs.go` 的 scoped 日志脱敏字段，当前疑点是只清理了 `Ip`、`RequestId`、`UpstreamRequestId` 和部分 `other` 字段，未清理 `ChannelId`、`ChannelName`、`TokenId`、`TokenName`。（见 P0-2 复盘）
- [x] 立即复核后端 CSV 导出，当前疑点是 `controller/affiliate.go` 仍导出 `channel_id`、`channel_name`、`token_id`、`token_name`。（见 P0-2 复盘）
- [x] 立即复核 default 前端 CSV 导出，当前疑点是 `web/default/src/features/affiliate/lib.ts` 仍导出 channel/token 字段。（见 P0-2 复盘）
- [x] 按治理原则修正 scoped 使用日志：分销商视角不得看到渠道成本、内部渠道源、token、IP、request id、upstream request id 和非授权字段。（见 P0-2 复盘）
- [x] 用 TDD 更新已有测试。先让 `controller/affiliate_test.go` 和 `web/default/src/features/affiliate/lib.test.ts` 中期待 channel/token 的断言 RED，再改实现到 GREEN。（见 P0-2 复盘）
- [x] 审核 classic/default 页面渲染，避免前端表格列继续展示已经脱敏或删除的内部字段。（见 P0-4 复盘）
- [x] 修复后补一条脱敏审计复盘到本 tasklist 或旧 tasklist，写清楚隐藏字段清单和测试命令。（见 P0-2 复盘）

## 6. 分销管理指标体系表格化

- [x] 分销管理里的规则、指标、KPI、人头费、风控和结算配置建议做成表格或矩阵，而不是继续以 JSON textarea 或散卡片为主。
- [x] 佣金规则表：列包含层级、单用户累计净付费下限、单用户累计净付费上限、基准比例、最高比例 cap、是否需人工审批、排序和启停状态。（2026-06-04 审计：tier 表格字段已覆盖净付费区间、比例、cap、人工审批和排序；2026-06-04 已补 `AffiliateCommissionRuleInput.status`、默认 seed/fallback active 状态、草稿保存/发布/回滚复制和佣金生成跳过 disabled 等级；2026-06-04 已补 default/classic 规则表格 status 标签、固定列顺序、编辑值转换测试，以及旧 rule snapshot/import/copy 缺失 status 时补 `active` 的兼容展示。）
- [x] KPI 档位表：列包含层级、档位 code、档位名称、有效新用户阈值、净付费消耗阈值、最终系数、质量门槛和排序。（2026-06-04 审计：`kpi_tiers` 已覆盖这些字段，default/classic 表格编辑器会按字段动态生成运营表格，并对百分比字段做 bps/percent 转换。）
- [x] 人头费规则表：列包含层级、适用 KPI 档位、金额、首充门槛、14 天净付费门槛、解锁天数、是否启用。（2026-06-04 审计：金额、首充、周期净付费、资格天数和解锁天数已覆盖；2026-06-04 已补 `AffiliateHeadFeeRuleInput.status`、`affiliate_head_fee_rules.status` sidecar 字段、默认 seed/fallback active 状态、草稿保存/发布/回滚复制和人头费生成跳过 disabled 档位。）
- [x] 风控规则表：列包含纯赠金额占比阈值、异常用户占比阈值、退款阈值、二次付费率阈值、自刷/批量异常策略和处理动作。（2026-06-04 审计：比例阈值已覆盖；2026-06-04 已补 `self_brush_strategy`、`bulk_abuse_strategy`、`action` sidecar 字段、默认 seed/fallback、保存/发布/回滚复制和 default/classic 表格固定列。）
- [x] 结算配置表单或表格：包含结算周期、冻结天数、最低结算金额、人工复核阈值、自动结算开关和备注。（2026-06-04 审计：周期、冻结天数、最低结算金额和人工复核开关已覆盖；2026-06-04 已补 `settlement_config.auto_settlement_enabled`、`settlement_config.review_note`、旧 snapshot 缺字段默认开启、自动运行保护和 default/classic 表单控件。）
- [x] 输入单位必须面向运营：金额用元，比例用百分比，保存时再转换为 cents/bps；页面不得让运营直接填写 cents 或 bps。
- [x] 增加规则变更 diff 预览，发布、归档、回滚和覆盖保存必须二次确认。（2026-06-04 已完成保存草稿前 diff 预览、发布/归档二次确认、已有草稿覆盖保存二次确认，以及从 published/archived 历史版本创建可审计回滚草稿的二次确认。）
- [x] 增加复制上一版本、导入导出 JSON、只读查看已发布版本和高级 JSON 模式，但高级 JSON 不能作为默认入口。（2026-06-04 已完成 default/classic 复制上一版本、导入/导出 JSON、diff 面板、只读查看已发布/已归档版本，并保留高级 JSON 但不作为默认入口。）
- [x] default 与 classic 需要保持功能 parity，但视觉可以遵循各自设计系统。

## 7. Feishu 业务口径复核与种子规则

- [ ] 重新核对飞书分销方案的净付费口径：只计算 paid 净付费消耗，不计算赠金、试用、退款、异常、自刷和内部测试。
- [ ] 重新核对有效新用户口径：邀请归因有效、首充达标、14 天净付费达标、无退款/自刷/批量异常。
- [ ] 复核一级佣金档位：0-200、200-800、800-1500、1500-5000、5000+ 等区间的基准比例和 cap。
- [ ] 复核二级佣金档位：0-200、200-800、800-1500、1500-5000、5000+ 等区间的基准比例和 cap。
- [ ] 复核 KPI 规则：最终档位应取有效用户数档位和净付费消耗档位的较低者，质量门槛可降档或触发复核。
- [ ] 复核人头费规则：不按注册直接发放，必须满足首充和 14 天净付费门槛。
- [ ] 复核分销邀请注册赠送额度与普通邀请注册赠送额度差异，确保赠金不计佣、不计 KPI。
- [x] 把已核对的飞书规则沉淀为可导入的默认 rule set seed，避免每次手工输入运营规则。（2026-06-04 已把当前 master plan 沉淀值固化为服务层默认 seed，并新增 admin 只读 seed API；最新飞书外部变更仍需按上方单项重新核对。）
- [x] 对 seed 增加 Go 测试，确保区间无重叠、无空洞、金额/比例单位转换正确、发布版本不可变。（2026-06-04 已补 service/controller 测试，覆盖 seed 转换、佣金区间连续性、保存发布和发布后不可覆盖。）

## 8. 佣金、KPI、人头费与结算可靠性

- [x] 审计 `service/affiliate_commission.go` 中一次性 `Find(&logs)` 的无界查询风险，改成按时间窗口和 ID cursor 分批扫描。
- [x] 审计 `service/affiliate_kpi.go` 中 KPI 计算的无界日志加载风险，改成分批聚合或数据库侧聚合。
- [x] 审计 `service/affiliate_head_fee.go` 中人头费计算的无界日志加载风险，改成分批聚合并保留幂等记录。
- [ ] 给佣金、KPI、人头费、结算任务增加 run record 或 job execution 记录，包含参数、窗口、执行人、开始/结束时间、状态、错误、扫描进度和幂等 key。（2026-06-03 已为管理员 settlement pipeline 增加 `affiliate_job_runs` 顶层 job execution；2026-06-04 已为单独 `AdminGenerateAffiliateSettlements` endpoint 增加 `settlement_generate` job run；2026-06-04 已把 KPI/佣金/人头费日志扫描和 settlement event id 扫描进度写入既有 cursor 字段；2026-06-04 已支持同 idempotency key 的 failed job run 原地恢复并幂等重跑；2026-06-04 已增加 active running 拦截与 6 小时 stale running 原地接管；2026-06-04 已补 stage-specific cursor payload，并修复 settlement grouping 失败时 cursor 被事务回滚的问题；2026-06-04 已修复 failed job run resume 初始化清空 cursor payload 的问题，为后续跳扫式 resume 保留 typed cursor；2026-06-04 已补 settlement pipeline failed resume 跳过已完成整阶段，避免 settlement 阶段失败后重扫 usage logs；2026-06-04 已补阶段跳过前的持久化输出校验，缺失输出时自动降级重跑；2026-06-04 已补佣金阶段按 source log 小事务落地与 failed job run partial commission count 审计；2026-06-04 已补 KPI 阶段按 profile 小事务落地与 failed job run partial kpi count 审计；2026-06-04 已补人头费阶段按 relation 小事务落地与 failed job run partial head fee count 审计；2026-06-04 Docker probe 仍不可用，schema diff 未生成；阶段内部 cursor 跳扫和 Docker PostgreSQL schema diff 仍待补。）
- [x] 完整验证重复执行同一周期不会重复计佣、重复发人头费或重复生成结算单。（2026-06-04 已补 service 级完整 pipeline 重复运行审计测试；外部完整结算周期双跑仍按 external acceptance runbook 执行。）
- [x] 补充 refund、partial refund、gift-only、mixed paid/gift/trial、legacy_unknown、任务钱包扣费、异步任务退款等样本。（2026-06-04 已补 mixed paid/gift/trial/legacy_unknown + partial refund 分佣测试，并复跑现有 gift-only、quota sidecar、人头费、任务钱包扣费/退款 source segment 测试。）
- [x] 明确历史未标记日志是否进入灰度回填、人工复核或直接排除，不得默认把未知来源计为 paid。（2026-06-04 已明确当前服务策略：无来源日志和 `legacy_unknown` 默认直接排除在 paid 业绩、KPI paid 统计和人头费资格外；如需纳入，只能通过灰度回填或人工复核补写可信 paid sidecar 后再计算。）
- [ ] 完整结算周期必须做双跑：dry-run 与正式 run 对比，重复正式 run 幂等，结算单金额与事件合计一致。（2026-06-04 已补本地 service/API `dry_run` 预览能力，dry-run 不落库，随后正式 run 可生成相同金额；2026-06-04 已补本地 service 级 dry-run、正式 run、重复正式 run 与已链接事件合计一致审计；外部真实周期双跑验收仍待做。）

## 9. Dashboard 与统计口径

- [x] 复核 `service/affiliate_summary.go` 的有效新用户统计，避免只按 invite event 简单计数而没有套用飞书有效用户门槛。（2026-06-04 已修复 dashboard summary：无 published 规则时不把 invite 直接计为有效；有规则时按同层级人头费规则的首充、14 天 paid 净消耗、无退款/异常条件判定。）
- [x] 复核 dashboard 的净消耗统计，确保只统计 paid 净付费消耗并正确扣除退款，不把赠金、试用、legacy_unknown 或异常流量算入业绩。（2026-06-04 已修复 `service/affiliate_summary.go`，dashboard 净消耗改为按 cursor 扫描日志并只累计 paid attribution，同时跳过 abnormal 流量。）
- [x] 分销商端 dashboard 保持卡片、趋势图、关系树和明细表组合，不建议全部表格化。（2026-06-04 已审计 classic/default 分销商页：当前为摘要卡片 + 推广关系树 + scoped logs 明细表组合，不把看板整体表格化；2026-06-04 已在 P2-4 补齐 14 天趋势数据接口与 default/classic UI。）
- [x] 管理端指标配置和结算审核更适合表格化，分销商端看板更适合“摘要卡片 + 趋势 + 表格明细”。（2026-06-04 已确认前期规则配置已表格化，default rule-array-editor 与 admin finance helper 测试覆盖表格字段和人民币/百分比单位；结算审核完整表格 UI 继续按管理端 finance 后续任务推进。）
- [x] default/classic 都要显示 RMB 主单位，必要时 raw quota 只作为调试或附加列，不作为主要展示。（2026-06-04 已审计：classic dashboard card 使用 `net_consumption_rmb` 为主值、raw quota 为描述；default scoped logs 使用 RMB 单元格、raw quota 仅在 title/CSV 附加列。）

## 10. 手机号/SMS 后续

- [x] 当前 SMS 限流为内存实现，生产多实例前必须评估 Redis/数据库分布式限流，否则不同实例之间会绕过限制。（2026-06-04 已新增 `sms_rate_limit_counters` sidecar 固定窗口 DB 计数，管理员测试发送优先走 DB-backed limiter；`model.DB=nil` 时保留内存 fallback。Docker PostgreSQL schema diff 因 Docker 不可用仍待补。）
- [x] 如果启用手机号注册，必须复用 Phase 5 的统一邀请归因和初始额度规则。（2026-06-04 已新增后端 `POST /api/user/sms/register`，复用统一 invite context、初始额度规则和 `user_phone_bindings` sidecar；2026-06-04 已新增后端 `POST /api/user/sms/register/code` 发送注册验证码；2026-06-04 已补 `/api/status.sms_enabled`、default/classic 注册表单入口、短信验证码发送和 SMS 注册提交；2026-06-04 已补后端 `POST /api/user/login/phone` 与 `POST /api/user/sms/login/code`，只允许已绑定手机号获取登录验证码并登录；2026-06-04 已补 default/classic 前端手机号登录入口、登录验证码发送和手机号登录提交；真实通道 smoke 和 Docker PostgreSQL schema diff 仍待做。）
- [x] 如果启用手机号登录/绑定，继续使用 sidecar `user_phone_bindings`，不要直接改官方 `users` 表。（2026-06-04 审计：当前分支手机号绑定已使用 `user_phone_bindings` sidecar，`model/user.go` 未新增手机号字段；2026-06-04 已补后端手机号登录查询 active binding 并校验用户启用状态，未绑定手机号不会自动注册、创建绑定或触发短信发送；2026-06-04 已补 default/classic 手机号登录前端入口；手机号绑定、换绑、解绑和找回闭环仍待做。）
- [ ] 短信宝真实通道 smoke 必须在签名审核通过、模板确认和脱敏日志策略明确后执行。
- [x] 测试发送、状态查询和失败错误码映射不得输出完整手机号、验证码、ApiKey、密码或签名内部资料。（2026-06-04 已完成本地脱敏审计，管理员测试发送、状态查询、发送日志、短信宝错误映射、验证码发送和手机号登录返回均已有回归证据；真实短信宝通道 smoke 仍由上一项单独跟进，见 P2-13。）

## 11. 前端质量与 parity

- [ ] classic 与 default 的分销商中心、分销管理、用户 inviter 管理、规则集、佣金和结算操作必须保持功能 parity。
- [ ] 新增前端功能时先确认适用 skill：classic 同步 default 用 `classic-to-default-sync`，文案用 `i18n-translate`，default 组件优先遵守 shadcn/default 现有模式。
- [ ] 所有新增前端 API 要统一处理登录态、错误提示、no-cache 策略和 RMB 单位，不要每个页面散写。
- [ ] 浏览器 smoke 至少覆盖未开通用户、一级分销商、二级分销商、管理员和超级管理员视角。
- [x] 对当前 `5173` default 页面已有的 React checked/onChange console warning 做基线记录，确认是否与分销页面无关；后续可以作为前端质量债单独修。（2026-06-04 已复核：default 根页 `/` 可触发 1 条 React `checked`/`onChange` error；未登录 `/affiliate/` 跳转登录页和登录后的 `/affiliate/` 均为 0 error / 0 warning，分销页 API 均为 200，见 P2-14。）
- [ ] 前端变更后使用 in-app Browser 或 Playwright 打开 `http://127.0.0.1:5173/` 与 `http://127.0.0.1:5174/`，必要时截图留证。

## 12. 外部验收与灰度

- [ ] 本地 WSL smoke 只能证明开发环境可用，不能证明生产或 staging 可用。
- [ ] 拿到外部环境入口后，按 external acceptance runbook 验证真实充值、真实 relay 消耗、退款、任务扣费、周期结算和分销商只读页面。
- [ ] 灰度发布前必须确认 `AffiliateEnabled` 默认状态、管理员账号权限、灰度分销商名单和回滚开关。
- [ ] 灰度时先只开放管理员查看和少量分销商查看，再开放规则发布和结算任务。
- [ ] 外接控制台如需要只读归档，必须限定字段、限定 scope，并验证不会泄漏 channel/token/IP/request_id/内部成本。

## 13. 生产切换 Checklist

- [ ] 发布前确认当前分支所有目标改动已分批提交，`git status --short` 干净或只剩明确不提交文件。
- [ ] 发布前从本仓库构建生产镜像，不能继续使用官方 `calciumion/new-api:latest` 作为包含二开功能的应用镜像。
- [ ] 发布前备份生产 PostgreSQL，并记录可回滚镜像 tag 和 compose 文件。
- [ ] 发布前验证生产镜像内前端 bundle 包含最新分销页面、缓存修复和翻译。
- [ ] 发布后验证 `GET /api/status`、登录、`GET /api/affiliate/status`、`GET /api/affiliate/team`、管理员规则页、佣金页、结算页。
- [ ] 发布后检查 HTTP cache header，避免浏览器继续缓存旧 404、401 或敏感 JSON。
- [ ] 发布后检查容器日志、数据库迁移日志和 schema impact，确认只新增或修改预期 sidecar 对象。
- [ ] 发布后保留脱敏验收记录，不记录 cookie、token、密码、DSN 或完整手机号。

## 14. 建议执行顺序

- [x] P0：确认并收口 Windows 浏览器 `/api/affiliate/team` 旧 404，是缓存、错误端口、错误后端还是旧 bundle。
- [x] P0：修复 scoped 使用日志和 CSV 导出的 channel/token 泄漏风险，先 TDD，再实现。
- [x] P0：补 WSL 前端 dev server 一键启动脚本和 runbook，解决重启后 `5173`/`5174` 拒绝连接的问题。
- [x] P1：明确 dev/prod 镜像切换方案，保证生产不再误用官方 latest 来发布二开功能。
- [x] P1：把分销管理规则配置重构为运营友好的表格/矩阵，并保留高级 JSON 导入导出。（2026-06-03 已完成 default/classic 可视编辑表格化和高级 JSON 文本保留；2026-06-04 已补 default/classic 导入/导出按钮、diff 预览、复制上一版本、已发布/已归档版本只读查看、发布/归档二次确认、佣金/人头费启停状态、结算自动开关和备注。风控动作仍按第 6 节单项任务保留。）
- [ ] P1：佣金、KPI、人头费和结算任务改造为分批、可恢复、幂等、可审计。（2026-06-04 已完成 usage logs 的 `created_at,id` cursor 分批扫描、完整 pipeline 重复运行幂等审计；2026-06-03 已完成 settlement pipeline 顶层 job run 审计记录、settlement pending/ready event grouping 的 `id` cursor 分批扫描和 settlement event link 更新批量拆分；2026-06-04 已补 failed job run 同 key 原地 resume，以及 active running 拦截和 stale running 原地接管；2026-06-04 已补 stage-specific cursor payload 与 settlement grouping 失败 cursor 保留；2026-06-04 已补 failed resume 初始化保留 typed cursor payload；2026-06-04 已补 settlement pipeline failed resume 跳过已完成整阶段和跳过前持久化输出校验；2026-06-04 已补 settlement pipeline service/API dry-run 预览能力；2026-06-04 已补 settlement linked event totals 审计 helper 与 dry-run/formal/repeat formal 本地双跑测试；2026-06-04 已补佣金阶段 durable partial progress 和 failed job run partial count 审计；2026-06-04 已补 KPI 阶段 durable partial progress 和 failed job run partial count 审计；2026-06-04 已补人头费阶段 durable partial progress 和 failed job run partial count 审计；2026-06-04 已补 failed settlement pipeline 若缺少已完成阶段计数则降级重跑，避免旧失败记录把 0 计数误当完成证据；2026-06-04 Docker probe 仍不可用，schema diff 未生成；阶段内部 cursor 跳扫、Docker schema diff 和外部完整周期 dry-run/正式 run 双跑验收仍待做。）
- [x] P2：把飞书规则沉淀为默认 rule set seed，并增加单位转换、区间完整性和发布不可变测试。（2026-06-04 已完成当前 master plan 默认值的 service seed、admin seed API 和 Go 测试；最新飞书方案外部复核仍按第 7 节其他单项保留。）
- [ ] P2：补齐 SMS 分布式限流、手机号注册归因和真实通道 smoke。（2026-06-04 已补 DB sidecar 固定窗口限流，并确认手机号绑定继续使用 `user_phone_bindings` sidecar、不改官方 `users` 表；2026-06-04 已补后端 SMS 注册入口、注册验证码发送入口并接统一邀请归因；2026-06-04 已补 default/classic 前端注册表单入口和请求层；2026-06-04 已补后端手机号登录入口、登录验证码发送入口并保留 2FA；2026-06-04 已补 default/classic 前端手机号登录入口和请求层；真实通道 smoke、Docker PostgreSQL schema diff、live 容器重建后 smoke、绑定/换绑/找回闭环仍待做。）
- [ ] P2：完善 dashboard 统计口径、浏览器截图回归和外部验收归档。（2026-06-04 已补 dashboard 14 天趋势；登录态浏览器截图回归和外部验收归档仍待做。）

## 15. 文档维护规则

- [ ] 每完成一个 P0/P1 任务，在本文件追加复盘：完成内容、验证命令、残留风险、下一步。
- [ ] 每次发现与旧 tasklist 冲突的新事实，优先在本文件记录，并在必要时回写旧 tasklist 或 runbook。
- [ ] 每次涉及飞书业务口径变化，必须注明来源和核对日期，但不得粘贴敏感内部资料。
- [ ] 每次涉及生产、账号、密钥、短信、支付或真实用户数据，复盘只写脱敏证据。

## P0-1 `/api/affiliate/team` 旧 404 缓存收口复盘（2026-06-03 本线程）

- 完成内容：按 systematic-debugging 先取证，不重复实现后端路由。当前 WSL 和 Windows localhost 侧都无法复现 `/api/affiliate/team` 旧 `Invalid URL` 404；当前 classic/default bundle 的真实页面请求已带 `_t` cache buster、`Cache-Control: no-cache, no-store, max-age=0`、`Pragma: no-cache` 和 `New-Api-User: 32`。
- 验证命令：`git status --short --branch` 显示上一轮未提交前端缓存规避改动仍为 `web/classic/src/pages/Affiliate/index.jsx` 与 `web/default/src/features/affiliate/api.ts`；`git log --oneline -8` 确认最近提交停在 `5ae0da58 chore: sync affiliate frontend translations`；`ss -ltnp` 显示 `3000`、`5173`、`5174` 均监听；`tmux ls` 显示 `new-api-web` 包含 default/classic 两个 window。
- 验证命令：WSL 内 `curl -i http://127.0.0.1:3000/api/affiliate/team`、`5173`、`5174` 未登录均返回 401；Windows 侧 `curl.exe -i` 访问同三个 URL 也均返回 401；这证明当前端口映射和 dev server proxy 未命中旧 404。
- 验证命令：Node 登录 smoke 从 `.codex-local/affiliate-test-accounts.secret.json` 读取一级分销商账号但不输出密码/cookie，登录成功后带 `New-Api-User: 32` 请求 `3000`、`5173`、`5174` 的 `/api/affiliate/team?_t=probe`，三者均 HTTP 200、`success=true`、`total=9`。
- 验证命令：临时 Git 忽略 Playwright probe 通过真实表单登录 classic `5174` 与 default `5173` 后捕获页面级 Network；classic 请求 `http://127.0.0.1:5174/api/affiliate/team?_t=<timestamp>`，default 请求 `http://127.0.0.1:5173/api/affiliate/team?_t=<timestamp>`，两者均 `status=200`、`bodyKind=success-json`、`total=9`、`fromDiskCache=false`、`fromServiceWorker=false`，且请求头包含 `New-Api-User: 32` 和 no-cache headers。
- 残留风险：Docker CLI 在本线程短超时 `docker ps` / compose 查询中未返回可用状态输出，仍需后续按 dev compose runbook 单独排查 Docker Desktop/WSL 响应性；但 HTTP 证据已证明当前 `3000` 服务对 team 路由不是旧 404。当前 Playwright 证据只能代表 headless Chromium 新上下文，不能直接读取用户手动 Windows Chrome 的 disk cache。
- 下一步：如 Windows 手动浏览器仍显示 404，优先在该浏览器 DevTools 勾选 Disable cache 后硬刷新，或清理站点缓存/关闭旧标签页重新打开。当前已有 `_t` 和 no-cache 前端规避，可作为本轮 cache/dev-server commit 的一部分保留；若后续希望系统化治理，再评估后端统一对 `/api/*` 设置 `Cache-Control: no-store`。

## P0-2 scoped 使用日志与 CSV 脱敏复盘（2026-06-03 本线程）

- 完成内容：按 test-driven-development 先修改测试到安全口径并确认 RED，再修复实现。`ListAffiliateScopedLogs` 返回前现在清空 `channel`、`channel_name`、`token_id`、`token_name`、`ip`、`request_id`、`upstream_request_id`，并继续移除 `other.admin_info` 与 `other.stream_status`。后端 `/api/affiliate/logs/export` CSV 与 default 前端 CSV 均删除 channel/token 列，只保留 `time,user_id,username,type,model,group,consumption_rmb,raw_quota`。
- RED 验证：`go test -count=1 ./controller -run 'TestGetAffiliateScopedLogsFiltersScopeAndRedactsSensitiveFields|TestExportAffiliateScopedLogsReturnsScopedRmbCsv'` 先失败，失败点分别为 scoped log 泄漏 channel/token 字段和 CSV header 仍包含 `channel_id,channel_name,token_id,token_name`；`cd web/default && bun --bun test src/features/affiliate/lib.test.ts` 先失败，失败点为 default CSV header 仍包含 channel/token 列。
- GREEN 验证：同一 Go 目标测试修复后通过；`cd web/default && bun --bun test src/features/affiliate/lib.test.ts` 8 项通过；扩展验证 `go test -count=1 ./service ./controller ./router -run 'Affiliate'` 通过；`cd web/default && bun run build` 通过；`git diff --check` 通过。
- 残留风险：classic 分销 scoped logs 页面在本轮后仍依赖后端脱敏作为安全边界；当时 UI 仍可在 affiliate mode 下尝试渲染“渠道信息”。该 UI 清理已在 2026-06-04 P0-4 收口。
- 下一步：进入 P0-3，补 WSL 前端 dev server 一键启动脚本和 runbook；如要更强运行时验证，可在重建后端容器后用真实页面再捕获 `/api/affiliate/logs` 响应，确认 channel/token 字段为空。

## P0-3 WSL 前端 dev server 脚本与 runbook 复盘（2026-06-03 本线程）

- 完成内容：新增 `scripts/dev-web-tmux.sh`，在 WSL 内一键启动 default/classic 两个 Rsbuild dev server。默认 tmux session 为 `new-api-web`，default 监听 `5173`，classic 监听 `5174`，API proxy 指向 `http://localhost:3000`。如果 session 已存在，脚本只提示 attach 和 list-windows，不重复启动端口。
- 完成内容：更新 `docker-compose.dev.yml` 顶部注释，移除旧 `cd web && bun run dev` 和 `3001` 说明，改为 `./scripts/dev-web-tmux.sh`、`5173` default、`5174` classic。更新 `native-affiliate-dev-compose-runbook.zh-CN.md`，补充前端 dev server 不是 Docker 容器、电脑/WSL 重启后需重启脚本、tmux attach/list/capture/kill 命令、端口 smoke 和依赖缺失处理。
- 验证命令：`bash -n scripts/dev-web-tmux.sh` 通过；当前已有 `new-api-web` session 时运行 `./scripts/dev-web-tmux.sh` 输出 existing-session 提示并退出 0；`curl -I http://127.0.0.1:5173/` 与 `curl -I http://127.0.0.1:5174/` 均返回 200；`curl -i http://127.0.0.1:5173/api/affiliate/team` 与 `5174` 未登录均返回 401；`git diff --check` 通过。
- 残留风险：本轮没有 kill 当前运行中的 `new-api-web` session 做冷启动演练，避免打断正在使用的 5173/5174；脚本冷启动路径由语法检查、当前 tmux 命令读取和依赖路径检查覆盖，后续如电脑重启可直接执行脚本验证。
- 下一步：P0 已完成本地收口，后续建议先按主题提交 `cache/dev-server runbook` 与 `scoped logs redaction` 两个 commit，或继续进入 P1 dev/prod 镜像治理。

## P0-4 scoped logs 前端敏感列清理复盘（2026-06-04 本线程）

- RED：default `lib.test.ts` 和 classic `usageLogsUrls.test.mjs` 先改为要求 affiliate scoped 请求不再带 `token_name`；旧实现分别仍生成 `token_name` 参数，两个测试均失败。
- 完成内容：default 分销页删除 Token 过滤器、Token 表格列和 affiliate logs 请求参数 `token_name`，空表/加载态列数同步从 8 调整为 7。CSV 已在 P0-2 删除 channel/token，本轮不改变 CSV 字段。
- 完成内容：classic `UsageLogsTable` 在 `mode='affiliate'` 下删除 token filter 参数，强制隐藏 Token/Channel/IP/Retry 列，并在列选择器里禁止重新打开这些列；展开详情只在非 affiliate 管理员日志里渲染渠道信息，不再显示 `0 - [未知]`。
- 保留内容：管理员和普通自用日志仍保留原 token/channel 查询与列展示，避免破坏官方日志管理能力；本轮只收窄分销 scoped 视角。
- 验证命令：`cd web/default && bun test src/features/affiliate/lib.test.ts` 通过，8 pass；`bun test web/classic/src/hooks/usage-logs/usageLogsUrls.test.mjs` 通过，3 pass。
- 构建验证：`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过；`git diff --check` 通过。
- 残留风险：本轮未做浏览器截图 smoke；后端仍是安全边界，前端 UI 清理用于避免展示无意义空敏感列和继续提交敏感 filter。
- 下一步：可继续推进后端 `/api/*` no-store 统一缓存头，或进入规则 diff/import/export/copy previous version。

## P0-5 `/api/*` 后端 no-store 缓存头复盘（2026-06-04 本线程）

- RED：新增 `TestApiRouterDisablesHttpCaching` 后，旧 `/api/status` 响应没有 `Cache-Control`，证明 `/api` group 还没有统一 no-store 头，旧 401/404 或敏感 JSON 仍可能被浏览器缓存。
- 完成内容：在 `router.SetApiRouter` 的 `/api` group 上复用现有 `middleware.DisableCache()`，统一设置 `Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0`、`Pragma: no-cache` 和 `Expires: 0`。
- 覆盖范围：该中间件挂在 `/api` group，覆盖 `/api/affiliate/team`、登录态 API、用户 API、管理 API 和通用 JSON API；不改变 `/v1` relay、静态前端资源或公开视频代理的缓存策略。
- 验证命令：`go test -count=1 ./router -run TestApiRouterDisablesHttpCaching` 通过；`go test -count=1 ./controller ./router -run Affiliate` 通过；`git diff --check` 通过。
- 残留风险：若个别 `/api` handler 后续显式覆盖 `Cache-Control`，仍可能改变 no-store 语义；发布后仍需用真实浏览器 Network 验证响应头。
- 下一步：P0 本地可控项基本收口，继续 P1 规则 diff/import/export/copy previous version 或 job run 可恢复 cursor/progress。

## P0-6 接手运行态基线复核（2026-06-04 本线程）

- 读取范围：已重读 master plan、development principles、new-thread tasklist、dev compose runbook、external acceptance runbook、schema impact report、SMS reference audit 和当前 followup tasklist；已确认继续遵守 sidecar 最小侵入、scoped 脱敏、RMB/百分比运营单位、classic/default parity、TDD 和脱敏证据原则。
- Git 基线：`git status --short --branch` 显示当前 `feature/native-affiliate-minimal` 工作树干净；`git log --oneline -8` 显示 HEAD 为 `80a8bbb7 feat: persist affiliate commission rule status`，最近还有 typed cursor、stale job run、SMS sidecar 审计与限流提交。
- 运行态证据：`tmux ls` 显示 `new-api-web` session；`tmux list-windows -t new-api-web` 显示 default/classic 两个 window；`ss -ltnp` 显示 5173/5174 分别由 WSL 内 node/rsbuild 监听，3000 由 Docker Desktop/WSL 端口转发监听但无本地进程归属。
- HTTP 证据：`curl -i http://127.0.0.1:3000/api/affiliate/team`、`curl -i http://127.0.0.1:5173/api/affiliate/team`、`curl -i http://127.0.0.1:5174/api/affiliate/team` 未登录均返回 401 JSON，不是 404；in-app Browser Network 对 `5173/api/affiliate/team` 和 `5174/api/affiliate/team` 也均为 401，response body 不是旧 `Invalid URL (GET /api/affiliate/team)`。
- 发现的新风险：当前 3000/5173/5174 的实际 401 响应头缺少 `Cache-Control`/`Pragma`/`Expires`，但源码中 `middleware.DisableCache()` 已挂到 `SetApiRouter`，且 `go test -count=1 ./router -run TestApiRouterDisablesHttpCaching -v` 通过。更可能是当前 3000 后端运行态不是包含 no-store 提交的最新构建，或 Docker Desktop/WSL 转发到了旧容器。
- Docker 状态：`timeout 12s docker version` 只返回 client 信息并以 code 1 退出，`timeout 20s docker ps --filter "name=new-api"` 和 `timeout 45s docker compose -f docker-compose.dev.yml ps new-api` 均无有效 server 输出；`docker compose version` 可返回 v5.1.4。当前不继续盲目重建容器，避免在 Docker server 不可用时反复操作。
- 残留风险：用户 Windows 既有浏览器仍可能有旧 404 disk/memory cache；本轮 in-app Browser 只能证明 fresh context 和当前 dev server 不再拿 404，不能替代用户在 Windows DevTools 对原浏览器 tab 的 cache 状态检查。Docker 恢复后应重建 `new-api:dev` 并重新验证 `/api/*` no-store header。
- 下一步：优先让用户在 Windows 浏览器 DevTools 勾选 Disable cache 后硬刷新或清站点缓存；若仍缺 `Cache-Control`，先修复 Docker Desktop/WSL server 可用性并执行 `docker compose -f docker-compose.dev.yml up -d --build new-api`，再复测 `3000/5173/5174` 的 `/api/affiliate/team` 状态与缓存头。

## P1-1 dev/prod 镜像治理复盘（2026-06-03 本线程）

- 完成内容：新增 `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`，明确 dev compose、生产 `Dockerfile`、官方 `calciumion/new-api:latest`、不可变 tag、compose override、发布前检查、dev 切回生产、上线 smoke、回滚和残留风险。
- 完成内容：新增 `docker-compose.prod.local.example.yml`，提供不含 secret 的生产应用镜像 override 示例，要求 `NEW_API_IMAGE` 必须是从当前仓库 `Dockerfile` 构建出的不可变 tag。更新根 `docker-compose.yml` 顶部注释，明确按原样使用会拉官方镜像，不包含本仓库分销二开。
- 完成内容：更新 `native-affiliate-dev-compose-runbook.zh-CN.md`，补充 dev `new-api:dev` 与生产镜像区别，说明 `5173`/`5174` 是前端 dev server，生产发布必须用根 `Dockerfile` 构建并嵌入 default/classic dist。
- 验证命令：`NEW_API_IMAGE=new-api-rain:test docker compose -f docker-compose.yml -f docker-compose.prod.local.example.yml config --quiet` 通过，证明 override 示例语法可被 compose 解析。
- 验证命令：`git diff --check` 通过；`git status --short --branch` 用于确认本轮只包含 P1 文档治理和 compose 示例改动。
- 残留风险：本轮没有实际构建生产镜像或连接外部 staging/生产环境，不能作为发布验收；后续真正上线仍需按 external acceptance runbook 验证真实充值、真实 relay 消耗、退款、结算和灰度。
- 下一步：进入 P1 分销管理规则表格化评估与实现，优先把 default/classic 的规则配置从 JSON textarea 转为运营友好的表格/矩阵，同时保留高级 JSON 导入导出。

## P1-2 分销管理规则表格化复盘（2026-06-03 本线程）

- 完成内容：将 default `RuleArrayEditor` / `RuleLevelGroupedEditor` 与 classic `RuleArrayEditor` / `RuleLevelGroupedEditor` 从“每条规则一张卡片”改为“每类规则一张可横向滚动编辑表格”。每张表按稳定字段顺序展示列，按分销等级分组时隐藏 `affiliate_level`，但底层仍写回原 JSON 字符串。
- 完成内容：保留 default 高级 JSON 模式与 classic 原始 JSON 文本模式；更新页面说明为“可编辑规则表格”；补 default 6 个 locale 与 classic 8 个 locale 的新增文案翻译。
- 完成内容：补 default `rule-array-editor.test.ts`，覆盖表格列顺序、隐藏分组字段、百分比和元字段在运营展示值与后端 bps/cents 之间可逆转换。
- RED/GREEN 验证：新增测试先因 `__ruleArrayEditorTestUtils` 未导出失败；实现后 `cd web/default && bun --bun test src/features/affiliate/rule-array-editor.test.ts src/features/affiliate/admin-lib.test.ts` 通过 17 项；`cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs` 通过 7 项。
- 构建验证：`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过；`git diff --check` 通过。
- 浏览器验证：使用 `runtime/smoke/node_modules/playwright` 和本地 secret 中 `super_admin` 做脱敏 API 登录 smoke，不输出密码/cookie。`http://127.0.0.1:5173/affiliate/admin` 与 `http://127.0.0.1:5174/console/affiliate/admin` 均登录成功；两端各有 12 张页面表格，其中各有 10 张匹配 `Default Rate (%)`、`Minimum Settlement Amount`、`Base Rate (%)`、`KPI Coefficient`、`Reward Amount`、`Gift-Only` 等分销规则字段的表格；页面文案均包含“可编辑规则表格”口径。
- i18n 注意：`web/default && bun run i18n:sync` 通过；`web/classic && bun run i18n:sync` 在当前依赖组合下失败，错误为 `react-i18next@17` 期待 `i18next.keyFromSelector` 但 classic 使用的 `i18next` 未提供该 export。本轮已手动补齐 classic locale，后续可单独治理 classic i18n CLI 版本匹配。
- 残留风险：当前表格是基于现有 JSON 字段的通用编辑表，不会强制新增“启停状态”等后端尚未固定的字段；导入/导出按钮、规则变更 diff 预览、复制上一版本、发布/覆盖二次确认仍待做。
- 下一步：继续 P1 结算可靠性，优先审计佣金、KPI、人头费和结算任务的无界扫描、幂等记录和可恢复 run record。

## P1-3 usage logs 分批扫描复盘（2026-06-04 本线程）

- 完成内容：新增 `service/affiliate_log_scan.go`，提供统一 `created_at,id` cursor scanner，默认批大小 500，测试可临时调小。scanner 每批查询都带 `LIMIT`，按 `created_at asc, id asc` 稳定推进。
- 完成内容：`BuildAffiliatePendingCommissionEvents` 的 source logs 与 prior paid logs、`BuildAffiliateKPISnapshots` 的 KPI usage logs、`BuildAffiliatePendingHeadFeeEvents` 的 paid stats usage logs 均改为 cursor 分批扫描。KPI 与 head fee 不再一次性把周期内 logs 全部载入 slice；commission source logs 本轮仍返回列表以保留累计 tier 逻辑，但查询侧已经从无界单次 `Find(&logs)` 改为 cursor 分批读取。
- RED/GREEN 验证：新增三个测试注册 GORM Query callback，任何针对 `logs` 表的无 `LIMIT` 查询都会失败；RED 阶段先因缺少 `affiliateLogScanBatchSize` 失败；实现后 `go test -count=1 ./service -run 'TestBuildAffiliatePendingCommissionEventsScansSourceLogsWithCursorLimit|TestBuildAffiliateKPISnapshotsScansUsageLogsWithCursorLimit|TestBuildAffiliatePendingHeadFeeEventsScansPaidLogsWithCursorLimit'` 通过。
- 回归验证：`go test -count=1 ./service -run 'Affiliate(Commission|KPI|HeadFee|Settlement)'` 通过；`go test -count=1 ./service ./controller ./router -run Affiliate` 通过；`git diff --check` 通过。
- 残留风险：本轮未新增 schema，因此未引入 run record 表；结算 event group 仍会一次性加载 pending commission/head fee events；commission 构建仍会把 source logs 累积成列表用于 prior cumulative 用户集合。后续需要继续做 job execution/run record、可恢复 cursor、dry-run/正式 run 双跑幂等和 settlement event group 分批。
- 下一步：继续 P1 结算可靠性，优先设计不泄漏敏感信息的 `affiliate_job_runs` 或等价 sidecar run record，并做 schema impact 复核后再实现。

## P1-4 settlement pipeline job run 复盘（2026-06-03 本线程）

- 完成内容：新增 `affiliate_job_runs` sidecar model，用于记录管理员 settlement pipeline 的 job execution。记录字段包含 job type、状态、幂等 key、规则集、周期、执行人、当前阶段、cursor 占位、KPI/commission/head fee/settlement 计数、脱敏 input/result/error snapshot、开始/结束时间。
- 完成内容：`RunAffiliateSettlementPipeline` 现在会先写 running job run，再按 `kpi`、`commission`、`head_fee`、`settlement`、`complete` 更新阶段和计数。成功时写 `succeeded`，失败时写 `failed` 和脱敏错误信息；result JSON 增加 `job_run_id`、`job_run_status`、`idempotency_key`。
- RED/GREEN 验证：先修改 model/table list 与 service 测试，RED 阶段分别失败于缺少 `affiliate_job_runs` 和 `AffiliateJobRun`/result 字段未定义；实现后 `go test -count=1 ./model -run 'AffiliateSidecar|MigrateDBCreatesAffiliateSidecar'` 与 `go test -count=1 ./service -run 'TestRunAffiliateSettlementPipelineRecordsJobRun|TestRunAffiliateSettlementPipelineBuilds|TestRunAffiliateSettlementPipelineRejects'` 通过。
- 回归验证：`go test -count=1 ./service -run 'Affiliate(Commission|KPI|HeadFee|Settlement)'` 通过；`go test -count=1 ./model -run 'QuotaSourceSidecar|AffiliateSidecarModels|AffiliateSidecarTableNames|MigrateDBCreatesAffiliateSidecar'` 通过。
- schema impact 复核：已更新 `native-affiliate-schema-impact-report.zh-CN.md`，确认代码侧只新增 `affiliate_job_runs` 这一 `affiliate_*` sidecar；本线程 `timeout 30s docker ps --filter 'name=new-api'` 未返回有效容器输出，因此未强行重建容器生成 PostgreSQL before/after diff。
- 残留风险：`affiliate_job_runs` 目前记录顶层 pipeline 阶段和计数，不支持真正从 cursor 恢复；`AdminGenerateAffiliateSettlements` 单独生成结算单的 endpoint 尚未写 job run；`GenerateAffiliateSettlements` 内部 pending/ready events 分组仍会一次性加载。
- 下一步：Docker/compose 恢复后补 `affiliate_job_runs` PostgreSQL schema diff；继续把 settlement event grouping 改为分批，并补完整双跑幂等审计。

## P1-5 settlement event grouping 分批扫描复盘（2026-06-03 本线程）

- 完成内容：`GenerateAffiliateSettlements` 中 pending commission events、pending head fee events、existing draft ready commission events、existing draft ready head fee events 均改为按 `id` cursor 分批扫描，默认批大小 500，测试可临时调小。
- RED/GREEN 验证：新增 `TestGenerateAffiliateSettlementsScansEventsWithCursorLimit`，先因缺少 `setAffiliateSettlementEventScanBatchSizeForTest` 失败；实现后测试注册 GORM Query callback，任何针对 `affiliate_commission_events` / `affiliate_head_fee_events` 的无 `LIMIT` 查询都会失败，目标测试通过。
- 回归验证：`go test -count=1 ./service -run TestGenerateAffiliateSettlementsScansEventsWithCursorLimit` 通过；`go test -count=1 ./service -run 'Affiliate(Commission|KPI|HeadFee|Settlement)'` 通过；`git diff --check` 通过。
- 残留风险：本轮解决事件表查询侧无界 `Find`，但每个 affiliate group 仍会累积 event IDs，`linkAffiliateSettlementEvents` 仍用单次 `id IN ?` 更新；超大结算周期仍需要继续把 link 更新拆成批次，并把 cursor 写入 `affiliate_job_runs` 以支持可恢复。
- 下一步：继续拆分 settlement event link updates，并为 `AdminGenerateAffiliateSettlements` 单独入口补 job run 或统一走 pipeline run record。

## P1-6 settlement event link 更新批量拆分复盘（2026-06-04 本线程）

- 完成内容：`linkAffiliateSettlementEvents` 不再对一个 affiliate group 的全部 commission/head fee event IDs 做单次 `id IN ?` 更新，改为按 settlement event batch size 分批更新，避免超大结算周期触发过长 SQL 或参数上限。
- RED/GREEN 验证：新增 `TestGenerateAffiliateSettlementsLinksEventsInBatches`，测试把批大小设为 2、种 3 条 commission 与 3 条 head fee event，并注册 GORM update callback 拒绝超过 2 个 ID 的 link 更新；RED 阶段当前实现失败于 `affiliate settlement link update used 3 ids, want <= 2`，实现后目标测试通过。
- 回归验证：`go test -count=1 ./service -run "TestGenerateAffiliateSettlementsLinksEventsInBatches|TestGenerateAffiliateSettlementsScansEventsWithCursorLimit"` 通过；`go test -count=1 ./service -run "Affiliate(Commission|KPI|HeadFee|Settlement)"` 通过；`go test -count=1 ./controller ./router -run Affiliate` 通过；`git diff --check` 通过。
- 残留风险：本轮只拆分 link 更新，不改变每个 affiliate group 内存中累积 event IDs 的结构；真正可恢复执行还需要把 cursor/progress 写入 `affiliate_job_runs`，并为 `AdminGenerateAffiliateSettlements` 单独入口补 job run 或统一走 pipeline run record。
- 下一步：继续做完整双跑幂等审计，验证重复执行同一周期不会重复计佣、重复发人头费或重复生成结算单。

## P1-7 settlement pipeline 重复运行幂等审计复盘（2026-06-04 本线程）

- 完成内容：新增 `TestRunAffiliateSettlementPipelineIsIdempotentForSamePeriod`，覆盖同一规则集、同一周期、同一输入重复运行 settlement pipeline。测试断言两次 run 返回同一个 draft settlement、payable 不变、idempotency key 一致，并且 KPI snapshot、commission events、head fee events、settlement 数据库行数不重复增长。
- 验证命令：`go test -count=1 ./service -run TestRunAffiliateSettlementPipelineIsIdempotentForSamePeriod` 通过，说明当前实现已满足 service 级同周期重复运行不重复计佣、不重复发人头费、不重复生成结算单。
- 回归验证：`go test -count=1 ./service -run "TestRunAffiliateSettlementPipelineIsIdempotentForSamePeriod|TestRunAffiliateSettlementPipelineRecordsJobRun|TestRunAffiliateSettlementPipelineBuilds"` 通过；`go test -count=1 ./service -run "Affiliate(Commission|KPI|HeadFee|Settlement)"` 通过；`git diff --check` 通过。
- 残留风险：该测试是本地 service 级审计，不替代外部完整结算周期双跑；外部验收仍需按 `native-affiliate-external-acceptance-runbook.zh-CN.md` 对真实 paid 消费、退款、人头费和外接控制台汇总做 dry-run/正式 run 对比。
- 下一步：继续补 refund、partial refund、gift-only、mixed paid/gift/trial、legacy_unknown、任务钱包扣费、异步任务退款等样本，或为 `AdminGenerateAffiliateSettlements` 单独入口补 job run。

## P1-8 paid source 与退款样本覆盖复盘（2026-06-04 本线程）

- 完成内容：新增 `TestBuildAffiliatePendingCommissionEventsUsesOnlyPaidFromMixedSourcesAndPartialRefund`，覆盖同一消费日志 sidecar 中 paid/gift/trial/legacy_unknown 混合时只按 paid 部分计正佣；同一退款日志 sidecar 中 paid/gift 混合时只按 paid 部分生成 clawback；显式 `quota_source=trial` 与无 sidecar 的 legacy_unknown 消费均不计佣。
- 验证命令：`go test -count=1 ./service -run "TestBuildAffiliatePendingCommissionEventsUsesOnlyPaidFromMixedSourcesAndPartialRefund|TestBuildAffiliatePendingCommissionEventsSkipsNonPaidAndCreatesRefundClawback|TestBuildAffiliatePendingCommissionEventsUsesQuotaSourceSidecarPaidPortion"` 通过，覆盖 refund、partial refund、gift、mixed paid/gift/trial/legacy_unknown 和 sidecar paid-only 口径。
- 验证命令：`go test -count=1 ./service -run "TestBuildAffiliateKPISnapshotsFallsBackWhenQualityGateFails|TestBuildAffiliateKPISnapshotsUsesQuotaSourceSidecar|TestBuildAffiliatePendingHeadFeeEventsSkipsUnqualifiedUsersAndDeduplicates|TestBuildAffiliatePendingHeadFeeEventsUsesQuotaSourceSidecar"` 通过，覆盖 gift-only KPI 质量门槛、quota sidecar KPI 和人头费 paid 统计。
- 验证命令：`go test -count=1 ./service -run "TestRefundTaskQuota_WalletRestoresSourceSegments|TestRecalculate_PositiveDelta_WalletWritesQuotaSourceSidecar"` 通过，覆盖任务钱包扣费和异步任务退款 source segment 回补。
- 回归验证：`go test -count=1 ./service -run "Affiliate(Commission|KPI|HeadFee|Settlement)"` 通过；`git diff --check` 通过。
- 残留风险：这些是本地 service/model 级样本，不替代真实支付、真实 relay、真实异步任务 provider 和生产/staging 退款链路 smoke；外部验收仍需确认真实 sidecar 事件持续写入。
- 下一步：继续复核 dashboard 净消耗统计、`AdminGenerateAffiliateSettlements` 单独入口 job run 或规则导入导出/diff 能力。

## P1-9 历史未标记日志 paid 排除策略复盘（2026-06-04 本线程）

- 完成内容：新增 `TestBuildAffiliateKPISnapshotsExcludesUnmarkedAndLegacyUnknownUsage`，覆盖无来源消费日志和 `legacy_unknown` sidecar 不进入 KPI paid 原始消耗、paid 净消耗、gift-only 质量流量或二次付费比例。
- 完成内容：新增 `TestBuildAffiliatePendingHeadFeeEventsExcludesUnmarkedAndLegacyUnknownUsage`，覆盖无来源消费日志和 `legacy_unknown` sidecar 即使存在 growth KPI snapshot 也不能触发人头费资格。
- 策略结论：历史未标记日志默认排除，不默认回退为 paid；需要补算时应走灰度回填或人工复核，把可信 paid 来源补写为 `paid` sidecar 后再重新结算。
- 验证命令：`go test -count=1 ./service -run "TestBuildAffiliateKPISnapshotsExcludesUnmarkedAndLegacyUnknownUsage|TestBuildAffiliatePendingHeadFeeEventsExcludesUnmarkedAndLegacyUnknownUsage"` 通过，说明当前实现已满足 unknown/legacy_unknown 不计 paid 的服务层口径。
- 回归验证：`go test -count=1 ./service -run "TestBuildAffiliateKPISnapshotsExcludesUnmarkedAndLegacyUnknownUsage|TestBuildAffiliatePendingHeadFeeEventsExcludesUnmarkedAndLegacyUnknownUsage|TestBuildAffiliatePendingCommissionEventsUsesOnlyPaidFromMixedSourcesAndPartialRefund"` 通过；`go test -count=1 ./service -run "Affiliate(Commission|KPI|HeadFee|Settlement)"` 通过；`git diff --check` 通过。
- 残留风险：该策略仍需在运营回填 runbook 中定义历史数据复核口径、抽样规则和回滚方式；外部验收仍需确认真实支付、relay、任务钱包和退款链路持续写入可信 source sidecar。
- 下一步：继续复核 `service/affiliate_summary.go` 的有效新用户统计是否需要套用飞书有效用户门槛，并完善 dashboard 前端 RMB 主单位展示。

## P1-10 dashboard paid 净消耗复盘（2026-06-04 本线程）

- RED：新增 `TestBuildAffiliateDashboardSummaryCountsPaidNetConsumptionOnly` 后，旧实现返回 `NetConsumptionQuota=16400`，暴露 dashboard 会把 gift、trial、legacy_unknown、无来源、abnormal 与 partial sidecar 原始 quota 一并汇总。
- 完成内容：`sumAffiliateNetConsumptionQuota` 从 SQL 原始 `SUM(quota)` 改为复用 `scanAffiliateLogsByCreatedAtCursor` 和 `resolveAffiliateLogQuotaAttribution`，只累计 `PaidRawQuota`；`affiliate_abnormal`/`abnormal` 日志直接跳过。
- 完成内容：既有 summary happy path 测试数据改为显式 `quota_source=paid`，controller scoped summary 测试库同步迁移 quota source sidecar，避免测试环境落后于当前 native affiliate schema。
- 验证命令：`go test -count=1 ./service -run "TestBuildAffiliateDashboardSummaryCountsPaidNetConsumptionOnly|TestBuildAffiliateDashboardSummaryForLevelOneScope|TestBuildAffiliateDashboardSummaryRejectsNoneScope"` 通过。
- 回归验证：`go test -count=1 ./service -run "AffiliateDashboardSummary|Affiliate(Commission|KPI|HeadFee|Settlement)"` 通过；`go test -count=1 ./controller -run "TestGetAffiliateSummaryReturnsScopedDashboard|TestGetAffiliateScopedLogs|TestGetAffiliateStatus"` 通过。
- 残留风险：有效新用户仍只是 affiliate invite event 去重，尚未套用飞书“有效用户”门槛；dashboard 前端 RMB 主单位和趋势口径还需继续复核。
- 下一步：复核有效新用户统计和 dashboard 前端展示，不要把运营口径只停留在后端 summary 层。

## P1-11 dashboard 有效新用户口径复盘（2026-06-04 本线程）

- RED：新增 `TestBuildAffiliateDashboardSummaryDoesNotTreatInvitesAsEffectiveWithoutRules` 与 `TestBuildAffiliateDashboardSummaryCountsOnlyQualifiedEffectiveNewUsers` 后，旧实现分别把无规则 invite 计为 1、把 mixed invitees 全部计为 6，确认 summary 只是 affiliate invite event 去重。
- 完成内容：`countAffiliateEffectiveNewUsers` 改为读取当前 published rule set 的同层级 head fee rules，取最低首充门槛、最低周期 paid 净付费门槛和资格天数作为 dashboard effective-user 基准；无 published 规则或无同层级 head fee rule 时返回 0，不再直接把 invite 算有效。
- 完成内容：每个 invitee 在邀请时间起的资格窗口内按 cursor 扫描 consume/refund 日志，复用 paid attribution；只有首笔 paid 消费达标、窗口 paid 净消耗达标、无 paid refund、无 `affiliate_abnormal`/`abnormal` 才计入有效新用户。
- 验证命令：`go test -count=1 ./service -run "TestBuildAffiliateDashboardSummaryDoesNotTreatInvitesAsEffectiveWithoutRules|TestBuildAffiliateDashboardSummaryCountsOnlyQualifiedEffectiveNewUsers|TestBuildAffiliateDashboardSummaryForLevelOneScope"` 通过。
- 回归验证：`go test -count=1 ./service -run "AffiliateDashboardSummary|Affiliate(Commission|KPI|HeadFee|Settlement)"` 通过；`go test -count=1 ./controller -run "TestGetAffiliateSummaryReturnsScopedDashboard|TestGetAffiliateScopedLogs|TestGetAffiliateStatus"` 通过；`git diff --check` 通过。
- 残留风险：本轮只修 dashboard summary；`service/affiliate_kpi.go` 的 KPI snapshot 有效新用户在当时仍按 invite event 去重。该缺口已在 2026-06-04 P1-15 收口。
- 下一步：继续复核 dashboard 前端 RMB 主单位和 default/classic 展示一致性。

## P1-12 dashboard 前端展示与 RMB 主单位复盘（2026-06-04 本线程）

- 完成内容：按项目 `.agents/skills/classic-to-default-sync`、`i18n-translate`、`shadcn-ui` 规则审计 classic/default；本轮未新增 UI 文案，故无需 i18n sync 或 shadcn 组件变更。
- 评估结论：分销商端不应整体表格化；当前 classic `/console/affiliate` 和 default `/affiliate` 都保持摘要卡片、推广关系树和 scoped logs 明细表组合，符合“卡片 + 树 + 表格明细”方向。
- 评估结论：管理端规则与指标配置适合表格化；现有 classic/default 规则表格和 default rule-array-editor helpers 已覆盖指标字段、人民币与百分比单位转换。结算审核完整表格 UI 仍保留为后续 finance/admin 任务。
- RMB 结论：classic dashboard card 以 `net_consumption_rmb`、`estimated_commission_rmb`、`head_fee_rmb`、`pending_settlement_rmb` 作为主值；default scoped logs 以 RMB 为单元格主显示，raw quota 只作为 title 或 CSV 附加列。
- 验证命令：`bun test web/classic/src/pages/Affiliate/affiliateDashboardCards.test.mjs web/classic/src/pages/Affiliate/affiliateViewState.test.mjs web/classic/src/hooks/usage-logs/usageLogsUrls.test.mjs` 通过，9 pass。
- 验证命令：`cd web/default && bun test src/features/affiliate/lib.test.ts src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts` 通过，25 pass。
- 回归验证：`git diff --check` 通过。
- 残留风险：分销商端趋势图还没有正式数据接口和 UI；管理端结算审核完整表格 UI、规则 import/export/diff/copy previous version 仍待做。
- 下一步：继续优先处理 KPI snapshot 有效用户口径、规则 import/export/diff，或为 `AdminGenerateAffiliateSettlements` 单独入口补 job run。

## P1-13 standalone settlement generate job run 复盘（2026-06-04 本线程）

- RED：新增 `TestGenerateAffiliateSettlementsWithJobRunRecordsSuccess` 与 `TestGenerateAffiliateSettlementsWithJobRunRecordsFailure` 后，旧代码因缺少 `GenerateAffiliateSettlementsWithJobRun` 和 `AffiliateJobRunTypeSettlementGenerate` 编译失败。
- 完成内容：新增 `settlement_generate` job type 和 `GenerateAffiliateSettlementsWithJobRun` wrapper，保留原 `GenerateAffiliateSettlements` 纯生成语义；standalone endpoint 生成 draft settlement 时写入 running/succeeded/failed job run。
- 完成内容：job run 记录 rule set、周期、actor、stage、started/finished、settlement_count、idempotency_key、input_snapshot 和 result/error snapshot；input 只记录 `has_reason`，不写 reason 原文，错误信息继续走敏感 KV 脱敏。
- 完成内容：`AdminGenerateAffiliateSettlements` 改为调用 wrapper，但响应仍返回 settlement list，避免破坏前端和旧调用方。
- 验证命令：`go test -count=1 ./service -run "TestGenerateAffiliateSettlementsWithJobRunRecords|TestGenerateAffiliateSettlementsCreatesDraftAndLinksEvents"` 通过。
- 验证命令：`go test -count=1 ./controller -run "TestAdminSettlementLifecycleGenerateFreezePay|TestAdminVoidAffiliateSettlement"` 通过。
- 残留风险：`affiliate_job_runs` 仍没有真正持久化 cursor/progress 以支持中断恢复；Docker PostgreSQL schema diff 仍待 Docker 恢复后补；外部完整周期 dry-run/正式 run 双跑仍待验收。
- 下一步：继续可恢复 cursor 设计，或先补规则 import/export/diff/copy previous version。

## P1-14 规则表格列完整性审计复盘（2026-06-04 本线程）

- 完成内容：复核 `service/affiliate_rules.go`、`model/affiliate.go`、default `rule-array-editor` 和 classic `RuleArrayEditor`，确认当前表格化实现是基于现有 JSON/input 字段动态生成列，不会凭空补齐后端尚未模型化的运营字段。
- 覆盖结论：KPI 档位表已覆盖层级、code、名称、有效新用户阈值、净付费消耗阈值、最终系数、质量门槛和排序；default/classic 均会把 `_bps` 字段展示为百分比，把 `_cents` 字段展示为元。
- 部分覆盖结论：佣金 tier 已覆盖净付费区间、基准比例、cap、人工审批和排序，但佣金规则启停状态没有进入 `AffiliateCommissionRuleInput`；人头费规则已覆盖金额、首充、周期净付费、资格天数和解锁天数，但没有启停字段。
- 缺口结论：本轮审计时风控规则只覆盖纯赠、异常、退款和二次付费率阈值，尚未把自刷/批量异常策略和处理动作模型化；结算配置只覆盖周期、冻结天数、最低结算金额和人工复核开关，尚无自动结算开关与备注。上述风控缺口已在 P1-30 收口，结算配置缺口已在 P1-29 收口。
- 测试现状：default `rule-array-editor.test.ts` 当前覆盖稳定列顺序、隐藏分组字段和元/百分比双向转换；classic `affiliateAdminRules.test.mjs` 当前覆盖 draft payload、默认 seed 和状态 helper。两端尚未用业务列完整性测试固化上述缺口。
- 验证命令：`rg -n "CommissionRuleInput|AffiliateCommissionRule\\{|Status|SettlementRuleConfig|ManualReviewEnabled|RiskRuleInput|Metadata" service/affiliate_rules.go web/default/src/features/affiliate web/classic/src/pages/AffiliateAdmin model/affiliate.go docs/affiliate/native-affiliate-followup-tasklist.zh-CN.md` 用于确认字段来源；`git diff --check` 通过。
- 下一步：若继续做规则配置 P1，应优先 TDD 增加业务列完整性测试，再决定是否新增启停字段、风控动作、自动结算开关、备注、diff 预览、导入导出和复制上一版本。

## P1-15 KPI snapshot 有效新用户口径复盘（2026-06-04 本线程）

- RED：新增 `TestBuildAffiliateKPISnapshotsCountsOnlyQualifiedEffectiveNewUsers` 后，旧实现把 6 个 affiliate invite event 全部计为 `EffectiveNewUserCount=6`，没有校验首充、周期 paid 净付费、退款、异常和资格窗口。
- 完成内容：抽出 dashboard 已验证的 effective-user 资格 helper，KPI snapshot 现在按当前 rule set 和分销等级读取同层级 head fee 门槛，并逐个 invitee 校验首笔 paid 消费、资格窗口内 paid 净消耗、无 paid refund、无 `affiliate_abnormal`/`abnormal`。
- 完成内容：`countAffiliateKPIEffectiveNewUsers` 不再做 `Distinct(invitee_user_id)` 计数，改为加载 invite events 后按去重 invitee 逐个判定；无同层级 head fee rule 时返回 0，避免把纯邀请当作有效新用户。
- 测试调整：KPI 质量比例仍沿用现有 `EffectiveNewUserCount` 分母；修正 effective 口径后，已有 gift-only 测试中的 1 个 gift-only 用户相对 1 个合格 effective user 变为 100% 质量比例，相关断言已同步。
- 验证命令：`go test -count=1 ./service -run "TestBuildAffiliateKPISnapshots(CountsOnlyQualifiedEffectiveNewUsers|SelectsQualifiedTier|FallsBackWhenQualityGateFails|UsesQuotaSourceSidecar|ExcludesUnmarkedAndLegacyUnknownUsage|ScansUsageLogsWithCursorLimit)"` 通过。
- 回归验证：`go test -count=1 ./service -run "AffiliateDashboardSummary|Affiliate(Commission|KPI|HeadFee|Settlement)"` 通过；`go test -count=1 ./controller -run "TestGetAffiliateSummaryReturnsScopedDashboard|TestAdminSettlementLifecycleGenerateFreezePay"` 通过；`git diff --check` 通过。
- 残留风险：gift-only、abnormal 和 second-payment 质量比例目前仍使用 existing KPI 统计语义，未单独切换为“总 invitee 数”或“全 team user 数”分母；如果飞书最终口径要求不同，需要另开 TDD 任务调整分母并重验 KPI tier 降档。
- 下一步：继续规则 import/export/diff/copy previous version，或做 `affiliate_job_runs` 可恢复 cursor/progress。

## P1-16 规则导入导出、diff 与复制上一版本复盘（2026-06-04 本线程）

- RED：先在 default `admin-lib.test.ts` 和 classic `affiliateAdminRules.test.mjs` 增加导出、导入、复制上一版本和 diff 预览测试；旧实现因 `buildAffiliateRuleSetDiffPreview` 等 helper 未导出失败，确认测试覆盖新增能力而不是既有行为。
- 完成内容：default/classic 均新增规则草稿导出 JSON、导入 JSON、复制上一版本和稳定 JSON diff helper。导出会先走现有 draft payload 归一化并移除 `id`、`reason` 等操作字段；导入会清理 `id`、`reason`，保留版本、名称、结算配置和五类规则 JSON；复制上一版本会清空 ID/原因并给版本追加 `-copy`。
- 完成内容：default 管理页在规则集列表增加行级 `Copy Draft`，规则草稿表单增加 `Rule Import / Export JSON`、`Rule Draft Diff Preview`、`Export Draft JSON` 和 `Import Draft JSON`。diff 面板基于选中版本 baseline 与当前草稿对比，并对半截 JSON 输入容错，避免渲染期抛错。
- 完成内容：classic 管理页保持 Semi Design 风格，规则集列表增加“复制草稿”，表单增加“规则导入 / 导出 JSON”“规则草稿差异预览”“导出 JSON”“导入 JSON”“预览变更”。classic 通过 Form API 获取当前草稿值，避免导入导出文本进入保存 payload。
- i18n/技能：本轮使用 `classic-to-default-sync`、`i18n-translate` 和 `shadcn-ui` 约束；`cd web/default && bun run i18n:sync` 后 en/fr/ja/ru/vi/zh 的 missing/extras/untranslated 均为 0，未产生 locale 文件 diff。
- 验证命令：RED 阶段 `cd web/default && bun test src/features/affiliate/admin-lib.test.ts` 与 `bun test web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs` 均因 helper 未导出失败；GREEN 后 default 18 pass、classic 10 pass。
- 回归验证：`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过；`git diff --check` 通过。
- 浏览器验证：in-app Browser 未登录打开 `http://127.0.0.1:5173/affiliate/admin` 跳转 `/sign-in?redirect=%2Faffiliate%2Fadmin`，default console warning/error 为 0；未登录打开 `http://127.0.0.1:5174/console/affiliate/admin` 跳转 `/login?expired=true`，console 只出现登录过期提示。
- 脱敏登录 smoke：临时 `/tmp` Playwright 脚本读取 `.codex-local/affiliate-test-accounts.secret.json` 的 `super_admin` 但不输出账号、密码、cookie 或响应体。登录后 default 与 classic 的导入/导出/diff 面板均可见；当前本地规则集列表接口 `total=0`，因此行级复制按钮无数据行可渲染，复制行为由 helper 测试覆盖。classic 页面仍有 2 条既有 React DOM prop warning（`rangeSeparatorNode`、`iconOnly`），与本轮分销规则面板无直接关系。
- 残留风险：本轮没有实现已发布版本只读查看、发布/归档/回滚二次确认，也没有新增后端未模型化字段（佣金启停、人头费启停、风控动作、自动结算开关、备注）。当前 diff 对规则数组只给出 section changed，不做逐字段明细 diff；后续如运营需要发布审批，可升级为字段级 diff 和确认弹窗。
- 下一步：优先在规则管理上补发布/归档二次确认与已发布版本只读查看，或继续推进 `affiliate_job_runs` 可恢复 cursor/progress 和外部结算周期 dry-run/正式 run 双跑。

## P1-17 规则只读查看与发布确认复盘（2026-06-04 本线程）

- RED：default `admin-lib.test.ts` 和 classic `affiliateAdminRules.test.mjs` 先新增 `isAffiliateRuleSetReadOnly` 与 `buildAffiliateRuleSetStatusConfirmation` 断言；旧代码因 helper 未导出失败，确认测试覆盖只读状态和发布/归档确认文案。
- 完成内容：default/classic 均把 `published` 与 `archived` 规则集识别为只读；列表行操作从编辑切换为查看，规则草稿表单标题、说明、输入、表格编辑器、JSON textarea、导入和保存按钮均进入只读状态；导出 JSON 和复制为草稿仍可用，避免运营必须修改已发布版本。
- 完成内容：default/classic 发布和归档动作增加 `window.confirm` 二次确认，确认文案包含规则版本或 ID；取消确认时不会调用状态变更 API。
- 完成内容：default `RuleArrayEditor` 与 classic `RuleArrayEditor` 新增 `readOnly` 参数，隐藏新增/删除操作并禁用字段编辑；页面层在新建和复制草稿时自动恢复可编辑状态。
- i18n：补齐 default en/fr/ja/ru/vi/zh 6 个 locale 的只读标题、说明、按钮、toast 和发布/归档确认文案；`cd web/default && bun run i18n:sync` 后报告显示全部 locale 的 missing/extras/untranslated 均为 0。
- 验证命令：`cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts` 通过，21 pass；`bun test web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs` 通过，11 pass。
- 构建验证：`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过。
- 浏览器验证：临时 `/tmp` Playwright 脚本读取本地 `super_admin` 测试账号但不输出账号、密码、cookie 或响应体；mock 规则集接口返回一个 `published` 和一个 `draft` 版本后，default 与 classic 均能进入只读视图、保存按钮禁用，草稿发布确认弹窗出现且取消后不提交状态变更。
- 残留风险：本轮只补前端只读保护和发布/归档确认，未新增后端层面的 published/archived 保存拒绝测试；规则 diff 仍是 section 级摘要，不是字段级发布审批 diff。
- 下一步：继续补覆盖保存确认、规则回滚确认与后端不可变保护，或转入 `affiliate_job_runs` 可恢复 cursor/progress 和外部结算周期 dry-run/正式 run 双跑。

## P1-18 规则覆盖保存确认复盘（2026-06-04 本线程）

- RED：default `admin-lib.test.ts` 与 classic `affiliateAdminRules.test.mjs` 先新增覆盖保存确认 helper 测试；旧代码因 `buildAffiliateRuleSetSaveConfirmation` 未导出失败，确认测试能捕捉缺失行为。
- 完成内容：default/classic 新增覆盖保存确认文案 helper；保存已有草稿规则集时会根据规则版本或 ID 弹出二次确认，取消确认则不提交保存请求；新建草稿和复制为新草稿不弹覆盖确认。
- 完成内容：default 保存流程按 payload `id > 0` 判断覆盖保存；classic 保存流程按 payload/selected rule set ID 判断覆盖保存，保持两个前端功能 parity。
- i18n：补齐 default en/fr/ja/ru/vi/zh 6 个 locale 的覆盖保存确认文案；`cd web/default && bun run i18n:sync` 后报告显示全部 locale 的 missing/extras/untranslated 均为 0，且新增 key 在 6 个 locale 中均存在。
- 验证命令：先观察 `cd web/default && bun test src/features/affiliate/admin-lib.test.ts` 和 `bun test web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs` RED，失败原因均为 `buildAffiliateRuleSetSaveConfirmation` 未导出；实现后 `cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts` 通过，22 pass；`bun test web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs` 通过，12 pass。
- 构建验证：`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过。
- 残留风险：本轮未做浏览器级保存点击 smoke，覆盖确认由 helper 测试、页面保存流程接入和构建验证覆盖；规则回滚二次确认仍未实现。
- 下一步：推进规则回滚能力/确认，或转入 `affiliate_job_runs` 可恢复 cursor/progress。

## P1-19 后端规则不可变保护测试复盘（2026-06-04 本线程）

- 完成内容：补充 service 层专门测试 `TestSaveAffiliateRuleSetDraftRejectsPublishedOrArchivedOverwrite`，覆盖 published 与 archived 规则集不能按 `id` 覆盖保存，也不能按相同 `version` 覆盖保存。
- 完成内容：测试同时确认拒绝覆盖后 published/archived 规则集的状态和版本仍保持不变，避免前端只读保护被绕过后污染已发布或已归档版本。
- 实现说明：生产 service 当前已有基础不可变保护，按 `id` 保存仅允许 `draft`，按 `version` 保存遇到非 draft 会拒绝；本轮未改生产逻辑，只补专门回归测试。
- 验证命令：`go test -count=1 ./service -run "TestSaveAffiliateRuleSetDraftRejectsPublishedOrArchivedOverwrite|TestSaveAffiliateRuleSetDraftPersistsConfigAndAudit|TestPublishAffiliateRuleSetArchivesPreviousPublished|TestArchiveAffiliateRuleSetSetsArchivedAndAudits"` 通过。
- 回归验证：`go test -count=1 ./service -run "AffiliateRuleSet|RuleSet"` 通过；`go test -count=1 ./controller -run "AffiliateRuleSet|AdminSaveAffiliateRuleSetDraft|AdminPublishAffiliateRuleSet|AdminListAffiliateRuleSets"` 通过。
- 残留风险：后端尚无单独“回滚”能力与二次确认链路；如果后续新增 rollback endpoint，需要同步补状态机、审计和不可变版本测试。
- 下一步：继续规则回滚能力/确认，或推进 `affiliate_job_runs` 可恢复 cursor/progress。

## P1-20 规则回滚草稿与二次确认复盘（2026-06-04 本线程）

- RED：先在 service 层新增 `TestRollbackAffiliateRuleSetToDraftCopiesPublishedSnapshot` 和 `TestRollbackAffiliateRuleSetToDraftRejectsDraftSourceAndDuplicateVersion`；旧代码因缺少 `RollbackAffiliateRuleSetToDraft`、`AffiliateRuleSetRollbackInput` 和 `rollback_rule_set` 审计动作编译失败。controller 测试同样先因缺少 `AdminRollbackAffiliateRuleSetToDraft` 失败；default/classic helper 测试先因缺少 rollback payload/confirmation helper 失败。
- 完成内容：新增后端 `POST /api/affiliate/admin/rule-sets/:id/rollback-draft`，只允许从 `published` 或 `archived` 规则集创建新的 `draft`；源规则集保持不可变，新草稿复制持久化子配置，使用新的 `version`、`name` 和操作人，并写入 `rollback_rule_set` 配置审计。
- 完成内容：default 与 classic 规则集列表对 published/archived 行增加“回滚草稿”动作；点击前必须二次确认，确认后调用后端创建新 draft，并把新草稿回填到当前规则表单基线以便继续编辑或发布。
- 完成内容：default 新增 `AffiliateRuleSetRollbackPayload`、API wrapper、helper 和 en/fr/ja/ru/vi/zh locale；classic 同步新增 Semi 页面 helper 和 API 调用，保持功能 parity。
- 验证命令：RED 阶段 `go test -count=1 ./service -run "RollbackAffiliateRuleSet|RuleSet"`、`go test -count=1 ./controller -run "AdminRollbackAffiliateRuleSet|AffiliateRuleSet"`、`cd web/default && bun test src/features/affiliate/admin-lib.test.ts`、`bun test web/classic/src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs` 均按预期失败；实现后同组测试通过，default admin helper 21 pass，classic rule helper 13 pass。
- 回归验证：`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter"` 通过；`cd web/default && bun run i18n:sync && bun run build` 通过且 locale 报告 missing/extras/untranslated 均为 0；`cd web/classic && bun run build` 通过；`git diff --check` 通过。
- 残留风险：本轮回滚语义是“复制历史版本为新草稿”，不会直接把历史版本重新发布；运营仍需查看 diff 后手动发布。重复点击同一历史版本会因默认 `-rollback` version 已存在而被后端拒绝，后续如需要多次回滚草稿，可在前端增加版本后缀输入或时间戳策略。
- 下一步：继续推进 `affiliate_job_runs` 可恢复 cursor/progress 和 Docker PostgreSQL schema diff，或补规则模型未覆盖的启停/备注/风控动作/自动结算开关字段。

## P1-21 affiliate_job_runs 扫描进度持久化复盘（2026-06-04 本线程）

- RED：先在 `TestRunAffiliateSettlementPipelineRecordsJobRunSuccess` 断言 pipeline 成功后保留最后日志 cursor；旧实现因 `finishAffiliateJobRunSuccess` 把 `last_cursor_created_at` 与 `last_cursor_id` 清零而失败。再在 `TestGenerateAffiliateSettlementsWithJobRunRecordsSuccess` 断言 standalone `settlement_generate` job run 保留 settlement event id cursor；旧实现没有在 generate 扫描中写 cursor，断言失败。
- 完成内容：新增内部 cursor 更新 helper，复用既有 `affiliate_job_runs.last_cursor_created_at` 与 `last_cursor_id` 字段，不修改 GORM model 和 schema。KPI、commission、head fee 的日志扫描批次完成后写入当前 stage 和最后 `created_at,id`；settlement pending event 扫描完成后写入当前 stage 和最后 event id。
- 完成内容：pipeline run 把 `JobRunId` 传入 KPI、佣金、人头费和结算构建输入；standalone `GenerateAffiliateSettlementsWithJobRun` 在创建 job run 后把 `JobRunId` 传入 `GenerateAffiliateSettlements`，从而让 `settlement_generate` 也记录扫描进度。
- 完成内容：成功完成 job run 时不再清零 cursor，保留最后扫描位置用于审计和后续 resume 设计参考；失败路径仍保留当前失败 stage 和脱敏 error snapshot。
- 验证命令：RED 阶段 `go test -count=1 ./service -run "TestRunAffiliateSettlementPipelineRecordsJobRunSuccess|TestGenerateAffiliateSettlementsWithJobRunRecordsSuccess"` 因 cursor 为 0 失败；实现后同命令通过。
- 回归验证：`go test -count=1 ./service -run "AffiliateSettlementPipeline|SettlementRun|GenerateAffiliateSettlements|AffiliateSettlement|AffiliateKPI|KPISnapshot|AffiliatePendingCommission|CommissionEvents|Commission|AffiliateHeadFee|HeadFee"` 通过。
- 残留风险：本轮实现的是扫描进度持久化，不是完整中断恢复。`last_cursor_id` 在 settlement stage 可能对应 commission event 或 head fee event 两类表之一，现有 schema 没有单独 cursor type 字段；真正 resume 需要设计 stage-specific cursor payload 或 result snapshot，并验证幂等重入边界。
- 下一步：继续设计真正可恢复 resume 语义，或在 Docker/compose 恢复后补 `affiliate_job_runs` PostgreSQL schema diff。

## P2-1 默认 rule set seed 复盘（2026-06-04 本线程）

- RED：先新增 `TestDefaultAffiliateRuleSetSeedUsesOperationalUnitConversions`、`TestDefaultAffiliateRuleSetSeedCommissionTiersHaveNoOverlapAndNoGap`、`TestDefaultAffiliateRuleSetSeedCanBePublishedAndRemainImmutable`；旧代码因缺少 `BuildDefaultAffiliateRuleSetDraftInput` 编译失败。再新增 `TestAdminGetAffiliateRuleSetDefaultSeed`；旧代码因缺少 `AdminGetAffiliateRuleSetDefaultSeed` 编译失败。
- 完成内容：新增服务层默认 seed helper，把当前 master plan 中沉淀的飞书默认值以运营单位“元/百分比/系数”写入，再转换为内部 `cents`、`bps` 和 KPI 系数 bps，避免散落手工输入。默认 seed 覆盖两级佣金规则、10 段佣金 tier、8 个 KPI tier、8 条人头费规则、两级风控规则和月结配置。
- 完成内容：新增 admin 只读接口 `GET /api/affiliate/admin/rule-sets/default-seed`，返回同一份服务层 seed；可通过 `version` query 指定草稿版本，操作人使用当前 admin id，后续仍通过既有 `POST /api/affiliate/admin/rule-sets/draft` 保存为规则集版本。
- 验证命令：RED 阶段 `go test -count=1 ./service -run "DefaultAffiliateRuleSetSeed"` 因 helper 未定义失败；`go test -count=1 ./controller -run "DefaultSeed"` 因 controller 未定义失败。实现后同两条命令均通过。
- 回归验证：`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter"` 通过；`git diff --check` 通过。新增 admin seed route 未影响既有规则集保存、发布、归档、回滚、结算和路由测试。
- 残留风险：本轮没有重新读取外部飞书最新资料，只把当前 `native-affiliate-master-plan.zh-CN.md` 已沉淀的默认值固化为 seed；第 7 节中“重新核对飞书方案”的 paid 口径、有效新用户、档位和赠送额度差异仍保留未完成。
- 下一步：提交本轮 seed 变更；后续如要减少前后端默认 seed 漂移，可让 default/classic 新建草稿优先拉取 admin seed API，并保留本地 seed 作为离线 fallback。

## P1-22 failed job run 原地恢复复盘（2026-06-04 本线程）

- RED：先新增 `TestRunAffiliateSettlementPipelineResumesFailedJobRunForSameIdempotencyKey` 与 `TestGenerateAffiliateSettlementsWithJobRunResumesFailedJobRunForSameIdempotencyKey`；旧实现第二次执行同参数时会创建新的 `affiliate_job_runs` 记录，失败断言显示 `JobRunId` 从 1 变为 2。
- 完成内容：pipeline 与 standalone settlement generate 创建 job run 前先按 `job_type + idempotency_key + failed status` 查找最近失败记录；命中后把同一记录重置为 `running`、清空错误和旧计数，并刷新 actor、input snapshot、started_at，再复用既有幂等阶段重跑。2026-06-04 P1-31 已修正 failed resume 初始化清空 cursor payload 的问题，改为保留 typed cursor 供后续跳扫式 resume 使用。
- 语义说明：本轮只复用 `failed` job run，不复用 `succeeded` job run，因此成功后重复执行仍会保留新的成功审计记录；当时也不复用 `running` job run，避免误抢正在执行的任务。`running` active/stale 语义已在 P1-24 收口。
- 验证命令：RED 阶段 `go test -count=1 ./service -run "ResumesFailedJobRunForSameIdempotencyKey"` 失败；实现后同命令通过。
- 回归验证：`go test -count=1 ./service -run "RunAffiliateSettlementPipeline(IsIdempotent|RecordsJobRun|ResumesFailed)|GenerateAffiliateSettlementsWithJobRun(Records|ResumesFailed)|GenerateAffiliateSettlements"` 通过，确认成功重复运行审计语义和 settlement generate 既有行为未被破坏。`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter|JobRun"` 通过；`git diff --check` 通过。
- 残留风险：这不是 cursor 跳扫式 resume，而是“失败记录原地重启 + 幂等重跑”；stage-specific cursor payload、按 cursor 跳过已完成扫描和 Docker PostgreSQL schema diff 仍需后续补。
- 下一步：提交本轮 failed job run resume 变更；之后优先补 Docker schema diff，或设计 stage-specific cursor payload。

## P1-23 Docker schema diff 阻塞记录（2026-06-04 本线程）

- 取证命令：`timeout 8s docker ps --filter "name=new-api" --format "{{.Names}} {{.Status}}"` 在 WSL 内返回 code 1，8 秒内无有效容器状态输出。
- 结论：当前 Docker 运行态仍不可用，无法基于本地 PostgreSQL 容器导出 native affiliate sidecar schema diff；本轮不继续重复 Docker probe，避免无效等待。
- 残留风险：`affiliate_job_runs` 相关字段已经在 Go model 中使用，但 Docker PostgreSQL baseline/schema impact 仍需要在 Docker 恢复后补验，尤其要确认 sidecar 表结构和索引符合预期。
- 下一步：Docker 恢复后优先执行 dev compose 状态检查、PostgreSQL schema 导出和 `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md` 更新。

## P1-24 running job run stale lease 复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineRejectsActiveRunningJobRunForSameIdempotencyKey`、`TestRunAffiliateSettlementPipelineResumesStaleRunningJobRunForSameIdempotencyKey` 和 `TestGenerateAffiliateSettlementsWithJobRunResumesStaleRunningJobRunForSameIdempotencyKey`；旧实现因缺少 stale 阈值和 running lease 语义失败。
- 完成内容：`createAffiliateSettlementPipelineJobRun` 与 `createAffiliateSettlementGenerateJobRun` 创建新 job run 前先检查同 `job_type + idempotency_key` 的 running 记录；6 小时内有 activity 的 active running 直接返回 already running 错误，不创建重复执行；超过 6 小时无 activity 的 stale running 原地重置为新 running 后幂等重跑。
- 语义说明：stale 判断基于 `UpdatedAt` 优先、`StartedAt` 兜底；stale 接管使用同一 `affiliate_job_runs` 行，不新增 schema，不保存敏感输入；成功重复运行仍不复用 succeeded 行，继续保留每次成功执行的审计记录。
- 验证命令：RED 阶段 `go test -count=1 ./service -run "(ActiveRunningJobRun|StaleRunningJobRun)"` 编译失败于缺少 `affiliateJobRunStaleAfterSeconds`；实现后同命令通过。
- 回归验证：`go test -count=1 ./service -run "RunAffiliateSettlementPipeline(IsIdempotent|RecordsJobRun|ResumesFailed|RejectsActive|ResumesStale)|GenerateAffiliateSettlementsWithJobRun(Records|ResumesFailed|ResumesStale)|GenerateAffiliateSettlements"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter|JobRun"` 通过；`git diff --check` 通过。
- 残留风险：本轮仍不是 cursor 跳扫式 resume，而是 active-running 防并发与 stale-running 原地重跑；stage-specific cursor payload、按 cursor 跳过已完成扫描、Docker PostgreSQL schema diff 和外部完整周期 dry-run/正式 run 双跑仍待做。

## P1-25 stage-specific cursor payload 复盘（2026-06-04 本线程）

- RED：新增 `TestGenerateAffiliateSettlementsWithJobRunPreservesStageCursorOnFailure`，强制 settlement generate 在 commission event 扫描完成、head fee event 查询开始时失败；旧实现因为 grouping cursor 写在同一事务内被 rollback，失败 job run 的 `last_cursor_id=0` 且 `result_snapshot` 只有 `{"status":"failed"}`。
- 完成内容：job run cursor 更新现在会把带类型的 cursor 写入 `result_snapshot`，包括 `kpi_log_id`、`commission_log_id`、`head_fee_log_id`、`settlement_commission_event_id` 和 `settlement_head_fee_event_id` 等字段；failure snapshot 会合并并保留这些 cursor 字段，不再只写 status。
- 完成内容：`GenerateAffiliateSettlements` 先在事务外读取 rule set、扫描 pending events、构建 settlement event groups 并写 job run cursor；随后只把 draft settlement upsert 和 event link 放进事务。这样 grouping 阶段失败不会回滚已完成的 job run cursor 审计。
- 语义说明：本轮解决的是 cursor 类型不明确和失败 rollback 丢 cursor 的问题，不直接按 cursor 跳过已完成扫描。当前 KPI、佣金和人头费仍有内存聚合，直接跳过 cursor 前数据会丢聚合状态，必须后续设计 stage-specific aggregate payload 或批次级 side effect 后再做真正跳扫 resume。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestGenerateAffiliateSettlementsWithJobRunPreservesStageCursorOnFailure` 失败；实现后同命令通过。
- 回归验证：`go test -count=1 ./service -run "GenerateAffiliateSettlementsWithJobRun|GenerateAffiliateSettlements|RunAffiliateSettlementPipeline(IsIdempotent|RecordsJobRun|ResumesFailed|RejectsActive|ResumesStale)"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter|JobRun"` 通过；`git diff --check` 通过。
- 残留风险：cursor 跳扫式 resume 仍未完成；Docker PostgreSQL schema diff 和外部完整周期 dry-run/正式 run 双跑仍待做。

## P1-26 佣金规则启停状态复盘（2026-06-04 本线程）

- RED：先补 `TestSaveAffiliateRuleSetDraftPersistsCommissionRuleStatus`、`TestBuildAffiliatePendingCommissionEventsSkipsDisabledCommissionRuleLevel`，以及 default admin seed helper 对 commission rule `status` 的断言；旧实现因 `AffiliateCommissionRuleInput` 没有 `status` 编译失败，前端 fallback seed 也不会带 active 状态。
- 完成内容：佣金规则输入新增 `status`，保存草稿时规范化并校验 `active/disabled`，持久化到既有 `affiliate_commission_rules.status` 字段；从已发布/已归档版本复制为草稿时保留原状态；默认 seed 与 default 前端 fallback seed 都显式写入 active。
- 完成内容：佣金事件构建只查询 active 的佣金规则；如果某一层级佣金规则被 disabled，则跳过该层级关系，不再因为找不到 active rule 而让整次佣金构建失败。
- 验证命令：`go test -count=1 ./service -run "DefaultAffiliateRuleSetSeedUsesOperationalUnitConversions|CommissionRuleStatus|SkipsDisabledCommissionRuleLevel"` 通过；`cd web/default && bun test src/features/affiliate/admin-lib.test.ts --test-name-pattern "default seed"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Admin|Inviter|JobRun"` 通过；`cd web/default && bun test src/features/affiliate/admin-lib.test.ts` 通过。
- 残留风险：本轮只补佣金规则已有 schema 能承载的状态字段，不给人头费规则、风控规则或结算配置强行新增 status/动作字段；default/classic 的动态表格应能从 snapshot 字段生成 status 列，但仍需浏览器 smoke 确认历史规则、默认 seed 和编辑保存的完整运营体验。

## P1-27 佣金规则状态表格 parity 复盘（2026-06-04 本线程）

- RED：先补 default `rule-array-editor.test.ts`，要求 `status` 在佣金规则表中作为固定运营列展示在 `name` 后、费率字段前；旧实现把未知 `status` 排到末尾。再补 classic `ruleArrayEditor.test.mjs`，旧实现没有导出表格 helper。随后补 default/classic admin rules 测试，要求旧 snapshot、导入 JSON 和复制历史规则集时，缺失 `commission_rules.status` 的规则自动在表单中显示为 `active`；旧实现三处均缺 status。
- 完成内容：default/classic `RuleArrayEditor` 都把 `status` 加入 `RULE_FIELD_LABELS` 和固定列顺序，并保持字符串值编辑转换；classic 同步导出测试 helper 以锁定 parity。default/classic admin rule helper 新增 `normalizeCommissionRulesForForm`，只在表单展示/编辑入口为缺失 status 的佣金规则补 `active`，不覆盖已有 `disabled`，也不强行给人头费、风控或结算配置新增未模型化字段。
- 验证命令：`cd web/default && bun test src/features/affiliate/rule-array-editor.test.ts src/features/affiliate/admin-lib.test.ts` 通过，24 pass；`cd web/classic && bun test src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs` 通过，14 pass；`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过；`git diff --check` 通过。
- 浏览器 smoke：in-app Browser 打开 `http://127.0.0.1:5173/affiliate/admin` 未登录正常跳转到 default sign-in；打开 `http://127.0.0.1:5174/console/affiliate/admin` 未登录正常跳转到 classic login，控制台错误为既有未登录/登录过期提示，不是本轮 RuleArrayEditor 运行时异常。
- 残留风险：本轮只收口佣金规则已有 `status` 字段在运营表格中的显示与历史快照兼容；人头费规则启停已在 P1-28 收口，结算自动开关和备注已在 P1-29 收口，风控处理动作已在 P1-30 收口。Docker engine 当前仍不可查询，未做登录态管理员真实点击保存 smoke。

## P1-28 人头费规则启停状态复盘（2026-06-04 本线程）

- RED：先补 `TestSaveAffiliateRuleSetDraftPersistsHeadFeeRuleStatus` 和 `TestBuildAffiliatePendingHeadFeeEventsSkipsDisabledHeadFeeRule`；旧实现因 `AffiliateHeadFeeRuleInput` 与 `AffiliateHeadFeeRule` 都没有 `Status` 编译失败。再补 default/classic admin rules 测试，要求旧 snapshot、导入 JSON、复制历史规则集和默认 seed 中缺失 `head_fee_rules.status` 的规则自动在表单中显示为 `active`；旧实现这些入口均缺 status。
- 完成内容：人头费规则输入新增 `status`，保存草稿时规范化并校验 `active/disabled`，持久化到新增 sidecar 字段 `affiliate_head_fee_rules.status`；从已发布/已归档版本复制为草稿时保留原状态；默认 seed 与 default/classic 前端 fallback seed 都显式回填 active。人头费事件构建只查询 active 的人头费规则；如果某个 KPI 档位人头费规则被 disabled，则跳过该档位，不再生成 pending head fee event。
- schema impact：本轮修改 GORM sidecar model，只新增 `affiliate_head_fee_rules.status` 字段，仍不改官方核心表。`go test -count=1 ./model ./service -run "AffiliateSidecar|MigrateDBCreatesAffiliateSidecar|AffiliateRuleSet|HeadFee|DefaultAffiliateRuleSetSeed|CommissionRuleStatus"` 已覆盖 SQLite AutoMigrate 与 service 行为；Docker engine 当前仍不可用，PostgreSQL before/after diff 需恢复后补。
- 验证命令：`go test -count=1 ./service -run "HeadFeeRuleStatus|DisabledHeadFeeRule"` 先 RED 后 GREEN；`cd web/default && bun test src/features/affiliate/admin-lib.test.ts --test-name-pattern "hydrates|imports|copies"` 先 RED 后 GREEN；`cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs --test-name-pattern "hydrates|imports|copies|default seed"` 先 RED 后 GREEN。完整相关验证：`go test -count=1 ./model ./service -run "AffiliateSidecar|MigrateDBCreatesAffiliateSidecar|AffiliateRuleSet|HeadFee|DefaultAffiliateRuleSetSeed|CommissionRuleStatus"` 通过；`cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts` 通过，24 pass；`cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs` 通过，14 pass。
- 残留风险：本轮只补人头费规则启停；结算自动开关/备注已在 P1-29 收口，风控处理动作已在 P1-30 收口。cursor 跳扫式 resume、Docker PostgreSQL schema diff 和登录态管理员真实点击保存 smoke 仍待做。

## P1-29 结算配置自动开关与审核备注复盘（2026-06-04 本线程）

- RED：先补 `TestSaveAffiliateRuleSetDraftPersistsSettlementAutoSwitchAndReviewNote`，要求规则 snapshot 保存并在发布/回滚复制中保留 `auto_settlement_enabled=false` 与 trim 后的 `review_note`；旧实现因 `AffiliateSettlementRuleConfig` 缺字段编译失败。再补 `TestGenerateAffiliateSettlementsRespectsDisabledAutoSettlement`，要求自动运行在开关关闭时失败、管理员手动生成仍成功；旧实现缺 `AutoRun`。default/classic helper 测试同时要求 payload、旧 snapshot 回填、导入导出、复制草稿、默认 seed 和 diff 预览都支持这两个字段。
- 完成内容：`AffiliateSettlementRuleConfig` 新增 `AutoSettlementEnabled` 与 `ReviewNote`，保存草稿时 trim 备注；解析旧 snapshot 时如果缺 `auto_settlement_enabled`，默认视为开启，避免历史规则被误关。规则保存、发布、回滚、导入/导出和复制上一版本均保留字段；default/classic 管理页在结算配置区域新增自动结算开关和审核备注控件。
- 自动运行语义：`AffiliateSettlementBuildInput` 新增 `AutoRun`，`GenerateAffiliateSettlements` 仅在 `AutoRun=true` 且已发布规则关闭自动结算时返回 `automatic affiliate settlement is disabled`；管理员显式手动生成不设置 `AutoRun`，仍允许生成。`AutoRun` 已纳入 standalone settlement generate job run 的 idempotency payload 和 input snapshot，避免自动任务失败和手动重试互相污染。
- schema impact：本轮只修改规则 JSON snapshot 和 service input，不新增 GORM model 字段、不新增数据库迁移；无需更新 PostgreSQL schema diff。Docker engine 当前仍不可用，既有 Docker schema diff 缺口仍保留。
- 验证命令：RED 阶段 `go test -count=1 ./service -run "SettlementAuto|AutoSettlement"` 因缺字段/缺 `AutoRun` 编译失败；default/classic targeted `bun test` 因字段未映射和 diff 缺项失败。实现后 `go test -count=1 ./service -run "SettlementAuto|AutoSettlement"` 通过；`cd web/default && bun test src/features/affiliate/admin-lib.test.ts --test-name-pattern "settlement|hydrates|exports|copies|diff"` 通过；`cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs --test-name-pattern "settlement|hydrates|exports|copies|diff|default seed"` 通过。
- 回归验证：`go test -count=1 ./model ./service` 通过；`cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts` 通过，24 pass；`cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs` 通过，14 pass；`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过。
- 浏览器 smoke：`curl -I http://127.0.0.1:5173/` 与 `curl -I http://127.0.0.1:5174/` 均返回 200；in-app Browser 打开 `http://127.0.0.1:5173/affiliate/admin` 未登录正常跳转到 default sign-in；打开 `http://127.0.0.1:5174/console/affiliate/admin` 未登录正常跳转到 classic login。classic 新增控制台消息为既有未登录 401/登录过期提示，不是本轮结算配置控件渲染异常。
- 残留风险：本轮未实现后台自动调度器，只为未来自动调度明确 `AutoRun` 入口语义；风控自刷/批量异常策略和处理动作已在 P1-30 收口。当前管理员页面仍需登录态真实点击保存 smoke；cursor 跳扫式 resume、Docker PostgreSQL schema diff、外部完整结算周期双跑仍待做。

## P1-30 风控规则策略与处理动作复盘（2026-06-04 本线程）

- RED：先补 `TestSaveAffiliateRuleSetDraftPersistsRiskStrategiesAndAction`，要求风控规则保存、snapshot、发布/回滚复制都保留 `self_brush_strategy`、`bulk_abuse_strategy`、`action`，缺字段时回填默认策略，未知动作保存时报 `invalid affiliate risk action`；旧实现因 `AffiliateRiskRuleInput` 与 `AffiliateRiskRule` 缺字段编译失败。default/classic 前端测试要求旧 snapshot/default seed 回填三列，`RuleArrayEditor` 固定列顺序中展示自刷策略、批量异常策略和处理动作。
- 完成内容：`affiliate_risk_rules` sidecar 模型新增 `self_brush_strategy`、`bulk_abuse_strategy`、`action` 字段；服务层保存草稿时 trim 并默认回填 `exclude`、`manual_review`、`manual_review`，并校验允许值。持久化配置、已发布/已归档版本复制、回滚草稿和 JSON snapshot 均保留这些字段。default/classic 默认 seed、旧 snapshot/import 展示和表格列标签同步。
- 允许值：自刷策略当前允许 `exclude`、`manual_review`；批量异常策略允许 `manual_review`、`hold_commission`、`exclude_from_kpi`；处理动作允许 `manual_review`、`review_only`、`hold_commission`、`hold_settlement`、`exclude_from_kpi`。本轮只模型化配置字段，不把动作直接硬编码进历史已生成事件或已结算单。
- schema impact：本轮修改 GORM sidecar model，只新增 `affiliate_risk_rules.self_brush_strategy`、`affiliate_risk_rules.bulk_abuse_strategy`、`affiliate_risk_rules.action` 字段，仍不改官方核心表。SQLite AutoMigrate 与 service 行为已通过 `go test -count=1 ./model ./service`；Docker engine 当前仍不可用，PostgreSQL before/after diff 需恢复后补。
- 验证命令：RED 阶段 `go test -count=1 ./service -run "RiskStrategies|AffiliateRuleSetDraft"` 因缺字段编译失败；default/classic targeted `bun test` 因旧 snapshot 缺字段和列顺序失败。实现后 `go test -count=1 ./service -run "RiskStrategies|AffiliateRuleSetDraft"` 通过；`go test -count=1 ./model ./service` 通过；`cd web/default && bun test src/features/affiliate/admin-lib.test.ts src/features/affiliate/rule-array-editor.test.ts` 通过，25 pass；`cd web/classic && bun test src/pages/AffiliateAdmin/affiliateAdminRules.test.mjs src/pages/AffiliateAdmin/ruleArrayEditor.test.mjs` 通过，15 pass；`cd web/default && bun run build` 与 `cd web/classic && bun run build` 均通过。
- 浏览器 smoke：in-app Browser 打开 `http://127.0.0.1:5173/affiliate/admin` 未登录正常跳转到 default sign-in；打开 `http://127.0.0.1:5174/console/affiliate/admin` 未登录正常跳转到 classic login。classic 新增控制台消息为既有未登录 401/登录过期提示，不是本轮风控表格列渲染异常。
- 残留风险：本轮没有把风控动作接入佣金/KPI/人头费/结算生成逻辑的自动处置，只完成配置模型化和运营表格化；真实业务动作是否降档、暂缓佣金、排除 KPI 或仅复核，仍需后续结合飞书风控口径和生成任务 TDD 单独实现。Docker PostgreSQL schema diff、登录态管理员真实点击保存 smoke、cursor 跳扫式 resume 和完整周期双跑仍待做。

## P1-31 failed resume cursor payload 保留复盘（2026-06-04 本线程）

- RED：新增 `TestResumeFailedAffiliateJobRunPreservesCursorSnapshotForRestart`，直接锁定 failed job run 原地恢复初始化语义。旧实现会在 `resetAffiliateJobRunForResume` 中把 `last_cursor_id` 清零并清空 `result_snapshot`，测试失败于 retry 后 cursor 从 `2345` 变成 `0`。
- 完成内容：failed job run resume 现在保留 `last_cursor_created_at`、`last_cursor_id` 和 result snapshot 中的 typed cursor 字段，包括 KPI/佣金/人头费日志 cursor、settlement commission/head fee event cursor 以及通用 last cursor；同时继续清空错误、计数、finished_at 并刷新 actor、input snapshot 和 started_at。
- 语义边界：仅 failed job run 保留 cursor payload；stale running job run 仍保持原先“接管前重置 cursor 和计数”的语义，避免把未知运行中进度误认为安全完成段。本轮仍不是按 cursor 跳过扫描，只是保证后续跳扫实现可以读取上次失败前保存的 typed cursor。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestResumeFailedAffiliateJobRunPreservesCursorSnapshotForRestart` 失败；实现后同命令通过。
- 回归验证：`go test -count=1 ./service -run "GenerateAffiliateSettlementsWithJobRun(PreservesStageCursor|ResumesFailed|ResumesStale|Records)|ResumeFailedAffiliateJobRunPreservesCursorSnapshotForRestart"` 通过；`go test -count=1 ./model ./service -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|JobRun"` 通过。
- 残留风险：真正 cursor 跳扫式 resume 仍未完成。尤其 settlement grouping 当前把 groups 累积在内存中，如果失败发生在 draft/upsert 前，直接跳过已扫描 pending events 可能导致事件长期未结算；后续必须先定义 stage completed 标记、可持久化聚合或批次级 durable side effect，再按 TDD 实现跳扫。

## P1-32 settlement pipeline 阶段级 resume 复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineResumesFailedSettlementStageWithoutRescanningLogs`，先让完整 pipeline 在 settlement 阶段失败，再注册 `logs` 表查询 guard 后用同一 idempotency key 重试。旧实现会从 KPI 阶段重跑并触发 `resume should not rescan usage logs after completed stages`，测试失败。
- 完成内容：failed job run resume 现在保留失败阶段和已完成阶段计数；`RunAffiliateSettlementPipeline` 根据 failed run 的 `current_stage` 推导 resume stage，只跳过已经完成且输出已持久化的整阶段。当前支持在失败阶段为 `commission`、`head_fee`、`settlement` 时分别跳过更早的 KPI、commission、head fee 阶段，并继续从失败阶段重跑。
- 安全边界：本轮只跳过整阶段，不跳过阶段内部 cursor 前的数据。KPI、佣金和人头费阶段仍存在内存聚合或 cumulative tier 上下文，直接用日志 cursor 从中间继续可能丢统计上下文；settlement grouping 在 draft/upsert 前失败也不能安全跳过已扫描 pending events。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineResumesFailedSettlementStageWithoutRescanningLogs` 失败；实现后同命令通过。
- 回归验证：`go test -count=1 ./service -run "RunAffiliateSettlementPipeline(IsIdempotent|RecordsJobRun|ResumesFailed|RejectsActive|ResumesStale|Builds|RejectsInvalid)|GenerateAffiliateSettlementsWithJobRun(Records|ResumesFailed|ResumesStale|PreservesStageCursor)|ResumeFailedAffiliateJobRunPreservesCursor"` 通过。
- 残留风险：阶段内部 cursor 断点续扫、Docker PostgreSQL schema diff、登录态管理员真实点击保存 smoke、完整周期 dry-run/正式 run 双跑仍待做。

## P1-33 settlement pipeline resume 输出校验复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineResumeRerunsWhenCompletedStageOutputsAreMissing`，构造一个 `current_stage=settlement` 且计数显示 KPI/佣金/人头费已完成、但实际没有对应持久化输出的 failed job。旧实现直接跳到 settlement 并返回空结算，测试失败。
- 完成内容：`RunAffiliateSettlementPipeline` 在跳过已完成整阶段前会校验持久化输出数量。KPI 按 `affiliate_kpi_snapshots.rule_set_id + period` 计数，佣金按 `affiliate_commission_events.rule_set_id + period` 计数，人头费按 `affiliate_head_fee_events.rule_set_id + period marker` 计数；如果任一已完成阶段输出少于 job run 记录数量，则降级到最早缺失阶段重跑。
- 安全边界：校验只保证“整阶段跳过”不会依赖虚假的 job run 计数；它仍不实现阶段内部 cursor 续扫。若 `rule_set_id` 不明确，当前策略保守降级从头重跑，避免跳过无法校验的阶段。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineResumeRerunsWhenCompletedStageOutputsAreMissing` 失败；实现后同命令通过。
- 回归验证：`go test -count=1 ./service -run "TestRunAffiliateSettlementPipelineResume(RerunsWhenCompletedStageOutputsAreMissing|sFailedSettlementStageWithoutRescanningLogs)"` 通过；`go test -count=1 ./service -run "RunAffiliateSettlementPipeline(IsIdempotent|RecordsJobRun|ResumesFailed|RejectsActive|ResumesStale|Builds|RejectsInvalid)|GenerateAffiliateSettlementsWithJobRun(Records|ResumesFailed|ResumesStale|PreservesStageCursor)|ResumeFailedAffiliateJobRunPreservesCursor"` 通过。
- 残留风险：阶段内部 cursor 断点续扫、Docker PostgreSQL schema diff、完整周期 dry-run/正式 run 双跑仍待做。

## P1-34 settlement pipeline dry-run 复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineDryRunBuildsPreviewWithoutPersisting`，要求 service 层 `DryRun=true` 返回 KPI/佣金/人头费/结算预览，但不持久化 job run、KPI snapshot、commission event、head fee event 或 settlement；旧实现因缺少 `DryRun` 输入和结果字段编译失败。新增 `TestAdminRunAffiliateSettlementPipelineDryRun`，要求 admin API payload 的 `dry_run:true` 透传到 service；旧 controller 未透传，测试失败且实际落库。
- 完成内容：`AffiliateSettlementRunInput` 与 admin request 新增 `dry_run`，`AffiliateSettlementRunResult` 新增 `dry_run`。dry-run 在事务中执行完整 pipeline，成功构建预览后用内部 rollback sentinel 回滚所有写入，返回 `job_run_id=0`、`job_run_status=dry_run` 和可与正式 run 对比的 settlement preview。
- 完成内容：pipeline idempotency payload 和 input snapshot 纳入 `dry_run`，避免 dry-run 与正式 run 的幂等键语义混淆；正式 run 路径保持原有 job run 审计、幂等和落库行为。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineDryRunBuildsPreviewWithoutPersisting` 因缺字段失败；实现 service 后通过。RED 阶段 `go test -count=1 ./controller -run TestAdminRunAffiliateSettlementPipelineDryRun` 因 controller 未透传 dry-run 失败；补映射后通过。
- 回归验证：`go test -count=1 ./service ./controller -run "SettlementPipeline|AffiliateSettlement|AdminRunAffiliateSettlementPipeline|GenerateAffiliateSettlements|JobRun|DryRun"` 通过。
- 残留风险：本轮是本地 service/API dry-run 能力，不替代外部真实周期 dry-run/正式 run 双跑验收；阶段内部 cursor 断点续扫、Docker PostgreSQL schema diff 和生产/staging 真实链路验证仍待做。

## P2-2 SMS DB-backed 限流复盘（2026-06-04 本线程）

- RED：先新增 `TestSMSSidecarModelsMigrateSMSRateLimitCounters`、`TestCheckSMSRateLimitWithDBBlocksAcrossLimiterInstancesWithoutRawIdentifiers` 和 `TestAdminTestSMSUsesPersistedRateLimitAcrossLimiterReset`；旧实现因缺少 `SMSRateLimitCounter`、`CheckSMSRateLimitWithDB` 失败，controller 旧实现清空内存 limiter 后第二次发送仍成功。
- 完成内容：新增 `sms_rate_limit_counters` SMS sidecar 表，按 `dimension`、`scene`、`rate_key_hash`、固定窗口、计数和过期时间记录限流状态；`rate_key_hash` 由手机号/IP/账号/场景规则 key 哈希生成，不保存完整手机号、IP 或账号。
- 完成内容：新增 DB-backed 固定窗口 SMS limiter；管理员测试发送优先调用 DB limiter，`model.DB=nil` 时保留既有内存 limiter fallback，避免极简测试或未初始化 DB 的路径直接失败。
- 验证命令：RED 阶段 `go test -count=1 ./model ./service -run "SMSRateLimit|SMSSidecar"` 因缺少模型和函数失败；`go test -count=1 ./controller -run "TestAdminTestSMSUsesPersistedRateLimitAcrossLimiterReset"` 因第二次请求成功失败。实现后 `go test -count=1 ./model ./service ./controller -run "SMSRateLimit|SMSSidecar|TestAdminTestSMS(AppliesRateLimitBeforeProvider|UsesPersistedRateLimitAcrossLimiterReset)"` 通过。
- 回归验证：`go test -count=1 ./common ./model ./service ./controller -run "SMS|Phone"` 通过。
- 残留风险：本轮是 DB 固定窗口计数，不是 Redis 滑动窗口；高并发下仍需结合数据库隔离、唯一索引和生产压测复核。Docker 当前不可用，`sms_rate_limit_counters` 的 PostgreSQL schema diff 未生成。手机号注册归因、手机号登录/绑定真实入口和短信宝真实通道 smoke 仍待做。

## P2-3 手机号绑定 sidecar 审计复盘（2026-06-04 本线程）

- 完成内容：复核手机号/SMS 当前分支实现，确认手机号绑定模型位于 `model/sms.go` 的 `UserPhoneBinding`，表名为 `user_phone_bindings`；绑定逻辑位于 `service/sms.go` 的 `BindUserPhone`，保存脱敏手机号和哈希手机号，不在官方 `users` 表新增手机号字段。
- 验证命令：`git status --short --branch` 和 `git log --oneline -5` 确认工作树基线与最近 SMS 限流提交；`rg -n "Phone|phone|手机号" model/user.go model/sms.go service/sms.go controller -S` 显示手机号字段集中在 SMS sidecar、SMS 服务和 SMS controller，`model/user.go` 无手机号字段输出。
- 策略结论：后续如启用手机号登录、绑定或找回能力，继续沿用 `user_phone_bindings` sidecar 与统一邀请归因逻辑，禁止把旧 fork 的侵入式 `users.phone` 方案直接迁入官方用户表。
- 残留风险：当前审计只确认 sidecar 路线和不改 `users` 表；真实手机号注册入口、手机号登录入口、验证码校验闭环、邀请归因和初始额度发放仍未接入，需在后续任务中按 TDD 单独实现并做脱敏 smoke。
- 下一步：Docker 恢复后补 SMS schema diff；如继续 SMS P2，应优先 TDD 手机号注册复用统一 invite context 和初始额度，真实短信宝 smoke 只在签名/模板审核完成后做脱敏验收。

## P0-7 前端 dev server、Windows 端口与 Docker server 复核（2026-06-04 本线程）

- 完成内容：按 systematic-debugging 继续从运行态取证，不重复实现 `/api/affiliate/team` 后端路由。本轮确认 `new-api-web` tmux session 仍存在，`5173` 与 `5174` 均由 WSL 内 node/Rsbuild 监听，`3000` 也处于监听状态；无需重新启动前端 dev server。
- WSL 验证命令：`timeout 15s tmux ls` 返回 `new-api-web`；`timeout 15s ss -ltnp | rg ':3000|:5173|:5174'` 显示 `5173`、`5174` 与 `3000` 均监听；`timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team`、`5174`、`3000` 未登录均返回 401 JSON，不返回 404，也不返回旧 `Invalid URL`。
- Windows 端口验证：Windows 侧 `curl.exe -i http://127.0.0.1:5173/api/affiliate/team`、`5174`、`3000` 未登录均返回 401；`curl.exe -I http://127.0.0.1:5173/` 与 `curl.exe -I http://127.0.0.1:5174/` 均返回 200。该证据证明 Windows 到 WSL 的当前端口映射可达，不能复现旧 404。
- 浏览器验证：in-app Browser 打开 `http://127.0.0.1:5173/` 与 `http://127.0.0.1:5174/` 均显示页面标题 `NovaRouteAI`；打开 `5173/affiliate` 未登录跳转到 default sign-in；打开 `5174/console/affiliate` 未登录跳转到 classic login；新浏览器上下文未观察到 `/api/affiliate/team` 404。
- Docker 取证：`timeout 15s docker version` 与 `docker --context default version` 仍只返回 client 信息并以非 0 退出；`docker context ls` 显示 default 指向 `/var/run/docker.sock`，`desktop-linux` 指向 Docker Desktop pipe；WSL 内 `docker --context desktop-linux version` 触发 Docker CLI panic；`curl --unix-socket /var/run/docker.sock http://localhost/_ping` 在 15s 内没有返回 `OK`。
- 结论：当前 Windows/WSL 端口和 dev server 已可用，`/api/affiliate/team` 运行态不是旧 404；若用户手动 Windows 浏览器仍显示旧 404，优先检查该浏览器的 disk/memory cache、Disable cache 硬刷新、旧标签页和实际 Request URL。当前 Docker server 仍不可用，不能安全执行 `docker compose -f docker-compose.dev.yml up -d --build new-api`，也不能补 Docker PostgreSQL schema diff。
- 残留风险：本轮未读取用户实际 Windows Chrome DevTools disk cache 状态；fresh in-app Browser 不能替代用户原浏览器 tab。由于 Docker server 不响应，运行态后端仍可能不是包含 `/api/*` no-store 提交的最新构建；待 Docker 恢复后必须重建 `new-api:dev` 并复测缓存头和 schema diff。

## P2-4 dashboard 14 天趋势图复盘（2026-06-04 本线程）

- RED：先补 `TestBuildAffiliateDashboardSummaryBuildsDailyTrendsFromPaidAndFinanceOnly`，要求 summary 返回按日趋势、paid 净消耗不包含 gift/trial/legacy_unknown/abnormal，并汇总有效新用户、预估佣金、人头费和待结算金额；旧实现因缺少 `TrendStartTimestamp`、`TrendEndTimestamp` 和 `DailyTrends` 编译失败。再补 `TestGetAffiliateSummaryReturnsScopedDashboard`，要求 controller 透传趋势窗口；旧实现返回空 `daily_trends`。default/classic 先补趋势 helper 测试，旧实现缺少对应模块。
- 完成内容：`/api/affiliate/summary` 新增 `trend_start_timestamp` 与 `trend_end_timestamp` 查询参数；`AffiliateDashboardSummary` 新增 `daily_trends`。service 按天构建趋势点，paid 净消耗沿用已验证 attribution 口径，佣金/人头费/待结算金额按 finance sidecar 与 scope 汇总。default 与 classic 分销商端新增 14 天趋势面板，保持摘要卡片、趋势、关系树和 scoped logs 明细组合，不把 dashboard 改成纯表格。
- 前端口径：default/classic 请求 summary 时默认带最近 14 天趋势窗口；趋势行以 RMB 为主单位，raw quota 仅作为后端数据来源，不作为主要展示。default 新增 6 个 locale 文案并通过 i18n sync；classic 使用本地中文文案，与既有 Semi Design 页面风格保持一致。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestBuildAffiliateDashboardSummaryBuildsDailyTrendsFromPaidAndFinanceOnly`、`go test -count=1 ./controller -run TestGetAffiliateSummaryReturnsScopedDashboard`、`cd web/default && bun test src/features/affiliate/trend-lib.test.ts`、`cd web/classic && bun test src/pages/Affiliate/affiliateDashboardTrends.test.mjs` 均先按预期失败。实现后 `go test -count=1 ./service ./controller -run "AffiliateDashboardSummary|GetAffiliateSummary|AffiliateSummary|Dashboard"` 通过；`cd web/default && bun test src/features/affiliate/trend-lib.test.ts src/features/affiliate/lib.test.ts` 通过，10 pass；`cd web/classic && bun test src/pages/Affiliate/affiliateDashboardTrends.test.mjs src/pages/Affiliate/affiliateDashboardCards.test.mjs src/pages/Affiliate/affiliateViewState.test.mjs` 通过，8 pass。
- 回归验证：`cd web/default && bun run i18n:sync` 通过且 `_sync-report.json` 中 missing/extras/untranslated 均为 0；`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun"` 通过；`git diff --check` 通过。
- 浏览器 smoke：in-app Browser 打开 `http://127.0.0.1:5173/affiliate` 未登录正常跳转到 default sign-in；打开 `http://127.0.0.1:5174/console/affiliate` 未登录正常跳转到 classic login。classic 控制台错误为既有未登录/登录过期提示，不是趋势面板资源或渲染异常。
- 残留风险：本轮未使用用户真实登录态做趋势面板截图或点击 smoke，不能替代 staging/生产验收；趋势窗口当前按前端默认最近 14 天请求，生产如果要周/月切换需另做 UI 与 API 参数设计；Docker server 仍不可用，PostgreSQL schema diff 和真实容器重建仍待恢复后补。

## P0-8 运行态 no-store 与 Docker 阻塞复核（2026-06-04 本线程）

- 完成内容：按 systematic-debugging 重新做接手基线，不重复实现 `/api/affiliate/team`。当前 `git status --short --branch` 显示 `feature/native-affiliate-minimal` 工作树干净，HEAD 为 `fb3e3447 feat: add affiliate dashboard trends`；`tmux ls` 显示 `new-api-web` session 存在，`ss -ltnp` 显示 `3000`、`5173`、`5174` 均监听。
- 端口与 API 证据：WSL 内固定 URL 访问 `3000`、`5173`、`5174` 的 `/api/affiliate/team` 未登录均返回 401 JSON，不是旧 `Invalid URL` 404；Windows 侧 `curl.exe` 访问同三个 URL 也均返回 401。该证据证明当前 localhost 端口映射与 dev proxy 未复现旧 404。
- 缓存头证据：源码中 `router/api-router.go` 已在 `/api` group 挂载 `middleware.DisableCache()`，`go test -count=1 ./router -run TestApiRouterDisablesHttpCaching` 通过；但运行态 `curl -D - -o /dev/null http://127.0.0.1:3000/api/status` 只看到 `HTTP/1.1 200 OK`，未看到 `Cache-Control`、`Pragma` 或 `Expires` no-store 头。
- 根因判断：当前 no-store 缺口不是源码未实现，而是运行态 `3000` 后端尚未部署当前构建或仍为旧容器/旧镜像；本轮不改源码、不重复加 middleware。
- Docker 取证：`timeout 60s docker version` 仍只输出 Docker client 信息并以非 0 退出，未返回 server 信息；因此本轮不能安全执行 `docker compose -f docker-compose.dev.yml up -d --build new-api`，也不能补 PostgreSQL schema diff。
- 残留风险：fresh curl 与 in-app Browser 不能直接读取用户既有 Windows Chrome disk cache；如果用户手动浏览器仍显示旧 404，仍需在该浏览器 DevTools 勾选 Disable cache、硬刷新或清站点缓存。Docker 恢复后必须重建 `new-api:dev`，复测 `/api/*` no-store header、`/api/affiliate/team` 登录态 200 和 pending schema diff。

## P2-5 登录态分销页 smoke 复盘（2026-06-04 本线程）

- 完成内容：使用本地 Playwright runtime 和 `.codex-local/affiliate-test-accounts.secret.json` 读取一级分销商测试账号做只读登录 smoke；脚本只输出角色标签、HTTP code、success、脱敏计数和页面布尔值，不输出密码、cookie、完整响应体、完整 request id 或截图。
- default 结果：登录后停留在 `/affiliate`；`/api/affiliate/status` 返回 200 且 `available=true`；`/api/affiliate/team` 返回 200、`total=9`；`/api/affiliate/logs?p=0&page_size=5` 返回 200、rows=5；页面包含趋势面板文案，未出现旧“推广关系树接口返回 404”或 `Invalid URL` 文案。
- classic 结果：登录后停留在 `/console/affiliate`；`/api/affiliate/status` 返回 200 且 `available=true`；`/api/affiliate/team` 返回 200、`total=9`；`/api/affiliate/logs?p=0&page_size=5` 返回 200、rows=5；页面包含趋势面板文案，未出现旧“推广关系树接口返回 404”或 `Invalid URL` 文案。
- 运行态差异：两端 `/api/affiliate/summary?trend_start_timestamp=...&trend_end_timestamp=...` 均返回 200 且 `success=true`，但响应数据中没有 `daily_trends`。结合 P0-8 的 no-store header 缺失，判断为当前 `3000` 后端运行态仍是旧构建，尚未部署 `fb3e3447` 的趋势 API；不是前端页面没有加载当前 bundle。
- 残留风险：本轮是本地只读浏览器 smoke，不替代 staging/生产外部验收；Docker 恢复后必须重建当前仓库 `new-api:dev`，再复测 summary `daily_trends`、no-store header 和登录态趋势数据。

## P1-35 settlement 阶段 affiliate 级 durable side effect 复盘（2026-06-04 本线程）

- RED：新增 `TestGenerateAffiliateSettlementsKeepsCompletedAffiliateDraftWhenLaterAffiliateFails`，构造两个 affiliate 的 pending commission events，并在第二个 affiliate draft 创建前强制失败。旧实现把所有 affiliate settlement upsert/link 包在同一个大事务里，第二个 affiliate 失败会回滚第一个 affiliate 已完成的 draft 和 ready event，测试失败于 first draft `record not found`。
- 完成内容：`GenerateAffiliateSettlements` 改为按 affiliate user 分别开启小事务，单个 affiliate 内仍保持 draft upsert 与 event link 原子性；某个后续 affiliate 失败时，之前已经成功的 affiliate draft 和 ready event 会持久化。重试时现有 `mergeExistingAffiliateSettlementDraftEvents` 会把这些 ready events 重新合入 groups，避免重复生成 draft，也不需要按 cursor 跳过 pending event 扫描。
- 安全边界：本轮不是 unsafe 的阶段内部 cursor 跳扫。KPI、佣金和人头费阶段仍有累计上下文，settlement grouping 仍在内存中聚合；本轮只是为 settlement 阶段增加 affiliate 级 durable side effect，使失败重试能复用已经完成的 affiliate draft/link，并继续重扫剩余 pending events。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestGenerateAffiliateSettlementsKeepsCompletedAffiliateDraftWhenLaterAffiliateFails` 失败于 first durable draft 不存在；实现后同命令通过。回归 `go test -count=1 ./service -run "GenerateAffiliateSettlements|SettlementPipeline|RunAffiliateSettlementPipeline|AffiliateSettlement"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun"` 通过；`git diff --check` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，不需要新的 schema diff；既有 Docker PostgreSQL schema diff 缺口仍因 Docker server 不可用保留。
- 残留风险：完整阶段内部 cursor 断点续扫仍未完成，尤其 KPI/佣金/人头费阶段不能直接用 cursor 跳过前序日志；Docker PostgreSQL schema diff、外部完整周期 dry-run/正式 run 双跑和生产/staging 真实链路验证仍待做。

## P1-36 settlement job run 部分结算进度复盘（2026-06-04 本线程）

- RED：新增 `TestGenerateAffiliateSettlementsWithJobRunRecordsPartialSettlementProgressOnFailure`，在第二个 affiliate draft 创建前强制失败。P1-35 已让第一个 affiliate draft/link 成为 durable side effect，但旧 job run 只保留 `settlement_commission_event_id` cursor，`settlement_count=0`，`result_snapshot` 没有 `settlement_ids`，测试失败。
- 完成内容：`GenerateAffiliateSettlements` 每完成一个 affiliate 小事务后，会把当前已完成 settlements 写入 `affiliate_job_runs.settlement_count` 和 `result_snapshot.settlement_ids`；失败路径继续由 `finishAffiliateJobRunFailure` 合并已有 result snapshot，所以 failed job run 能保留已经落地的 settlement partial progress。
- 安全边界：本轮只写已完成 settlement id 和计数，不保存 reason 原文，不新增 schema，也不按 cursor 跳过未完成扫描。该记录用于审计和后续 resume 设计，重试仍依赖 pending event 扫描与 existing draft merge 的幂等语义。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestGenerateAffiliateSettlementsWithJobRunRecordsPartialSettlementProgressOnFailure` 失败于 failed job run `settlement_count=0`；实现后同命令通过。回归 `go test -count=1 ./service -run "GenerateAffiliateSettlements|SettlementPipeline|RunAffiliateSettlementPipeline|AffiliateSettlement|AffiliateJobRun|ResumeFailed"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun"` 通过；`git diff --check` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，不需要新的 schema diff；Docker 仍只返回 client 信息，pending PostgreSQL schema diff 仍待 Docker 恢复后补。
- 残留风险：完整阶段内部 cursor 断点续扫仍未完成，尤其 KPI/佣金/人头费阶段仍不能直接跳过 cursor 前日志；外部完整周期 dry-run/正式 run 双跑和真实运行态部署验证仍待做。

## P1-37 failed resume 保留部分结算进度复盘（2026-06-04 本线程）

- RED：扩展 `TestResumeFailedAffiliateJobRunPreservesCursorSnapshotForRestart`，构造 failed `settlement_generate` job run，`result_snapshot` 同时包含 typed cursor、`settlement_count=1` 和 `settlement_ids`。旧 resume snapshot 白名单只保留 cursor 字段，重置为 running 后 `settlement_ids` 丢失，测试失败。
- 完成内容：`affiliateJobRunResumeCursorSnapshotKeys` 新增 `settlement_count` 与 `settlement_ids`，failed job run 原地恢复时继续保留 P1-36 已写入的部分结算进度，同时仍保留 typed cursor。`settlement_count` 字段本身已由既有 reset 逻辑保留，本轮补齐 result snapshot 审计证据。
- 安全边界：本轮只扩大 failed resume 的 result snapshot 保留字段，不新增 schema，不改变 idempotency key，不保存 reason 原文，也不按 cursor 跳过未完成扫描。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestResumeFailedAffiliateJobRunPreservesCursorSnapshotForRestart` 失败于 partial settlement progress snapshot 丢失；实现后同命令通过。回归 `go test -count=1 ./service -run "AffiliateJobRun|ResumeFailed|GenerateAffiliateSettlements|SettlementPipeline|RunAffiliateSettlementPipeline|AffiliateSettlement"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun"` 通过；`git diff --check` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，不需要新的 schema diff；Docker 仍只返回 client 信息，pending PostgreSQL schema diff 仍待 Docker 恢复后补。
- 残留风险：完整阶段内部 cursor 断点续扫仍未完成，尤其 KPI/佣金/人头费阶段仍不能直接跳过 cursor 前日志；外部完整周期 dry-run/正式 run 双跑和真实运行态部署验证仍待做。

## P1-38 成功态 job run 保留扫描进度复盘（2026-06-04 本线程）

- RED：扩展 `TestRunAffiliateSettlementPipelineRecordsJobRunSuccess`，要求成功的 settlement pipeline `result_snapshot` 仍保留 `kpi_log_id`、`commission_log_id`、`head_fee_log_id`、`settlement_commission_event_id` 和 `settlement_head_fee_event_id`；旧实现成功收尾时用最终 counts/settlement ids 覆盖整个 snapshot，测试失败于缺少 `kpi_log_id`。同时扩展 `TestGenerateAffiliateSettlementsWithJobRunRecordsSuccess`，要求单独 settlement generate 成功态保留 settlement event typed cursor。
- 完成内容：成功收尾 snapshot 改为先读取当前 job run 已累积的 `result_snapshot`，删除临时 `status` 字段，再覆盖最终 `kpi_snapshot_count`、`commission_event_count`、`head_fee_event_count`、`settlement_count` 和 `settlement_ids`。这样 success 状态既保留最终结果，又保留扫描进度审计证据。
- 安全边界：本轮只改变成功态 job run 审计 snapshot 的合并策略，不新增 schema，不保存 reason 原文，不改变结算金额、分佣/KPI/人头费口径，也不实现阶段内部 cursor 跳扫。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineRecordsJobRunSuccess` 失败于成功态 snapshot 缺少 `kpi_log_id`；实现后 `go test -count=1 ./service -run "TestRunAffiliateSettlementPipelineRecordsJobRunSuccess|TestGenerateAffiliateSettlementsWithJobRunRecordsSuccess"` 通过。回归 `go test -count=1 ./service -run "AffiliateJobRun|ResumeFailed|GenerateAffiliateSettlements|SettlementPipeline|RunAffiliateSettlementPipeline|AffiliateSettlement"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun"` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，不需要新的 schema diff；Docker server 仍不可用，既有 PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：成功态 snapshot 已保留 typed cursor，但完整阶段内部 cursor 断点续扫仍未完成；KPI、佣金和人头费阶段仍不能直接跳过 cursor 前日志。外部完整周期 dry-run/正式 run 双跑、Docker schema diff 和生产/staging 真实链路验证仍待做。

## P2-6 SMS 注册后端统一邀请归因复盘（2026-06-04 本线程）

- RED：新增 `TestSMSRegisterAppliesAffiliateAttributionAndBindsPhone`，预置 `register` 场景 SMS 验证码并调用 `SMSRegister`。旧实现缺少 `common.SMSVerificationPurpose` 和 `SMSRegister`，测试编译失败；这证明当前分支还没有手机号注册入口接统一邀请归因。
- 完成内容：新增 `common.SMSVerificationPurpose(scene)`，新增 `POST /api/user/sms/register` controller 和 router 入口。后端入口使用手机号验证码、username、password 和 `aff_code` 创建用户，复用 `resolveAffiliateInviteContextForRegistration`、`affiliateInviteeQuotaForContext`、`affiliateInviterQuotaForContext`、`recordAffiliateInviteAttributionForRegistration`，并把手机号绑定写入 `user_phone_bindings` sidecar。
- 安全边界：手机号只用于规范化、验证码校验和 `HashPhoneForBinding`，不写入官方 `users` 表；响应不返回完整手机号；测试断言 binding JSON 不包含完整手机号。创建用户前会按 phone hash 检查 active binding，降低手机号已绑定时创建孤儿用户的风险。
- 验证命令：RED 阶段 `go test -count=1 ./controller -run TestSMSRegisterAppliesAffiliateAttributionAndBindsPhone` 编译失败于缺少 SMS verification purpose 和 `SMSRegister`；实现后同命令通过。回归 `go test -count=1 ./common ./service ./controller -run "SMS|Phone|AffiliateRegistration|PasswordRegister|InviteContext|RegisterApplies"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun|SMS|Phone|Register"` 通过。
- schema impact：本轮不新增 GORM model、字段或索引；使用既有 `user_phone_bindings` sidecar。Docker server 仍不可用，既有 SMS/affiliate PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：本轮只补后端注册入口，不包含真实验证码发送用户入口、default/classic 前端注册表单、手机号登录、找回/换绑闭环或短信宝真实通道 smoke；真实通道仍需等签名、模板和脱敏策略确认后再做。

## P2-7 SMS 注册验证码发送入口复盘（2026-06-04 本线程）

- RED：新增 `TestSendSMSRegisterCodeStoresVerificationAndRedactsResponse`，要求公开注册验证码发送入口生成验证码、调用 SMS provider、登记后续注册可校验的 code、写脱敏发送日志，并且响应和日志不包含完整手机号、验证码或完整短信内容。旧实现缺少 `SendSMSRegisterCode`，测试编译失败。
- 完成内容：新增 `POST /api/user/sms/register/code`，只支持 `register` 场景；发送前执行 DB-backed SMS rate limit，使用已审核签名和注册模板渲染短信内容，发送成功后登记 `common.SMSVerificationPurpose(register)` 验证码，并复用 SMS 发送日志脱敏策略。
- 完成内容：新增 `GenerateSMSVerificationCode`，使用 `crypto/rand` 生成数字验证码。RED 后首次 GREEN 失败暴露旧 `GenerateVerificationCode(6)` 会产生非纯数字字符，本轮改为 SMS 专用数字码，避免影响 email/密码重置等既有验证码逻辑。
- 安全边界：客户端不能传入验证码，也不会收到验证码；response 只返回 masked phone、provider code 和 scene；发送日志只保存 masked phone、template version、provider code 和耗时，不保存完整手机号、验证码或短信正文。
- 验证命令：RED 阶段 `go test -count=1 ./controller -run TestSendSMSRegisterCodeStoresVerificationAndRedactsResponse` 编译失败于缺少 `SendSMSRegisterCode`；实现后同命令通过。回归 `go test -count=1 ./common ./service ./controller -run "SMS|Phone|AffiliateRegistration|PasswordRegister|InviteContext|RegisterApplies"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun|SMS|Phone|Register"` 通过。
- schema impact：本轮不新增 GORM model、字段或索引；继续使用既有 SMS sidecar。Docker server 仍不可用，SMS/affiliate PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：本轮仍未实现 default/classic 前端注册表单、手机号登录、找回/换绑闭环或短信宝真实通道 smoke；真实通道必须等签名、模板和脱敏策略确认后再验收。

## P2-8 SMS 注册前端接入复盘（2026-06-04 本线程）

- RED：先补 default `src/features/auth/api.test.ts` 和 classic `src/components/auth/smsRegisterRequest.test.mjs`，要求 SMS 注册验证码请求使用 `POST /api/user/sms/register/code`，SMS 注册提交使用 `POST /api/user/sms/register`，并保留 `aff_code` 与 `turnstile` 参数。旧实现缺少 default 导出和 classic helper，两个目标测试均失败。
- 完成内容：`GET /api/status` 新增 `sms_enabled` 字段，前端按该开关显示手机号注册入口。default 注册页新增“用户名注册 / 手机号注册”模式切换，短信模式下收集用户名、密码、手机号和短信验证码，邮箱验证码只在普通注册模式下启用。classic 注册页新增“使用 手机号 注册”入口，并复用同样的短信验证码发送与注册提交端点。
- 完成内容：default 新增 `SmsRegisterPayload`、`buildSmsRegisterCodeRequest`、`buildSmsRegisterRequest`、`sendSmsRegisterCode`、`smsRegister`；classic 新增 `smsRegisterRequest.js` 请求构造 helper。新增文案已补 default `en/zh/fr/ja/ru/vi` 和 classic `en/zh/zh-CN/zh-TW/fr/ja/ru/vi` locale，新增 classic 提示文案也改为 `t(...)`。
- 验证命令：后端状态契约先 RED 于 `sms_enabled` 缺失，再实现后 `go test -count=1 ./controller -run TestGetStatusExposesSMSEnabledForRegistration` 通过。前端请求层 RED 后实现，`cd web/default && bun test src/features/auth/api.test.ts` 通过，`cd web/classic && bun test src/components/auth/smsRegisterRequest.test.mjs` 通过。
- 回归验证：`cd web/default && bun run i18n:sync` 报告所有 locale `missingCount=0`、`untranslatedCount=0`；`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过；`go test -count=1 ./common ./service ./controller -run "SMS|Phone|AffiliateRegistration|PasswordRegister|InviteContext|RegisterApplies|GetStatus"` 通过；`git diff --check` 通过。
- 浏览器 smoke：确认 `5173` 和 `5174` 均为当前项目 WSL 内 rsbuild dev server；in-app Browser 打开 `http://127.0.0.1:5173/register` 自动跳转到 default `/sign-up` 并正常渲染注册页；打开 `http://127.0.0.1:5174/register` 正常渲染 classic 注册页，新增控制台错误/警告为 0。
- 运行态差异：当前 `http://127.0.0.1:3000/api/status` 仍未返回 `sms_enabled`，说明 live 后端容器尚未包含本轮状态字段改动；因此本轮浏览器 smoke 只能验证页面加载，不能验证手机号入口在 live 配置下显示。Docker daemon 查询仍长时间无响应，不能安全执行 `docker compose -f docker-compose.dev.yml up -d --build new-api`。
- 残留风险：本轮只完成注册前端接入，不包含手机号登录、找回/换绑闭环、真实短信宝通道 smoke、登录态真实手机号注册闭环或 Docker PostgreSQL schema diff。Docker 恢复后必须先重建 `new-api:dev`，再复测 `/api/status.sms_enabled`、default/classic 手机号入口显示、短信验证码发送响应脱敏和 SMS 注册统一邀请归因。

## P2-9 SMS 手机号登录后端复盘（2026-06-04 本线程）

- RED：先新增 `TestSMSPhoneLoginUsesActiveBindingWithoutAutoRegistering`、`TestSMSPhoneLoginRejectsUnboundPhoneWithoutCreatingUser` 和 `TestSMSPhoneLoginRespectsEnabledTwoFA`；旧实现因缺少 `SMSPhoneLogin` 编译失败。随后新增 `TestFindUserByActivePhoneBindingReturnsEnabledUser`、`TestFindUserByActivePhoneBindingRejectsUnboundPhone` 和 `TestFindUserByActivePhoneBindingRejectsDisabledUser`；旧 service 因缺少 `FindUserByActivePhoneBinding` 编译失败。
- 完成内容：新增 `POST /api/user/login/phone` router/controller 入口，使用 `common.SMSVerificationPurpose(login)` 校验登录验证码；只通过 `user_phone_bindings` active binding 查找用户，不修改官方 `users` 表，也不在未绑定手机号时自动注册或创建绑定。
- 完成内容：新增 `service.FindUserByActivePhoneBinding`，按手机号哈希读取 active binding，并要求绑定用户 `status=enabled`；禁用用户与未绑定手机号统一返回 `phone is not bound`，避免暴露用户状态差异。
- 完成内容：密码登录的 2FA pending-session 分支抽为 `setupLoginWithOptionalTwoFA`，手机号登录复用该分支；已启用 2FA 的用户不会直接返回完整登录用户数据，只返回 `require_2fa=true` 并等待既有 `/api/user/login/2fa` 流程。
- 安全边界：手机号只用于规范化、验证码校验和哈希查询；响应测试断言不包含完整手机号或验证码；测试数据不写真实手机号、密码、cookie 或短信通道凭据。
- 验证命令：RED 阶段 `go test -count=1 ./controller -run "TestSMSPhoneLogin" -v` 失败于 `undefined: SMSPhoneLogin`；`go test -count=1 ./service -run "TestFindUserByActivePhoneBinding" -v` 失败于 `undefined: FindUserByActivePhoneBinding`。实现后 `go test -count=1 ./service -run "TestFindUserByActivePhoneBinding|TestBindUserPhone" -v` 通过，`go test -count=1 ./controller -run "TestSMSPhoneLogin" -v` 通过。
- 回归验证：`go test -count=1 ./service -run "SMS|UserPhone" -v` 通过；`go test -count=1 ./controller -run "TestSMSPhoneLogin|TestSMSRegister|TestSendSMSRegisterCode|TestAdminTestSMS|TestAdminGetSMSStatus" -v` 通过；`go test -count=1 ./router -run "SMS|User|ApiRouter" -v` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，继续使用既有 SMS sidecar；Docker server 仍不可用，既有 PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：本轮只完成后端手机号登录入口，不包含登录验证码发送入口、default/classic 手机号登录 UI、登录/绑定/换绑/找回完整闭环、真实短信宝通道 smoke 或 live 容器重建后验证。2026-06-04 后续 P2-10 已补登录验证码发送入口；前端登录 UI、真实短信通道和 live 容器重建后验证仍待做。

## P2-10 SMS 登录验证码发送入口复盘（2026-06-04 本线程）

- RED：新增 `TestSendSMSLoginCodeStoresVerificationForActiveBindingAndRedactsResponse` 和 `TestSendSMSLoginCodeRejectsUnboundPhoneBeforeProvider`；旧实现因缺少 `SendSMSLoginCode` 编译失败。新增 `TestApiRouterMountsSMSLoginCodeRoute`，旧 router 对 `POST /api/user/sms/login/code` 返回 404。
- 完成内容：新增 `POST /api/user/sms/login/code` router/controller 入口，使用 `SMSSceneLogin` 模板渲染登录验证码，发送成功后登记 `common.SMSVerificationPurpose(login)`，供既有 `POST /api/user/login/phone` 校验。
- 完成内容：登录验证码发送前先走 DB-backed SMS rate limit，并通过 `service.FindUserByActivePhoneBinding` 确认手机号已绑定到启用用户；未绑定手机号不会调用 SMS provider，也不会登记验证码。
- 安全边界：响应只返回 masked phone、provider metadata 和 `template_scene=login`；发送日志只保存脱敏手机号和模板版本，不保存完整手机号、验证码、短信正文或通道凭据；本轮新增测试使用短测试标识，不新增完整手机号样例。
- 验证命令：RED 阶段 `go test -count=1 ./controller -run "TestSendSMSLoginCode" -v` 失败于 `undefined: SendSMSLoginCode`；`go test -count=1 ./router -run "TestApiRouterMountsSMSLoginCodeRoute" -v` 失败于 404。实现后这两个命令均通过。
- 回归验证：`go test -count=1 ./controller -run "TestSendSMS(Login|Register)Code|TestSMSPhoneLogin|TestSMSRegister|TestAdminTestSMS|TestAdminGetSMSStatus" -v` 通过；`go test -count=1 ./router -run "SMS|User|ApiRouter" -v` 通过；`go test -count=1 ./service -run "SMS|UserPhone|FindUserByActivePhoneBinding" -v` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，继续使用既有 SMS sidecar；Docker server 仍不可用，既有 PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：本轮只完成后端登录验证码发送入口，不包含 default/classic 手机号登录 UI、登录/绑定/换绑/找回完整闭环、真实短信宝通道 smoke 或 live 容器重建后验证。Docker 恢复后仍需重建 `new-api:dev`，再复测 `/api/user/sms/login/code` 与 `/api/user/login/phone` 的已绑定、未绑定、2FA 场景。

## P2-11 SMS 手机号登录前端接入复盘（2026-06-04 本线程）

- RED：先补 default `web/default/src/features/auth/api.test.ts` 与 classic `web/classic/src/components/auth/smsRegisterRequest.test.mjs`，要求登录验证码请求使用 `POST /api/user/sms/login/code`，手机号登录提交使用 `POST /api/user/login/phone`，并保留 `turnstile` 参数。旧实现缺少对应导出和 classic helper，两个目标测试均失败。
- 完成内容：default 登录页按 `sms_enabled` 显示“密码登录 / 手机号登录”模式切换；手机号模式收集手机号和短信验证码，发送验证码与登录提交均校验法务勾选和 Turnstile，发送成功后启动 30 秒倒计时，登录成功后复用既有登录落地和 2FA redirect 分支。
- 完成内容：classic 登录选项页新增“使用 手机号 登录”入口；手机号登录表单支持发送验证码、30 秒重试倒计时、手机号验证码登录和 2FA 弹窗分支，接口请求统一复用 `smsRegisterRequest.js` helper，不新增侵入式手机号字段。
- i18n：新增 default `en/zh/fr/ja/ru/vi` 的登录模式、短信登录、重发倒计时等 key；新增 classic `en/zh/zh-CN/zh-TW/fr/ja/ru/vi` 的“使用 手机号 登录”“手机号登录”“发送验证码”“手机号登录失败”等 key。一次性 Node 检查确认新增 key 在所有目标 locale 中存在且 JSON 可解析。
- 验证命令：RED 后实现，`cd web/default && bun test src/features/auth/api.test.ts` 通过 4 项；`bun test web/classic/src/components/auth/smsRegisterRequest.test.mjs` 通过 4 项；`cd web/default && bun run i18n:sync` 通过；`cd web/default && bun run build` 通过；`cd web/classic && bun run build` 通过；两端登录页 Prettier check 通过；`git diff --check` 通过。
- 浏览器 smoke：`curl -I --max-time 5 http://127.0.0.1:5173/sign-in` 与 `http://127.0.0.1:5174/login` 均返回 200；Playwright 打开 default `/sign-in` 能看到完整登录表单且 error 级 console 为 0，打开 classic `/login` 能看到“登 录”且 error 级 console 为 0。当前 default 运行态未显示短信入口，判断仍受 `/api/status.sms_enabled` 配置或 live 后端版本影响，不能替代 Docker 重建后的真实短信入口 smoke。
- TypeScript 现状：本轮登录页提交后遗留的 default 全仓 TS 债已在 2026-06-04 P2-12 单独收口；P2-11 不再把 typecheck 失败作为残留项，但 Docker live smoke、真实短信通道和手机号绑定/换绑/找回闭环仍未覆盖。
- 残留风险：本轮未做真实短信宝通道 smoke、已绑定手机号真实登录闭环、live 容器重建后 smoke、Docker PostgreSQL schema diff，也未做手机号绑定、换绑、解绑、找回密码闭环。Docker 恢复后必须重建 `new-api:dev`，再验证 `/api/status.sms_enabled`、default/classic 手机号登录入口显示、已绑定手机号发送登录验证码、未绑定手机号拒绝发送、2FA 用户登录分支和响应脱敏。

## P2-12 default 前端 typecheck 收口复盘（2026-06-04 本线程）

- 基线：接续 P2-11 后执行 `cd web/default && bun run typecheck`，失败点集中在 5 类既有 TS 债：`hast` 类型包缺失、affiliate admin rule set `payload.id` 可能为 undefined、SMS sign-up `data.phone` 可选字段被直接 trim、usage logs 泛型 mobile card 直接访问基础日志字段、currency format options 使用 `Required<CurrencyFormatOptions>` 导致 `currencyOverride` 缺失。
- 完成内容：`code-block.tsx` 移除对未安装 `hast` 类型包的直接 import，改由 `ShikiTransformer` 上下文推断 line transformer 参数类型；不新增依赖，避免把单个类型引用扩大成包管理变更。
- 完成内容：affiliate admin 保存 rule set 时先把 `payload.id ?? 0` 收窄为 `ruleSetId`，只有正数 id 才构造更新 payload；SMS sign-up 先归一化 `const phone = data.phone?.trim() ?? ''`，后续校验和提交复用同一个已收窄值。
- 完成内容：usage logs mobile card 在读取 `row.original` 的通用字段前进行局部结构收窄，只把 `created_at` 与 `type` 当作可选 unknown 传给既有展示组件；currency formatter 拆出 `NumericCurrencyFormatOptions` 默认项和内部格式化参数，不再要求默认格式化参数携带 `currencyOverride`。
- 验证命令：`cd web/default && bun run typecheck` 通过；`cd web/default && bun test src/lib/currency.test.ts src/features/auth/api.test.ts src/features/affiliate/admin-lib.test.ts` 通过 26 项；`cd web/default && bun run build` 通过；`cd web/default && bunx prettier --check src/components/ai-elements/code-block.tsx src/features/affiliate/admin.tsx src/features/auth/sign-up/components/sign-up-form.tsx src/features/usage-logs/components/usage-logs-mobile-card.tsx src/lib/currency.ts` 通过；`git diff --check` 通过。
- 残留风险：本轮只收口 default TypeScript 严格性，不替代 classic 端类型/构建健康检查、Docker schema diff、live 容器重建、真实短信宝通道 smoke、Windows 浏览器旧 404 缓存排查或手机号绑定/换绑/找回闭环。

## P1-39 settlement 双跑事件合计审计复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineDoubleRunMatchesLinkedEventTotals`，要求同一周期先 dry-run 不落库，再正式 run，再重复正式 run；正式结算单必须复用同一个 draft，金额必须与 dry-run 一致，并且结算单金额必须等于已链接 commission/head fee 事件合计。旧实现缺少 `AuditAffiliateSettlementEventTotals` 和测试断言 helper，测试按预期编译失败。
- 完成内容：新增只读 `AffiliateSettlementEventTotals` 和 `AuditAffiliateSettlementEventTotals`，按 `settlement_id` 汇总已链接 commission event 的 `commission_cents` 与 head fee event 的 `amount_cents`，并复用既有 `calculateAffiliateSettlementPayable` 计算 deduction/payable。新增 `TestAuditAffiliateSettlementEventTotalsValidatesInputAndSumsLinkedEvents`，覆盖 nil db、非法 id、缺失结算单和负毛利 deduction/payable 场景。
- 安全边界：本轮不改变结算生成、link、冻结、付款或作废逻辑，不新增 GORM model、字段或索引，不保存敏感输入，也不把本地 service 双跑冒充外部真实周期验收。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineDoubleRunMatchesLinkedEventTotals` 失败于缺少审计函数和断言 helper；实现后同命令通过。回归 `go test -count=1 ./service -run "AuditAffiliateSettlementEventTotals|DoubleRunMatchesLinkedEventTotals|AffiliateSettlementPipeline|GenerateAffiliateSettlements|AffiliateSettlement"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun|SMS|Phone|Register"` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，不需要新的 schema diff；Docker server 仍不可用，既有 PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：本轮只完成本地 service 级 dry-run/formal/repeat formal 和 linked event totals 审计，不替代 staging/生产真实充值、真实 relay 消耗、退款、人头费和周期结算双跑。阶段内部 cursor 断点续扫、Docker schema diff 和外部完整周期验收仍待做。

## P1-40 佣金阶段部分进度持久化复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineRecordsPartialCommissionProgressOnFailure`，构造两条 paid source log，并在第二条 `affiliate_commission_events` 创建前强制失败。旧实现把整个佣金阶段事件创建包在一个大事务中，第二条失败会回滚第一条已完成事件，测试失败于已持久化佣金事件数为 0。
- 完成内容：`BuildAffiliatePendingCommissionEvents` 改为按 source log 使用小事务创建佣金事件，同一 source log 内仍保持该 log 的多级佣金事件原子性；每个 source log 成功后更新 `affiliate_job_runs.commission_event_count` 和 `result_snapshot.commission_event_count`。失败路径由既有 `finishAffiliateJobRunFailure` 合并 snapshot，因此 failed job run 会保留已落地的 partial commission progress。
- 安全边界：本轮不按 cursor 跳过 usage logs，不改变 paid/gift/trial/legacy_unknown 归因，不改变佣金比例、KPI 系数、synthetic marker 或结算口径。重复运行仍从头扫描 source logs，并依赖 `createAffiliateCommissionEventIfMissing` 的 synthetic marker 幂等去重。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineRecordsPartialCommissionProgressOnFailure` 失败于 first commission event 被大事务回滚；实现后同命令通过。回归 `go test -count=1 ./service -run "AffiliateCommission|CommissionEvents|SettlementPipeline|RunAffiliateSettlementPipeline|AffiliateJobRun|GenerateAffiliateSettlements|AffiliateSettlement"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun|SMS|Phone|Register"` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，不需要新的 schema diff；Docker server 仍不可用，既有 PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：KPI 和人头费阶段仍使用阶段级大事务，尚未做到同类 durable partial progress；完整阶段内部 cursor 跳扫仍未实现，因为 KPI/佣金/人头费都有累计上下文，不能在未持久化聚合状态时直接跳过 cursor 前日志。Docker schema diff、外部完整周期双跑和真实部署 smoke 仍待做。

## P1-41 KPI 阶段部分进度持久化复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineRecordsPartialKPIProgressOnFailure`，构造两个 affiliate profile 的 KPI 输入，并在第二个 `affiliate_kpi_snapshots` 创建前强制失败。旧实现把整个 KPI 阶段 snapshot 生成包在一个大事务中，第二个失败会回滚第一个已完成 snapshot，测试失败于已持久化 KPI snapshot 数为 0。
- 完成内容：`BuildAffiliateKPISnapshots` 改为按 affiliate profile 使用小事务生成 snapshot，单个 profile 的可见用户、指标计算、档位选择和 snapshot 保存仍保持原子性；每个 profile 成功后更新 `affiliate_job_runs.kpi_snapshot_count` 和 `result_snapshot.kpi_snapshot_count`。失败路径继续由既有 `finishAffiliateJobRunFailure` 合并 snapshot，因此 failed job run 会保留已落地的 partial KPI progress。
- 安全边界：本轮不按 cursor 跳过 usage logs，不改变 paid/gift/trial/legacy_unknown 归因，不改变有效新用户、质量门槛、KPI 档位或系数选择。重复运行仍从头扫描相关 logs，并依赖 `saveAffiliateKPISnapshot` 的唯一键 upsert 语义幂等更新。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineRecordsPartialKPIProgressOnFailure` 失败于 first KPI snapshot 被大事务回滚；实现后同命令通过。回归 `go test -count=1 ./service -run "AffiliateKPI|KPISnapshots|SettlementPipeline|RunAffiliateSettlementPipeline|AffiliateJobRun|AffiliateCommission|CommissionEvents|GenerateAffiliateSettlements|AffiliateSettlement"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun|SMS|Phone|Register"` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，不需要新的 schema diff；Docker server 仍不可用，既有 PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：人头费阶段仍使用阶段级大事务，尚未做到同类 durable partial progress；完整阶段内部 cursor 跳扫仍未实现，因为 KPI/佣金/人头费都有累计上下文，不能在未持久化聚合状态时直接跳过 cursor 前日志。Docker schema diff、外部完整周期双跑和真实部署 smoke 仍待做。

## P1-42 人头费阶段部分进度持久化复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineRecordsPartialHeadFeeProgressOnFailure`，构造同一分销商下两个达标下游用户，并在第二个 `affiliate_head_fee_events` 创建前强制失败。旧实现把整个人头费阶段事件创建包在一个大事务中，第二个失败会回滚第一个已完成事件，测试失败于已持久化人头费事件数为 0。
- 完成内容：`BuildAffiliatePendingHeadFeeEvents` 改为按 relation 使用小事务创建人头费事件，单个 relation 的邀请事件读取、解锁/达标校验、paid stats 计算和事件保存仍保持原子性；每条 relation 成功后更新 `affiliate_job_runs.head_fee_event_count` 和 `result_snapshot.head_fee_event_count`。失败路径继续由既有 `finishAffiliateJobRunFailure` 合并 snapshot，因此 failed job run 会保留已落地的 partial head fee progress。
- 安全边界：本轮不按 cursor 跳过 usage logs，不改变 paid/gift/trial/legacy_unknown 归因，不改变首充门槛、14 天净付费门槛、KPI 档位、人头费金额或 synthetic marker。重复运行仍从头扫描相关 logs，并依赖 `createAffiliateHeadFeeEventIfMissing` 的 synthetic marker 幂等去重。
- 验证命令：RED 阶段 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineRecordsPartialHeadFeeProgressOnFailure` 失败于 first head fee event 被大事务回滚；实现后同命令通过。回归 `go test -count=1 ./service -run "AffiliateHeadFee|HeadFeeEvents|AffiliateKPI|KPISnapshots|AffiliateCommission|CommissionEvents|SettlementPipeline|RunAffiliateSettlementPipeline|AffiliateJobRun|GenerateAffiliateSettlements|AffiliateSettlement"` 通过；`go test -count=1 ./model ./service ./controller ./router -run "Affiliate|RuleSet|Commission|KPI|HeadFee|Settlement|Dashboard|Summary|JobRun|DryRun|SMS|Phone|Register"` 通过。
- schema impact：本轮不新增 GORM model、字段或索引，不需要新的 schema diff；Docker server 仍不可用，既有 PostgreSQL schema diff 缺口仍待恢复后补。
- 残留风险：KPI、佣金和人头费阶段都已具备 durable partial progress，但完整阶段内部 cursor 跳扫仍未实现；这些阶段仍有累计上下文，不能在未持久化聚合状态时直接跳过 cursor 前日志。Docker schema diff、外部完整周期双跑和真实部署 smoke 仍待做。

## P0-9 Goal 模式接手运行态复核（2026-06-04 本线程）

- 接手读取：已按 Goal 要求重读 `native-affiliate-followup-tasklist.zh-CN.md`、`native-affiliate-master-plan.zh-CN.md`、`native-affiliate-development-principles.zh-CN.md`、`native-affiliate-new-thread-tasklist.zh-CN.md`、`native-affiliate-dev-compose-runbook.zh-CN.md`、`native-affiliate-external-acceptance-runbook.zh-CN.md`、`native-affiliate-schema-impact-report.zh-CN.md`、`native-affiliate-sms-reference-audit.zh-CN.md`，并补读 `native-affiliate-handoff-tasklist-v4.zh-CN.md` 作为最新接手入口。结论仍是后端 `/api/affiliate/team` 已存在，P0 旧 404 必须按缓存/端口/旧后端/旧 bundle 排查，不重复实现路由。
- git 基线：`git status --short --branch` 显示 `## feature/native-affiliate-minimal` 且无未提交文件；`git log --oneline -8` 顶部为 `5417a522 docs: add affiliate handoff tasklist v4`、`b2496894 feat: retain affiliate head fee partial progress`、`df9f9485 feat: retain affiliate kpi partial progress`。
- 端口基线：`tmux ls` 显示 `new-api-web: 2 windows`；`ss -ltnp` 显示 `5173`、`5174` 的 node listener 和 `3000` listener 均存在。
- 未登录 API 证据：WSL 内 `curl -i http://127.0.0.1:3000/api/affiliate/team`、`5173`、`5174` 均返回 HTTP 401 JSON，响应体为未登录提示，不是 `Invalid URL (GET /api/affiliate/team)` 404。
- 登录态 API 证据：从 `.codex-local/affiliate-test-accounts.secret.json` 读取一级分销商测试账号但不输出密码或 cookie，分别登录 `3000`、`5173`、`5174` 后带 `New-Api-User: 32` 请求 `/api/affiliate/team?_t=baseline`，三端均 `loginStatus=200`、`teamStatus=200`、`teamSuccess=true`、`total=9`。
- fresh Browser 证据：in-app Browser fresh context 直接打开 `http://127.0.0.1:5173/api/affiliate/team`、`5174`、`3000`，Network 均为 `GET ... => [401] Unauthorized`，页面 JSON 均为未登录提示，不是旧 `Invalid URL` 404。
- 源码复核：default `web/default/src/features/affiliate/api.ts` 和 classic `web/classic/src/pages/Affiliate/index.jsx` 的 team 请求仍带 `_t` cache buster、`Cache-Control: no-cache, no-store, max-age=0` 与 `Pragma: no-cache`；`router/api-router.go`、`controller/affiliate.go` 和 `service/affiliate.go` 中路由/API/service 仍存在。
- Docker 取证：`timeout 20s docker version --format "client={{.Client.Version}} server={{.Server.Version}}"` 只返回 `client=29.5.2 server=`，未返回 server 版本；因此本轮仍不能安全重建 `new-api:dev`、复测运行态 no-store header 或补 Docker PostgreSQL schema diff。
- 结论：当前 WSL、localhost 端口、登录态 API 和 fresh browser 都不能复现旧 404；如果用户实际 Windows Chrome 页面仍显示“推广关系树接口返回 404”，最可能仍是该浏览器既有 tab 的 disk/memory cache、旧标签页、错误 Request URL、代理/端口映射或旧后端运行态。该用户原浏览器 DevTools cache 状态无法由 in-app Browser 代替，仍需用户在原浏览器 Network 勾选 Disable cache 后硬刷新或清站点缓存确认。
- 残留风险：Docker server 不可用导致当前 `3000` 后端可能仍不是最新容器构建，已知 no-store header 和 `daily_trends` live 运行态需 Docker 恢复后重建 `new-api:dev` 再复测。下一步若继续本地可执行任务，优先做 Docker 恢复后的 dev 镜像重建/schema diff；若用户原 Windows 浏览器仍复现旧 404，先收集该浏览器 DevTools Network 证据。

## P1-43 failed pipeline resume 缺失阶段计数降级重跑复盘（2026-06-04 本线程）

- RED：新增 `TestRunAffiliateSettlementPipelineResumeRerunsWhenCompletedStageCountsAreMissing`，构造旧失败 job run 已推进到 `settlement` 阶段但 `kpi_snapshot_count`、`commission_event_count`、`head_fee_event_count` 均为 0 的场景。旧实现把 0 计数当作已完成证据，直接跳到 settlement，测试失败并返回 KPI/佣金/人头费/结算数量全为 0。
- 完成内容：`validateAffiliateSettlementPipelineResumeStage` 在 resume 到后续阶段前，若对应已完成阶段的 job run count 缺失或为 0，则降级到该阶段重跑；这只影响 failed job run resume 的安全校验，不实现阶段内部 cursor 跳扫，不改变正常成功 pipeline 的幂等语义。
- 验证命令：先运行 `go test -count=1 ./service -run TestRunAffiliateSettlementPipelineResumeRerunsWhenCompletedStageCountsAreMissing -v` 观察 RED；实现后同命令通过。补充运行 `go test -count=1 ./service -run 'AffiliateSettlementPipeline.*(Resume|Partial|JobRun|DoubleRun)|GenerateAffiliateSettlementsWithJobRun.*(Resume|Partial|Cursor)' -v`，相关 resume、partial progress、job run 和 double-run 回归通过。
- 残留风险：本轮是“缺少阶段完成证据就保守重跑”的安全修复，不是完整阶段内部 cursor 断点跳扫；KPI、佣金和人头费阶段仍不能在未持久化完整聚合上下文时直接跳过 cursor 前日志。Docker PostgreSQL schema diff、live `new-api:dev` 重建、外部完整周期 dry-run/正式 run 双跑仍待完成。
- 下一步：继续等待 Docker server 恢复后重建 `new-api:dev` 并补 pending schema diff；如继续本地任务，优先做 stage-internal cursor resume 的安全设计/测试切片或管理端 finance 表格增强。

## P0-10 Goal continuation 运行态基线复核（2026-06-04 本线程）

- 接手读取：本轮按 Goal 要求重读当前 followup tasklist、master plan、development principles、new-thread tasklist、dev compose runbook、external acceptance runbook、schema impact report 和 SMS reference audit，并读取 Superpowers 的 systematic-debugging、test-driven-development、verification-before-completion 和 finishing-a-development-branch 流程。
- Git 基线：`git status --short --branch` 显示 `## feature/native-affiliate-minimal` 且无未提交文件；`git log --oneline -8` 顶部为 `e8a95084 fix: clear default frontend typecheck debt`、`e6f03d51 feat: add sms phone login frontend`、`80fb21ad feat: add sms login code endpoint`。
- 端口与 dev server：`timeout 15s tmux ls` 显示 `new-api-web: 2 windows`，`tmux list-windows -t new-api-web` 显示 default/classic 两个 window；`ss -ltnp` 显示 `5173`、`5174` 由 WSL 内 node 监听，`3000` 处于监听状态。
- API 404 证据：WSL 内 `curl -i` 访问 `3000`、`5173`、`5174` 的 `/api/affiliate/team` 未登录均返回 HTTP 401 JSON；Windows 侧 `curl.exe -i` 访问同三个 URL 也均返回 HTTP 401 JSON；in-app Browser Network 打开三端口 `/api/affiliate/team` 也均为 401 Unauthorized，不是旧 `Invalid URL (GET /api/affiliate/team)` 404。
- 运行态缓存头差异：`curl -D - -o /dev/null http://127.0.0.1:3000/api/status` 返回 200，但仍未见 `Cache-Control` / `Pragma` / `Expires` no-store 头；结合源码和 router 测试已覆盖 `/api` no-store，继续判断为当前 3000 live 后端不是最新构建或仍旧容器。
- Docker 状态：按 runbook 只做一次短探测，`timeout 20s docker version --format "client={{.Client.Version}} server={{.Server.Version}}"` 返回 `client=29.5.2 server=` 并以非 0 退出；当前不能安全重建 `new-api:dev`、不能复测 live no-store，也不能补 PostgreSQL schema diff。
- 结论：当前 WSL、Windows curl 和 fresh in-app Browser 都不能复现旧 404；若用户原 Windows Chrome 页面仍显示 404，仍需在该原浏览器 DevTools Network 勾选 Disable cache 后硬刷新或清站点缓存，并检查 Request URL、from disk/memory cache、response body 和 `New-Api-User` header。Docker 恢复后优先重建 `new-api:dev` 并复测 no-store、`daily_trends` 和 schema diff。

## P1-44 affiliate job run 失败错误结构化脱敏复盘（2026-06-04 本线程）

- RED：新增 `TestSanitizeAffiliateJobRunErrorRedactsStructuredSecrets`，覆盖 job run 失败原因中同时出现 key=value、URL query 和 JSON/结构化 secret key 的场景。旧实现只处理 key=value，测试先失败于 URL host/path 与 JSON secret value 仍出现在 `error_message`。
- 完成内容：`sanitizeAffiliateJobRunError` 先复用 `common.MaskSensitiveInfo` 遮 URL、query、IP 和域名，再保留既有 key=value secret redaction，并新增结构化 secret key 正则，覆盖 `password`、`passwd`、`token`、`api_key` / `api-key`、`secret` 的 JSON/colon 形态。
- 安全边界：本轮只收紧 `affiliate_job_runs.error_message` 失败原因脱敏，不改变 settlement pipeline、resume、idempotency key、计数、cursor、规则集、分佣金额或结算状态流转；测试 fixture 使用非真实示例标识，不输出或提交真实密码、cookie、DSN、token、生产地址或完整手机号。
- 验证命令：`go test -count=1 ./service -run TestSanitizeAffiliateJobRunErrorRedactsStructuredSecrets -v` 先 RED，修复后通过；`go test -count=1 ./service -run "SanitizeAffiliateJobRunError|AffiliateJobRun|RunAffiliateSettlementPipeline.*(Failure|Resume|Partial|JobRun|DoubleRun)|GenerateAffiliateSettlementsWithJobRun"` 通过；`git diff --check` 通过。
- 残留风险：本轮不替代 Docker PostgreSQL schema diff、live 容器重建、外部完整结算周期双跑或真实运行态 job run 失败日志审计；后续若其他模块保存错误原因，也应复用通用脱敏策略或单独补测试。

## P2-13 SMS 测试发送/状态查询脱敏审计复盘（2026-06-04 本线程）

- 审计范围：管理员短信测试发送、管理员短信状态查询、短信宝 provider 错误码映射、短信发送日志、注册验证码发送、登录验证码发送、手机号登录返回、状态接口隐藏短信凭据和 DB-backed 限流原始标识保护。
- 结论：当前本地代码已把前端可见响应控制为 `phone_masked`、provider、provider code、scene 和通用错误文案；发送日志只记录脱敏手机号、场景、provider、模板版本、状态、provider code 和耗时；短信宝 transport/provider 失败不会把请求 URL、ApiKey、密码、验证码或签名内部资料透出到响应。
- 验证命令：`go test -count=1 ./common ./model ./service ./controller -run "SMS|SMSBao|AdminTestSMS|AdminGetSMSStatus|RecordSMSSendLog|GetOptionsHidesSMSBaoCredential|RateLimit|Phone|LoginCode|RegisterCode"` 通过。
- 安全边界：本轮是本地代码审计和回归证据收口，不调用真实短信宝通道，不读取或输出 `.codex-local` 内的真实账号、cookie、手机号、签名、ApiKey、密码或数据库连接信息。
- 残留风险：真实短信宝测试发送、状态查询和失败错误码映射仍必须等签名审核、模板确认和脱敏日志策略明确后按 smoke runbook 执行；Docker PostgreSQL schema diff、live 容器重建、手机号绑定/换绑/解绑和找回闭环仍待做。

## P0-11 Goal continuation 运行态基线复核（2026-06-04 本线程）

- 接手读取：本轮继续按 Goal 要求复核 followup tasklist、master plan、development principles、new-thread tasklist、dev compose runbook、external acceptance runbook、schema impact report 和 SMS reference audit，并读取 Superpowers 的 systematic-debugging、test-driven-development、verification-before-completion 与 finishing-a-development-branch 流程。
- Git 基线：`git status --short --branch` 显示 `## feature/native-affiliate-minimal` 且无未提交文件；`git log --oneline -8` 顶部为 `b4298420 docs: record sms redaction audit`、`1aeccbb0 fix: redact affiliate job run errors`、`e8a95084 fix: clear default frontend typecheck debt`。
- 端口与 API：`tmux ls` 显示 `new-api-web: 2 windows`，default/classic 两个 window 存在；`ss -ltnp` 显示 `5173`、`5174` 由 WSL 内 node 监听，`3000` 处于监听状态。WSL 与 Windows `curl` 访问 `3000`、`5173`、`5174` 的 `/api/affiliate/team` 未登录均返回 HTTP 401 JSON，不是旧 `Invalid URL` 404。
- Docker 状态：本轮只做一次短探测，`timeout 20s docker version --format "client={{.Client.Version}} server={{.Server.Version}}"` 返回 `client=29.5.2 server=` 且非 0 退出；当前仍不能推进 live 容器重建、Docker PostgreSQL schema diff 或 live no-store header 复测。
- 结论：当前 WSL 端口、Windows curl 和本地 dev server 都不能复现旧 404；用户原 Windows 浏览器 DevTools 的 Request URL、from cache 和 Response Body 仍是唯一未被本地 fresh context 取代的证据口。Docker 恢复后优先补 schema diff 和 live 容器重建验证。

## P2-14 default React checked/onChange console warning 基线复核（2026-06-04 本线程）

- 目标：收口第 11 节中 default `5173` 既有 React `checked`/`onChange` console warning 的归属，确认它是否由分销页触发。
- 取证：in-app Browser 打开 `http://127.0.0.1:5173/` 时出现 1 条 React `checked` prop 缺少 `onChange` handler 的 console error；打开未登录 `http://127.0.0.1:5173/affiliate/` 会跳转到登录页，新增 console 为 0 error / 0 warning。
- 登录态 smoke：WSL Playwright 从 `.codex-local/affiliate-test-accounts.secret.json` 读取一级分销测试账号但不输出凭据或 cookie，登录后重新打开 `http://127.0.0.1:5173/affiliate/`，console 为 0 error / 0 warning，`/api/affiliate/status`、`/api/affiliate/team`、`/api/affiliate/summary`、`/api/affiliate/logs` 均返回 200。
- 结论：当前 React `checked`/`onChange` error 属于 default 根页或共享登录/首页基线，不是分销页本身触发；后续如要修复，应作为 default 前端通用质量债单独定位，不阻塞分销页 tasklist 收口。
- 残留风险：本轮只覆盖 default `5173` 的根页、未登录分销跳转和一级分销商登录态分销页；不替代第 11 节要求的多角色浏览器 smoke、classic/default 全量 parity 审计或外部 staging/生产浏览器验收。
