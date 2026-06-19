# 企业专属功能设计文档：对公转账充值 · 增值税发票 · 子账户

> 版本：v1.0（已评审，全部决策点于 2026-06-10 确定，见 §八）
> 适用项目：new-api
> 前置依赖：**企业认证已上线**（见 `docs/enterprise-cert-design.md`），本文所有功能仅对 `enterprise_status = 2（已通过）` 的用户开放
> 日期：2026-06-10
>
> **设计基线**：延续 KYC / 企业认证两期已验证的模式 —— 跨库兼容（SQLite/MySQL/PostgreSQL）、人工审核 + 审计日志、大字段图片入库、`web/classic` 前端优先、最小化触碰上游文件。凡未特别说明处，实现约定与前两期一致。

---

## 一、背景与目标

企业认证解决了「企业主体核验」，本期交付认证后的三项企业级权益：

| # | 功能 | 一句话描述 |
|---|------|-----------|
| A | **对公转账充值** | 管理员配置对公收款账户；企业用户线下转账后上传回执 + 填写金额，管理员审批后入账 |
| B | **增值税发票** | 企业用户对已到账的对公转账金额申请开票，管理员人工审核并交付发票 |
| C | **子账户** | 企业账户创建只读子账户，把自己的 key 绑定给子账户；子账户只能看绑定 key 的用量数据，不能充值、不能管理令牌，key 的消耗扣企业账户的钱 |

### 设计原则

- **计费链路零改动**（子账户的根基，详见 §四 4.1）
- **复用优先**：回执/发票图片加密复用 `common/kyc_crypto.go`；审批入账复用 `ManualCompleteTopUp` 的行锁 + 幂等模式；审核页复用 KYC/企业认证审核页的 `CardPro + CardTable` 模式
- **服务端强制**：子账户的所有限制在后端中间件/查询层强制，前端隐藏只是体验优化，不是安全边界
- **数据库兼容**：三库同时支持（CLAUDE.md Rule 2），大字段省略 `type` 标签走 longtext/text 映射（同企业认证图片表的处理）

---

## 二、功能 A：对公转账充值

### 2.1 流程总览

```
管理员（系统设置-支付设置）配置对公收款信息并启用
        │
企业用户（钱包管理页）看到「对公转账」卡片，展示收款信息
        │ 线下完成银行转账
        ├─► 上传银行转账回执（1 张图片）+ 填写转账金额 → 提交
        │        bank_transfer_orders: status=1 待审核
        │
管理员（对公转账审核页）查看订单 + 回执图片
        ├─► 通过：确认/修正到账金额 → 事务内给企业账户加 quota
        │        + 写 topups 流水（bank_transfer）+ 写充值日志 → status=2
        └─► 拒绝：填写原因 → status=3，用户可重新提交
```

### 2.2 支付设置（管理员配置）

新增一个 JSON option（走现有 `OptionMap` 体系，落 `options` 表），在系统设置 → 支付设置中配置：

```jsonc
// OptionMap["BankTransferSetting"]
{
  "enabled": true,
  "company_name":  "武汉光谷爱计算有限公司",   // 公司名称
  "payee_name":    "武汉光谷爱计算有限公司",   // 收款单位
  "account_number":"416180100100239037",      // 收款账号
  "bank_name":     "兴业银行股份有限公司武汉东湖高新科技支行", // 开户行
  "min_amount":    100,                        // 最低单笔转账金额（元），0=不限
  "tips":          ""                          // 卡片附加说明（如"转账请备注注册邮箱"）
}
```

- 参照现有 `setting/payment_*.go` 的注册模式新增 `setting/payment_bank_transfer.go`
- `enabled=false` 或四要素任一为空时，用户侧卡片不展示、提交接口拒绝
- 收款信息属于**公开信息**（用户必须看到才能转账），不加密、随用户侧接口明文下发

#### 配套防误操作：锁定汇率与额度展示类型（D3 附带决策，2026-06-10）

对公转账入账与发票对账都以 `USDExchangeRate`（7.3）为换算基准，该参数一旦被改动，历史订单复算、日志人民币回显（`controller/log.go` 已有注释说明老日志 CNY 会漂移）全部失真。因此：

- `web/classic/src/pages/Setting/Operation/SettingsGeneral.jsx` 中将 **`USDExchangeRate` 输入框**与 **`quota_display_type`（额度展示类型）选择器**置灰（disabled），旁附说明文案（如"对公转账/发票对账基准，已锁定不可修改"）
- 仅做前端置灰防误操作，**后端不加拦截**——root 仍可通过 API 直改 option，保留逃生通道；若未来需要彻底锁死，再在 option 更新接口加键名黑名单

### 2.3 数据库设计

#### 新增表 `bank_transfer_orders`

```go
// model/bank_transfer.go
const (
    BankTransferStatusPending  = 1
    BankTransferStatusApproved = 2
    BankTransferStatusRejected = 3
)

type BankTransferOrder struct {
    Id            int            `json:"id"             gorm:"primaryKey;autoIncrement"`
    UserId        int            `json:"user_id"        gorm:"index;not null"`
    AmountFen     int64          `json:"amount_fen"     gorm:"not null"`              // 用户申报转账金额，单位：分
    CreditedFen   int64          `json:"credited_fen"   gorm:"default:0"`             // 管理员确认的实际到账金额（分），审批时填
    QuotaGranted  int64          `json:"quota_granted"  gorm:"default:0"`             // 实际入账的 quota，审批时按汇率折算后回填
    Remark        string         `json:"remark"         gorm:"type:varchar(255)"`     // 用户备注（如转账流水号）
    Status        int            `json:"status"         gorm:"type:int;not null;default:1"`
    RejectReason  string         `json:"reject_reason,omitempty" gorm:"type:varchar(255)"`
    ReviewedBy    int            `json:"reviewed_by,omitempty"   gorm:"type:int"`
    TradeNo       string         `json:"trade_no"       gorm:"type:varchar(64);uniqueIndex"` // BT+雪花/时间戳，审批通过后同步写入 topups
    SubmittedAt   *time.Time     `json:"submitted_at"`
    ReviewedAt    *time.Time     `json:"reviewed_at,omitempty"`
    CreatedAt     time.Time      `json:"created_at"`
    UpdatedAt     time.Time      `json:"updated_at"`
    DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}
```

> **金额为什么用 int64 分**：`topups.money` 用的是 float64，但人民币对账场景浮点误差不可接受（发票额度是累加比较：`Σ转账 − Σ发票`，float64 累加会出现 `99999.98999...` 这类误差，导致合法开票申请被误拒或多放额度，且发票金额必须与到账金额分毫不差）。新表统一用「分」存整数，与支付行业惯例（支付宝/微信/Stripe 均用最小货币单位整数）一致。【D1 已决策（2026-06-10）：方案 a】
>
> **金额单位实现规约**（D1 决策附带约束，实现与评审时强制执行）：
> 1. **命名**：所有以「分」为单位的字段/变量一律带 `Fen` 后缀（`AmountFen` / `CreditedFen`）；不带后缀的金额一律视为「元」。
> 2. **换算收敛**：新增统一换算函数（如 `common/money.go` 的 `FenToYuan` / `YuanToFen`，含四舍五入语义），全项目禁止手写 `/100`、`*100`。
> 3. **前端输入**：用户输入的元金额按**字符串**解析（元、分两段拆分）转分，禁止 `输入值 × 100` 的浮点乘法（JS 中 `1234.56 × 100 = 123455.99999...`）。
> 4. **边界清单**：「分」只活在对公转账/发票闭环内部，与旧体系的接触点仅 4 处且单向——审批写 `topups` 流水（分→元）、折算 quota（分→quota）、前端展示（分→元）、用户输入（元→分）。发票额度计算全程整数运算，不读取任何 float 字段。

#### 新增表 `bank_transfer_receipts`（回执图片，1:1）

```go
type BankTransferReceipt struct {
    Id         int            `gorm:"primaryKey;autoIncrement"`
    OrderId    int            `gorm:"uniqueIndex;not null"`  // 1:1 bank_transfer_orders.id
    UserId     int            `gorm:"index;not null"`
    ReceiptEnc string         `gorm:"not null"`              // 回执图片，AES-256-GCM 加密 base64（复用 KYC 加密）
    CreatedAt  time.Time
    UpdatedAt  time.Time
    DeletedAt  gorm.DeletedAt `gorm:"index"`
}
```

- 独立表的理由与企业认证图片表相同：列表查询永不触碰 2MB 大字段，避免某处忘了 `Omit` 把回执批量拖出来；大字段省略 `type` 标签（MySQL→longtext）【决策点 D2】
- 回执含银行账号信息，按敏感数据对待：**加密存储**（复用 `EncryptIDNumber`），管理员查看回执走独立接口并写 `LogTypeManage` 审计日志（轻量版，不做 KYC 那种状态感知收缩——回执敏感度低于身份证件）
- 客户端压缩复用 KYC 的 canvas 压缩（最长边 2400px / JPEG 0.88 / ≤1.5MB）

#### `topups` 流水对接

审批通过时在**同一事务**内写一条 `TopUp` 记录，让对公转账出现在统一的充值历史里：

```go
// model/topup.go 新增常量
PaymentMethodBankTransfer   = "bank_transfer"
PaymentProviderBankTransfer = "bank_transfer_manual"
```

`TopUp{ UserId, Amount: 折算美元额度, Money: 到账金额(元), TradeNo: order.TradeNo, Status: "success", PaymentMethod/Provider 如上 }`。

### 2.4 状态机与接口

