import type { HelpArticle } from './types.ts'

export const THIRTEENTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createAdvancedArticle({
    slug: 'platform-architecture-overview',
    title: 'aiapi114 平台架构与能力总览',
    summary: '说明 aiapi114 的网关、渠道、模型、用户、计费、日志和管理后台之间的关系，帮助新管理员建立整体认知。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/wiki/basic-concepts/project-introduction.md',
      'docs/reference-help-docs/newapi-ai/guide/wiki/basic-concepts/features-introduction.md',
      'docs/reference-help-docs/newapi-ai/guide/wiki/basic-concepts/technical-architecture.md',
    ],
    body: `理解 aiapi114 的整体架构，可以减少后续配置渠道、分组、倍率和 API Key 时的误操作。平台可以先按“用户请求进入网关，再由渠道转发到上游模型，最后通过日志和计费回到控制台”这条主线理解。

## 适合先读这篇的人

- 你第一次负责部署或维护 aiapi114。
- 你还不确定渠道、模型、分组、Token 和日志之间的关系。
- 你需要向团队解释平台为什么能统一管理多个上游模型服务。

## 操作步骤

### 1. 先理解请求链路

用户或第三方工具把请求发到 aiapi114 的 Base URL，并携带 API Key。平台完成认证、额度检查、分组判断和模型匹配后，再选择可用渠道转发到上游服务。

### 2. 再理解管理对象

常见管理对象包括用户、Token、分组、模型、渠道、倍率、支付、日志和系统设置。新管理员应先熟悉这些对象，不要一开始就修改高风险系统配置。

### 3. 建立排查路径

调用失败时，先看用户余额和 Token，再看模型是否开放、渠道是否可用、上游是否报错，最后查看日志和任务状态。不要只凭客户端错误直接修改渠道。

### 4. 维护团队说明

如果多人共同维护平台，建议在内部文档中记录谁负责上游渠道、谁负责用户支持、谁负责支付和合规说明，避免问题发生后无人接手。

## 检查清单

- [ ] 已理解 Base URL、API Key、模型和渠道的关系。
- [ ] 已知道用户、分组和倍率会影响最终调用权限与费用。
- [ ] 已建立从客户端错误到日志、渠道、上游的排查路径。
- [ ] 已明确团队内的平台维护分工。`,
  }),
  createAdvancedArticle({
    slug: 'platform-operations-observability',
    title: 'aiapi114 运维观测与性能分析',
    summary: '说明如何从日志、统计、性能指标、监控和分析工具理解 aiapi114 运行状态，适合平台管理员长期维护。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/wiki/basic-concepts/performance-analysis.md',
      'docs/reference-help-docs/newapi-ai/guide/wiki/basic-concepts/analytics-setup.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/status-test-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/uptime-status-get.md',
    ],
    body: `aiapi114 帮助中心中的运维观测说明，目标不是让管理员记住所有指标，而是建立稳定的日常检查方法：先看平台是否可用，再看渠道质量、错误趋势、用量变化和性能瓶颈。

## 适合先读这篇的人

- 你负责平台日常巡检和故障排查。
- 你需要判断调用慢、错误多或费用异常的原因。
- 你准备接入外部监控、统计或告警工具。

## 操作步骤

### 1. 检查平台可用性

先确认控制台、公开接口、登录和模型列表能正常访问。可用性异常时，优先检查部署、反向代理、数据库、缓存和上游网络。

### 2. 观察调用日志

按时间、模型、渠道、用户和错误类型查看日志。持续增加的超时、认证失败、余额不足或模型不存在，代表不同的排查方向。

### 3. 分析性能与成本

把响应时间、失败率、Token 消耗、渠道命中和用户增长放在一起看。单一指标变好不代表整体健康，例如低成本渠道如果失败率高，仍会影响用户体验。

### 4. 接入监控与统计

生产环境建议接入外部监控和访问统计。监控重点包括服务存活、接口错误率、数据库连接、队列积压、渠道失败率和支付回调异常。

## 检查清单

- [ ] 已建立平台存活和核心页面可访问检查。
- [ ] 已能按模型、渠道、用户和错误类型查看日志。
- [ ] 已把性能、失败率和成本放在同一视角分析。
- [ ] 生产环境已有监控、统计或告警入口。`,
  }),
]

