import type { HelpArticle } from './types.ts'

export const TENTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createAdvancedArticle({
    slug: 'admin-docs-about-config',
    title: 'aiapi114 文档入口与关于页配置',
    summary: '说明 Root 管理员配置文档链接、关于页 Markdown 内容和用户侧展示入口的方法。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/docs-config.md'],
    body: `文档入口和关于页决定用户遇到问题时能不能找到正确说明。管理员应把它们当作长期维护入口，而不是一次性配置。

## 适合先读这篇的人

- 你要在左侧导航展示帮助文档入口。
- 你需要维护关于页、合规说明或联系方式。
- 你希望用户能从控制台快速回到帮助中心。

## 操作步骤

### 1. 配置文档地址

使用 Root 账号进入系统设置，在运营设置中填写完整文档 URL。生产环境建议使用 HTTPS，并确认普通用户可以访问。

### 2. 配置关于页内容

在其它设置中填写关于页 Markdown。内容应包括平台定位、联系方式、使用边界和必要的合规提醒。

### 3. 校验导航展示

保存后用普通用户账号查看左侧导航和关于页，确认链接、换行、标题和列表都能正常显示。

### 4. 建立更新责任

指定维护人定期检查文档地址、联系方式和关于页内容，避免过期入口长期留在用户侧。

## 检查清单

- [ ] 文档地址使用完整 HTTPS URL。
- [ ] 关于页内容没有过期联系方式。
- [ ] 普通用户视角能打开文档和关于页。
- [ ] 已明确文档入口维护责任人。`,
  }),
  createAdvancedArticle({
    slug: 'platform-acceptable-use',
    title: 'aiapi114 合规与可接受使用说明',
    summary: '说明平台使用边界、上游授权、内容安全、支付合规和对外服务责任。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/legal/acceptable-use.md'],
    body: `aiapi114 帮助中心中的合规说明用于提醒部署方和使用者：平台只能用于合法授权、合规可审计的 AI 接入和管理场景。

## 适合先读这篇的人

- 你要把 aiapi114 用于团队或企业内部。
- 你准备面向外部用户提供 AI 服务。
- 你需要确认上游 Key、支付和内容安全责任边界。

## 操作步骤

### 1. 确认上游授权

所有上游 API Key、模型服务、支付服务和第三方服务都必须由部署方合法取得授权，并遵守对应服务条款。

### 2. 明确服务对象

内部自用和面向公众服务的合规要求不同。面向公众提供服务时，部署方需要自行满足所在地的备案、内容安全、用户管理和税务要求。

### 3. 配置治理能力

屏蔽词、日志、监控、举报和处置流程应服务于内容安全、滥用治理和审计，而不是绕过上游规则。

### 4. 保留审计证据

对渠道、支付、用户、日志和高风险设置保留变更记录，方便后续排查和合规说明。

## 检查清单

- [ ] 上游服务和 API Key 来源合法授权。
- [ ] 已区分内部使用和公众服务责任。
- [ ] 内容安全与滥用治理机制已配置。
- [ ] 关键操作有审计记录。`,
  }),
  createAdvancedArticle({
    slug: 'business-collaboration',
    title: 'aiapi114 商务合作与服务说明',
    summary: '说明商务合作、企业接入、私有化部署和服务沟通时应准备的信息。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/business/index.md'],
    body: `商务合作页面不应只放联系方式，还应说明合作前提、适用场景和沟通材料，帮助企业用户更快判断是否匹配。

## 适合先读这篇的人

- 你要评估企业或团队接入 aiapi114。
- 你需要准备私有化部署或技术合作沟通材料。
- 你希望明确合作必须建立在合法授权和合规使用基础上。

## 操作步骤

### 1. 明确合作场景

先确认是内部统一 API 网关、用量统计、成本分摊、私有化部署，还是企业客户账务管理。

### 2. 准备基础信息

沟通前准备预计用户规模、模型来源、上游授权方式、部署环境、支付需求和合规约束。

### 3. 说明边界责任

部署方需要对自身服务资质、上游授权、内容安全、用户管理和支付合规负责。

### 4. 维护联系方式

商务邮箱、工单入口或企业联系方式应保持有效。变更后同步更新关于页和帮助中心。

## 检查清单

- [ ] 合作场景已明确。
- [ ] 已准备规模、模型、部署和合规信息。
- [ ] 已说明部署方责任边界。
- [ ] 联系方式保持有效。`,
  }),
]

