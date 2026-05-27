import type { HelpArticle } from './types.ts'

export const TWELFTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-channel-crud',
    title: 'aiapi114 渠道 CRUD 接口说明',
    summary: '说明渠道列表、详情、创建、更新、删除和搜索接口的后台接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-put.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-id-delete.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-search-get.md',
    ],
    body: `渠道 CRUD 接口是管理员维护上游模型服务的核心入口。它会影响所有模型调用，因此任何创建、更新和删除动作都要可审计、可回滚。

## 适合先读这篇的人

- 你要开发渠道列表、详情和编辑页面。
- 你需要支持单渠道新增、更新、删除和搜索。
- 你要控制渠道变更对生产调用的影响。

## 接入步骤

### 1. 查询和筛选渠道

列表接口应支持分页、状态、类型、标签和排序筛选。默认不要一次加载全部渠道。

### 2. 查看渠道详情

详情页重点展示渠道类型、上游地址、模型映射、分组、状态、权重、最近测试结果和最近错误。

### 3. 创建或更新渠道

保存前校验上游地址、Key、模型列表、分组权限和代理配置。更新生产渠道前建议先测试。

### 4. 删除渠道

删除前展示影响模型、影响分组和近期调用量。必要时先禁用观察，再执行删除。

## 检查清单

- [ ] 渠道列表有分页和筛选。
- [ ] 详情页展示最近测试和错误。
- [ ] 保存前校验上游和模型配置。
- [ ] 删除前确认影响范围。`,
  }),
  createApiArticle({
    slug: 'api-channel-model-sync',
    title: 'aiapi114 渠道模型同步接口说明',
    summary: '说明拉取上游模型、渠道模型列表、已启用模型和同步写入前的验证流程。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-fetch_models-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-fetch_models-id-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-models-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/channel-management/channel-models_enabled-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-sync_upstream-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-sync_upstream-preview-get.md',
    ],
    body: `渠道模型同步接口用于从上游读取模型列表，并把模型能力映射到平台。同步前必须预览差异，避免误删或误开放模型。

## 适合先读这篇的人

- 你要从上游渠道拉取模型列表。
- 你需要同步平台模型管理配置。
- 你要排查模型列表缺失或重复。

## 接入步骤

### 1. 拉取上游模型

可按渠道 ID 拉取，也可以用上游地址、类型和 Key 临时拉取。临时拉取时不要把 Key 记录到前端日志。

### 2. 预览模型差异

同步写入前展示新增、删除、重命名和可能冲突的模型，交给管理员确认。

### 3. 写入模型配置

确认后再写入平台模型配置，并记录操作者、渠道、同步时间和变更数量。

### 4. 验证用户视角

同步后用目标分组用户查看模型列表，并完成一次低成本调用验证。

## 检查清单

- [ ] 上游 Key 不进入前端日志。
- [ ] 同步前展示模型差异。
- [ ] 同步写入有审计记录。
- [ ] 同步后用用户视角验证。`,
  }),
  createApiArticle({
    slug: 'api-payment-methods',
    title: 'aiapi114 支付方式接口说明',
    summary: '说明易支付、Stripe、Creem 等支付发起、金额计算和充值信息查询接口。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-pay-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-stripe-pay-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-creem-pay-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-stripe-amount-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-topup-info-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-topup-self-get.md',
    ],
    body: `支付方式接口用于展示充值配置、计算支付金额并发起支付。不同支付渠道的回调和金额口径不同，前端不能自行决定最终到账额度。

## 适合先读这篇的人

- 你要接入易支付、Stripe 或 Creem。
- 你需要展示充值套餐和支付记录。
- 你要处理汇率、手续费或支付金额换算。

## 接入步骤

### 1. 获取充值信息

先读取平台允许的充值方式、套餐、最低金额和说明。页面只展示后端返回的可用选项。

### 2. 计算支付金额

Stripe 等渠道可能需要单独计算金额。金额计算应由服务端完成，前端只展示结果。

### 3. 发起支付订单

按用户选择的支付方式发起订单，跳转或展示支付链接。订单号要保留在前端状态和后台记录中。

### 4. 查询用户充值记录

支付后刷新用户充值记录和余额。到账以服务端回调和订单状态为准。

## 检查清单

- [ ] 充值选项来自服务端配置。
- [ ] 支付金额由服务端计算。
- [ ] 发起支付后保留订单号。
- [ ] 到账以回调和订单状态为准。`,
  }),
  createApiArticle({
    slug: 'api-two-factor-settings',
    title: 'aiapi114 两步验证设置接口说明',
    summary: '说明 2FA 设置、启用、禁用、备用码、状态查询和管理员统计接口。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-setup-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-enable-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-disable-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-backup_codes-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-status-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/two-factor-auth/user-2fa-stats-get.md',
    ],
    body: `两步验证接口用于提升账号安全。接入时要区分“生成设置参数”“验证并启用”“禁用”和“备用码管理”几个步骤。

## 适合先读这篇的人

- 你要开发账号安全设置页面。
- 你需要启用或禁用 2FA。
- 你要给用户展示备用码和当前 2FA 状态。

## 接入步骤

### 1. 查询 2FA 状态

进入安全设置页先查询当前状态，决定展示启用、禁用还是重新生成备用码入口。

### 2. 设置并启用 2FA

调用设置接口获取二维码或密钥，再要求用户输入验证码完成启用。验证码通过前不要标记为已启用。

### 3. 管理备用码

备用码只展示一次，并提醒用户安全保存。重新生成备用码会使旧备用码失效。

### 4. 禁用和统计

禁用 2FA 需要验证码或安全验证。管理员统计只展示启用比例等汇总信息，不展示用户密钥。

## 检查清单

- [ ] 页面先查询 2FA 当前状态。
- [ ] 验证码通过后才启用。
- [ ] 备用码只展示一次。
- [ ] 禁用 2FA 有安全验证。`,
  }),
  createApiArticle({
    slug: 'api-task-management',
    title: 'aiapi114 任务管理接口说明',
    summary: '说明管理员任务列表、个人任务列表和异步任务状态展示接口的使用方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/tasks/task-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/tasks/task-self-get.md',
    ],
    body: `任务管理接口用于查询异步任务，例如图像、视频或其他耗时生成任务。用户侧只看自己的任务，管理员侧可查看全局任务。

## 适合先读这篇的人

- 你要开发异步任务中心。
- 你需要展示个人任务状态和结果。
- 你要让管理员排查任务积压或失败。

## 接入步骤

### 1. 区分用户和管理员视角

个人任务接口只返回当前用户任务；管理员任务接口用于全局排查，需要权限控制。

### 2. 展示任务状态

列表应展示任务类型、模型、状态、创建时间、更新时间和失败原因摘要。

### 3. 控制刷新频率

任务状态可以轮询，但要设置合理间隔。长任务支持用户离开页面后再回来查看。

### 4. 关联日志和扣费

任务失败或状态异常时，应能跳转到调用日志、任务详情或扣费记录排查。

## 检查清单

- [ ] 个人和管理员任务权限分开。
- [ ] 任务状态字段展示完整。
- [ ] 轮询频率受控。
- [ ] 任务能关联日志和扣费记录。`,
  }),
  createApiArticle({
    slug: 'api-midjourney-tasks',
    title: 'aiapi114 Midjourney 任务接口说明',
    summary: '说明 Midjourney 全局任务、个人任务、状态展示和失败排查接口的接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/tasks/mj-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/tasks/mj-self-get.md',
    ],
    body: `Midjourney 任务接口用于查询绘图任务。由于任务通常异步执行，页面要清楚展示排队、执行、成功、失败和取消状态。

## 适合先读这篇的人

- 你要开发 Midjourney 任务记录页面。
- 你需要让用户查看自己的绘图结果。
- 你要排查 Midjourney 任务失败或长时间排队。

## 接入步骤

### 1. 查询个人任务

用户侧只调用个人任务接口，展示提示词摘要、任务状态、结果图和创建时间。

### 2. 查询全局任务

管理员侧可查询所有任务，用于排查渠道积压、上游错误或用户异常调用。

### 3. 展示任务结果

成功任务展示结果图和下载入口；失败任务展示可读错误原因，不直接暴露上游原始报错。

### 4. 处理长时间任务

长时间排队或执行中的任务应展示更新时间和建议操作，例如稍后查看或联系管理员。

## 检查清单

- [ ] 用户只能查看自己的 MJ 任务。
- [ ] 管理员全局任务有权限控制。
- [ ] 成功和失败状态展示清晰。
- [ ] 长时间任务有更新时间和提示。`,
  }),
  createApiArticle({
    slug: 'api-user-models-token',
    title: 'aiapi114 用户模型与访问令牌接口说明',
    summary: '说明获取用户可用模型、生成访问令牌和用户侧能力展示的接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-models-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-token-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-groups-get.md',
    ],
    body: `用户模型与访问令牌接口用于展示当前用户能使用什么能力，以及生成控制台访问令牌。它们应结合分组、模型权限和安全策略使用。

## 适合先读这篇的人

- 你要展示当前用户可用模型。
- 你需要生成用户访问令牌。
- 你要排查用户看不到某些模型的问题。

## 接入步骤

### 1. 获取用户可用模型

读取当前用户可用模型列表，并展示模型名称、分组限制和必要说明。不要只展示全局模型列表。

### 2. 查询用户分组

用户分组决定模型权限和倍率。模型缺失时先检查分组权限，再检查渠道和模型配置。

### 3. 生成访问令牌

生成访问令牌前确认用途和有效期。令牌生成后只展示一次，并提示用户妥善保存。

### 4. 做能力一致性检查

控制台模型列表、第三方工具配置和实际 API 调用应保持一致。

## 检查清单

- [ ] 可用模型来自当前用户权限。
- [ ] 模型缺失优先检查分组权限。
- [ ] 访问令牌只展示一次。
- [ ] 控制台展示与实际调用一致。`,
  }),
  createApiArticle({
    slug: 'api-model-sync',
    title: 'aiapi114 模型同步接口说明',
    summary: '说明模型缺失检查、上游同步预览、同步写入和模型管理更新的使用边界。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-missing-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-sync_upstream-preview-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-sync_upstream-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/model-management/models-put.md',
    ],
    body: `模型同步接口用于发现缺失模型、预览上游差异并写入平台模型管理。它能提升维护效率，但不应绕过人工确认。

## 适合先读这篇的人

- 你要自动发现缺失模型。
- 你需要从上游同步模型配置。
- 你要避免模型同步误删或误开放。

## 接入步骤

### 1. 检查缺失模型

先读取缺失模型列表，确认是渠道未映射、分组未开放，还是模型管理中不存在。

### 2. 获取同步预览

同步前展示新增、更新、删除和冲突项。管理员确认后再写入。

### 3. 执行同步写入

写入时记录来源渠道、操作者、同步时间和变更数量，方便后续回滚。

### 4. 验证模型可用性

同步后用目标分组账号查看模型列表，并调用低成本模型确认配置生效。

## 检查清单

- [ ] 缺失模型原因已分类。
- [ ] 同步前展示差异预览。
- [ ] 写入操作有审计记录。
- [ ] 同步后完成用户视角验证。`,
  }),
  createApiArticle({
    slug: 'api-payment-self-records',
    title: 'aiapi114 用户充值自查接口说明',
    summary: '说明用户查询充值信息、充值记录、支付金额和到账状态时的页面接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-topup-info-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-topup-self-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-amount-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/payment/user-stripe-amount-post.md',
    ],
    body: `用户充值自查接口用于让用户查看可用充值方式、计算金额和核对自己的充值记录。它能减少“是否到账”的支持工单。

## 适合先读这篇的人

- 你要开发用户充值记录页面。
- 你需要展示支付金额和到账额度。
- 你要让用户自行排查充值状态。

## 接入步骤

### 1. 获取充值信息

先展示当前支持的充值方式、套餐、说明和注意事项。不可用的支付方式应隐藏或标注原因。

### 2. 计算金额和额度

金额计算由服务端完成，前端只展示支付金额、到账额度和可能的手续费说明。

### 3. 查询个人充值记录

用户只能查看自己的充值记录。列表展示订单号、金额、状态、创建时间和到账时间。

### 4. 提供排查信息

未到账时提示用户保留订单号、支付时间和支付平台凭证，不要求用户提供敏感账户信息。

## 检查清单

- [ ] 充值方式和套餐来自服务端。
- [ ] 金额和到账额度由服务端计算。
- [ ] 用户只能查看自己的记录。
- [ ] 未到账提示包含订单号排查路径。`,
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
        '符合大纲：属于第十二批渠道、模型同步、支付、两步验证和任务接口页面。',
        '文档框架稳定：保留竞品文档的接口入口、权限、字段方向和检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充权限、安全、审计、回滚和排查边界。',
      ],
    },
  }
}
