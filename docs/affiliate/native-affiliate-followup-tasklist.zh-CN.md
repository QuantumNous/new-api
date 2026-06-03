# 原生分销后续接手 Tasklist

更新日期：2026-06-03

适用分支：`feature/native-affiliate-minimal`

目标：接手已提交的原生分销 MVP 后，优先收口本线程暴露的环境、缓存、安全脱敏、规则管理可用性、结算可靠性和发布治理问题，避免重复实现已经存在的后端路由。

## 0. 接手前必须读取

- [ ] 先读取 `docs/affiliate/native-affiliate-master-plan.zh-CN.md`，确认业务口径、分销层级、Feishu 方案和验收目标。
- [ ] 先读取 `docs/affiliate/native-affiliate-development-principles.zh-CN.md`，严格遵守最小侵入、sidecar、TDD、脱敏、RMB 单位、权限和发布证据原则。
- [ ] 先读取 `docs/affiliate/native-affiliate-new-thread-tasklist.zh-CN.md`，理解 Phase 1 到 Phase 13 的已完成项、残留风险和历史复盘。
- [ ] 先读取 `docs/affiliate/native-affiliate-dev-compose-runbook.zh-CN.md`，确认 WSL2 Docker Compose dev 的启停、重建、dump 恢复和清理方式。
- [ ] 先读取 `docs/affiliate/native-affiliate-external-acceptance-runbook.zh-CN.md`，外部验收不得用本地 smoke 冒充 staging/生产验收。
- [ ] 先读取 `docs/affiliate/native-affiliate-schema-impact-report.zh-CN.md`，新增或修改 GORM model 前后必须重新做 schema impact。
- [ ] 先读取 `docs/affiliate/native-affiliate-sms-reference-audit.zh-CN.md`，手机号/SMS 只走 provider/sidecar 路线，不能直接迁移旧 fork 的侵入式实现。
- [ ] 继续按 `.agents/skills` 和可用 MCP/plugin/CLI 工作。当前项目相关技能至少包括 `classic-to-default-sync`、`i18n-translate`、`shadcn-ui`、`vercel-react-best-practices`、`superpowers:systematic-debugging` 和飞书文档相关 skill。
- [ ] 飞书资料作为业务口径来源继续复核，但不得把内部账号、密码、DSN、cookie、完整手机号、生产地址或敏感截图写入仓库、tasklist、commit message 或测试日志。

## 1. 当前运行态基线

- [x] 后端路由 `/api/affiliate/team` 已存在，不要重复实现。源码位置包括 `router/api-router.go`、`controller/affiliate.go`、`service/affiliate.go`。
- [x] WSL 内未登录访问 `http://127.0.0.1:3000/api/affiliate/team` 已返回 401，不再是旧 `Invalid URL` 404。
- [x] 使用 `ChengyuWang0807` 登录并带 `New-Api-User` header 后，`3000`、`5173`、`5174` 的 `/api/affiliate/team` 均已返回 200 且 `total=9`。
- [x] 当前前端 dev server 已在 WSL 内用 `tmux` 启动，session 为 `new-api-web`，window 为 `default` 和 `classic`。
- [x] 当前端口约定：`5173` 是 default 前端，`5174` 是 classic 前端，`3000` 是 new-api 后端容器 HTTP 入口。
- [x] P0 收口前曾有两处未提交的前端缓存规避改动：`web/default/src/features/affiliate/api.ts` 和 `web/classic/src/pages/Affiliate/index.jsx`；已随本线程 P0 提交收口。
- [x] 后续开始任何代码改动前先运行 `git status --short --branch`，明确区分用户已有改动、上一轮缓存规避改动和本轮新增改动。

## 2. Dev 前端运行与重启后恢复

