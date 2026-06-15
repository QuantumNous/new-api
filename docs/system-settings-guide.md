# DeepRouter 系统设置完整配置指南

> 面向运营者的中文手册。覆盖后台「系统设置」全部分组：Site & Branding / System Information / System Notice / Header navigation / Sidebar modules / Authentication / Billing & Payment / Models & Routing / Security & Limits / Console Content / Operations。
>
> 每个子项给出：**作用 → 关键字段 → DeepRouter 推荐值 → 是否需你自己填**。

---

## 0. 先读这一段（重要前提）

1. **这些设置存在数据库里，不是代码。** 在后台 UI 改完点保存就立即生效，**无需重启、无需重新部署**。
2. **代码里的"默认值"只对全新安装生效。** 你现有的线上库一旦写过某项，代码默认就不再起作用——所以"自动配置"只能靠你在后台按本指南点几下，或用 admin API 批量写入。
3. **优先级**：先把 🔴 必填项配好（否则登录/支付/邮件会直接报错），再调 🟡 运营项，最后按需开关 🟢 增强项。

---

## 1. 上线最短路径（🔴 必填清单）

不配这些，站点无法正常对外服务：

| 区域 | 必填项 | 说明 |
|---|---|---|
| System Information | **系统名称、服务器地址(域名)** | 域名不对，OAuth/微信登录回调全失败 |
| Authentication | **Turnstile 站点密钥+密钥** | 不开机器人验证会被刷注册 |
| Authentication | **微信登录**（面向华人必备）或至少邮箱 SMTP | 国内用户没微信登录转化率极低 |
| Operations → SMTP | **邮件服务器/端口/账户/密码/发件地址** | 不配邮箱，验证码、告警都发不出 |
| Billing → Payment | **一个支付网关**（易支付商户号或 Stripe 密钥） | 不配支付用户无法充值 |
| Billing → Currency | **充值汇率**（与支付网关实际一致） | 汇率错 = 用户看到的价和实扣不符 |
| Billing → Model Pricing | **模型倍率**（你的利润乘数） | 倍率=1 没利润，必须按成本设 |

> 其余项本指南都给了可直接用的推荐默认值。

---

## 2. Site & Branding（站点与品牌）

### 2.1 系统信息 System Information（/system-settings/site/system-info）
**作用**：网站基本信息、品牌、法律条款。

| 字段 | 含义 |
|---|---|
| 前端主题 | 默认（新前端）/ 经典（旧版）|
| 系统名称 | 🔴 品牌名，如 "DeepRouter" |
| 服务器地址 | 🔴 公网域名，如 `https://deeprouter.co`，OAuth/webhook 回调依赖它 |
| Logo URL | 徽标图片链接（建议 200×60 PNG）|
| 页脚 / 关于本站 / 首页内容 | 支持 Markdown/HTML 或外链 iframe |
| 用户协议 / 隐私政策 | 注册需同意的条款，留空则不显示 |

**推荐**：主题用"默认新前端"；系统名 = DeepRouter；服务器地址填真实域名；页脚加版权+ICP备案+联系方式；首页写核心卖点（"一站式 AI 中转，支持 Claude / GPT / Gemini…"）。
**需你填**：🔴 系统名称、🔴 服务器地址、Logo、用户协议/隐私政策（按当地法规）。

### 2.2 系统公告 System Notice（/system-settings/site/notice）
**作用**：全站横幅广播（维护/活动/更新），Markdown。
**推荐模板**：
- 开业：`## 欢迎使用 DeepRouter！领取 API Key 即享一站式 AI 中转。[开始 →](/keys)`
- 维护：`⚠️ 2026-06-20 22:00-23:00 UTC 升级维护，期间服务不可用。`
- 活动：`🎉 新用户专享 50 元额度红包，[立即注册](/register)`

**需你填**：公告内容按运营节奏自写。

### 2.3 顶部导航栏 Header navigation（/system-settings/site/header-navigation）
**作用**：控制顶栏各入口可见性 + 访问权限。

| 入口 | 推荐 |
|---|---|
| 首页 / 控制台 / 文档 / 关于 | ✓ 全开 |
| 定价 Pricing | ✓ 开，**不要求登录**（公开定价吸引访客）|
| 排行榜 Rankings | ✓ 开，**需登录**（防无关用户刷榜）|

**需你填**：无，按推荐即可。

### 2.4 侧边栏模块 Sidebar modules（/system-settings/site/sidebar-modules）
**作用**：控制登录后左侧菜单 4 大区域（聊天 / 控制台 / 个人中心 / 管理员）及子项可见性。
**推荐**：4 大区域**全部启用**。子项含：游乐场、聊天、数据看板、令牌管理、使用日志、绘图/任务日志、钱包、个人资料，以及管理员区的渠道/模型/兑换码/用户/设置/订阅管理。
**需你填**：无，保持默认全开，后续按需隐藏。

