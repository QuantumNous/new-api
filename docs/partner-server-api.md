# 野菜API 合作方服务端接入

适用于在自己产品里内置野菜API模型服务的合作方。你的用户不需要注册或登录野菜账号：你的后端用服务端密钥，为每个用户在野菜自动开一个子账号，领取该用户专属的模型 API Key，并在你的界面里展示收款二维码让用户充值。用户付款给野菜，额度直接进入该用户的子账号。

如果你的用户要用自己的野菜账号授权你，请看 `docs/partner-oauth-api.md`（OAuth 授权码流程）。两套接入的凭证不能混用。

示例中的域名、ID、密钥都是占位值。

## 接入前平台提供

| 配置 | 说明 |
| --- | --- |
| `ISSUER` | 主站地址，例如 `https://relay.example.com`，不含 `/v1`，末尾不带 `/` |
| `CLIENT_ID` | `pc_` 加 32 位十六进制 |
| `SERVER_SECRET` | `pss_` 开头，只交付一次。同一时间最多两把有效，用于无中断轮换 |
| 出口 IP 白名单 | 可选。强烈建议提供你服务器的出口 IP，配置后其他地址的请求一律拒绝 |

**密钥和 Key 只能放在你的后端**。这些接口不支持浏览器跨域调用。不要把 `SERVER_SECRET`、访问令牌或任何用户的 `api_key` 下发到网页、App 或客户端，也不要写进日志、URL 或代码仓库。请把服务端密钥存放在密钥管理系统中，并建议每 90 天轮换一次。

所有请求使用 HTTPS，只发到主站地址。

## 用户标识 `external_user_id`

你用 `external_user_id` 标识自己的用户：

- 32–64 个字符，只能是 `A-Z a-z 0-9 . _ -`，**区分大小写**；
- 必须是不透明的 ID（例如 UUID），不要使用手机号、邮箱等个人信息；
- **永久不变**。一旦换了 ID，该用户会得到一个新的空账号，旧账号里的余额无法自动找回；
- 只能由你的后端根据登录会话确定，不要接受前端随意传入的值，否则你的用户可能读到别人的 Key。

## 调用顺序

```text
POST /oauth/token                               用服务端密钥换访问令牌（1 小时）
POST /api/partner/v1/accounts/{id}/credential   首次调用自动开户并返回该用户的 api_key
用 api_key 调用 {base_url}/chat/completions       模型调用

充值：
GET  /api/partner/v1/payment/options             支付方式与金额
POST /api/partner/v1/accounts/{id}/payment/orders 下单，拿到二维码内容展示给用户
GET  /api/partner/v1/payment/orders/{order_id}    轮询，直到 status=success
```

`{id}` 即 `external_user_id`。

## 1. 换取访问令牌

```bash
curl -X POST "$ISSUER/oauth/token" \
  --user "$CLIENT_ID:$SERVER_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials'
```

可选参数 `scope` 只能是 `partner:accounts`。表单里不能带 `client_secret` 等其他字段。

```json
{
  "access_token": "pst_example",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "partner:accounts"
}
```

没有刷新令牌。到期前重新换一个即可，建议提前 5 分钟换取并缓存，不要每个请求都换。

失败一律是 `401 invalid_client`，带 `WWW-Authenticate: Basic realm="oauth"`，不区分具体原因（密钥错误、密钥已吊销、IP 不在白名单、接入已停用都一样）。连续失败会被限流（`429 rate_limited`）。

之后的接口都带：

```text
Authorization: Bearer {access_token}
```

令牌不能放在查询参数里。

## 2. 领取用户的 API Key

```text
POST {ISSUER}/api/partner/v1/accounts/{id}/credential
Content-Type: application/json

{}
```

该用户还没有账号时，自动开户并签发 Key；之后再调用返回同一把 Key。请求体可以为空或 `{}`。

```json
{
  "account_id": "acct_1024",
  "external_user_id": "3f2b8c1e9a4d4e7fb6a1c0d2e5f70819",
  "key_id": "key_88",
  "api_key": "sk-example",
  "base_url": "https://relay.example.com/v1",
  "created_at": "2026-10-28T08:00:00Z"
}
```

