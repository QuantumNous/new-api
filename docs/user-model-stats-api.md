# 用户模型统计 API 接口文档

所有接口均需要管理员权限（`AdminAuth`）。

**认证方式**：在请求头中携带 `Authorization: Bearer <access_token>`，并在请求头中携带 `New-Api-User: <admin_user_id>`。

管理员使用密码登录获取 session 后，可通过 `/api/user/self/token` 生成系统 access token。

---

## 通用说明

### 时间范围

所有统计接口均支持以下时间参数：

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `start_timestamp` | int64 | 否 | 当天 00:00:00 | 开始时间，Unix 秒级时间戳 |
| `end_timestamp` | int64 | 否 | 当前时间 | 结束时间，Unix 秒级时间戳 |

时间范围限制：

- `end_timestamp` 不能小于 `start_timestamp`。
- 时间跨度不能超过 1 年。

### 通用筛选参数

以下统计接口均支持：

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `username` | string | 否 | - | 用户名筛选，支持英文逗号分隔多个用户名，例如 `alice,bob` |
| `model_name` | string | 否 | - | 模型名筛选，支持英文逗号分隔多个模型，例如 `gpt-4o,claude-3-5-sonnet` |
| `user_group` | string | 否 | - | 用户分组筛选，精确匹配用户表中的分组 |
| `account_type` | int | 否 | `0` | 账号类型筛选：`0`=个人用户，`1`=组织账号。**默认只统计个人用户数据，保持向后兼容**；传 `1` 只统计组织账号数据 |
| `page` | int | 否 | `1` | 页码 |
| `page_size` | int | 否 | `20` | 每页数量，最大 `100` |

### 金额字段

返回中的额度金额字段按当前系统汇率计算：

| 字段 | 说明 |
|---|---|
| `quota_amount_usd` | `quota / common.QuotaPerUnit` |
| `quota_amount_cny` | `quota_amount_usd * operation_setting.USDExchangeRate` |

---

## 1. 用户视角统计

按用户聚合模型用量，适合查看每个用户的总请求次数、总 token 和总额度消耗。

```http
GET /api/data/by-user
```

### 请求示例

```bash
curl -G 'https://example.com/api/data/by-user' \
  -H 'Authorization: Bearer <access_token>' \
  -H 'New-Api-User: <admin_user_id>' \
  --data-urlencode 'start_timestamp=1717200000' \
  --data-urlencode 'end_timestamp=1719791999' \
  --data-urlencode 'username=alice,bob' \
  --data-urlencode 'model_name=gpt-4o' \
  --data-urlencode 'user_group=default' \
  --data-urlencode 'page=1' \
  --data-urlencode 'page_size=20'
```

### 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | int | 用户 ID |
| `username` | string | 用户名 |
| `user_group` | string | 用户分组 |
| `org_path` | string | 用户完整组织路径，例如 `集团/一级部门/二级部门/当前部门` |
| `count` | int | 请求次数 |
| `token_used` | int | 消耗 token 数 |
| `quota` | int | 额度消耗 |
| `quota_amount_usd` | float | 折算美元金额 |
| `quota_amount_cny` | float | 折算人民币金额 |

### 成功响应

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "user_id": 101,
        "username": "alice",
        "user_group": "default",
        "org_path": "集团/研发中心/平台部",
        "count": 120,
        "token_used": 560000,
        "quota": 280000,
        "quota_amount_usd": 0.28,
        "quota_amount_cny": 2.016
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

---

## 2. 模型视角统计

按模型聚合用量，适合查看各模型的总请求次数、总 token 和总额度消耗。

```http
GET /api/data/by-model
```

### 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `model_name` | string | 模型名 |
| `count` | int | 请求次数 |
| `token_used` | int | 消耗 token 数 |
| `quota` | int | 额度消耗 |
| `quota_amount_usd` | float | 折算美元金额 |
| `quota_amount_cny` | float | 折算人民币金额 |

### 成功响应

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "model_name": "gpt-4o",
        "count": 350,
        "token_used": 1800000,
        "quota": 900000,
        "quota_amount_usd": 0.9,
        "quota_amount_cny": 6.48
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