| 接口 | 权限 | 说明 |
|------|------|------|
| `GET /api/user/bank_transfer/config` | UserAuth + 企业已认证 | 返回收款四要素 + min_amount_fen + tips（未启用/未认证时仅返回 enabled=false，不下发收款信息） |
| `GET /api/user/bank_transfer/self` | UserAuth | 自己的转账订单分页列表（不含回执大字段） |
| `POST /api/user/bank_transfer` | UserAuth + 企业已认证 + CriticalRateLimit | 提交订单（金额 + 备注 + 回执图必传）；**限制：同一用户最多 1 笔 pending**，防刷单 |
| `DELETE /api/user/bank_transfer/:id` | UserAuth | 撤销自己的 pending 订单（软删，回执硬删） |
| `GET /api/user/bank_transfer/admin` | AdminAuth | 审核列表（状态筛选 + 按用户名/单号搜索，LEFT JOIN users 取 username，同 `GetEnterpriseList` 模式） |
| `GET /api/user/bank_transfer/admin/:id/receipt` | AdminAuth | 解密返回回执图（data URI），写审计日志 |
| `PUT /api/user/bank_transfer/admin/:id/approve` | AdminAuth | 请求体可带 `credited_fen` 修正到账金额（缺省=申报金额）；事务入账 |
| `PUT /api/user/bank_transfer/admin/:id/reject` | AdminAuth | 必填原因 |

> 实现说明（2026-06-10 落地时的微调）：管理员路由按企业认证的既有约定挂在 `/api/user/bank_transfer/admin/*`（而非早稿的 `/api/topup/...`）；配置以分层 option `bank_transfer_setting.*` 注册（`setting/operation_setting/bank_transfer_setting.go`），零改动 `model/option.go`。

**审批事务**（并发安全：条件更新抢占，2026-06-10 评审第 1 轮修订）：

```
BEGIN
  SELECT ... FROM bank_transfer_orders WHERE id=?               -- 仅取不可变字段与存在性
  quota = credited_fen→元 / 系统汇率参数(7.3) * QuotaPerUnit     -- 固定换算，见 D3
  UPDATE bank_transfer_orders SET status=2, credited_fen, quota_granted, reviewed_by, reviewed_at
      WHERE id=? AND status=1                                   -- 条件更新抢占
  if RowsAffected == 0 → 返回"已处理"（并发审批/拒绝/撤销中已有人先赢）
  INSERT INTO topups (...)                                      -- status=success
  IncreaseUserQuota(userId, quota)
COMMIT
RecordLog(LogTypeTopup, "对公转账充值 ¥xx，到账额度 $yy（审核人：zz）")
InvalidateUserCache(userId)
```

> **为什么不用 `FOR UPDATE` 行锁**（评审发现）：上游惯用的 `tx.Set("gorm:query_option", "FOR UPDATE")` 是 GORM v1 机制，项目所用 GORM v2 会**静默忽略**它（等于无锁），且裸 `FOR UPDATE` 语法不兼容 SQLite。条件更新（`WHERE id=? AND status=pending` + 检查 RowsAffected）由数据库保证同行 UPDATE 串行，天然原子、幂等、三库兼容。拒绝、用户撤销两条路径同样用条件操作抢占，杜绝"审批已入账、撤销又删单"的交叉不一致。
>
> **提交竞态（已评审接受，不修）**：创建订单的"同一用户最多 1 笔 pending"用 COUNT-then-CREATE 实现，极端并发下可能产生两笔 pending。接受理由：该约束只是防刷单 UX，**无资金风险**（每笔订单审批入账各自独立、各对应自己的回执）；前端在有 pending 时隐藏表单 + 提交挂 CriticalRateLimit 已基本封死；而"正确"修法（部分唯一索引 `WHERE status=1`）MySQL 不支持，违反三库兼容。
>
> **金额上限与 quota 列扩宽（评审第 2/3 轮修订，2026-06-10）**：
> - 后端业务上限 `BankTransferMaxAmountFen = 1e12`（¥100 亿），提交与审批两处校验，与前端 10 位整数限制对齐，防直连 API 提交天文数字导致 `decimal.IntPart()` 溢出。
> - **`users.quota` / `users.used_quota` 由 `type:int` 升级为 `type:bigint`**：32 位列上限 2.147e9 quota ≈ $4294 ≈ **¥3.1 万余额**，对公转账大额入账（¥10 万 ≈ 6.85e9 quota）必然溢出（PG 报 integer out of range、MySQL 截断），且余额是累计的、压低单笔上限防不住。Go 侧 `int` 在 64 位平台即 64 位，仅改两个 gorm 标签。SQLite 已实测（glebarez/sqlite v1.9.0 + GORM v1.25.2）：AutoMigrate 自动完成变更、存量数据完整、超 32 位值正常读写；PostgreSQL 升级部署时 AutoMigrate 执行 `ALTER COLUMN TYPE bigint`（users 表会重写，正常秒级）。`tokens.remain_quota` 无显式 type 标签、GORM 默认已映射 bigint，无需处理；`aff_quota` 等邀请额度金额小，本期不动。

> **换算口径（D3 已决策）**：用户只转人民币，模型也按人民币收费，quota 只是内部以美元计的额度单位。换算用**现有系统配置中的汇率参数（7.3）**，它是固定常数、不允许修改，审批界面不提供任何汇率/单价修改入口。管理员审批时唯一可修正的是**实际到账人民币金额**（手续费、实转与申报不符等场景），系统按固定参数自动折算 quota，`credited_fen` 与 `quota_granted` 同时落库留痕，事后可复算验证。

### 2.5 用户侧前端（web/classic 钱包管理页）

`web/classic/src/pages/TopUp/` 内新增「对公转账」卡片（仅 `userState.user.enterprise_status === 2` 且 config.enabled 时渲染）：

- **收款信息区**：四要素展示 + 一键复制按钮（逐项复制）
- **提交区**：转账金额输入（≥ min_amount 校验）、备注（选填）、回执图片上传（必传，复用 KYC 压缩函数）
- **订单状态区**：最近订单列表（待审核可撤销；已拒绝显示原因 + 重新提交入口；已通过显示到账额度）
- 未通过企业认证的用户**看不到**该卡片（不展示"去认证"引导也可以，避免页面噪音——企业认证卡片在个人中心已有曝光）

### 2.6 管理员侧前端

新增 `web/classic/src/pages/BankTransfer/index.jsx`（或并入现有充值管理页签，见【决策点 D4】）：

- 列：用户名、申报金额、备注、提交时间、状态、审核人、操作
- 操作：查看回执（弹窗，关闭清空 state）、通过（弹窗内可修正到账金额，显示折算后的额度预览）、拒绝（填原因）
- 侧边栏 `DEFAULT_ADMIN_CONFIG.admin` 增加 `bankTransfer: true`，路由 `/console/bank-transfer` 入 `cardProPages` 白名单

---

## 三、功能 B：增值税发票

### 3.1 业务规则

- **可开票额度** = 该用户所有「已审批通过的对公转账」`credited_fen` 之和 − 已申请发票（pending + issued）金额之和【决策点 D5：是否扩大到在线充值】
- 用户提交开票申请：金额（≤ 可开票额度）、发票类型（增值税普通发票 / 专用发票）、抬头、税号、收件邮箱、备注
  - 抬头默认预填企业认证的 `company_name`（明文字段，前端直接可得）；税号由用户自己填写（USCC 在库里是密文，不为预填做解密接口）
- 管理员审核：开具后**上传发票文件**（PDF/图片），用户在钱包页下载；或拒绝并填原因【决策点 D6】
- 拒绝后金额自动释放回可开票额度（计算口径只统计 pending + issued）

### 3.2 数据库设计

#### 新增表 `invoice_requests`

```go
// model/invoice.go
const (
    InvoiceStatusPending  = 1
    InvoiceStatusIssued   = 2
    InvoiceStatusRejected = 3

    InvoiceTypeNormal  = 1 // 增值税普通发票
    InvoiceTypeSpecial = 2 // 增值税专用发票
)

type InvoiceRequest struct {
    Id           int            `json:"id"            gorm:"primaryKey;autoIncrement"`
    UserId       int            `json:"user_id"       gorm:"index;not null"`
    AmountFen    int64          `json:"amount_fen"    gorm:"not null"`
    InvoiceType  int            `json:"invoice_type"  gorm:"type:int;not null;default:1"`
    Title        string         `json:"title"         gorm:"type:varchar(128);not null"` // 发票抬头
    TaxNo        string         `json:"tax_no"        gorm:"type:varchar(32);not null"`  // 税号（明文：发票要素本就交付给用户）
    Email        string         `json:"email"         gorm:"type:varchar(128);not null"` // 接收邮箱
    Remark       string         `json:"remark,omitempty"        gorm:"type:varchar(255)"`
    Status       int            `json:"status"        gorm:"type:int;not null;default:1"`
    RejectReason string         `json:"reject_reason,omitempty" gorm:"type:varchar(255)"`
    ReviewedBy   int            `json:"reviewed_by,omitempty"   gorm:"type:int"`
    SubmittedAt  *time.Time     `json:"submitted_at"`
    ReviewedAt   *time.Time     `json:"reviewed_at,omitempty"`
    CreatedAt    time.Time      `json:"created_at"`
    UpdatedAt    time.Time      `json:"updated_at"`
    DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}
```

#### 新增表 `invoice_files`（发票文件，1:1，管理员上传）

```go
type InvoiceFile struct {
    Id        int            `gorm:"primaryKey;autoIncrement"`
    InvoiceId int            `gorm:"uniqueIndex;not null"`
    UserId    int            `gorm:"index;not null"`
    FileName  string         `gorm:"type:varchar(128)"` // 原始文件名（含扩展名，前端据此区分 pdf/图片）
    FileData  string         `gorm:"not null"`          // base64，省略 type 标签（longtext）；不加密——发票本身就是要交付给用户的文件
    CreatedAt time.Time
    UpdatedAt time.Time
    DeletedAt gorm.DeletedAt `gorm:"index"`
}
```

