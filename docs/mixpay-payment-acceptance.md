# MixPay 实施与验收记录

日期：2026-10-14。对应 [设计与开发规范](mixpay-payment-design.md)。代码已实现且默认禁用；本记录不代表生产收款验收通过。

## 已实现

- 钱包充值和一次性订阅购买、USD 报价、托管收银台、历史订单恢复入口。
- 配置版本和冻结快照、用户作用域幂等键、trace 唯一约束。
- 回调来源限制及标识绑定、持久化唤醒、服务端主动核验、跨实例预算和订单租约。
- paid 证据先保存、事务履约、防重复加款、钱包上限、订阅冻结权益和购买冲突转审核。
- 缓存水位恢复、独立日志投递、管理员排队核验；禁止通用补单、通用订阅完成/过期和 MixPay cancel 绕过核验。
- 设置界面绑定请求体的 root 二次验证，七语言文案，支付弹窗到期仍可查询。

## 已执行的数据库验证

仓库 `origin` 最新 release 为 `v1.0.0-hcai(rc41f3)`，其提交是 `12e19df4f07855a5049be68fa37dfe3303f62152`，恰为本次工作基线。MixPay 未改变基线已有 User、TopUp、SubscriptionOrder、SubscriptionPlan 等表字段；矩阵先使用这些发布版表结构和既有充值数据建库，再增加 MixPay 表，执行两次 AutoMigrate，并校验既有记录保持不变。验证范围为受影响支付表，不是全站生产数据副本升级。

| 引擎 | 实际版本 | 本次结果 |
| --- | --- | --- |
| SQLite | 3.50.4 | 新表创建、发布版代表性支付表增量迁移、重复迁移、支付行为通过 |
| MySQL | 8.0.46 | 同上；真实 Docker 实例，127.0.0.1:13316 |
| PostgreSQL | 15.19 | 同上；真实 Docker 实例，127.0.0.1:15436 |
| 独立 SQLite 日志库 | 3.50.4 | 主库成功但日志不可用时保留待恢复；切换独立库后补日志，不重复加款 |
| Redis 行为 | miniredis | 与支付宝/微信共用水位；消费预扣和重复缓存投递不重复加款 |

未覆盖 MySQL 5.7.8 / PostgreSQL 9.6 最低版本；此次无引入这些版本不具备的专有 SQL 功能，但结果仅证明上述实际版本。没有执行真实 Redis 故障切换、独立 ClickHouse 日志库或部署级多实例故障演练。

测试环境（仅本机临时容器，不用于生产）：

```sh
docker run -d --name newapi-mixpay-test-mysql -p 127.0.0.1:13316:3306 -e MYSQL_ROOT_PASSWORD=mixpay-local-test -e MYSQL_DATABASE=mixpay_test mysql:8.0
docker run -d --name newapi-mixpay-test-postgres -p 127.0.0.1:15436:5432 -e POSTGRES_PASSWORD=mixpay-local-test -e POSTGRES_DB=mixpay_test postgres:15-alpine
```

容器就绪后实际执行的矩阵/竞态命令：

```sh
TEST_MYSQL_DSN='root:mixpay-local-test@tcp(127.0.0.1:13316)/mixpay_test?charset=utf8mb4&parseTime=True&loc=Local' \
TEST_POSTGRES_DSN='host=127.0.0.1 port=15436 user=postgres password=mixpay-local-test dbname=mixpay_test sslmode=disable' \
go test -race ./service ./controller -run 'MixPay|AlipayPaymentDatabaseMatrix|DirectPaymentConfigProof' -count=1

go test -race ./model -run '^TestAlipayCacheRetryPreservesReservations$' -count=1
go test ./service ./controller ./model
go build ./...
```

以上最终结果通过。新增的 Go 测试集中在 `service/mixpay_test.go`；来源/归属、验证 proof 和跨支付缓存水位扩展已有测试文件。

覆盖的关键行为：

- 同一支付重复/并发履约只加一次；钱包容量失败保留 paid，恢复后只发放冻结额度。
- 服务端查单 pending 不入账；金额不匹配不入账。
- 身份绑定、trace 唯一约束、租约失效和回调 wake version。
- 终态不回退，冲突终态标记审核。
- 订阅使用下单时套餐快照，只发放一次；通用完成和过期路径拒绝 MixPay。
- 共享预算拒绝立即第二次请求；上游创建响应失败后第二次只查询原 trace，不再次 POST 创建。
- 回调伪造转发头、错误 trace、跨用户订单读取被拒绝；有效通知 ACK 前已持久化，但不改变付款事实。
- 独立日志故障不回滚已提交的余额；缓存交错、重放不覆盖预扣。

完整后端测试在前两次执行中遇到 `TestSecurityAccountDeletionConcurrentRequestsHaveOneWinner` 的 SQLite busy/并发断言失败；单独复查也曾失败。未修改该账户删除路径；最后一次完整运行通过。该波动仍需独立跟踪，不能把一次通过当成已修复。

## 前端验证

实际使用临时 Bun 可执行文件 `/tmp/newapi-mixpay-tools/node_modules/.bin/bun`，无新增项目依赖。

```sh
bun run --cwd web typecheck
# 对本次修改的 TS/TSX 执行项目 oxfmt（保留原版权头）与 oxlint，均通过。
bun run --cwd web test \
  src/features/wallet/components/dialogs/__tests__ \
  src/features/wallet/hooks/use-payment.test.ts \
  src/features/wallet/lib/payment.test.ts \
  src/features/wallet/components/__tests__/subscription-plans-card.test.tsx \
  src/features/wallet/components/__tests__/payment-method-selection.test.tsx \
  src/features/site-orders \
  src/features/subscriptions/components/dialogs/__tests__ \
  src/features/system-settings/integrations/__tests__
bun run --cwd web build
```

