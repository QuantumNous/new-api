# 多主域名、专属推广域名与回调链路实施计划

## 当前执行增量：修复单主域假设

原专属推广域实现已经在当前分支落地；本轮只实现 `.com`/`.pro` 平级主域支持及其跨域回程，不重做已完成的域名表、CLI、邀请归属和前端 bridge。以下清单优先于后文原始实施阶段。

### A. 配置与 Host 分类（TDD）

- 在 `common/custom_domain_test.go` 先增加失败测试：解析/规范化 `CUSTOM_DOMAIN_MAIN_ORIGINS=https://yeschoy.com,https://yeschoy.pro`，拒绝非 HTTPS、路径、推广 suffix 内 Host、callback origin 缺失；空复数配置兼容为单数 `CUSTOM_DOMAIN_MAIN_ORIGIN`。
- 使用 table test 覆盖 1、2、3 个主域、大小写/默认端口归一化、重复 Host、超出数量上限与乱序输入；新增第三个合成主域后不得新增任何 Host 专用分支。
- 验证启动时两个主 Origin 都必须存在于 `SESSION_COOKIE_TRUSTED_URL`；缺任一项 fail closed。
- 在 `service/custom_domain_test.go` 与 `middleware/custom_domain_test.go` 先证明 `.com`、`.pro` 都是 `Main`，推广 apex/未知/嵌套仍为 `404`，伪造 forwarded host 不改变结果。
- 增加同一 resolver 的并行矩阵：`.com`、`.pro`、A、B 同时可用；主域 `DomainID=0` 且无默认 inviter，A/B 保留各自 Domain ID、owner 归属与停用语义。
- 扩展 `CustomDomainSettings` 与全局配置，resolver 使用主 Host 集合并保留单一 callback Host；Compose 与 `.env.example` 显式透传新变量。
- 增加 callback-host 精确判断；OAuth callback、reset dispatcher、ePay return/notify 与 Stripe return/webhook 不能仅凭 `KindMain` 放行 `.pro`。

### B. 统一受信来源解析（TDD）

- 新增共享解析契约，输入 `domain_id + origin_host`：`domain_id=0` 只接受配置中的主 Host；正数 ID 继续按推广域记录、suffix 与 enabled 状态复核。
- 所有返回目标只由 DomainContext、签名 AuthFlow 或订单字段产生，不接受客户端完整 URL。
- 保持 `.com` 技术 fallback、推广域动态停用 fallback 与历史空字段兼容；主域移出静态 allowlist 后直接不可访问，不引入动态墓碑。

### C. OAuth 登录与绑定（TDD）

- 在 `controller/custom_domain_oauth_test.go` 增加 `.pro` state 用例：`domain_id=0`、`origin_host=yeschoy.pro`、browser-binding 已设置；`.com` 仍走原地 AuthBundle。
- 增加 `.pro -> .com callback -> .pro handoff` 登录测试，覆盖正确 Host-only Cookie、重放、错 Host、错 binding、过期与 auth version 变化。
- 覆盖 middleware cache 仍为 active、数据库已 disable 的竞态，确保消费端使用实时状态签发 `.com` fallback，而不是因 `Kind` 不一致返回 403。
- 增加 `.pro` OAuth bind 测试，要求原 `.pro` user/session/opener 完成最终绑定；`.com` callback 不得静默写绑定。
- 覆盖 provider disabled、token exchange、user info、注册策略、封禁用户、重复绑定与 handoff 签发失败；state 校验成功后必须用 typed action 返回可信原域，并保持各失败阶段既有的 state 消费时点。
- 泛化 handoff payload/消费校验，使 Main target 使用 allowlist、Custom target 使用 Domain ID；保持现有 action 名与前端 fragment bridge 契约，避免不必要的前端协议变更。
- OAuth、reset 与 payment 测试各增加一个第三主域样例，证明所有非 callback 主域复用同一 trusted-origin 路径，而不是只为 `.pro` 打补丁。
- 回归 A/B 推广域登录、绑定、停用 fallback 与默认邀请归属，确保 `.pro` 不获得 owner/inviter 语义。

### D. 密码重置与钱包回跳（TDD）

- 为 `.pro` 增加签名 reset return context 测试：邮件先到 `.com` dispatcher，验证后回 `.pro`；篡改 Host/签名/过期失败。
- 将 `ServerAddress` 与 callback Origin 设为不同值，证明功能开启时 `.com` 自身重置链接仍固定 `.com`，功能关闭才沿用 legacy 地址。
- 泛化 reset payload 的 `domain_id` 为可选；主 Host 通过 allowlist 复核，推广域继续查表并检查 enabled。
- 为 ePay 与 Stripe 增加 `.pro` 订单 `origin_host` 持久化及 browser return 测试；notify/webhook 仍固定 `.com` 且维持验签、幂等入账。
- `topUpOriginHostFromContext` 保存非 callback 主 Host 与推广 Host；订单返回解析同时支持配置主 Host 和有效推广 Host，历史空值回 `.com`。