- [ ] 明确给后续线程和用户说明：`5173`、`5174` 是临时前端 dev server 进程，不是类似 `new-api` 的 Docker 容器；电脑重启后端口拒绝连接是正常现象。
- [ ] 所有前端端口启动命令优先在 WSL 内执行，不使用 Windows 侧 `Start-Process` 作为默认路径。
- [ ] 保留或新增 WSL 启动脚本，例如 `scripts/dev-web-tmux.sh`，一键启动 `tmux new-session -s new-api-web` 并分别运行 default/classic dev server。
- [ ] 在 runbook 中补齐 `tmux attach -t new-api-web`、`tmux ls`、`tmux kill-session -t new-api-web`、查看 default/classic 日志和重启单个 window 的命令。
- [ ] 修正 `docker-compose.dev.yml` 或相关文档里旧的前端端口说明，避免继续写 `3001` 之类与当前 `5173`/`5174` 不一致的提示。
- [ ] 前端启动后必须验证 `curl -I http://127.0.0.1:5173/` 和 `curl -I http://127.0.0.1:5174/` 返回 200。
- [ ] 前端启动后必须验证 `curl -i http://127.0.0.1:5173/api/affiliate/team` 和 `curl -i http://127.0.0.1:5174/api/affiliate/team` 未登录返回 401 而不是 404。

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
- [ ] 继续验证未登录 curl：`http://127.0.0.1:5173/api/affiliate/team`、`http://127.0.0.1:5174/api/affiliate/team`、`http://127.0.0.1:3000/api/affiliate/team` 均应返回 401，不应返回 404。
- [ ] 登录后用浏览器控制台、DevTools request replay 或 curl 带 cookie 与 `New-Api-User` header 验证 `/api/affiliate/team` 返回 200 且 `total` 非 0。
- [ ] 如果 Network 显示缓存，先让浏览器勾选 Disable cache 并硬刷新，必要时清站点缓存。
- [ ] 评估当前前端 `_t` cache buster 和 `Cache-Control: no-cache` 临时修复是否保留、改成统一 API no-cache 封装，或改为后端对 `/api/*` 返回 `Cache-Control: no-store`。
- [ ] 如果保留前端 cache buster，必须补 default/classic 对应测试或至少用浏览器 Network 证明 Request URL 已带 `_t` 且不再命中 disk cache。
- [ ] 如果改为后端 no-store，必须覆盖 `/api/affiliate/team`、登录态 API 和通用 API 响应，避免缓存 401/404/敏感 JSON。
- [ ] 收口后提交一个独立 commit，说明这是缓存/部署链路修复，不是后端路由实现。

## 5. Scoped 使用日志脱敏优先级

- [ ] 立即复核 `service/affiliate_logs.go` 的 scoped 日志脱敏字段，当前疑点是只清理了 `Ip`、`RequestId`、`UpstreamRequestId` 和部分 `other` 字段，未清理 `ChannelId`、`ChannelName`、`TokenId`、`TokenName`。
- [ ] 立即复核后端 CSV 导出，当前疑点是 `controller/affiliate.go` 仍导出 `channel_id`、`channel_name`、`token_id`、`token_name`。
- [ ] 立即复核 default 前端 CSV 导出，当前疑点是 `web/default/src/features/affiliate/lib.ts` 仍导出 channel/token 字段。
- [ ] 按治理原则修正 scoped 使用日志：分销商视角不得看到渠道成本、内部渠道源、token、IP、request id、upstream request id 和非授权字段。
- [ ] 用 TDD 更新已有测试。先让 `controller/affiliate_test.go` 和 `web/default/src/features/affiliate/lib.test.ts` 中期待 channel/token 的断言 RED，再改实现到 GREEN。
- [ ] 审核 classic/default 页面渲染，避免前端表格列继续展示已经脱敏或删除的内部字段。
- [ ] 修复后补一条脱敏审计复盘到本 tasklist 或旧 tasklist，写清楚隐藏字段清单和测试命令。

## 6. 分销管理指标体系表格化

