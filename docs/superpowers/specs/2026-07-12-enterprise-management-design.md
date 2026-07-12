# 企业管理模块设计文档

> 日期：2026-07-12
> 状态：待审核
> 范围：在 new-api 上新增「企业管理」功能，零侵入主干代码

## 一、背景与目标

new-api 是一个开源的 AI API 网关。本设计为其新增一个独立的「企业管理」模块，支持：

- 系统管理员创建企业并指定企业管理员
- 企业管理员生成企业邀请码
- 普通用户填写邀请码产生加入申请
- 企业管理员审批申请
- 企业管理员给成员打标签
- 按标签等信息筛选成员
- 企业管理员从自己账户批量给成员下发额度

### 设计原则：零侵入主干

本项目是开源软件，二次开发必须保持主干可升级。所有企业功能以**独立模块**方式实现：

- ❌ 不修改 User struct 定义、不 ALTER 任何历史表
- ❌ 不修改 `model/user.go`、`controller/user.go`、计费逻辑、relay、authz/role 体系
- ❌ 不修改 `middleware/auth.go`
- ✅ 全部新增表、新增文件、新增路由
- ✅ 全部代码集中在顶层 `enterprise/` 目录，删除该目录即完全移除功能

### 不可避免的最小接入点（共 4 处，均为注册/调用，非逻辑修改）

| 接入点 | 说明 | 侵入程度 |
|--------|------|----------|
| 后端路由挂载 | `main.go` 加 2 行：`enterprise.AutoMigrate()` + `enterprise.RegisterRoutes(group)` | 加 2 行注册 |
| 前端导航入口 | 新增 1 个菜单项 + 路由目录 | 加 1 个菜单 |
| 复用认证中间件 | 复用现有 `UserAuth()` / `AdminAuth()`，不修改它们 | 调用，不修改 |
| 操作 user.quota 列 | 下发额度时用 GORM 操作 `users.quota` 列（DML，非 DDL） | 数据操作，不改表结构 |

## 二、需求决策汇总

| 维度 | 决策 |
|------|------|
| 企业数量 | 多企业（多租户） |
| 用户归属 | 一个用户同一时间只属于一个企业 |
| 企业管理员产生方式 | 系统管理员在后台创建企业 + 指定管理员 |
| 额度来源 | 企业管理员**个人 quota**，无独立企业额度池 |
| 邀请码特性 | 可重复使用 + 支持有效期 + 可随时撤销/禁用 |
| 加入流程 | 填码 → 产生申请记录 → 企业管理员审批（同意/拒绝） |
| 标签模型 | 预设标签集合 + 多对多（一个成员可有多个标签），企业内独立 |
| 批量下发语义 | 原子事务（全部成功才提交，否则整批失败） |
| 企业管理员权限边界 | 查看成员额度 / 批量下发额度 / 踢人 / 打标签筛选；**不开放成员消费记录/调用日志** |
| 移出企业后额度处理 | 已发额度保留，仅解除归属关系 |
| 成员查询筛选维度 | 标签 + 用户名/显示名 + 额度范围 + 加入时间 |

## 三、数据模型

全部为新增表，不修改任何历史表。遵循项目 GORM v2 + 三数据库兼容（SQLite / MySQL / PostgreSQL）规范。

### 3.1 表清单（共 6 张）

#### `enterprises`（企业表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (主键，GORM 自生成) | |
| name | string | 企业名称 |
| status | int | 1=启用，2=停用 |
| admin_user_id | int (索引) | 企业管理员的 user.id |
| created_time | int64 | 创建时间戳 |
| updated_time | int64 | 更新时间戳 |

#### `enterprise_members`（企业成员归属表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (主键) | |
| enterprise_id | int (索引) | 所属企业 |
| user_id | int (索引) | 成员的 user.id |
| role | int | 10=企业管理员，1=普通成员 |
| status | int | 1=在职，2=已移出 |
| joined_at | int64 | 加入时间 |
| removed_at | int64 | 移出时间（0=未移出） |

约束：`unique(enterprise_id, user_id)`。

> **说明**：不在 user 表加 enterprise_id，而是用本表表达归属。一个用户同一时间只属于一个企业，在代码层保证（加入前校验用户无其他 active 归属）。

