import type { HelpArticle } from './types.ts'

export const FOURTEENTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createAdvancedArticle({
    slug: 'console-channel-operations',
    title: 'aiapi114 控制台渠道运维操作指南',
    summary: '说明管理员在控制台创建、编辑、测试、复制和维护渠道时的操作顺序，重点处理参数覆盖与高风险配置。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/console/channel-management.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/system-setting-advanced.md',
    ],
    body: `渠道是 aiapi114 转发模型请求的核心配置。控制台中的渠道操作不只是填写上游 Key，还包括模型映射、分组、倍率、权重、参数覆盖和可用性测试。

## 适合先读这篇的人

- 你要在控制台新增或编辑上游渠道。
- 你需要配置参数覆盖、模型映射或渠道权重。
- 你正在排查渠道测试通过但实际调用失败的问题。

## 操作步骤

### 1. 创建前准备信息

先准备上游地址、上游 Key、支持模型、供应商类型、计费方式和适用分组。不要在没有授权的情况下接入第三方上游。

### 2. 配置基础字段

填写渠道名称、类型、Base URL、模型列表、分组和状态。生产渠道建议先保持较低权重，测试稳定后再提高流量占比。

### 3. 配置参数覆盖

参数覆盖用于兼容上游格式或规范请求字段。简单覆盖适合固定字段，高级操作适合按模型、消息内容或字段存在性做条件处理。

### 4. 测试并观察日志

保存后先执行渠道测试，再用目标分组的普通用户完成一次低成本调用。测试失败时查看上游错误、模型映射和分组权限。

## 检查清单

- [ ] 上游账号和 Key 来源合法授权。
- [ ] 渠道模型、分组、权重和倍率已核对。
- [ ] 参数覆盖只用于兼容和规范化请求。
- [ ] 保存后已完成渠道测试和真实调用验证。`,
  }),
  createAdvancedArticle({
    slug: 'console-user-operations',
    title: 'aiapi114 控制台用户管理操作指南',
    summary: '说明管理员在控制台查看、搜索、调整、封禁和支持用户时的操作顺序，避免把用户管理当作简单表格编辑。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/console/user-management.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-management/user-search-get.md',
    ],
    body: `用户管理页用于处理注册用户、余额、分组、状态和支持请求。管理员操作用户数据时，应优先保证身份准确、权限最小、变更可审计。

## 适合先读这篇的人

- 你要在控制台管理注册用户。
- 你需要调整用户分组、状态、余额或备注。
- 你要排查用户反馈的登录、额度或模型权限问题。

## 操作步骤

### 1. 先定位目标用户

使用用户 ID、邮箱、用户名或备注搜索用户。操作前核对至少两个身份信息，避免改错账号。

### 2. 查看关键状态

重点查看用户分组、余额、状态、Token 数量、最近登录和最近调用摘要。不要在列表页暴露过多隐私字段。

### 3. 执行变更操作

调整分组、状态或备注时，只提交需要变化的字段。涉及封禁、恢复、余额或安全设置时，要求填写原因。

### 4. 回到用户视角验证

如果变更影响模型权限、余额或登录方式，应从用户视角确认控制台展示和实际 API 调用结果一致。

## 检查清单

- [ ] 操作前已确认目标用户身份。
- [ ] 用户详情展示分组、余额、状态和最近活动。
- [ ] 高风险变更填写原因并可审计。
- [ ] 变更后已用用户视角验证结果。`,
  }),
  createAdvancedArticle({
    slug: 'console-system-settings-overview',
    title: 'aiapi114 控制台系统设置总览',
    summary: '说明模型设置、运营设置、系统设置和高级设置的维护顺序，帮助管理员减少全局配置误操作。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/console/settings/model-settings.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/system-setting.md',
      'docs/reference-help-docs/newapi-ai/guide/feature-guide/admin/system-setting-advanced.md',
    ],
    body: `系统设置会影响全站登录、模型请求、计费、运营展示和安全策略。新管理员不应一次性修改大量配置，而应按“读取现状、备份、单项调整、验证”的顺序推进。

## 适合先读这篇的人

- 你第一次维护 aiapi114 的后台系统设置。
- 你要调整模型请求透传、连接保活或特定模型配置。
- 你需要修改运营、支付、倍率、公告或高级开关。

## 操作步骤

### 1. 先读取当前配置

修改前记录当前设置，尤其是模型倍率、支付、登录方式、请求透传、连接保活和安全开关。

### 2. 按影响范围分批修改

优先处理单项配置。不要同时修改登录、支付、模型和渠道设置，否则失败后难以定位原因。

### 3. 配置模型相关能力

模型相关设置用于控制请求透传、连接保活和特定模型行为。修改后要用不同模型分别验证。

### 4. 保存后做回归检查

保存后检查登录、模型列表、API 调用、充值、公告和日志。发现异常时回滚到修改前配置。

## 检查清单

- [ ] 修改前已保存当前配置快照。
- [ ] 本次只修改一个明确范围的设置。
- [ ] 模型相关设置已用实际调用验证。
- [ ] 保存后已检查登录、调用、支付和日志链路。`,
  }),
  createAdvancedArticle({
    slug: 'console-release-notes',
    title: 'aiapi114 更新日志阅读与升级判断',
    summary: '说明管理员如何阅读版本更新日志，判断新功能、修复、破坏性变更和升级前后验证重点。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/guide/wiki/changelog.md',
      'docs/reference-help-docs/newapi-ai/guide/wiki/project-records/changelog.md',
    ],
    body: `更新日志不是简单的版本列表。对 aiapi114 管理员来说，它应该帮助判断是否升级、何时升级、升级前备份什么、升级后验证哪些链路。

## 适合先读这篇的人

- 你负责评估 aiapi114 升级风险。
- 你需要向团队说明某次升级会影响哪些功能。
- 你要根据更新日志制定升级后的验证清单。

## 操作步骤

### 1. 先看版本类型

区分正式版、候选版、补丁版和测试版。生产环境优先选择稳定版本，不要只因为有新功能就立即升级。

### 2. 识别关键变更

重点关注新功能、Bug 修复、改进项和破坏性变更。涉及支付、计费、渠道、登录和模型转发的更新，应提高验证级别。

### 3. 制定升级前检查

升级前备份数据库、配置、环境变量和当前镜像版本。记录回滚方式和负责人。

### 4. 执行升级后验证

升级后验证登录、控制台、模型列表、API 调用、充值、日志、渠道测试和常用第三方工具配置。

## 检查清单

- [ ] 已区分当前版本是否适合生产升级。
- [ ] 已识别新功能、修复和破坏性变更。
- [ ] 升级前已备份数据库、配置和镜像版本。
- [ ] 升级后已验证核心业务链路。`,
  }),
]

