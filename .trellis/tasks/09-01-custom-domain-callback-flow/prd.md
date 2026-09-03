# 专属推广域名与回调链路规划

## Goal

在单套 New API 部署中支持客户专属 `*.yeschoy.io` 推广入口：用户在专属域名浏览、注册、登录、充值及完成 GitHub/Linux Do OAuth、钱包支付和密码重置后，继续使用原专属域名；新用户未提交显式 `aff` 时使用域名客户作为默认邀请人，提交非空显式 `aff` 时完全沿用 New API 现有解析语义。

## Background

- 主站为 `yeschoy.com`；OAuth 固定回调继续使用现有主站，不新增认证域名。
- 推广域根为 `yeschoy.io`；apex `yeschoy.io` 不承载应用，只返回 `404`。
- 客户 A/B 分别使用 `a.yeschoy.io`、`b.yeschoy.io`，但不是独立租户；所有入口共享用户、余额、订单、API Key、渠道、系统配置和权限。
- 客户是 New API 现有用户；每位客户最多一个启用中的专属域名。
- 专属展示仅包含地址栏域名与默认邀请归属，页面名称、Logo、标题、主题和功能与主站一致。
- 第一版充值范围为易支付与 Stripe 钱包充值，不包含订阅套餐购买。
- 当前实现基线是本仓库 commit `d68bc3adb5e6766ebd1bd3bf610d8e8b2452a8db`；规划已按本地 OAuth、Session、密码重置、钱包充值、路由和迁移代码核对，详见 `research/local-baseline.md`。
- 生产正在运行的 image digest/commit、数据库类型、节点与 Redis 拓扑、反向代理、DNS/TLS、OAuth App 和支付平台配置仍未知；外部发布前必须只读核对，不能由本地仓库状态推断。

## Requirements

### Architecture and change boundary

- R0：尽可能减少 New API 源码修改。DNS、TLS 与 apex 拒绝由基础设施承担；邀请归属、OAuth、Session Origin、密码重置和支付订单回跳等贴近业务状态的逻辑通过最小 New API 补丁实现。
- R0.1：采用“最小修改 New API”方案，不引入应用感知域名网关或新的 Redis 依赖；复用现有数据库、AuthFlow、登录 Session 和钱包充值订单。
- R0.2：补丁必须边界集中、可测试、可通过功能开关回滚并可随上游升级重放，不扩展成严格多租户重构。
- R7：所有域名复用单套 New API 与统一数据，不为客户复制部署。

### Domain routing and lifecycle

- R1：`https://yeschoy.io/*` 始终返回 `404`，不得跳转主站或客户域名。
- R2：只有已分配且 `enabled=true` 的一级 `*.yeschoy.io` 域名可完整访问 New API；未知、非法、嵌套或管理员显式停用的域名返回 `404`。
- R2.1：管理员可为有效 New API 用户人工分配、查询、启用和停用专属域名。
- R2.2：label 必须小写规范化并校验 DNS 格式、永久唯一与保留名称；至少保留 `www`、`api`、`auth`、`admin`、`pay`、`callback` 及部署所需名称。
- R2.3：第一版不提供客户自助申请、修改、释放或管理前端。
- R2.4：一位客户最多拥有一个启用域名；一个 label 永久绑定首次分配的 `owner_user_id`。
- R2.5：管理员显式停用域名后，普通页面/API 返回 `404`；此前已发起的 OAuth、密码重置或支付流程允许通过最小 fallback 端点回退 `yeschoy.com`。
- R2.6：服务器端 CLI 至少支持 assign、enable、disable、show、list，并校验用户、格式、保留名、唯一性与墓碑所有权。
- R2.7：域名表只保存 `owner_user_id`，不复制长期 `aff_code`；所有权以该用户 ID 为准。
- R2.8：数据库唯一约束是最终防线；裸 SQL 仅作为经审核的紧急运维手段，不能作为日常管理入口。
- R2.9：停用记录保留为墓碑，只能为原 owner 重新启用，不能改绑其他客户。
- R2.10：owner 账号后来被禁用/删除不改变 domain `enabled`。页面、已有用户登录、充值和 API 使用保持正常，仅暂停该 owner 作为域名默认邀请人；owner 恢复后默认归属自动恢复。
- R11：有效专属域名完整镜像主站现有路径，包括页面、认证、充值、管理路径和 `/v1`；访问权限继续由 New API 既有授权控制。
- R11.1：反向代理不维护业务路由白名单，只负责域名级路由、TLS、apex/default host 拒绝及可信代理头。

