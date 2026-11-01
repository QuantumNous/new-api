# Implement：合作方服务端密钥接入

前置条件：用户已审阅 `prd.md` 与 `design.md`，并明确同意开始改代码；执行了 `task.py start`。

分支：`feat/partner-accounts`（基于 `main` 的 `88e0b8077`）。每个阶段结束都单独提交，只用明确路径 `git add`，不推送 `main`。

**环境注意：** 本机同时运行着生产 `new-api` 容器。所有测试容器都用任务专属的名称前缀 `pa-task-`、专属网络 `pa-task-net`，不映射宿主机端口，不连接生产的 PostgreSQL 和 Redis，也不对 Docker 做任何 prune。清理只删除带 `pa-task-` 前缀的资源，并且要先征得用户同意。

## 阶段 0：准备

- [ ] `git status` 干净，当前分支为 `feat/partner-accounts`。
- [ ] 重新阅读 `AGENTS.md`、`.agents/rules/billing.md`、`.trellis/spec/backend/partner-oauth.md`、`.trellis/spec/backend/referral-recharge-cashback.md`、`.trellis/spec/backend/database-guidelines.md`，以及 OWASP 的 OAuth2、Secrets Management、Authentication、Logging Cheat Sheet。
- [ ] 建立测试环境：
  - 网络 `pa-task-net`；
  - `pa-task-pg`：`postgres:9.6`，项目要求支持的最低版本；
  - `pa-task-redis`：`redis:7`；
  - Go 运行容器 `pa-task-go`：`golang:1.26`，源码只读挂载，`GOCACHE` 放在容器卷里。

  记录镜像标签、`SHOW server_version` 的结果和 `go version`。

## 阶段 1：数据模型与迁移（model）

- [ ] 新增 `model/partner_server.go`，包含 `partner_server_configs`、`partner_server_secrets`、`partner_server_tokens` 三个模型及增删查函数。
- [ ] 新增 `model/partner_account.go`，包含 `partner_accounts`、`partner_account_payment_orders` 两个模型，以及：
  - `EnsurePartnerAccountTx`（design §5.1）；
  - 子账号的 Key 签发与轮换（§5.3）；
  - 子账号状态变更、合作方批量停用与恢复（§5.4）；
  - 订单创建与查询（§5.5–5.6）。
- [ ] 把新模型加入 `model/main.go` 的迁移列表。
- [ ] 加锁一律使用 `lockForUpdate(tx)`；不写原生 SQL；布尔字段不写默认值 tag。
- [ ] 测试集中写在一个新文件 `model/partner_account_test.go` 里，用表驱动，覆盖：
  - 开户的幂等与并发（PostgreSQL 上 N 个 goroutine 并发开同一个 ID，结果只有 1 个账号）；
  - 只差大小写的两个 ID 开出两个账号；
  - 子账号上限与速率；
  - 零额开户事件存在，且没有注册赠额日志；
  - 轮换的两种模式，以及"任何时候最多两把有效 Key"；
  - 停用与恢复不误伤 `disabled` 和 `admin_disabled`；
  - 订单幂等与限流。
- **验证：** 在 `pa-task-go` 中运行 `go test ./model -run 'PartnerAccount|PartnerServer' -v`，连接 `pa-task-pg`（`TEST_POSTGRES_DSN`），确认测试实际运行、没有被跳过。
- **迁移验证：**
  1. 用当前线上版本 `88e0b8077` 的代码对一个空库迁移，作为代表性旧库；
  2. 切换到新代码，迁移两次；
  3. 确认已有表的数据、索引和唯一约束不变，新表的唯一索引存在。

  全新库再单独迁移两次。
- 提交：`feat(model): add partner server accounts, secrets and payment links`

## 阶段 2：认证（service、middleware、controller）

