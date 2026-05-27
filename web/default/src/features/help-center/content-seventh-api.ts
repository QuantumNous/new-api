import type { HelpArticle } from './types.ts'

export const SEVENTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'api-files',
    title: 'aiapi114 Files 接口说明',
    summary: '说明文件上传、列表、下载、删除等接口的使用边界和安全注意事项。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/files/createfile.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/files/listfiles.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/files/retrievefile.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/files/deletefile.md',
    ],
    body: `Files 接口用于管理模型任务相关文件。不同模型对文件用途、大小和保留时间支持不同，接入前应先确认平台当前开放范围。

## 适合先读这篇的人

- 你需要上传文件给模型任务使用。
- 你要查询、下载或删除已上传文件。
- 你不确定文件接口是否适合生产业务。

## 接入步骤

### 1. 确认可用范围

先查看 aiapi114 当前接口说明和模型能力，确认文件上传、下载、删除是否开放。

### 2. 控制文件内容

不要上传无关日志、敏感个人信息或超出模型需要的原始文件。必要时先脱敏。

### 3. 保存文件 ID

上传成功后保存文件 ID、用途、创建时间和关联任务，方便后续查询或删除。

### 4. 定期清理

不再使用的文件应按业务规则删除，避免长期留存敏感数据。

## 检查清单

- [ ] 已确认当前模型支持文件接口。
- [ ] 上传前已做内容最小化和脱敏。
- [ ] 文件 ID 与业务任务有关联记录。
- [ ] 不再使用的文件有清理策略。`,
  }),
  createArticle({
    slug: 'api-management-auth',
    title: 'aiapi114 管理接口认证说明',
    summary: '说明管理类接口的认证方式、权限边界和调用安全要求。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/api/management/auth.md'],
    body: `管理接口用于站点配置、用户、渠道、日志等后台能力。它的权限高于普通模型调用接口，应只由可信后端或管理工具调用。

## 适合先读这篇的人

- 你要开发内部管理工具。
- 你需要调用用户、渠道或系统设置接口。
- 你想区分模型 API Key 和后台管理凭据。

## 接入步骤

### 1. 明确凭据类型

模型调用 Key 只用于模型接口；管理接口需要登录态、管理员凭据或平台定义的管理认证方式。

### 2. 限制调用环境

管理接口不要直接暴露给浏览器或第三方客户端。应通过后端服务代理并做权限校验。

### 3. 做操作审计

写入类操作需要记录操作者、时间、目标对象和变更原因。

### 4. 处理权限失败

收到 401 或 403 时，不要自动重试高风险操作，应提示重新登录或联系管理员。

## 检查清单

- [ ] 已区分模型 API Key 和管理凭据。
- [ ] 管理接口只在可信环境调用。
- [ ] 写入类操作有审计记录。
- [ ] 权限失败不会触发无限重试。`,
  }),
  createArticle({
    slug: 'api-management-channels',
    title: 'aiapi114 渠道管理接口说明',
    summary: '说明渠道列表、创建、测试、启停和模型同步接口的使用方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-test-id-get.md',
    ],
    body: `渠道管理接口会影响模型上游可用性。调用这类接口前，应先确认操作范围，避免误停生产渠道。

## 适合先读这篇的人

- 你要开发渠道管理后台或自动化工具。
- 你需要批量测试、启停或同步渠道模型。
- 你想把渠道变更纳入审计流程。

## 接入步骤

### 1. 查询渠道列表

按分页读取渠道，展示渠道名称、类型、状态、分组、模型和最近测试结果。

### 2. 创建或更新渠道

写入上游密钥、代理、模型映射和分组时，应先在测试环境验证。

### 3. 测试渠道

上线前调用测试接口，确认认证、模型映射和响应格式正常。

### 4. 控制启停风险

禁用或批量修改渠道前，先确认影响模型和影响用户范围。

## 检查清单

- [ ] 写入操作只允许管理员执行。
- [ ] 新渠道上线前已测试。
- [ ] 批量启停前已确认影响范围。
- [ ] 渠道密钥不会返回给普通前端。`,
  }),
  createArticle({
    slug: 'api-management-users',
    title: 'aiapi114 用户管理接口说明',
    summary: '说明用户查询、分组、余额、状态变更和账号安全接口的管理边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-search-get.md',
    ],
    body: `用户管理接口涉及账号、余额、分组和权限。任何写入操作都应最小化变更，并保留审计记录。

## 适合先读这篇的人

- 你要在后台查询或管理用户。
- 你需要调整用户分组、余额或状态。
- 你要处理账号异常、封禁或恢复。

## 接入步骤

### 1. 查询用户

按用户 ID、邮箱、用户名或其他平台支持的字段搜索。列表中避免展示不必要隐私。

### 2. 查看关键状态

关注用户分组、余额、Key 数量、状态和最近调用记录。

### 3. 执行最小变更

只修改当前问题需要的字段，例如分组、状态或余额备注，不要批量覆盖无关字段。

### 4. 记录审计信息

记录操作者、目标用户、变更字段、原因和时间。

## 检查清单

- [ ] 用户管理接口有权限校验。
- [ ] 页面不展示不必要隐私字段。
- [ ] 写入操作最小化。
- [ ] 所有高风险变更都有审计记录。`,
  }),
  createArticle({
    slug: 'api-management-logs',
    title: 'aiapi114 日志管理接口说明',
    summary: '说明日志查询、筛选、统计和排查接口的使用方式与脱敏边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-search-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/logs/log-stat-get.md',
    ],
    body: `日志管理接口用于排查调用失败、异常消耗和系统问题。日志可能包含用户标识和请求信息，应控制访问权限。

## 适合先读这篇的人

- 你要做日志查询或统计页面。
- 你需要按时间、模型、用户或状态码排查问题。
- 你想把日志数据用于支持工单。

## 接入步骤

### 1. 使用分页和筛选

日志数据量通常较大，应按时间范围、用户、Key、模型和状态码筛选。

### 2. 控制返回字段

普通排查只需要错误码、时间、模型、消耗和请求 ID，不应返回完整密钥或敏感原文。

### 3. 做统计汇总

按模型、渠道、状态码和时间聚合，帮助判断是单点问题还是整体波动。

### 4. 保护日志导出

导出日志前应脱敏，并限制下载权限和保留时间。

## 检查清单

- [ ] 日志查询默认带时间范围。
- [ ] 返回结果不包含完整 API Key。
- [ ] 统计维度能支持排查。
- [ ] 日志导出已脱敏。`,
  }),
  createArticle({
    slug: 'api-management-payments',
    title: 'aiapi114 支付管理接口说明',
    summary: '说明支付、充值、金额计算、回调和订单核对接口的使用边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-pay-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-topup-info-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-topup-self-get.md',
    ],
    body: `支付管理接口涉及资金与余额变更。接入时必须保证签名校验、订单幂等和到账核对完整。

## 适合先读这篇的人

- 你要开发充值或订单页面。
- 你需要处理支付回调和余额到账。
- 你要排查订单支付成功但余额未更新。

## 接入步骤

### 1. 创建订单

订单应包含用户、金额、渠道、订单号和过期时间。金额必须由服务端计算。

### 2. 校验回调

支付回调必须校验签名、订单状态和金额，避免重复到账或伪造请求。

### 3. 做幂等处理

同一订单重复回调时只能入账一次，并记录每次回调日志。

### 4. 核对余额

支付成功后核对支付渠道流水、平台订单和用户钱包记录。

## 检查清单

- [ ] 金额由服务端计算。
- [ ] 回调已校验签名和金额。
- [ ] 订单入账具备幂等保护。
- [ ] 异常订单能按流水追踪。`,
  }),
  createArticle({
    slug: 'api-management-redemptions',
    title: 'aiapi114 兑换码管理接口说明',
    summary: '说明兑换码列表、创建、查询、失效和核销接口的管理要求。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/redemption/redemption-id-delete.md',
    ],
    body: `兑换码接口适合活动、补偿和授权场景。它会影响用户余额或权益，应限制管理员权限并记录发放批次。

## 适合先读这篇的人

- 你要开发兑换码管理功能。
- 你需要批量创建或作废兑换码。
- 你要查询用户兑换记录。

## 接入步骤

### 1. 创建兑换码批次

设置额度、数量、有效期和使用范围。批量生成前先用小批次测试。

### 2. 查询和筛选

按批次、状态、用户或兑换码筛选，避免一次返回过多记录。

### 3. 作废异常兑换码

发现泄露或发放错误时，及时作废未使用兑换码，并记录原因。

### 4. 对账核销记录

兑换后核对用户余额、兑换时间和兑换码状态。

## 检查清单

- [ ] 创建接口只允许管理员调用。
- [ ] 兑换码有有效期和额度限制。
- [ ] 作废操作记录原因。
- [ ] 核销记录可追踪到用户和批次。`,
  }),
  createArticle({
    slug: 'api-management-system',
    title: 'aiapi114 系统管理接口说明',
    summary: '说明系统状态、公告、模型、价格和设置类接口的使用边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/system/status-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/models-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system/pricing-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/system-settings/option-get.md',
    ],
    body: `系统管理接口用于读取或修改全站配置，例如系统状态、公告、模型、价格和设置项。写入类接口应严格限制权限。

## 适合先读这篇的人

- 你要开发系统设置或状态展示页面。
- 你需要读取模型、价格或公告信息。
- 你准备修改全站配置项。

## 接入步骤

### 1. 区分读取和写入

状态、模型和价格读取可以用于前台展示；设置修改只能在管理员后台进行。

### 2. 缓存低频数据

模型列表、价格和公告可适度缓存，但状态和故障信息应保持较短缓存时间。

### 3. 修改设置前备份

写入系统设置前记录原值、变更原因和回滚方式。

### 4. 修改后验证

保存后验证前台展示、登录、模型调用和计费是否受影响。

## 检查清单

- [ ] 读取接口和写入接口权限已分离。
- [ ] 低频数据有合理缓存。
- [ ] 设置变更前记录原值。
- [ ] 修改后完成关键链路验证。`,
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
        '符合大纲：属于第七批平台 API 与管理 API 页面。',
        '文档框架稳定：保留竞品文档的接口入口、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充权限、安全、审计和幂等边界。',
      ],
    },
  }
}

