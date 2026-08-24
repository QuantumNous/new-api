# 邀请页签设计方案

- 日期：2026-07-10
- 状态：已确认，待实现
- 分支：`feature/invitation-tab`
- worktree：`C:\Users\11247\.config\superpowers\worktrees\new-api\invitation-tab`
- 参考：`https://freemodel.dev/dashboard/refer` 的信息架构；视觉与交互以 NewAPI 当前控制台为准

## 1. 背景与目标

NewAPI 已有完整的邀请奖励结算能力，但入口藏在钱包页的一张紧凑卡片里，用户无法查看邀请明细，也容易误解奖励触发条件。本功能新增独立的“邀请”页签，让用户在一个页面完成以下操作：

1. 了解邀请规则与当前奖励配置。
2. 复制或分享自己的邀请链接。
3. 查看累计奖励、可转余额、成功邀请数和待充值人数。
4. 查看最近邀请记录及其奖励状态。
5. 将可转邀请额度转入账户余额。

页面借鉴 FreeModel 邀请页的内容顺序，不复制其品牌、配色或组件样式。最终界面必须延续 NewAPI 现有控制台的排版、组件、设计 token、暗色模式和响应式行为。

## 2. 已确认的产品决策

| 事项 | 决策 |
| --- | --- |
| 导航位置 | 个人分组新增“邀请”，路由为 `/invite`，与“钱包”“个人资料”并列 |
| 页面范围 | 完整版：统计、分享、三步说明、邀请明细、转余额、FAQ、合规提示 |
| 奖励触发条件 | 被邀请人完成首次成功充值后结算；注册、创建 API Key 或调用 API 均不发放奖励 |
| 奖励金额 | 使用现有管理员配置 `QuotaForInviter` 和 `QuotaForInvitee`，不硬编码金额 |
| 邀请上限 | 使用现有 `QuotaForInviterMaxCount`；`0` 表示不限次数 |
| 邀请明细 | 服务端分页返回脱敏身份、注册时间、状态、结算时间、邀请人实际所得奖励及安全原因 |
| 钱包页 | 移除现有邀请奖励卡片和专用转账弹窗状态；钱包只保留充值、订阅和账单能力 |
| UI 风格 | 只使用 NewAPI 已有组件和样式体系，不新增 UI 依赖或第二套设计系统 |
| 前端范围 | 仅修改 `web/default`；不修改已废弃的 `web/classic`，也不在独立官网 `website` 新增页面 |

## 3. 奖励语义与状态

当前代码以成功充值记录作为唯一合法触发器：`TryGrantInviteRewardAfterTopUpSucceeded` 只接受状态为成功、且属于被邀请人的充值记录。该语义是页面文案、统计和 FAQ 的唯一事实来源。

邀请记录向用户展示三种状态：

| 状态 | 条件 | 展示奖励 |
| --- | --- | --- |
| `pending` | 已通过邀请链接注册，尚未完成首次成功充值 | `0` |
| `granted` | 首次成功充值已处理 | `InviteRewardEvent.inviter_reward_quota` 的实际值 |
| `blocked` | 充值触发后因邀请人不存在等原因无法结算 | `0` |

达到邀请奖励上限时，被邀请人的奖励仍可正常结算，因此记录状态仍为 `granted`；邀请人实际奖励为 `0`，并返回安全原因 `inviter_limit_reached`。前端显示“已达奖励上限”，不能把配置上限金额误显示为已获得金额。

历史或异常数据若存在 `inviter_id > 0` 但状态不属于上述三种值，接口将其归一为 `blocked`，只返回通用安全原因 `unavailable`，避免前端出现未知状态或泄露内部错误。

## 4. 后端设计

### 4.1 API

新增登录用户接口：

```http
GET /api/user/self/invitations?page=1&page_size=10
```