- [ ] 在 `PartnerOAuthToken` 中新增 `client_credentials` 分支，实现服务端密钥校验（耗时一致）、IP 白名单（支持 CIDR）、失败限流。
- [ ] 新增 `middleware.PartnerServerBearer` 中间件，实现按 client 限流。
- [ ] 新增管理员签发与吊销服务端密钥的接口，要求 Casbin `sensitive_write` 加二次验证；吊销时同一事务删除由该密钥签发的令牌。
- [ ] 加入过期服务端令牌的清理。
- [ ] 审计（security-review M1）：记录成功和失败的令牌签发；鉴权失败按“合作方 + 原因”节流后记录。
- [ ] 去掉 `/api/partner/v1` 和 `client_credentials` 响应的 CORS 头，预检返回 403（L1）。
- [ ] 隔离测试：`pcs_` 密钥不能用于 `client_credentials`，`pss_` 密钥不能用于授权码和刷新流程；`pst_` 和 `oa_` 两种令牌都不能访问对方的接口；白名单为空时不限制来源，配置后拒绝名单外的 IP。
- [ ] 缓存（design §10.0）：用 `HybridCache` 缓存合作方快照，按 §10.0 列出的写操作在提交后主动删除；服务端访问令牌也用 `HybridCache` 缓存，有效期取令牌剩余时间与 5 分钟中较小的值，只缓存查到的令牌。测试另外覆盖：令牌过期后，缓存命中也被拒绝；密钥吊销后，已缓存的令牌立即被拒绝。测试覆盖：吊销密钥、停用 client、关闭服务端模式、修改 IP 白名单后，下一个请求立即被拒绝（快照已被删除），而不是等 60 秒有效期过去；Redis 关闭时退回进程内缓存，行为相同。
- [ ] 测试写在 `controller/partner_server_test.go`，覆盖：
  - 密钥错误、已吊销、client 停用、服务端模式关闭、合作方停用、IP 不在白名单，都返回 `401 invalid_client`；
  - 两把密钥都可用，吊销后立即不可用，由它签发的令牌同时失效；
  - Query 里带令牌被拒绝；
  - scope 非法时被拒绝；
  - `authorization_code` 和 `refresh_token` 的现有测试全部仍然通过。
- 提交：`feat(partner): authenticate partner servers with client credentials`

## 阶段 3：账号与 Key 接口

- [ ] 新增 `router` 路由组 `/api/partner/v1`，以及 controller 中的账号查询、领 Key、轮换、停用、恢复接口。
- [ ] 校验 `external_user_id` 的格式。
- [ ] 子账号映射首期不缓存（design §10.0）；所有状态和 Key 变更都调用现有的用户缓存和 Key 缓存失效函数（§10.3）。测试覆盖：宽限期满后旧 Key 被拒绝（启用 Redis 时也一样）；停用子账号后，同一把 Key 的下一个模型请求立即被拒绝。
- [ ] 管理员在 `ManageUser` 中停用子账号时，同步把状态改为 `admin_disabled`；管理员更新用户时，拒绝给子账号设置密码或邮箱。
- [ ] 合作方状态接口联动批量停用与恢复，批处理放在后台执行、可以重入、可以查看进度（L3）；删除有子账号的合作方返回 409。
- [ ] 领 Key 和轮换按合作方限流（每分钟 120 次），超出时写审计（H1）。
- [ ] 管理员“吊销合作方全部 Key”（design §5.7），要求二次验证；轮换接口在当前 Key 已被禁用时也能签发新 Key。测试：吊销后所有旧 Key（包括宽限中的）被拒绝，余额不变，轮换后新 Key 可用。
- [ ] 测试（同一个测试文件），覆盖：
  - 自动开户只发生在领 Key 和下单时，GET 请求遇到未知 ID 返回 404 且没有写入；
  - 跨合作方访问返回 404；
  - 余额为 0 时用这把 Key 调模型被拒绝；
  - 停用后 Key 失效，恢复后可用；
  - design §5.2 表中的每一条登录路径都无法进入子账号。
- 提交：`feat(partner): provision sub-accounts and keys on first use`

## 阶段 4：充值（ZPay mapi.php）

- [ ] 实现 `mapi.php` 客户端：表单 POST、MD5 签名、10 秒超时；只接受 `code==1`；优先使用 `qrcode`，没有时使用 `payurl`。日志里不记录返回内容。`PayAddress` 不是 `https` 时拒绝调用并返回 503（L5）。
- [ ] 实现下单与查询接口（design §5.5–5.6），复用金额校验、合规判断和返现排除逻辑。
- [ ] 订单查询首期不缓存（design §10.0）。
- [ ] 测试用 `httptest` 模拟 ZPay，覆盖：
  - 返回二维码 / 只返回支付链接 / `code!=1` / 超时 / 返回非 JSON；
  - 幂等重放不会再次调用 ZPay；
  - 第一次调用 ZPay 失败后，用同一个 Key 重试能补上二维码；
  - 请求体不同返回 409；
  - 支付合规关闭时返回 503；
  - 模拟 notify 回调后：订单查询为 `success`、余额增加、没有产生返现、有 `ineligible_reason=partner_oauth`；
  - 查询其他合作方的订单返回 404。