- 上传限制：PDF / JPG / PNG，原文件 ≤ 5MB（base64 后约 6.7MB，longtext 无压力）
- 发票文件**不加密**：它不是平台要保密的核验材料，而是交付物，用户本人可随时下载；省一次加解密复杂度

### 3.3 接口

| 接口 | 权限 | 说明 |
|------|------|------|
| `GET /api/user/invoice/quota` | UserAuth + 企业已认证 | 返回可开票额度（分）+ 抬头预填（企业认证公司名） |
| `GET /api/user/invoice/self` | UserAuth | 自己的发票申请列表 |
| `POST /api/user/invoice` | UserAuth + 企业已认证 + CriticalRateLimit | 提交申请；事务内复核可开票额度，超额拒绝；同一用户最多 1 笔 pending |
| `DELETE /api/user/invoice/:id` | UserAuth | 撤销 pending 申请（条件软删抢占） |
| `GET /api/user/invoice/:id/file` | UserAuth（仅本人）| 下载已开具的发票文件 |
| `GET /api/user/invoice/admin` | AdminAuth | 审核列表 |
| `PUT /api/user/invoice/admin/:id/issue` | AdminAuth | 上传发票文件（base64 JSON）+ 标记已开具（条件更新抢占） |
| `PUT /api/user/invoice/admin/:id/reject` | AdminAuth | 必填原因（条件更新抢占） |
| `GET /api/user/invoice/admin/:id/file` | AdminAuth | 管理员查看已开具的发票文件 |

> **并发口径（2026-06-10 落地修订）**：提交侧"额度校验 + INSERT"的竞态窗口与转账提交同类（已评审接受，不依赖 FOR UPDATE——GORM v2 下无效）；资金安全由**开具时的权威复核**兜底：`IssueInvoice` 事务内校验 `Σ(已开具) + 本笔 ≤ Σ(已通过转账)`，保证开出的发票永远不超过实际到账。issue/reject/cancel 三路径均用条件更新/软删抢占（`WHERE status=pending` + RowsAffected 检查）。

### 3.4 前端

- **用户侧**：钱包管理页「对公转账」卡片旁新增「发票」卡片（同样仅企业已认证可见）：可开票额度展示、申请表单（抬头预填）、申请记录（已开具 → 下载按钮）
- **管理员侧**：与对公转账审核**同页不同页签**（Tabs：转账审核 / 发票审核），共用一个侧边栏入口，减少菜单膨胀【决策点 D4】。里程碑 1 先交付单页（仅转账审核），Tabs 结构随本里程碑（发票）落地时引入

---

## 四、功能 C：子账户

### 4.1 核心设计：账户类型怎么表达？（你提出的关键问题）

三个候选方案的对比：

| 维度 | 方案一：新增 Role 值（如 RoleSubUser=5） | 方案二：权限位 bitmask（permissions int64） | 方案三：`parent_user_id` 关系派生（**推荐**） |
|------|------|------|------|
| 语义 | ❌ Role 在本项目是**线性特权等级**，`authHelper(c, minRole)` 全靠 `role >= minRole` 比较。子账户不是"比普通用户低一级的信任等级"，而是"隶属于某企业的受限视图"，塞进线性序里语义错位（比如 `role=5` 的子账户能通过所有 `minRole<=1` 的检查吗？要么破坏序关系，要么全量重审每个判断点） | ⚠️ 表达力最强，但项目没有任何 bitmask 基建，为一个账户变体引入一整套权限系统，且"子账户属于谁"仍需另一个字段 | ✅ 子账户的本质就是"被某个企业账户拥有"。`parent_user_id > 0` ⇔ 是子账户，一个字段同时回答"是不是"和"属于谁"，单一事实来源 |
| 改动面 | 大：全库 role 比较点逐个排查 | 大：新权限框架 + 旧逻辑适配 | 小：users 加一列 + 一个新中间件 + 4 个查询接口加过滤 |
| 上游合并 | 高风险（role 常量是上游核心） | 高风险 | 低风险（纯增量字段/表/路由） |
| 扩展性 | 差（再来一种账户类型怎么办） | 好 | 够用（未来如需更多账户变体，再演进为 type 字段也只是把 `parent_user_id>0` 的判断换掉，数据不动） |
| 未来"团队多角色" | 不支持 | 支持但超前 | 本期明确不做多角色（需求就是"只读子账户"一种），不为假想需求付费 |

**结论**：不动 Role 体系、不引入权限位。`users` 表新增一列：

```go
// model/user.go — User struct
ParentUserId int `json:"parent_user_id" gorm:"type:int;default:0;index;column:parent_user_id"` // >0 表示子账户，值为企业主账户 user_id
```

子账户的 `Role` 恒为 `RoleCommonUser`（沿用现有所有"普通用户"路径），**收紧**通过黑名单中间件实现（见 4.4），**数据范围**通过查询层过滤实现（见 4.5）。

同步（与 `EnterpriseStatus` 完全同模式）：
- `ToBaseUser()` / `UserBase` / `WriteContext()` / `GetUserCache` Redis-miss 分支补 `ParentUserId`
- `constant/context_key.go` 新增 `ContextKeyUserParentId`
- 中间件侧新增 `readUserParentId(c)`（与 `readUserEnterpriseStatus` 同构）

### 4.2 计费：为什么是零改动（设计根基）

```
子账户从不出现在计费链路里：

  调用方拿着 key 请求 relay
      → TokenAuth 用 key 查 tokens 表 → token.UserId = 企业账户 id
      → PreConsume/PostConsume 全部以 token.UserId 扣减
      → 扣的天然就是企业账户的 quota，日志 user_id 也是企业账户

  「绑定」只是一条查看授权记录，不改变 key 的所有权（tokens.user_id 不动）。
  子账户登录平台只是为了【看】，永远不为了【用】。
```

这意味着：限流、分组、模型限制、信用额度、重试……所有现有计费行为对绑定后的 key 完全不变。**这是整个子账户功能最重要的不变量，实现与评审时都要守住。**

### 4.3 子账户生命周期

#### 创建（企业账户操作）

- 前置：操作者 `enterprise_status==2` 且自身 `parent_user_id==0`（子账户不能再创建子账户，天然防套娃）
- `POST /api/user/sub_account`：`{username, password, display_name}`
  - username 走现有全局唯一校验与格式规则；密码走现有强度规则
  - 创建出的 user：`role=RoleCommonUser, status=enabled, quota=0, parent_user_id=企业id`，**不发放任何注册赠送额度、不参与邀请体系**（`inviter_id` 不写）
- 数量上限：`SubAccountMaxCount`（OptionMap，默认 **10**）【决策点 D7】

#### 企业账户的管理操作

| 接口 | 说明 |
|------|------|
| `GET /api/user/sub_account` | 自己的子账户列表（含每个子账户的绑定 key 数） |
| `POST /api/user/sub_account` | 创建 |
| `PUT /api/user/sub_account/:id/password` | 重置子账户密码 |
| `PUT /api/user/sub_account/:id/status` | 启用/禁用（复用 users.status，禁用后无法登录——现有 UserAuth 已检查 status） |
| `DELETE /api/user/sub_account/:id` | 删除子账户（软删 user）。**前置校验：该子账户名下存在任何绑定记录则拒绝删除**，提示"请先解除全部 key 绑定"（见下方"绑定保护"） |
| `GET /api/user/sub_account/bindings?sub_id=` | 某子账户的绑定 key 列表 |
| `POST /api/user/sub_account/bind` | `{sub_user_id, token_id}` 绑定 |
| `POST /api/user/sub_account/unbind` | 解绑 |

所有接口在 handler 内强校验归属：`sub.parent_user_id == 操作者id`、`token.user_id == 操作者id`，防越权（IDOR）。

#### 绑定保护：已绑定即禁删（D7 附带决策，2026-06-10）

**绑定记录存在期间，绑定双方（key 与子账户）都不可删除，必须先解绑。** 目的：防止"删了 key 子账户日志悬空"、"删了子账户 key 绑定悬空"这类先后顺序导致的脏数据，也强迫操作者明确意识到自己在拆除一条授权关系。

| 操作 | 校验 | 行为 |
|------|------|------|
| 删除子账户（`DELETE /api/user/sub_account/:id`） | 绑定表中存在 `sub_user_id = :id` 的记录 | 拒绝，提示"该子账户绑定了 N 个令牌，请先解除绑定" |
| 删除令牌（`DELETE /api/token/:id`） | 绑定表中存在 `token_id = :id` 的记录 | 拒绝，提示"该令牌已绑定子账户 xx，请先解除绑定" |
| **批量删除令牌** | 同上，逐个校验 | 已绑定的拒绝并列出，未绑定的正常删除（或整批拒绝，实现时取交互更清晰者） |
| 禁用令牌 / 禁用子账户 | 不校验 | **允许**——禁用是可逆的临时管控，不破坏绑定关系 |

> 实现位置：子账户删除在 `controller/sub_account.go` 自有 handler 内校验；令牌删除需在现有 `controller/token.go` 的删除路径（单删 + 批量）插入一次绑定表查询，这是子账户功能对上游 token 写路径唯一的侵入点，保持为"一次 SELECT + 提前 return"的最小改动。

#### 异常路径

- **企业认证被 reset**：已有子账户与绑定**保持可用**（只是看数据，无资金风险），但创建新子账户、新绑定被拒绝（创建/绑定接口实时校验 enterprise_status）【决策点 D8】
- **企业账户被管理员删除**：账号删除路径跟随软删其全部子账户、硬删绑定表记录（参照现有 KYC/企业认证的账号删除跟随处理）。管理员删号是运维级操作，**不受**上述绑定保护约束（逃生通道）

### 4.4 权限收紧：黑名单中间件

新增 `middleware.SubAccountForbidden()`，挂在子账户**不允许**碰的路由上（读 context 的 `ParentUserId`，>0 即 403 "子账户无权进行此操作"）：

