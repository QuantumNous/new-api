# 企业认证（Enterprise Certification）设计文档

> 版本：v0.1（草案，待评审）
> 适用项目：new-api
> 认证模式：**用户提交 + 管理员审核**（无第三方自动核验）
> 日期：2026-06-08
>
> **设计基线**：本功能在结构、加密、权限、生命周期、审计等所有维度上**完全复用实名认证（KYC）已落地的基础设施与模式**（详见 `docs/kyc-design.md`）。本文档只描述与 KYC 的**差异点**与**新增点**，凡未特别说明处，行为、约定、跨库兼容策略与 KYC 一致。
>
> **与 KYC 的关系**：企业认证是一条**独立**的认证链路（独立表、独立状态字段、独立审核页），但在「实名认证强制要求」开关下，**已通过企业认证的用户对 KYC 强制拦截豁免**（一个完成对公核验的企业实体无需再做法人个人实名，详见 §九）。

---

## 一、背景与目标

KYC 解决的是「个人用户实名」。面向企业客户时，平台需要核验的是**企业法律主体的真实性**，并据此提供差异化的企业级服务。企业认证即为此设立。

### 目标

- 用户可在个人中心提交企业认证资料（企业名称、统一社会信用代码、营业执照、法人信息及证件照片），系统保存并等待管理员审核
- 管理员（role ≥ 10）可在独立的「企业认证」审核列表中通过 / 拒绝（拒绝填原因），审核操作留存操作人记录
- 企业认证通过后，用户获得平台展示的企业级权益：**专属客户服务、企业级 SLA 保障、公对公转账服务**
- 营业执照、法人身份证正反面图片加密存储，由管理员人工核验
- 敏感信息接口（reveal 完整证件号 / images 原件图片）采用与 KYC 完全一致的**状态感知权限**（pending/rejected → Admin+Root；approved → Root only），每次访问写审计日志
- 用户管理列表新增「企业认证」列，可按企业认证状态筛选
- **KYC 强制要求豁免**：当 `KYCEnabled=true` 时，`enterprise_status=已通过` 的用户与 `kyc_status=已通过` 的用户一样，不被 relay/充值/操练场拦截
- 加密、哈希、脱敏、客户端压缩等底层能力**直接复用 KYC**（`common/kyc_crypto.go`、同一组 `KYC_ENCRYPT_KEY` / `KYC_HASH_KEY`），不引入新密钥、不新增加密文件

### 设计原则（与 KYC 一致，不再展开）

- **最小权限**：列表/响应脱敏；图片不在列表返回；reveal/images 按状态收缩可见角色并留痕
- **数据库兼容**：SQLite / MySQL / PostgreSQL 三库同时支持（遵守 CLAUDE.md Rule 2）
- **审计可追溯**：审核、reveal、images、reset 全部写 `LogTypeManage` 日志
- **复用优先**：能复用 KYC 既有函数/常量/中间件的，一律复用，避免重复造轮子，控制合并冲突面

---

## 二、企业认证需要采集哪些信息

参考国内 SaaS / 云厂商企业实名的通行做法，采集字段分三档：

| 档位 | 字段 | 是否必填 | 加密 | 去重哈希 | 说明 |
|------|------|---------|------|---------|------|
| **核心主体** | 企业名称 `company_name` | ✅ 必填 | 否（明文存，列表直显） | — | 营业执照上的全称 |
| | 统一社会信用代码 `uscc` | ✅ 必填 | ✅ `uscc_enc` | ✅ `uscc_hash` | 18 位，企业唯一标识，用于跨账号去重 |
| | 营业执照照片 | ✅ 必填 | ✅ `license_enc` | — | 人工核验企业真实性 |
| **法人信息** | 法人代表姓名 `legal_rep_name` | ✅ 必填 | 否（明文，审核需直显） | — | |
| | 法人身份证号 `legal_rep_id` | ✅ 必填 | ✅ `legal_rep_id_enc` | — | 仅加密，不单独去重（去重以 USCC 为准） |
| | 法人身份证正面照片 | ✅ 必填 | ✅ `legal_front_enc` | — | |
| | 法人身份证背面照片 | ✅ 必填 | ✅ `legal_back_enc` | — | |
| **联系（可选）** | 联系人 `contact_name` | ⬜ 可选 | 否 | — | 企业对接人 |
| | 联系电话 `contact_phone` | ⬜ 可选 | 否（列表脱敏中间 4 位） | — | 方便客服回访 |

> **为什么 USCC 作为去重键而非法人身份证**：一个法人可以是多家公司的法定代表人（合法场景），但同一个统一社会信用代码只对应一个企业法律主体。以 USCC 去重，既能防「一照多号」，又不会误伤「一人多公司」。
>
> **对公账户字段——本期不采集**（已评审决策）：「公对公转账服务」是认证后的权益，但对公账户信息（开户行/对公账号）**延后到用户实际发起公对公转账时再单独收集**，企业认证表不存这两个字段。这样认证表更聚焦于「企业主体核验」，对公账户作为后续转账流程的输入即可。

**采集字段最终落到 3 张图片**：营业执照、法人身份证正面、法人身份证背面（均必传）。复用 KYC 的客户端 canvas 压缩（最长边 2400px、JPEG 0.88、目标 ≤ 1.5MB/张）。

---

## 三、功能清单

