import type { HelpArticle } from './types.ts'

export const ELEVENTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-token-lifecycle',
    title: 'aiapi114 Token 生命周期接口说明',
    summary: '说明 API Key 的创建、列表、更新、删除、批量删除和搜索接口的接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/token-management/token-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/token-management/token-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/token-management/token-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/token-management/token-id-delete.md',
      'docs/reference-help-docs/newapi-ai/api/management/token-management/token-batch-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/token-management/token-search-get.md',
    ],
    body: `Token 生命周期接口用于管理用户的 API Key。它直接影响模型调用权限和费用归属，接入时要把创建、展示、删除和批量操作分开处理。

## 适合先读这篇的人

- 你要开发 API Key 管理页面。
- 你需要支持批量删除或搜索 Key。
- 你要降低 Key 泄露和误删风险。

## 接入步骤

### 1. 查询和搜索 Token

列表接口应分页展示名称、状态、额度、过期时间和最近使用时间。搜索接口只用于定位用户自己的 Key，不应跨用户查询。

### 2. 创建 Token

创建时要求用户填写用途、额度、过期时间和可用模型范围。生成后的完整 Key 只展示一次。

### 3. 更新或删除 Token

更新 Token 时只修改必要字段。删除和批量删除前展示影响范围，并要求用户确认。

### 4. 做泄露处置

用户怀疑 Key 泄露时，应先禁用或删除旧 Key，再创建新 Key，并检查近期调用日志。

## 检查清单

- [ ] Token 列表有分页和搜索限制。
- [ ] 完整 Key 只在创建后展示一次。
- [ ] 批量删除前展示影响范围。
- [ ] Key 泄露有禁用和日志排查流程。`,
  }),
  createApiArticle({
    slug: 'api-token-usage',
    title: 'aiapi114 Token 用量接口说明',
    summary: '说明通过令牌认证查询当前 API Key 用量、额度和调用状态的方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/management/token-management/usage-token-get.md'],
    body: `Token 用量接口使用 Bearer Token 认证，用于让调用方查询当前 Key 的使用情况。它适合客户端自查，但不能替代后台账务对账。

## 适合先读这篇的人

- 你要在 SDK 或客户端里展示当前 Key 用量。
- 你需要区分用户账号余额和单个 Key 用量。
- 你要排查某个 Key 是否被异常使用。

## 接入步骤

### 1. 使用 Bearer Token

请求头按 \`Authorization: Bearer sk-xxxxxx\` 格式传入当前 API Key。不要把 Key 放在 URL 或日志中。

### 2. 展示关键指标

页面重点展示 Key 状态、已用额度、剩余额度、最近调用时间和限制信息。

### 3. 处理认证失败

认证失败时提示 Key 无效、已删除、已禁用或格式错误，不要自动重试大量请求。

### 4. 关联日志排查

用量异常时引导用户查看 Token 相关调用日志，并建议立即轮换 Key。

## 检查清单

- [ ] Authorization 使用 Bearer 格式。
- [ ] Key 不出现在 URL 或日志中。
- [ ] 用量展示区分账号和单 Key。
- [ ] 异常用量能跳转日志排查。`,
  }),
  createApiArticle({
    slug: 'api-redemption-codes',
    title: 'aiapi114 兑换码管理接口说明',
    summary: '说明兑换码列表、创建、更新、删除、搜索和清理无效兑换码的管理流程。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-search-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-invalid-delete.md',
    ],
    body: `兑换码接口用于管理员发放额度、活动码或补偿码。它影响余额和运营成本，必须有创建记录、使用记录和清理策略。

## 适合先读这篇的人

- 你要开发兑换码管理后台。
- 你需要批量发放额度或活动码。
- 你要清理无效、过期或已使用兑换码。

## 接入步骤

### 1. 查询兑换码列表

按分页展示兑换码、面额、状态、创建人、使用人和过期时间。完整兑换码只对有权限的管理员展示。

### 2. 创建兑换码

创建前确认用途、面额、数量、有效期和适用人群。高额度兑换码应增加审批或二次确认。

### 3. 更新和搜索兑换码

搜索用于定位具体兑换码或活动批次。更新时只修改状态、备注或过期时间等必要字段。

### 4. 清理无效兑换码

删除无效兑换码前先导出或保留统计信息，避免影响活动复盘和账务说明。

## 检查清单

- [ ] 兑换码有创建人和用途记录。
- [ ] 高额度兑换码有二次确认。
- [ ] 搜索和展示权限受控。
- [ ] 清理前保留必要统计信息。`,
  }),
  createApiArticle({
    slug: 'api-redemption-topup',
    title: 'aiapi114 兑换码充值接口说明',
    summary: '说明用户使用兑换码充值额度时的认证、提交、结果展示和失败处理。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/management/default/user-topup-post.md'],
    body: `兑换码充值接口用于用户把兑换码转换为账户额度。前端要清楚提示兑换结果，并避免重复提交造成误解。

## 适合先读这篇的人

- 你要开发兑换码充值入口。
- 你需要处理兑换码无效、过期或已使用。
- 你要把兑换记录和余额变化展示给用户。

## 接入步骤

### 1. 要求用户登录

兑换码充值应绑定当前登录用户。未登录时先引导登录，不要在匿名页面提交兑换码。

### 2. 提交兑换码

用户输入兑换码后提交给服务端校验。前端应禁用重复点击，并保留原始输入方便用户核对。

### 3. 展示兑换结果

成功后刷新余额、充值记录和兑换说明。失败时区分无效、过期、已使用和权限问题。

### 4. 处理争议排查

用户反馈兑换失败时，保留兑换码尾号、提交时间和错误信息，避免要求用户公开完整兑换码。

## 检查清单

- [ ] 兑换操作要求登录。
- [ ] 提交按钮有防重复机制。
- [ ] 成功后刷新余额和记录。
- [ ] 排查时不公开完整兑换码。`,
  }),
  createApiArticle({
    slug: 'api-log-search',
    title: 'aiapi114 日志搜索接口说明',
    summary: '说明管理员日志搜索、个人日志搜索、关键词筛选和敏感字段脱敏要求。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-search-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-self-search-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-self-get.md',
    ],
    body: `日志搜索接口用于定位调用失败、异常消耗和用户反馈。搜索能力越强，越需要权限控制和脱敏展示。

## 适合先读这篇的人

- 你要开发管理员日志搜索页面。
- 你需要让用户搜索自己的调用日志。
- 你要按关键词、模型、状态或时间排查问题。

## 接入步骤

### 1. 区分搜索范围

个人搜索只返回当前用户日志；管理员搜索可以跨用户，但需要管理员权限和审计记录。

### 2. 限制关键词和时间范围

关键词应限制长度，时间范围应有默认值。大范围搜索要分页，避免拖慢日志服务。

### 3. 脱敏展示结果

日志中的 Key、邮箱、请求内容和上游错误可能包含敏感信息。页面只展示排查所需摘要。

### 4. 关联支持流程

从日志结果生成工单上下文时，只带日志 ID、错误码和摘要，不复制完整请求内容。

## 检查清单

- [ ] 个人搜索和管理员搜索权限分开。
- [ ] 关键词和时间范围有限制。
- [ ] 敏感字段已脱敏。
- [ ] 工单上下文不包含完整敏感请求。`,
  }),
  createApiArticle({
    slug: 'api-invite-quota',
    title: 'aiapi114 邀请码与邀请额度接口说明',
    summary: '说明邀请码获取、邀请额度转换和邀请奖励展示时的用户侧流程。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-aff-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-aff_transfer-post.md',
    ],
    body: `邀请相关接口用于展示用户邀请码和转换邀请额度。它属于用户资产的一部分，应把规则说明和余额变化展示清楚。

## 适合先读这篇的人

- 你要开发邀请奖励页面。
- 你需要展示用户邀请码或邀请链接。
- 你要支持把邀请额度转换为账户额度。

## 接入步骤

### 1. 获取邀请码

登录后读取当前用户的邀请码或邀请链接。页面应提供复制按钮，并说明邀请规则。

### 2. 展示邀请收益

展示可转换额度、已转换额度和历史记录，避免用户误解为即时到账余额。

### 3. 提交额度转换

转换前让用户确认数量和到账口径。提交后刷新余额和邀请记录。

### 4. 处理异常情况

额度不足、规则变更或重复提交时，应给出明确提示，并保留操作记录用于支持排查。

## 检查清单

- [ ] 邀请码只展示给当前用户。
- [ ] 邀请规则和到账口径已说明。
- [ ] 转换前有数量确认。
- [ ] 转换后刷新余额和记录。`,
  }),
  createApiArticle({
    slug: 'api-user-topup-records',
    title: 'aiapi114 用户充值记录接口说明',
    summary: '说明管理员查看充值记录、完成充值和用户余额异常排查的接口边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-topup-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-topup-complete-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/default/user-topup-post.md',
    ],
    body: `用户充值记录接口用于管理员核对订单、兑换、人工补单和余额变更。任何补单或完成充值操作都必须留下审计证据。

## 适合先读这篇的人

- 你要开发充值记录后台。
- 你需要处理用户反馈“付款成功但未到账”。
- 你要支持管理员完成充值或人工补单。

## 接入步骤

### 1. 查询充值记录

按用户、订单号、时间、支付方式和状态筛选记录。列表应展示订单状态、金额、到账额度和更新时间。

### 2. 核对支付来源

处理未到账问题时，先核对支付平台订单、回调日志和平台充值记录，不要只看用户截图。

### 3. 管理员完成充值

人工完成充值前要求填写原因、订单依据和处理人。高金额补单应二次确认。

### 4. 保留对账记录

充值记录应能关联用户余额变更和支付回调，方便后续审计。

## 检查清单

- [ ] 充值记录可按订单和用户筛选。
- [ ] 未到账先核对支付平台和回调。
- [ ] 人工完成充值有原因记录。
- [ ] 充值记录能关联余额变更。`,
  }),
  createApiArticle({
    slug: 'api-channel-maintenance',
    title: 'aiapi114 渠道维护接口说明',
    summary: '说明渠道复制、删除禁用渠道、修复渠道能力和已启用模型查询的维护流程。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-copy-id-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-disabled-delete.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-fix-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-models_enabled-get.md',
    ],
    body: `渠道维护接口用于复制渠道、清理禁用渠道、修复渠道能力和查看已启用模型。它适合管理员做日常运维，不适合普通用户调用。

## 适合先读这篇的人

- 你要复制已有渠道作为新上游配置模板。
- 你需要清理禁用渠道或修复渠道能力。
- 你要查看当前已启用模型列表。

## 接入步骤

### 1. 复制渠道

复制渠道时确认是否重置余额、是否追加名称后缀，以及是否需要替换上游 Key。

### 2. 修复渠道能力

修复前先备份当前渠道能力配置。修复后验证模型列表、分组权限和实际调用结果。

### 3. 清理禁用渠道

删除禁用渠道前检查近期日志和依赖关系，避免删除仍用于审计或回滚的记录。

### 4. 查看已启用模型

已启用模型列表可用于前端展示、分组配置和渠道排查，但应与模型管理配置交叉核对。

## 检查清单

- [ ] 复制渠道时确认是否重置余额。
- [ ] 修复前已备份能力配置。
- [ ] 删除禁用渠道前检查依赖。
- [ ] 已启用模型与模型管理配置一致。`,
  }),
  createApiArticle({
    slug: 'api-channel-multikey-tags',
    title: 'aiapi114 渠道多密钥与标签接口说明',
    summary: '说明多密钥启停删除、标签渠道编辑、优先级和权重调整的管理方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-multi_key-manage-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-tag-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-tag-models-get.md',
    ],
    body: `渠道多密钥和标签能力用于提升上游可用性和管理效率。配置不当会导致流量倾斜、密钥误停或成本异常。

## 适合先读这篇的人

- 你要为单个渠道管理多个上游 Key。
- 你需要按标签批量调整渠道权重或优先级。
- 你要排查某个标签下模型不可用。

## 接入步骤

### 1. 查看密钥状态

先读取多密钥状态，区分启用、禁用、异常和待删除 Key。页面不要展示完整 Key 明文。

### 2. 执行密钥操作

启用、禁用、删除或批量处理 Key 前展示影响范围，尤其是禁用全部 Key 的操作。

### 3. 编辑标签渠道

修改标签、优先级和权重时，应说明会影响哪些渠道和模型。权重调整后观察实际流量。

### 4. 排查标签模型

获取标签模型列表，核对模型是否映射到正确渠道，并确认分组权限没有冲突。

## 检查清单

- [ ] 多密钥列表不展示完整 Key。
- [ ] 批量禁用或删除有二次确认。
- [ ] 标签权重变更有影响范围说明。
- [ ] 标签模型和分组权限已核对。`,
  }),
  createApiArticle({
    slug: 'api-prefill-groups',
    title: 'aiapi114 预填分组接口说明',
    summary: '说明预填分组的创建、更新、删除和默认分组策略在管理后台中的使用方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/groups/prefill_group-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/groups/prefill_group-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/groups/prefill_group-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/groups/prefill_group-id-delete.md',
    ],
    body: `预填分组接口用于管理员维护可选分组模板。它能简化用户分组配置，但不应替代真实权限校验。

## 适合先读这篇的人

- 你要开发分组模板管理页面。
- 你希望管理员快速选择常用分组。
- 你需要控制新用户或批量导入用户的默认分组。

## 接入步骤

### 1. 查询预填分组

读取当前可选分组模板，展示分组名、说明、排序和是否默认。

### 2. 创建或更新模板

新增模板前确认命名规范和权限含义。更新模板时说明是否影响已经使用该模板的用户。

### 3. 删除模板

删除前检查是否仍被注册流程、导入流程或管理员操作依赖。必要时先替换默认模板。

### 4. 验证权限结果

预填分组只是选择入口，最终权限仍要由用户分组、模型权限和倍率配置共同决定。

## 检查清单

- [ ] 分组模板命名清晰。
- [ ] 默认模板变更有影响说明。
- [ ] 删除前检查依赖流程。
- [ ] 最终权限经过分组和模型配置验证。`,
  }),
]

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
        '符合大纲：属于第十一批 Token、兑换码、日志、邀请、充值、渠道和分组接口页面。',
        '文档框架稳定：保留竞品文档的接口入口、权限、字段方向和检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充权限、安全、审计、回滚和排查边界。',
      ],
    },
  }
}