结果：12 个测试文件、91 个用例通过；类型检查、所改文件 lint、生产构建通过。MixPay 新测试验证超时仍等待并可查询、确认成功回调一次、外部安全链接、退出不取消、paid/审核/失败不继续支付、网络错误重试、仅启用 MixPay 的钱包入口，以及订阅按 USD 报价且不提前发放。

扩大到整个钱包测试集时，`preset-amount-display.test.tsx` 的 4 个既有用例失败。使用 `git archive HEAD` 导出的未修改发布版基线，复跑该文件得到同样的 4 个失败，记录为已有预设金额显示测试问题，未修改其断言来掩盖失败。新增钱包用例和修改组件的相关测试均通过。未执行真实浏览器视觉/E2E 支付验收。

## 安全依据及验证边界

已阅读/核对：

- [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [ASVS 5.0.0 V7](https://github.com/OWASP/ASVS/blob/v5.0.0_release/5.0/en/0x16-V7-Session-Management.md)：7.2.1 服务端验证、7.5.3 高敏感操作额外认证。

配置复用现有安全验证框架：root 权限、禁止访问令牌、请求内容绑定、会话绑定、proof 单次消费。`TestDirectPaymentConfigProofBindsExactRevision` 扩展覆盖 MixPay 的权限拒绝、访问令牌拒绝、内容变化和重放拒绝；完整 service/controller 测试覆盖已有会话和 proof 行为。回调来源与订单读取越权有针对性测试。路由复用现有 Origin 防护，不自建认证协议。

这些结果不构成整站 ASVS 合规声明。尚无生产代理配置、商户后台权限及实际回调链路的渗透测试或验证证据。

## 上线前必须完成

- [ ] 确认真实商户 payeeId、结算资产、账户能力、费率和最新通知 IP。
- [ ] 商户授权小额实付：创建 → 收银台 → 回调/查单 → 本站余额或订阅 → 结算核对。
- [ ] 确认过期、少付、链上确认、结算字段及失败返回的真实协议行为。
- [ ] 确认幂等创建与短码恢复契约；当前 uncertain 只查原 trace，可能没有可恢复收银台链接。
- [ ] 部署代理信任边界检查、真实缓存及独立 ClickHouse（如启用）验证、在途单回滚演练。
- [ ] 为长期 uncertain、paid 未履约、未结算、审核积压、持续限流配置外部告警和处理责任人；当前只有系统任务/订单记录。

结论：本地代码和上述自动化验证已交付；生产收款验收未完成，默认不启用，不宣称已上线或端到端实付成功。

## 2026-10-14 人工核验与待支付入口回归

- 管理订单详情接入查询支付结果及核验补单；人工请求同步调用服务端 `payments_result`，不再仅唤醒后台任务。复用订单租约、请求限流、字段核验和幂等履约；保留冲突及订阅核查限制。
- 中间状态缺少身份字段不再误判为字段不匹配；显式不匹配仍阻止履约，终态必须字段完整。已有身份核查标记仅在最新完整字段核验通过后解除，不清除其他核查原因。
- 普通待支付 MixPay 订单在钱包提示区可继续打开原支付链接。查询重试不显示人工核查警告；待支付、失败订单不再误显示确认收款金额。
- `TEST_MYSQL_DSN=… TEST_POSTGRES_DSN=… go test ./service -run TestMixPay -count=1 -v`：SQLite 3.50.4、MySQL 8.0.46、PostgreSQL 15.19 全部通过。覆盖全部中间状态、失败不入账、成功及重复核验仅入账一次、缺失字段、金额不匹配与核查标记恢复。使用独立测试数据库，不修改站点订单。
- `go test ./controller -run 'Test.*(MixPay|Alipay)' -count=1` 通过。前端 `bun run test src/features/site-orders/__tests__` 共 36 项通过；类型检查与修改文件 lint 通过。
- 本地示例订单已由官方返回 `failed` / `40000` / `Payment overtime.`，未为验证创建或支付真实订单，也未绕过失败状态重新开放付款。

### 未开始付款时的零金额占位响应

实际公开接口返回 `status=unpaid`、`quoteAmount="0"`、空 `traceId/payeeId/quoteAssetId`，此前将占位金额误识别为订单金额不一致。现只对该精确的未开始付款响应豁免金额比较；成功或失败终态仍要求完整核验。旧误标记只在订单仍 pending、尚无网关状态、未核验收款且已创建支付链接时自动解除；其他风险标记不受影响。

相同三数据库命令再次全部通过，回归覆盖实际零金额占位响应、旧标记恢复及成功状态零金额拒绝。已重启开发后端，使用管理页面对现存订单实际查单，确认落库 `gateway_status=unpaid`、`review_required=false`；钱包页面实查已显示“支付”按钮，未进行实际付款。

### MixPay 失败终态归类为已关闭

统一订单查询将 MixPay 本地 `failed` 且网关 `failed` 的订单映射为本站已关闭状态 `expired`，保留网关原始终态用于审计。不修改中间状态或仅本地创建失败的分类；已存在的历史失败终态订单也适用。列表显示、“已关闭”筛选、默认排除已关闭及待处理订单筛选使用相同映射。

验证：`TEST_MYSQL_DSN=… TEST_POSTGRES_DSN=… go test ./service -run TestMixPay -count=1 -v` 在 SQLite 3.50.4、MySQL 8.0.46、PostgreSQL 15.19 全部通过。新增断言确认失败终态出现在已关闭筛选中、从默认未关闭列表排除，并保留 `gateway_status=failed`。无需迁移历史数据。