- 使用现有 `middleware.UserAuth()`。
- `page` 默认 `1`；`page_size` 默认 `10`，最大 `100`。
- 返回顺序为注册时间倒序，再以用户 ID 倒序保证稳定分页。
- 继续复用现有接口：
  - `GET /api/user/aff` 获取或生成邀请码。
  - `POST /api/user/aff_transfer` 将邀请额度转入余额。
- 不修改现有转余额接口的支付合规校验。

成功响应：

```json
{
  "success": true,
  "message": "",
  "data": {
    "summary": {
      "inviter_reward_quota": 500000,
      "invitee_reward_quota": 500000,
      "inviter_reward_max_count": 0,
      "history_quota": 1500000,
      "transferable_quota": 500000,
      "granted_count": 3,
      "pending_count": 2,
      "transfer_enabled": true
    },
    "items": [
      {
        "id": 123,
        "masked_identity": "a***@example.com",
        "registered_at": 1783612800,
        "status": "granted",
        "granted_at": 1783699200,
        "reward_quota": 500000,
        "reason": ""
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 5
  }
}
```

字段语义：

- `history_quota` 直接取当前邀请人的 `aff_history`，表示历史实际累计所得。
- `transferable_quota` 直接取 `aff_quota`，表示尚未转入余额的额度。
- `granted_count` 取 `aff_count`，保持与现有结算账本一致。
- `pending_count` 统计当前邀请人名下状态为 `pending` 的有效用户。
- `transfer_enabled` 取当前支付合规配置，只控制按钮状态；服务端 `POST /aff_transfer` 仍是最终权限边界。
- `reward_quota` 必须取事件表已落库的实际邀请人奖励，不能用当前系统配置回填历史记录。
- `reason` 仅允许公开白名单值：空字符串、`inviter_limit_reached`、`inviter_missing`、`unavailable`。不得直接返回数据库错误、内部日志或任意异常文本。

### 4.2 查询边界

在 `model` 层新增只读查询边界，controller 不直接拼接 GORM 查询。实现采用跨 SQLite、MySQL 和 PostgreSQL 的 GORM 查询，不增加数据库专用 SQL：

1. 读取当前邀请人的 `aff_history`、`aff_quota` 和 `aff_count`。
2. 统计 `users.inviter_id = 当前用户` 且状态为 `pending` 的数量。
3. 分页读取被邀请用户的最小字段集合：`id`、`username`、`email`、`created_at`、奖励状态、结算时间和安全原因。
4. 对当前页的用户 ID 一次性查询 `invite_reward_events`，在内存中按 `invitee_id` 建索引，避免 N+1 查询。
5. 将身份脱敏并组装专用 DTO；不得把 `model.User` 或原始邮箱直接序列化给前端。

GORM 默认排除软删除用户。历史累计奖励仍以邀请人的账本字段为准，因此被邀请人删除账号后，统计金额可能大于当前可见明细合计；页面 FAQ 会说明明细仅展示当前可用记录。

### 4.3 身份脱敏

脱敏发生在服务端：

- 优先使用邮箱；保留邮箱本地域首字符和完整域名，例如 `alice@example.com` 变为 `a***@example.com`。
- 邮箱为空时使用用户名；长度为 1 时返回 `*`，长度为 2 时保留首字符并追加 `*`，长度大于 2 时保留首尾字符，中间替换为 `***`。
- 空身份统一返回 `***`。
- API 不返回原始 `username`、`email`、邀请人 ID、充值单号、IP 或支付信息。

### 4.4 数据库与多节点

本功能只读取现有 `users` 和 `invite_reward_events` 表，不新增字段或迁移。邀请结算和额度转移继续使用现有事务逻辑；新接口不持有进程内状态、不创建缓存，因此多个 console 实例同时提供查询不会产生一致性问题。

列表和统计不是同一事务快照：若读取期间刚好完成充值，短时间内可能出现统计与列表差一条，刷新后即一致。该行为对只读看板可接受，不为此引入高成本锁或跨查询事务。

