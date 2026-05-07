# 用户-模型统计功能实施方案（补齐与收敛）

## 1. 目标

将用户-模型统计能力收敛为可稳定上线版本，覆盖：

- 用户视角、模型视角、用户模型消耗统计
- 筛选、分页、导出联动

## 2. 功能范围

## 2.1 后端接口

### 2.1.1 GET /api/data/by-user

用途：按用户维度聚合统计消耗数据。

鉴权：
- 需要已登录管理员态（沿用 `/api/data/*` 现有鉴权中间件）。

请求参数（Query）：

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| start_timestamp | int64 | 否 | 最近 24 小时起始时间（秒） | 开始时间戳（秒），需小于等于 `end_timestamp` |
| end_timestamp | int64 | 否 | 当前时间（秒） | 结束时间戳（秒） |
| username | string | 否 | 空 | 用户名过滤，支持逗号分隔多值，如 `alice,bob` |
| model_name | string | 否 | 空 | 模型名过滤，支持逗号分隔多值 |
| user_group | string | 否 | 空 | 用户分组过滤，支持逗号分隔多值 |
| page | int | 否 | 0 | 页码，从 0 开始 |
| page_size | int | 否 | 10 | 每页数量，最大 100 |

请求示例：

```http
GET /api/data/by-user?start_timestamp=1714406400&end_timestamp=1716998400&username=alice,bob&model_name=gpt-4o,claude-3-5-sonnet&page=0&page_size=20
```

响应字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| success | bool | 是否成功 |
| message | string | 错误或提示信息 |
| data.total | int | 当前筛选条件下的总分组数（按用户聚合后的总行数） |
| data.items[].username | string | 用户名 |
| data.items[].count | int64 | 请求次数 |
| data.items[].token_used | int64 | 总 Token 消耗 |
| data.items[].quota | int64 | 总额度消耗（Quota 原始单位，非人民币元） |
| data.items[].quota_amount_usd | float64 | 换算后的美元金额，计算方式 `quota / QuotaPerUnit` |
| data.items[].quota_amount_cny | float64 | 换算后的人民币金额，计算方式 `(quota / QuotaPerUnit) * USDExchangeRate` |
| data.items[].quota_amount_usd | float64 | 换算后的美元金额，计算方式 `quota / QuotaPerUnit` |
| data.items[].quota_amount_cny | float64 | 换算后的人民币金额，计算方式 `(quota / QuotaPerUnit) * USDExchangeRate` |

成功响应示例：

```json
{
  "success": true,
  "message": "",
  "data": {
    "total": 2,
    "items": [
      {
        "username": "alice",
        "count": 152,
        "token_used": 982341,
        "quota": 456700,
        "quota_amount_usd": 0.9134,
        "quota_amount_cny": 6.66782
      },
      {
        "username": "bob",
        "count": 89,
        "token_used": 412009,
        "quota": 193200,
        "quota_amount_usd": 0.3864,
        "quota_amount_cny": 2.82072
      }
    ]
  }
}
```

错误码与异常：
- 时间范围超过 1 年：返回参数错误（400）
- `start_timestamp > end_timestamp`：返回参数错误（400）
- `page_size > 100`：自动截断为 100 或返回参数错误（以最终实现为准，建议返回 400）

### 2.1.2 GET /api/data/by-model

用途：按模型维度聚合统计消耗数据。

鉴权：
- 需要已登录管理员态（沿用 `/api/data/*` 现有鉴权中间件）。

请求参数（Query）：

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| start_timestamp | int64 | 否 | 最近 24 小时起始时间（秒） | 开始时间戳（秒），需小于等于 `end_timestamp` |
| end_timestamp | int64 | 否 | 当前时间（秒） | 结束时间戳（秒） |
| username | string | 否 | 空 | 用户名过滤，支持逗号分隔多值 |
| model_name | string | 否 | 空 | 模型名过滤，支持逗号分隔多值，如 `gpt-4o,claude-3-5-sonnet` |
| page | int | 否 | 0 | 页码，从 0 开始 |
| page_size | int | 否 | 10 | 每页数量，最大 100 |

