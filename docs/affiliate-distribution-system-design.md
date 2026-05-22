# 二级分销积分系统设计方案

## 背景与目标

当前项目已经有一层邀请体系，主要能力包括用户邀请码 `aff_code`、邀请关系字段 `inviter_id`、邀请人数 `aff_count`、邀请奖励额度 `aff_quota` 与历史邀请奖励 `aff_history_quota`。这些字段主要服务于“注册邀请奖励”和用户侧的邀请额度转余额。

本方案描述的是“钱包充值成功后的二级分销积分账本”。它不替换现有注册邀请奖励，也不改变充值到账逻辑，而是在钱包充值订单完成后，按照邀请链路生成一级、二级推广人的待处理奖励积分。奖励积分可由用户自主兑换到钱包，也可由管理员在后台记录线下返现并扣除积分。

核心目标：

- 按被邀请用户实际充值到账额度生成一级、二级奖励积分。
- 支持全局总开关控制分销积分系统是否生效。
- 支持针对单个用户开启或关闭代理资格。
- 用户可自主选择整数积分兑换到钱包。
- 管理员可在后台记录某用户通过多少积分完成线下返现，并扣除用户待处理积分。
- 统一通过积分处理流水查询用户兑换和管理员线下返现记录。
- 用户侧页面保持简洁，只展示待处理积分、已兑换积分、累计积分和积分处理记录。

不做的事情：

- 不做线上提现、银行卡、第三方付款接口或提现审核流。
- 不计算、不保存、不展示线下现金价值。
- 不要求用户维护 PayPal 或其他线下收款资料。
- 不追溯历史订单，只处理功能上线后的新成功订单；兼容迁移只补齐必要审计字段。
- 不覆盖订阅订单，只覆盖钱包充值订单。
- 不改变现有注册邀请奖励 `aff_quota`、`QuotaForInviter`、`QuotaForInvitee` 的口径。

## 已确认业务口径

奖励积分只在钱包充值成功后生成，不覆盖订阅订单。

返积分基数使用被邀请用户本次实际到账的钱包额度，而不是支付金额。项目内统一按 raw quota 存储钱包额度，因此实际到账额度定义为：

```text
credited_wallet_units = baseQuota / common.QuotaPerUnit
```

其中当前 `common.QuotaPerUnit = 500000`，也就是 `1` 个钱包额度单位等于 `500000` token。

分销层级为两级：

- 一级推广人：充值用户的 `inviter_id` 对应用户。
- 二级推广人：一级推广人的 `inviter_id` 对应用户。

奖励积分比例采用后台全局两档配置：

- 一级积分比例。
- 二级积分比例。

积分处理方式只有两类：

- `wallet`：用户自主兑换到钱包。
- `offline_cashback`：管理员后台记录线下返现并扣除积分。

管理员线下返现只记录“用户通过多少积分完成了线下返现”和备注，不增加用户钱包余额，不计算现金金额，不展示线下打款金额。

## 积分生成逻辑

充值成功后，`CreateTopUpCommissionsWithTx` 使用充值事务中的实际到账 `baseQuota` 作为计算基数。`TopUp.Money` 不再参与分销积分生成。

计算公式：

```text
credited_wallet_units = baseQuota / common.QuotaPerUnit
reward_points = round(credited_wallet_units * rate_bps / 10000)
```

示例：

```text
common.QuotaPerUnit = 500000
baseQuota = 50000000
credited_wallet_units = 100

level1_rate_bps = 1000
level2_rate_bps = 300

level1_reward_points = round(100 * 1000 / 10000) = 10
level2_reward_points = round(100 * 300 / 10000) = 3
```

因此，如果被邀请用户支付 20 元但实际购买/到账 100 美刀额度，就按 100 个钱包额度单位计算奖励积分。只要 `baseQuota` 相同，即使 `TopUp.Money` 改变，生成的奖励积分也不变。

原始积分记录保存本次充值的审计信息：

- `base_quota`：本次充值实际到账 token 数。
- `base_amount_micros`：由 `base_quota / common.QuotaPerUnit` 换算出的钱包额度单位 micros，用于展示和历史兼容。
- `reward_points`：本层级生成的奖励积分。
- `commission_rate_bps`：本层级比例快照。

## 积分兑换到钱包

用户可在用户侧页面输入正整数积分进行兑换。兑换固定为：

```text
1 积分 = 1 钱包额度单位 = 500000 token
redeemed_quota = redeemed_points * common.QuotaPerUnit
redeemed_wallet_amount = redeemed_points
```

兑换不再读取 `operation_setting.Price`，也不再使用线下价值或现金价值字段换算。

处理规则：

