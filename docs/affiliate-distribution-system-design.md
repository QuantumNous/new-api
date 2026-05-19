# 二级分销系统设计方案

## 背景与目标

当前项目已经有一层邀请体系，主要能力包括用户邀请码 `aff_code`、邀请关系字段 `inviter_id`、邀请人数 `aff_count`、邀请奖励额度 `aff_quota` 与历史邀请奖励 `aff_history_quota`。这些字段主要服务于“注册邀请奖励”和用户侧的邀请额度转余额。

本方案新增的是“钱包充值成功后的二级分销佣金账本”。它不替换现有注册邀请奖励，也不改变现有充值到账逻辑，而是在钱包充值订单完成后，按邀请链路生成一级、二级推广人的待结算佣金明细，供管理员线下打款和对账。

第一版目标：

- 按钱包充值实付金额自动计算一级、二级佣金。
- 支持全局总开关控制分销系统是否生效。
- 支持针对单个用户开启或关闭代理资格。
- 生成可查询、可汇总、可导出的待结算佣金账本。
- 管理员线下打款后，可在系统内标记佣金为已结算。

第一版不做：

- 不做线上提现、银行卡、付款接口或提现审核流。
- 不做退款冲正、佣金撤销或负向账单。
- 不追溯历史订单，只处理功能上线后的新成功订单。
- 不覆盖订阅订单，只覆盖钱包充值订单。

## 已确认业务口径

佣金只在钱包充值成功后生成，不覆盖订阅订单。

返佣基数使用 `TopUp.Money` 实付金额。该金额已经反映用户实际支付口径、充值折扣、分组充值倍率和支付通道计算结果，适合作为线下财务对账基数。

分销层级为两级：

- 一级推广人：充值用户的 `inviter_id` 对应用户。
- 二级推广人：一级推广人的 `inviter_id` 对应用户。

佣金费率采用后台全局两档配置：

- 一级佣金比例。
- 二级佣金比例。

佣金先进入待结算账本。管理员完成线下打款后，在后台将对应佣金明细标记为已结算，并可记录结算备注。

佣金币种使用后台统一配置的币种标签，默认 `CNY`。第一版不按支付通道拆分多币种账本。

## 总开关与单用户代理资格开关

二级分销系统需要一个全局总开关。

- 全局总开关默认关闭。
- 全局总开关关闭时，所有钱包充值成功订单都不生成分销佣金。
- 全局总开关开启后，才按费率和邀请链路生成佣金。

同时需要支持针对单个用户开启或关闭代理资格。

- 全局开启后，用户默认具备代理资格。
- 单用户开关控制“该用户能否作为推广人获得佣金”。
- 单用户代理资格关闭后，不影响该用户作为购买者充值触发合格上级返佣。
- 被关闭的推广人只跳过对应层级佣金，另一层级独立判断。

示例：

- 用户 C 充值，用户 B 是 C 的一级推广人，用户 A 是 B 的一级推广人。
- 若 B 的代理资格关闭，A 的代理资格开启，则跳过 B 的一级佣金，仍给 A 生成二级佣金。
- 若 A 的代理资格关闭，B 的代理资格开启，则给 B 生成一级佣金，跳过 A 的二级佣金。
- 若 C 的代理资格关闭，但 B 和 A 的代理资格开启，C 充值时仍可给 B 和 A 生成佣金，因为 C 此时是购买者，不是推广人。

## 后端配置设计

新增 `distribution_setting` 配置模块，注册到现有 `setting/config` 配置体系。

建议字段：

- `enabled`: `bool`，全局总开关，默认 `false`。
- `level1_rate_bps`: `int`，一级佣金万分比，默认 `0`。例如 `1000` 表示 `10%`。
- `level2_rate_bps`: `int`，二级佣金万分比，默认 `0`。例如 `300` 表示 `3%`。
- `currency`: `string`，佣金币种标签，默认 `CNY`。

配置校验规则：