export const TENTH_BATCH_SUPPORT_ARTICLES: HelpArticle[] = [
  createSupportArticle({
    slug: 'faq-quota-channel-deployment',
    title: 'aiapi114 额度、渠道与部署常见问题',
    summary: '汇总额度不足、无可用渠道、渠道测试、部署连接和升级数据安全等常见问题。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/support/faq.md'],
    body: `这篇 FAQ 面向已经完成基础接入、但在额度、渠道、部署或升级时遇到问题的用户。排查时先看错误表现，再定位对应模块。

## 适合先读这篇的人

- 你看到额度不足、无可用渠道或分组负载饱和。
- 你在配置渠道时遇到测试报错。
- 你担心升级、数据库变更或手动改库导致数据异常。

## 操作步骤

### 1. 排查额度问题

先查看账户余额、用量日志、模型倍率和分组倍率。余额足够但仍提示不足时，重点检查预扣费、模型价格和分组限制。

### 2. 排查渠道问题

无可用渠道通常与渠道状态、模型映射、分组权限、上游 Key 或渠道权重有关。先测试单个渠道，再看分组和模型配置。

### 3. 排查部署连接问题

\`Failed to fetch\` 常见于跨域、HTTPS、反向代理或 Base URL 配置错误。确认浏览器能访问控制台，客户端 Base URL 没有重复拼接路径。

### 4. 排查升级与数据库问题

升级前备份数据库。不要手动修改核心表；如果出现数据库一致性错误，先停止写入并联系管理员或维护人员排查。

## 检查清单

- [ ] 已核对余额、倍率和分组限制。
- [ ] 已单独测试目标渠道。
- [ ] Base URL、HTTPS 和反向代理配置正确。
- [ ] 升级前已备份数据库。`,
  }),
]