### E. 范围、验证与回滚

- 不修改 Passkey 数据模型、RP ID、凭据注册/登录或设置；不把推广子域开放给 Passkey。
- 不修改订阅支付、用户/余额隔离、客户白标或生产 DNS/OAuth/支付配置。
- 先运行受影响包测试与 race：`go test ./common ./service ./middleware ./controller`、`go test -race ./common ./service ./middleware ./controller`。
- 再运行项目门禁：`make test`、`go vet ./...`、`go build ./...`、`cd relaykit && GOWORK=off go build ./...`；若前端协议未改，至少运行现有 OAuth bridge 单测、typecheck 与 build。
- 渲染 `docker compose config`，确认 `CUSTOM_DOMAIN_MAIN_ORIGINS`、单数 callback origin 与 Session trusted origins 均进入容器；复数为空时 healthcheck 回退单数，显式 2/3 主域时逐个探测 Host。
- 回滚只需移除复数配置并回退本轮代码；原单主域与推广域数据模型不变，无新增数据库迁移。

## 0. 执行前置门

当前仓库已包含完整 New API fork，且原单推广域实现已提交。本轮实施基线以开始编码前的实际 `HEAD`/`git status` 为准；原始 commit `d68bc3adb5e6766ebd1bd3bf610d8e8b2452a8db` 仅保留为历史研究基线。

进入 Phase 2 前必须完成：

- 重新记录 `git rev-parse HEAD` 与 `git status --short`，确认用户现有未提交文件并只改本任务范围；若 HEAD 已变化，先重跑 `research/local-baseline.md` 的差异核对。
- 在未改代码的本地基线上运行并记录 Go 与前端测试；已有失败单独记录。

进入 staging/生产配置与端到端验收前必须完成：

- 获取实际生产 image digest/commit，并与本地实现基线比较；生产外部配置不属于本代码任务的默认写权限。
- 确认是否使用默认主题或自定义前端、数据库类型（SQLite/MySQL/PostgreSQL）、单节点/多节点、Redis 拓扑。
- 只读备份现有 OAuth provider callback、`ServerAddress`、支付配置、Passkey 开关、Session Cookie 与可信代理配置。
- 确认 GitHub/Linux Do 生产实际 callback 是当前前端 `/oauth/{provider}` 路径，而不仅是域名；Linux Do token exchange 必须继续看到主站 callback Host。
- 确认易支付通知/返回参数和 Stripe API/webhook 版本。
- 将本地代码与生产版本逐项对照；文件或契约不一致时先修订 `design.md`，再发布。

验收：已获得可构建源码；基线命令通过或已有失败被单独记录；没有读取/打印生产 Secret。

## 1. 域名模型、配置与 CLI（先测试）

### 1.1 测试

- Host/label 规范化表驱动测试：大小写、端口、尾点、嵌套子域、非法字符、超长标签、保留名。
- SQLite/MySQL/PostgreSQL 兼容测试：label 永久唯一、`active_owner_id` 唯一、多墓碑 NULL、并发分配冲突。
- 生命周期测试：assign、disable、enable、不可改 owner、同 owner 第二个启用域名失败。
- 所有者状态测试：owner 禁用不改变 domain `enabled`，页面状态仍可用。
- 缓存测试：正/负缓存、TTL、生效窗口、功能开关关闭。
- CLI 退出码与错误文案测试；日志不得包含 DSN/Secret。

### 1.2 实现

- 新增 `CustomDomain` 模型、迁移注册与跨数据库索引。
- 新增配置：功能开关、suffix、main origin、TTL、保留名。
- 新增 Domain service：规范化、查询、缓存、assign/enable/disable/list/show。
- 新增受控 `new-api domain` 子命令；复用领域服务，只初始化 env/logger/主数据库，不启动 HTTP server、后台任务或 Redis；不开发管理 UI/API。
- 启用/停用更新 `enabled/active_owner_id/disabled_at`，owner 永久不可变。

### 1.3 验证与回滚点

- 运行模型与 CLI 定向测试，随后 `go test -race`。
- 在三种数据库 CI/容器上验证迁移与唯一约束。
- 回滚：功能开关保持关闭；保留新增表，不做破坏性 down migration。

