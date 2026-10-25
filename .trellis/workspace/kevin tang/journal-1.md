# Journal - kevin tang (Part 1)

> AI development session journal
> Started: 2026-09-06

---



## Session 1: 完成 PR8 审查修复与分组提交

**Date**: 2026-09-06
**Task**: 完成 PR8 审查修复与分组提交
**Branch**: `codex/zxg-from-main`

### Summary

修复首页价格权限跳转、侧栏折叠占位、完整计价表达式校验与零价缓存；新增22个用例，全量558项测试、类型检查、scoped lint/format及生产构建通过；四个本地提交完成，未推送。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f78555751` | (see git log) |
| `4bcf71024` | (see git log) |
| `60a711369` | (see git log) |
| `71a2bb93b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: 客户端 OAuth 2.0 PKCE 接入

**Date**: 2026-09-08
**Task**: 客户端 OAuth 2.0 PKCE 接入
**Branch**: `codex/client_auth`

### Summary

实现固定桌面 Public Client 的授权码加 PKCE 流程，补齐授权页、会话管理、国际化、OpenAPI 与跨层回归验证。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `16f20d5d4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: 修复 PR12 落地页与控制台审查问题

**Date**: 2026-09-08
**Task**: 修复 PR12 落地页与控制台审查问题
**Branch**: `feat/yecai-console-landing`

### Summary

在 feat/yecai-console-landing 完成 17 项修复；前端 595 项通过、2 项原有跳过，类型/lint/构建和 Go race/构建通过；已验证本地移动导航和桌面价格表，未推送。任务资料按 .gitignore 保留本地。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f8442bf48` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: 新增客户端展示与智能下载页

**Date**: 2026-09-10
**Task**: 新增客户端展示与智能下载页
**Branch**: `feat/yecai-console-landing`

### Summary

新增公开 /client 客户端展示页、四张产品截图、Windows/macOS 自动下载与 partner 域名分流；抽取共享营销顶栏并补齐七语言与回归测试。定向测试、全量测试、typecheck、build:check 和浏览器响应式验收通过；仓库既有全量 lint/format/copyright 基线问题未改动。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0de844deb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: 轻松模式液态玻璃鼠标

**Date**: 2026-09-11
**Task**: 轻松模式液态玻璃鼠标
**Branch**: `feat/yecai-console-landing`

### Summary

在轻松模式共享外壳挂载单一 GlassCursor，避免已登录模型广场重复实例，并补充回归测试与静态体验页。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4c986fcdd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: 重构开发者文档中心

**Date**: 2026-09-11
**Task**: 重构开发者文档中心
**Branch**: `feat/yecai-console-landing`

### Summary

