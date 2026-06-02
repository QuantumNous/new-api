# 原生分销开发原则与踩坑治理

更新日期：2026-06-02

## 1. 最高原则

后续开发目标不是“快速把旧工作区全部搬进来”，而是在官方最新基线上做长期可维护的最小侵入二开。

必须遵守：

- 官方最新基线优先。
- 新功能优先新增表、新 service、新 API。
- 官方核心表结构尽量不动。
- 官方主链路只做薄 hook。
- 易变业务参数配置优先，不把分佣比例、KPI 阈值、人头费、短信模板和签名硬编码。
- 前端优先美观、可用、贴近 new-api 现有风格。
- 每批改动可解释、可测试、可回滚、可合并官方更新。

## 2. Git 与仓库治理

规则：

- 基于 `/home/rain/projects/new-api-rain021217` 开发。
- `projects/new-api-liu23zhi` 只读参考，不再作为主开发工作区。
- 不在脏工作区上解决上游合并。
- 不把大批无关改动混在一个提交。
- 定期进行 git 分类分批提交，按“后端 schema/service、薄 hook、classic 前端、default parity、测试、文档”这类强相关范围归组。
- 提交次数不要过多，避免一个小修小补一个 commit；以“一个可解释、可验证、可回滚的工作单元”为提交粒度。
- 长任务至少在阶段结束、切换任务、拉取上游、运行大范围重构前整理一次工作树。
- 每次提交前运行 `git status --short`，确认源码改动、文档改动、runtime 临时文件和密钥文件没有混在一起。
- 工作树应长期保持整洁，只允许存在当前任务相关改动和明确的本地未跟踪指导文档。
- 不提交 dump、runtime、截图大文件、生产 DSN、账号密码。
- 不 amend commit，除非用户明确要求。
- 每次合并官方前先确保当前改动已分批提交或妥善暂存。

踩坑：

- 旧工作区相对官方已有 134 个文件差异、6000+ 行新增、800+ 行删除，继续堆功能会显著增加上游合并难度。
- 官方近期调整 classic Rsbuild/dev build；旧 Vite/Rsbuild 改动容易冲突。
- `web/bun.lock`、classic package/config、classic 登录/注册文件是高冲突区域。
- 本仓库最初通过 `git clone --depth 1 --single-branch` 拉取，是 shallow repository；VS Code Git 图表只能看到一条历史属于正常现象。需要完整历史时执行 `git fetch --unshallow --tags` 后再查看。

## 3. 数据库治理

规则：

- 服务器数据库已迁移到 PostgreSQL，本地不再重做迁移。
- 新线程第一步必须下载服务器最新 PostgreSQL dump。
- 如果最新 dump 已经下载到 `runtime/prod-pg-snapshots/` 并校验通过，后续线程默认不再直连生产数据库，除非用户明确要求重新抓取。
- 本地恢复到隔离库，不覆盖旧 dev/staging 数据。
- 每次新增 GORM model 前后跑 schema impact。
- 分销业务状态优先 `affiliate_*` / sidecar 表。
- 分销规则、KPI 档位、人头费、风控阈值、短信配置优先新增独立配置表或 sidecar 表。
- 配置表必须支持版本、启用状态、生效时间和审计。

禁止：

- 向 `users.role` 新增分销商角色。
- 为统计方便向官方核心表新增大量分销专用列。
- 把比例、阈值、模板、签名、短信通道 ID 等运营参数写死在代码中。
- 把生产 DSN 或密码写进脚本参数、文档、commit、gate artifact。

踩坑：

- 本地旧快照文件仍停在 2026-06-01，不是服务器当前最新数据。
- 本地不能直接访问服务器 compose 网络中的 `postgres:5432`。
- 直连生产数据库、下载生产 dump、读取 `.codex-local/sources.yml` 都属于敏感操作；允许 AI/脚本读取 `.codex-local/sources.yml` 作为本地密钥源，但禁止输出、复制、提交或记录其中内容。如出现 TAC/安全风险提示，应停止继续外连，确认脱敏边界后再继续。
- nmig schema+data 路线曾导致 new-api 识别不到 `channels` 表。
- 成功路线是先由目标版本 new-api AutoMigrate 建 schema，再只迁移数据；但这已是归档路线，不是本轮本地任务。