### Invitation attribution

- R3：推广归属与当前浏览域名解耦；用户创建后的 `inviter_id` 永不因后来访问或登录其他域名而改变，也不按历史归属强制跳回原域名。
- R3.1：在有效 A 域名完成新用户创建且未提交显式 `aff` 时，默认归属 A；OAuth 经过主站回调不得丢失该来源。
- R3.2：邀请归属不引入租户隔离；账户和账务仍全站共享。
- R3.3：已有账号在任意域名登录不得创建、替换或覆盖邀请关系。
- R3.4：已归属 A 的用户主动在 B 登录后继续留在 B，历史归属仍为 A。
- R3.5：提交非空显式 `aff` 时，密码注册与 OAuth 新用户创建都调用上游 `GetUserIdByAffCode`；仅在没有显式 `aff` 时才考虑域名默认 owner。
- R3.6：继续复用上游 `inviter_id`、邀请计数与奖励体系，不创建合作伙伴账户体系。
- R3.7：归属只以账号创建请求/流程为准，不追踪从 `.io` 离开后在 `.com` 注册的跨域首次触达。
- R3.8：域名默认归属在用户真正创建时检查 owner 当前状态；owner disabled/deleted 或 domain 已停用时使用 `inviter_id=0`。
- R3.9：owner 账号禁用只暂停域名默认归属，不影响页面与已有用户。
- R3.10：显式 `aff` 完全保留上游异常与资格语义：不存在的 code 静默得到 `inviter_id=0` 且不回退域名 owner；现有 resolver 不按用户 `status` 过滤，本任务不改变。
- R9：非空显式 `aff` 在主站和所有专属域名上都优先走上游；域名 owner 只是缺省邀请来源。

### Authentication, sessions, and password reset

- R4：从专属域名发起 GitHub/Linux Do OAuth 登录或绑定，成功、失败和取消后恢复发起域名；目标域名已显式停用时回退主站。
- R4.1：OAuth 继续使用 `yeschoy.com` 现有固定 callback，不新增 `auth.yeschoy.io`。
- R4.2：回跳目标来自服务端 OAuth state，不能由任意 `return_url` 或 callback Host 决定。
- R4.3：专属域名 OAuth 登录结果通过短时、一次性、目标 Host 与发起浏览器绑定的 handoff 交接；ticket 不进入查询参数、Access/Refresh Token 不跨域传递，也不使用 `.yeschoy.io` 父域共享 Cookie。
- R4.3.1：发起浏览器绑定使用 `__Host-yeschoy_oauth_binding`，生产属性固定为 Host-only、`Path=/`、`HttpOnly`、`Secure`、`SameSite=Strict`、`Max-Age=900` 且不得设置 `Domain`；OAuth state/handoff 只保存随机值的 purpose-separated HMAC。有效期内复用稳定 binding，以支持同一 Host 的并行 OAuth flow。
- R4.4：主站、A 与 B 只共享账号数据，不共享登录状态；每个域名使用独立 Host-only Refresh Cookie并需分别登录。
- R4.5：OAuth bind 继续绑定原用户、原 Session 与 provider，不能跨用户、跨 Session、换域或重放。
- R4.6：从有效专属域名发起的密码重置邮件链接返回该专属域名；目标由服务端签名/校验，不接受客户端完整 URL。
- R4.7：点击重置链接时目标域名已显式停用，安全回退 `yeschoy.com`；既有 token 验证与 Session 撤销语义不变。
- R4.8：首版不支持专属域名 Passkey 登录或管理，也不修改主站 Passkey 实现。
- R4.9：密码登录 TOTP 2FA 与备用码完全保持上游五分钟 TTL、用户/鉴权版本匹配、备用码单次使用和 AuthFlow 原子消费语义。
- R4.10：GitHub/Linux Do OAuth 不新增强制 TOTP；本任务只处理邀请来源、原域恢复和独立 Session 交接。
- R4.11：首版不为密码 2FA AuthFlow 增加域名绑定。所有子域由平台控制、不得承载客户自定义脚本，未知/停用域名被入口层拒绝。

### Wallet top-up returns