| 功能 | 用户侧 | 管理员侧 |
|------|--------|----------|
| 提交企业认证 | ✅ POST /api/user/enterprise | — |
| 查询自己的认证状态 | ✅ GET /api/user/enterprise | — |
| 修改/重新提交 | ✅ PUT /api/user/enterprise（仅 pending/rejected，受次数限制） | — |
| 撤销认证申请 | ✅ DELETE /api/user/enterprise（仅 pending） | — |
| 查看待审核列表 | — | ✅ GET /api/user/enterprise/admin |
| 通过认证 | — | ✅ PUT /api/user/enterprise/admin/:id/approve（Admin + Root） |
| 拒绝认证 | — | ✅ PUT /api/user/enterprise/admin/:id/reject（Admin + Root） |
| 查看指定用户认证详情 | — | ✅ GET /api/user/enterprise/admin/by-user/:user_id（Admin + Root） |
| 查看完整 USCC/法人证件号（解密） | — | ✅ GET /api/user/enterprise/admin/:id/reveal（状态感知，留痕） |
| 查看营业执照/法人证件原件图片 | — | ✅ GET /api/user/enterprise/admin/:id/images（状态感知，留痕） |
| 重置已通过的认证 | — | ✅ PUT /api/user/enterprise/admin/:id/reset（Admin + Root，硬删 + 留痕） |
| 用户管理列表展示企业认证状态 + 筛选 | — | ✅ 用户管理页新增列 |
| KYC 强制要求豁免（企业已认证用户） | 自动（中间件） | — |

> 各接口的状态机、状态分支、submit_count 上限、跨账号去重、软删除恢复（C1/C2/C3 三分支）、reset 硬删语义、reveal/images 状态感知权限与审计日志格式，**全部与 KYC 同构**，实现时按 `kyc-design.md` §五/§六/§十三 同样处理，把「证件号」替换为「USCC/法人证件号」，把「身份证正反面」替换为「营业执照 + 法人身份证正反面」即可。

---

## 四、数据库设计

### 4.1 `users` 表新增字段

紧贴现有 `KycStatus` 字段之后新增：

```go
// model/user.go
EnterpriseStatus int `json:"enterprise_status" gorm:"type:int;default:0;column:enterprise_status"` // 0=未认证 1=审核中 2=已通过 3=已拒绝
```

同步：
- `model/user.go: ToBaseUser()` 增加 `EnterpriseStatus: user.EnterpriseStatus`
- `model/user_cache.go: UserBase` 增加 `EnterpriseStatus int json:"enterprise_status"`
- `model/user_cache.go: WriteContext()` 增加 `common.SetContextKey(c, constant.ContextKeyUserEnterpriseStatus, user.EnterpriseStatus)`
- `model/user_cache.go: GetUserCache` Redis miss 内联构造分支补 `EnterpriseStatus: user.EnterpriseStatus`（与现有 `KycStatus` 同处理）

> `cacheGetUserBase` 用 `RedisHGetObj` 反射读取，新增 struct 字段自动支持，无需改动。

审核通过/拒绝/重置时同步更新 `user_enterprises.status` 与 `users.enterprise_status`，并调用 `InvalidateUserCache(userId)`。

### 4.2 新增表：`user_enterprises`

```go
// model/user_enterprise.go
const (
    EnterpriseStatusPending  = 1
    EnterpriseStatusApproved = 2
    EnterpriseStatusRejected = 3
)

type UserEnterprise struct {
    Id              int            `json:"id"                       gorm:"primaryKey;autoIncrement"`
    UserId          int            `json:"user_id"                  gorm:"index;not null"`
    CompanyName     string         `json:"company_name"             gorm:"type:varchar(128);not null"`
    UsccEnc         string         `json:"-"                        gorm:"type:text;column:uscc_enc;not null"`        // 统一社会信用代码（AES-256-GCM）
    UsccHash        string         `json:"-"                        gorm:"type:varchar(64);column:uscc_hash;not null"` // HMAC-SHA256，跨账号去重
    LegalRepName    string         `json:"legal_rep_name"           gorm:"type:varchar(64);not null"`
    LegalRepIdEnc   string         `json:"-"                        gorm:"type:text;column:legal_rep_id_enc;not null"` // 法人身份证号（加密）
    ContactName     string         `json:"contact_name,omitempty"   gorm:"type:varchar(64)"`
    ContactPhone    string         `json:"contact_phone,omitempty"  gorm:"type:varchar(32)"`   // 明文存，列表脱敏
    SubmitCount     int            `json:"submit_count"             gorm:"type:int;not null;default:0"`
    Status          int            `json:"status"                   gorm:"type:int;not null;default:1"`
    RejectReason    string         `json:"reject_reason,omitempty"  gorm:"type:varchar(255)"`
    ReviewedBy      int            `json:"reviewed_by,omitempty"    gorm:"type:int;column:reviewed_by"`
    SubmittedAt     *time.Time     `json:"submitted_at,omitempty"`
    VerifiedAt      *time.Time     `json:"verified_at,omitempty"`
    CreatedAt       time.Time      `json:"created_at"`
    UpdatedAt       time.Time      `json:"updated_at"`
    DeletedAt       gorm.DeletedAt `json:"-"                        gorm:"index"`
}
```

去重 / 软删除唯一性约束策略与 KYC 完全一致：`uscc_hash` 与 `user_id` **均不设数据库唯一约束**，唯一性在应用层用 `WHERE user_id=? AND deleted_at IS NULL` 保证；跨账号去重查询同 `uscc_hash` 且 `status=approved` 且 `deleted_at IS NULL` 的记录。