export const FOURTEENTH_BATCH_API_ARTICLES: HelpArticle[] = [
  createApiArticle({
    slug: 'api-user-auth-recovery',
    title: 'aiapi114 用户认证恢复接口说明',
    summary: '说明密码重置、验证码获取、用户认证恢复和异常登录处理接口的接入方式。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/reset_password-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/verification-get.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-passkey-login-begin-post.md',
      'docs/reference-help-docs/newapi-ai/api/management/user-auth/user-passkey-login-finish-post.md',
    ],
    body: `用户认证恢复接口用于处理忘记密码、验证码、Passkey 登录和登录异常。它们直接关系到账户安全，接入时要限制频率、隐藏敏感结果，并保留审计线索。

## 适合先读这篇的人

- 你要开发忘记密码或验证码入口。
- 你需要支持 Passkey 登录恢复流程。
- 你要排查用户无法登录、验证码无效或认证失败问题。

## 接入步骤

### 1. 发起验证码或重置流程

用户提交邮箱或账号标识后，页面只提示“如账号存在将发送指引”，不要暴露账号是否注册。

### 2. 校验验证码和重置凭据

验证码、重置链接和 Passkey 挑战都应由服务端生成并设置有效期。前端不要自行生成或复用挑战参数。

### 3. 控制重试和频率

对验证码发送、密码重置和登录失败设置频率限制。连续失败时提示稍后重试或联系管理员。

### 4. 完成后清理旧状态

重置密码或完成 Passkey 登录后，清理旧登录状态，并提醒用户检查 API Key 和最近登录记录。

## 检查清单

- [ ] 认证恢复入口不暴露账号是否存在。
- [ ] 验证码和挑战参数由服务端生成。
- [ ] 登录和验证码失败有频率限制。
- [ ] 恢复完成后清理旧状态并提示安全检查。`,
  }),
  createApiArticle({
    slug: 'api-specialized-model-endpoints',
    title: 'aiapi114 特殊模型接口接入说明',
    summary: '说明低频或专用模型接口的接入原则，包括 Gemini 音频、消息创建、Kling 图生视频和未实现接口提示。',
    sourceBasis: [
      'docs/reference-help-docs/newapi-ai/api/ai-model/audio/geminirelayv1beta-383836364.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/chat/createmessage.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/videos/kling/getklingimage2video.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/files/downloadfile.md',
      'docs/reference-help-docs/newapi-ai/api/ai-model/unimplemented/fine-tuning/listfinetuneevents.md',
    ],
    body: `特殊模型接口通常不是新手第一天就会用到的能力，但它们会影响高级接入的完整性。帮助中心应说明哪些接口可用、哪些接口依赖上游、哪些接口暂不实现。

## 适合先读这篇的人

- 你要接入 Gemini 音频、消息创建或 Kling 图生视频能力。
- 你正在整理平台 API 能力边界。
- 你需要给用户解释某些文件或 Fine-tuning 事件接口为什么暂不可用。

## 接入步骤

### 1. 确认接口是否已开放

先查看模型列表和 API 文档，确认目标接口是否在 aiapi114 当前部署中开放。未开放接口不要在客户端写死入口。

### 2. 核对上游能力

特殊接口通常依赖特定上游供应商、模型名和请求格式。接入前确认渠道支持对应能力，并完成一次低成本测试。

### 3. 处理异步和媒体结果

音频、图生视频和文件类接口可能返回任务、媒体地址或下载结果。页面应区分提交成功、生成中、失败和结果可用。

### 4. 给出未实现提示

对于暂未实现的接口，应返回明确提示，说明当前不可用和替代路径，避免用户误以为是 Key、余额或模型配置错误。

## 检查清单

- [ ] 客户端只展示当前部署已开放的特殊接口。
- [ ] 已确认上游渠道支持对应模型能力。
- [ ] 媒体和异步结果有状态展示。
- [ ] 未实现接口有明确说明和替代路径。`,
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
      '符合大纲：属于第十四批控制台渠道、用户、系统设置和更新日志操作页面。',
      '文档框架稳定：保留竞品控制台说明和更新日志结构，去除图片、导航和发布页噪声后整理为管理员操作流程。',
      '竞品平台信息已替换成 aiapi114，并补充新手视角、风险提示、验证步骤和检查清单。',
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
      '符合大纲：属于第十四批认证恢复与特殊模型接口页面。',
      '文档框架稳定：保留竞品接口文档的入口、权限、状态和检查清单结构，并合并低频同方向接口。',
      '竞品平台信息已替换成 aiapi114，并补充认证安全、频率限制、异步媒体状态和未实现接口边界。',
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