建议原子提交：`✨ feat(domain): 增加专属域名模型与管理 CLI`

## 2. Host guard、请求上下文与 Session Origin（先测试）

### 2.1 测试

- `yeschoy.com` 通过；`yeschoy.io`、未知、显式停用、嵌套域名拒绝。
- owner 被禁用但 domain enabled 时，页面与普通 API 通过。
- 伪造 `X-Forwarded-Host` 不改变 DomainContext。
- direct-backend/恶意 Host、Host 带用户信息/多值/控制字符拒绝。
- A Cookie 不发送给 B/主站；refresh/logout 只接受请求 Host 对应的精确 HTTPS Origin。
- `SESSION_COOKIE_TRUSTED_URL` 既有固定 Origin 行为不回归。

### 2.2 实现

- 在认证与业务路由前加入 DomainContext middleware。
- app 层防御性处理 apex/unknown/disabled `404`；反向代理仍承担第一层拒绝。
- 扩展 `SessionCookieOriginGuard`：DomainContext 已确认 active custom Host 时接受精确 `https://host`，覆盖反向代理 HTTP 上游的 `Request.TLS=nil` 场景，但继续拒绝客户端 `X-Forwarded-Proto` 伪造。
- 保留 Host-only Refresh Cookie；禁止设置父域 Cookie。
- 为 handoff fallback 路径预留已知停用域名的最小例外，其他路径仍拒绝。

### 2.3 验证与回滚点

- 中间件、Session 与安全用例全部通过。
- 运行现有 authentication/session 回归。
- 回滚：关闭功能开关，主站走原路径。

建议原子提交：`✨ feat(auth): 注入专属域名上下文与精确 Origin 校验`

## 3. 邀请归属（密码 + OAuth state，先测试）

### 3.1 决策矩阵测试

| Host | 显式 aff | owner 状态 | 期望 inviter |
|---|---|---|---|
| 主站 | 空 | 任意 | `0`（上游） |
| 主站 | 有效 B | 任意 | B（上游） |
| 主站 | 无效 | 任意 | `0`（上游静默） |
| A | 空 | enabled | A |
| A | 空 | disabled/deleted | `0` |
| A | 有效 B | 任意 | B |
| A | 无效 | 任意 | `0`，不回退 A |

同时覆盖：

- 密码注册与 OAuth 新用户结果一致。
- OAuth state 创建后 A owner 被禁用/域名被停用，最终创建时不再默认归属 A。
- OAuth 已有用户登录不修改历史 inviter。
- 显式 aff 保留上游不按账号 status 过滤的行为。
- 邀请奖励/计数只触发一次，`inviter_id=0` 不触发。

### 3.2 实现

- 提取单一 `ResolveRegistrationInviter`/等价领域服务。
- 密码注册在创建用户前使用该服务。
- OAuth payload 记录 explicit/domain/none 来源、origin host、domain/owner 上下文。
- OAuth 新用户创建前对 domain 默认来源重新检查当前 domain 与 owner 状态。
- 不修改主站显式 aff 的错误处理。

### 3.3 验证与回滚点

- 定向邀请、注册和 OAuth 用户创建测试通过。
- 检查既有邀请奖励与合规开关回归。
- 回滚：功能开关关闭时不注入域名默认值。

建议原子提交：`✨ feat(affiliate): 增加专属域名默认邀请归属`

## 4. OAuth 主站回调与域名交接（先测试）

### 4.1 后端契约测试

- A/B/main OAuth state 正确保存 origin；任意 `return_url` 被忽略。
- GitHub/Linux Do 成功、失败、取消均恢复正确 origin。
- custom-origin 登录成功不在主站创建最终 Cookie，只返回明确的 handoff action 并签发 120 秒 ticket。
- handoff 目标 Host、预期 auth version 与发起浏览器 binding 精确匹配；一次消费、过期、重放、换域及复制到另一浏览器失败。
- ticket 只存在 URL fragment 与同源 POST body，不进入 query/path、Referer、Nginx access log 或分析事件。
- Session 创建失败时 ticket 已消费且不产生有效 Session，保持与上游 OAuth fail-closed 顺序一致。
- A 在 state 后停用：callback/handoff 回退主站；竞态窗口也覆盖。
- A owner 被禁用但 domain enabled：页面与 OAuth 登录正常；只影响新用户默认邀请归属。
- 主站 OAuth 仍返回现有 AuthBundle，OAuth 不增加 TOTP。
- Session 数量/签发限额错误原样返回，不能绕过。

### 4.2 绑定契约测试