#### `enterprise_invitations`（企业邀请码表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (主键) | |
| enterprise_id | int (索引) | 所属企业 |
| code | string (unique) | 邀请码，生成时唯一 |
| status | int | 1=启用，2=禁用，3=已撤销 |
| max_uses | int | 最大使用次数，-1=无限 |
| used_count | int | 已使用次数（产生申请即 +1） |
| expired_at | int64 | 过期时间戳（0=永不过期） |
| created_by | int | 创建者 user.id |
| created_time | int64 | |

> **重要**：本邀请码与企业无关的现有 `aff_code`（全站推广返佣码）**完全独立**，不复用、不混淆。`aff_code` 继续做全站推广返佣。

#### `enterprise_join_requests`（加入申请表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (主键) | |
| enterprise_id | int (索引) | 申请加入的企业 |
| user_id | int (索引) | 申请人 user.id |
| invitation_id | int | 使用的邀请码 id |
| status | int | 1=pending，2=approved，3=rejected |
| reviewed_by | int | 审批人 user.id（0=未审批） |
| reviewed_at | int64 | 审批时间戳（0=未审批） |
| created_time | int64 | |

#### `enterprise_tags`（标签定义表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (主键) | |
| enterprise_id | int (索引) | 所属企业 |
| name | string | 标签名（企业内唯一） |
| color | string | 可选，标签颜色 |
| created_time | int64 | |

约束：`unique(enterprise_id, name)`。

#### `enterprise_member_tags`（成员-标签绑定表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int (主键) | |
| member_id | int (索引) | 指向 enterprise_members.id |
| tag_id | int (索引) | 指向 enterprise_tags.id |
| created_time | int64 | |

约束：`unique(member_id, tag_id)`。

### 3.2 数据库兼容性

- 所有表用 GORM `AutoMigrate` 创建，主键自生成，不使用 `AUTO_INCREMENT` / `SERIAL`。
- 不使用 `gorm:"default:true"` 类布尔默认值（MySQL/PostgreSQL 规范化差异会导致重复 ALTER）。默认值在代码层 `BeforeCreate` hook 或业务逻辑中设置。
- 不使用数据库特定的 JSON 列类型。
- 所有时间用 `int64`（Unix 秒），与现有 `model/user.go` 的 `CreatedTime` 风格一致。

## 四、模块代码结构

### 4.1 后端目录

```
enterprise/
├── models.go              # 6 张表的 GORM 模型定义
├── migration.go           # AutoMigrate 注册（模块自管）
├── router.go              # RegisterRoutes(routerGroup) — 唯一对外入口
├── auth.go                # 企业域权限中间件（复用 session，不碰 authz）
├── transfer.go            # 安全跨用户额度转账（事务+行锁，模块自管）
├── dto.go                 # 请求/响应结构
└── controller/
    ├── enterprise.go      # 系统管理员：建企业/指定管理员/停用
    ├── invitation.go      # 企业管理员：生成/撤销邀请码
    ├── join_request.go    # 申请：用户填码提交、管理员审批
    ├── member.go          # 成员查询（标签/用户名/额度/时间）、踢人
    ├── tag.go             # 标签 CRUD + 给成员打标/撕标
    └── quota.go           # 批量下发额度
```

整个模块**只通过 `enterprise.RegisterRoutes()` 和 `enterprise.AutoMigrate()` 两个函数**与主干接触。

### 4.2 前端目录

```
web/default/src/
├── routes/_authenticated/enterprise/
│   ├── index.tsx                      # 企业管理总入口（按角色分流）
│   ├── members.tsx                    # 成员管理（管理员）
│   ├── invitations.tsx                # 邀请码管理（管理员）
│   ├── join-requests.tsx             # 加入申请审批（管理员）
│   ├── tags.tsx                      # 标签管理（管理员）
│   └── distribute.tsx                # 批量下发额度（管理员）
└── features/enterprise/
    ├── api.ts                         # 接口调用
    ├── types.ts                       # 类型定义
    ├── constants.ts                   # 状态/角色常量
    └── components/
        ├── members-table.tsx          # 成员表格（多选 + 筛选）
        ├── member-filters.tsx         # 筛选栏（标签/用户名/额度/时间）
        ├── invitation-form.tsx        # 生成邀请码表单
        ├── join-request-card.tsx      # 申请审批卡片
        ├── tag-manager.tsx            # 标签增删
        ├── distribute-dialog.tsx      # 下发额度对话框
        └── join-enterprise-dialog.tsx # 普通用户填邀请码入口
```