请求示例：

```http
GET /api/data/by-model?start_timestamp=1714406400&end_timestamp=1716998400&username=alice,bob&model_name=gpt-4o,claude-3-5-sonnet&page=0&page_size=20
```

响应字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| success | bool | 是否成功 |
| message | string | 错误或提示信息 |
| data.total | int | 当前筛选条件下的总分组数（按模型聚合后的总行数） |
| data.items[].model_name | string | 模型名 |
| data.items[].count | int64 | 请求次数 |
| data.items[].token_used | int64 | 总 Token 消耗 |
| data.items[].quota | int64 | 总额度消耗（Quota 原始单位，非人民币元） |
| data.items[].quota_amount_usd | float64 | 换算后的美元金额，计算方式 `quota / QuotaPerUnit` |
| data.items[].quota_amount_cny | float64 | 换算后的人民币金额，计算方式 `(quota / QuotaPerUnit) * USDExchangeRate` |

成功响应示例：

```json
{
  "success": true,
  "message": "",
  "data": {
    "total": 2,
    "items": [
      {
        "model_name": "gpt-4o",
        "count": 205,
        "token_used": 1209000,
        "quota": 580300,
        "quota_amount_usd": 1.1606,
        "quota_amount_cny": 8.47238
      },
      {
        "model_name": "claude-3-5-sonnet",
        "count": 36,
        "token_used": 185350,
        "quota": 69500,
        "quota_amount_usd": 0.139,
        "quota_amount_cny": 1.0147
      }
    ]
  }
}
```

错误码与异常：
- 时间范围超过 1 年：返回参数错误（400）
- `start_timestamp > end_timestamp`：返回参数错误（400）
- `page_size > 100`：自动截断为 100 或返回参数错误（以最终实现为准，建议返回 400）

### 2.1.3 GET /api/data/by-detail

用途：按“用户 + 模型”维度聚合统计消耗数据（明细聚合视角）。

鉴权：
- 需要已登录管理员态（沿用 `/api/data/*` 现有鉴权中间件）。

请求参数（Query）：

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| start_timestamp | int64 | 否 | 最近 24 小时起始时间（秒） | 开始时间戳（秒），需小于等于 `end_timestamp` |
| end_timestamp | int64 | 否 | 当前时间（秒） | 结束时间戳（秒） |
| username | string | 否 | 空 | 用户名过滤，支持逗号分隔多值 |
| model_name | string | 否 | 空 | 模型名过滤，支持逗号分隔多值 |
| page | int | 否 | 0 | 页码，从 0 开始 |
| page_size | int | 否 | 10 | 每页数量，最大 100 |

请求示例：

```http
GET /api/data/by-detail?start_timestamp=1714406400&end_timestamp=1716998400&username=alice,bob&model_name=gpt-4o,claude-3-5-sonnet&page=0&page_size=20
```

响应字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| success | bool | 是否成功 |
| message | string | 错误或提示信息 |
| data.total | int | 当前筛选条件下的总分组数（按用户+模型聚合后的总行数） |
| data.items[].username | string | 用户名 |
| data.items[].model_name | string | 模型名 |
| data.items[].count | int64 | 请求次数 |
| data.items[].token_used | int64 | 总 Token 消耗 |
| data.items[].quota | int64 | 总额度消耗（Quota 原始单位，非人民币元） |
| data.items[].quota_amount_usd | float64 | 换算后的美元金额，计算方式 `quota / QuotaPerUnit` |
| data.items[].quota_amount_cny | float64 | 换算后的人民币金额，计算方式 `(quota / QuotaPerUnit) * USDExchangeRate` |

成功响应示例：