| 路由组 | 理由 |
|--------|------|
| `/api/user/topup*`、`/api/user/pay`、`/api/user/amount` | 不能充值 |
| 兑换码使用（`/api/user/topup` 的 redemption 路径） | 不能充值 |
| `/api/token` 的 POST / PUT / DELETE（含批量） | 不能创建/修改/删除令牌 |
| `/api/user/aff*` | 不参与邀请体系 |
| `/api/user/kyc`、`/api/user/enterprise` 的写操作 | 子账户不是独立法律主体，不做认证 |
| `/api/user/sub_account*` | 不能套娃 |
| 签到（checkin）、订阅购买（subscription 写操作） | 一切能改变余额/产生消费承诺的入口全部封死 |
| `/api/user/bank_transfer`、`/api/user/invoice` 写操作 | 对公转账/发票是企业主账户的事 |

**允许保留**：登录、登出、查看自己 profile。Playground 不专门封禁——子账户 quota=0，操练场消费天然失败；前端同时隐藏入口【决策点 D9】。

> ⚠️ **本段早稿曾写"允许保留：改自己密码、2FA/passkey"，已被 M3-4/M3-9 推翻**（见 §9.3）：子账户凭据统一由企业主账户管理，`PUT /self`（改用户名/密码/显示名）、passkey 注册、2FA setup/enable/backup_codes 均挂 `SubAccountForbidden` 后端封死。理由：子账户自设新登录因子会让企业"改密码吊销访问"的预期失效。凡冲突以 §9 为准。

> 实现注意：`SubAccountForbidden` 与 `UserAuth` 之间靠 context key 传递，UserAuth 路径已实时回源 DB（`middleware/auth.go` 会用最新 user 覆盖 session 快照），所以"主账户把某用户改成子账户"这种边缘操作也能即时生效。本期不提供"普通账户转子账户"功能，parent_user_id 只在创建时写入、不可变更。

### 4.5 数据范围：子账户能看什么、怎么过滤

#### key 绑定表

```go
// model/sub_account.go
type SubAccountTokenBinding struct {
    Id           int       `json:"id"            gorm:"primaryKey;autoIncrement"`
    ParentUserId int       `json:"parent_user_id" gorm:"index;not null"`
    SubUserId    int       `json:"sub_user_id"   gorm:"index;not null"`
    TokenId      int       `json:"token_id"      gorm:"uniqueIndex;not null"` // 一个 key 最多绑给一个子账户
    CreatedAt    time.Time `json:"created_at"`
}
```

- **一个 key → 至多一个子账户**（uniqueIndex 兜底）；**一个子账户 → 多个 key**。这是最简单且符合"按人分 key"直觉的形态；如果未来要"多个子账户共看一个 key"，去掉唯一索引即可，表结构不用动
- 用**独立绑定表**而非在 `tokens` 上加 `sub_user_id` 列：tokens 是上游核心表，合并冲突面大；绑定关系的增删也不应触发 token 的 updated 语义

#### 四类数据的过滤实现

子账户请求 self 系接口时，handler 检测 `ParentUserId > 0` 即切换查询：**user_id 用父账户 id，且 token 维度限定在绑定集合内**。

| 数据 | 表/现状 | 子账户查询 | 改动量 |
|------|---------|-----------|--------|
| **使用日志** | `logs` 已有 `token_id`（带索引） | `WHERE user_id={父} AND token_id IN ({绑定集合}) ...` 其余条件不变；`log/self`、`log/self/search`、`log/self/stat`、`log/self/export` 四个接口同处理 | 小：model 层函数加可选 `tokenIds []int` 参数 |
| **任务日志** | `tasks` **无顶层 `token_id` 列**（token id 仅存于 `private_data` JSON 内的 `TaskPrivateData.TokenId`，退款用） | `task/self` 加 `token_id IN ?` 过滤。**实施修正（见 §9.5 第 3 轮）**：早稿误以为 tasks 已有 token_id 真列，实际没有；已给 `Task` 加真列 `token_id` + `BeforeSave` 钩子从 `PrivateData.TokenId` 镜像，AutoMigrate 自动建列、零写路径侵入。老任务 token_id=0 不回填（特性未上线，无历史绑定任务） | 小 |
| **绘图日志** | `midjourneys` **没有 token_id** | ✅ **已决策（2026-06-10）：本期不对子账户开放**。`mj/self` 对子账户直接返回 403（挂 `SubAccountForbidden`），前端隐藏绘图日志菜单。不给 midjourneys 加列、不碰 MJ 写入路径。若未来要开放，再按"加 token_id 列、增量生效"方案扩展 | 零 |
| **数据看板** | `quota_data` 聚合表**没有 token 维度**（按 user+model+小时聚合） | ✅ **已决策（2026-06-10）：不动 quota_data**。子账户的 `data/self` 改为从 `logs` 实时聚合：`SELECT model_name, created_at/3600*3600 AS hour, COUNT(*), SUM(quota), SUM(prompt_tokens+completion_tokens) FROM logs WHERE user_id={父} AND token_id IN (...) AND type=2 AND created_at BETWEEN ... GROUP BY model_name, hour`，返回结构对齐 QuotaData，前端零改动；企业账户/普通用户的看板路径一字不改。子账户看板查询限 30 天窗口 | 中 |

> **为什么不给 quota_data 加 token 维度**：聚合 key 从 `user+model+hour` 变成 `user+token+model+hour` 会让该表行数随 key 数线性膨胀，且触碰上游热路径（`logQuotaDataCache`）。子账户是低频查看场景，从 logs 实时聚合（有 `idx_user_id_id` 索引 + 时间窗限制）完全够用，主账户看板路径一字不改。
>
> **查询窗口**：子账户看板/日志沿用现有的时间窗限制（如日志 30 天窗口），从 logs 聚合的看板默认限 30 天，避免大范围扫表。

#### 子账户的令牌页（只读）

- `GET /api/token`：子账户返回**绑定的 key 列表**（read-only 标记），**含 key 明文**——子账户拿到 key 才能在自己的应用里使用它，这正是绑定的目的【决策点 D11】
- 前端令牌页对子账户隐藏创建/编辑/删除/重置按钮，仅保留查看 + 复制

### 4.6 前端（web/classic）

#### 子账户登录后的视图

侧边栏在 `useSidebar.js` 渲染层根据 `userState.user.parent_user_id > 0` **强制覆盖**（不依赖用户自己的 Setting JSON）：

| 模块 | 子账户 |
|------|--------|
| 数据看板（detail）| ✅（已过滤） |
| 令牌（token）| ✅ 只读 |
| 使用日志（log）/ 任务（task）| ✅（已过滤） |
| 绘图日志（midjourney）| ❌ 隐藏（本期不开放，接口 403）【D10】 |
| **钱包管理（topup）** | ❌ 隐藏 |
| 操练场 / 聊天 | ❌ 隐藏【D9】 |
| 个人设置 | ✅ 但隐藏 KYC/企业认证卡片、邀请卡片，仅保留密码/2FA 等安全设置 |
| 管理员区 | ❌（role=1 本来就没有） |

#### 企业账户的子账户管理页

新增 `web/classic/src/pages/SubAccount/index.jsx`，路由 `/console/sub-accounts`，**仅 `enterprise_status===2` 显示菜单入口**：

- 子账户列表：用户名、显示名、状态、绑定 key 数、创建时间；操作：重置密码 / 禁用 / 删除
- 创建弹窗：用户名 + 密码 + 显示名
- 绑定管理弹窗：左侧该子账户已绑 key，右侧企业自己的未绑 key 列表，双向移动
- 令牌管理页（企业视角）每行可顺带显示"已绑定：子账户名"徽标（绑定列表接口返回映射即可，低优先级）

#### i18n

全部新增中文 key 在 8 个 locale（zh/zh-CN/zh-TW/en/fr/ja/ru/vi）同步补齐，关键词：对公转账、收款单位、收款账号、开户行、转账回执、到账金额、可开票额度、增值税发票、发票抬头、税号、子账户、绑定令牌、重置密码等。

---

## 五、改动文件清单（汇总）

### 新增文件

| 文件 | 说明 |
|------|------|
| `model/bank_transfer.go` | 转账订单 + 回执表 + CRUD + 审批事务 |
| `model/invoice.go` | 发票申请 + 文件表 + 可开票额度计算 |
| `model/sub_account.go` | 绑定表 + 子账户 CRUD + 归属校验 |
| `dto/bank_transfer.go` / `dto/invoice.go` / `dto/sub_account.go` | 请求/响应 DTO |
| `controller/bank_transfer.go` / `controller/invoice.go` / `controller/sub_account.go` | 用户侧 + 管理员侧 handler |
| `setting/payment_bank_transfer.go` | 对公转账收款配置 |
| `middleware/sub_account.go` | `SubAccountForbidden` + `readUserParentId` |
| `web/classic/src/pages/BankTransfer/index.jsx` | 管理员：转账/发票审核页（双页签） |
| `web/classic/src/pages/SubAccount/index.jsx` | 企业：子账户管理页 |
| `web/classic/src/components/topup/cards/BankTransferCard.jsx`、`InvoiceCard.jsx` | 钱包页两张卡片 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `model/user.go` | `ParentUserId` 字段；账号删除路径跟随处理子账户/绑定/转账/发票表 |
| `model/user_cache.go` / `constant/context_key.go` | ParentUserId 进缓存与 context |
| `model/main.go` | AutoMigrate 新表 ×5 |
| `model/topup.go` | 两个常量 |
| `model/log.go` / `model/task.go` / `model/usedata.go` | self 查询支持 tokenIds 过滤；看板 logs 聚合函数 |
| `controller/log.go` / `task.go` / `usedata.go` / `token.go` | 子账户分支（切父 id + 绑定集合过滤；token 列表只读分支；token 单删/批量删插入绑定保护校验，D7） |
| `router/api-router.go` | 新路由 + `SubAccountForbidden` 挂载（含 `mj/self`，D10） |
| `web/classic/src/pages/Setting/Operation/SettingsGeneral.jsx` | 汇率与额度展示类型置灰锁定（D3 附带） |
| `web/classic` | TopUp 页挂卡片、useSidebar 子账户覆盖 + 新菜单、令牌页只读模式、个人设置卡片隐藏、路由注册、8 locale i18n |