- [x] 分销管理里的规则、指标、KPI、人头费、风控和结算配置建议做成表格或矩阵，而不是继续以 JSON textarea 或散卡片为主。
- [ ] 佣金规则表：列包含层级、单用户累计净付费下限、单用户累计净付费上限、基准比例、最高比例 cap、是否需人工审批、排序和启停状态。（2026-06-04 审计：tier 表格字段已覆盖净付费区间、比例、cap、人工审批和排序；`AffiliateCommissionRuleInput` 尚无 `status`，启停状态仍待后端输入与 UI 同步实现。）
- [x] KPI 档位表：列包含层级、档位 code、档位名称、有效新用户阈值、净付费消耗阈值、最终系数、质量门槛和排序。（2026-06-04 审计：`kpi_tiers` 已覆盖这些字段，default/classic 表格编辑器会按字段动态生成运营表格，并对百分比字段做 bps/percent 转换。）
- [ ] 人头费规则表：列包含层级、适用 KPI 档位、金额、首充门槛、14 天净付费门槛、解锁天数、是否启用。（2026-06-04 审计：金额、首充、周期净付费、资格天数和解锁天数已覆盖；人头费 rule model/input 尚无启停字段。）
- [ ] 风控规则表：列包含纯赠金额占比阈值、异常用户占比阈值、退款阈值、二次付费率阈值、自刷/批量异常策略和处理动作。（2026-06-04 审计：比例阈值已覆盖；自刷/批量异常策略与处理动作尚未模型化，只能暂存在 metadata，不能视为运营友好表格完成。）
- [ ] 结算配置表单或表格：包含结算周期、冻结天数、最低结算金额、人工复核阈值、自动结算开关和备注。（2026-06-04 审计：周期、冻结天数、最低结算金额和人工复核开关已覆盖；自动结算开关与备注尚未模型化。）
- [x] 输入单位必须面向运营：金额用元，比例用百分比，保存时再转换为 cents/bps；页面不得让运营直接填写 cents 或 bps。
- [ ] 增加规则变更 diff 预览，发布、归档、回滚和覆盖保存必须二次确认。
- [ ] 增加复制上一版本、导入导出 JSON、只读查看已发布版本和高级 JSON 模式，但高级 JSON 不能作为默认入口。
- [x] default 与 classic 需要保持功能 parity，但视觉可以遵循各自设计系统。

## 7. Feishu 业务口径复核与种子规则

- [ ] 重新核对飞书分销方案的净付费口径：只计算 paid 净付费消耗，不计算赠金、试用、退款、异常、自刷和内部测试。
- [ ] 重新核对有效新用户口径：邀请归因有效、首充达标、14 天净付费达标、无退款/自刷/批量异常。
- [ ] 复核一级佣金档位：0-200、200-800、800-1500、1500-5000、5000+ 等区间的基准比例和 cap。
- [ ] 复核二级佣金档位：0-200、200-800、800-1500、1500-5000、5000+ 等区间的基准比例和 cap。
- [ ] 复核 KPI 规则：最终档位应取有效用户数档位和净付费消耗档位的较低者，质量门槛可降档或触发复核。
- [ ] 复核人头费规则：不按注册直接发放，必须满足首充和 14 天净付费门槛。
- [ ] 复核分销邀请注册赠送额度与普通邀请注册赠送额度差异，确保赠金不计佣、不计 KPI。
- [ ] 把已核对的飞书规则沉淀为可导入的默认 rule set seed，避免每次手工输入运营规则。
- [ ] 对 seed 增加 Go 测试，确保区间无重叠、无空洞、金额/比例单位转换正确、发布版本不可变。

## 8. 佣金、KPI、人头费与结算可靠性

- [x] 审计 `service/affiliate_commission.go` 中一次性 `Find(&logs)` 的无界查询风险，改成按时间窗口和 ID cursor 分批扫描。
- [x] 审计 `service/affiliate_kpi.go` 中 KPI 计算的无界日志加载风险，改成分批聚合或数据库侧聚合。
- [x] 审计 `service/affiliate_head_fee.go` 中人头费计算的无界日志加载风险，改成分批聚合并保留幂等记录。
- [ ] 给佣金、KPI、人头费、结算任务增加 run record 或 job execution 记录，包含参数、窗口、执行人、开始/结束时间、状态、错误、扫描进度和幂等 key。（2026-06-03 已为管理员 settlement pipeline 增加 `affiliate_job_runs` 顶层 job execution；2026-06-04 已为单独 `AdminGenerateAffiliateSettlements` endpoint 增加 `settlement_generate` job run；可恢复 cursor 和 Docker PostgreSQL schema diff 仍待补。）
- [x] 完整验证重复执行同一周期不会重复计佣、重复发人头费或重复生成结算单。（2026-06-04 已补 service 级完整 pipeline 重复运行审计测试；外部完整结算周期双跑仍按 external acceptance runbook 执行。）
- [x] 补充 refund、partial refund、gift-only、mixed paid/gift/trial、legacy_unknown、任务钱包扣费、异步任务退款等样本。（2026-06-04 已补 mixed paid/gift/trial/legacy_unknown + partial refund 分佣测试，并复跑现有 gift-only、quota sidecar、人头费、任务钱包扣费/退款 source segment 测试。）
- [x] 明确历史未标记日志是否进入灰度回填、人工复核或直接排除，不得默认把未知来源计为 paid。（2026-06-04 已明确当前服务策略：无来源日志和 `legacy_unknown` 默认直接排除在 paid 业绩、KPI paid 统计和人头费资格外；如需纳入，只能通过灰度回填或人工复核补写可信 paid sidecar 后再计算。）
- [ ] 完整结算周期必须做双跑：dry-run 与正式 run 对比，重复正式 run 幂等，结算单金额与事件合计一致。