- Key 长期有效，没有额度上限，但只能花该用户子账号里的余额。余额为 0 时模型请求会被拒绝。
- `base_url` 已包含 `/v1`。
- 这个接口与轮换接口共享频率限制：每个合作方每分钟 120 次。正常只在用户首次使用时调用一次，请在你的后端保存 Key。
- Key 被禁用（例如平台应急吊销）时返回 `403 credential_disabled`，不会自动补发，请调用轮换接口拿新 Key。

## 3. 轮换 Key

```text
POST {ISSUER}/api/partner/v1/accounts/{id}/credential/rotate
Content-Type: application/json
Idempotency-Key: {16-64 个 A-Z a-z 0-9 - _}

{"revoke_old": "after_grace"}
```

| `revoke_old` | 旧 Key |
| --- | --- |
| `after_grace`（默认） | 24 小时后失效，期间新旧两把都能用，适合计划内更换 |
| `immediately` | 立即失效。**怀疑 Key 泄露时必须用这个** |

响应与第 2 节相同；宽限模式额外返回 `old_key_expires_at`。同一个 `Idempotency-Key` 重试会得到同一把新 Key；同一个 Key 换了请求内容返回 `409 idempotency_conflict`。轮换不会自动开户，账号不存在时返回 `404 account_not_found`。

## 4. 查询账号

```text
GET {ISSUER}/api/partner/v1/accounts/{id}
```

```json
{
  "account_id": "acct_1024",
  "external_user_id": "3f2b8c1e9a4d4e7fb6a1c0d2e5f70819",
  "status": "active",
  "quota": 5000000,
  "used_quota": 120000,
  "amount": "10",
  "currency": "USD",
  "currency_symbol": "$",
  "quota_per_unit": "500000",
  "created_at": "2026-10-28T08:00:00Z"
}
```

- 查询不会开户，账号不存在返回 `404 account_not_found`。
- `quota` 是剩余额度（内部单位），判断余额是否足够请用它；`amount` 是按站点展示货币换算的金额，十进制字符串，用于展示。
- `status`：`active`、`disabled`（你停用的）、`admin_disabled`（平台停用的）。

## 5. 停用与恢复账号

```text
POST {ISSUER}/api/partner/v1/accounts/{id}/disable
POST {ISSUER}/api/partner/v1/accounts/{id}/enable
```

停用后该用户的 Key 立即失效，也不能充值，余额保留；恢复后 Key 重新可用。平台停用的账号（`admin_disabled`）你无法恢复，返回 `403 account_disabled_by_admin`。

## 6. 充值

用户付款给野菜，额度直接进入该用户的子账号。

### 6.1 支付方式

```text
GET {ISSUER}/api/partner/v1/payment/options
```

```json
{
  "available": true,
  "currency": "USD",
  "amount_unit_quota": "500000",
  "pay_currency": "CNY",
  "min_amount": 1,
  "max_amount": 100000,
  "amount_options": [{ "amount": 10, "pay_money": "70.00" }],
  "methods": [{ "id": "alipay", "name": "支付宝" }]
}
```

`amount` 是充值数量，1 个单位到账 `amount_unit_quota` 额度；`pay_money` 是用户实付金额。`available=false` 时请隐藏充值入口。

### 6.2 下单

```text
POST {ISSUER}/api/partner/v1/accounts/{id}/payment/orders
Content-Type: application/json
Idempotency-Key: {每次新的充值意图生成一个新值}

{"amount": 10, "payment_method": "alipay", "client_ip": "198.51.100.23"}
```

- `client_ip` 可选，填付款用户的 IP（支付平台风控需要）；不填时使用你服务器的 IP。
- 用户还没有账号时，下单会自动开户。

成功 `201`：

```json
{
  "order_id": "USR1024NOab12cd1761638400",
  "status": "pending",
  "amount": 10,
  "currency": "USD",
  "pay_money": "70.00",
  "pay_currency": "CNY",
  "payment_method": "alipay",
  "created_at": "2026-10-28T08:00:00Z",
  "external_user_id": "3f2b8c1e9a4d4e7fb6a1c0d2e5f70819",
  "qr_code": "https://qr.alipay.com/bax00000000000000000000"
}
```