## 3A. TAC 与敏感数据治理

规则：

- `.codex-local/sources.yml` 允许 AI/脚本读取作为本地密钥源，用于安全获取服务器数据库连接信息或下载快照。
- 读取 `.codex-local/sources.yml` 时禁止 `cat` / `sed` 全文输出，禁止把 DSN、密码、端点、YAML 内容复制到聊天、文档、commit、日志或测试报告。
- `runtime/prod-pg-snapshots/` 只允许保存本地开发 dump 和校验文件，目录已被 Git 忽略。
- 一旦生产 dump 已下载并校验通过，后续开发优先使用本地恢复库，不再重复访问生产数据库。
- 如果 goal 模式触发 TAC/安全风险提示，先暂停外部数据库访问，确认 Git 忽略、日志脱敏和任务边界，再继续本地开发。
- 如果连接信息曾在聊天、命令行、日志或文档中暴露，应视情况更换临时数据库密码或吊销临时访问。
- 新线程交接时只描述“dump 已下载到 runtime 并校验通过”，不粘贴 DSN、密码、连接 YAML 内容或 dump 详情。
- 脚本读取生产连接时必须使用 stdin、临时环境变量或 `.codex-local`，不能把 DSN 写入 git tracked 文件。
- dump 文件不得上传、提交、压缩分享或作为测试报告附件。

## 3B. WSL2 Docker Compose 本地部署

本地开发应在 WSL2 内用 docker-compose 部署一个隔离的 new-api dev 环境，方便浏览器、接口、数据库和真实账号 smoke。

规则：

- dev 镜像名使用 `new-api:dev`。
- 主服务容器名使用 `new-api`。
- Redis 和 PostgreSQL 使用官方 `redis:latest`、`postgres:latest` 镜像，仅限本地 dev；生产和 staging 不使用 `latest`。
- Redis/PostgreSQL 容器名建议使用 `new-api-redis`、`new-api-postgres`，避免和主服务容器重名。
- compose 网络、volume 和端口必须与其他项目隔离，避免覆盖旧开发库或生产数据。
- 本地 compose 环境不得使用生产 DSN，只能使用 compose 内部 PostgreSQL 或已恢复的本地隔离库。
- 启动前先确认 WSL2 Docker daemon 可用：`docker version`、`docker info`、`docker compose version`、`docker ps`。
- Docker daemon 阻塞时先修复 Docker Desktop/WSL 集成或本机 Docker Engine，不在业务代码中绕过。
- 恢复生产快照后必须采集核心表行数，并用真实角色账号做 smoke。
- dev compose 可以暴露 `127.0.0.1:3000` 和本地 PostgreSQL 调试端口，但不要监听公网地址。

## 4. 后端治理

规则：

- 分销业务逻辑集中在 `service/affiliate_*.go`。
- API 集中在 `/api/affiliate/*`。
- 管理员 API 和分销商 API 明确分离。
- scope 查询必须统一走 scope service，不允许前端传任意 `user_id` 直接查。
- 管理员编辑 `inviter_id`、人工关系、分销身份变更必须审计。
- 缓存必须有明确失效点。
- 佣金、KPI、人头费和结算必须记录规则集版本。
- 发布新规则集前必须校验业务 cap、倒挂风险和必填阈值。

官方主链路 hook 要求：

- 注册/OAuth/微信/手机号注册 hook 只负责收集 invite context。
- 充值 hook 只负责通知 paid 来源账本。
- 扣费/日志 hook 只负责通知来源拆分和可计佣消耗。
- hook 内不堆 KPI、佣金、结算逻辑。

配置治理要求：

- 飞书分销方案及子页是默认业务口径来源。
- 飞书文档里的分佣比例、KPI 系数、人头费、有效用户定义和质量门槛只能作为 seed value。
- 管理员端必须能修改后续可能变化的指标。
- 规则变更应先保存草稿，再发布为生效版本。
- 历史结算不能因为当前规则变化而自动改变口径。
- 分销商端只读展示当前生效规则摘要，不提供规则编辑入口。

踩坑：

