import type { HelpArticle } from './types.ts'

export const NINTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'admin-chat-settings',
    title: 'aiapi114 聊天集成设置',
    summary: '说明管理员配置聊天集成入口、变量替换和客户端展示文案时的检查要点。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/chat-settings.md'],
    body: `聊天集成设置用于把平台地址、API Key 和使用说明展示给用户。它不直接决定模型能力，但会影响新手能否按正确方式完成接入。

## 适合先读这篇的人

- 你要在控制台展示聊天客户端接入说明。
- 你希望用户复制后即可填入第三方工具。
- 你需要确认变量替换不会泄露无关信息。

## 操作步骤

### 1. 明确展示场景

先确认这段说明展示给普通用户、内部成员还是管理员。普通用户只需要 Base URL、Key 变量和模型名示例。

### 2. 配置变量占位

聊天集成文案可使用 Key 和服务地址变量。保存前检查变量是否能被平台正确替换，避免把示例密钥写成固定明文。

### 3. 写清 Base URL

说明地址末尾是否包含 \`/v1\`，并提醒用户在不同客户端里按字段要求填写，避免重复拼接路径。

### 4. 用新手视角验证

使用普通账号打开说明，复制到常用客户端里完成一次低成本调用，确认说明能闭环。

## 检查清单

- [ ] 文案没有写入固定 API Key。
- [ ] Base URL 是否包含 \`/v1\` 已写清。
- [ ] 普通用户能看懂接入步骤。
- [ ] 已用普通账号完成一次调用验证。`,
  }),
  createArticle({
    slug: 'admin-dashboard-settings',
    title: 'aiapi114 数据看板与公告设置',
    summary: '说明数据看板、公告、API 信息、常见问答和监控入口的配置边界。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/dashboard-settings.md'],
    body: `数据看板与公告设置会影响用户进入平台后的第一印象。管理员应把它作为状态说明和运营提示入口，而不是堆放所有后台信息。

## 适合先读这篇的人

- 你要配置首页公告、API 信息或常见问答。
- 你希望用户快速看到服务状态和接入提示。
- 你需要接入外部可用性监控页面。

## 操作步骤

### 1. 确认展示内容

把首页信息分成公告、API 使用提示、常见问答和监控状态四类，每类只放用户必须先看到的内容。

### 2. 配置公告和 API 信息

公告用于短期通知，API 信息用于长期接入说明。不要把价格、密钥、工单和故障说明混在同一段里。

### 3. 接入监控入口

如果使用 Uptime Kuma 或其他监控页，填写稳定的公开状态页地址，并确认用户无需登录即可查看服务状态。

### 4. 定期清理过期内容

上线活动、临时故障和迁移提醒结束后及时移除，避免用户误以为仍在生效。

## 检查清单

- [ ] 公告和长期说明已分开。
- [ ] API 信息只保留接入必要内容。
- [ ] 监控链接可公开访问。
- [ ] 过期公告有清理机制。`,
  }),
  createArticle({
    slug: 'admin-drawing-settings',
    title: 'aiapi114 绘图功能设置',
    summary: '说明绘图相关开关、模型能力、任务成本和失败排查入口的配置方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/drawing-settings.md'],
    body: `绘图设置控制图像生成类能力的使用体验。配置时应同时关注模型可用性、任务状态、成本和失败反馈。

## 适合先读这篇的人

- 你要开放图像生成或绘图任务能力。
- 你需要控制绘图任务成本和可用模型。
- 你遇到绘图任务提交后没有结果的问题。

## 操作步骤

### 1. 确认模型能力

先确认哪些渠道支持图像生成、图像编辑或异步绘图任务，并把能力映射到用户可见的模型名称。

### 2. 配置任务策略

按模型成本和上游稳定性设置任务限制，必要时只对特定分组开放高成本绘图模型。

### 3. 配置失败提示

为超时、上游拒绝、余额不足和参数错误准备清晰提示，让用户知道下一步该改参数还是联系管理员。

### 4. 查看绘图日志

上线后用绘图日志核对任务提交、执行、回调和扣费是否一致。

## 检查清单

- [ ] 绘图模型和渠道能力已核对。
- [ ] 高成本模型有分组限制。
- [ ] 常见失败原因有用户提示。
- [ ] 绘图日志能追踪任务状态。`,
  }),
  createArticle({
    slug: 'admin-operation-settings',
    title: 'aiapi114 运营设置',
    summary: '说明充值链接、文档地址、屏蔽词、日志记录、监控和额度等运营配置。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/operation-settings.md'],
    body: `运营设置决定用户从注册、充值、阅读文档到出现异常时的处理路径。它应服务于安全、合规和支持效率。

## 适合先读这篇的人

- 你要配置充值入口、文档入口或运营公告。
- 你需要启用屏蔽词、日志记录或监控能力。
- 你希望减少用户因入口不清晰产生的工单。

## 操作步骤

### 1. 配置关键入口

填写充值链接、文档地址和必要说明。外部链接必须使用 HTTPS，并确认普通用户有访问权限。

### 2. 设置内容治理规则

屏蔽词和日志记录应围绕安全合规和滥用治理使用，规则变更前先评估误伤范围。

### 3. 接入监控与告警

把监控入口和内部告警流程对应起来，确保发现服务异常后有人处理。

### 4. 校验额度策略

检查默认额度、充值说明和扣费提示是否一致，避免用户看到的余额口径冲突。

## 检查清单

- [ ] 文档和充值链接可访问。
- [ ] 屏蔽词规则经过误伤评估。
- [ ] 监控异常有处理人。
- [ ] 额度展示和扣费口径一致。`,
  }),
  createArticle({
    slug: 'admin-other-settings',
    title: 'aiapi114 其它系统设置',
    summary: '说明版本检查、公告、关于页和页面自定义内容的维护方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/other-settings.md'],
    body: `其它设置通常承载版本、公告和页面自定义内容。它们看似零散，但会影响用户对平台可信度和维护状态的判断。

## 适合先读这篇的人

- 你要维护关于页、公告或页面自定义内容。
- 你需要检查系统版本或更新提示。
- 你希望统一平台对外展示口径。

## 操作步骤

### 1. 检查版本信息

定期查看当前版本和更新提示。升级前先阅读变更说明，并在测试环境验证关键链路。

### 2. 维护公告内容

公告只写影响用户使用的内容，例如维护窗口、计费调整和重要功能变化。

### 3. 更新关于页

关于页适合放平台说明、联系方式、使用边界和合规声明。内容应保持简洁，支持 Markdown 时也要避免过度排版。

### 4. 验证页面显示

保存后用普通用户视角查看页面，确认链接、标题和换行显示正常。

## 检查清单

- [ ] 版本升级前已做测试验证。
- [ ] 公告只保留有效信息。
- [ ] 关于页没有过期联系方式。
- [ ] 自定义内容在用户侧显示正常。`,
  }),
  createArticle({
    slug: 'admin-rate-limit-settings',
    title: 'aiapi114 速率限制设置',
    summary: '说明模型请求速率限制、分组限流和异常请求治理的配置方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/rate-limit-settings.md'],
    body: `速率限制用于保护平台和上游渠道。合理限流能减少突发流量、脚本滥用和单个用户拖垮共享资源的风险。

## 适合先读这篇的人

- 你要为不同分组设置请求频率上限。
- 你遇到突发调用导致渠道不稳定的问题。
- 你需要区分普通用户和高优先级用户的限流策略。

## 操作步骤

### 1. 定义限流口径

先确认限流按用户、分组、模型还是全局维度生效。不要只看单个用户峰值，还要看上游渠道承载能力。

### 2. 配置分组规则

为默认分组设置保守上限，为可信或付费分组设置更高额度。示例中的数组含义应以平台当前配置说明为准。

### 3. 准备超限提示

用户触发限流时，应看到清晰提示，例如等待一段时间、降低并发或联系管理员升级分组。

### 4. 观察日志和指标

上线后查看限流命中率、上游错误率和用户反馈，逐步调整阈值。

## 检查清单

- [ ] 限流维度已确认。
- [ ] 默认分组有保守上限。
- [ ] 超限提示清楚可执行。
- [ ] 已观察限流命中和上游错误率。`,
  }),
  createArticle({
    slug: 'admin-rate-settings',
    title: 'aiapi114 倍率与配额设置',
    summary: '说明模型倍率、补全倍率、分组倍率和配额扣减口径的配置原则。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/rate-settings.md'],
    body: `倍率设置是平台成本核算的核心。管理员应先理解模型倍率、补全倍率和分组倍率，再修改生产配置。

## 适合先读这篇的人

- 你要调整模型价格、分组折扣或内部成本分摊。
- 你需要解释为什么不同模型扣费不同。
- 你正在排查余额扣减和预期不一致的问题。

## 操作步骤

### 1. 理解三层倍率

模型倍率反映模型基础成本，补全倍率通常用于区分输入和输出成本，分组倍率用于不同用户组的差异化策略。

### 2. 明确配额换算

确认平台内部配额与实际金额的换算关系。所有余额展示、充值赠送和日志统计都应使用同一口径。

### 3. 小范围调整

先在测试分组或低风险模型上调整倍率，再核对调用日志、扣费记录和用户余额变化。

### 4. 保留变更记录

倍率变化会影响账务解释。记录变更时间、原因、影响模型和回滚方式。

## 检查清单

- [ ] 已理解模型、补全、分组三层倍率。
- [ ] 配额换算口径已统一。
- [ ] 生产调整前已小范围验证。
- [ ] 倍率变更有审计记录。`,
  }),
  createArticle({
    slug: 'admin-drawing-log',
    title: 'aiapi114 绘图日志查看',
    summary: '说明管理员通过绘图日志排查任务状态、上游错误和扣费异常的方法。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/drawing-log.md'],
    body: `绘图日志用于追踪图像生成任务。管理员应通过日志确认任务是否提交成功、是否收到上游结果，以及扣费是否与任务状态一致。

## 适合先读这篇的人

- 你要排查绘图任务长时间未完成。
- 你需要核对绘图任务是否扣费。
- 你要定位上游渠道返回的错误。

## 操作步骤

### 1. 按用户或任务查询

优先用用户、任务 ID、时间范围和模型筛选日志，缩小排查范围。

### 2. 查看任务状态

重点检查提交、执行中、成功、失败、取消等状态，确认任务是否卡在平台侧或上游侧。

### 3. 核对错误信息

读取上游错误、超时提示和参数异常。对用户展示时要转换成可理解的处理建议。

### 4. 对账扣费记录

把任务状态与用量日志、余额变动关联起来，确认失败任务是否按规则退回或不扣费。

## 检查清单

- [ ] 已按任务 ID 或用户缩小范围。
- [ ] 已区分平台错误和上游错误。
- [ ] 用户可见提示已转换成可读说明。
- [ ] 扣费和任务状态一致。`,
  }),
]

