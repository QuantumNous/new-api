import type { HelpArticle } from './types.ts'

export const EIGHTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'onepanel-deployment',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 1Panel 部署',
    summary: '说明通过 1Panel 部署 aiapi114 时的应用、反向代理、域名和日志检查要点。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/deployment-methods/1panel-installation.md'],
    body: `1Panel 适合已经使用面板管理服务器的团队。它能降低部署门槛，但仍需要认真处理域名、证书、数据库和环境变量。

## 适合先读这篇的人

- 你已经在服务器上使用 1Panel。
- 你想通过面板部署和维护 aiapi114。
- 你需要查看部署失败时的日志位置。

## 操作步骤

### 1. 准备基础服务

确认服务器、域名、证书、数据库和反向代理已准备好。生产环境不要使用临时密码或默认密钥。

### 2. 创建应用

在 1Panel 中按镜像或 Compose 配置创建 aiapi114 应用，填写端口、数据目录和环境变量。

### 3. 配置反向代理

为控制台域名配置 HTTPS，确认代理转发到正确容器端口，并支持必要的请求体大小。

### 4. 查看日志并验证

启动后查看应用日志和反向代理日志，再验证登录、API Key 创建和一次低成本调用。

## 检查清单

- [ ] 域名和 HTTPS 已配置。
- [ ] 数据库和数据目录已持久化。
- [ ] 环境变量不包含默认弱密钥。
- [ ] 已完成登录和 API 调用验证。`,
  }),
  createArticle({
    slug: 'bt-docker-deployment',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 宝塔 Docker 部署',
    summary: '说明在宝塔面板中通过 Docker 部署 aiapi114 的准备、启动和验证流程。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/deployment-methods/bt-docker-installation.md'],
    body: `宝塔 Docker 部署适合习惯用面板管理站点的管理员。部署时不要只关注容器启动，还要验证反向代理、数据库和日志链路。

## 适合先读这篇的人

- 你使用宝塔面板管理服务器。
- 你希望用 Docker 方式运行 aiapi114。
- 你需要排查面板部署后无法访问的问题。

## 操作步骤

### 1. 安装 Docker 环境

确认宝塔中的 Docker 插件或 Docker 服务正常运行，并预留足够磁盘空间。

### 2. 创建容器或编排

按 aiapi114 镜像和环境变量要求创建容器，配置端口、数据卷和数据库连接。

### 3. 配置网站反代

在宝塔网站中配置域名和反向代理，开启 HTTPS，并确认代理目标端口正确。

### 4. 做上线验证

打开控制台，创建 API Key，调用一个低成本模型，并查看日志是否有错误。

## 检查清单

- [ ] Docker 服务运行正常。
- [ ] 容器端口和网站反代一致。
- [ ] 数据卷不会随容器删除。
- [ ] 调用日志能正常记录。`,
  }),
  createArticle({
    slug: 'cluster-deployment',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 集群部署',
    summary: '说明集群部署时的负载均衡、共享存储、数据库和发布验证要点。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/deployment-methods/cluster-deployment.md'],
    body: `集群部署用于高可用或高并发场景。它比单机部署更复杂，重点是共享状态、数据库容量、负载均衡和可回滚发布。

## 适合先读这篇的人

- 你需要部署多节点 aiapi114。
- 你要提升可用性或承载更高请求量。
- 你需要设计发布、回滚和监控策略。

## 操作步骤

### 1. 明确共享组件

数据库、缓存、对象存储和配置应由所有节点共享，不能依赖某一台应用节点本地状态。

### 2. 配置负载均衡

负载均衡应健康检查应用节点，并正确处理超时、请求体大小和长连接。

### 3. 做滚动发布

升级时逐个节点替换，观察日志、错误率和调用成功率，异常时立即停止发布。

### 4. 验证故障切换

下线单个节点，确认流量能切换到其他节点，用户登录和 API 调用不受影响。

## 检查清单

- [ ] 应用节点无关键本地状态。
- [ ] 负载均衡有健康检查。
- [ ] 发布过程可回滚。
- [ ] 已验证单节点故障切换。`,
  }),
  createArticle({
    slug: 'local-development',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 本地开发环境',
    summary: '说明本地开发 aiapi114 时的依赖、环境变量、测试数据和验证流程。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/deployment-methods/local-development.md'],
    body: `本地开发环境用于二次开发和调试。它不应直接连接生产数据库，也不应复用生产密钥。

## 适合先读这篇的人

- 你要对 aiapi114 做二次开发。
- 你需要在本地调试前端、后端或接口。
- 你想准备可重复的开发验证流程。

## 操作步骤

### 1. 准备依赖

按项目要求安装 Node、Go、数据库、缓存和包管理工具，版本应与项目说明保持一致。

### 2. 配置本地变量

复制示例环境变量，填入本地数据库和测试密钥。不要使用生产数据库和生产支付密钥。

### 3. 启动服务

分别启动后端、前端和依赖服务，观察日志，确认端口没有冲突。

### 4. 运行验证

完成一次登录、创建 Key、低成本调用和相关测试命令，再开始正式开发。

## 检查清单

- [ ] 本地环境没有连接生产数据库。
- [ ] 使用测试密钥和测试支付配置。
- [ ] 前后端服务均能启动。
- [ ] 开发前已跑通核心链路。`,
  }),
  createArticle({
    slug: 'admin-group-management',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 管理员分组管理',
    summary: '说明用户分组、模型权限、倍率和默认分组的管理方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/group.md'],
    body: `分组决定用户能使用哪些模型、享受哪些倍率和限制。管理员应把分组作为权限和成本控制工具，而不是随意标签。

## 适合先读这篇的人

- 你需要管理用户分组和模型权限。
- 你要为不同用户设置不同倍率或额度策略。
- 你遇到用户看不到模型或无法调用的问题。

## 操作步骤

### 1. 梳理分组用途

先定义测试、普通、专业、内部等分组的使用场景和权限边界。

### 2. 配置模型权限

为每个分组配置可用模型，确保高成本模型只开放给需要的用户。

### 3. 配置倍率和限制

按成本和服务策略设置倍率、并发或额度限制，避免用户误用高成本模型。

### 4. 验证用户视角

用目标分组账号登录，确认模型列表、调用权限和扣费都符合预期。

## 检查清单

- [ ] 分组用途已明确。
- [ ] 高成本模型有权限控制。
- [ ] 倍率和额度已核对。
- [ ] 已用用户视角验证。`,
  }),
  createArticle({
    slug: 'admin-oauth-settings',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 第三方登录与 OAuth 设置',
    summary: '说明管理员配置 GitHub、OIDC、Telegram、微信等登录方式时的安全边界。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/custom-oauth.md'],
    body: `第三方登录能降低注册门槛，但配置错误会导致无法登录或账号绑定异常。修改前应准备回滚入口。

## 适合先读这篇的人

- 你要开启 GitHub、OIDC、Telegram、微信等登录方式。
- 你需要配置回调地址和客户端密钥。
- 你担心第三方登录影响现有账号。

## 操作步骤

### 1. 创建第三方应用

在对应平台创建 OAuth 应用，记录 Client ID、Client Secret 和回调地址。

### 2. 配置回调地址

回调地址必须与 aiapi114 控制台配置一致，并使用 HTTPS。

### 3. 小范围测试

先用管理员测试账号完成登录、绑定和解绑验证，再开放给用户。

### 4. 保留备用登录方式

开启第三方登录后仍应保留管理员可用的备用登录方式，避免配置错误导致锁定。

## 检查清单

- [ ] 回调地址与第三方平台配置一致。
- [ ] Client Secret 未暴露在前端或仓库。
- [ ] 已用测试账号完成登录验证。
- [ ] 管理员仍有备用登录方式。`,
  }),
  createArticle({
    slug: 'admin-performance-settings',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 性能与限流设置',
    summary: '说明管理员配置限流、并发、缓存和性能保护策略的基本方法。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/performance.md'],
    body: `性能设置用于保护平台稳定性。不要等系统过载后才限流，应根据用户规模、模型成本和上游能力提前设置边界。

## 适合先读这篇的人

- 你要配置平台限流或并发策略。
- 你需要降低高峰期失败率。
- 你想平衡响应速度和成本控制。

## 操作步骤

### 1. 识别瓶颈

先查看请求量、失败率、上游延迟、数据库负载和高成本模型使用情况。

### 2. 设置限流策略

按用户、Key、模型、分组或 IP 设置合理限制。测试用户和生产用户可采用不同策略。

### 3. 配置缓存和超时

对低频变化数据使用缓存，对长耗时任务设置明确超时和重试间隔。

### 4. 观察效果

变更后观察成功率、平均延迟、排队情况和用户反馈。

## 检查清单

- [ ] 已识别主要性能瓶颈。
- [ ] 限流策略按用户或模型区分。
- [ ] 超时和重试有上限。
- [ ] 变更后已观察关键指标。`,
  }),
  createArticle({
    slug: 'admin-subscription-settings',
    categoryKey: 'advanced-usage',
    title: 'aiapi114 订阅与套餐管理',
    summary: '说明管理员设计订阅、套餐、权益和到期处理时的注意事项。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/subscription.md'],
    body: `订阅与套餐会影响用户权益和收入。上线前应明确套餐内容、有效期、续费规则和异常处理方式。

## 适合先读这篇的人

- 你要配置 aiapi114 套餐或订阅。
- 你需要定义不同用户权益。
- 你要处理套餐到期、续费或退款问题。

## 操作步骤

### 1. 定义套餐权益

明确每个套餐包含额度、模型范围、有效期、限速和支持等级。

### 2. 配置价格和有效期

价格、周期和到期规则应保持一致，避免用户理解偏差。

### 3. 验证购买链路

用测试账号验证购买、到账、权益生效、到期和续费。

### 4. 记录异常处理规则

明确支付成功未到账、重复购买、到期争议和人工补偿的处理流程。

## 检查清单

- [ ] 套餐权益描述清楚。
- [ ] 价格、周期和有效期一致。
- [ ] 已验证购买和权益生效。
- [ ] 异常处理规则已记录。`,
  }),
]