- `/api/user/self` 要求 `New-Api-User` header；手写 fetch 不带头会 401，这不等于页面真实鉴权失败。
- 分销 profile 403 不能直接当整页错误展示，管理员无 profile 也应能进入管理员分销管理。
- 分销模块关闭时 active 分销码应降级为普通邀请码规则，否则恢复开关后可能误计佣。

## 5. 前端审美与质量原则

前端不是“能显示表格就行”。分销管理是给分销商和管理员长期使用的业务控制台，必须美观、清晰、贴近 new-api。

classic 优先：

- 优先复用 classic 现有 layout、sidebar、card、table、filter、empty state、modal、tag。
- 分销首页是统计分析看板，不是 CRUD 表格堆叠。
- 使用数据卡、趋势图、KPI 进度、团队层级、佣金/结算概览。
- 消耗明细复用官方使用日志交互。
- 移动端必须能用，不能表格溢出导致不可操作。

default 同步：

- default 使用自身 React/Tailwind/Base UI 体系。
- 不把 Semi Design 组件直接复制到 default。
- 新文案必须 i18n。

视觉验收：

- 普通用户未开通。
- 一级分销商。
- 二级分销商。
- 管理员。
- 超级管理员。
- 分销模块关闭。
- 移动端窄屏。

踩坑：

- 只跑前端 build 不代表页面运行时通过。
- classic `/console/affiliate` 和 default `/affiliate/` 路由不同。
- classic 主题下访问 `/affiliate/` 是 404；default 旧链接需要单独兼容。
- 页面不能因为单个接口 403/500 整页白屏或“页面渲染出错”。

## 6. Skill 与前端能力提升

本仓库已有 `.agents/skills`，开发前应主动读取相关 skill。

可用技能：

- `.agents/skills/shadcn-ui/SKILL.md`：default UI、shadcn、Tailwind、组件组合。
- `.agents/skills/i18n-translate/SKILL.md`：default i18n 同步和多语言补全。
- `.agents/skills/classic-to-default-sync/SKILL.md`：将 classic 改动审查并同步到 default。
- `.agents/skills/vercel-react-best-practices/AGENTS.md`：React 性能、waterfall、bundle、render 优化。

使用原则：

- 做 classic 页面前，先阅读现有 classic 页面和组件，不套默认 AI 模板。
- 做 default 页面前，先读 shadcn/default skill 和 `web/default` 组件模式。
- 新增文案前，先规划 i18n key。
- classic 完成后，如需要 default parity，使用 classic-to-default-sync 思路逐项比对。
- 如现有 skill 不足，可以搜索或安装更适合前端审美/可视化/图表/React 的 skill，但必须先说明用途，不随机安装无关工具。

## 7. RMB 单位原则

规则：

- 分销页面主显示统一站内 RMB。
- 原始 quota/token 只出现在 tooltip、调试字段或导出附加列。
- classic 复用 `web/classic/src/helpers/render.jsx` 的额度展示逻辑。
- default 复用 `web/default/src/lib/currency.ts`。
- 后端返回值需要明确字段语义：raw quota、USD amount、CNY amount、paid net amount 不混用。

踩坑：

- 旧分销页使用 new-api 原始 token/quota 单位，业务方无法直接理解。
- 佣金是按用户实际消耗，不是按充值金额。
- 会员等级越高利润越少，单用户累计净付费消耗区间阶梯必须保留。

## 8. 权限与安全原则

规则：

- 分销商只能看授权 scope。
- 一级分销商可看二级分销商及二级下线。
- 二级分销商只看自己的下线。
- 普通用户不进入分销统计。
- 管理员和超级管理员默认全局。
- scoped 使用日志隐藏渠道成本、内部渠道源、非授权用户字段。

测试：

- 访问范围外用户日志必须失败。
- 前端隐藏字段不是安全边界，后端必须过滤。
- 导出接口也必须 scoped。

## 9. 手机号/SMS 与短信宝原则

手机号/SMS 不是分销核心，但会影响注册归因、验证码安全和用户体验。如从旧 fork 移植，必须独立治理。

规则：