- `qr_code` 是二维码内容，请把它生成二维码给用户扫码付款。支付通道没有返回二维码时，会改为返回 `pay_url`（支付链接），两者至少有一个。不要修改，也不要写进日志。
- 网络超时后用同一个 `Idempotency-Key` 重试，会返回同一笔订单和同一个二维码，不会重复下单；同一个 Key 换了请求内容返回 `409`。
- 返回 `503 payment_unavailable` 时，可以用同一个 Key 稍后重试，平台会补上二维码。
- 限制：每个用户 1 小时最多 20 单、30 分钟内最多 5 笔未付款；每个合作方 1 小时最多 2000 单。超出返回 `429 rate_limited`，带 `Retry-After`。

### 6.3 确认到账

```text
GET {ISSUER}/api/partner/v1/payment/orders/{order_id}
```

显示二维码期间每 3–5 秒查询一次，`status` 变为 `success`（带 `paid_at`）即到账；用户关闭支付界面或超过 15 分钟左右后停止。未付款的订单会一直是 `pending`。查询结果不再包含二维码。只能查到你自己下的订单，其他订单返回 `404 order_not_found`。

充值订单不参与任何邀请或返现活动。

## 7. 消耗明细

```text
GET {ISSUER}/api/partner/v1/accounts/{id}/usage?start_time=1761552000&end_time=1761638400&page=1&page_size=50
```

| 参数 | 说明 |
| --- | --- |
| `start_time` / `end_time` | Unix 秒。默认最近 24 小时；跨度不超过 31 天；最早只能查到 90 天前 |
| `page` / `page_size` | 从 1 开始；每页 1–100 条，默认 50 |

```json
{
  "external_user_id": "3f2b8c1e9a4d4e7fb6a1c0d2e5f70819",
  "page": 1,
  "page_size": 50,
  "has_more": false,
  "items": [
    {
      "created_at": 1761637000,
      "model_name": "gpt-example",
      "prompt_tokens": 120,
      "completion_tokens": 340,
      "quota": 2300,
      "use_time": 3,
      "is_stream": true,
      "request_id": "202610280816400000000000000"
    }
  ]
}
```

按时间倒序。`has_more=true` 时翻到下一页。每个合作方每分钟最多 60 次。

## 8. 错误

`/api/partner/v1/*` 的错误：

```json
{ "error": { "code": "account_not_found", "message": "the account does not exist" }, "request_id": "..." }
```

| HTTP | `error.code` | 处理 |
| --- | --- | --- |
| 400 | `invalid_request` | 修正参数；这些接口不接受多余字段，除消耗明细外不接受查询参数 |
| 400 | `invalid_external_user_id` | 用户 ID 不符合格式 |
| 400 | `invalid_amount` / `invalid_payment_method` | 修正金额或换成 `payment/options` 里的支付方式 |
| 401 | `invalid_token` | 重新换取访问令牌后重试一次 |
| 403 | `account_disabled` / `account_disabled_by_admin` | 账号已停用 |
| 403 | `credential_disabled` | 调用轮换接口拿新 Key |
| 403 | `partner_unavailable` | 你的接入已被平台停用 |
| 404 | `account_not_found` / `order_not_found` | 账号或订单不存在（或不属于你） |
| 409 | `idempotency_conflict` | 同一个 `Idempotency-Key` 用于了不同请求，换一个新值 |
| 415 | `unsupported_media_type` | 请求体需为 `application/json` |
| 429 | `rate_limited` / `account_limit_reached` | 按 `Retry-After` 退避；后者表示已达子账号上限，请联系平台 |
| 503 | `payment_unavailable` | 平台暂时无法收款，稍后用同一个 Key 重试 |
| 500 | `server_error` | 记下 `request_id` 联系平台 |

响应带 `X-Request-Id` 和 `Cache-Control: no-store`，排查问题时请提供 `X-Request-Id`。

## 9. 安全须知

- 怀疑服务端密钥泄露时，立即联系平台吊销该密钥；平台可以一键作废你名下所有用户的 Key。之后请对每个用户调用轮换（`revoke_old: immediately`）拿新 Key。用户余额不受影响。
- 平台停用你的接入后，所有接口立即拒绝，你名下用户的 Key 会在几分钟内全部失效；恢复后自动恢复（被平台单独停用的账号除外）。
- 你的所有调用（换令牌、开户、发 Key、轮换、下单、被拒绝的请求）都会被记录审计，记录中不含密钥、Key 和二维码内容。