### 4.3 新增表：`user_enterprise_images`

与 KYC 的 `user_kyc_images` 同构，但有 **3 张图**（营业执照 + 法人身份证正反面）：

```go
type UserEnterpriseImage struct {
    Id            int            `gorm:"primaryKey;autoIncrement"`
    EnterpriseId  int            `gorm:"uniqueIndex;not null"` // 1:1 with user_enterprises.id
    UserId        int            `gorm:"index;not null"`
    LicenseEnc    string         `gorm:"not null"`             // 营业执照（AES-256-GCM 加密 base64）
    LegalFrontEnc string         `gorm:"not null"`             // 法人身份证正面
    LegalBackEnc  string         `gorm:"not null"`             // 法人身份证背面
    CreatedAt     time.Time
    UpdatedAt     time.Time
    DeletedAt     gorm.DeletedAt `gorm:"index"`
}
```

> **图片大字段为何不写 `type:text`（跨库安全）**：压缩后的图片约 1.5MB，base64(+33%) 叠加 AES-GCM/base64 膨胀后约 2MB。MySQL 的 `TEXT` 上限仅 64 KiB，若显式标 `gorm:"type:text"` 会在 MySQL 上截断/写失败。
> - 这里**省略 `type` 标签**，依赖 GORM 默认的字符串映射：**MySQL → `longtext`（4 GB）/ PostgreSQL → `text` / SQLite → `text`**，三库均能容纳 2MB 密文，满足 CLAUDE.md Rule 2。
> - **仅图片这 3 个大字段如此处理**；`uscc_enc` / `legal_rep_id_enc` 等小字段（加密后仅几十字节）保持 `type:text` 无妨。
> - **KYC 老表 `user_kyc_images` 保持现状不动**：它仍用 `gorm:"type:text"`，在你的实际部署（PostgreSQL + SQLite，`text` 无长度上限）下没有问题，存量已认证用户数据正常；该写法的 MySQL 截断隐患仅在**未来真迁到 MySQL 时**才需要一并改为 `longtext`，本期不触碰已上线表，零升级风险。

软/硬删除并存策略与 `user_kyc_images` 一致（业务撤销硬删 `Unscoped().Delete`；账号软删跟随；upsert 用 `Unscoped()` 恢复软删行避免唯一冲突）。

**AutoMigrate**：`model/main.go` 追加 `&UserEnterprise{}`、`&UserEnterpriseImage{}`。

### 4.4 DTO（`dto/enterprise.go`）

```go
// 用户提交（POST / PUT 共用）
type EnterpriseSubmitRequest struct {
    CompanyName  string `json:"company_name"  binding:"required,min=2,max=128"`
    Uscc         string `json:"uscc"          binding:"required,len=18"` // 统一社会信用代码 18 位
    LegalRepName string `json:"legal_rep_name" binding:"required,min=2,max=32"`
    LegalRepId   string `json:"legal_rep_id"  binding:"required,min=6,max=30"`
    ContactName  string `json:"contact_name"`
    ContactPhone string `json:"contact_phone"`
    License      string `json:"license"`      // 营业执照 base64（必传，handler 校验）
    LegalFront   string `json:"legal_front"`  // 法人身份证正面 base64
    LegalBack    string `json:"legal_back"`   // 法人身份证背面 base64
}

// 管理员拒绝
type EnterpriseRejectRequest struct {
    Reason string `json:"reason" binding:"required,max=255"`
}

// 用户侧响应（脱敏）
type EnterpriseStatusResponse struct {
    Status       int        `json:"status"`        // 0=未提交 1=审核中 2=已通过 3=已拒绝
    CompanyName  string     `json:"company_name"`
    UsccMasked   string     `json:"uscc_masked"`   // 前3后4
    LegalRepName string     `json:"legal_rep_name"`
    ContactName  string     `json:"contact_name,omitempty"`
    ContactPhone string     `json:"contact_phone,omitempty"` // 脱敏
    RejectReason string     `json:"reject_reason,omitempty"`
    SubmitCount  int        `json:"submit_count"`
    SubmittedAt  *time.Time `json:"submitted_at,omitempty"`
    VerifiedAt   *time.Time `json:"verified_at,omitempty"`
}

// 管理员列表条目（脱敏）
type EnterpriseAdminItem struct {
    Id           int        `json:"id"`
    UserId       int        `json:"user_id"`
    Username     string     `json:"username"`
    CompanyName  string     `json:"company_name"`
    UsccMasked   string     `json:"uscc_masked"`
    LegalRepName string     `json:"legal_rep_name"`
    ContactName  string     `json:"contact_name,omitempty"`
    ContactPhone string     `json:"contact_phone,omitempty"` // 脱敏
    SubmitCount  int        `json:"submit_count"`
    Status       int        `json:"status"`
    RejectReason string     `json:"reject_reason,omitempty"`
    ReviewedBy   int        `json:"reviewed_by,omitempty"`
    ReviewerName string     `json:"reviewer_name,omitempty"`
    HasImages    bool       `json:"has_images"`
    SubmittedAt  *time.Time `json:"submitted_at,omitempty"`
    VerifiedAt   *time.Time `json:"verified_at,omitempty"`
}

// 解密响应（明文，仅状态感知权限可见）
type EnterpriseRevealResponse struct {
    CompanyName  string `json:"company_name"`
    Uscc         string `json:"uscc"`
    LegalRepName string `json:"legal_rep_name"`
    LegalRepId   string `json:"legal_rep_id"`
}

// 图片响应（明文 data URI）
type EnterpriseImagesResponse struct {
    LicenseImage    string `json:"license_image"`     // data:image/jpeg;base64,...
    LegalFrontImage string `json:"legal_front_image"`
    LegalBackImage  string `json:"legal_back_image"`
}
```