- 用户只能兑换自己的待处理积分。
- 兑换积分必须为正整数。
- 兑换积分不得超过当前待处理积分。
- 系统按当前用户全部待处理积分记录的 `created_at asc, id asc` FIFO 消耗。
- 一条原始积分记录可以被部分兑换；剩余积分继续保持待处理。
- 兑换成功后增加用户钱包 `quota`。
- 兑换成功后写入 `AffiliateCommissionSettlement`，`settlement_type = wallet`。

示例：

```text
redeemed_points = 1
redeemed_quota = 1 * 500000 = 500000

redeemed_points = 10
redeemed_quota = 10 * 500000 = 5000000
```

## 管理员线下返现扣积分

管理员后台保留线下返现操作，但语义为“记录某用户通过多少积分线下返现了，并扣除该用户待处理积分”。

接口：

```text
POST /api/affiliate/admin/rewards/offline-cashback
```

请求体：

```json
{
  "promoter_id": 1002,
  "points": 10,
  "remark": "2026-05-22 offline cashback"
}
```

处理规则：

- `promoter_id` 必须存在。
- `points` 必须为正整数。
- 用户待处理积分必须大于等于本次返现积分。
- 按该用户待处理积分记录的 `created_at asc, id asc` FIFO 扣除。
- 更新原始 `AffiliateCommission` 的累计处理进度。
- 写入 `AffiliateCommissionSettlement` 流水，`settlement_type = offline_cashback`。
- 不增加用户钱包余额。
- 不计算、不保存、不展示现金价值。
- 操作人使用当前管理员用户 ID 写入 `settled_by`。

数据库兼容上继续复用旧的 `offline_settled_points` 列保存线下返现扣除积分，并在响应中通过 `offline_cashback_points` 明确当前业务语义。

## 积分处理进度

原始积分记录 `AffiliateCommission` 表示“某笔充值给某个推广人产生了多少积分”。每次用户兑换或管理员线下返现都会累计处理进度。

核心字段：

- `reward_points`：累计生成积分。
- `settled_points`：累计已处理积分总数。
- `wallet_redeemed_points`：累计已兑换到钱包的积分。
- `offline_settled_points`：兼容旧列，当前语义为累计线下返现扣除积分。
- `offline_cashback_points`：响应层别名，等于 `offline_settled_points`。

待处理积分：

```text
pending_points = reward_points - settled_points
```

状态：

- `pending`：仍有待处理积分。
- `settled`：本条积分已全部处理完。

一条积分记录可能先部分兑换到钱包，再由管理员把剩余积分记录为线下返现；也可能反过来，只要仍有待处理积分即可继续处理。

## 汇总口径

汇总接口统一返回积分维度字段：

```json
{
  "pending_points": 90,
  "wallet_redeemed_points": 10,
  "offline_cashback_points": 20,
  "redeemed_points": 30,
  "settled_points": 30,
  "total_points": 120
}
```

字段含义：

- `pending_points`：未处理积分。
- `wallet_redeemed_points`：用户兑换到钱包的积分。
- `offline_cashback_points`：管理员后台线下返现扣除的积分。
- `redeemed_points`：已处理积分总数，等于钱包兑换积分 + 线下返现积分。
- `settled_points`：兼容旧命名，等于已处理积分总数。
- `total_points`：累计生成积分。

用户侧“已兑换积分”展示已处理积分总数，不单独强调线下返现；管理员侧单独展示线下返现积分，便于运营对账。

## 积分处理流水

`AffiliateCommissionSettlement` 是积分处理流水表。每条流水表示一次积分处理：

- 用户自主兑换到钱包。
- 管理员线下返现扣积分。

核心字段：

- `commission_id`：原始积分记录 ID。
- `promoter_id`：积分所属用户 ID。
- `settlement_type`：`wallet` 或 `offline_cashback`。
- `settled_points`：本次处理积分数量。
- `wallet_quota`：钱包兑换实际到账 raw quota；线下返现为 `0`。
- `wallet_amount_micros`：钱包兑换额度单位 micros；线下返现为 `0`。
- `settled_by`：执行处理的用户 ID。钱包兑换为用户本人，线下返现为管理员。
- `settled_at`：处理时间。
- `remark`：备注。

历史兼容字段如 `cash_value_micros`、`price_per_wallet_unit_micros`、`points_per_amount_unit`、`offline_amount_per_point_micros` 保留用于数据库兼容，新流程写入 `0`，前端不展示。

## 总开关与代理资格

分销积分系统有一个全局总开关：

- 全局总开关默认关闭。
- 全局总开关关闭时，钱包充值成功订单不生成分销积分。
- 全局总开关开启后，才按比例和邀请链路生成积分。

同时支持针对单个用户开启或关闭代理资格：