## 5. 前端设计

### 5.1 路由与模块

- 新增 TanStack Router 文件 `web/default/src/routes/_authenticated/invite/index.tsx`。
- 新增独立功能目录 `web/default/src/features/invitations/`，包含 API、类型、hook、页面与聚焦组件。
- 在 `use-sidebar-data.ts` 的 Personal 分组中加入 `/invite`，使用现有 Lucide 图标。
- 把只属于邀请业务的 `useAffiliate`、邀请链接生成方法、转余额对话框和 API 方法从 wallet 迁到 invitations；删除不再使用的 `AffiliateRewardsCard`。
- Wallet 删除邀请卡片、邀请 hook 调用、`transferDialogOpen` 状态和转余额对话框渲染，其他充值/订阅/账单行为保持不变。

### 5.2 页面结构

页面使用 `SectionPageLayout`，内容宽度、间距和断点与 Wallet 保持一致（`max-w-7xl`、移动端单列、桌面端网格）。从上到下为：

1. **奖励统计**：四张紧凑统计卡，展示累计奖励、可转余额、成功邀请、等待首次充值。数值使用现有 `formatQuota` 和 `tabular-nums`。
2. **邀请链接与分享**：`TitledCard` 内使用只读 `Input`、`CopyButton`、邮件、X、LinkedIn 分享按钮；外链使用编码后的标题、正文和 URL，并设置安全的外链属性。
3. **三步说明**：三项等宽步骤，明确“分享链接 → 好友注册 → 好友首次充值成功后双方获得配置奖励”。不再出现“创建 API Key/首次调用后发奖”的旧文案。
4. **奖励转入余额**：显示可转额度和主按钮；复用现有 `TransferDialog` 的金额校验、提交状态和 toast。合规未确认时按钮禁用并显示现有合规说明。
5. **最近邀请**：桌面端使用 `Table`，列为用户、注册时间、状态、奖励；状态使用 `Badge`。移动端允许横向滚动并保持最小列宽，不另造一套卡片设计。底部使用现有 `Pagination`。
6. **FAQ 与合规提示**：复用现有 `Accordion` 和 `Alert`/弱强调文本，解释触发条件、配置金额、邀请上限、转余额方式、明细范围及禁止自邀/滥用。

### 5.3 视觉约束

- 使用 `Card`、`TitledCard`、`Button`、`Badge`、`Input`、`Table`、`Pagination`、`Skeleton`、`Accordion` 等现有组件。
- 颜色只使用 `background`、`foreground`、`muted`、`primary`、`border`、`destructive` 等现有 token；禁止写死品牌色。
- 沿用现有圆角、边框、阴影和字号，不复制 FreeModel 的渐变、插画或卡片外观。
- 所有状态都必须在亮色和暗色主题下可读，不能只靠颜色区分；Badge 同时显示文字。
- 页面在手机、平板和桌面宽度下均不能产生页面级横向滚动。

### 5.4 状态与错误处理

- 初次加载：统计卡、分享卡和表格显示与最终布局近似的 `Skeleton`，避免内容跳动。
- 空列表：在表格区域显示“还没有邀请记录”和简短引导，分享入口保持可用。
- 分页加载：保留页面主体，只将表格区域切换为 loading；避免整页闪烁。
- 接口错误：表格区域显示可重试错误状态；分享链接获取与明细获取彼此独立，单个失败不遮蔽另一个成功区域。
- 转账成功：刷新当前用户和邀请摘要；关闭弹窗并显示成功 toast。
- 转账失败：保留弹窗与输入，显示后端国际化错误；前端不自行假定失败原因。
- 分享 API：邮件/X/LinkedIn 使用 URL；复制仍走现有 clipboard hook。浏览器拦截弹窗时不影响页面其他能力。

## 6. 国际化

所有用户可见文案都通过 `t()`。新增 key 必须真实翻译并同步到以下 8 个文件：

