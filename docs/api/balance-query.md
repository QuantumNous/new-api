# 余额查询 API 接入文档

## 基本信息

| 项 | 值 |
|---|---|
| 接口地址 | `GET {BASE_URL}/api/user/self` |
| 请求方式 | GET |
| 鉴权方式 | Bearer Token |
| 数据格式 | JSON |

## 鉴权

请求头中携带 Bearer Token：

```
Authorization: Bearer <your_token>
```

支持两种凭证（二选一）：

| 凭证类型 | 获取方式 | 适用场景 |
|---|---|---|
| Session JWT | `POST /api/user/login` 登录后返回 | 短期对接 |
| PAT（Personal Access Token） | `GET /api/user/token` 生成 | 服务端长期对接 |

> Relay 推理用的 `sk-xxx` API Token **不能**用于本接口。

## 请求示例

```bash
curl -X GET '{BASE_URL}/api/user/self' \
  -H 'Authorization: Bearer <your_token>'
```

## 响应示例

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 123,
    "username": "alice",
    "quota": 80136005,
    "used_quota": 19863995,
    "request_count": 96,
    "status": 1,
    "role": 1,
    "group": "default"
  }
}
```

## 核心字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `quota` | int | 当前剩余额度（quota 单位） |
| `used_quota` | int | 历史累计已用额度（quota 单位） |
| `request_count` | int | 历史累计请求次数 |
| `status` | int | 用户状态：`1`=启用 |
| `group` | string | 所属用户组 |

## 单位换算

余额字段为内部 quota 单位，换算成美元：

```
USD 金额 = quota / QuotaPerUnit
```

`QuotaPerUnit = 500,000`（即 **1 USD = 500,000 quota**）。

示例：

```
quota       = 80,136,005  →  $160.27
used_quota  = 19,863,995  →  $39.73
总额度      = $200.00
```

## 错误响应

统一格式：

```json
{ "success": false, "code": "<error_code>", "message": "..." }
```

| HTTP | code | 触发条件 |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | Token 无效或未提供 |
| 401 | `AUTH_TOKEN_EXPIRED` | Session JWT 过期 |
| 401 | `AUTH_SESSION_REVOKED` | 会话被登出/踢下线 |
| 401 | `AUTH_USER_DISABLED` | 用户被禁用 |
| 500 | `AUTH_INTERNAL_ERROR` | 服务内部错误 |

## 调用示例

### Python

```python
import requests

QUOTA_PER_UNIT = 500_000

def get_balance(base_url: str, token: str) -> dict:
    resp = requests.get(
        f"{base_url}/api/user/self",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        raise RuntimeError(f"API error: {body}")

    data = body["data"]
    return {
        "username": data["username"],
        "quota_usd": data["quota"] / QUOTA_PER_UNIT,
        "used_quota_usd": data["used_quota"] / QUOTA_PER_UNIT,
        "total_usd": (data["quota"] + data["used_quota"]) / QUOTA_PER_UNIT,
    }
```

### Go

```go
type SelfResponse struct {
    Success bool `json:"success"`
    Data    struct {
        Username  string `json:"username"`
        Quota     int    `json:"quota"`
        UsedQuota int    `json:"used_quota"`
    } `json:"data"`
}

const QuotaPerUnit = 500_000.0

func GetBalance(baseURL, token string) (*SelfResponse, error) {
    req, _ := http.NewRequest("GET", baseURL+"/api/user/self", nil)
    req.Header.Set("Authorization", "Bearer "+token)

    resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var r SelfResponse
    if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
        return nil, err
    }
    return &r, nil
}
```

### Node.js

```typescript
const QUOTA_PER_UNIT = 500_000;

async function getBalance(baseUrl: string, token: string) {
  const resp = await fetch(`${baseUrl}/api/user/self`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await resp.json();
  if (!body.success) throw new Error("API error");

  return {
    username: body.data.username,
    quotaUsd: body.data.quota / QUOTA_PER_UNIT,
    usedUsd: body.data.used_quota / QUOTA_PER_UNIT,
    totalUsd: (body.data.quota + body.data.used_quota) / QUOTA_PER_UNIT,
  };
}
```

## 注意事项

1. **实时性**：余额底层走 Redis 缓存，DB 异步批量落库，DB 中的 `quota` 可能比缓存滞后几秒。对实时性要求高的场景以接口返回值为准。
2. **QuotaPerUnit**：默认 500,000，运营侧可配置。生产对接前建议与运营确认当前值。
3. **鉴权失败排查**：检查 Header 格式（`Bearer <token>` 注意空格）、用户是否被禁用、Token 是否过期。