---

## 六、实施顺序（三个功能可独立交付）

**里程碑 1：对公转账**（最高优先级，直接产生收入）
1. setting 配置 → model（订单+回执+事务）→ controller → 路由
2. 前端：支付设置表单 → 钱包卡片 → 审核页

**里程碑 2：发票**（依赖转账数据）
3. model（申请+文件+额度计算）→ controller → 路由 → 前端两端

**里程碑 3：子账户**
4. users.ParentUserId + 缓存/context 打通 → 绑定表 + 子账户 CRUD
5. `SubAccountForbidden` 全量挂载（先封死写入口）
6. 数据过滤（log → task → 看板 logs 聚合；绘图日志不开放，仅挂 403）
7. 前端：子账户管理页 → 侧边栏覆盖 → 令牌只读 → i18n

---

## 七、测试验收要点

### 对公转账
- 未认证用户：卡片不可见，直连 POST 返回 403
- 提交（金额 < min_amount 拒绝；无回执拒绝；已有 pending 拒绝）
- 审批：通过后 quota 增加、topups 出现 success 流水、充值日志可见；两管理员并发审批仅一个成功（行锁幂等）；修正到账金额生效且留痕
- 回执：列表接口不含大字段；查看回执写审计日志；DB 中为密文

### 发票
- 可开票额度 = 通过的转账 − (pending+issued)；拒绝后额度释放
- 超额申请被服务端拒绝；文件上传/下载闭环；非本人下载 403

### 子账户
- **计费不变量**：绑定前后，key 的 relay 行为完全一致（限流/分组/扣费对象均为企业账户）
- 黑名单：子账户直连充值/令牌写/兑换/签到/aff 等接口全部 403
- 数据隔离：子账户 A 看不到子账户 B 绑定 key 的日志；看不到企业未绑定 key 的日志；看板数字与按 token 手工汇总一致
- 越权：企业 X 不能绑企业 Y 的 token / 不能管理 Y 的子账户（IDOR 全套）
- 生命周期：禁用子账户即无法登录；企业认证 reset 后存量子账户可用、新建被拒
- 绑定保护：删除已绑定的子账户被拒（提示绑定数量）；删除/批量删除已绑定的 key 被拒（提示绑定的子账户）；解绑后删除成功；禁用 key/子账户不受绑定限制

---

## 八、决策点（已全部评审确定，2026-06-10）

| # | 决策点 | 候选 | 推荐 |
|---|--------|------|------|
| **D1** | 新表金额单位 | a) int64 分；b) float64 元（与 topups.money 一致） | ✅ **已决策（2026-06-10）：a**。附带实现规约见 §2.3（Fen 后缀命名 / 统一换算函数 / 前端字符串解析 / 4 个边界点） |
| **D2** | 回执图片存储 | a) 独立表 + 加密（同 KYC 图片模式）；b) 订单表大字段 + 查询 Omit | ✅ **已决策（2026-06-10）：a** |
| **D3** | 到账额度折算 | a) 系统自动折算，审批时仅可修正到账金额；b) 管理员审批时手填最终额度 | ✅ **已决策（2026-06-10）：a**。换算参数=现有系统配置 `USDExchangeRate`（7.3，元→美元额度），不允许修改、界面无修改入口；管理员只确认/修正实际到账人民币金额，quota 由系统折算并落库留痕。**附带**：系统设置页将 `USDExchangeRate` 与 `quota_display_type` 置灰锁定防误操作（见 §2.2） |
| **D4** | 管理员审核页形态 | a) 转账+发票同页双页签，一个菜单入口；b) 两个独立页面 | ✅ **已决策（2026-06-10）：a** |
| **D5** | 可开票范围 | a) 仅对公转账到账金额；b) 全部成功充值（含在线支付） | ✅ **已决策（2026-06-10）：a**。在线充值开票牵涉支付平台流水核对，后续再扩 |
| **D6** | 发票交付方式 | a) 管理员上传文件、用户在线下载；b) 线下邮件发送、系统只记状态 | ✅ **已决策（2026-06-10）：a** |
| **D7** | 子账户数量上限默认值 | 10 / 20 / 50（OptionMap 可调） | ✅ **已决策（2026-06-10）：10**，后台可调。**附带：绑定保护规则**——已绑定的 key 与子账户均禁止删除，须先解绑（见 §4.3"绑定保护"），禁用不受限 |
| **D8** | 企业认证 reset 后子账户 | a) 保留可用，冻结新建/新绑定；b) 全部自动禁用 | ✅ **已决策（2026-06-10）：a**。纯只读无资金风险，避免误伤正常使用 |
| **D9** | 子账户与操练场/聊天 | a) 前端隐藏 + quota=0 天然失败，不专门封接口；b) 中间件显式封禁 | ✅ **已决策（2026-06-10）：a**。操练场消费走登录用户自身 quota（子账户恒为 0），绕过前端直调也花不掉企业的钱 |
| **D10** | 绘图日志按 key 过滤 | a) midjourneys 加 token_id 列（增量生效，老数据子账户不可见）；b) 本期子账户不提供绘图日志 | ✅ **已决策（2026-06-10）：b**。子账户菜单隐藏绘图日志、`mj/self` 返回 403；不动 midjourneys 表和 MJ 写入路径。未来需要时按 a 方案扩展 |
| **D11** | 子账户能否看到绑定 key 明文 | a) 能（子账户要拿 key 去用）；b) 不能（key 由企业线下分发） | ✅ **已决策（2026-06-10）：a** |
| **D12** | 子账户能否看到 key 的剩余额度（token.RemainQuota）| a) 能（只读展示）；b) 隐藏额度字段 | ✅ **已决策（2026-06-10）：a**。企业账户的总余额（users.quota）不向子账户下发 |

---

## 附：三功能依赖关系

```
企业认证（已上线）
    ├── 对公转账充值（A）──► 增值税发票（B，开票额度依赖 A 的到账记录）
    └── 子账户（C，独立，仅依赖企业认证状态）
```

A/C 可并行开发；B 依赖 A 的数据模型先行落地。

---

# 九、实施记录与交接（2026-06-11 更新）

> 本章是给**接手 agent** 的单一事实来源。读完本章即可知道：已经做了什么、为什么这么做、
> 当前代码处于什么状态、下一步必须做什么。前面 §一~§八 是原始设计，本章记录**实施过程中
> 的实际落地与对设计的偏差/补充决策**，凡与前文冲突处**以本章为准**。

## 9.1 总体进度快照

| 里程碑 | 状态 | 备注 |
|--------|------|------|
| **M1 对公转账** | ✅ 已完成、已提交、已过 4 轮 Codex 评审收敛 | commit `2ddbfd6ca` |
| **M2 增值税发票** | ✅ 已完成、已提交（含并发超开修复） | commit `20105463f` + `4eeb74c4d` |
| **M3 子账户** | 🟡 **代码全部完成、两端构建通过、已过 2 轮 Codex 评审收敛、但尚未提交** | 全部在工作区未提交（见 9.5） |

**当前分支**：`feat/bank-transfer`（M1+M2 已提交在此分支；M3 改动未提交叠在其上）。
该分支为本地分支，尚未推送、尚未建 PR——按用户要求"封存"，等用户决定何时推。

**构建验证基线**（每轮改完都跑过，接手后改动也必须保持绿）：
- 后端：`go build ./...` + `go vet ./controller/... ./model/... ./middleware/... ./router/...`
- 前端：`cd web/classic && bun run build`
- 冒烟：`go build -o /tmp/x . && PORT=33xxx /tmp/x`，确认无 gin 路由冲突 panic、SQLite AutoMigrate 无错（`sub_account_token_bindings` 表 + `users.parent_user_id` 列建出）

## 9.2 M3 子账户——实际落地清单（与 §四 设计一致，下列为最终实现）

**新增文件**
- `model/sub_account.go`：`SubAccountTokenBinding` 表；子账户 CRUD（`CreateSubAccount` 走专用路径：quota=0、不发赠送额度、不写 inviter、事务内复检数量上限防并发越限）；绑定/解绑（事务内强校验归属 + token 唯一性）；绑定保护查询；`cascadeDeleteSubAccountsForParent`（企业删号级联）。文件头记录了"已知并接受的竞态"（见 9.4）。
- `setting/operation_setting/sub_account_setting.go`：`SubAccountMaxCount` 默认 10（D7），走 `config.GlobalConfig.Register`，`GetSubAccountMaxCount()` 对非法值回退 10。
- `middleware/sub_account.go`：`SubAccountForbidden()`（role≥Admin 放行；`parent_user_id>0` → 403）+ `readUserParentId()`（与 `readUserEnterpriseStatus` 同构：先读 context key，UserAuth 链路回源 `GetUserCache`）。
- `dto/sub_account.go`：请求/响应 DTO。
- `controller/sub_account.go`：8 个子账户管理 handler（创建/列表/重置密码/启停/删除/绑定列表/绑定/解绑），全部 `requireEnterpriseApproved` 前置 + handler 内 IDOR 归属校验。**另含两个共享 helper**：`resolveSelfDataScope`（日志/任务/看板用）与下文令牌读接口共用思路。JSON 解码统一用 `common.DecodeJson`（CLAUDE.md Rule 1）。
- `web/classic/src/pages/SubAccount/index.jsx`：企业主的子账户管理页（列表 + 创建弹窗 + 重置密码弹窗 + 绑定管理弹窗）。绑定弹窗的令牌选择器用**远程搜索**（`GET /api/token/search`，300ms 防抖）突破 100 条分页上限。

