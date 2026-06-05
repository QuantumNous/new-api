# 获取用户令牌（通过飞书标识）

## 1. 接口说明

通过飞书标识查询对应用户的令牌列表，返回令牌明文 `key`，支持分页。

- **方法**：`GET`
- **路径**：`/api/user/feishu/tokens`
- **用途**：管理员按飞书账号定位用户并查看其 API Token

---

## 2. 鉴权要求

该接口受管理端权限保护，使用 `AdminAuth()` 中间件。

可用认证方式：

1. **Session 认证**：管理员登录后携带 session cookie
2. **Access Token 认证**：请求头同时携带
   - `Authorization: Bearer <access_token>`
   - `New-Api-User: <admin_user_id>`

---

## 3. 请求参数

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `feishu_open_id` | string | 否 | 飞书 OpenID |
| `feishu_user_id` | string | 否 | 飞书 UserID |
| `page` | int | 否 | 页码，默认 `1` |
| `page_size` | int | 否 | 每页条数，默认 `10` |

约束：

- `feishu_open_id` 和 `feishu_user_id` **至少提供一个**。

---

## 4. 请求示例

```bash
curl -X GET "https://your-domain.com/api/user/feishu/tokens?feishu_open_id=ou_xxxxx&page=1&page_size=10" \
  -H "Authorization: Bearer <access_token>" \
  -H "New-Api-User: <admin_user_id>"
```

或：

```bash
curl -X GET "https://your-domain.com/api/user/feishu/tokens?feishu_user_id=u_xxxxx&page=1&page_size=10" \
  -H "Authorization: Bearer <access_token>" \
  -H "New-Api-User: <admin_user_id>"
```

---

## 5. 成功响应

```json
{
  "success": true,
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 3,
    "items": [
      {
        "id": 501,
        "user_id": 101,
        "key": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
        "name": "我的API Key",
        "status": 1,
        "remain_quota": 800000,
        "unlimited_quota": false,
        "expired_time": -1,
        "model_limits_enabled": false,
        "group": ""
      }
    ]
  }
}
```

---

## 6. 响应字段说明

### 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | bool | 是否成功 |
| `data.page` | int | 当前页 |
| `data.page_size` | int | 每页条数 |
| `data.total` | int | 总记录数 |
| `data.items` | array | 令牌列表 |

### `items` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int | 令牌 ID |
| `user_id` | int | 平台内用户 ID |
| `key` | string | 令牌明文（不脱敏） |
| `name` | string | 令牌名称 |
| `status` | int | 令牌状态 |
| `remain_quota` | int | 剩余额度 |
| `unlimited_quota` | bool | 是否不限额 |
| `expired_time` | int | 过期时间（-1 通常表示不过期） |
| `model_limits_enabled` | bool | 是否启用模型限制 |
| `group` | string | 分组标识 |

---

## 7. 错误响应

统一格式：

```json
{
  "success": false,
  "message": "错误描述"
}
```

常见错误场景：

- 未携带或鉴权失败（无管理员权限）
- `feishu_open_id` 与 `feishu_user_id` 均未提供
- 指定飞书标识未匹配到用户

---

## 8. 行为与安全说明

- 返回完整明文 `key`，用于管理员分发与运维处理。
- 请仅在受控环境传输与存储响应结果，避免泄露。
- 接口支持分页，建议大数据量场景始终传 `page`、`page_size`。