- R5：易支付和 Stripe 钱包充值的服务端通知可靠验签、幂等入账；浏览器返回原发起域名，目标已显式停用/未知时回退主站。
- R5.1：易支付 notify 使用固定主站地址；browser return 验签并从订单持久化的 `origin_host` 选择专属域名或主站。
- R5.2：Stripe Webhook 使用固定主站地址并作为入账权威；Checkout success/cancel 由服务端根据订单来源生成，不能信任专属域名客户端提交的任意 URL。
- R5.3：两种渠道都不得依赖浏览器成功页作为唯一到账信号；重复、并发 callback 不得重复增加余额。
- R5.4：目标域名失效只改变浏览器落地页，不改变订单验签、渠道匹配和入账。
- R5.5：首版不修改订阅计划、订阅订单或订阅支付控制器。

### Security and presentation

- R6：所有跨域目标只能来自域名表、OAuth state、订单或服务端签名上下文；必须防止开放重定向、Host poisoning、OAuth state 篡改、handoff 重放和订单串域。
- R8：除 GitHub/Linux Do 与支付服务商页面以及主站 callback 的短暂跳转外，站内导航和流程最终落地保持发起专属域名；显式停用 fallback 除外。
- R10：首版不增加客户级名称、Logo、标题、主题或功能开关。

## Acceptance Criteria

- AC1（R0/R7）：功能开关关闭时主站行为与上游一致；实现不依赖外置应用网关或新增 Redis。
- AC2（R1/R2/R11）：apex、未知、非法、嵌套和显式停用域名得到 `404`；已启用 A/B 完整镜像主站且现有权限检查仍生效。
- AC3（R2.1-R2.10）：CLI 拒绝不存在 owner、重复/非法/保留 label、同 owner 第二个启用域名及墓碑改绑；owner 被禁用时页面仍正常但默认归属暂停。
- AC4（R3/R9）：A 无显式 `aff` 注册归属 A；A 上显式有效 B code 归属 B；显式无效 code 按上游成功创建且 `inviter_id=0`、不回退 A；owner disabled 且无显式 `aff` 时为 `0`。
- AC5（R3.3/R3.4）：已有用户跨域登录不改变 `inviter_id`，也不被强制跳回历史邀请域名。
- AC6（R4.4）：A 登录不会让 B/主站自动登录；退出 A 不错误清除其他 Host 的独立 Cookie/Session。
- AC7（R4-R4.3.1）：从 A 发起 GitHub/Linux Do 登录，callback 短暂到主站后通过一次性 ticket 回 A；过期、重放、换域、伪造目标、binding 缺失/篡改及把 ticket 复制到另一浏览器均失败，并行 flow 不互相覆盖，A 显式停用时回主站。
- AC8（R4.5）：GitHub/Linux Do bind 只能由原 A/user/session 完成；错误、取消及目标停用安全结束，不在缺少原 Session 时静默绑定。
- AC9（R4.9-R4.11）：密码 + TOTP/备用码在 A 正常完成并建立 A Session；上游错误/过期/重放防护保持；OAuth 不新增 TOTP，2FA 不新增域名业务逻辑。
- AC10（R4.6/R4.7）：A 发起密码重置时邮件安全返回 A；签名篡改/过期失败，A 显式停用时回主站。
- AC11（R5.1/R5.3/R5.4）：A 易支付订单在没有浏览器参与时仍由 notify 入账；browser return 验签后落 A，重复/并发不重复入账，A 停用时落主站。
- AC12（R5.2-R5.4）：A Stripe success/cancel 落 A，Webhook 独立幂等入账；伪造 return 不改变余额或跳外站，A 停用时落主站。
- AC13（R6）：伪造 Host/Forwarded 头、任意 return URL、OAuth state/ticket、支付 trade number 都不能形成开放重定向、跨客户串域或错误入账。
- AC14（R8/R10）：A 与主站视觉/功能一致，正常站内导航不 canonical 到主站；无白标定制。
- AC15（compatibility）：历史 `top_ups` 无 `origin_host` 按主站处理；旧 OAuth state 缺失 origin 按主站处理；主站显式 aff、Session、TOTP、支付和钱包记录保持兼容。

## Out of Scope

- 直接修改生产 DNS、证书、OAuth App 或支付平台配置；实施这些外部变更需另行授权。
- 严格租户隔离、每客户独立部署、用户/余额/订单分库。
- 客户自助域名、域名改绑、客户自有顶级域名、白标 UI。
- `.io → .com` 跨域首次触达追踪和按历史归属强制跳域。
- 专属域名 Passkey/WebAuthn，包括 Related Origin Requests、中央 Passkey 与多 RP ID 凭据。
- 易支付/Stripe 订阅套餐购买、订阅订单与订阅支付回跳。
- GitHub/Linux Do 之外 OAuth provider 的专属域名保证，以及易支付/Stripe 之外支付渠道。