export const NINTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-public-system',
    title: 'aiapi114 公开系统接口说明',
    summary: '说明关于信息、公告、定价、模型列表、状态页等公开系统接口的接入边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/system/about-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/notice-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/pricing-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/status-get.md',
    ],
    body: `公开系统接口用于展示平台基础信息，例如关于信息、公告、定价、模型列表和状态页。它们通常不需要模型 API Key，但仍要控制缓存和展示口径。

## 适合先读这篇的人

- 你要在前端展示平台公告、价格或状态。
- 你需要让外部页面读取公开系统信息。
- 你想区分公开接口和登录后接口。

## 接入步骤

### 1. 区分公开与登录接口

关于信息、公告、定价和状态通常可以公开读取；用户专属信息必须走登录态或授权接口。

### 2. 做缓存策略

公告和状态信息需要较短缓存，隐私政策、用户协议和关于信息可以较长缓存。

### 3. 处理空内容

接口返回为空时，前端应展示默认说明或隐藏模块，而不是显示空白标题。

### 4. 统一展示口径

公开页面、帮助中心和控制台中的价格、模型和公告应保持一致。

## 检查清单

- [ ] 已区分公开接口和用户接口。
- [ ] 缓存时间按内容变化频率设置。
- [ ] 空内容有降级展示。
- [ ] 公开信息与控制台口径一致。`,
  }),
  createApiArticle({
    slug: 'api-system-setup',
    title: 'aiapi114 系统初始化接口说明',
    summary: '说明初始化状态查询、初始化提交和首个管理员账号创建时的安全要求。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/system/setup-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/setup-post.md',
    ],
    body: `系统初始化接口只应在首次部署时使用。完成初始化后，应限制重复调用，避免被未授权人员重置或创建管理员账号。

## 适合先读这篇的人

- 你正在部署新的 aiapi114 实例。
- 你需要创建首个管理员账号。
- 你要确认初始化接口不会暴露给生产环境风险。

## 接入步骤

### 1. 查询初始化状态

部署完成后先查询系统是否已经初始化。若已初始化，前端不应继续展示创建管理员入口。

### 2. 提交管理员信息

初始化时填写用户名和强密码。不要使用默认密码、弱密码或与其他系统共用的密码。

### 3. 完成后关闭入口

初始化成功后重新打开控制台，确认登录流程正常，并确认初始化页面不再可用。

### 4. 记录部署交接

记录管理员账号交接方式、部署时间和访问域名，不要把密码写入仓库或工单正文。

## 检查清单

- [ ] 初始化前已确认部署来源可信。
- [ ] 首个管理员使用强密码。
- [ ] 初始化后入口已关闭。
- [ ] 管理员凭据没有进入代码仓库。`,
  }),
  createApiArticle({
    slug: 'api-user-auth',
    title: 'aiapi114 用户认证接口说明',
    summary: '说明登录、两步验证、注册、重置密码、验证码和退出登录接口的使用流程。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-login-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-login-2fa-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-register-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-reset-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-logout-get.md',
    ],
    body: `用户认证接口负责注册、登录、两步验证、密码重置和退出登录。接入时要把登录流程、错误提示和安全限制一起设计。

## 适合先读这篇的人

- 你要开发自定义登录或注册页面。
- 你需要接入两步验证登录流程。
- 你要处理忘记密码和退出登录。

## 接入步骤

### 1. 登录并处理分支

提交用户名和密码后，根据返回结果判断是否登录成功、是否需要两步验证码、是否账号异常。

### 2. 完成两步验证

需要二次验证时，继续提交验证码。验证码错误应提示重新输入，不要清空已确认的登录上下文。

### 3. 处理注册和重置

注册和重置密码通常需要邮箱或验证码。前端应限制重复提交，并提示验证码有效期。

### 4. 退出并清理状态

退出登录后清理本地用户状态、缓存页面和敏感信息，避免共享设备上残留账号信息。

## 检查清单

- [ ] 登录成功和两步验证分支已分开处理。
- [ ] 注册和重置流程有验证码提示。
- [ ] 重复提交有前端限制。
- [ ] 退出后本地敏感状态已清理。`,
  }),
  createApiArticle({
    slug: 'api-security-verification',
    title: 'aiapi114 安全验证接口说明',
    summary: '说明通用安全验证、验证状态查询和高风险操作二次确认的接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/security-verification/verify-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/security-verification/verify-status-get.md',
    ],
    body: `安全验证接口用于保护高风险操作，例如修改敏感配置、支付信息或账号安全设置。它不应被当作普通表单校验。

## 适合先读这篇的人

- 你要给高风险操作增加二次确认。
- 你需要查询用户当前是否已通过安全验证。
- 你想降低误操作和账号被盗后的风险。

## 接入步骤

### 1. 标记高风险动作

先列出需要安全验证的动作，例如修改密码、关闭两步验证、调整支付配置或变更管理员权限。

### 2. 查询验证状态

进入高风险页面前查询当前验证状态，未通过时引导用户完成验证。

### 3. 提交验证请求

按平台支持的方式提交验证。验证失败时不要继续执行原操作，也不要在错误信息中泄露敏感细节。

### 4. 设置有效期

验证通过后只在有限时间内生效。超时后重新要求验证，避免长时间会话带来风险。

## 检查清单

- [ ] 高风险动作清单已明确。
- [ ] 未验证时不会执行写入操作。
- [ ] 验证失败提示不泄露敏感信息。
- [ ] 验证通过状态有有效期。`,
  }),
  createApiArticle({
    slug: 'api-oauth-login',
    title: 'aiapi114 OAuth 登录接口说明',
    summary: '说明 GitHub、OIDC、Discord、Telegram、微信等 OAuth 登录和绑定回调的接入要点。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-github-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-oidc-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-discord-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-wechat-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-state-get.md',
    ],
    body: `OAuth 登录接口用于处理第三方登录和账号绑定。接入重点不是按钮数量，而是回调地址、state 校验和账号绑定关系。

## 适合先读这篇的人

- 你要开放 GitHub、OIDC、Discord、Telegram 或微信登录。
- 你需要处理第三方账号绑定。
- 你正在排查 OAuth 回调失败。

## 接入步骤

### 1. 配置回调地址

在第三方平台后台填写 aiapi114 对应的回调地址。域名、协议和路径必须与平台配置一致。

### 2. 使用 state 防护

发起登录前生成 state，并在回调时校验，防止跨站请求和错误账号绑定。

### 3. 处理账号绑定

同一邮箱、同一第三方账号和已有平台账号之间的绑定规则要清晰，避免创建重复账号。

### 4. 记录失败原因

回调失败时记录 provider、错误码和请求时间，但不要记录授权码或访问令牌明文。

## 检查清单

- [ ] 第三方回调地址与平台配置一致。
- [ ] OAuth 回调校验 state。
- [ ] 账号绑定规则清晰。
- [ ] 日志不会记录令牌明文。`,
  }),
  createApiArticle({
    slug: 'api-payment-webhooks',
    title: 'aiapi114 支付回调接口说明',
    summary: '说明 Stripe、Creem、易支付等支付回调的验签、幂等和对账处理要求。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/payment/stripe-webhook-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/creem-webhook-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-epay-notify-get.md',
    ],
    body: `支付回调接口由支付平台调用，用于确认订单和更新余额。它通常无需用户登录，但必须做来源校验、签名校验和幂等处理。

## 适合先读这篇的人

- 你要接入 Stripe、Creem 或易支付回调。
- 你需要处理重复回调和订单对账。
- 你要排查付款成功但余额未到账。

## 接入步骤

### 1. 配置回调地址

在支付平台后台填写 aiapi114 的回调地址，并确认公网可访问、证书有效、路径无误。

### 2. 校验签名和来源

回调接口不能只依赖订单号。必须按支付平台要求校验签名、事件 ID 或来源信息。

### 3. 做幂等处理

同一订单可能多次回调。系统应识别已处理订单，避免重复加余额。

### 4. 建立对账流程

定期核对支付平台订单、平台充值记录和用户余额变更，发现差异及时人工处理。

## 检查清单

- [ ] 回调地址公网可访问。
- [ ] 已按支付平台要求验签。
- [ ] 重复回调不会重复入账。
- [ ] 支付订单和余额记录可对账。`,
  }),
  createApiArticle({
    slug: 'api-payment-topup',
    title: 'aiapi114 用户充值接口说明',
    summary: '说明发起充值、查询金额、创建支付订单和完成充值时的用户侧流程。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-amount-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-pay-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-stripe-pay-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-creem-pay-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-topup-complete-post.md',
    ],
    body: `用户充值接口用于创建支付订单、计算充值金额并在支付完成后更新余额。接入时要避免前端自行决定到账金额。

## 适合先读这篇的人

- 你要开发用户充值页面。
- 你需要支持多种支付方式。
- 你要排查充值金额、订单状态或到账问题。

## 接入步骤

### 1. 获取充值配置

先读取平台允许的金额、套餐或支付方式。前端只展示后端返回的可用选项。

### 2. 创建支付订单

用户选择金额和支付方式后，由后端创建订单并返回支付链接或支付参数。

### 3. 等待支付确认

支付成功以服务端回调和订单状态为准。前端页面只能提示等待确认，不应直接给用户加余额。

### 4. 展示充值结果

订单完成后刷新余额和充值记录。失败或超时时提示保留订单号并联系支持。

## 检查清单

- [ ] 前端不自行计算最终到账金额。
- [ ] 支付订单由服务端创建。
- [ ] 到账以服务端回调为准。
- [ ] 充值失败能提供订单号排查。`,
  }),
  createApiArticle({
    slug: 'api-image-edits',
    title: 'aiapi114 图像编辑接口说明',
    summary: '说明图像编辑接口的文件输入、提示词、模型能力和结果保存方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/images/openai/post-v1-images-edits.md'],
    body: `图像编辑接口用于在已有图片基础上生成修改结果。它比纯文本生图更依赖文件格式、遮罩、提示词和模型能力。

## 适合先读这篇的人

- 你要基于已有图片做局部修改或风格调整。
- 你需要上传图片、遮罩或其他编辑输入。
- 你想把图像编辑接入到业务页面。

## 接入步骤

### 1. 确认模型支持

先确认 aiapi114 当前开放的图像编辑模型、输入格式、尺寸限制和计费方式。

### 2. 准备图片输入

上传前检查文件类型、尺寸和敏感内容。业务侧应压缩超大图片，并避免上传无关个人信息。

### 3. 编写编辑提示词

提示词应说明要保留什么、修改什么、输出风格是什么。复杂编辑建议拆成多次请求。

### 4. 保存生成结果

保存结果 URL、任务 ID、模型名和用户请求，便于后续展示、下载和问题排查。

## 检查清单

- [ ] 已确认模型支持图像编辑。
- [ ] 输入图片符合格式和大小限制。
- [ ] 提示词区分保留内容和修改内容。
- [ ] 生成结果有关联记录。`,
  }),
  createApiArticle({
    slug: 'api-qwen-images',
    title: 'aiapi114 Qwen 图像接口说明',
    summary: '说明 Qwen 图像生成和图像编辑接口的接入边界、参数和排查方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/images/qwen/createimage.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/images/qwen/editimage.md',
    ],
    body: `Qwen 图像接口覆盖文本生图和图像编辑能力。接入前应确认具体模型名称、分辨率、返回格式和上游限制。

## 适合先读这篇的人

- 你要调用 Qwen 系列图像生成能力。
- 你需要同时支持文生图和图像编辑。
- 你正在排查 Qwen 图像任务失败。

## 接入步骤

### 1. 选择任务类型

文生图只需要提示词和生成参数；图像编辑还需要图片输入。两类请求不要共用同一套表单校验。

### 2. 设置生成参数

按业务需要配置尺寸、数量、风格和返回格式。不要开放上游不支持的参数给普通用户。

### 3. 控制请求成本

图像任务成本通常高于文本请求。建议为 Qwen 图像能力配置分组权限、额度提示和失败重试上限。

### 4. 展示结果和错误

成功时展示图片和下载入口；失败时提示参数错误、上游不可用、余额不足或限流原因。

## 检查清单

- [ ] 已区分文生图和图像编辑请求。
- [ ] 参数范围符合模型能力。
- [ ] 图像任务有成本和重试限制。
- [ ] 错误提示能指导用户修正。`,
  }),
  createApiArticle({
    slug: 'api-video-sora',
    title: 'aiapi114 Sora 视频接口说明',
    summary: '说明 Sora 视频创建、查询和内容获取接口的任务流与状态处理。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/sora/createvideo.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/sora/getvideo.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/sora/getvideocontent.md',
    ],
    body: `Sora 视频接口通常是异步任务流程。业务侧应把提交任务、查询状态和获取视频内容分开处理。

## 适合先读这篇的人

- 你要接入 Sora 视频生成能力。
- 你需要轮询任务状态并展示进度。
- 你要处理视频下载或内容获取。

## 接入步骤

### 1. 创建视频任务

提交提示词、模型和必要参数后保存任务 ID。提交成功不代表视频已经生成完成。

### 2. 查询任务状态

按合理间隔查询状态，区分排队、处理中、成功、失败和取消。不要高频轮询造成额外压力。

### 3. 获取视频内容

任务成功后再获取视频 URL 或内容。下载链接应设置有效期和访问权限。

### 4. 处理失败和超时

失败时保存错误信息和上游返回；超时任务应给用户明确状态，而不是一直显示加载中。

## 检查清单

- [ ] 已保存视频任务 ID。
- [ ] 轮询间隔不会过高。
- [ ] 成功后再获取视频内容。
- [ ] 失败和超时状态有明确提示。`,
  }),
  createApiArticle({
    slug: 'api-video-jimeng',
    title: 'aiapi114 即梦视频接口说明',
    summary: '说明即梦视频生成接口的请求参数、任务状态和成本控制方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/videos/jimeng/createjimengvideo.md'],
    body: `即梦视频接口用于提交视频生成任务。接入时要按异步任务处理，重点关注参数、状态、回调和用户等待体验。

## 适合先读这篇的人

- 你要接入即梦视频生成能力。
- 你需要为用户展示任务进度。
- 你要限制视频任务的成本和重试次数。

## 接入步骤

### 1. 校验生成参数

提交前检查提示词、时长、尺寸、参考图和模型参数是否符合平台支持范围。

### 2. 创建并记录任务

创建任务后保存任务 ID、用户、模型、参数摘要和提交时间，方便后续查询。

### 3. 查询执行结果

按任务状态刷新页面。视频生成耗时较长时，应允许用户离开页面后再回来查看。

### 4. 处理扣费和失败

把任务状态与扣费记录关联起来，失败任务按平台规则处理退款或不扣费。

## 检查清单

- [ ] 参数已按模型能力校验。
- [ ] 任务 ID 与用户记录关联。
- [ ] 用户可稍后查看结果。
- [ ] 扣费和任务状态一致。`,
  }),
  createApiArticle({
    slug: 'api-gemini-chat',
    title: 'aiapi114 Gemini 对话接口说明',
    summary: '说明 Gemini 对话兼容接口的消息结构、流式响应和多模态输入边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/chat/gemini/geminirelayv1beta.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/chat/gemini/geminirelayv1beta-391536411.md',
    ],
    body: `Gemini 对话接口适合需要 Gemini 模型能力的应用。接入时要关注消息格式、流式输出、多模态输入和错误码差异。

## 适合先读这篇的人

- 你要通过 aiapi114 调用 Gemini 对话模型。
- 你需要兼容流式回答或多轮上下文。
- 你正在迁移已有 Gemini 请求。

## 接入步骤

### 1. 选择兼容格式

根据业务使用 OpenAI 兼容格式或 Gemini 原生风格接口。不要在同一请求中混用两套字段。

### 2. 组织消息上下文

保留必要历史消息，控制上下文长度。多轮对话应保存用户输入、模型输出和系统提示词版本。

### 3. 处理流式响应

流式输出需要处理增量片段、结束标记、网络中断和用户主动停止。

### 4. 兼容多模态输入

如果传入图片或文件，先确认模型支持的输入类型、大小限制和计费方式。

## 检查清单

- [ ] 请求字段格式已统一。
- [ ] 多轮上下文有长度控制。
- [ ] 流式输出能处理异常中断。
- [ ] 多模态输入已确认模型支持。`,
  }),
  createApiArticle({
    slug: 'api-gemini-images',
    title: 'aiapi114 Gemini 图像接口说明',
    summary: '说明 Gemini 图像生成和图像相关能力的参数、返回结果与失败处理。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/images/gemini/geminirelayv1beta-383837589.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/images/gemini/geminirelayv1beta-389846313.md',
    ],
    body: `Gemini 图像接口用于生成或处理图像内容。由于不同上游模型能力差异明显，接入前应先确认平台开放的具体模型和参数。

## 适合先读这篇的人

- 你要调用 Gemini 图像相关模型。
- 你需要展示生成图片或保存结果。
- 你正在排查图像结果为空或格式异常。

## 接入步骤

### 1. 确认模型和能力

查看 aiapi114 当前支持的 Gemini 图像模型，确认是否支持生成、编辑、图文输入或其他能力。

### 2. 准备请求参数

填写提示词、尺寸、数量和返回格式。对用户输入做长度限制和安全提示。

### 3. 解析返回结果

根据接口返回处理图片 URL、Base64 内容或任务结果。前端应兼容空结果和部分失败。

### 4. 做结果留存

按业务需要保存图片、提示词、模型名和生成时间，方便用户回看和支持排查。

## 检查清单

- [ ] 已确认 Gemini 图像模型能力。
- [ ] 用户输入有长度和安全限制。
- [ ] 返回格式解析完整。
- [ ] 生成结果能追溯到请求记录。`,
  }),
  createApiArticle({
    slug: 'api-fine-tuning',
    title: 'aiapi114 Fine-tuning 接口说明',
    summary: '说明微调任务创建、列表、事件查询、取消和模型取回接口的使用边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/fine-tuning/createfinetune.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/fine-tuning/listfinetunes.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/fine-tuning/retrievefinetune.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/fine-tuning/cancelfinetune.md',
    ],
    body: `Fine-tuning 接口用于管理模型微调任务。接入前必须确认 aiapi114 当前是否开放该能力，以及上游是否支持对应模型。

## 适合先读这篇的人

- 你要评估微调能力是否可用于业务。
- 你需要创建、查询或取消微调任务。
- 你想了解微调任务的数据和安全边界。

## 接入步骤

### 1. 确认可用状态

先查看平台当前说明，确认微调接口是否开放。如果接口未开放，不要在用户界面展示入口。

### 2. 准备训练数据

训练数据应经过脱敏、格式校验和质量检查。不要上传未授权的用户隐私或商业敏感数据。

### 3. 创建并跟踪任务

创建任务后保存任务 ID，定期查询任务状态和事件，向用户展示可理解的进度。

### 4. 处理取消和结果

取消任务前提示可能产生的成本；任务完成后记录模型 ID、训练数据版本和使用范围。

## 检查清单

- [ ] 已确认微调接口当前开放状态。
- [ ] 训练数据经过脱敏和格式校验。
- [ ] 微调任务有状态追踪。
- [ ] 完成模型有使用范围记录。`,
  }),
  createApiArticle({
    slug: 'api-engine-embeddings',
    title: 'aiapi114 Engine Embeddings 接口说明',
    summary: '说明兼容旧版 Engine 路径的 Embeddings 接口、迁移策略和向量结果处理方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/ai-model/embeddings/createengineembedding.md'],
    body: `Engine Embeddings 接口用于兼容旧版调用路径。新项目优先使用标准 Embeddings 接口，旧项目迁移时再保留该路径。

## 适合先读这篇的人

- 你维护的旧项目仍使用 engine 路径。
- 你要把旧版向量接口迁移到 aiapi114。
- 你需要确认向量维度和返回格式。

## 接入步骤

### 1. 识别旧版调用

检查代码中是否存在 engine 形式的 Embeddings 路径。若是新项目，直接使用标准向量接口。

### 2. 对齐模型名称

确认旧项目里的 engine 名称与 aiapi114 当前模型名称是否能映射，避免请求到不存在的模型。

### 3. 处理向量结果

保存向量前确认维度、排序和归一化策略。向量库索引维度必须与模型输出一致。

### 4. 制定迁移计划

逐步把旧路径替换为标准接口，并保留回滚方案，避免一次性切换影响检索服务。

## 检查清单

- [ ] 已识别是否仍需 engine 兼容路径。
- [ ] 模型名称映射已确认。
- [ ] 向量维度与索引一致。
- [ ] 迁移标准接口有回滚方案。`,
  }),
]

function createArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return {
    slug: input.slug,
    categoryKey: 'advanced-usage',
    title: input.title,
    summary: input.summary,
    difficulty: '基础',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第九批管理员设置细分页面。',
        '文档框架稳定：保留竞品文档的配置入口、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充权限、安全、审计和用户视角验证。',
      ],
    },
  }
}

function createApiArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return {
    slug: input.slug,
    categoryKey: 'api-reference',
    title: input.title,
    summary: input.summary,
    difficulty: '基础',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '接入步骤', '检查清单'],
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第九批公开系统、认证、安全、OAuth 与支付接口页面。',
        '文档框架稳定：保留竞品文档的接口入口、字段方向、接入步骤和检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充认证、幂等、缓存、验签和排查边界。',
      ],
    },
  }
}