---

## 3. Authentication（身份验证）

### 3.1 基本身份验证 Basic Auth（/system-settings/auth/basic-auth）
| 字段 | 推荐 | 说明 |
|---|---|---|
| 密码登录 PasswordLoginEnabled | ✓ 开 | 邮箱+密码登录 |
| 允许注册 RegisterEnabled | ✓ 开 | 自助注册降低运营负担 |
| 密码注册 PasswordRegisterEnabled | ✓ 开 | |
| 邮箱验证 EmailVerificationEnabled | ✓ 开 | 防垃圾注册（依赖 SMTP）|
| 邮箱域限制 EmailDomainRestriction | ✗ 关 | 接纳全球用户 |
| 邮箱别名限制 EmailAliasRestriction | ✓ 开 | 防 `user+alias@` 刷注册 |

### 3.2 OAuth 集成 OAuth（/system-settings/auth/oauth）
内置：GitHub / Discord / OIDC / Telegram / LinuxDO / 微信。各需 **Client ID + Secret**（去对应平台开发者后台创建应用获取）。

| 提供商 | 推荐 | 备注 |
|---|---|---|
| **微信 WeChat** | 🔴 强烈推荐 | 华人站必备。需自建/集成微信 OAuth 服务（服务器地址+Token+二维码 URL）|
| GitHub | ✓ 推荐 | 开发者友好 |
| Telegram | ✓ 可选 | 全球用户多；需 @BotFather 拿 Bot Token+Name |
| OIDC | 按需 | 企业 SSO（Keycloak/Okta），填 Well-Known URL 自动发现端点 |
| Discord / LinuxDO | 可选 | 社区/Linux 生态 |

### 3.3 Passkey 认证（/system-settings/auth/passkey）
**作用**：WebAuthn 无密码登录（指纹/面容/硬件密钥）。
**推荐**：开；显示名 DeepRouter；RP ID = 生产域名；Origins = `https://你的域名`；不安全源生产关、开发开；用户验证 `preferred`；设备类型 `none`（最大兼容）。

### 3.4 机器人保护 Bot Protection（/system-settings/auth/bot-protection）
**作用**：Cloudflare Turnstile 人机验证，防刷注册/爆破。
**推荐**：🔴 强烈推荐开启。去 Cloudflare → Turnstile 创建站点（填域名，难度选 Managed），拿**站点密钥 + 密钥**填入。
**需你填**：🔴 Turnstile 两个 key。

### 3.5 自定义 OAuth Custom OAuth（/system-settings/auth/custom-oauth）
**作用**：添加内置之外的任意 OAuth 2.0 提供商。通常不需要，除非有特殊渠道。

---

## 4. Billing & Payment（计费与支付）

> 运营者最易懵的概念：**倍率(ratio)** = 成本价的乘数。`1.0`=成本价无利润，`1.5`=加价 50%，`2.0`=翻倍。**充值汇率**用于把美元额度换算成用户看到的人民币价。

### 4.1 额度配置 Quota（/system-settings/billing/quota）
| 字段 | 推荐 | 说明 |
|---|---|---|
| 新用户配额 | 20000 | 注册赠送额度 |
| 预消费额度 | 8000 | 扣费前预消费 |
| 邀请人 / 被邀请奖励 | 15000 / 10000 | 拉新政策 |
| 免费模型预消费 | ✓ 开 | 流程统一 |
| 充值链接 / 文档链接 | 🔴 填你的 `/topup`、`/docs` |

### 4.2 货币与显示 Currency & Display（/system-settings/billing/currency）
| 字段 | 推荐（中国区）|
|---|---|
| 显示模式 | **CNY**（人民币）|
| 美元汇率 CNY/USD | 🔴 当日牌价如 `7.2`，须与支付网关一致 |
| 以货币显示 / Token 统计 | ✓ 全开 |

> 也可选 USD / 自定义货币 / 纯 Token 模式。

### 4.3 模型定价 Model Pricing（/system-settings/billing/model-pricing）
**作用**：每个模型的倍率、缓存费率、工具价、上游同步（JSON 编辑，有可视化辅助）。

```jsonc
// 模型倍率 Model Ratio（你的利润乘数）
{ "gpt-4o": 1.5, "gpt-4-turbo": 1.3,
  "claude-opus-4-8": 1.8, "claude-sonnet-4-6": 1.6,
  "*": 1.2 }            // 未列出的模型默认倍率
// 缓存读取 0.1 / 缓存写入 0.25（鼓励缓存复用）
// 暴露倍率 ExposeRatioEnabled: false（商业机密，关）
```
**推荐**：热门模型 1.3–1.8，冷门 1.1–1.5；缓存读 0.1、写 0.25；关闭倍率暴露。
**需你填**：🔴 按你与上游的实际成本设倍率。