前端代码集中在 `features/enterprise/` 和 `routes/_authenticated/enterprise/`，不动现有 features。

### 4.3 主干接入点

**后端**（`main.go` 或 router 初始化处），加 2 行：
```go
enterprise.AutoMigrate()
enterprise.RegisterRoutes(server.Group("/api"))
```

**前端**：新增路由目录 + 导航配置加 1 个菜单项。不动现有页面结构。

## 五、权限模型

### 5.1 与现有权限体系的关系

企业模块的权限**独立于**现有 `role`（1/10/100）和 authz casbin 体系，两者物理隔离、互不耦合：

- 现有 `role` / authz：管全站级权限（系统管理员能干啥）。
- 企业模块权限：管企业域级权限（企业管理员只能管本企业成员）。

企业管理员**始终是 `role=1` 普通用户**，永远拿不到系统管理员权限。企业管理员身份由 `enterprise_members.role=admin` 表达，不走 authz。

### 5.2 中间件（enterprise/auth.go，复用 session 不碰 authz）

| 中间件 | 作用 |
|--------|------|
| `SystemAdminGate()` | 复用现有 `role>=10` 判断，仅系统管理员建企业/指定管理员时用 |
| `EnterpriseAdminAuth()` | 取 ctx 的 user_id → 查 `enterprise_members(role=admin, status=在职)` → 注入 ctx.enterprise_id，否则 403 |
| `EnterpriseMemberScope()` | 校验请求里的目标 user_id 在同一企业的 `enterprise_members` 里，防越权访问非本企业成员 |

所有中间件建立在现有 `UserAuth()` / `AdminAuth()` 已经把当前用户 id 塞进 context 的基础上，只读 context，不修改现有中间件。

## 六、API 设计

全部挂在 `/api/enterprise/` 下，按操作者分三组。

### 6.1 系统管理员组（`AdminAuth()` 守卫，role≥10）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/enterprise/` | 创建企业 + 指定 admin_user_id |
| GET | `/api/enterprise/` | 企业列表 |
| PUT | `/api/enterprise/:id` | 改企业名/状态 |
| DELETE | `/api/enterprise/:id` | 删除企业：置 `enterprises.status=停用`，该企业所有 `enterprise_members.status` 置为「已移出」（成员保留已发额度，仅解除归属）。不物理删除任何记录。 |

### 6.2 企业管理员组（`EnterpriseAdminAuth()` 守卫）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/enterprise/me/members` | 成员列表（支持标签/用户名/额度/时间筛选） |
| GET | `/api/enterprise/me/members/:uid` | 成员详情（仅额度、标签、加入时间） |
| POST | `/api/enterprise/me/members/:uid/remove` | 踢人/移出企业 |
| POST | `/api/enterprise/me/invitations` | 生成邀请码（可设有效期、最大次数） |
| GET | `/api/enterprise/me/invitations` | 邀请码列表 |
| POST | `/api/enterprise/me/invitations/:id/revoke` | 撤销邀请码 |
| GET | `/api/enterprise/me/join-requests` | 待审批申请列表 |
| POST | `/api/enterprise/me/join-requests/:id/approve` | 同意申请 |
| POST | `/api/enterprise/me/join-requests/:id/reject` | 拒绝申请 |
| POST | `/api/enterprise/me/tags` | 创建标签 |
| GET | `/api/enterprise/me/tags` | 标签列表 |
| DELETE | `/api/enterprise/me/tags/:id` | 删除标签（联动解绑） |
| POST | `/api/enterprise/me/members/:uid/tags` | 给成员打标签（支持批量） |
| DELETE | `/api/enterprise/me/members/:uid/tags/:tid` | 撕标签 |
| POST | `/api/enterprise/me/quota/distribute` | 批量下发额度（核心） |