将开发者文档迁入认证开发者模式，完成七模块知识库、账号模型与分组动态配置、安全脱敏代码片段、多语言导航与回归验证，并补充 Trellis 安全规范。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `7be424a62` | (see git log) |
| `fbe138f6b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: 恢复轻松模式新手指南

**Date**: 2026-09-12
**Task**: 恢复轻松模式新手指南
**Branch**: `feat/yecai-console-landing`

### Summary

恢复轻松模式桌面、紧凑与共享导航中的新手指南入口，链接现有认证文档中心；补充回归测试、i18n 静态键和前端规范。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0f263082c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: 动态计费详情与顶部栏布局优化

**Date**: 2026-09-12
**Task**: 动态计费详情与顶部栏布局优化
**Branch**: `feat/yecai-console-landing`

### Summary

记录动态计费结算追踪，展示全部命中单价与可核对账单浮层，并修正顶部栏品牌收缩边界。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0a8257285` | (see git log) |
| `6f0af540b` | (see git log) |
| `52e81285f` | (see git log) |
| `abf654576` | (see git log) |
| `2d7d8f7a5` | (see git log) |
| `061982a8f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: 轻松模式密钥页分组层级与新手指南用例筛选

**Date**: 2026-09-14
**Task**: 轻松模式密钥页分组层级与新手指南用例筛选
**Branch**: `feat/yecai-console-landing`

### Summary

密钥页分组卡片改为分组名+倍率胶囊在上、说明在下，表格分组列同步；无有效倍率（auto/缺失）不显示胶囊。新手指南用例卡片改为可点击并按 toolIds 收敛工具墙、支持清除筛选；CC Switch 步骤去除 OpenCode 硬编码并补齐 7 语言文案。全量 831 测试通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cc39c265c` | (see git log) |
| `bf2f2bef3` | (see git log) |
| `d2c9edfdf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: 首页与客户端下载体验升级
<!-- trellis-session: v=2 fp=d70b642cd8392b86 -->

**Date**: 2026-09-15
**Task**: 首页与客户端下载体验升级
**Branch**: `feat/yecai-console-landing`

### Summary

修复客户端路由循环与下载渠道，按国内外模型币种纠正实时节省计算，更新社群和首页客户端入口，并使用安全裁剪截图重设计客户端展示页。

### Git Commits

| Hash | Message |
|------|---------|
| `02e8a489f` | fix(web): let SPA routes share asset directory names |
| `078337d1d` | fix(client): use stable installer download channels |
| `4fac7cc41` | fix(pricing): compare overseas references in CNY |
| `b259c4e0a` | feat(home): add client and community actions |
| `f25e6350e` | docs(spec): record live savings and community contracts |
| `ed6eb45bc` | feat(client): redesign the desktop showcase |
| `9691f2583` | docs(spec): record client showcase asset contract |

### Status

[OK] **Completed**


## Session 11: 修复定价与用量审查问题
<!-- trellis-session: v=2 fp=f75e0d157023742b -->

**Date**: 2026-09-15
**Task**: 修复定价与用量审查问题
**Branch**: `feat/yecai-console-landing`

### Summary

修复固定 CNY 展示、pricing 异常载荷、服务端请求结果分页、本地午夜窗口刷新和主题按钮 i18n，并补齐跨页、ClickHouse 并列与兼容性回归。

### Git Commits

| Hash | Message |
|------|---------|
| `c78724707` | fix(console): resolve pricing and usage review issues |

### Status

[OK] **Completed**


## Session 12: 邀请充值返现与风控审核
<!-- trellis-session: v=2 fp=127cf9023fee1e1b -->

**Date**: 2026-09-16
**Task**: 邀请充值返现与风控审核
**Branch**: `feat/recharge-cashback`

### Summary

实现邀请人与被邀请人双向充值返现、T+N 人工审核结算、跨支付渠道事务幂等、关联账号风控、退款追回与欠额处置，并补齐 Root 配置、Admin 审核、七语翻译、运维文档和可执行规范。

### Git Commits

| Hash | Message |
|------|---------|
| `becd0b833` | feat(cashback): add transactional referral cashback |
| `aa3b52897` | feat(console): add cashback review and settings |
| `1d9663551` | docs(spec): record referral cashback contracts |

### Status

[OK] **Completed**


## Session 13: 返现对抗审查与修复
<!-- trellis-session: v=2 fp=3f9411f96ea990a5 -->

**Date**: 2026-09-17
**Task**: 返现对抗审查与修复
**Branch**: `feat/recharge-cashback`

### Summary

完成三路 fresh-context 对抗审查，修复四项 P1 与两项 P2；保留事务内 CashbackQuotaMutation 资金凭证，补齐对账门禁、quota fence 错误契约、可退出 action dialog、七语计数和 DSN 门控生产数据库集成测试。

### Git Commits

| Hash | Message |
|------|---------|
| `61e09540c` | fix(cashback): harden transactional quota accounting |
| `84648697d` | fix(console): improve cashback actions and counts |
| `a6f7db904` | docs(cashback): update ledger and operations contracts |

### Status

[OK] **Completed**


## Session 14: 订阅套餐兑换码实现与三数据库验证
<!-- trellis-session: v=2 fp=fa720c66a4f69aab -->

**Date**: 2026-09-24
**Task**: 订阅套餐兑换码实现与三数据库验证
**Branch**: `feat/recharge-cashback`

### Summary

复用现有兑换和后台管理流程新增套餐兑换码；额度码兼容。SQLite 3.50.4、MySQL 8.0.46、PostgreSQL 16.15 完成新建、rc.40 代表性升级及事务验证。前后端聚焦测试通过；全量 controller 旧失败在 HEAD 基线复现。任务完成并清理测试临时产物。

### Git Commits

| Hash | Message |
|------|---------|
| `2956c0b18` | feat(redemption): support subscription plan codes |

### Status

[OK] **Completed**


## Session 15: 核查充值返现人工审核与免审开关
<!-- trellis-session: v=2 fp=c2b8849f5870d959 -->

**Date**: 2026-09-24
**Task**: 核查充值返现人工审核与免审开关
**Branch**: `feat/recharge-cashback`

### Summary

只读确认奖励创建为待审核，只有审核通过且到期才结算；当前无免审开关。业务代码未更改。

### Git Commits

| Hash | Message |
|------|---------|
| `7a4016df9` | chore(task): archive cashback review switch audit |

### Testing

- [OK] 只读检查配置、奖励创建、审核与结算代码及运维文档；未执行测试。

### Status

[OK] **Completed**


## Session 16: 独立充值返现与只读退款参考阶段交付
<!-- trellis-session: v=2 fp=5770772a36a58b7d -->

**Date**: 2026-09-27
**Task**: 独立充值返现与只读退款参考阶段交付
**Branch**: `feat/recharge-cashback`

### Summary

完成无邀请人充值返现、逐场活动、分级审核与即时发放，新增低频有序入账及管理员只读 FIFO/CNY 参考报表；记录验证与上线门禁，任务保持进行中。

### Main Changes

- 按实际入账顺序记录购买、赠送、不可退批次与异常，不在普通消费时写账；CNY 易支付订单需管理员逐单确认。
- 修复 Redis 大整数缓存差1和签到/邀请额度转入边界；补充返现合同与数据库隔离规范。

### Git Commits

| Hash | Message |
|------|---------|
| `8669e76a6` | feat(cashback): add payer campaigns and read-only refund references |
| `3ba69cad7` | docs(cashback): record quota evidence and validation limits |

### Testing

- [OK] go vet ./...、go build ./...、model 测试及 race 聚焦通过；SQLite 3.50.4/MySQL 8.0.46/PostgreSQL 16.15 隔离新建和代表旧库重复升级通过。
- [OK] 前端 typecheck、构建、定向 lint 与 59 项聚焦测试通过；全量 controller/middleware 失败在 HEAD 同环境复现。

### Status

[OK] **Completed**

### Next Steps

- 保持 CASHBACK_REFUND_REFERENCE_ENABLED 默认关闭；部署前确认所有钱包写入实例已升级、历史余额及线下退款人工核对；如需完整签收，提供 MySQL 5.7.8/PG 9.6 与独立 ClickHouse 隔离测试环境。


## Session 17: 充值返现参考报表验收与归档
<!-- trellis-session: v=2 fp=cf1deccc279397f2 -->

**Date**: 2026-09-27
**Task**: 充值返现参考报表验收与归档
**Branch**: `feat/recharge-cashback`

### Summary

修正退款报表净消费显示，验证独立 ClickHouse 日志库，并完成返现任务的质量核查与归档；未部署或开启数字报价。

### Main Changes

- 补独立主库/日志库回归及 FIFO 净消费不变量，更新操作合同，归档已完成任务。

### Git Commits

| Hash | Message |
|------|---------|
| `efabd53fd` | fix(cashback): preserve net spend in refund reference |
| `6cf6d9f25` | docs(cashback): record ClickHouse verification and acceptance |

### Testing

- [OK] 真实 ClickHouse 26.9.2.8 日志库 InitLogDB 两次、区间 3/30/20、主库 FIFO 25/50 与 CNY 7250 分、日志失败降级均通过；Go model/build/vet 与三主库矩阵已通过。

### Status

[OK] **Completed**

### Next Steps

- 部署前保持 CASHBACK_REFUND_REFERENCE_ENABLED=false；核对所有写入节点、历史余额/线下退款与管理员结清假设。若目标为 ClickHouse 24.8 或最低 MySQL/PG 版本，在实际版本上补测。获得用户同意后再清理本任务非业务 /tmp 产物，Trellis 日志保留。


## Session 18: 整百返现实现与数据库环境清理
<!-- trellis-session: v=2 fp=4e0bff71dc8884f7 -->

**Date**: 2026-09-30
**Task**: 整百返现实现与数据库环境清理
**Branch**: `feat/recharge-cashback`

### Summary

完成双向整百返现与三库升级验证；已清理任务测试库和临时文件，停止本机数据库服务、卸载此前已存在的 PostgreSQL，并记录后续数据库验证必须使用 Docker。SQLite 属于本机现有依赖，未卸载。

### Git Commits

| Hash | Message |
|------|---------|
| `90b64b7b5` | feat(cashback): add per-hundred face-value rewards |
| `4c394ce6b` | feat(console): configure and display per-hundred cashback |
| `0339e4359` | docs(spec): record per-hundred cashback contract |
| `d928bdffa` | docs(db): require Docker-isolated local verification |

### Status

[OK] **Completed**


## Session 19: 充值返现预览与 Docker 三库验收
<!-- trellis-session: v=2 fp=4a4b8232e6580d95 -->

**Date**: 2026-09-30
**Task**: 充值返现预览与 Docker 三库验收
**Branch**: `feat/recharge-cashback`

### Summary

完成充值人手审即发、零额待审修正与充值页返现预览；修复 PostgreSQL 并发对账误报；Docker 三库定向验收通过，清理了本次测试资源，并规定今后数据库测试必须隔离在 Docker 内。

### Main Changes

- 预览按当前用户、充值面额与活动/上限只读估算，支付成功仍独立结算；零额取消奖励不再误显待审。
- Docker Desktop 代理启动卡住时通过 raw socket 验证；记录源文件哈希与 Go overlay 防止旧挂载误测。

### Git Commits

| Hash | Message |
|------|---------|
| `62eeb0b2a` | chore(task): plan payer cashback review and preview changes |
| `d7c02fef0` | feat(cashback): issue manually approved payer rewards without hold |
| `24909ea3b` | fix(cashback): hide canceled zero rewards from pending review |
| `b016827c0` | feat(cashback): preview payer rewards with safe reconciliation |
| `fae3085fa` | docs(db): require Docker-isolated database tests |

### Testing

- [OK] 容器内 Go 1.25.1、SQLite 3.50.4、MySQL 8.0.46、PostgreSQL 16.15：返现三库集成测试及并发回归通过，MySQL/PostgreSQL 重复运行通过。
- [OK] 规范变更通过 git diff --check；未覆盖最低支持数据库版本或真实最新发布版数据库快照升级。

### Status

[OK] **Completed**

### Next Steps

- 按需补最低版本和真实发布版升级验证；其余两个返现子任务与父任务仍待独立归档和集成审查。


## Session 20: 订阅套餐按适用分组扣费
<!-- trellis-session: v=2 fp=8927dc0ba7f985c3 -->

**Date**: 2026-10-01
**Task**: 订阅套餐按适用分组扣费
**Branch**: `feat/recharge-cashback`

### Summary

实现套餐独立适用分组与按真实分组隔离预扣、动态生效、重试/幂等保护和前端展示；Docker 三库双版本矩阵及聚焦测试通过；全量测试存在基线失败；仅清理获授权的任务容器、网络与翻译临时脚本改动。

### Git Commits

| Hash | Message |
|------|---------|
| `97ade2774` | feat(subscription): restrict plan quota to its applicable group |
| `d7b95ada5` | docs(trellis): record subscription group billing contract |

### Status

[OK] **Completed**


## Session 21: 首页返现活动限时展示与狂蹬卡活动页
<!-- trellis-session: v=2 fp=e3fc077435281b39 -->

**Date**: 2026-10-02
**Task**: 首页返现活动限时展示与狂蹬卡活动页
**Branch**: `feat/recharge-cashback`

### Summary

首页在北京时间10月8日零点自动恢复，活动页展示两款狂蹬卡；七语言与回归测试，已归档。相关测试26项通过、类型检查和构建通过；全仓lint既有错误，浏览器实测受工具缺失阻断。

### Git Commits

| Hash | Message |
|------|---------|
| `8f1aabf77` | feat(home): show cashback campaign until Oct 8 and feature Power Cards |
| `efdbe7ffa` | docs(trellis): record campaign landing contract and implementation plan |

### Status

[OK] **Completed**


## Session 22: 返现自动审核逐项风险配置
<!-- trellis-session: v=2 fp=319fbcce2a353bf2 -->

**Date**: 2026-10-02
**Task**: 返现自动审核逐项风险配置
**Branch**: `feat/recharge-cashback`

### Summary

实现23项风险标记可配置转人工及Root/Admin界面；任务隔离Docker验证SQLite 3.50.4、MySQL 5.7.44/8.0.46、PostgreSQL 9.6.24/16.15通过；make test仅middleware两项过期JWT测试失败，已记录为独立问题；用户同意后清理任务容器、网络和卷。

### Git Commits

| Hash | Message |
|------|---------|
| `3910c2bc4` | feat(cashback): route selected risk flags to manual review |
| `24354d223` | docs(trellis): record cashback risk review task and verification |

### Status

[OK] **Completed**


## Session 23: First-top-up campaigns and site-wide reward banner
<!-- trellis-session: v=2 fp=7195443f0d58fddb -->

**Date**: 2026-10-25
**Task**: First-top-up campaigns and site-wide reward banner
**Branch**: `feat/partner-oauth`

### Summary

Forge hero badge attention/morph effects and wording; first_top_up payer scope for cashback campaigns (PostgreSQL-only verification by owner decision); site-wide live reward banner.

### Git Commits

| Hash | Message |
|------|---------|
| `34c4edad1` | feat(home): draw attention to the Forge badge and morph it into the spotlight on click |
| `90b670970` | feat(cashback): add first-top-up-only campaigns |
| `7d4e1a241` | feat(web): add the first-top-up campaign toggle and a site-wide reward banner |

### Status

[OK] **Completed**