- 用户默认具备或不具备代理资格以当前项目用户创建逻辑为准。
- 单用户开关控制“该用户能否作为推广人获得分销积分”。
- 单用户代理资格关闭后，不影响该用户作为购买者充值触发合格上级获得积分。
- 被关闭的推广人只跳过对应层级积分，另一层级独立判断。

示例：

- 用户 C 充值，用户 B 是 C 的一级推广人，用户 A 是 B 的一级推广人。
- 若 B 的代理资格关闭，A 的代理资格开启，则跳过 B 的一级积分，仍可给 A 生成二级积分。
- 若 A 的代理资格关闭，B 的代理资格开启，则给 B 生成一级积分，跳过 A 的二级积分。
- 若 C 的代理资格关闭，但 B 和 A 的代理资格开启，C 充值时仍可给 B 和 A 生成积分，因为 C 此时是购买者，不是推广人。

## 后端配置

`distribution_setting` 配置模块保留三个业务配置：

- `enabled`：`bool`，全局总开关，默认 `false`。
- `level1_rate_bps`：`int`，一级积分比例万分比，默认 `0`。例如 `1000` 表示 `10%`。
- `level2_rate_bps`：`int`，二级积分比例万分比，默认 `0`。例如 `300` 表示 `3%`。

配置校验规则：

- `level1_rate_bps` 和 `level2_rate_bps` 范围为 `0..10000`。
- 两级比例之和不得超过 `10000`。
- 开启全局分销或设置正数比例时，必须已完成现有支付合规确认。
- 配置仍通过 `/api/option/` 修改，并沿用 Root 用户权限要求。

为兼容历史配置，后端结构中可保留旧字段；默认前端设置页面不再展示每支付单位积分基数、每积分线下价值、币种或线下价值说明。

## 后端生成流程

积分生成放在 model 层的钱包充值成功事务中，避免不同支付通道重复实现或漏接。

流程：

1. 支付回调或管理员补单确认钱包充值订单成功。
2. 在同一个数据库事务中锁定并校验 `TopUp` 订单。
3. 标记订单为成功，并给购买者增加实际充值额度。
4. 将本次实际到账 `quotaToAdd` 作为 `baseQuota` 调用 `CreateTopUpCommissionsWithTx`。
5. 判断 `distribution_setting.enabled` 是否开启。
6. 查询购买者用户信息，取 `inviter_id` 作为一级推广人 ID。
7. 查询一级推广人，取其 `inviter_id` 作为二级推广人 ID。
8. 对一级、二级分别独立判断是否可以生成积分。
9. 使用 `baseQuota / common.QuotaPerUnit` 作为返积分基数，按对应层级比例计算积分。
10. 在同一事务内写入 `AffiliateCommission` 明细。
11. 事务提交后，原有充值日志照常记录。

每个层级的积分生成条件：

- 全局总开关已开启。
- 对应层级比例大于 `0`。
- 推广人 ID 不为空。
- 推广人存在且未软删除。
- 推广人状态为 enabled。
- 推广人的 `distribution_enabled` 为 `true`。
- 推广人不是购买者本人。
- 二级推广人与一级推广人不重复。
- 计算出的奖励积分大于 `0`。

幂等要求：

- 同一 `trade_no + level` 只能生成一条积分记录。
- 支付回调重试、重复通知、管理员重复补单不能重复生成积分。
- 若订单已经是成功状态，充值路径保持现有幂等行为，并不得重复创建积分。

## API 设计

### 用户侧接口

`GET /api/affiliate/self/summary`

用途：查询当前用户作为推广人的积分汇总。

权限：`UserAuth`

返回重点字段：

- `pending_points`
- `wallet_redeemed_points`
- `offline_cashback_points`
- `redeemed_points`
- `settled_points`
- `total_points`

`GET /api/affiliate/self/commissions`

用途：兼容查询当前用户自己的原始积分来源记录。

权限：`UserAuth`

`GET /api/affiliate/self/redemptions`

用途：查询当前用户自己的积分处理流水。

权限：`UserAuth`

查询参数：

- `p`
- `page_size`
- `settlement_type`
- `start_time`
- `end_time`

`POST /api/affiliate/self/rewards/quote`

用途：按用户输入积分预估钱包到账 token。

权限：`UserAuth`

请求体：

```json
{
  "points": 10
}
```

`POST /api/affiliate/self/rewards/redeem`

用途：用户自主兑换积分到钱包。

权限：`UserAuth`

请求体：

```json
{
  "points": 10
}
```

### 管理员侧接口

`GET /api/affiliate/admin/summary`

用途：管理员按筛选条件查询全站积分汇总。

权限：`AdminAuth`

`GET /api/affiliate/admin/commissions`

用途：兼容查询全站原始积分来源记录。

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

`GET /api/affiliate/admin/redemptions`