> 用 `/me/` 表达"当前企业管理员的企业上下文"。

### 6.3 普通用户组（`UserAuth()` 守卫）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/enterprise/join` | 提交邀请码，产生申请记录 |
| GET | `/api/enterprise/me` | 查看自己是否属于某企业 + 角色 |
| POST | `/api/enterprise/leave` | 主动退出企业 |

## 七、批量下发额度（计费安全核心）

这是整个模块唯一碰 `users.quota` 列的地方。严格遵循 `AGENTS.md` 计费安全不变量。

### 7.1 接口

```
POST /api/enterprise/me/quota/distribute
Body: { member_ids: [1,2,3], amount: 5000 }   // 给每个选中成员发 amount
```

### 7.2 算法（单事务，原子）

```
total = amount * len(member_ids)

进入 DB.Transaction:
    1. 校验 amount > 0，校验 member_ids 非空、去重
    2. 用 int64 中间值计算 total，夹取到 int32 范围防溢出
    3. 校验所有 member_ids 都在本企业 enterprise_members(status=在职) 里（防越权）
    4. lockForUpdate 锁定全部 member 行（按 id 升序，防死锁）+ 管理员行
    5. 校验 admin.quota >= total，否则 400 "余额不足"，整批回滚
    6. UPDATE users SET quota = quota + amount WHERE id IN (member_ids)
    7. UPDATE users SET quota = quota - total WHERE id = admin_id
    提交事务

事务后（非事务内，避免拖长事务）:
    8. 给管理员写一条 LogTypeManage 日志（"下发额度给 N 名成员，每人 X，共 Y"）
    9. 给每个成员写一条 LogTypeTopup 日志（"企业 {name} 下发额度 X"）

> 日志写入在事务外，采用最终一致：事务提交成功即计费已生效，日志若写入失败只影响审计可见性，不影响 quota 正确性。这与现有 `model/redemption.go` 的 `Redeem` 模式一致。日志失败应记录 `common.SysError`，不向用户报错。

返回 { success: [...member_ids], total, amount }
```

### 7.3 安全要点（对应 AGENTS.md 计费不变量）

| 风险 | 防护措施 |
|------|----------|
| 负数 / 溢出 | `amount > 0` 校验；`total` 用 int64 中间值防 int*int 溢出；最终用 `common.QuotaFromFloat` 等项目已有 helper 处理 |
| 余额扣负 | 事务内 `admin.quota >= total` 前置校验，不满足整批回滚，绝不产生负数额度 |
| 越权下发 | 事务内校验所有 member_ids 都在本企业 active 成员里 |
| 死锁 | 锁行统一按 id ASC 排序 |
| 并发竞争 | `lockForUpdate` 行锁 + 单事务原子提交，参考 `model/redemption.go` 的 `Redeem` 和 `model/topup.go` 的 `ManualCompleteTopUp` 模板 |
| 日志可审计 | 双方各写日志；管理员侧写 `LogTypeManage` 带 admin_info |

> 复用项目已有 `common.QuotaFromFloat`、`model.lockForUpdate`，不造新轮子。

## 八、加入审批状态机

### 8.1 状态流转

```
[用户填邀请码]
      │
      ▼
 校验邀请码：存在？ 属于某企业？ 启用状态？ 未过期？ 用量未满？
      │ 任一不满足
      ├──────────────► 400 拒绝（码无效/已过期/已停用）
      ▼
 校验用户：当前是否已属于某企业（active 成员）？
      │ 是
      ├──────────────► 400 拒绝（已属于其他企业，请先退出）
      ▼
 校验重复申请：是否已有该企业的 pending 申请？
      │ 是
      ├──────────────► 400 拒绝（请等待审批结果）
      ▼
 创建 enterprise_join_requests 记录（status=pending）
 邀请码 used_count + 1
      │
      ▼
 [企业管理员在后台看到申请]
      │
      ├──同 意──► 事务内：
      │           1. 再次校验用户此时仍未属于其他企业（防并发抢占）
      │           2. lockForUpdate 锁申请记录，CAS 状态从 pending 翻 approved
      │           3. 创建 enterprise_members 记录（role=成员, status=在职）
      │           → 返回成功
      │
      └──拒 绝──► 申请记录 status=rejected, reviewed_by/at 填充
                  → 返回成功（用户可重新申请）
```