**关键修改文件**
- `model/user.go`：`User` 加 `ParentUserId`（真列，index）+ `ParentUsername`（瞬态 `gorm:"-:all"`，仅管理员列表填充展示归属）；`ToBaseUser` 同步；`User.Delete()`（软删）与 `HardDeleteUserById()`（硬删）**两条删除路径都加了子账户级联**（软删子账户 + 硬删绑定）；新增 `FillParentUsernames`（批量填充避免 N+1）。
- `model/user_cache.go` / `constant/context_key.go`：`UserBase` 加 `ParentUserId`，`WriteContext`/`GetUserCache` 同步，新增 `ContextKeyUserParentId`。
- `model/log.go`/`task.go`/`usedata.go`：self 查询加可选 `tokenIds []int` 过滤（logs `GetUserLogs`/`ExportUserLogs`/`SumUsedQuota`、task `SyncTaskQueryParams.TokenIds`）；看板新增 `GetQuotaDataFromLogsByTokenIds`（从 logs 实时聚合，**不动 quota_data**，小时分桶用 `created_at - created_at%3600` 跨库通用）。
- `model/token.go`：`SearchUserTokens` 加 `tokenIds []int` 过滤；新增 `GetTokensByIdsAndUser`。
- `controller/log.go`/`task.go`/`usedata.go`：用 `resolveSelfDataScope(c)` 切换"子账户→父 id + 绑定集合"。**关键安全点**：子账户空绑定集合时短路返回空，**绝不把空集合当成不过滤**（否则泄漏企业主全量数据）。
- `controller/token.go`：4 个令牌读接口（`GetAllTokens`/`SearchTokens`/`GetToken`/`GetTokenKey`）**统一收口到 `resolveTokenReadScope(c)`**——子账户切父 id、限定绑定集合、列表脱敏分页切片、取 key 校验绑定归属。`DeleteToken`/`DeleteTokenBatch` 加绑定保护（已绑定令牌拒删）。
- `controller/user.go`：`GetSelf` + `setupLogin` 下发 `parent_user_id`/`enterprise_status`/`kyc_status`（**登录态必须带这些字段，否则前端子账户视图覆盖失效**）；`GetAllUsers`/`SearchUsers` 调 `FillParentUsernames`；`ManageUser` 的 `promote`/`demote` 对 `parent_user_id>0` 拒绝。
- `router/api-router.go`：`SubAccountForbidden` 挂载到充值/支付/令牌写/兑换/签到/aff/KYC写/企业写/对公转账写/发票写/订阅写/`mj/self`/`DELETE /self`/`sub_account/*`；新增 8 条 `sub_account` 路由（绑定/解绑用 `/:id/bind`、`/:id/unbind` 避免 gin 静态/参数同级冲突）。
- 前端多文件：`SiderBar.jsx`（子账户菜单强制覆盖）、`UserArea.jsx`（头像下拉隐藏钱包/个人设置）、`StatsCards.jsx`（看板隐藏充值按钮）、`PersonalSetting.jsx`（隐藏 KYC/企业卡片）、`TokensTable/TokensColumnDefs/TokensActions`（令牌页只读）、`UsersColumnDefs.jsx`（角色/分组/归属/操作按钮）、`render.jsx`（subAccounts 图标）、`App.jsx`（路由）、`PageLayout.jsx`（登录后拉 /self 刷新登录态）。

## 9.3 M3 实施期补充决策（§八 之外，实施/联调中新增，**接手必须遵守**）

| 编号 | 决策 | 结论与理由 |
|------|------|-----------|
| **M3-1** | 登录态字段下发 | `setupLogin` 与 `GetSelf` 都必须返回 `parent_user_id`/`enterprise_status`/`kyc_status`。`PageLayout.loadUser` 加载本地快照后**异步拉一次 `/api/user/self`** 刷新——覆盖旧版本登录的存量用户、管理员中途改状态。前端所有子账户视图覆盖依赖这些字段即时生效。 |
| **M3-2** | 令牌读接口统一收口 | 4 个令牌读接口（list/search/detail/key）全部走 `resolveTokenReadScope`。绑定 key 的 `tokens.user_id` 留在企业主身上，子账户所有读接口必须切"父 id + 绑定集合"，否则按子账户自身 id 查恒为空。**新增令牌读接口必须复用该 helper。** |
| **M3-3** | 钱包/个人设置/聊天/绘图 对子账户隐藏（前端三处入口都要堵） | 不止侧边栏：① `SiderBar` 个人中心组隐藏钱包+个人设置、聊天组整组隐藏、绘图日志隐藏；② 头像下拉 `UserArea` 隐藏钱包+个人设置；③ 数据看板 `StatsCards` 余额卡隐藏"充值"按钮。**新增任何指向充值页/个人设置的入口都要同步对子账户隐藏。** 注意：前端隐藏只是体验，后端 `SubAccountForbidden` 才是安全边界。 |
| **M3-4** | 个人设置对子账户隐藏（连带影响） | 用户选择隐藏整个"个人设置"页。连带后果：子账户**无法自助改密码/设 2FA/Passkey**——密码改由企业在子账户管理页重置（已实现）。因此管理员侧"重置 Passkey/2FA"对子账户**无的放矢**，已在管理员用户表对子账户行隐藏。 |
| **M3-5** | 管理员用户表对子账户的呈现 | ① 角色列：`parent_user_id>0` 显示**紫色"企业子用户"**，`enterprise_status===2`（非子）显示**青色"企业用户"**，管理员/超管不变；② 分组列：子账户显示灰色 `-`（其 group 纯惰性，计费走企业主，显示会误导）；③ 用户名列：子账户下方加灰字 `隶属 {企业主用户名}（#id）`（方案 A，后端 `FillParentUsernames` 批量填充）。 |
| **M3-6** | 管理员对子账户的操作面收敛 | 子账户行**只保留 禁用/启用、编辑、注销**。隐藏 **提升/降级**（提升有害：会造出绕过限制的矛盾管理员；后端 `ManageUser` promote/demote 已对 `parent_user_id>0` 加守卫兜底）、**订阅管理/重置Passkey/重置2FA**（对子账户无意义）。`Edit()` 是白名单更新（username/display_name/group/remark/password），**不碰 parent_user_id 也不碰 quota**，编辑子账户安全。 |
| **M3-7** | 工单（我的工单）对子账户开放 | 用户确认：子账户与企业主的工单**各归各的**（按各自 user_id 隔离），符合预期。工单路由**不挂** `SubAccountForbidden`，菜单保留。不做企业聚合。 |
| **M3-8** | 跨库与边界 | 子账户令牌列表分页用内存切片（绑定数小），并对 `GetPageQuery` 不钳位的负数 `p` 自防越界 panic。看板 logs 聚合限 30 天窗口。 |
| **M3-9** | 子账户凭据自管后端封死（第 3 轮 Codex，落实 M3-4 意图，**推翻 §4.4 早稿**） | M3-4 定下"子账户凭据由企业主管理"，但**后端一度只前端隐藏个人设置、未堵接口**——子账户直连 API 仍可 `PUT /self` 自改用户名/密码/显示名、自设 passkey/2FA。按 §9.7-4"后端才是安全边界"，已给 `PUT /self`、`passkey/register/begin+finish`、`2fa/setup+enable+backup_codes` 全挂 `SubAccountForbidden`（`router/api-router.go`）。**保留** passkey verify/delete、2fa disable/status（减因子无害，且 delete/disable 是降权）。理由：子账户自设新登录因子会让企业"改密码吊销访问"失效（企业真正的吊销手段是禁用，禁用拦一切登录含 passkey，不受影响）。前端三处 `PUT /self` 调用方均在已隐藏的个人设置页内，堵后不会弹 403。 |

## 9.4 已知并接受的竞态/限制（评审确认，**不修**，接手勿当 bug 重开）

- **删子账户/删令牌 vs 并发绑定**：`DeleteSubAccount`（事务内查绑定）与 `DeleteToken/Batch`（绑定保护检查在删除事务外）与并发 `bind` 交错，极端情况可能残留一条孤儿绑定记录。后果仅为企业主绑定列表多一条可手动解绑的记录，**不泄漏、不涉资金**，且为管理 UI 单人低频操作，故不上跨表行锁（对比 `IssueInvoice` 上了用户行锁是因为涉及资金）。详见 `model/sub_account.go` 文件头注释。
- **子账户的 group/quota/订阅** 为惰性字段（子账户不发起计费流量，绑定 key 计费走企业主）：管理员给子账户调分组/加额度/发订阅均无实际效果，不报错、无害，**有意不在编辑弹窗对子账户禁用这些字段**（打磨性价比低）。
- **任务 `token_id` 老数据不回填**：第 3 轮加的 `tasks.token_id` 真列对 AutoMigrate 之前的存量任务为 0，子账户看不到加列前的历史任务。接受理由：企业子账户特性尚未上线，不存在历史绑定任务；真回填需解析 `private_data` JSON（跨库 JSON 操作，撞 Rule 2），收益≈0。新任务由 `BeforeSave` 钩子正常回填。
- **i18n**：站点已锁定简体中文 + 隐藏语言切换，`t()` 对无翻译键回退中文 key，故 M3 新增中文 UI 在 zh-CN 下显示正常。**未**对其余 6 语种（zh-TW/en/fr/ja/ru/vi）批量翻译前端新增 key（无可见收益）。后端 i18n 仅 `sub_account.forbidden` 补了 zh-CN/zh-TW/en 三语。**若未来要开放多语种，需补前端 locale。**

## 9.5 评审记录（M3，已收敛）