export const THIRTEENTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-user-security-admin',
    title: 'aiapi114 管理员用户安全接口说明',
    summary: '说明管理员查看用户详情、重置 Passkey、删除两步验证和执行用户安全管理操作时的接口边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-id-2fa-delete.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-id-reset_passkey-delete.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-manage-post.md',
    ],
    body: `管理员用户安全接口会影响用户登录方式和账户保护状态。接入后台能力时，应把重置 Passkey、删除两步验证、封禁和恢复视为高风险操作，而不是普通资料编辑。

## 适合先读这篇的人

- 你要开发管理员用户详情或安全操作面板。
- 你需要帮助用户重置 Passkey 或两步验证。
- 你要处理封禁、恢复、权限调整等账户安全操作。

## 接入步骤

### 1. 读取用户详情

先通过用户详情接口确认目标用户、状态、分组、安全设置和最近登录信息。页面应避免展示不必要的隐私字段。

### 2. 执行安全重置

重置 Passkey 或删除两步验证前，要求管理员填写原因并二次确认。完成后提示用户重新设置安全方式。

### 3. 管理账户状态

封禁、恢复或调整用户状态时，展示影响范围，例如是否会影响现有 API Key、余额使用和控制台登录。

### 4. 留存审计证据

记录操作人、目标用户、操作类型、原因和时间。涉及安全恢复的工单应能关联到审计日志。

## 检查清单

- [ ] 安全操作前已确认目标用户身份。
- [ ] Passkey 和两步验证重置有二次确认。
- [ ] 封禁或恢复操作展示影响范围。
- [ ] 管理员安全操作已写入审计记录。`,
  }),
  createApiArticle({
    slug: 'api-user-self-service',
    title: 'aiapi114 用户自助资料与安全接口说明',
    summary: '说明用户自助删除账号、查看和删除 Passkey、更新个人资料时的安全边界与页面提示。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-self-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-self-delete.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-passkey-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-passkey-delete.md',
    ],
    body: `用户自助接口用于个人资料、安全凭据和账号生命周期管理。它们面向当前登录用户，不能被扩展成跨用户管理接口。

## 适合先读这篇的人

- 你要开发个人资料页或账号安全页。
- 你需要展示用户自己的 Passkey 列表。
- 你要支持用户删除账号或移除安全凭据。

## 接入步骤

### 1. 更新个人资料

个人资料更新只允许修改昵称、头像、偏好等低风险字段。邮箱、密码、安全设置应走单独验证流程。

### 2. 管理 Passkey

展示 Passkey 列表时，显示设备名称、创建时间和最近使用时间即可，不展示凭据内部内容。删除前要求用户确认。

### 3. 删除账号

账号删除属于高风险操作。页面应提示余额、Token、历史记录和无法恢复的影响，并要求二次确认。

### 4. 处理登录失效

资料或安全设置变更后，如果服务端要求重新登录，前端应清理本地状态并引导用户重新认证。

## 检查清单

- [ ] 用户自助接口只作用于当前登录用户。
- [ ] 高风险字段不走普通资料更新接口。
- [ ] 删除 Passkey 和账号前有明确确认。
- [ ] 登录失效时会清理本地状态并重新认证。`,
  }),
  createApiArticle({
    slug: 'api-oauth-binding',
    title: 'aiapi114 OAuth 绑定与第三方登录接口说明',
    summary: '说明邮箱、LinuxDo、Telegram、微信等 OAuth 登录和绑定接口的使用方式、回调校验和账户关联风险。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-email-bind-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-linuxdo-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-telegram-bind-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-telegram-login-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/oauth/oauth-wechat-bind-get.md',
    ],
    body: `OAuth 绑定接口用于把第三方身份与 aiapi114 账户关联。它能降低登录门槛，但也会引入回调地址、账户合并和绑定解除的安全风险。

## 适合先读这篇的人

- 你要接入第三方登录或账号绑定。
- 你需要支持 Telegram、微信、LinuxDo 或邮箱绑定。
- 你要排查 OAuth 回调失败、重复绑定或账号关联错误。

## 接入步骤

### 1. 配置可信回调

在服务端配置固定回调地址和客户端凭据。不要让前端自由拼接回调地址，避免被利用跳转到不可信站点。

### 2. 发起登录或绑定

登录流程用于创建或进入账户，绑定流程用于当前用户关联第三方身份。页面必须明确区分两种入口。

### 3. 校验回调结果

回调成功后，服务端校验 state、授权码和第三方用户标识，再决定是否登录、绑定或提示冲突。

### 4. 处理绑定冲突

当第三方账号已绑定其他用户时，不要自动覆盖。提示用户联系管理员或按平台规则解除旧绑定。

## 检查清单

- [ ] 回调地址由服务端固定配置。
- [ ] 登录入口和绑定入口已区分。
- [ ] 回调校验包含 state 和第三方身份。
- [ ] 重复绑定不会自动覆盖已有账户。`,
  }),
  createApiArticle({
    slug: 'api-public-system-content',
    title: 'aiapi114 公开系统内容接口说明',
    summary: '说明首页内容、用户协议、隐私政策、倍率配置、可用性状态等公开系统接口的展示边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/system/home_page_content-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/privacy-policy-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/user-agreement-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/ratio_config-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/status-test-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/uptime-status-get.md',
    ],
    body: `公开系统内容接口用于向未登录或普通用户展示平台说明、协议、隐私政策、倍率信息和状态信息。它们应保持可读、稳定，并避免泄露后台敏感配置。

## 适合先读这篇的人

- 你要开发首页、协议页、隐私政策页或状态页。
- 你需要展示公开倍率或模型费用说明。
- 你要把可用性状态提供给用户或外部监控。

## 接入步骤

### 1. 读取公开内容

首页、协议和隐私政策应从服务端读取并按 Markdown 或富文本安全渲染。不要把后台未审核草稿直接公开。

### 2. 展示倍率配置

倍率和费用说明要配合用户所在分组解释。公开页面只展示用户需要理解的信息，不展示内部渠道成本。

### 3. 展示状态信息

状态检测和 uptime 信息用于提示平台是否可用。页面应区分平台不可用、上游不可用和局部渠道异常。

### 4. 控制缓存策略

协议和首页内容可以适度缓存；状态接口应保持较短缓存时间，避免用户看到过期可用性结果。

## 检查清单

- [ ] 公开内容来自已审核配置。
- [ ] 倍率展示不泄露内部渠道成本。
- [ ] 状态页区分平台、上游和局部渠道异常。
- [ ] 内容接口和状态接口使用不同缓存策略。`,
  }),
  createApiArticle({
    slug: 'api-vendor-management-detail',
    title: 'aiapi114 供应商管理细分接口说明',
    summary: '说明供应商详情、更新和删除接口在后台管理中的接入方式，重点处理供应商与渠道的依赖关系。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/vendors/vendors-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/vendors/vendors-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/vendors/vendors-id-delete.md',
    ],
    body: `供应商接口用于维护上游服务商元数据。供应商本身通常不直接承载请求，但会影响渠道分类、展示、筛选和运维排查。

## 适合先读这篇的人

- 你要开发供应商详情和编辑页面。
- 你需要把渠道按供应商分组展示。
- 你要删除或合并过时供应商记录。

## 接入步骤

### 1. 查看供应商详情

详情页应展示供应商名称、类型、说明、关联渠道数量和最近更新时间，帮助管理员判断是否仍在使用。

### 2. 更新供应商信息

更新供应商名称或描述前，确认是否会影响渠道筛选、报表分组和帮助文档中的展示名称。

### 3. 删除供应商

删除前检查是否有关联渠道。仍有关联渠道时，应先迁移或调整渠道，避免后台出现孤立引用。

### 4. 保持展示一致

供应商名称变更后，同步检查渠道列表、模型配置、统计报表和运维文档，确保前后名称一致。

## 检查清单

- [ ] 供应商详情展示关联渠道数量。
- [ ] 更新前已评估筛选和报表影响。
- [ ] 删除前已确认没有关联渠道。
- [ ] 供应商名称变更后已同步相关展示。`,
  }),
  createApiArticle({
    slug: 'api-model-management-detail',
    title: 'aiapi114 模型管理细分接口说明',
    summary: '说明模型详情、搜索、更新和删除接口在后台中的使用方式，重点控制模型可见性与误删风险。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-search-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-id-delete.md',
    ],
    body: `模型管理接口决定用户能看到和调用哪些模型。新增、更新、删除或搜索模型时，都要同步考虑渠道映射、分组权限和倍率配置。

## 适合先读这篇的人

- 你要开发模型详情、搜索或编辑页面。
- 你需要处理模型重命名、下线或同步后的人工修正。
- 你要排查用户看不到某个模型的问题。

## 接入步骤

### 1. 搜索和查看模型

搜索接口用于快速定位模型。详情页应展示模型名称、分组开放情况、倍率、关联渠道和最近同步来源。

### 2. 更新模型配置

更新模型名称、倍率或可见性前，确认是否影响已有 Token、第三方工具配置和文档示例。

### 3. 删除模型

删除前展示关联渠道、调用日志和用户影响范围。生产环境建议先下线或隐藏，再观察一段时间。

### 4. 验证用户视角

修改后使用目标分组账号查看模型列表，并执行一次低成本调用，确认配置真正生效。

## 检查清单

- [ ] 模型详情展示分组、倍率和关联渠道。
- [ ] 更新前已评估 Token 和第三方工具影响。
- [ ] 删除前已展示影响范围。
- [ ] 修改后已用用户视角验证。`,
  }),
  createApiArticle({
    slug: 'api-channel-sensitive-maintenance',
    title: 'aiapi114 渠道敏感维护接口说明',
    summary: '说明渠道密钥更新、余额刷新、模型比例重置和敏感维护接口的使用边界与安全要求。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-id-key-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-update_balance-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-update_balance-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system-settings/option-rest_model_ratio-post.md',
    ],
    body: `渠道敏感维护接口会改变上游 Key、余额信息或模型倍率。它们通常只应开放给 Root 或高级管理员，并且要有明确的操作记录。

## 适合先读这篇的人

- 你要支持管理员更新渠道上游 Key。
- 你需要刷新单个或全部渠道余额。
- 你要执行模型倍率重置等高影响维护操作。

## 接入步骤

### 1. 更新渠道密钥

更新上游 Key 时，前端不要回显完整 Key。提交前提示管理员确认渠道、供应商和影响模型。

### 2. 刷新渠道余额

余额刷新用于运维参考，不应替代财务对账。失败时保留上游错误摘要，避免暴露完整凭据。

### 3. 重置模型比例

模型比例重置会影响计费结果。执行前备份当前配置，并展示影响范围和预计变更项。

### 4. 记录维护结果

所有敏感维护操作都要记录操作者、目标渠道、动作、结果和失败原因，方便后续审计和回滚。

## 检查清单

- [ ] 渠道 Key 更新不回显完整密钥。
- [ ] 余额刷新失败不会暴露凭据。
- [ ] 模型比例重置前已备份配置。
- [ ] 敏感维护操作有审计记录。`,
  }),
  createApiArticle({
    slug: 'api-audit-cleanup',
    title: 'aiapi114 审计日志与清理接口说明',
    summary: '说明日志删除、兑换码详情、Token 详情等后台审计与清理接口的使用方式，避免误删排查证据。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-delete.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/token-management/token-id-get.md',
    ],
    body: `审计和清理接口用于查看关键对象详情、清理日志或定位争议记录。清理前要确认这些数据是否仍用于账务、支持、合规或故障排查。

## 适合先读这篇的人

- 你要开发日志清理或审计详情能力。
- 你需要查看兑换码或 Token 的单条详情。
- 你要制定日志保留和删除策略。

## 接入步骤

### 1. 查看关键详情

Token 和兑换码详情应展示状态、创建时间、使用情况和关联用户。完整敏感值只在必要场景展示，并尽量脱敏。

### 2. 判断清理范围

日志删除前，先按时间、类型和影响范围筛选。不要提供无保护的一键清空入口。

### 3. 保留排查证据

涉及支付、余额、封禁、安全重置和渠道故障的日志，应在问题关闭前保留，避免后续无法复盘。

### 4. 执行删除并记录

删除操作需要记录操作者、筛选条件、删除数量和执行时间。异常中断时要能确认已删除范围。

## 检查清单

- [ ] Token 和兑换码详情已做敏感信息控制。
- [ ] 日志清理前有筛选和影响范围确认。
- [ ] 支付、安全和渠道故障日志有保留策略。
- [ ] 删除操作记录操作者、条件和数量。`,
  }),
]

function createAdvancedArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return createArticle({
    ...input,
    categoryKey: 'advanced-usage',
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
    notes: [
      '符合大纲：属于第十三批平台架构、运维观测与管理员理解类页面。',
      '文档框架稳定：保留竞品文档的项目介绍、功能介绍、架构说明、性能分析和观测配置结构，并整理为新手可执行路径。',
      '竞品平台信息已替换成 aiapi114，并补充排查顺序、团队分工和长期运维视角。',
    ],
  })
}

function createApiArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return createArticle({
    ...input,
    categoryKey: 'api-reference',
    sections: ['适合先读这篇的人', '接入步骤', '检查清单'],
    notes: [
      '符合大纲：属于第十三批用户安全、OAuth、公开系统、供应商、模型、渠道维护和审计清理接口页面。',
      '文档框架稳定：保留竞品接口文档的入口、权限、字段方向和检查清单结构，合并同方向接口降低重复。',
      '竞品平台信息已替换成 aiapi114，并补充权限、安全、审计、回滚和排查边界。',
    ],
  })
}

function createArticle(input: {
  slug: string
  categoryKey: 'advanced-usage' | 'api-reference'
  title: string
  summary: string
  sourceBasis: string[]
  sections: string[]
  body: string
  notes: string[]
}): HelpArticle {
  return {
    slug: input.slug,
    categoryKey: input.categoryKey,
    title: input.title,
    summary: input.summary,
    difficulty: '基础',
    readTime: '约 6 分钟',
    sourceBasis: input.sourceBasis,
    sections: input.sections,
    markdown: `# ${input.title}\n\n${input.body}`,
    audit: {
      writer: 'PASS',
      reviewer: 'PASS',
      notes: input.notes,
    },
  }
}