- 短信宝只能作为 SMS provider 之一接入，不能把 provider 参数散落在注册逻辑里。
- 短信宝模板需要备案，后台配置中必须区分草稿、待备案、已备案、停用状态。
- 短信签名必须支持自定义，不能写死固定签名。
- 注册、登录、绑定手机号、换绑、重置密码等场景必须支持不同模板。
- 模板变量必须白名单化，例如验证码、有效期、产品名、站点名。
- 短信验证码必须配合 Turnstile/图形验证、IP 限流、手机号限流、账号限流和场景限流。
- 发送日志只能记录脱敏手机号、场景、provider、模板版本、返回码和耗时。
- 不记录完整验证码，不输出完整手机号、ApiKey、MD5 password 或短信正文中的验证码。
- 手机号注册必须复用统一邀请归因链路和初始额度配置。

踩坑：

- 模板和签名未备案会导致生产通道不可用，不能只在本地 mock 成功就算完成。
- 固定签名或固定模板会让后续更换主体、产品名、渠道文案时必须发版，维护成本高。
- 缺少限流的短信接口容易被滥用为短信轰炸入口。

## 10. 发布与证据原则

规则：

- 本地证据不能冒充 staging/生产证据。
- runtime、自测、synthetic 数据不能作为正式 cutover gate。
- 正式验收需要真实 OAuth、微信、支付、relay、双跑周期。
- 外接控制台要只读归档一段时间。

踩坑：

- 重复本地 smoke 可能触发 Redis `rateLimit:*`。
- 本地开发可清理 dev Redis 限流键；staging/生产不应随意清理真实限流。
- 发布前必须确认容器已替换到目标镜像，避免旧容器造成验证假阳性。

## 11. 本地测试账号与模拟数据

规则：

- 本地测试账号密码只能写入 git 忽略的本地密钥文件，不写入文档、commit、脚本默认参数或测试报告。
- 当前本地密钥文件路径固定为 `.codex-local/affiliate-test-accounts.secret.json`。
- `.codex-local/` 已加入 `.git/info/exclude`，这是本仓库本地排除规则，不会上传远端。
- 自动化脚本如需登录真实角色账号，应从该本地密钥文件读取，不在命令行参数中明文传递密码。
- 可以在本地恢复的 PostgreSQL 隔离库中模拟用户充值、退款、消费日志和负向扣回记录，用于审查分销统计、佣金和 KPI。
- 模拟记录必须带有明显标识，例如 `synthetic_affiliate_test`、测试批次号、创建时间和操作者。
- 模拟数据只允许写入本地隔离库，不允许写入生产库或 staging 真实验收库。
- 模拟数据不能作为正式 cutover gate，只能用于开发调试和 UI/计算逻辑自测。
- 若模拟数据影响真实快照账号统计，测试结束后要有清理脚本或重新恢复快照的步骤。

## 12. 文档治理

规则：

- 本目录文档只放本地指导，不需要上传远端，除非用户要求。
- 如果后续要提交文档，先确认不含账号密码、生产 DSN、dump 路径敏感信息。
- 方案、tasklist、原则三类文档分开维护。
- tasklist 完成项必须及时打勾。
- 飞书方案有更新时，应先同步默认参数和业务说明，再判断是否需要改代码。

## 13. 新线程启动建议

新线程应从这个指令开始：

```text
请读取 docs/affiliate/native-affiliate-master-plan.zh-CN.md、docs/affiliate/native-affiliate-new-thread-tasklist.zh-CN.md、docs/affiliate/native-affiliate-development-principles.zh-CN.md，并基于 /home/rain/projects/new-api-rain021217 开始执行。

开发策略：基于当前官方最新干净基线，旧 projects/new-api-liu23zhi 只作为 reference-only；所有分销功能遵循最小侵入原则，优先新增 affiliate_* / sidecar 表，必须改官方主链路时只做薄 hook。

第一步先下载服务器最新 PostgreSQL dump 到本地 Docker PostgreSQL，不再本地重做迁移；允许 AI/脚本读取 .codex-local/sources.yml 作为本地密钥源，但不能输出、复制、提交或记录其中内容。然后从 .codex-local/affiliate-test-accounts.secret.json 读取 Rain、ChengyuWang0807、nr_mm2z5vr 三类账号做本地登录 smoke，复现 classic 分销页问题。飞书分销方案及子页作为业务默认口径，分佣比例、KPI 系数、人头费、质量门槛、邀请码额度、短信宝签名和模板都要做管理员端配置入口。不要把密码、生产 DSN、dump 或 runtime 大文件写入 git。
```