### 8.2 关键校验点

| 校验点 | 时机 | 原因 |
|--------|------|------|
| 邀请码有效性 | 提交时 | 防止无效码产生垃圾申请 |
| 用户未属于其他企业 | 提交时 + 审批时 | 提交时防误操作，审批时防并发（用户在此期间加入了别的企业） |
| 无重复 pending 申请 | 提交时 | 防止刷屏 |
| 成员归属原子写入 | 审批通过时事务内 | 创建 member 记录 + 更新申请状态 CAS 在同一事务，防并发重复同意 |

### 8.3 踢人/退出后的处理

- 成员被踢或主动退出：`enterprise_members.status` 置为「已移出」，`removed_at` 填充。
- **已发额度保留**，仅解除归属关系。企业失去对该用户的管理权。
- 用户可重新申请加入其他企业。

## 九、前端页面与交互

### 9.1 角色分流入口

- **系统管理员**（role≥10）：后台导航看到「企业管理」菜单 → 企业列表（建企业/指定管理员/停用）
- **企业管理员**：个人导航看到「我的企业」菜单 → 成员管理、邀请码、申请审批、标签、下发
- **普通用户**：在「个人设置」或「钱包」页加一个「加入企业」入口（填邀请码的对话框）；已加入企业的用户在该处显示所属企业 + 退出按钮

### 9.2 成员管理页（核心页面）

- 表格多选 + 顶部筛选栏（标签多选、用户名模糊、额度区间、加入时间区间）
- 选中成员后底部出现批量操作栏：「批量下发额度」「批量打标签」
- 单行操作：「打标签」「踢出企业」「查看额度」
- 成员详情**只显示额度、标签、加入时间**，不显示消费记录/调用日志

### 9.3 国际化

所有用户可见文案走 i18next，在 `web/default/src/i18n/locales/{lang}.json` 补充对应英文 key 的翻译。

## 十、测试策略

遵循 `AGENTS.md` 后端测试规范，重点保护计费安全不变量和审批并发。

### 10.1 必须覆盖的测试

| 测试 | 保护的不变量 |
|------|-------------|
| 批量下发：余额充足，全员成功 | 正常路径，双方 quota 正确增减 |
| 批量下发：余额不足，整批回滚 | 原子性，不产生部分成功 |
| 批量下发：member_ids 含非本企业成员 | 越权防护，整批拒绝 |
| 批量下发：amount=0 或负数 | 入参校验 |
| 批量下发：amount * count 溢出 | 溢出防护，夹取到 int32 |
| 审批同意：并发两次同意同一申请 | CAS 防重复加入 |
| 审批同意：用户已加入其他企业 | 审批时再次校验归属 |
| 加入申请：已属于企业时提交 | 提交时校验归属 |
| 邀请码：过期/已撤销/已禁用 | 邀请码有效性 |
| 踢人：已移出成员的额度保留 | 额度不回收 |

### 10.2 测试规范

- 使用 `testify/require` 做 setup 和致命断言，`testify/assert` 做非致命值检查。
- 表驱动测试，显式输入和精确期望输出。
- 需要数据库状态时在测试 fixture 内显式初始化。
- 不造无意义的覆盖率测试。

## 十一、非目标（明确排除）

以下功能**不在本次范围**：

- 独立的企业额度池（本次用管理员个人 quota）
- 企业管理员查看成员消费记录/调用日志
- 成员级别的计费倍率配置（复用现有 group 倍率体系，企业模块不碰计费倍率）
- 用户间自由转账（仅支持企业管理员→成员的单向下发）
- 移出企业时回收额度（已发额度保留）
- 一个用户属于多个企业
- 用户自助创建企业（仅系统管理员创建）

## 十二、未来可扩展点（本次不实现）

- 独立企业额度池（企业表加 quota 字段，独立于管理员个人账户）
- 企业级计费倍率（企业成员统一走某个 group）
- 多企业管理员（同一企业多个管理员）
- 企业内角色细分（部门、组长等）
- 成员消费记录/调用日志查看（需额外隐私策略）