```json
{
  "success": true,
  "message": "",
  "data": {
    "total": 3,
    "items": [
      {
        "username": "alice",
        "model_name": "gpt-4o",
        "count": 133,
        "token_used": 803456,
        "quota": 379800,
        "quota_amount_usd": 0.7596,
        "quota_amount_cny": 5.54408
      },
      {
        "username": "alice",
        "model_name": "claude-3-5-sonnet",
        "count": 19,
        "token_used": 178885,
        "quota": 76900,
        "quota_amount_usd": 0.1538,
        "quota_amount_cny": 1.12274
      },
      {
        "username": "bob",
        "model_name": "gpt-4o",
        "count": 72,
        "token_used": 405544,
        "quota": 200500,
        "quota_amount_usd": 0.401,
        "quota_amount_cny": 2.9273
      }
    ]
  }
}
```

错误码与异常：
- 时间范围超过 1 年：返回参数错误（400）
- `start_timestamp > end_timestamp`：返回参数错误（400）
- `page_size > 100`：自动截断为 100 或返回参数错误（以最终实现为准，建议返回 400）

通用说明：
- 三个接口均支持组合筛选（时间、用户、模型）。
- 三个接口分页参数一致，便于前端按 Tab 复用同一查询状态。
- 排序建议统一为：`count` 降序，其次 `token_used` 降序。
- `quota` 字段为系统内部额度单位（Quota Units），不是人民币元；默认可按 `amount_usd = quota / QuotaPerUnit` 转为美元（当前默认 `QuotaPerUnit=500000`）。
- 建议新增返回字段（便于前端直接展示成本）：
  - `quota_amount_usd`（float64）：按 `quota / QuotaPerUnit` 计算
  - `quota_amount_cny`（float64）：按 `(quota / QuotaPerUnit) * USDExchangeRate` 计算

## 2.2 前端页面

- Tab1 用户视角：用户、请求次数、总Token、额度消耗
- Tab2 模型视角：模型、请求次数、总Token、额度消耗
- Tab3 用户模型消耗：用户、模型、请求次数、总Token、额度消耗

三个视角均为表格列表 + 分页。

公共筛选：时间范围、用户名、模型名、查询与导出。

## 3. 数据与展示规范

### 3.1 用户视角（by_user）

| 字段 | 说明 |
|---|---|
| username | 用户名 |
| count | 请求次数 |
| token_used | 总 Token 数 |
| quota | 额度消耗 |

按用户汇总（GROUP BY username），按请求次数、Token、额度综合降序。

### 3.2 模型视角（by_model）

| 字段 | 说明 |
|---|---|
| model_name | 模型名 |
| count | 请求次数 |
| token_used | 总 Token 数 |
| quota | 额度消耗 |

按模型汇总（GROUP BY model_name），按请求次数、Token、额度综合降序。

### 3.3 用户模型消耗（by_detail）

| 字段 | 说明 |
|---|---|
| username | 用户名 |
| model_name | 模型名 |
| count | 请求次数 |
| token_used | 总 Token 数 |
| quota | 额度消耗 |

按用户+模型汇总（GROUP BY username, model_name），按请求次数、Token、额度综合降序。

## 4. 性能与兼容

- 时间跨度限制：最大 1 年
- 列表 page_size 上限：100
- SQL 仅使用 GORM 聚合与 group（保证多数据库兼容）

## 5. 导出策略

`view_type` 与当前 Tab 对齐：

- 用户视角 -> `by_user`
- 模型视角 -> `by_model`
- 用户模型消耗 -> `by_detail`

导出字段顺序与页面表格一致，分批读取全量数据写入 CSV。

## 6. 验收标准

- 三个 Tab 均可按筛选条件返回正确数据
- 导出内容与当前视角一致
- 大页数/空数据/非法时间参数有明确返回

## 7. 测试清单

- 后端：
  - 参数边界（空、非法时间、超上限）
  - 聚合正确性（用户汇总、模型汇总、用户模型明细）
  - 导出三视角一致性
- 前端：
  - Tab 切换与筛选联动
  - 分页联动

## 8. 风险与回滚

- 风险：明细查询在大数据量场景响应慢
- 缓解：分页、必要时加缓存
- 回滚：三个接口独立，可单独降级