---

## 3. 部门视角统计

按用户表中的一级组织和二级组织聚合用量，适合按公司二级组织统计整体使用情况。

```http
GET /api/data/by-department
```

### 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `org_level1_name` | string | 一级组织名称 |
| `org_level2_name` | string | 二级组织名称 |
| `count` | int | 请求次数 |
| `token_used` | int | 消耗 token 数 |
| `quota` | int | 额度消耗 |
| `quota_amount_usd` | float | 折算美元金额 |
| `quota_amount_cny` | float | 折算人民币金额 |

### 成功响应

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "org_level1_name": "集团",
        "org_level2_name": "研发中心",
        "count": 500,
        "token_used": 2600000,
        "quota": 1300000,
        "quota_amount_usd": 1.3,
        "quota_amount_cny": 9.36
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

---

## 4. 用户-模型明细视角统计

按用户和模型组合聚合用量，适合查看某个用户在不同模型上的具体消耗。

```http
GET /api/data/by-detail
```

### 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | int | 用户 ID |
| `username` | string | 用户名 |
| `user_group` | string | 用户分组 |
| `model_name` | string | 模型名 |
| `count` | int | 请求次数 |
| `token_used` | int | 消耗 token 数 |
| `quota` | int | 额度消耗 |
| `quota_amount_usd` | float | 折算美元金额 |
| `quota_amount_cny` | float | 折算人民币金额 |

### 成功响应

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "user_id": 101,
        "username": "alice",
        "user_group": "default",
        "model_name": "gpt-4o",
        "count": 60,
        "token_used": 300000,
        "quota": 150000,
        "quota_amount_usd": 0.15,
        "quota_amount_cny": 1.08
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

---

## 5. 导出用户模型统计

按指定视角导出 CSV 文件。导出接口使用与列表接口相同的时间范围和筛选参数。

```http
GET /api/data/export
```

### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `view_type` | string | 否 | `by_user` | 导出视角：`by_user`、`by_model`、`by_department`、`by_detail` |
| `start_timestamp` | int64 | 否 | 当天 00:00:00 | 开始时间 |
| `end_timestamp` | int64 | 否 | 当前时间 | 结束时间 |
| `username` | string | 否 | - | 用户名筛选，支持英文逗号分隔多个用户名 |
| `model_name` | string | 否 | - | 模型名筛选，支持英文逗号分隔多个模型 |
| `user_group` | string | 否 | - | 用户分组筛选 |
| `account_type` | int | 否 | `0` | 账号类型筛选：`0`=个人用户，`1`=组织账号 |

### CSV 表头

#### `view_type=by_user`

```text
用户ID,用户名,用户分组,完整组织路径,请求次数,总Tokens,额度消耗,额度(USD),额度(CNY)
```

#### `view_type=by_model`

```text
模型名,请求次数,总Tokens,额度消耗,额度(USD),额度(CNY)
```

#### `view_type=by_department`

```text
一级组织名称,二级组织名称,请求次数,总Tokens,额度消耗,额度(USD),额度(CNY)
```

#### `view_type=by_detail`

```text
用户ID,用户名,用户分组,模型名,请求次数,总Tokens,额度消耗,额度(USD),额度(CNY)
```

### 请求示例

```bash
curl -G 'https://example.com/api/data/export' \
  -H 'Authorization: Bearer <access_token>' \
  -H 'New-Api-User: <admin_user_id>' \
  --data-urlencode 'view_type=by_user' \
  --data-urlencode 'start_timestamp=1717200000' \
  --data-urlencode 'end_timestamp=1719791999' \
  --data-urlencode 'user_group=default' \
  -o user-model-stats-by-user.csv
```

### 响应

返回 `text/csv; charset=utf-8` 附件，文件名格式：

```text
user-model-stats-<view_type>-YYYY-MM-DD.csv
```

---

## 错误响应

参数错误或查询失败时返回统一 API 错误结构：

```json
{
  "success": false,
  "message": "时间跨度不能超过 1 年"
}
```