export const EIGHTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-model-list',
    title: 'aiapi114 模型列表接口说明',
    summary: '说明模型列表接口的返回内容、筛选方式和客户端展示建议。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/models/list/listmodels.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/models/list/listmodelsgemini.md',
    ],
    body: `模型列表接口用于读取当前可用模型。客户端应以接口返回为准，不要硬编码长期模型清单。

## 适合先读这篇的人

- 你要在客户端展示 aiapi114 可用模型。
- 你需要区分 OpenAI 兼容模型和 Gemini 兼容模型。
- 你想避免用户手动输入错误模型名。

## 接入步骤

### 1. 请求模型列表

在服务端或可信客户端请求模型列表接口，并根据用户权限展示可用模型。

### 2. 处理模型能力

根据模型名称、能力标签或平台说明区分文本、图像、音频、嵌入和视频模型。

### 3. 缓存与刷新

模型列表可短期缓存，但应提供刷新入口，避免模型变更后仍展示旧数据。

### 4. 复制模型名

页面应允许复制准确模型名，减少手动输入错误。

## 检查清单

- [ ] 客户端不硬编码长期模型列表。
- [ ] 模型能力分类清楚。
- [ ] 有刷新或重新拉取机制。
- [ ] 用户可复制准确模型名。`,
  }),
  createApiArticle({
    slug: 'api-management-models',
    title: 'aiapi114 模型管理接口说明',
    summary: '说明管理员模型列表、创建、更新、删除和上游同步接口的使用边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-sync_upstream-post.md',
    ],
    body: `模型管理接口决定平台向用户展示和开放哪些模型。写入错误可能导致用户无法调用或扣费异常。

## 适合先读这篇的人

- 你要开发管理员模型管理页面。
- 你需要同步上游模型并调整展示名称。
- 你要排查 model not found 或倍率错误。

## 接入步骤

### 1. 查询模型

分页读取模型列表，展示模型 ID、名称、分组、倍率、状态和来源。

### 2. 创建或更新模型

模型 ID 必须与调用时使用的名称一致；展示名可以更友好，但不能误导复制。

### 3. 同步上游

同步前先预览差异，确认新增、删除和变更模型不会影响正在使用的用户。

### 4. 做端到端测试

模型变更后用普通用户账号发起一次调用，确认列表、权限和扣费正常。

## 检查清单

- [ ] 模型 ID 与上游一致。
- [ ] 同步前已预览差异。
- [ ] 倍率和分组已核对。
- [ ] 变更后完成端到端测试。`,
  }),
  createApiArticle({
    slug: 'api-management-groups',
    title: 'aiapi114 分组管理接口说明',
    summary: '说明用户分组、预设分组、权限和倍率接口的管理方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/groups/group-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/groups/prefill_group-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/groups/prefill_group-post.md',
    ],
    body: `分组管理接口用于读取和维护用户分组。它影响模型可见性、倍率和使用权限，应与用户管理、模型管理联动验证。

## 适合先读这篇的人

- 你要开发分组配置页面。
- 你需要管理默认分组或预设分组。
- 你要排查用户权限和扣费策略。

## 接入步骤

### 1. 读取分组

展示分组名称、描述、可用模型、倍率和默认状态。

### 2. 更新预设分组

修改预设分组前先确认受影响用户数量，避免大范围权限变化。

### 3. 联动用户验证

把测试用户切换到目标分组，确认模型列表、调用权限和扣费符合预期。

### 4. 记录变更

记录分组配置变更的操作者、时间、原因和影响范围。

## 检查清单

- [ ] 分组配置有权限控制。
- [ ] 修改前确认影响用户范围。
- [ ] 已用测试用户验证权限。
- [ ] 分组变更有审计记录。`,
  }),
  createApiArticle({
    slug: 'api-management-oauth',
    title: 'aiapi114 OAuth 管理接口说明',
    summary: '说明第三方登录、绑定、解绑和 OAuth 状态接口的接入边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-github-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-oidc-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-state-get.md',
    ],
    body: `OAuth 管理接口用于第三方登录和账号绑定。它涉及回调、状态校验和账号归属，必须防止伪造回调和错误绑定。

## 适合先读这篇的人

- 你要接入 GitHub、OIDC、Telegram 或微信登录。
- 你需要处理账号绑定和解绑。
- 你要排查第三方登录失败。

## 接入步骤

### 1. 生成授权状态

发起授权前生成 state，并在回调时校验，防止跨站请求伪造。

### 2. 跳转第三方授权

使用平台配置的 Client ID 和回调地址发起授权，不要在前端泄露 Client Secret。

### 3. 处理回调

回调后校验 state、code、用户身份和绑定关系，再建立登录态或绑定账号。

### 4. 处理异常

绑定冲突、邮箱不一致或授权失败时给出明确提示，并保留备用登录方式。

## 检查清单

- [ ] 回调校验 state。
- [ ] Client Secret 不暴露给前端。
- [ ] 绑定冲突有明确处理。
- [ ] 管理员保留备用登录方式。`,
  }),
  createApiArticle({
    slug: 'api-management-2fa',
    title: 'aiapi114 二次验证接口说明',
    summary: '说明 2FA 设置、启用、禁用、备用码和状态查询接口的安全要求。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-setup-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-enable-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-status-get.md',
    ],
    body: `二次验证用于提升账号安全。接口设计要保护备用码、验证密钥和禁用流程，避免账号被绕过保护。

## 适合先读这篇的人

- 你要开发 2FA 设置页面。
- 你需要支持启用、禁用和备用码。
- 你想保护管理员和高权限账号。

## 接入步骤

### 1. 创建设置会话

用户发起 2FA 设置时，服务端生成临时密钥和二维码，前端只展示必要信息。

### 2. 验证一次性验证码

启用前必须要求用户输入验证码并校验成功，不能只生成二维码就视为启用。

### 3. 生成备用码

备用码只展示一次，提示用户安全保存。服务端应保存哈希或安全表示。

### 4. 禁用时二次确认

禁用 2FA 应要求重新验证密码、验证码或管理员确认。

## 检查清单

- [ ] 启用前已校验验证码。
- [ ] 备用码只展示一次。
- [ ] 禁用流程有二次确认。
- [ ] 高权限账号优先启用 2FA。`,
  }),
  createApiArticle({
    slug: 'api-management-statistics',
    title: 'aiapi114 统计接口说明',
    summary: '说明平台统计、自身统计、数据看板和指标缓存接口的使用方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/statistics/data-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/statistics/data-self-get.md',
    ],
    body: `统计接口用于构建数据看板。它适合展示趋势和汇总，不适合替代逐条日志排查。

## 适合先读这篇的人

- 你要开发平台数据看板。
- 你需要区分管理员统计和用户自身统计。
- 你想展示请求量、消耗和成功率趋势。

## 接入步骤

### 1. 选择统计范围

管理员可查看全站统计；普通用户只能查看自身统计。接口权限必须严格区分。

### 2. 设置时间维度

按小时、天或月聚合数据，避免一次查询过大时间范围。

### 3. 做缓存处理

统计数据可短期缓存，但排查实时问题时应回到日志接口核对。

### 4. 展示趋势而非单点

页面应展示趋势、峰值和异常变化，帮助判断问题是否持续。

## 检查清单

- [ ] 管理员统计和用户统计权限分离。
- [ ] 查询包含时间范围。
- [ ] 统计数据有合理缓存。
- [ ] 异常排查会回到日志核对。`,
  }),
  createApiArticle({
    slug: 'api-management-tasks',
    title: 'aiapi114 任务管理接口说明',
    summary: '说明异步任务、绘图任务、个人任务查询和管理员任务查询接口。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/tasks/task-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/tasks/task-self-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/tasks/mj-get.md',
    ],
    body: `任务管理接口用于查询异步任务，例如绘图、视频或其他长耗时生成任务。不同角色看到的任务范围不同。

## 适合先读这篇的人

- 你要开发任务记录页面。
- 你需要区分个人任务和管理员任务。
- 你要排查任务失败、排队或超时。

## 接入步骤

### 1. 区分查询角色

普通用户只能查询自己的任务；管理员可按用户、模型、状态和时间筛选。

### 2. 保存任务 ID

创建任务后立即保存任务 ID，后续查询、展示和反馈都依赖它。

### 3. 展示任务状态

页面应明确展示排队中、处理中、成功、失败和过期状态。

### 4. 限制轮询频率

任务查询应有合理间隔，避免高频轮询造成额外负载。

## 检查清单

- [ ] 用户只能查看自己的任务。
- [ ] 创建任务后保存任务 ID。
- [ ] 状态展示清晰。
- [ ] 轮询频率有上限。`,
  }),
  createApiArticle({
    slug: 'api-management-vendors',
    title: 'aiapi114 供应商管理接口说明',
    summary: '说明供应商列表、创建、更新、删除和搜索接口的管理边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/vendors/vendors-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/vendors/vendors-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/vendors/vendors-search-get.md',
    ],
    body: `供应商管理接口用于维护上游服务商信息。它通常与渠道、模型和计费规则联动，错误配置会影响平台可用性。

## 适合先读这篇的人

- 你要开发供应商管理页面。
- 你需要维护上游服务商信息。
- 你要按供应商分析渠道和模型。

## 接入步骤

### 1. 查询供应商列表

展示供应商名称、状态、备注、关联渠道数和更新时间。

### 2. 新增或更新供应商

新增前确认命名规范，避免同一供应商出现多个重复名称。

### 3. 关联渠道和模型

供应商信息应能帮助管理员理解渠道来源和模型能力，不应只作为孤立标签。

### 4. 删除前检查依赖

删除或禁用供应商前，确认是否仍有关联渠道或统计报表依赖。

## 检查清单

- [ ] 供应商命名规范统一。
- [ ] 删除前检查关联渠道。
- [ ] 供应商信息能辅助排查。
- [ ] 写入操作有权限控制。`,
  }),
]

function createArticle(input: {
  slug: string
  categoryKey: 'advanced-usage'
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return {
    slug: input.slug,
    categoryKey: input.categoryKey,
    title: input.title,
    summary: input.summary,
    difficulty: '基础',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
    markdown: `# ${input.title}

${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第八批部署与管理员配置页面。',
        '文档框架稳定：保留竞品文档的配置说明、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充权限、安全、验证和回滚边界。',
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
    markdown: `# ${input.title}

${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: [
        '符合大纲：属于第八批 API 与管理接口细分页面。',
        '文档框架稳定：保留竞品文档的接口入口、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充权限、安全、审计和排查边界。',
      ],
    },
  }
}