- `level1_rate_bps` 和 `level2_rate_bps` 范围为 `0..10000`。
- 两级费率之和不得超过 `10000`。
- 开启全局分销或设置正数佣金费率时，必须已完成现有支付合规确认。
- 配置仍通过 `/api/option/` 修改，并沿用 Root 用户权限要求。

新增用户字段：

- Go 字段：`DistributionEnabled bool`
- JSON 字段：`distribution_enabled`
- DB 字段：`distribution_enabled`
- 默认值：`true`
- 含义：该用户是否有资格作为推广人获得分销佣金。

用户管理接口需要返回并支持更新该字段，供管理员针对单个用户开启或关闭代理资格。

## 数据模型设计

新增佣金明细表 `AffiliateCommission`，用于记录每一笔充值订单对每个推广层级产生的应付佣金。

建议字段：

- `id`: 主键。
- `trade_no`: 钱包充值订单号。
- `top_up_id`: 充值订单 ID。
- `buyer_id`: 充值用户 ID。
- `promoter_id`: 推广人用户 ID。
- `level`: 佣金层级，取值为 `1` 或 `2`。
- `base_amount_micros`: 返佣基数，使用 `TopUp.Money * 1_000_000` 后的整数。
- `commission_rate_bps`: 佣金费率，万分比。
- `commission_amount_micros`: 佣金金额，使用整数 micros 存储。
- `currency`: 佣金币种标签。
- `payment_provider`: 支付提供方，例如 `epay`、`stripe`、`creem`、`waffo`。
- `payment_method`: 支付方式。
- `status`: 结算状态，取值为 `pending` 或 `settled`。
- `settled_at`: 结算时间。
- `settled_by`: 执行结算标记的管理员 ID。
- `settle_remark`: 结算备注。
- `created_at`: 创建时间。
- `updated_at`: 更新时间。

索引建议：

- `trade_no + level` 唯一索引，用于保证支付回调重试、管理员重复补单等场景不会重复入账。
- `promoter_id + status + created_at` 普通索引，用于代理佣金列表和后台待结算查询。
- `buyer_id` 普通索引，用于按购买者追踪佣金来源。
- `trade_no` 普通索引，用于按订单号排查。

数据库兼容要求：

- 使用 GORM `AutoMigrate` 新增表。
- 同时加入普通迁移和 fast 迁移列表。
- 兼容 SQLite、MySQL 和 PostgreSQL。
- 不使用数据库特有 JSON/JSONB 类型。
- 如需 raw SQL，必须遵守项目已有跨数据库兼容规则。

## 充值成功佣金生成流程

佣金生成应放在 model 层的钱包充值成功事务中，避免不同支付通道重复实现或漏接。

建议流程：

1. 支付回调或管理员补单确认钱包充值订单成功。
2. 在同一个数据库事务中锁定并校验 `TopUp` 订单。
3. 标记订单为成功，并给购买者增加充值额度。
4. 判断 `distribution_setting.enabled` 是否开启。
5. 查询购买者用户信息，取 `inviter_id` 作为一级推广人 ID。
6. 查询一级推广人，取其 `inviter_id` 作为二级推广人 ID。
7. 对一级、二级分别独立判断是否可以生成佣金。
8. 使用 `TopUp.Money` 作为返佣基数，按对应层级费率计算佣金。
9. 在同一事务内写入 `AffiliateCommission` 明细。
10. 事务提交后，原有充值日志照常记录。

每个层级的佣金生成条件：

- 全局总开关已开启。
- 对应层级费率大于 `0`。
- 推广人 ID 不为空。
- 推广人存在且未软删除。
- 推广人状态为 enabled。
- 推广人的 `distribution_enabled` 为 `true`。
- 推广人不是购买者本人。
- 二级推广人与一级推广人不重复。
- 计算出的佣金金额大于 `0`。

幂等要求：

- 同一 `trade_no + level` 只能生成一条佣金记录。
- 支付回调重试、重复通知、管理员重复补单不能重复生成佣金。
- 若订单已经是成功状态，充值路径应保持现有幂等行为，并不得重复创建佣金。