- A 登录 Session 发起的 GitHub/Linux Do bind 只能由同一 A/user/session 完成；主站 callback 无 A Session 时只生成 provider assertion ticket，不能写绑定。
- popup/opener handoff 不通过 URL 传 Bearer/Refresh Token。
- 目标域名停用时绑定不在无 Session 的主站静默完成，返回安全失败页。
- provider 账号已绑定、legacy ID 迁移与取消行为不回归。

### 4.3 实现

- 扩展 OAuth payload；新增 login、bind 与停用 fallback 的独立 Domain Handoff Purpose。
- OAuth state 创建时设置短时 `__Host-yeschoy_oauth_binding` Cookie（`Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`，无 `Domain`），payload 只保存 purpose-separated HMAC。
- 对 custom-origin 登录，在主站 callback 后签发绑定 target/user/auth-version/browser 的 ticket。
- 新增不加载主 SPA/分析脚本的最小 handoff bridge 页面和同源 POST 消费端点；页面立即清除 fragment，端点消费 ticket 后调用现有 `CreateLoginSessionAtAuthVersion`、写 Cookie并只返回成功/fallback 状态。
- 修改实际 `web/src/routes/oauth/$provider.tsx` callback route，使其识别 handoff action、把 ticket 放 fragment 并导航；bridge 成功后 replace 到 A 首页，由现有根路由 `bootstrapAuthentication` 自动 refresh 并恢复 AuthBundle。
- 已知停用域名只允许最小 handoff 页面/API；验证原 ticket 与 binding 后换发主站 fallback ticket，不能在 A 建 Session。
- 适配 bind popup/postMessage：主站把 popup 导航回 A bridge，bridge 清除 fragment 后把非凭据 ticket 同源交给 A opener，opener 携带自身 Bearer/Session 完成消费；严格保留原用户/Session 绑定。
- 对页面/API 设置 no-store/no-referrer；日志、错误和分析事件不得记录 ticket/binding。

### 4.4 验证与回滚点

- 使用 mock provider 完成后端/前端集成测试。
- 在 staging OAuth App 上真实验证 GitHub 与 Linux Do callback/token exchange。
- 回滚：保留主站 callback；功能开关关闭时只允许主站原流程。在途 handoff handler 至少保留到 TTL 过期。

建议原子提交：`✨ feat(oauth): 将主站授权结果安全交接回专属域名`

## 5. 密码重置来源恢复（先测试）

### 5.1 测试

- A 发起重置邮件，固定主站分发链接携带有效签名上下文，最终进入 A。
- B/main 不串域；篡改 Host/签名/过期时间失败且不开放重定向。
- A 显式停用后点击旧邮件，落到主站。
- 邮箱/token 有效期、密码重置、Session 撤销和枚举防护保持上游。

### 5.2 实现

- 重置邮件生成时从 DomainContext 构造 purpose-separated HMAC return context，绑定 Host、email/token 摘要与不超过 10 分钟的 expiry。
- 新增主站固定 reset dispatcher；只跳转主站或当前有效专属域名。
- 不接受客户端完整 callback URL；历史无 context 链接回主站，有 context 但签名无效/过期则直接失败。

### 5.3 验证与回滚点

- 邮件模板快照/链接测试与重置 E2E 通过。
- 回滚：缺少 context 的历史链接落主站；签名无效/过期的 context 直接失败。

建议原子提交：`✨ feat(auth): 保留专属域名密码重置来源`

## 6. 钱包充值回跳（先测试）

### 6.1 数据与公共 helper

- `TopUp.OriginHost` 迁移、历史空值主站兼容测试。
- 公共 `paymentReturnOrigin(topUp)` 只返回主站或当前有效专属域名。
- owner 禁用不影响回跳；domain 显式停用才回退主站。

### 6.2 易支付

- A 创建订单持久化 A；notify URL 保持主站。
- browser return 验签、provider/order 匹配、成功/待定/失败跳转正确。
- notify 和 return 并发/重复最多入账一次。
- 无浏览器访问仍由 notify 入账。
- 伪造 trade_no/签名不得改变余额或跳到任意外站。

实现：新增/复用 ePay browser-return handler，统一调用现有幂等结算函数；按订单选择 A/main。

### 6.3 Stripe

- A Checkout 的 success/cancel URL 由服务端生成并指向主站 return handler。
- return handler 只导航，不入账；伪造 result/trade_no 不改变余额。
- Stripe 签名 Webhook 独立完成一次入账；重放保持幂等。
- A 显式停用后 success/cancel 回主站。

实现：创建订单时保存 origin，专属域名请求忽略客户端任意 success/cancel；新增 DB-backed return handler。

### 6.4 范围与回滚