- **第 1 轮 Codex**：4 条 → 全修。①硬删用户未级联子账户/绑定（数据死锁隐患，已在 `HardDeleteUserById` 补级联）；②绑定弹窗只能选前 100 个令牌（改远程搜索）；③子账户令牌列表忽略分页（改内存切片 + 防越界）；④JSON 未走 `common.DecodeJson`（已替换）。
- **第 2 轮 Codex**：1 条 → 全修。令牌 search/detail 接口仍按子账户自身 id 查（已统一收口到 `resolveTokenReadScope`，4 个读接口一致）。
- 此后又做了 M3-3~M3-8 的 UI 精化（用户逐项确认）。
- **第 3 轮 Codex（覆盖 M3-3~M3-8 UI/守卫精化）**：报 3 项，处置如下：
  - **P1 任务过滤撞 `tasks` 无 `token_id` 真列** → 修：`Task` 加真列 + `BeforeSave` 镜像 `PrivateData.TokenId`（`model/task.go`），AutoMigrate 自动建列，冒烟确认。详见 §4.5 已更正。
  - **P2 `batch/keys` 未走子账户 scope** → 修：`GetTokenKeysBatch` 改走 `resolveTokenReadScope` + `isBound` 过滤 + 空绑定短路（`controller/token.go`）。
  - **P2 `PUT /self` + passkey/2FA 子账户可直连自管凭据** → 修：见 M3-9（全挂 `SubAccountForbidden`）。
  - **（同轮再报）老任务 token_id 不回填** → **已知接受**（见 §9.4），特性未上线无历史绑定任务，不回填。
  - **绘图日志是否同法开放** → 用户决定**维持 D10 现状不动**（不碰 MJ 写路径）。
- **第 4 轮 Codex（覆盖 §9.8 UI/字段/令牌名/凭据封堵全量）**：报 1 条 P1 → 全修。子账户页 `columns` 的 `useMemo` 写在 `if(!isEnterpriseOwner) return` 之后，登录态刷新（M3-1 的 `/api/user/self` 流程）使 `isEnterpriseOwner` false→true 时 hook 数量变化 → React「Rendered more hooks」崩页。修：`columns` 改普通 const（`baseColumns` 本就每次 render 重算，零性能影响），消除条件 return 后的唯一 hook。
- **第 5 轮 Codex**：报 2 条，处置：
  - **P1「子账户经 access token 绕过 `SubAccountForbidden`」→ 经核实为误报**。`readUserParentId`（middleware/sub_account.go）不依赖 UserAuth 写的 context key，miss 时用 `c.GetInt("id")` 回源 `GetUserCache(id).ParentUserId`；access-token 分支（auth.go 的 authHelper）已设正确的 `id`，故挂 `SubAccountForbidden` 的写路由仍能 403。不改。
  - **P2「BeforeSave 可能把 token_id 清零」→ 实际无清零路径**（所有 struct 存盘都加载完整 task、PrivateData.TokenId 完整；批量走 map 更新不碰 token_id；老任务被加载后反而回填），但加了 1 行护栏 `if t.PrivateData.TokenId != 0` 作未来兜底（`model/task.go`）。
- 第 4/5 轮修复（hooks const 化 + token_id 护栏）后已收敛。

## 9.6 交接：接手 agent 的待办（按顺序）

> 用户的工作流约定（务必遵守）：**改完不要擅自 commit**；用 Codex review，逐条分析合理性，
> 与用户讨论后由用户决策是否修改，修完重新全量 review，直到用户认为收敛。

1. **【立即可做】对 M3-3~M3-8 的 UI/守卫精化跑一轮 `/codex:review`**（工作区 diff），把发现逐条分析后交用户决策。这是当前唯一悬空的验证项。
2. **收敛后等用户指令再提交**。提交建议拆分：M3 主体一个 commit（`feat(enterprise): 企业子账户（里程碑3）`），其后各轮评审修复可合入或单独 commit，参照 M1/M2 的 commit 粒度。**不要自己推送/建 PR**，等用户决定。
3. **人工验收**（按 §七"子账户"清单 + 9.3 各项）：重点验
   - 计费不变量：子账户用绑定 key 调用，扣的是企业主 quota、日志 user_id=企业主、限流/分组不变；
   - 数据隔离：子账户只看到自己绑定 key 的日志/任务/看板，看不到企业其他 key；空绑定时全部返回空（不是全量）；
   - 黑名单：子账户直连充值/令牌写/兑换/签到/aff/认证/对公转账/发票写/`mj/self`/`DELETE /self` 全 403；
   - 令牌页：子账户只读（无增删改、无批量、无搜索泄漏），能看绑定 key 列表 + 点按取明文 key + 看余额；
   - 生命周期与绑定保护：禁用子账户即无法登录（但绑定 key 照常工作）；删已绑定的子账户/令牌被拒；删企业主级联清理子账户+绑定；
   - 管理员侧：用户表角色色/分组`-`/隶属标签正确；子账户行只剩禁用·编辑·注销；promote/demote 子账户被后端拒。
4. **可选的未来增强**（用户已知、本期不做，勿擅自开工）：
   - 反向归属视图（企业主看名下子账户：方案 C 筛选/方案 B 展开行，见对话）；
   - 子账户绘图日志（D10 的 a 方案：midjourneys 加 token_id 列）；
   - 在线充值开票（D5 b）；
   - 前端 6 语种 i18n 补全；
   - 编辑弹窗对子账户禁用 group/quota/订阅字段（打磨）。

## 9.7 给接手 agent 的关键不变量（一句话清单，改任何代码前先确认不破坏）

1. **计费零改动**：绑定只是查看授权，`tokens.user_id` 永远不变，子账户永不进计费链路。
2. **空绑定集合 ≠ 不过滤**：任何子账户数据/令牌读接口，空绑定必须短路返回空。
3. **令牌读接口必走 `resolveTokenReadScope`**；自身数据（日志/任务/看板）必走 `resolveSelfDataScope`。
4. **后端是安全边界**：前端隐藏只是体验；新增任何写入口/敏感读，都要评估是否挂 `SubAccountForbidden` 或在 handler 校验 `parent_user_id`。
5. **`parent_user_id` 只在创建时写、不可变更**；`Edit()` 不得纳入该字段；删除两条路径都要级联清理绑定。
6. **登录态三字段**（parent_user_id/enterprise_status/kyc_status）必须随 `setupLogin`/`GetSelf` 下发。

## 9.8 M3 UI/字段精化轮（2026-06-11，第 3 轮 Codex 之后的用户逐项打磨）

> 本节记录 M3 主体落地后，用户对**子账户管理页**与**绑定弹窗**逐项验收提出的 UI/字段需求及实现。
> 全部为 `web/classic` 前端 + 少量后端字段补充，**计费链路与安全边界不变**（§9.7 全部仍成立）。
> 这些改动**尚未经 Codex 复审**，接手如继续改动需纳入下一轮 review。

### 9.8.1 子账户管理页重构为「用户管理」同款范式（M3-10）

- **动机**：原页面用裸 `Card + Table`，未充分利用页面、无分页、无密度切换。
- **落地**（`web/classic/src/pages/SubAccount/index.jsx`）：改用 `CardPro type='type1'` + `CardTable` + `CompactModeToggle` + `createCardProPagination`，与 `components/table/users/` 一致：
  - `descriptionArea`：标题（子账户管理 + 企业专属 Tag）+ 右上角**紧凑列表切换**；
  - `actionsArea`：**「创建子账户」按钮移到工具栏**（参照「添加用户」，`size='small'` 素色，满额 disabled）+ 右侧**「子账户数量：N / 上限」计数 Tag**（满额变橙色）。早稿把数量塞在说明句尾显示为「N/上限」语义不清，**已改为独立带标签的计数**；
  - **分页**：客户端切片（子账户上限小、后端一次返回全部），`createCardProPagination`，pageSize 10/20/50/100；
  - 操作列 `fixed:'right'` + `width:340`、**表头与按钮左对齐**（分割线紧贴「管理绑定」，不再右对齐留大留白）。

### 9.8.2 字段增删（M3-11）

- **删「显示名」**：列表列与创建表单字段一并移除（用户名已足够标识，显示名对只读子账户无意义）。创建请求不再带 `display_name`。
- **加「最后使用时间」列**：取该子账户**绑定令牌中 `max(accessed_time)`**；无绑定/从未使用显示 `-`。
  - 后端新增 `model.GetLastUsedTimesByParent(parentId) map[int]int64`：**不用 JOIN**（先取绑定关系，再 `token_id IN (...)` 单查 `accessed_time`，纯 GORM 三库通用），`GetSubAccounts` 填充 `SubAccountResponse.LastUsedTime`。

### 9.8.3 绑定弹窗对齐「令牌管理」（M3-12）

- **额度按额度展示类型显示**：原写死 `$`，改用站点统一 `helpers/render.jsx` 的 `renderQuota()`（按 `quota_display_type` 渲染，CNY 下显示 `¥`+汇率）。
- **额度拆三列**（措辞对齐令牌管理）：**已用额度** / **剩余额度（带百分比）** / **总额度**；`unlimited_quota` 时剩余额度与总额度两列显示**「无限额度」圆角 Tag**（`color='white' shape='circle'`），已用额度仍显实际值。
- **删「密钥」列**：绑定弹窗不再展示/复制明文 key（连带移除未用的 `copy` import）。注意：D11「子账户可见绑定 key 明文」仍由**子账户自己的令牌页**承载（`resolveTokenReadScope`），此处是**企业主的绑定管理视图**，去掉 key 展示不影响 D11。
- **加 状态 / 分组 / 可用模型 / 过期时间 列**（对齐令牌管理渲染）：
  - 状态：令牌四态 Tag（1 已启用绿 / 2 已禁用红 / 3 已过期黄 / 4 已耗尽灰）；
  - 分组：`auto`→「智能熔断」Tag，否则分组名（空→默认）；
  - 可用模型：未启用模型限制→「无限制」Tag，启用→「N 个模型」蓝 Tag + Tooltip 列出完整模型；
  - 过期时间：`-1`→「永不过期」，否则格式化时间。
  - 后端 `SubAccountBindingResponse` 补 `used_quota`/`unlimited_quota`/`group`/`expired_time`/`model_limits_enabled`/`model_limits`。