金额计算要求：

- 使用 `shopspring/decimal` 进行金额计算。
- `TopUp.Money` 转为 `base_amount_micros` 后再按 bps 计算。
- 存储使用整数 micros，前端展示时再格式化为常规金额。

接入范围：

- Epay 钱包充值。
- Stripe 钱包充值。
- Creem 钱包充值。
- Waffo 钱包充值。
- Waffo Pancake 钱包充值。
- 管理员手动补单。

不接入范围：

- 订阅订单支付。
- 兑换码充值。
- 签到奖励。
- 注册邀请奖励。
- 管理员手动加减额度。

## API 设计

### 用户侧接口

`GET /api/affiliate/self/summary`

用途：查询当前用户作为推广人的佣金汇总。

权限：`UserAuth`

返回建议：

- `pending_amount_micros`
- `settled_amount_micros`
- `total_amount_micros`
- `pending_count`
- `settled_count`
- `total_count`
- `currency`

`GET /api/affiliate/self/commissions`

用途：查询当前用户自己的佣金明细。

权限：`UserAuth`

查询参数：

- `p`
- `page_size`
- `status`

返回建议：

- 分页数据。
- 每条明细包含订单号、购买者、层级、返佣基数、费率、佣金金额、币种、状态、创建时间、结算时间。

### 管理员侧接口

`GET /api/affiliate/admin/commissions`

用途：管理员查询全站佣金明细。

权限：`AdminAuth`

筛选参数：

- `status`
- `level`
- `promoter_id`
- `buyer_id`
- `trade_no`
- `start_time`
- `end_time`
- `p`
- `page_size`

`GET /api/affiliate/admin/summary`

用途：管理员按筛选条件查询全站佣金汇总。

权限：`AdminAuth`

`POST /api/affiliate/admin/commissions/settle`

用途：管理员批量标记佣金为已结算。

权限：`AdminAuth`

请求体建议：

```json
{
  "ids": [1, 2, 3],
  "remark": "2026-05-19 offline payout"
}
```

处理规则：

- 事务内批量处理。
- 所有 ID 必须存在。
- 所有记录必须为 `pending`。
- 任一记录不满足条件则整批失败。
- 成功后写入 `settled`、`settled_at`、`settled_by` 和 `settle_remark`。

`GET /api/affiliate/admin/commissions/export`

用途：管理员导出 CSV，用于线下打款和财务对账。

权限：`AdminAuth`

导出字段建议：

- 佣金 ID
- 订单号
- 买家 ID
- 买家用户名
- 推广人 ID
- 推广人用户名
- 层级
- 返佣基数
- 费率
- 佣金金额
- 币种
- 支付提供方
- 支付方式
- 状态
- 创建时间
- 结算时间
- 结算人
- 结算备注

### 用户管理接口

用户列表、用户详情和用户更新接口需要包含：

- `distribution_enabled`

管理员可以在用户管理中开启或关闭该用户的代理资格。

## 前端设计

### 系统设置

在默认前端的系统设置 `Billing & Payment` 中新增 `Distribution` 小节。

控件建议：

- 使用开关控件控制全局总开关。
- 使用数字输入或百分比输入配置一级佣金比例。
- 使用数字输入或百分比输入配置二级佣金比例。
- 使用文本输入配置佣金币种标签。

交互要求：

- 未完成支付合规确认时，禁止开启分销或保存正数佣金费率。
- 前端展示百分比，后端保存 bps。
- 保存后刷新页面能正确回填配置。

### Wallet 页面

保留现有 `Referral Program` 邀请卡片。

新增佣金账本展示区域：

- 待结算佣金。
- 已结算佣金。
- 累计佣金。
- 最近佣金明细。

注意：

- 佣金不显示“转入余额”。
- 佣金不提供线上提现按钮。
- 文案明确该佣金由管理员线下结算。

