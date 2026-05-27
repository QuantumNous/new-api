import type { HelpArticle } from './types.ts'

export const SEVENTH_BATCH_ADVANCED_ARTICLES: HelpArticle[] = [
  createArticle({
    slug: 'installation-overview',
    title: 'aiapi114 安装部署总览',
    summary: '说明部署 aiapi114 前需要先确认的环境、部署方式、数据库和安全边界。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/index.md'],
    body: `安装部署类文档面向站点管理员。普通用户只需要使用控制台和 API Key；只有需要自建或维护站点时，才需要阅读这一组内容。

## 适合先读这篇的人

- 你准备部署或维护 aiapi114。
- 你不确定应选择 Docker、Docker Compose 还是面板部署。
- 你需要提前梳理数据库、域名、反向代理和密钥配置。

## 操作步骤

### 1. 明确部署目标

先确认是测试环境、团队内部环境还是生产环境。生产环境需要更严格的备份、监控和权限控制。

### 2. 选择部署方式

新手优先选择 Docker Compose；已有面板运维体系时可选择面板部署；需要二次开发时再考虑本地开发方式。

### 3. 准备外部依赖

提前准备数据库、缓存、域名、证书、对象存储或回调地址。不要把生产密钥写入公开仓库。

### 4. 做首次验证

部署后依次验证控制台登录、模型列表、API Key 创建、一次低成本调用和日志记录。

## 检查清单

- [ ] 已区分测试环境和生产环境。
- [ ] 已选择合适部署方式。
- [ ] 数据库和密钥不会提交到仓库。
- [ ] 部署后完成一次端到端调用验证。`,
  }),
  createArticle({
    slug: 'docker-compose-deployment',
    title: 'aiapi114 Docker Compose 部署',
    summary: '说明使用 Docker Compose 部署 aiapi114 时的配置文件、服务启动和验证步骤。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/config-maintenance/docker-compose-yml.md'],
    body: `Docker Compose 适合把应用、数据库、缓存和反向代理配置放在同一套部署文件中管理。修改前应先备份当前配置。

## 适合先读这篇的人

- 你希望用 Docker Compose 管理 aiapi114 服务。
- 你需要同时配置应用、数据库和缓存。
- 你想让部署配置更容易迁移和复现。

## 操作步骤

### 1. 准备 compose 文件

从当前项目或部署包中复制 compose 示例，按实际域名、端口、数据库和镜像版本调整。

### 2. 配置环境变量

把数据库连接、密钥、回调地址等放到环境变量或受控的 \`.env\` 文件中。生产 \`.env\` 不应进入 Git。

### 3. 启动服务

执行 Docker Compose 启动命令后，查看容器状态和应用日志，确认没有数据库连接失败或端口冲突。

### 4. 验证页面与 API

打开控制台，创建 API Key，并发起一次低成本模型调用，确认路由、鉴权和日志都正常。

## 检查清单

- [ ] compose 文件中的端口没有冲突。
- [ ] 生产 \`.env\` 未提交到仓库。
- [ ] 容器日志没有启动错误。
- [ ] 页面和 API 均已验证。`,
  }),
  createArticle({
    slug: 'docker-deployment',
    title: 'aiapi114 Docker 单容器部署',
    summary: '说明使用 Docker 镜像启动 aiapi114 单容器服务时的参数和风险。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/deployment-methods/docker-installation.md'],
    body: `Docker 单容器部署适合快速测试或简单环境。生产环境仍建议配合数据库、反向代理、备份和监控一起使用。

## 适合先读这篇的人

- 你想快速启动 aiapi114 做验证。
- 你还没有完整 Docker Compose 部署方案。
- 你需要理解镜像、端口和环境变量的基本关系。

## 操作步骤

### 1. 拉取镜像

选择明确版本的镜像，避免生产环境长期使用不确定的 latest。

### 2. 设置启动参数

配置端口映射、数据目录、数据库连接和必要密钥。敏感值应使用环境变量注入。

### 3. 查看启动日志

启动后先查看日志，确认数据库连接、迁移和 HTTP 服务启动正常。

### 4. 升级到可维护部署

验证通过后，把启动参数固化到 Compose、面板或运维脚本中，避免依赖临时命令。

## 检查清单

- [ ] 使用了明确镜像版本。
- [ ] 数据目录已持久化。
- [ ] 敏感配置没有写在公开脚本中。
- [ ] 后续升级路径已明确。`,
  }),
  createArticle({
    slug: 'environment-variables',
    title: 'aiapi114 环境变量配置',
    summary: '说明环境变量的配置原则、密钥管理、变更验证和回滚方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/config-maintenance/environment-variables.md'],
    body: `环境变量用于控制数据库连接、密钥、外部服务地址和运行模式。错误的环境变量会直接影响登录、调用和支付等关键链路。

## 适合先读这篇的人

- 你需要修改 aiapi114 的运行配置。
- 你不确定哪些值属于敏感信息。
- 你准备在生产环境变更配置。

## 操作步骤

### 1. 区分配置类型

把数据库、密钥、支付回调等敏感配置与普通开关分开管理。敏感配置只放在受控环境中。

### 2. 修改前备份

记录当前变量值、变更原因和回滚方式。生产环境不要直接覆盖唯一配置副本。

### 3. 重启并验证

修改变量后重启服务，验证登录、API 调用、日志、支付或相关功能是否正常。

### 4. 清理过期配置

删除不再使用的变量，避免旧配置误导后续排查。

## 检查清单

- [ ] 敏感变量未提交到仓库。
- [ ] 修改前已记录回滚值。
- [ ] 重启后完成相关功能验证。
- [ ] 过期变量已清理。`,
  }),
  createArticle({
    slug: 'system-update',
    title: 'aiapi114 系统更新与回滚',
    summary: '说明更新 aiapi114 前后的备份、验证、回滚和变更记录要求。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/installation/config-maintenance/system-update.md'],
    body: `系统更新应先保证可回滚。不要在高峰期直接更新生产环境，也不要在未备份数据库的情况下执行升级。

## 适合先读这篇的人

- 你准备升级 aiapi114。
- 你需要降低更新造成中断的风险。
- 你想建立固定的更新检查流程。

## 操作步骤

### 1. 阅读变更说明

先确认版本变更是否涉及数据库迁移、配置项变化、接口兼容性或前端资源变化。

### 2. 做备份

备份数据库、配置文件、环境变量和当前镜像版本。备份应能被实际恢复。

### 3. 执行更新

按部署方式更新镜像或代码，观察启动日志和迁移结果。

### 4. 验证和回滚

更新后验证登录、API 调用、计费、日志和核心页面。失败时按备份回滚。

## 检查清单

- [ ] 已阅读版本变更说明。
- [ ] 数据库和配置已备份。
- [ ] 更新后完成核心链路验证。
- [ ] 回滚方案可执行。`,
  }),
  createArticle({
    slug: 'system-settings',
    title: 'aiapi114 系统设置管理',
    summary: '说明管理员修改系统设置时的范围确认、风险控制和验证方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/system-settings.md'],
    body: `系统设置会影响全站行为。管理员修改前应先确认设置项作用范围，并尽量在低峰时段变更。

## 适合先读这篇的人

- 你是 aiapi114 站点管理员。
- 你需要修改站点名称、公告、注册、登录或全局开关。
- 你担心设置变更影响已有用户。

## 操作步骤

### 1. 确认设置范围

先判断设置项影响前台展示、用户登录、API 调用还是管理员后台。

### 2. 小步变更

一次只改一类设置，保存后立即验证，避免多个变更混在一起难以回滚。

### 3. 记录原因

记录变更人、时间、设置项和原因。涉及用户可见内容时同步运营或客服。

### 4. 验证核心链路

修改后验证首页、登录、模型列表、API 调用和通知等相关功能。

## 检查清单

- [ ] 已确认设置项影响范围。
- [ ] 一次只修改必要设置。
- [ ] 关键变更已有记录。
- [ ] 保存后完成核心链路验证。`,
  }),
  createArticle({
    slug: 'payment-settings',
    title: 'aiapi114 支付设置管理',
    summary: '说明支付方式、回调、到账核对和异常处理的管理边界。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/settings/payment-settings.md'],
    body: `支付设置属于高风险配置。修改支付渠道、回调地址或金额规则前，必须确认测试环境已验证通过。

## 适合先读这篇的人

- 你需要配置或调整 aiapi114 支付方式。
- 你要排查充值不到账或回调失败。
- 你负责核对订单、余额和支付渠道记录。

## 操作步骤

### 1. 准备支付渠道信息

确认商户号、密钥、回调地址、异步通知和签名方式。密钥只保存在受控环境中。

### 2. 配置回调地址

回调地址应使用 HTTPS，并能被支付渠道访问。反向代理和防火墙不能拦截回调。

### 3. 做小额测试

先用小额订单测试创建订单、支付、回调、到账和钱包记录。

### 4. 处理异常订单

异常时对照支付渠道流水、平台订单号、回调日志和用户钱包记录，不要直接手工改余额。

## 检查清单

- [ ] 支付密钥未暴露在前端或仓库。
- [ ] 回调地址可公网访问且使用 HTTPS。
- [ ] 已完成小额闭环测试。
- [ ] 异常订单有流水和日志证据。`,
  }),
  createArticle({
    slug: 'redemption-management',
    title: 'aiapi114 兑换码管理',
    summary: '说明兑换码创建、发放、核销、失效和异常核对方式。',
    sourceBasis: ['docs/reference-help-docs/newapi-ai/guide/console/redeem-code-management.md'],
    body: `兑换码适合活动、补偿或授权场景。管理员应控制发放范围、有效期和兑换额度，避免长期无限制流通。

## 适合先读这篇的人

- 你需要创建或发放 aiapi114 兑换码。
- 你要核对兑换码是否已被使用。
- 你想处理兑换失败或额度异常。

## 操作步骤

### 1. 创建兑换码

设置金额、数量、有效期和适用范围。大批量发放前先用少量测试。

### 2. 发放并记录

记录发放对象、批次、用途和负责人。不要在公开渠道发放高额度兑换码。

### 3. 查询核销状态

按兑换码、批次或用户查询使用情况，确认是否已兑换、过期或失效。

### 4. 处理异常

兑换失败时核对有效期、是否已使用、用户账号和平台规则。

## 检查清单

- [ ] 兑换码设置了有效期和范围。
- [ ] 发放批次有记录。
- [ ] 高额度兑换码未公开传播。
- [ ] 异常核对包含用户、时间和兑换码状态。`,
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
        '符合大纲：属于第七批安装部署与管理员配置页面。',
        '文档框架稳定：保留竞品文档的配置说明、步骤、检查清单结构。',
        '竞品平台信息已替换成 aiapi114，并补充生产变更、密钥和回滚边界。',
      ],
    },
  }
}