export const TENTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-user-management-admin',
    title: 'aiapi114 管理员用户管理接口说明',
    summary: '说明管理员查询、搜索、创建、更新、封禁和调整用户信息接口的安全边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-search-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-id-delete.md',
    ],
    body: `管理员用户管理接口涉及账号、余额、分组、状态和安全设置。接入后台工具时，应默认把所有写入操作视为高风险操作。

## 适合先读这篇的人

- 你要开发管理员用户列表或用户详情页。
- 你需要修改用户分组、余额、状态或备注。
- 你要处理封禁、恢复、重置安全设置等操作。

## 接入步骤

### 1. 查询和搜索用户

列表接口应支持分页，搜索接口应限制可搜索字段。页面不要展示不必要的隐私字段。

### 2. 展示关键状态

用户详情应展示分组、余额、状态、Key 数量、最近登录和最近调用摘要，帮助管理员判断风险。

### 3. 执行最小写入

更新用户时只提交需要变更的字段，不要把旧详情整包覆盖。封禁、删除和重置类操作需要二次确认。

### 4. 记录审计日志

保存操作者、目标用户、变更字段、原因和时间。涉及余额时还要能关联账务记录。

## 检查清单

- [ ] 用户列表和搜索有分页限制。
- [ ] 隐私字段按最小必要展示。
- [ ] 高风险写入有二次确认。
- [ ] 用户变更有审计记录。`,
  }),
  createApiArticle({
    slug: 'api-user-self-profile',
    title: 'aiapi114 当前用户信息接口说明',
    summary: '说明当前用户资料、分组、余额、设置和自助更新接口的接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-self-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-self-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-self-groups-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-setting-put.md',
    ],
    body: `当前用户信息接口用于个人中心、控制台首页和客户端状态同步。它只返回当前登录用户相关信息，不应被用来读取其他用户数据。

## 适合先读这篇的人

- 你要开发个人资料、余额或设置页面。
- 你需要展示当前用户分组和可用模型范围。
- 你要处理用户自助更新资料。

## 接入步骤

### 1. 获取当前用户信息

登录后读取当前用户资料，并把用户 ID、分组、余额、状态和基础设置缓存到前端状态中。

### 2. 展示分组能力

根据当前用户分组展示可用模型、额度说明和权限边界，避免用户误以为所有模型都可调用。

### 3. 更新用户设置

用户自助更新资料时，只允许修改头像、昵称、偏好等低风险字段。安全字段应走单独验证流程。

### 4. 处理登录失效

接口返回未登录或权限失效时，清理本地状态并引导重新登录。

## 检查清单

- [ ] 只读取当前登录用户数据。
- [ ] 分组和可用能力展示一致。
- [ ] 安全字段不走普通资料更新。
- [ ] 登录失效会清理本地状态。`,
  }),
  createApiArticle({
    slug: 'api-passkey-management',
    title: 'aiapi114 Passkey 管理接口说明',
    summary: '说明 Passkey 注册、验证、登录、删除和管理员重置接口的接入流程。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-passkey-register-begin-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-passkey-register-finish-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-passkey-verify-begin-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-passkey-verify-finish-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-passkey-login-begin-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-passkey-login-finish-post.md',
    ],
    body: `Passkey 接口用于无密码登录和高风险操作验证。它依赖浏览器、设备和域名环境，接入时要处理兼容性和失败降级。

## 适合先读这篇的人

- 你要为 aiapi114 增加 Passkey 登录。
- 你需要用 Passkey 验证高风险操作。
- 你要处理用户删除或重置 Passkey。

## 接入步骤

### 1. 开始注册或登录

先调用 begin 接口获取挑战参数，再交给浏览器 WebAuthn 能力处理。不要自行伪造挑战参数。

### 2. 完成注册或登录

浏览器返回凭据后提交 finish 接口。服务端验证成功后再更新用户状态或登录态。

### 3. 处理兼容性

不支持 Passkey 的设备应展示密码、二次验证码或其他可用登录方式，不要让用户卡在单一路径。

### 4. 管理凭据生命周期

用户删除 Passkey 或管理员重置 Passkey 时，需要二次确认并记录审计日志。

## 检查清单

- [ ] begin 和 finish 流程严格配对。
- [ ] 挑战参数由服务端生成。
- [ ] 不支持设备有降级登录方式。
- [ ] 删除或重置 Passkey 有审计记录。`,
  }),
  createApiArticle({
    slug: 'api-channel-batch-operations',
    title: 'aiapi114 渠道批量操作接口说明',
    summary: '说明渠道批量删除、标签启停、模型同步和批量管理接口的风险控制。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-batch-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-batch-tag-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-tag-disabled-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-tag-enabled-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-fetch_models-post.md',
    ],
    body: `渠道批量操作会同时影响多个上游渠道。它适合自动化维护，但必须先评估影响范围，避免一次误操作导致模型大面积不可用。

## 适合先读这篇的人

- 你要开发渠道批量删除、启停或打标签能力。
- 你需要批量同步渠道模型。
- 你要把渠道维护纳入自动化流程。

## 接入步骤

### 1. 预览影响范围

执行前展示渠道数量、渠道类型、关联模型、分组和最近调用量，让管理员知道会影响哪些用户。

### 2. 分批执行操作

大量渠道建议分批处理，并在每批后记录结果，避免单次请求失败后无法确认哪些渠道已变更。

### 3. 保护生产渠道

对高优先级、兜底或生产主渠道增加额外确认，不允许普通批量操作直接删除。

### 4. 记录和回滚

保存操作前后的渠道状态，必要时支持按记录恢复标签、启停状态或模型配置。

## 检查清单

- [ ] 批量操作前有影响范围预览。
- [ ] 大批量任务按批执行。
- [ ] 生产关键渠道有额外保护。
- [ ] 操作结果可审计、可回滚。`,
  }),
  createApiArticle({
    slug: 'api-channel-testing',
    title: 'aiapi114 渠道测试接口说明',
    summary: '说明单渠道测试、余额更新、模型拉取和测试失败排查接口的使用方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-test-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-test-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-update_balance-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-fetch_models-id-get.md',
    ],
    body: `渠道测试接口用于上线前验证上游 Key、模型映射、余额和响应格式。测试通过不代表长期稳定，仍需要监控和日志。

## 适合先读这篇的人

- 你要在后台提供渠道测试按钮。
- 你需要自动检查渠道余额和模型列表。
- 你正在排查渠道测试失败。

## 接入步骤

### 1. 测试单个渠道

指定渠道 ID 发起测试，记录响应时间、状态、错误码和返回摘要。不要在前端展示上游 Key。

### 2. 拉取模型列表

支持上游模型拉取时，先预览模型差异，再由管理员确认是否写入平台模型配置。

### 3. 更新余额信息

余额更新只作为渠道健康参考，不能替代实际账务对账。失败时保留上游错误方便排查。

### 4. 分类处理错误

把认证失败、模型不存在、响应格式错误、网络超时和余额不足分开提示，减少无效工单。

## 检查清单

- [ ] 渠道测试不会暴露上游 Key。
- [ ] 模型拉取写入前有预览。
- [ ] 余额更新失败有错误记录。
- [ ] 测试错误按类型展示。`,
  }),
  createApiArticle({
    slug: 'api-log-statistics',
    title: 'aiapi114 日志统计接口说明',
    summary: '说明个人日志统计、管理员统计、Token 日志和用量趋势接口的接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-self-stat-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-stat-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-token-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/statistics/data-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/statistics/data-self-get.md',
    ],
    body: `日志统计接口用于展示调用量、消耗、错误和趋势。接入时要区分用户自查视角和管理员全局视角。

## 适合先读这篇的人

- 你要开发用量看板或个人用量页面。
- 你需要按模型、Key、用户或时间统计调用。
- 你想用统计数据排查异常消耗。

## 接入步骤

### 1. 区分权限范围

个人统计只能展示当前用户数据；管理员统计可以查看全局数据，但需要权限控制和审计。

### 2. 选择统计维度

常用维度包括时间、模型、用户、Token、渠道、错误码和消费金额。页面应先展示最关键的 3 到 5 个维度。

### 3. 处理时间范围

默认展示最近 24 小时或最近 7 天，长时间范围应分页或异步加载，避免一次查询过重。

### 4. 关联排查入口

统计发现异常后，应能跳转到具体日志或用户详情，形成排查闭环。

## 检查清单

- [ ] 个人统计和管理员统计权限分开。
- [ ] 统计维度不过度堆叠。
- [ ] 长时间范围有分页或异步加载。
- [ ] 异常趋势能跳转到日志排查。`,
  }),
  createApiArticle({
    slug: 'api-system-options',
    title: 'aiapi114 系统选项接口说明',
    summary: '说明 Root 获取、更新、迁移和同步系统选项接口时的变更控制要求。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/system-settings/option-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system-settings/option-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/system-settings/option-migrate_console_setting-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/system-settings/ratio_sync-fetch-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/system-settings/ratio_sync-channels-get.md',
    ],
    body: `系统选项接口会影响整个平台配置，通常只允许 Root 调用。任何写入、迁移或同步动作都应先备份再执行。

## 适合先读这篇的人

- 你要开发系统设置管理工具。
- 你需要更新倍率、公告、支付或运营配置。
- 你要执行配置迁移或渠道倍率同步。

## 接入步骤

### 1. 读取当前配置

先获取当前系统选项并生成配置快照。不要在没有原始值的情况下直接覆盖生产配置。

### 2. 校验更新内容

更新前校验字段类型、JSON 格式、URL、数值范围和布尔开关。配置错误可能导致全站不可用。

### 3. 执行写入或迁移

迁移控制台设置、同步倍率或更新系统选项时，应显示影响范围，并限制为 Root 操作。

### 4. 验证并保留回滚

保存后验证登录、模型列表、计费、支付和公告展示。保留变更前快照以便回滚。

## 检查清单

- [ ] 写入前已保存配置快照。
- [ ] 字段格式和范围已校验。
- [ ] 迁移和同步仅 Root 可执行。
- [ ] 保存后已验证核心链路。`,
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
      '符合大纲：属于第十批运维、合规与商务配置页面。',
      '文档框架稳定：保留竞品文档的配置目标、步骤、检查清单结构。',
      '竞品平台信息已替换成 aiapi114，并补充新手视角、合规边界和验证责任。',
    ],
  })
}

function createSupportArticle(input: {
  slug: string
  title: string
  summary: string
  sourceBasis: string[]
  body: string
}): HelpArticle {
  return createArticle({
    ...input,
    categoryKey: 'faq',
    sections: ['适合先读这篇的人', '操作步骤', '检查清单'],
    notes: [
      '符合大纲：属于第十批常见错误答疑扩展页面。',
      '文档框架稳定：保留竞品 FAQ 的额度、渠道、部署、升级问题结构，并改为排查步骤。',
      '竞品平台信息已替换成 aiapi114，并补充用户可执行的验证路径。',
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
      '符合大纲：属于第十批用户、渠道、日志和系统设置管理接口页面。',
      '文档框架稳定：保留竞品文档的接口入口、权限、字段方向和检查清单结构。',
      '竞品平台信息已替换成 aiapi114，并补充权限、安全、审计、回滚和排查边界。',
    ],
  })
}

function createArticle(input: {
  slug: string
  categoryKey: 'advanced-usage' | 'faq' | 'api-reference'
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
    difficulty: input.categoryKey === 'faq' ? '排障' : '基础',
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