- **禁用/过期整行变灰**：`onRow` 对 `status !== 1` 的行设背景 `var(--semi-color-disabled-border)`（与令牌管理 `useTokensData.handleRow` 同色值同逻辑，覆盖禁用/过期/耗尽）。
- **高度封顶**：绑定数 ≤10 全展示；**>10 限高约 10 行 + 垂直滚动条**（`scroll.y=420`），避免 20 个 key 时弹窗被拉很长；横向 `scroll.x='max-content'` 兜 9 列。弹窗宽度 960。

### 9.8.4 令牌名称同账户唯一（M3-13，**影响全站令牌写路径，非仅子账户**）

- **动机**：绑定弹窗按**名称**远程搜索本企业令牌；同账户重名令牌会让「按名搜索 + 绑定」指向歧义、绑错对象，子账户也难按名识别。
- **落地**：`model.IsTokenNameDuplicated(userId, name, excludeId)`（空名不去重、排除自身、软删天然过滤、`name` 非保留字三库通用）。
  - `AddToken`：创建必查重名 → 重复报「令牌名称已存在，请使用不同的名称」；
  - `UpdateToken`：**仅当名称变化时**查重（历史重名令牌改额度等无关字段不被误拦，改名撞名才拦）。
- **范围说明**：这是对**全站令牌管理写路径**的校验（不只企业账户）。存量重名令牌不受影响，但日后给它们改名撞名会被拦——即「防重名好管理」的目的。若仅想限企业账户范围，需另加条件收窄（当前未收窄）。

### 9.8.5 后台可调子账户上限（M3-14）

- 在**系统设置 → 运营设置 → 通用设置**「用户最大令牌数量」右侧新增**「企业账户最大子账户数量」**输入框（`web/classic/src/pages/Setting/Operation/SettingsGeneral.jsx`），字段 `sub_account_setting.max_count`，默认 10，`min=1`。
- 复用 `PUT /api/option` + `handleConfigUpdate` 通用分层 option 机制（**零后端改动**）：存盘 → 写入 `subAccountSetting.MaxCount` → `GetSubAccountMaxCount()` → `GET /api/user/sub_account` 的 `max_count` → 子账户页计数 Tag 实时反映新上限。

### 9.8.6 本轮新增/触碰文件清单

| 文件 | 改动 |
|------|------|
| `web/classic/src/pages/SubAccount/index.jsx` | 整页重构 + 全部上述列/弹窗/分页/行样式 |
| `web/classic/src/pages/Setting/Operation/SettingsGeneral.jsx` | 新增子账户上限输入框 |
| `dto/sub_account.go` | `SubAccountResponse.LastUsedTime`；`SubAccountBindingResponse` 补 6 字段 |
| `model/sub_account.go` | `GetLastUsedTimesByParent` |
| `controller/sub_account.go` | 列表填 `LastUsedTime`；绑定填 group/expired/model_limits/used/unlimited |
| `model/token.go` | `IsTokenNameDuplicated` |
| `controller/token.go` | `AddToken`/`UpdateToken` 名称去重校验 |

## 9.9 M1~M3 上线前打磨轮（2026-06-11，钱包卡片 / 对公转账审核 / 审核红点）

> 本节记录三个里程碑全部合入后、上线前对**对公转账与发票**端到端的用户逐项打磨，
> 以及给管理员加的**审核待办红点**。除标注外均为 `web/classic` 前端 + 少量后端字段/接口。
> 计费链路与安全边界不变。**未经 Codex 复审项**：本节最后一轮 Codex 仅报 1 条
> review_remark 迁移误报（本项目靠 AutoMigrate 增量建列，BankTransferOrder 在迁移列表内，
> 重启即建列，非问题）。

### 9.9.1 钱包页卡片布局（`components/topup/index.jsx` + 卡片）

- **对公转账 / 增值税发票置于「账户充值 / 邀请奖励」上方**，两卡左右布局
  （`grid lg:grid-cols-2 items-start gap-4 md:gap-6`，间距对齐个人设置），
  外层用 `enterprise_status===2` 把关，非企业用户不渲染、无留白。
- **卡片头部统一为「圆形图标 + 标题 + 说明小字」**（对齐账户充值/邀请奖励）：
  对公转账用 `indigo` + Landmark，发票用 `orange` + ReceiptText（底色避开已用的 blue/green）；
  去掉旧的「企业专属」Tag 与 `Title` 标题样式。
- **对公转账卡片改竖排**：上=收款信息、中=提交订单、下=转账记录（不再左右分栏）。
  收款信息（开户行/账号等长值）`break-all` **完整换行显示**，不再省略号截断。
  提交区内部左右两栏：左=转账金额+备注、右=回执上传+提交按钮。
- **必填红星**：对公转账「转账金额（元）」「转账回执」、发票「开票金额/抬头/税号/接收邮箱」
  标签后加红色 `*`（同实名认证样式）。
- **发票卡片**：可开票额度改为**顶部整宽高亮条**（浅灰圆角），表单移到下方铺满。

### 9.9.2 确认入账弹窗与计费口径（`pages/BankTransfer/TransferTab.jsx` + 后端）

- **额度按展示类型显示**：预计入账额度用 `renderQuota`（CNY→¥），不再写死 `$`。
- **文案**：「申报金额」全部改「转账金额」；输入框标签改「用户账户充值额度（元）」；
  说明改「根据实际签署合同确定入账金额，可能高于转账金额」。
- **入账备注**：`bank_transfer_orders` 新增 `review_remark` 列（AutoMigrate 建列），
  审批事务内落库；弹窗加「入账备注（选填）」（BD/合同/折扣），管理员列表到账金额下方灰字展示。
  `BankTransferApproveRequest` 接收 `review_remark`，`ApproveBankTransferOrder` 增参。
- **充值流水口径**（`model/bank_transfer.go` 审批事务）：`TopUp.Amount` 存 **quota 单位**
  （账单 `renderQuota` 直接渲染，体现修正后入账额度），`TopUp.Money` 存**用户原始转账金额**
  （`order.AmountFen`，即支付金额）。审批日志格式对齐支付宝/微信直连：
  `充值额度: <FormatQuotaShort>，支付金额: <元>（审核人 ID: x）`（FormatQuotaShort 2 位小数无浮点噪音）。
- **可开票额度按实付累加**（`model/bank_transfer.go`/`model/invoice.go` 3 处）：
  `SumUserApprovedBankTransferFen` 及开票/提交权威复核从 `credited_fen` 改 **`amount_fen`**。
  理由：折扣/合同场景入账额度可能高于实付，但增值税发票只能按用户**实付**金额开具。

### 9.9.3 发票信息记忆 + 记录表封顶

- **上次开票信息默认填入**（按用户隔离、跨登录持久）：`model.GetUserLastInvoiceRequest`
  取该用户最近一条申请，`GetInvoiceQuota` 附带 `last_invoice_type/title/tax_no/email`；
  前端以 `prev||last||回退` 默认填入，不覆盖正在编辑值。纯读库、无新表、不存敏感缓存。
- **记录表封顶**：转账/开票记录 `>10` 条限高约 420px + 垂直滚动条（`scroll.y`），
  拉取 `page_size` 提到 50（原 10 条永远触发不了滚动）。

### 9.9.4 管理员审核待办红点（新功能）

- **后端**：4 个 `CountPending*`（KYC/企业/转账/发票）+ 聚合接口
  `GET /api/user/review/pending_counts`（AdminAuth），返回各项及 `bank_transfer_total=转账+发票`。
- **前端**：hook `useReviewPendingCounts`（**仅管理员**轮询、30s、后台标签暂停、监听
  `review:changed` 即时刷新）。侧边栏「实名认证/企业认证/对公转账」加红圈**未审核数**
  （0 不显示；对公转账=转账+发票合计），对公转账页内「转账审核/发票审核」页签也各加红圈。
- **语义**：红点按 **`status=pending`（未审核）** 计数，与工单的"未读"不同——已读未审核仍计红，
  审批通过/拒绝后才消失。
- **性能**：风险远低于工单未读（工单全员轮询，此处仅管理员）；并给 4 张表 `status` 列加 `index`
  彻底消除 COUNT 扫描隐患（AutoMigrate 建索引）。
- 审批通过/拒绝/开具成功后 `dispatchEvent('review:changed')`，红点即时下降不必等轮询。

### 9.9.5 重置认证限超管

- 实名认证/企业认证列表「重置」按钮加 `isRoot()` 仅超管可见；后端 `/kyc|enterprise/admin/:id/reset`
  叠加 `middleware.RootAuth()` 强制（普通管理员直连 API 也 403）——前端隐藏只是体验，后端才是边界。

### 9.9.6 本轮触碰文件

后端：`controller/bank_transfer.go`/`invoice.go`、`dto/bank_transfer.go`/`invoice.go`、
`model/bank_transfer.go`/`invoice.go`/`user_kyc.go`/`user_enterprise.go`、`router/api-router.go`。
前端：`components/topup/index.jsx`/`BankTransferCard.jsx`/`InvoiceCard.jsx`、
`pages/BankTransfer/index.jsx`/`TransferTab.jsx`/`InvoiceTab.jsx`、`pages/KYC/index.jsx`、
`pages/Enterprise/index.jsx`、`components/layout/SiderBar.jsx`、`hooks/common/useReviewPendingCounts.js`（新增）。