---

## 五、加密与哈希方案（完全复用 KYC）

| 能力 | 复用的函数（`common/kyc_crypto.go`） | 用途 |
|------|--------------------------------------|------|
| 加密 | `EncryptIDNumber(plain)` | USCC、法人身份证号、3 张图片均用它加密（本质是对任意字节串加密） |
| 解密 | `DecryptIDNumber(enc)` | reveal / images 接口解密 |
| 去重哈希 | `HMACIDNumber(plain)` | 对 USCC 计算 `uscc_hash` |
| 脱敏 | `MaskIDNumber(plain)` | USCC 脱敏（前3后4）；联系电话脱敏可加一个 `MaskPhone` 或直接复用 |

**不新增任何密钥、不新增加密文件**。沿用现有 `KYC_ENCRYPT_KEY` / `KYC_HASH_KEY` 与 `InitKYCKeys()`（已在 `main.go` 启动期调用）。USCC 与法人证件号共用同一加密 key（不同字段）。

> 联系电话脱敏若需独立规则（如保留前3后4），可在 `common/kyc_crypto.go` 增加一个轻量 `MaskPhone`；否则直接用 `MaskIDNumber`。

---

## 六、Model / Controller / 中间件层

### 6.1 Model（`model/user_enterprise.go`）

函数签名与 `model/user_kyc.go` 一一对应，仅命名与字段不同：

```go
GetEnterpriseByUserId(userId int) (*UserEnterprise, error)
GetEnterpriseById(id int) (*UserEnterprise, error)
UpsertEnterpriseWithImages(...) (*UserEnterprise, error)    // 事务包裹主表 + 图片（C1/C2/C3 三分支 + submit_count 上限 + USCC 跨账号去重，逻辑同 UpsertKYC）
UpsertEnterpriseImages(enterpriseId, userId, licenseEnc, legalFrontEnc, legalBackEnc string) error
GetEnterpriseImages(enterpriseId int) (*UserEnterpriseImage, error)
DeleteEnterpriseImagesByEnterpriseId(enterpriseId int) error      // 硬删（Unscoped）
SoftDeleteEnterpriseImagesByEnterpriseId(enterpriseId int) error  // 软删（跟随账号软删）
HasEnterpriseImages(enterpriseId int) bool
ApproveEnterprise(id, reviewerId int) error                // 审批前在事务内**重新校验 uscc_hash 跨账号去重**（差异点，见下）
RejectEnterprise(id, reviewerId int, reason string) error
ResetEnterprise(id, reviewerId int) error                  // 硬删行 + users.enterprise_status=0
DeleteEnterpriseByUserId(userId int) error                 // 用户撤回（软删）
GetEnterpriseList(status int, keyword string, page, pageSize int) ([]*EnterpriseAdminRow, int64, error)

var ErrEnterpriseDuplicateUscc = errors.New("该企业已被其他账号认证")
var ErrEnterpriseSubmitLimitExceeded = errors.New("提交次数已达上限")

type EnterpriseAdminRow struct {
    UserEnterprise
    Username     string `gorm:"column:username"`
    ReviewerName string `gorm:"column:reviewer_name"`
}
```

`GetEnterpriseList` 的 Count/Scan 分两条 SQL、LEFT JOIN users 取 username + reviewer_name，跨库标识符全小写非保留字，与 `GetKYCList` 同构。

> **审批去重（与 KYC 的有意差异）**：提交时的跨账号去重只查 `status=approved` 的记录，因此两个账号可在「都 pending」时各自提交同一 USCC（互不命中）。若直接审批两条 → 同一企业被认证两次。`ApproveEnterprise` 在**审批事务内重新校验** `uscc_hash` 是否已有其他账号 approved，命中则返回 `ErrEnterpriseDuplicateUscc` 拒绝。KYC 现有实现没有这层审批期复检（已上线、本期不动），故这是企业认证比 KYC **更严格**的一处。事务复检把 TOCTOU 窗口收窄到「两个管理员同一瞬间审批两条同 USCC」的极小概率；因软删行会阻塞重提交，故**不**对 `uscc_hash` 加数据库唯一约束。

### 6.2 Controller（`controller/enterprise.go`）

用户侧（`GetEnterpriseStatus` / `SubmitEnterprise` / `UpdateEnterprise` / `DeleteEnterprise`）与管理员侧（`AdminGetEnterpriseList` / `AdminGetEnterpriseByUser` / `AdminApproveEnterprise` / `AdminRejectEnterprise` / `AdminResetEnterprise` / `AdminRevealEnterprise` / `AdminGetEnterpriseImages`）的状态分支、事务、图片处理、reset 顺序（先 `GetEnterpriseById` 取原状态 → 删图 → 硬删主表 → 写 `LogTypeManage` 日志）、reveal/images 共用的 `checkEnterpriseSensitiveAccessPermission`（状态感知）与审计日志格式，全部按 `controller/kyc.go` 同构实现。