### 4.4 分组定价 Group Pricing（/system-settings/billing/group-pricing）
**作用**：给不同用户分组（VIP/企业/试用）设独立倍率和可用模型，差异化定价。
```jsonc
{ "GroupRatio":     { "free":1.0, "vip":0.8, "enterprise":0.6 },   // 使用折扣
  "TopupGroupRatio":{ "free":1.0, "vip":0.85,"enterprise":0.75 },  // 充值折扣
  "UserUsableGroups":["free","vip"], "DefaultUseAutoGroup":false }
```
含义：VIP 享 8 折、企业 6 折；充值倍率略低于使用倍率以鼓励充值。

### 4.5 支付网关 Payment（/system-settings/billing/payment）
**作用**：集成支付，支持 **易支付(Epay) / Stripe / Creem / Waffo / Airwallex**。
**共享字段**：充值回调地址、最小充值、每美元价格 Price、支付方式列表、充值额度选项、充值折扣。

| 网关 | 必填项 | 适用 |
|---|---|---|
| **易支付 Epay** | 端点、商户 ID、商户密钥 | 🔴 国内主流（支付宝/微信/银行卡）|
| Stripe | API Secret、Webhook Secret、Price ID | 国际信用卡 |
| Waffo | API Key、私钥、公钥、商户 ID | 多币种聚合 |
| Airwallex | Client ID、API Key、Webhook Secret | 跨境收款 |

**推荐（中国区）**：主用易支付；`Price` 每额度约 `0.12`（含手续费+利润）；最小充值 `10`；额度选项 `[100,500,1000,5000]`；折扣 `{"1000":0.02,"5000":0.05,"10000":0.1}`。
**需你填**：🔴 至少一个网关的商户密钥 + 回调地址。

### 4.6 签到奖励 Check-in（/system-settings/billing/checkin）
**作用**：每日签到随机额度，提升日活。
**推荐**：开；最小 2000、最大 5000（月均约 0.6–1.5 USD 免费额度）。

---

## 5. Models & Routing（模型与路由）

### 5.1 全局模型配置 Global（/system-settings/models/global）
请求透传、思考模型黑名单、Chat→Responses 转换、保活心跳。
**推荐**：开请求透传；黑名单 `[]`；开保活心跳，间隔 `60s`。

### 5.2 Claude（/system-settings/models/claude）
模型请求头、默认 Max Tokens、思维适配器。
**推荐**：请求头 `{}`；默认 max tokens `{"default":8192}`；开思维适配器，预算比例 0.3–0.5。
> 本仓库已内置 Opus 4.8 全套模型与定价（见 `claude/constants.go`、`model_ratio.go`）。

### 5.3 Gemini（/system-settings/models/gemini）
安全阈值、API 版本映射、Imagine 模型、思维适配器、FunctionCall 兼容。
**推荐**：安全设宽松 `BLOCK_NONE`；版本 `{"default":"v1beta"}`；开思维适配器 0.2–0.3；开"移除 FunctionResponse.id"以兼容 Vertex 代理。

### 5.4 Grok（/system-settings/models/grok）
违规扣费策略。**推荐**：开，扣费 `0.05`。

### 5.5 渠道亲和性 Channel Affinity（/system-settings/models/channel-affinity）
**作用**：粘性路由——把用户固定到某渠道，提升上游缓存命中。
**推荐**：开；成功时切换开；最大缓存 10000–50000；TTL `3600` 或 `0`(永久)。
**需你填**：规则 JSON 按业务（如按 key 前缀路由到指定渠道组）。

### 5.6 模型部署 Model Deployment（/system-settings/models/model-deployment）
io.net 分布式推理集成。不用则关；用则填 API Key。

---

## 6. Security & Limits（安全与限流）

### 6.1 速率限制 Rate Limiting（/system-settings/security/rate-limit）
**推荐**：开；周期 60min；全局 200 请求/100 成功；分组示例：
```json
{ "default":[200,100], "vip":[0,1000], "trial":[50,30] }
```
`[最大请求, 最大成功]`，VIP 设 0=不限。

### 6.2 敏感词过滤 Sensitive Words（/system-settings/security/sensitive-words）
**推荐**：开过滤 + 开"检查用户提示词"（在请求到上游前拦截，省额度）。关键词按当地法规维护。

### 6.3 SSRF 防护（/system-settings/security/ssrf）
**推荐（公网站）**：开保护；禁私有 IP；黑名单模式；IP 黑名单加 `127.0.0.1`、`169.254.169.254`；允许端口 `80,443`；对解析后域名也应用 IP 过滤。
**需你填**：把合法 webhook 回调域名加白名单。