- **评审关口 A（需要用户同意）：** 用生产 ZPay 商户号对 `mapi.php` 发一笔小额测试订单（Q16），确认 alipay 和 wxpay 各自返回哪些字段。不付款，ZPay 那边的订单保持未支付。根据结果调整字段处理逻辑。
  - 已完成（2026-10-28，用户同意）：alipay 返回 `qrcode`/`payurl` 为支付宝链接，同订单号重试返回同一订单；无需改代码。生产未开 wxpay，未验证。详见 PRD Resolved。
- 提交：`feat(partner): create sub-account top-ups with ZPay QR codes`

## 阶段 5：消耗明细与审计

- [ ] 实现 `GET /accounts/{eid}/usage`（design §6）：参数边界（单次不超过 31 天、最早到 90 天前）、单独限流（每分钟 60 次）、白名单字段、通过 `LOG_DB` 查询（M3）。
- [ ] 在审计 action 白名单中加入新动作，授权日志页的筛选项同步更新。
- [ ] 测试覆盖：时间范围超过 31 天、`page_size` 超出范围返回 400；返回字段与白名单完全一致（断言不包含 `ip`、`content`、`other`）；不能查到其他用户的记录；审计日志里没有敏感值。
- 提交：`feat(partner): expose sub-account usage and audit partner server events`

## 阶段 6：管理后台前端

- [ ] 开始前阅读 `web/AGENTS.md` 和 shadcn-ui 技能，搜索 `web/src/features/partner-oauth*` 中已有的组件和 secret 展示组件并优先复用。
- [ ] 合作方表单新增“服务端接入”区块，加上密钥管理、子账号列表，以及用户列表中的标记和筛选。
- [ ] 补齐七种语言：`bun run i18n:sync`。
- **验证：** `cd web && bun install && bun run test && bun run typecheck && bun run lint && bun run build`（具体脚本名以 `web/package.json` 为准）。
- 提交：`feat(web): manage partner server access and sub-accounts`

## 阶段 7：全量检查

- [ ] `make test`（在 `pa-task-go` 中运行，连接 `pa-task-pg` 和 `pa-task-redis`）；`make build-web`。
- [ ] `gofmt -l` 的输出为空；没有新增直接调用 `encoding/json` 编解码的代码。
- [ ] 运行 trellis-check 子代理和 `/code-review`；有认证相关改动时再跑 `/security-review`。
- [ ] 核对宿主机与运行容器中的源码 SHA-256 一致（database-guidelines §3）。
- **评审关口 B：** 写交付说明给用户审阅，内容包括：
  - 实际运行的命令和结果；
  - "只验证了 PostgreSQL 9.6，没有运行 SQLite 和 MySQL"；
  - OWASP ASVS 5.0 条目号、已验证项和缺口（至少包括 `ClientIP` 的可信代理问题、停用批处理的时间窗口）。

## 阶段 8：契约与文档

- [ ] 新建 `.trellis/spec/backend/partner-server-accounts.md`；在 `partner-oauth.md` 中补充 scope 隔离与交叉引用。
- [ ] 接入文档里要强调（security-review L2、L4、M2）：
  - 怀疑泄露时轮换必须选 `immediately`；
  - `external_user_id` 只能使用不透明 ID；
  - 强烈建议配置 IP 白名单；
  - 密钥和 Key 只能放在后端；
  - 建议每 90 天轮换一次服务端密钥。
- [ ] 新建对外接入文档 `docs/partner-server-api.md`（D24），风格与 `docs/partner-oauth-api.md` 一致：换令牌、自动开户、领取与轮换 Key、充值二维码、轮询到账、消耗明细、错误码、限流。并在 `docs/partner-oauth-api.md` 开头加一句指向它的说明。
- 提交：`docs(spec): record the partner server accounts contract`

## 上线（需要用户操作或同意）

1. 提 PR，合入 `main` 会自动部署。部署后所有合作方的服务端模式默认关闭。
2. 运营：创建专用分组、挂渠道、设置 `GroupRatio`，确认 `default` 可用。
3. 管理员为可得启用服务端模式，配置 IP 白名单，签发密钥并通过安全渠道交付。
4. 可得联调，并删除收集密码的表单。

## 回滚点

| 时机 | 做法 |
|---|---|
| 阶段 1–6 任意一步 | `git revert` 该阶段的提交；新表还没上线，不影响生产 |
| 上线后出现问题 | 后台关闭可得的服务端模式，新接口立即全部拒绝 |
| 需要停掉子账号的 Key | 停用合作方，触发批量停用 |
| 回滚代码 | 新表和数据保留；回滚前先停用合作方，避免留下无人管理的有效 Key |

## 中间产物

测试用的 Docker 资源（前缀 `pa-task-`）和 overlay 文件，任务结束后在用户同意时清理。trellis 日志不清理。