图片校验复用 `controller/kyc.go` 已有的常量与思路（`maxImageDecodedBytes` / `maxImageBase64Len` / 哨兵错误），但需要校验 **3 张图**（营业执照、法人正面、法人背面）。与 KYC 不同：KYC 图片是后加的、为兼容老 API 调用方而允许「不传图」；企业认证是**全新功能、无历史调用方**，因此 **3 张图一律必传**——缺任意一张返回 `errEntImagesIncomplete`，这同时杜绝了「直连 API 不传图 → 管理员审批通过 → 无营业执照/法人证件的认证」的漏洞。USCC 在加密+哈希前统一 `ToUpper+TrimSpace` 归一化（社会信用代码大小写不敏感），避免大小写不同导致跨账号去重漏判。

> 这些图片校验常量目前定义在 `controller/kyc.go`，企业认证 controller 同包（`package controller`）可直接复用，无需重复定义。

### 6.3 中间件（关键差异：KYC 强制豁免）

**不新增中间件**。企业认证本身不强制拦截 relay。唯一的中间件改动是：让现有 `middleware.KYCRequired()` 在判断放行时，把「已通过企业认证」也视作满足条件。

```go
// middleware/kyc.go — KYCRequired 内部，原:
//   kycStatus := readUserKYCStatus(c)
//   if kycStatus != model.KYCStatusApproved { abort... }
// 改为:
    kycStatus := readUserKYCStatus(c)
    entStatus := readUserEnterpriseStatus(c)
    if kycStatus != model.KYCStatusApproved && entStatus != model.EnterpriseStatusApproved {
        abortWithOpenAiMessage(c, http.StatusForbidden,
            common.TranslateMessage(c, i18n.MsgKycRequired),
            types.ErrorCodeKYCRequired)
        return
    }
    c.Next()
```

新增 `readUserEnterpriseStatus(c)`，与 `readUserKYCStatus(c)` 完全同构（先读 `ContextKeyUserEnterpriseStatus`，UserAuth 路径回退 `GetUserCache`）：

```go
func readUserEnterpriseStatus(c *gin.Context) int {
    if v, ok := c.Get(string(constant.ContextKeyUserEnterpriseStatus)); ok {
        if s, ok := v.(int); ok {
            return s
        }
    }
    userId := c.GetInt("id")
    if userId <= 0 {
        return 0
    }
    userCache, err := model.GetUserCache(userId)
    if err != nil {
        return 0
    }
    return userCache.EnterpriseStatus
}
```

> 这样改动后，relay / 充值 9 条 /pay / 操练场（已挂 `KYCRequired`）的拦截行为自动把企业认证用户放行，**无需改任何路由**。这是把豁免逻辑收敛在单个 fork 自有中间件里的最小改法（符合「上游对齐优先」）。
>
> 错误码与文案仍复用 `kyc_required` / `MsgKycRequired`（语义是「需要完成实名 **或** 企业认证」）。若产品希望区分文案，可后续单独加 key，本期不做。

---

## 七、配置开关

**不引入企业认证的功能总开关**（已评审决策：卡片常驻，与 KYC 卡片一致始终展示）。企业认证从不强制任何人，前端卡片对所有登录用户可见，无需 Root 单独开启。

仅保留一个提交次数上限配置（与 KYC 的 `KYCMaxSubmitCount` 同构，用于防反复试错）：

```go
// common/constants.go
var EnterpriseMaxSubmitCount = 5
```

```go
// model/option.go — InitOptionMap()
common.OptionMap["EnterpriseMaxSubmitCount"] = strconv.Itoa(common.EnterpriseMaxSubmitCount)

// model/option.go — updateOptionMap()
case "EnterpriseMaxSubmitCount":
    common.EnterpriseMaxSubmitCount, _ = strconv.Atoi(value)
```

> 因为没有功能开关，`GET /api/status` **无需新增** `enterprise_enabled` 字段；前端无条件渲染企业认证卡片。KYC 豁免逻辑（§6.3）只看 `enterprise_status == approved`，与任何开关无关。

---

## 八、路由注册

```go
// selfRoute（UserAuth，/api/user/*）
selfRoute.GET("/enterprise",    controller.GetEnterpriseStatus)
selfRoute.POST("/enterprise",   controller.SubmitEnterprise)
selfRoute.PUT("/enterprise",    controller.UpdateEnterprise)
selfRoute.DELETE("/enterprise", controller.DeleteEnterprise)

// adminRoute（AdminAuth，role >= 10）
// 路径约定与 KYC 一致：/enterprise/admin/:id/... 中的 :id 一律指 user_enterprises.id；
//                       按用户主键查询单独走 /enterprise/admin/by-user/:user_id
adminRoute.GET("/enterprise/admin",                  controller.AdminGetEnterpriseList)
adminRoute.GET("/enterprise/admin/by-user/:user_id", controller.AdminGetEnterpriseByUser)
adminRoute.PUT("/enterprise/admin/:id/approve",      controller.AdminApproveEnterprise)
adminRoute.PUT("/enterprise/admin/:id/reject",       controller.AdminRejectEnterprise)
adminRoute.PUT("/enterprise/admin/:id/reset",        controller.AdminResetEnterprise)
adminRoute.GET("/enterprise/admin/:id/reveal",       controller.AdminRevealEnterprise)
adminRoute.GET("/enterprise/admin/:id/images",       controller.AdminGetEnterpriseImages)
```