## 9. Dashboard 与统计口径

- [x] 复核 `service/affiliate_summary.go` 的有效新用户统计，避免只按 invite event 简单计数而没有套用飞书有效用户门槛。（2026-06-04 已修复 dashboard summary：无 published 规则时不把 invite 直接计为有效；有规则时按同层级人头费规则的首充、14 天 paid 净消耗、无退款/异常条件判定。）
- [x] 复核 dashboard 的净消耗统计，确保只统计 paid 净付费消耗并正确扣除退款，不把赠金、试用、legacy_unknown 或异常流量算入业绩。（2026-06-04 已修复 `service/affiliate_summary.go`，dashboard 净消耗改为按 cursor 扫描日志并只累计 paid attribution，同时跳过 abnormal 流量。）
- [x] 分销商端 dashboard 保持卡片、趋势图、关系树和明细表组合，不建议全部表格化。（2026-06-04 已审计 classic/default 分销商页：当前为摘要卡片 + 推广关系树 + scoped logs 明细表组合，不把看板整体表格化；趋势图仍待后续数据接口与 UI 设计补齐。）
- [x] 管理端指标配置和结算审核更适合表格化，分销商端看板更适合“摘要卡片 + 趋势 + 表格明细”。（2026-06-04 已确认前期规则配置已表格化，default rule-array-editor 与 admin finance helper 测试覆盖表格字段和人民币/百分比单位；结算审核完整表格 UI 继续按管理端 finance 后续任务推进。）
- [x] default/classic 都要显示 RMB 主单位，必要时 raw quota 只作为调试或附加列，不作为主要展示。（2026-06-04 已审计：classic dashboard card 使用 `net_consumption_rmb` 为主值、raw quota 为描述；default scoped logs 使用 RMB 单元格、raw quota 仅在 title/CSV 附加列。）

## 10. 手机号/SMS 后续

- [ ] 当前 SMS 限流为内存实现，生产多实例前必须评估 Redis/数据库分布式限流，否则不同实例之间会绕过限制。
- [ ] 如果启用手机号注册，必须复用 Phase 5 的统一邀请归因和初始额度规则。
- [ ] 如果启用手机号登录/绑定，继续使用 sidecar `user_phone_bindings`，不要直接改官方 `users` 表。
- [ ] 短信宝真实通道 smoke 必须在签名审核通过、模板确认和脱敏日志策略明确后执行。
- [ ] 测试发送、状态查询和失败错误码映射不得输出完整手机号、验证码、ApiKey、密码或签名内部资料。

## 11. 前端质量与 parity

