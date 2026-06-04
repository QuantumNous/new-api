# Analytics API 使用说明

本文档说明 `/api/analytics/v1/*` 分析接口的认证方式、分页方式、请求参数和返回字段。这批接口用于合作方读取用户画像、用量、订阅、支付、渠道和模型可用性数据。

## 认证

所有接口都需要使用管理员账户名下的普通 API Key 访问：

```http
Authorization: Bearer sk-xxxx
```

认证规则：

- 使用与普通模型调用一致的 `TokenAuth` 校验逻辑。
- API Key 必须存在、启用、未过期、未耗尽。
- 如果该 API Key 配置了 IP 白名单，请求来源 IP 必须命中白名单。
- API Key 归属用户必须是管理员或超级管理员。
- 普通用户 API Key 无权访问这批接口。

## 通用响应格式

接口使用统一响应包裹：

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [],
    "limit": 1000,
    "has_more": true,
    "next_cursor": "..."
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `success` | boolean | 请求是否成功 |
| `message` | string | 错误信息，成功时为空 |
| `data.items` | array | 当前页数据 |
| `data.limit` | number | 当前请求实际使用的分页大小 |
| `data.has_more` | boolean | 是否还有下一页 |
| `data.next_cursor` | string | 下一页游标，`has_more=true` 时返回 |

## 通用分页参数

所有列表接口都使用 cursor 分页，不使用 `page + offset`。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `limit` | number | 否 | `1000` | 每页条数，最大 `5000` |
| `cursor` | string | 否 | 空 | 上一页响应返回的 `next_cursor` |

调用下一页时，原样传入上一页返回的 `next_cursor`：

```bash
curl -H "Authorization: Bearer sk-xxxx" \
  "https://example.com/api/analytics/v1/users?limit=1000&cursor=1000"
```

## 时间范围参数

部分接口支持时间过滤：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `start_timestamp` | number | 否 | 起始 Unix 秒级时间戳，包含该时间 |
| `end_timestamp` | number | 否 | 结束 Unix 秒级时间戳，包含该时间 |

当前支持时间过滤的接口：

- `/api/analytics/v1/logs`
- `/api/analytics/v1/quota-data`

## 接口列表

### 获取用户数据

```http
GET /api/analytics/v1/users
```

游标格式：用户 `id`。

示例：

```bash
curl -H "Authorization: Bearer sk-xxxx" \
  "https://example.com/api/analytics/v1/users?limit=1000"
```

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 用户 ID |
| `username` | string | 用户名 |
| `display_name` | string | 展示名 |
| `role` | number | 用户角色 |
| `status` | number | 用户状态 |
| `email_domain` | string | 邮箱域名，不返回完整邮箱 |
| `quota` | number | 剩余额度 |
| `used_quota` | number | 已用额度 |
| `request_count` | number | 请求次数 |
| `group` | string | 用户分组 |
| `aff_count` | number | 邀请数量 |
| `aff_quota` | number | 邀请剩余额度 |
| `inviter_id` | number | 邀请人用户 ID |
| `created_at` | number | 注册时间，Unix 秒 |
| `last_login_at` | number | 最近登录时间，Unix 秒 |

不会返回：

- 完整邮箱
- 密码哈希
- 系统 access token
- OAuth 平台 ID
- 用户个人设置原文

### 获取请求日志

```http
GET /api/analytics/v1/logs
```

支持 `start_timestamp` 和 `end_timestamp`。

游标格式：`created_at:id`。

示例：

```bash
curl -H "Authorization: Bearer sk-xxxx" \
  "https://example.com/api/analytics/v1/logs?start_timestamp=1777967521&end_timestamp=1780559521&limit=1000"
```

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 日志 ID |
| `user_id` | number | 用户 ID |
| `created_at` | number | 日志时间，Unix 秒 |
| `type` | number | 日志类型 |
| `username` | string | 用户名 |
| `token_name` | string | API Key 名称 |
| `model_name` | string | 模型名称 |
| `quota` | number | 本次消耗额度 |
| `prompt_tokens` | number | 输入 tokens |
| `completion_tokens` | number | 输出 tokens |
| `use_time` | number | 请求耗时，秒 |
| `is_stream` | boolean | 是否流式 |
| `channel_id` | number | 渠道 ID |
| `token_id` | number | API Key ID |
| `group` | string | 使用分组 |
| `ip` | string | 请求 IP |
| `request_id` | string | 请求 ID |
| `other` | object | 白名单分析字段 |

`other` 只返回以下白名单字段：

| 字段 | 说明 |
| --- | --- |
| `status_code` | 上游或请求状态码 |
| `request_path` | 请求路径 |
| `billing_mode` | 计费模式 |
| `billing_source` | 计费来源 |
| `matched_tier` | 命中的阶梯计费档位 |
| `cache_tokens` | 缓存 tokens |
| `reasoning_effort` | 推理强度 |
| `user_agent` | User-Agent |
| `session_source` | 会话来源 |
| `request_conversion` | 请求格式转换信息 |
| `frt` | 首包或相关耗时统计 |
| `group_ratio` | 分组倍率 |
| `user_group_ratio` | 用户分组倍率 |
| `model_ratio` | 模型倍率 |
| `completion_ratio` | 输出倍率 |
| `cache_ratio` | 缓存倍率 |

不会返回：

- `content`
- `upstream_request_id`
- 原始 `other`
- `admin_info`
- 上游密钥或渠道配置

### 获取用量聚合数据

```http
GET /api/analytics/v1/quota-data
```

该接口读取 `quota_data`，数据通常按小时聚合。支持 `start_timestamp` 和 `end_timestamp`。