> `by-user/:user_id` 路由必须注册在 `/:id` 系列之前（与 KYC 注释同款，避免 gin 路由参数冲突）。

**企业认证不挂任何 relay / pay / pg 路由**——它不强制拦截，只通过 §6.3 的豁免逻辑反向影响 KYC 拦截。

---

## 九、KYC 强制豁免逻辑（核心交互）

这是企业认证与 KYC 唯一的耦合点，集中说明：

```
KYCEnabled = true 时，relay / 充值 / 操练场请求放行条件：
    role >= 10 (Admin/Root)
    OR kyc_status == 2 (已通过实名认证)
    OR enterprise_status == 2 (已通过企业认证)   ← 本功能新增
```

实现落在 `middleware/kyc.go` 一处（§6.3）。

| 用户状态 | KYCEnabled=false | KYCEnabled=true |
|---------|------------------|-----------------|
| kyc=0, ent=0 | 放行 | **拦截** |
| kyc=2, ent=0 | 放行 | 放行（实名） |
| kyc=0, ent=2 | 放行 | 放行（**企业豁免**） |
| kyc=3, ent=2 | 放行 | 放行（企业豁免，实名被拒不影响） |
| Admin/Root | 放行 | 放行 |

> **设计取舍**：企业认证「覆盖」了 KYC 的强制要求，但**不联动写 `kyc_status`**。两个状态字段相互独立，各自反映各自链路的真实审核结果。豁免只是中间件的「或」逻辑，不是状态同步。这样语义清晰，且 reset 任一认证都不会误伤另一个。

---

## 十、前端设计（当前阶段：仅 web/classic）

> 遵循「前端 classic 优先」：本期只在 `web/classic` 实现，`web/default` 适配延后到上游 v1.0.0 之后（届时纯前端工作，后端零改动）。

### 10.1 个人中心 — 企业认证卡片

新增 `web/classic/src/components/settings/personal/cards/EnterpriseSetting.jsx`，与现有 `KYCSetting.jsx` 并列放在个人设置页（`PersonalSetting.jsx` 的右列 grid 内，紧随 KYCSetting）。

**卡片头部**（区别于 KYC 的橙色身份证图标）：
- 圆形 `Avatar`（蓝色背景 + 企业/楼宇类图标，如 `IconShield` / `IconBox` / 自定义企业图标）
- 标题「企业认证」+ 副标题「企业级身份核验，解锁专属企业服务」

**权益展示区**（认证前/认证中都展示，作为转化引导）：在卡片正文用三个小条目列出权益：
- 🛡 专属客户服务
- 📈 企业级 SLA 保障
- 🏦 公对公转账服务

**状态展示**（按 `status` 渲染，复用 KYC 的 STATUS_LABELS 风格）：

| status | 展示 |
|--------|------|
| 0 未提交 | 「未认证」标签 + 权益介绍 + 「立即认证」按钮 → 打开提交 Modal |
| 1 审核中 | 「审核中」标签 + 已提交企业名/脱敏 USCC + 撤回按钮 |
| 2 已通过 | 「已认证」绿色标签 + 企业名 + 脱敏信息 + 认证时间；权益条目高亮为「已生效」 |
| 3 已拒绝 | 「已拒绝」红色标签 + 拒绝原因 + 剩余次数 + 重新提交 |

**提交 Modal**（点击「立即认证」弹出）：
- 表单字段：企业名称、统一社会信用代码（18 位校验）、法人代表姓名、法人身份证号（18 位校验）
- 折叠的「联系方式（选填）」：联系人、联系电话
- 3 个图片上传区：营业执照、法人身份证正面、法人身份证背面（复用 `KYCSetting.jsx` 的 `compressImageToBase64` 压缩函数）
- 提交按钮启用条件：必填项校验通过 **且** 3 张图均已上传

**校验正则**（已评审决策：USCC 用标准 GB32100）：
- 统一社会信用代码：`/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/`（GB32100，登记管理码 2 位 + 行政区划 6 位 + 主体标识 + 校验位，排除易混字符 I/O/Z/S/V）
- 法人身份证号：复用 KYC 的 `/^\d{17}[\dXx]$/`

### 10.2 管理员 — 企业认证审核列表页

新增 `web/classic/src/pages/Enterprise/index.jsx`，完全参照 `web/classic/src/pages/KYC/index.jsx`：
- `CardPro` + `CardTable` + `createCardProPagination` 统一 admin 页风格
- 列：企业名称、脱敏 USCC、法人姓名、联系电话（脱敏）、提交时间、图片列（`✓`/`—`）、状态、审核操作
- 状态筛选 Select + 关键字搜索（按企业名/用户名）+ 刷新
- 操作：通过 / 拒绝（填原因）/ 重置（Admin+Root，`window.confirm` 二次确认）
- 「查看原始信息」弹窗（reveal）：状态感知可见（pending/rejected→Admin+Root；approved→Root only），展示明文 USCC / 法人证件号
- 「查看证件图片」弹窗（images）：同状态感知 + `has_images===true`，并排展示营业执照 + 法人正反面 3 张图，关闭清空 state
- 路由 `/console/enterprise` 加入 `PageLayout.jsx` 的 `cardProPages` 白名单（去页脚）
- 侧边栏：`useSidebar.js` 的 `DEFAULT_ADMIN_CONFIG.admin` 增加 `enterprise: true`，并在 `SiderBar.jsx` 增加菜单项