用途：管理员查询全站积分处理流水。

权限：`AdminAuth`

筛选参数：

- `settlement_type`
- `promoter_id`
- `start_time`
- `end_time`
- `p`
- `page_size`

`POST /api/affiliate/admin/rewards/offline-cashback`

用途：管理员记录线下返现并扣除用户待处理积分。

权限：`AdminAuth`

请求体：

```json
{
  "promoter_id": 1002,
  "points": 10,
  "remark": "2026-05-22 offline cashback"
}
```

`GET /api/affiliate/admin/commissions/export`

用途：管理员导出原始积分来源记录 CSV，用于运营对账。

权限：`AdminAuth`

### 下线接口

以下接口不再注册或不再由前端使用：

- `GET /api/affiliate/self/payout-profile`
- `PUT /api/affiliate/self/payout-profile`
- `POST /api/affiliate/admin/commissions/settle`

用户侧不再维护线下收款资料；旧的批量结算语义不再作为后台入口暴露。

## 前端设计

### 系统设置

默认前端的系统设置 `Billing & Payment` 中保留 `Distribution` 小节。

控件：

- 全局分销开关。
- 一级积分比例。
- 二级积分比例。

说明文案强调：比例应用于被邀请用户充值到账额度。

页面不展示：

- 每支付单位积分基数。
- 每积分线下价值。
- 币种或线下价值说明。

### 用户分销页

用户侧分销页面保持简洁：

- `Pending Points` / 待处理积分。
- `Redeemed Points` / 已兑换积分。
- `Total Points` / 累计积分。
- 积分处理流水列表。

流水列表展示：

- 处理时间。
- 积分数量。
- 钱包兑换记录展示到账 token。
- 管理员线下返现记录展示为已处理积分。

页面不展示：

- PayPal。
- 线下结算联系人。
- 线下价值。
- 结算金额。
- 线下返现操作入口。

### 管理员分销页

管理员分销页展示全站积分处理情况：

- 待处理积分。
- 已处理积分。
- 线下返现积分。
- 累计积分。
- 积分处理流水表。
- 线下返现扣积分操作。

线下返现操作字段：

- 用户 ID。
- 返现积分数量。
- 备注。

处理流水表展示：

- 用户。
- 处理方式：钱包兑换 / 线下返现。
- 积分数量。
- 到账 token，仅钱包兑换有值。
- 操作人，仅线下返现由管理员产生。
- 备注。
- 处理时间。

页面不展示现金金额、线下价值、PayPal 或结算联系人。

### 用户管理页面

用户列表或用户详情中展示代理资格状态。

用户编辑抽屉或弹窗中支持修改 `distribution_enabled`。

建议展示：

- 开启：可获得分销积分。
- 关闭：不能作为推广人获得分销积分。

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

后端模型测试：

- 用户支付 20 元但到账 100 钱包额度单位时，积分按 100 计算。
- 一级 10%、二级 3% 时，100 钱包额度单位到账分别生成 10 和 3 积分。
- `TopUp.Money` 改变但 `baseQuota` 相同，生成积分不变。
- 兑换 1 积分到账 `500000` token。
- 兑换 10 积分到账 `5000000` token。
- 修改 `operation_setting.Price` 不影响积分兑换结果。
- 用户部分兑换后，剩余积分保持 pending。
- 管理员线下返现 10 积分后，用户待处理积分减少 10，钱包余额不增加。
- 管理员线下返现超过用户待处理积分时失败。
- 管理员线下返现按 FIFO 扣除多条积分来源记录。
- 钱包兑换流水类型为 `wallet`。
- 管理员线下返现流水类型为 `offline_cashback`。
- 汇总中的待处理、钱包兑换、线下返现、已处理、累计积分都正确。

后端 controller/router 测试：

- 用户只能查询自己的积分处理流水。
- 管理员可查询全站积分处理流水。
- 管理员线下返现接口需要 Admin 权限。
- 线下返现请求缺少用户、积分为 0、积分超额时返回错误。
- payout profile 接口不再注册或不再被前端使用。
- 旧线下结算接口不再暴露旧语义。

前端验证：

- `cd web/default && bun run typecheck`
- `cd web/default && bun run lint`
- `cd web/default && bun run i18n:sync`
- 用户分销页只展示待处理积分、已兑换积分、累计积分。
- 用户分销页没有 PayPal、线下结算联系人、线下价值、结算金额等内容。
- 管理员分销页可以给指定用户记录线下返现积分。
- 管理员线下返现成功后列表新增流水，用户待处理积分减少。
- 管理员页面列表能区分钱包兑换和线下返现。
- 中英法日俄越 locale 补齐新增文案。

回归：

- `go test ./model ./controller`
- 如时间允许，执行 `go test ./...`