- 只修改钱包 `top_ups`；订阅支付文件不动。
- 运行既有易支付、Stripe、手工补单与额度上限测试。
- 回滚：Webhook/notify 始终主站可用；历史新增字段可保留；browser return 回主站。

建议原子提交：`✨ feat(topup): 将钱包支付结果返回发起域名`

## 7. 前端最小适配

- 保持 API `baseURL=''` 与 `withCredentials=true` 的同源行为。
- OAuth callback route 支持后端 handoff 响应并导航到最小 bridge；bridge 从 fragment 取票、立即清除、同源 POST 并 replace。
- 验证现有根路由 `bootstrapAuthentication` 会用 A 的 Host-only Cookie 调用 refresh 并恢复登录；这是选定的正常恢复路径。
- 不增加客户 Logo、标题、主题或管理页面。
- 不新增 Passkey 行为；发布配置不把专属域名 Passkey 作为可用能力。
- 检查所有导航、资产 URL 与 canonical redirect，不得把自定义 Host 重写为主站。

验证：前端单测、类型检查、lint（若仓库有脚本）、生产构建、桌面/移动 smoke test。

建议与 OAuth 同一提交，避免后端/前端契约错位。

## 8. Nginx/DNS/TLS 与试点发布

- 创建 apex `yeschoy.io` 404 server block。
- 创建 `*.yeschoy.io` wildcard DNS 与包含 apex+wildcard 的证书。
- wildcard 代理保留 Host，设置安全头并只信任精确上游。
- 默认未知 SNI/Host 拒绝；New API 后端端口不暴露公网。
- `nginx -t`、证书链、SNI、HTTP→HTTPS、404 与代理头验证。
- CLI 分配内部 A/B 试点，观察最多缓存 TTL 的启停传播。
- 灰度开启 `CUSTOM_DOMAIN_ENABLED`，保留快速关闭开关。

## 9. 全量验证矩阵

### 9.1 仓库已确认命令

```bash
make test
go test -race ./controller ./middleware ./model ./service/...
go vet ./...
(cd relaykit && go vet ./... && go build ./...)
(cd web && bun run typecheck)
(cd web && bun run test)
(cd web && bun run lint)
(cd web && bun run format:check)
(cd web && bun run build)
go build ./...
```

CI 当前强制 root/relaykit vet、build、`make test`、前端 typecheck 与 test；本任务另外运行受影响范围 race、lint、format check 和生产 build。若命令因既有失败或环境缺失无法运行，单独记录，不能伪装通过。

部署配置：

```bash
nginx -t
docker compose config
```

### 9.2 E2E 场景

- A/B/main：密码注册（空/有效/无效 aff）、密码登录、TOTP、退出、冷启动 refresh。
- GitHub/Linux Do：新用户/已有用户、成功/取消/错误、bind、目标停用、ticket 重放。
- 易支付：notify-only、return-first、重复/并发、错误签名、目标停用。
- Stripe test mode：success/cancel、webhook-first/return-first、重复 webhook、目标停用。
- 密码重置：A/main、签名篡改、过期、目标停用。
- Host/XFH/开放重定向/未知子域/嵌套域/裸域安全用例。
- 桌面与移动首屏、登录、充值页面没有 canonical 主站跳转。

### 9.3 质量门

- 所有新增行为有失败先行测试（TDD）。
- 完成 spec compliance、lint/typecheck/test、跨层数据流、重复逻辑与安全复核。
- 检查 diff 无 Secret、私钥、生产 DSN、OAuth/支付凭据。
- 提交前代码审查；不绕过 pre-commit。

## 10. 观测与运维

增加不含敏感值的结构化事件：

- domain assigned/enabled/disabled/cache-refresh/unknown-host
- attribution source: explicit/domain/none（不记录完整 aff）
- oauth handoff issued/consumed/expired/replayed/fallback
- password reset return fallback
- payment return target/fallback；Webhook 验签和幂等仍用现有日志

建议指标：

- 未知/停用 Host 请求量
- domain default attribution 成功/暂停计数
- OAuth handoff 成功率、过期率、重放拒绝数
- 易支付/Stripe browser return 与 webhook 完成率
- custom-domain refresh/logout OriginGuard 拒绝数

## 11. 最终交付与提交顺序

建议保持 6 个可回滚提交：

1. 域名模型 + CLI
2. Host context + OriginGuard
3. 邀请归属
4. OAuth handoff（含最小前端）
5. 密码重置来源
6. 钱包支付回跳

每个提交均满足项目格式：`<emoji> <type>(<scope>): 中文动词摘要`，并只暂存相关文件。生产 DNS/OAuth/支付配置变更与代码提交分开执行，均需用户明确授权。