---

## 7. Console Content（控制台内容）

| 子项 | 路由 | 推荐 |
|---|---|---|
| 数据仪表板 Dashboard | /content/dashboard | 开，刷新 30min，粒度 hour |
| 公告 Announcements | /content/announcements | 开，按运营写（维护/上新/活动，分 type 颜色）|
| API 地址 API Info | /content/api-info | 开，列出各接入节点(国内/香港/快速开始)URL |
| 常见问答 FAQ | /content/faq | 开，写 拿 key / 定价 / 支持模型 / 充值 |
| Uptime Kuma | /content/uptime-kuma | 部署了监控才开 |
| 聊天预设 Chat Presets | /content/chat | 开，推荐 Cherry Studio / Chatbox / Claude Code |
| 绘图 Drawing | /content/drawing | 开绘图；回调关(藏 IP)；清模式标志开(防 `--turbo` 超消)；要求成功后再操作开 |

**需你填**：公告/FAQ/API地址/聊天预设的具体文案与链接。

---

## 8. Operations（运维）

### 8.1 系统行为 Behavior（/system-settings/operations/behavior）
**推荐**：重试 `3`；默认折叠侧栏开；演示站模式关；自用模式关（多用户商业站）。
> ⚠️ 报错"请开启自用模式或配置价格"时，正确做法是**配模型价格**（见 4.3），而不是开自用模式——自用模式会隐藏多用户功能。

### 8.2 监控与告警 Monitoring（/system-settings/operations/monitoring）
**推荐**：禁用阈值 `30s`；配额提醒 `20%`；开自动禁用、关自动启用（人工复核更稳）；禁用关键词加 `Your credit balance is too low`、`quota exceeded`；禁用状态码 `429,500-503`；重试状态码 `429,502,503`；开自动测试，间隔 `5min`。
**需你填**：禁用关键词/状态码按上游实际错误调整。

### 8.3 SMTP 邮箱 Email（/system-settings/operations/email）
🔴 验证码/告警依赖它。
**推荐**：QQ 邮箱示例 `smtp.qq.com:465` SSL 开，账户=发件地址。
**需你填**：🔴 服务器、端口、账户、密码/令牌、发件地址。

### 8.4 Worker 代理 Worker Proxy（/system-settings/operations/worker）
**作用**：Cloudflare Worker 代理出站请求/图片，绕 IP 限制、统一请求头。
**推荐**：部署转发脚本后填 URL；开"允许 HTTP 图片代理"；密钥用强随机串定期轮换。
**需你填**：Worker URL + 访问密钥（不用代理可留空）。

### 8.5 日志维护 Logs（/system-settings/operations/logs）
**推荐**：开日志消费便于审计；定期清理（保留约 30 天）防磁盘爆。

### 8.6 性能 Performance（/system-settings/operations/performance）
**推荐**：开磁盘缓存，阈值 `1MB`，上限 10–50GB；开性能监控（CPU 80% / 内存 85% / 磁盘 90%，超阈值拒新请求保护系统）；开模型指标，刷新 30s、粒度 hour、保留 7 天。
**需你填**：磁盘缓存路径（可选，如 `/data/cache`）。

### 8.7 系统维护 Update Checker（/system-settings/operations/update-checker）
查看版本/启动时间、手动检查更新。建议每月检查，测试环境先验证再上生产。

---

## 9. 故障排查速查

| 现象 | 排查点 |
|---|---|
| 邮箱验证码收不到 | SMTP（8.3）是否配全 |
| Turnstile 验证失败 | 站点密钥/密钥、域名是否与 Cloudflare 一致 |
| 微信登录 404 | 服务器地址、微信 AppID/Secret |
| "模型 xxx 价格未配置" | 在 4.3 给该模型配倍率（**不要**靠开自用模式绕过）|
| 充值价与实扣不符 | 4.2 充值汇率须与支付网关一致 |
| ratio 设置页打不开 | 新路径是 `/system-settings/billing/model-pricing`（老 `/console/setting?tab=ratio` 已废弃）|
| Passkey 注册失败 | 浏览器是否支持 WebAuthn、Origins URL 是否准确 |

---

## 10. 推荐配置顺序

1. **上线前（🔴）**：系统信息(域名/品牌) → SMTP → Turnstile → 微信登录 → 支付网关 → 充值汇率 → 模型倍率
2. **运营优化（🟡）**：额度/邀请/签到 → 分组定价 → 监控告警 → 速率限制 → 公告/FAQ
3. **增强（🟢）**：Passkey、其他 OAuth、渠道亲和性、Worker 代理、绘图、Uptime Kuma

> 所有项保存即生效，无需重启。