### Admin 佣金管理页面

新增后台佣金管理页面，例如 `/affiliate-commissions`。

页面能力：

- 查看佣金汇总。
- 查询佣金明细。
- 按状态、层级、推广人、购买者、订单号、时间范围筛选。
- 分页。
- 批量选择待结算记录。
- 批量标记已结算。
- 导出 CSV。

导航：

- 在 Admin 侧边栏中新增佣金管理入口。
- 新增 admin 模块键 `affiliate`，供侧边栏配置控制显示。
- 更新 URL 到模块键映射，确保侧边栏权限过滤正常。

### 用户管理页面

用户列表或用户详情中展示代理资格状态。

用户编辑抽屉或弹窗中支持修改 `distribution_enabled`。

建议展示：

- 开启：可获得分销佣金。
- 关闭：不能作为推广人获得佣金。

### 国际化

新增 UI 文案必须补齐默认前端所有语言：

- `en`
- `zh`
- `fr`
- `ja`
- `ru`
- `vi`

完成后运行：

```bash
cd web/default
bun run i18n:sync
```

## 测试计划

后端测试：

- 全局总开关关闭时，钱包充值成功不生成任何佣金。
- 全局总开关开启且两级推广人均开启时，生成一级和二级佣金。
- 一级推广人 `distribution_enabled=false` 时，只跳过一级佣金。
- 二级推广人 `distribution_enabled=false` 时，只跳过二级佣金。
- 购买者本人 `distribution_enabled=false` 不影响其充值给合格上级返佣。
- 新用户默认 `distribution_enabled=true`。
- 一级费率为 `0` 时，不生成一级佣金。
- 二级费率为 `0` 时，不生成二级佣金。
- 两级费率合计超过 `100%` 时配置保存失败。
- 支付回调重试不会重复生成佣金。
- 管理员重复补单不会重复生成佣金。
- Epay、Stripe、Creem、Waffo、Waffo Pancake、管理员补单路径均覆盖。
- 订阅订单成功不生成佣金。
- 兑换码、签到、注册邀请奖励、管理员加减额度不生成佣金。
- 批量结算只能处理 `pending` 记录。
- 批量结算混入已结算或不存在记录时整批失败。
- 用户侧接口只能查看自己的佣金。
- 管理员接口需要 Admin 权限。
- 分销配置修改需要 Root 权限。
- 未完成支付合规确认时，不能开启分销或设置正佣金费率。

前端验证：

- `cd web/default && bun run typecheck`
- `cd web/default && bun run lint`
- `cd web/default && bun run i18n:sync`
- Wallet 页面在桌面和移动端展示正常。
- Admin 佣金管理页面筛选、分页、批量结算、导出入口可用。
- 用户管理页面能查看和修改单用户代理资格。
- 系统设置保存后刷新能正确回填总开关、比例和币种。

最终回归：

```bash
go test ./model ./controller
```

如时间允许，执行：

```bash
go test ./...
```

## 注意事项

新增 Go 代码中，JSON 编解码必须遵守项目约定：

- 使用 `common.Marshal`
- 使用 `common.Unmarshal`
- 使用 `common.UnmarshalJsonStr`
- 使用 `common.DecodeJson`

不要在业务代码中直接调用 `encoding/json` 的 marshal 或 unmarshal。

数据库实现必须同时兼容：

- SQLite
- MySQL 5.7.8+
- PostgreSQL 9.6+

迁移应优先使用 GORM 抽象。必须写 raw SQL 时，要遵守项目已有跨数据库差异处理规则。

不得修改、删除、替换或移除项目受保护的品牌、版权、作者、模块路径、README、许可证、元数据和相关标识。

二级分销账本与现有注册邀请奖励保持分离：

- 不改变 `QuotaForInviter`
- 不改变 `QuotaForInvitee`
- 不改变现有 `aff_quota` 转余额逻辑
- 不把充值佣金自动转入用户余额

第一版只负责把账算清楚，供管理员线下结算。