游标格式：记录 `id`。

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 记录 ID |
| `user_id` | number | 用户 ID |
| `username` | string | 用户名 |
| `model_name` | string | 模型名称 |
| `created_at` | number | 聚合时间，Unix 秒 |
| `token_used` | number | token 消耗量 |
| `count` | number | 请求次数 |
| `quota` | number | 额度消耗 |

### 获取用户订阅

```http
GET /api/analytics/v1/subscriptions
```

游标格式：订阅 `id`。

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 订阅 ID |
| `user_id` | number | 用户 ID |
| `plan_id` | number | 套餐 ID |
| `amount_total` | number | 订阅总额度 |
| `amount_used` | number | 已用订阅额度 |
| `start_time` | number | 开始时间，Unix 秒 |
| `end_time` | number | 结束时间，Unix 秒 |
| `status` | string | 订阅状态，例如 `active`、`expired`、`cancelled` |
| `source` | string | 来源，例如 `order`、`admin` |
| `last_reset_time` | number | 上次重置时间 |
| `next_reset_time` | number | 下次重置时间 |
| `upgrade_group` | string | 订阅升级分组 |
| `prev_user_group` | string | 订阅前用户分组 |
| `created_at` | number | 创建时间 |
| `updated_at` | number | 更新时间 |

### 获取订阅套餐

```http
GET /api/analytics/v1/subscription-plans
```

游标格式：套餐 `id`。

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 套餐 ID |
| `title` | string | 套餐标题 |
| `subtitle` | string | 套餐副标题 |
| `price_amount` | number | 价格 |
| `currency` | string | 币种 |
| `duration_unit` | string | 周期单位 |
| `duration_value` | number | 周期值 |
| `custom_seconds` | number | 自定义周期秒数 |
| `enabled` | boolean | 是否启用 |
| `sort_order` | number | 排序 |
| `max_purchase_per_user` | number | 单用户最大购买次数 |
| `period_purchase_limit` | number | 周期购买限制 |
| `period_purchase_unit` | string | 周期限购单位 |
| `period_purchase_value` | number | 周期限购值 |
| `period_purchase_custom_seconds` | number | 周期限购自定义秒数 |
| `upgrade_group` | string | 购买后升级分组 |
| `total_amount` | number | 套餐总额度 |
| `quota_reset_period` | string | 额度重置周期 |
| `quota_reset_custom_seconds` | number | 自定义重置秒数 |
| `created_at` | number | 创建时间 |
| `updated_at` | number | 更新时间 |

不会返回支付平台商品 ID。

### 获取订阅订单

```http
GET /api/analytics/v1/subscription-orders
```

游标格式：订单 `id`。

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 订单 ID |
| `user_id` | number | 用户 ID |
| `plan_id` | number | 套餐 ID |
| `money` | number | 支付金额 |
| `payment_method` | string | 支付方式 |
| `payment_provider` | string | 支付服务商 |
| `status` | string | 订单状态 |
| `create_time` | number | 创建时间 |
| `complete_time` | number | 完成时间 |

不会返回：

- `trade_no`
- `provider_payload`

### 获取充值记录

```http
GET /api/analytics/v1/topups
```

游标格式：充值记录 `id`。

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 充值记录 ID |
| `user_id` | number | 用户 ID |
| `amount` | number | 入账额度 |
| `money` | number | 支付金额 |
| `payment_method` | string | 支付方式 |
| `payment_provider` | string | 支付服务商 |
| `create_time` | number | 创建时间 |
| `complete_time` | number | 完成时间 |
| `status` | string | 充值状态 |

不会返回 `trade_no`。

### 获取渠道分析数据

```http
GET /api/analytics/v1/channels
```

游标格式：渠道 `id`。

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 渠道 ID |
| `type` | number | 渠道类型 |
| `status` | number | 渠道状态 |
| `name` | string | 渠道名称 |
| `weight` | number | 权重 |
| `created_time` | number | 创建时间 |
| `test_time` | number | 最近测试时间 |
| `response_time` | number | 响应耗时，毫秒 |
| `balance` | number | 渠道余额 |
| `balance_updated_time` | number | 余额更新时间 |
| `models` | string | 渠道模型列表 |
| `group` | string | 渠道分组 |
| `used_quota` | number | 渠道已用额度 |
| `priority` | number | 优先级 |
| `auto_ban` | number | 自动禁用配置 |
| `tag` | string | 渠道标签 |
| `remark` | string | 备注 |

不会返回：

- `key`
- `base_url`
- `openai_organization`
- `other`
- `setting`
- `param_override`
- `header_override`
- `status_code_mapping`

### 获取模型能力映射

```http
GET /api/analytics/v1/abilities
```

游标格式：`channel_id:urlEncoded(group):urlEncoded(model)`。

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `group` | string | 分组 |
| `model` | string | 模型名称 |
| `channel_id` | number | 渠道 ID |
| `enabled` | boolean | 是否启用 |
| `priority` | number | 优先级 |
| `weight` | number | 权重 |
| `tag` | string | 标签 |

## 安全与性能说明

- 这批接口只读，不会扣费，也不会修改业务数据。
- 只允许管理员 API Key 访问。
- 所有列表接口都使用 cursor 分页，避免大 OFFSET 查询。
- `logs` 按 `created_at DESC, id DESC` 做 keyset 翻页。
- 字段按白名单返回，不返回 API Key、渠道密钥、支付原始 payload、完整邮箱和日志内容。
- 合作方应按 `has_more` 和 `next_cursor` 拉取下一页，不应构造 `page` 或 `offset` 参数。