- `en.json`
- `zh.json`
- `fr.json`
- `ru.json`
- `ja.json`
- `vi.json`
- `es.json`
- `pt.json`

实现后运行 `bun run i18n:sync`，并检查 `locales/_reports/*.untranslated.json`，确保本功能新增 key 没有遗漏或以英文占位。

## 7. 测试策略

实现遵循 TDD：先写能因缺少行为而失败的测试，再写最小实现使其通过。

### 7.1 后端

- 身份脱敏表驱动测试：邮箱、不同长度用户名、空身份。
- model 查询测试：仅返回当前邀请人的记录、倒序稳定分页、pending 统计、实际历史事件奖励、上限原因、异常状态归一化、软删除排除。
- controller 测试：认证用户 ID 作用域、默认/边界分页参数、配置金额与上限、转账合规状态、响应不包含原始邮箱或用户名。
- 回归测试：邀请奖励仍只由首次成功充值触发；token 创建不发奖。

### 7.2 前端

- API 与链接 helper 测试：查询参数、邀请链接生成、邮件/X/LinkedIn 分享 URL 编码。
- 页面/组件测试：加载、成功、空、错误、分页、状态 Badge、实际奖励为 0、合规禁用、转账成功刷新。
- Wallet 回归：不再渲染邀请卡片，充值、订阅和账单组件仍存在。
- i18n 检查：8 个 locale 均包含新 key，报告中无本功能新增未翻译项。

### 7.3 验证命令

至少运行：

```bash
go test ./model
go test ./controller -run 'Invitation|InviteReward'
cd web/default && bun test
cd web/default && bun run typecheck
cd web/default && bun run lint
cd web/default && bun run i18n:sync
cd web/default && bun run build
```

最后在本地浏览器中检查 `/invite` 的亮/暗主题、桌面/移动断点、分享按钮、分页、空/错误状态和转余额弹窗。

已知基线风险：当前 `origin/main` 的完整 `go test ./controller` 在 `TestStripeCheckoutSessionEmbeddedModeUsesReturnURL` 上失败。该失败与邀请功能无关，本分支不顺带修改；仍需运行邀请相关 controller 测试并记录完整测试的基线差异。

## 8. 预期改动范围

后端主要涉及：

- `model/invite_reward.go` 或聚焦的新查询文件及其测试
- `controller/user.go` 或聚焦的新 controller 文件及其测试
- `router/api-router.go`

前端主要涉及：

- `web/default/src/hooks/use-sidebar-data.ts`
- `web/default/src/routes/_authenticated/invite/index.tsx`
- `web/default/src/features/invitations/**`
- `web/default/src/features/wallet/index.tsx` 及邀请专属旧文件清理
- `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`

## 9. 非目标

- 不修改奖励发放规则、奖励金额配置或邀请上限配置入口。
- 不新增管理员邀请管理页、导出、搜索或筛选。
- 不新增邀请码自定义、短链、二维码、社交平台 SDK 或分享追踪。
- 不迁移或回填历史邀请数据。
- 不修改 `web/classic`、`website` 或公开营销页面。
- 不修复与本功能无关的 controller 基线测试失败。

## 10. 完成标准

1. 登录用户能从侧栏进入 `/invite`，且页面风格与现有控制台一致。
2. 页面明确表达“被邀请人首次成功充值后发奖”，不存在创建 Key 或首次调用发奖的旧文案。
3. 摘要与明细来自服务端真实账本；历史奖励展示实际发放值，不受后续配置变更影响。
4. 被邀请人身份在服务端脱敏，响应中不泄露原始邮箱、用户名或支付信息。
5. 转余额能力从 Wallet 完整迁移到邀请页，Wallet 的其余功能无回归。
6. 加载、空、错误、分页、合规禁用和移动端状态均可用。
7. 8 种语言完成真实翻译，目标测试、类型检查、lint、构建和浏览器验证通过；任何无法运行的验证均明确记录。