### 10.3 用户管理页 — 新增企业认证列

`web/classic/src/components/table/users/UsersColumnDefs.jsx`：
- 新增 `ENTERPRISE_STATUS_MAP` + `renderEnterpriseStatus`（参照现有 `KYC_STATUS_MAP` / `renderKYCStatus`）
- 新增列：`title: t('企业认证'), dataIndex: 'enterprise_status', render: ...`

`web/classic/src/components/table/users/UsersFilters.jsx`：增加按 `enterprise_status` 筛选（后端 `GetAllUsers` / `SearchUsers` 增加 `enterpriseStatus` 参数，与现有 `kycStatus` 参数同构，过滤 `WHERE enterprise_status = ?`）。

> 后端 `controller/user.go` 的用户列表/搜索 handler 需要从 query 读取 `enterprise_status` 并透传到 model 层。

### 10.4 i18n

`web/classic` 以中文字符串为 key，**全部 8 个 locale**（`zh / zh-CN / zh-TW / en / fr / ja / ru / vi`）同步新增。新增中文 key 列表（节选）：

- `企业认证` / `企业级身份核验，解锁专属企业服务` / `立即认证`
- `专属客户服务` / `企业级 SLA 保障` / `公对公转账服务`
- `企业名称` / `统一社会信用代码` / `法人代表姓名` / `法人身份证号`
- `联系人` / `联系电话` / `联系方式（选填）`
- `营业执照` / `法人身份证正面` / `法人身份证背面`
- `上传营业执照` / `上传法人身份证正面` / `上传法人身份证背面`
- `请输入 18 位统一社会信用代码` / `请上传营业执照` / `请上传法人身份证正反面`
- `查看企业认证图片` / `企业认证原件图片（仅本次可见）`
- 校验/错误文案若可与 KYC 复用则复用（如「图片大小超出限制」「图片处理失败」）

后端 i18n（`i18n/keys.go` + `i18n/locales/{en,zh-CN,zh-TW}.yaml`）：本期豁免逻辑复用 `kyc.required`，**无需新增后端 message key**。仅当业务错误（如 `enterprise.images_incomplete`、`enterprise.duplicate_uscc`）需要走 `common.ApiErrorI18n` 时才新增对应 key——也可直接复用 Model 层返回的中文 error（`ErrEnterpriseDuplicateUscc` 等）经 `common.ApiError` 返回，与 KYC 现状对齐。

---

## 十一、改动文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `model/user_enterprise.go` | `UserEnterprise` + `UserEnterpriseImage` 模型及 CRUD |
| `dto/enterprise.go` | 请求/响应 DTO |
| `controller/enterprise.go` | 用户侧 + 管理员侧 handler |
| `web/classic/src/components/settings/personal/cards/EnterpriseSetting.jsx` | 个人中心企业认证卡片 |
| `web/classic/src/pages/Enterprise/index.jsx` | 管理员审核列表页 |

> 不新增 crypto 文件、不新增中间件文件、不新增后端 i18n message key（豁免复用 `kyc.required`）。新文件不复制上游 AGPL 版权头（按 fork 约定从 import/package 写起）。

### 修改文件

| 文件 | 改动 |
|------|------|
| `model/user.go` | `User` 新增 `EnterpriseStatus`；`ToBaseUser()` 同步；`GetAllUsers`/`SearchUsers` 增加 `enterpriseStatus` 过滤参数；账号软删/硬删路径跟随处理 `user_enterprises` + `user_enterprise_images`（参照现有 KYC 处理） |
| `model/user_cache.go` | `UserBase` 新增 `EnterpriseStatus`；`WriteContext` 写入 `ContextKeyUserEnterpriseStatus`；`GetUserCache` Redis miss 分支补字段 |
| `model/main.go` | AutoMigrate 加入 `&UserEnterprise{}`、`&UserEnterpriseImage{}` |
| `model/option.go` | 新增 `EnterpriseMaxSubmitCount` 初始化 + 解析 case |
| `common/constants.go` | 新增 `EnterpriseMaxSubmitCount` |
| `constant/context_key.go` | 新增 `ContextKeyUserEnterpriseStatus = "user_enterprise_status"` |
| `middleware/kyc.go` | `KYCRequired` 放行条件加入 `enterprise_status==approved`；新增 `readUserEnterpriseStatus` |
| `router/api-router.go` | 注册 §八 的 selfRoute / adminRoute 企业认证路由 |
| `controller/user.go` | 用户列表/搜索 handler 读取并透传 `enterprise_status` 筛选 |
| `web/classic` 前端 | `PersonalSetting.jsx`（挂卡片）、`UsersColumnDefs.jsx` + `UsersFilters.jsx`（列+筛选）、`useSidebar.js` + `SiderBar.jsx`（菜单）、`PageLayout.jsx`（`cardProPages` 白名单）、路由注册、8 个 locale i18n |

---

## 十二、实施顺序

