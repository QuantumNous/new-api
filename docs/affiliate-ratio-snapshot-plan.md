# 邀请返佣比例快照化改造方案

## Summary
- 在现有平台全局 `AffRatio` 之外，为 `new-api` 用户新增**管理员可编辑**的邀请人覆盖比例 `aff_ratio_override`。
- 对所有**带邀请关系的新注册用户**，在注册成功时计算并冻结 `aff_ratio_snapshot`：优先取邀请人的 `aff_ratio_override`，未设置时取平台全局 `AffRatio`。
- 后续返佣结算不再读取“当前平台比例”或“邀请人当前比例”，而是读取**被邀请人注册时冻结的 `aff_ratio_snapshot`**。
- 历史已注册下线**不回填**；为了保持兼容，历史下线（`aff_ratio_snapshot IS NULL` 且 `inviter_id > 0`）继续按当前全局 `AffRatio` 结算。
- 不接入现有 `reseller_model_rule`/`is_reseller` 逻辑；本次仅改普通 affiliate 返佣，运营上需要 20%-30% 时通过管理员编辑邀请人的 `aff_ratio_override` 完成。

## Key Changes

### Data model
- 在 `model.User` 新增两个可空整数字段：
  - `aff_ratio_override`：邀请人自己的返佣覆盖比例，单位 `%`，可空；`NULL` 表示继承平台，`0` 表示显式禁用。
  - `aff_ratio_snapshot`：该用户作为**下线**在注册时冻结下来的返佣比例，单位 `%`，可空；仅无邀请人或历史未回填用户为 `NULL`。
- 采用 `AutoMigrate` 增量加列，不做历史回填脚本。

### Registration / data flow
- 所有会写入 `inviter_id` 的新建用户路径都统一走同一套快照逻辑：
  - 密码注册 `Register`
  - 管理员创建且携带 `inviter_id`
  - 任何通过 `InsertWithTx` / `CreateUser` 创建并带邀请人的桥接/OAuth 路径
- 快照计算规则固定为：
  - `inviter_id == 0` → `aff_ratio_snapshot = NULL`
  - 邀请人 `aff_ratio_override` 非空 → 取该值
  - 邀请人 `aff_ratio_override` 为空 → 取当前平台全局 `AffRatio`
- 快照一旦写入，后续**永不自动更新**；修改邀请人的 `aff_ratio_override` 只影响**未来新注册下线**，不影响已有下线。

### Commission settlement
- `ProcessAffCommission()` 改为优先读取充值用户（下线）的 `aff_ratio_snapshot`：
  - `snapshot` 非空且 `> 0` → 按 `snapshot` 结算
  - `snapshot == 0` → 不发返佣，也不写 `AffLog`
  - `snapshot == NULL` 且 `inviter_id > 0` → 视为历史兼容路径，按当前全局 `AffRatio` 结算
- 不修改 `aff_logs` 表结构；现有 `TopupAmount` + `Commission` 仍保留。
- 保留现有 `QuotaForInviter` / `QuotaForInvitee` 注册赠送逻辑，与本次充值返佣逻辑独立。

### Admin / API / UI
- 管理后台用户编辑新增可编辑字段 `aff_ratio_override`：
  - 仅管理员可改；沿用现有 `PUT /api/user/` 编辑链路与“不能编辑同级/更高角色用户”的权限约束。
  - 表单支持**留空**；留空提交为 `NULL`，明确输入 `0` 保留为禁用。
  - 校验为整数 `0-100`，空值允许。
  - 记录管理员操作日志，内容包含修改前后值。
- 用户相关返回结构新增：
  - `User` API/前端类型：`aff_ratio_override?: number | null`，`aff_ratio_snapshot?: number | null`
- 状态接口新增：
  - `/api/status` 新增 `effective_aff_ratio`
  - 语义：当前登录用户作为邀请人时的**有效返佣比例** = `aff_ratio_override ?? global AffRatio`
  - 保留现有 `aff_ratio` 作为全局平台值，避免影响其他旧代码
- 前台“推广有礼”页改为展示 `effective_aff_ratio`，不再直接展示全局 `aff_ratio`。
- 后台用户编辑/详情页展示：
  - 对邀请人显示可编辑的 `aff_ratio_override`
  - 对下线显示只读的 `aff_ratio_snapshot`（文案明确为“注册冻结返佣比例”）

## Test Plan
- **新下线继承平台值**
  - 平台 `AffRatio=10`，邀请人 `aff_ratio_override=NULL`
  - 新下线注册后写入 `aff_ratio_snapshot=10`
  - 后续平台改成 `30`，该下线充值仍按 `10%`
- **新下线使用邀请人覆盖值**
  - 平台 `AffRatio=10`，邀请人 `aff_ratio_override=30`
  - 新下线注册后写入 `aff_ratio_snapshot=30`
  - 后续邀请人改成 `5`、平台改成 `20`，该下线充值仍按 `30%`
- **显式禁用**
  - 邀请人 `aff_ratio_override=0`
  - 新下线注册后写入 `aff_ratio_snapshot=0`
  - 充值成功后不增加邀请人 `aff_quota/aff_history`，不写 `AffLog`
- **历史兼容**
  - 历史下线 `inviter_id > 0` 且 `aff_ratio_snapshot=NULL`
  - 充值时继续按当前全局 `AffRatio` 结算
- **无邀请关系**
  - `inviter_id=0` 的用户 `aff_ratio_snapshot=NULL`
  - 充值不触发返佣
- **后台编辑**
  - 管理员可将 `aff_ratio_override` 设为 `NULL / 0 / 30`
  - 非法值（负数、小数、>100）拒绝
  - 修改后用户列表/详情回显正确
- **前台展示**
  - 推广有礼页显示 `effective_aff_ratio`
  - `override=NULL` 时显示平台值，`override=0` 时显示 `0%`

## Assumptions
- 用户级与冻结快照比例均使用**整数百分比**，与现有全局 `AffRatio` 语义保持一致。
- 本次不实现“按邀请人/下线对单独配置不同返佣比例”的二维规则；一位邀请人只有一个管理员设置的覆盖值。
- 本次不改 `reseller_model_rule`、`is_reseller`、`reseller_user_id` 相关逻辑；“20%-30%”仅作为运营通过管理员改 `aff_ratio_override` 的使用方式，不新增独立分销结算体系。
- 创建用户表单无需新增该字段；只要求**编辑现有用户**时可维护邀请人覆盖值。