- [ ] classic 与 default 的分销商中心、分销管理、用户 inviter 管理、规则集、佣金和结算操作必须保持功能 parity。
- [ ] 新增前端功能时先确认适用 skill：classic 同步 default 用 `classic-to-default-sync`，文案用 `i18n-translate`，default 组件优先遵守 shadcn/default 现有模式。
- [ ] 所有新增前端 API 要统一处理登录态、错误提示、no-cache 策略和 RMB 单位，不要每个页面散写。
- [ ] 浏览器 smoke 至少覆盖未开通用户、一级分销商、二级分销商、管理员和超级管理员视角。
- [ ] 对当前 `5173` default 页面已有的 React checked/onChange console warning 做基线记录，确认是否与分销页面无关；后续可以作为前端质量债单独修。
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
- [ ] P1：把分销管理规则配置重构为运营友好的表格/矩阵，并保留高级 JSON 导入导出。（2026-06-03 已完成 default/classic 可视编辑表格化和高级 JSON 文本保留；导入/导出按钮、diff 预览和复制上一版本仍待做。）
- [ ] P1：佣金、KPI、人头费和结算任务改造为分批、可恢复、幂等、可审计。（2026-06-04 已完成 usage logs 的 `created_at,id` cursor 分批扫描、完整 pipeline 重复运行幂等审计；2026-06-03 已完成 settlement pipeline 顶层 job run 审计记录、settlement pending/ready event grouping 的 `id` cursor 分批扫描和 settlement event link 更新批量拆分；可恢复 cursor、单独 generate endpoint run record 和外部完整周期 dry-run/正式 run 双跑验收仍待做。）
- [ ] P2：把飞书规则沉淀为默认 rule set seed，并增加单位转换、区间完整性和发布不可变测试。
- [ ] P2：补齐 SMS 分布式限流、手机号注册归因和真实通道 smoke。
- [ ] P2：完善 dashboard 统计口径、浏览器截图回归和外部验收归档。

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
- 残留风险：classic 分销 scoped logs 页面依赖后端脱敏作为安全边界，当前后端已过滤敏感字段；classic UI 仍可在 affiliate mode 下尝试渲染“渠道信息”，但拿到的是后端清空后的空值，不构成敏感泄漏。后续可单独做 UI 清理，避免显示 `0 - [未知]` 这类无意义信息。
- 下一步：进入 P0-3，补 WSL 前端 dev server 一键启动脚本和 runbook；如要更强运行时验证，可在重建后端容器后用真实页面再捕获 `/api/affiliate/logs` 响应，确认 channel/token 字段为空。

## P0-3 WSL 前端 dev server 脚本与 runbook 复盘（2026-06-03 本线程）

- 完成内容：新增 `scripts/dev-web-tmux.sh`，在 WSL 内一键启动 default/classic 两个 Rsbuild dev server。默认 tmux session 为 `new-api-web`，default 监听 `5173`，classic 监听 `5174`，API proxy 指向 `http://localhost:3000`。如果 session 已存在，脚本只提示 attach 和 list-windows，不重复启动端口。
- 完成内容：更新 `docker-compose.dev.yml` 顶部注释，移除旧 `cd web && bun run dev` 和 `3001` 说明，改为 `./scripts/dev-web-tmux.sh`、`5173` default、`5174` classic。更新 `native-affiliate-dev-compose-runbook.zh-CN.md`，补充前端 dev server 不是 Docker 容器、电脑/WSL 重启后需重启脚本、tmux attach/list/capture/kill 命令、端口 smoke 和依赖缺失处理。
- 验证命令：`bash -n scripts/dev-web-tmux.sh` 通过；当前已有 `new-api-web` session 时运行 `./scripts/dev-web-tmux.sh` 输出 existing-session 提示并退出 0；`curl -I http://127.0.0.1:5173/` 与 `curl -I http://127.0.0.1:5174/` 均返回 200；`curl -i http://127.0.0.1:5173/api/affiliate/team` 与 `5174` 未登录均返回 401；`git diff --check` 通过。
- 残留风险：本轮没有 kill 当前运行中的 `new-api-web` session 做冷启动演练，避免打断正在使用的 5173/5174；脚本冷启动路径由语法检查、当前 tmux 命令读取和依赖路径检查覆盖，后续如电脑重启可直接执行脚本验证。
- 下一步：P0 已完成本地收口，后续建议先按主题提交 `cache/dev-server runbook` 与 `scoped logs redaction` 两个 commit，或继续进入 P1 dev/prod 镜像治理。

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
- 缺口结论：风控规则只覆盖纯赠、异常、退款和二次付费率阈值，尚未把自刷/批量异常策略和处理动作模型化；结算配置只覆盖周期、冻结天数、最低结算金额和人工复核开关，尚无自动结算开关与备注。
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