1. `model/user.go` + `model/user_cache.go` + `constant/context_key.go` — `EnterpriseStatus` 字段与缓存/context 打通
2. `model/user_enterprise.go` + `model/main.go` — 建表 + AutoMigrate（复用 KYC 加密函数）
3. `common/constants.go` + `model/option.go` — `EnterpriseMaxSubmitCount` 接入 option（无功能总开关）
4. `dto/enterprise.go` — DTO
5. `controller/enterprise.go` — 用户侧（状态分支 + 事务 + 3 图校验）
6. `controller/enterprise.go` — 管理员侧（approve/reject/reset/reveal/images，复用 KYC 审计与状态感知权限）
7. `model/user.go` 账号软删/硬删路径跟随清理企业认证两张表
8. `middleware/kyc.go` — 豁免逻辑（`readUserEnterpriseStatus` + 放行条件「或」）
9. `router/api-router.go` — 路由注册
10. `controller/user.go` — 用户列表/搜索增加 `enterprise_status` 筛选
11. 前端（独立迭代）：个人中心卡片 → 审核列表页 → 用户管理列 → 菜单/路由 → 8 locale i18n

---

## 十三、测试验收（要点，细化参照 KYC §十七 同构展开）

### E1 用户提交/撤回/重提
- 提交合法企业资料（含 3 图）→ 201，`user_enterprises` + `user_enterprise_images` 同步写入，`uscc_enc` 非明文，`enterprise_status=1`
- 仅传 1-2 张图 → 业务错误（图片不完整）
- USCC 已被其他 approved 账号占用 → 400「该企业已被其他账号认证」
- submit_count 超限、DELETE 撤回（软删恢复 C3 计数重置）、reject 后 PUT 重提（C2 累加）等同 KYC

### E2 管理员审核
- approve/reject/reset 行为、状态同步 `users.enterprise_status`、缓存失效、并发审核仅一个成功 —— 同 KYC
- reset 硬删主表 + 删图 + 写 `LogTypeManage` 审计日志

### E3 reveal/images 状态感知权限
- Admin 对 pending/rejected → 200；对 approved → 403；Root 任意状态 → 200；每次访问写日志；普通用户 → 403

### E4 KYC 豁免（核心新增）
| KYCEnabled | kyc_status | enterprise_status | relay 请求 |
|-----------|-----------|-------------------|-----------|
| true | 0 | 0 | 403 拦截 |
| true | 0 | 2 | **200 放行（企业豁免）** |
| true | 2 | 0 | 200 放行 |
| true | 3 | 2 | 200 放行 |
| false | any | any | 200 放行 |
- approve 企业认证后，用户**无需重新登录**即可通过 relay（缓存失效后下次请求读新 enterprise_status）
- reset 企业认证后，若该用户 kyc 也未通过 → relay 重新被拦截

### E5 数据安全
- DB 中 `uscc_enc` / `legal_rep_id_enc` / 3 张图 enc 均为 base64 密文，列表接口不含任何明文/enc 字段
- 改 `KYC_ENCRYPT_KEY` 重启后旧记录 reveal/images 解密失败（key 隔离生效）

### E6 前端
- 个人中心企业认证卡片按状态正确渲染，权益条目展示；提交 Modal 3 图必传校验
- 用户管理页企业认证列与筛选；管理员审核列表页通过/拒绝/重置/查看图片全流程
- 非中文 locale 无 key 字面量回退

---

## 十四、上线迁移

- 部署后 AutoMigrate 自动加 `users.enterprise_status`（默认 0）+ 两张新表，存量用户零感知
- 无功能总开关，发版后企业认证卡片即对所有用户可见，存量用户可自愿提交
- 豁免逻辑只在「用户已 approved 企业认证」时生效
- 无需停服、无需迁移脚本

---

## 十五、已评审决策（2026-06-08）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 对公账户字段（开户行/对公账号） | **延后到转账时采集**，企业认证表不存这两个字段 |
| 2 | EnterpriseEnabled 功能总开关 | **不要开关，卡片常驻**（与 KYC 卡片一致始终展示） |
| 3 | 被 KYC 强制拦截时的提示文案 | **复用 `kyc_required`**，后端零新增 message key |
| 4 | USCC 校验严格度 | **标准 GB32100 正则**（登记管理码+行政区划+主体标识+校验位） |

**仍按当前设计、未单独提出的默认项**（如有异议可再调整）：
- **联系电话**：明文存、列表脱敏（便于客服直接联系），不走加密 reveal
- **企业认证与 KYC 关系**：完全独立，不要求前置完成 KYC

---

## 附：与 KYC 的差异速查

| 维度 | KYC（实名认证） | Enterprise（企业认证） |
|------|----------------|----------------------|
| 主体 | 个人 | 企业法律主体 |
| 去重键 | 证件号 hash | 统一社会信用代码 hash（提交时 + **审批事务内**复检） |
| 图片数 | 2（身份证正反面） | 3（营业执照 + 法人身份证正反面） |
| 图片列类型 | `type:text`（老表保持不动） | 省略 type → MySQL `longtext`/PG·SQLite `text`（跨库安全，修正 MySQL 64K 截断） |
| 强制拦截 | 有（KYCEnabled） | 无（认证后反向豁免 KYC 拦截） |
| 总开关 | KYCEnabled（强制开关） | 无（卡片常驻，仅 EnterpriseMaxSubmitCount 次数上限） |
| 加密/哈希/压缩 | `common/kyc_crypto.go` | **完全复用** |
| 审核权限 | Admin+Root | **同** |
| reveal/images 权限 | 状态感知 | **同** |
| 个人中心卡片 | KYCSetting.jsx（橙色身份证） | EnterpriseSetting.jsx（蓝色企业图标 + 权益展示） |
| 审核页 | /console/kyc | /console/enterprise |
| 后端 i18n message key | kyc.* | 复用 kyc.required（豁免） |
```
