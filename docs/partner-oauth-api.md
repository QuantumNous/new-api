# 野菜API 合作方开放接口

给第三方 AI 助手接入用。助手保留自己的登录体系；用户在浏览器里授权野菜API账号后，助手领取一把专用于本次绑定的模型 API Key，再调用模型。

本文只描述第三方助手的 OAuth 2.0 授权码流程，对应中转平台开放接口 v0.2。示例里的域名、客户端和令牌都是占位值，以平台实际交付的配置为准。

## 不要和设备码授权混用

官方桌面客户端的设备码授权是另一套接口，文档在 `docs/desktop-api-v2.md`。两套不能互换。

| | 官方桌面客户端 | 第三方 AI 助手（本文） |
| --- | --- | --- |
| 方式 | 设备码 | OAuth 2.0 授权码 + PKCE |
| 入口 | `POST /api/desktop/v2/device-authorizations` | 浏览器打开 `GET /oauth/authorize` |
| 用户确认 | `/desktop-authorize` | `/partner-authorize` |
| 拿到的凭证 | 桌面登录会话 | 本次绑定的模型 API Key |
| 能否领 Key | 不能靠设备码领取本文的 `api_key` | 调用 `/api/integrations/v1/credential` |

第三方助手不要调用 `/api/desktop/v2/device-authorizations`，也不要打开 `/desktop-authorize`。原生助手如果没有自己的后端，仍然走本文的授权码：客户端类型登记为 `none`，用系统浏览器和回环回调，而不是改走设备码。

## 接入前需要平台提供的配置

| 配置 | 说明 |
| --- | --- |
| `ISSUER` / `RELAY_ORIGIN` | 主站地址，例如 `https://relay.example.com`。不含 `/v1`，末尾不带 `/`。授权、令牌、账号和凭证接口都打到这个地址 |
| `CLIENT_ID` | 平台分配，形如 `pc_` 加 32 位十六进制 |
| `TOKEN_AUTH_METHOD` | `client_secret_basic`（有后端）或 `none`（原生公共客户端） |
| `CLIENT_SECRET` | 仅机密客户端有，形如 `pcs_` 开头。只交付一次，丢失后由平台轮换 |
| `REDIRECT_URI` | 助手提供、平台预先登记的回调。网页回调必须是 `https`；`none` 客户端可以登记 `http://127.0.0.1/...` 或 `http://[::1]/...` |

所有请求使用 HTTPS。公开接口只在主站 Host 上提供，不要打到推广子域名，也不要用请求里的 Host 自己拼地址。

OAuth 访问令牌只用于账号和凭证接口。模型调用只使用凭证接口返回的 `api_key`。令牌、授权码、`client_secret` 和 `api_key` 都按不透明字符串保存，不要写入日志、URL 或崩溃报告。

## 调用顺序

```text
浏览器打开 /oauth/authorize
        ↓ 用户登录并同意
回调 ?code=&state=&iss=
        ↓
POST /oauth/token          用授权码换 OAuth 令牌
        ↓
GET  /api/integrations/v1/account
POST /api/integrations/v1/credential
        ↓
用 api_key 调用 {base_url}/models 和 {base_url}/chat/completions

余额不足时（可选）：
GET  /api/integrations/v1/balance
POST /api/integrations/v1/payment/orders   拿到 checkout_url 给用户付款
GET  /api/integrations/v1/payment/orders/{order_id}   轮询到账
```

之后用刷新令牌续期 OAuth 访问令牌。解除绑定时调用 `/oauth/revoke`。

| 方法 | 路径 | 谁来调 |
| --- | --- | --- |
| GET | `/oauth/authorize` | 系统浏览器，不要用 AJAX |
| POST | `/oauth/token` | 助手后端或原生客户端 |
| GET | `/api/integrations/v1/account` | 持有 OAuth 访问令牌的一方 |
| POST | `/api/integrations/v1/credential` | 同上 |
| GET | `/api/integrations/v1/balance` | 同上 |
| GET | `/api/integrations/v1/payment/options` | 同上 |
| POST | `/api/integrations/v1/payment/orders` | 同上 |
| GET | `/api/integrations/v1/payment/orders/{order_id}` | 同上 |
| POST | `/oauth/revoke` | 与 `/oauth/token` 相同的客户端 |
| GET | `{base_url}/models` | 持有 `api_key` 的一方 |
| POST | `{base_url}/chat/completions` | 同上 |

成功响应不包 `success` / `data`。敏感响应带 `Cache-Control: no-store` 和 `Pragma: no-cache`。接口响应带 `X-Request-Id`。时间是 UTC RFC 3339，时长单位是秒。可以忽略以后新增的非必需字段。

## 权限

`scope` 用空格分隔，只能是下面四个，且必须落在该客户端被允许的子集里。

| scope | 作用 |
| --- | --- |
| `account:read` | 读取本次授权对应的账号和钱包余额 |
| `credential:read` | 领取本次授权的模型 API Key |
| `payment:write` | 为该账号创建充值订单。用户仍需在支付页面亲自付款 |
| `offline_access` | 发放刷新令牌。需要在访问令牌过期后继续使用时必须申请 |

完整绑定使用 `account:read credential:read offline_access`；需要在助手里充值时再加 `payment:write`。`payment:write` 要平台在客户端配置里单独开通，已有绑定不会自动获得，需要用户重新授权。不返回 `id_token`。

## 时效

| 对象 | 期限 |
| --- | --- |
| 授权码 | 120 秒，只能兑换一次 |
| OAuth 访问令牌 | 最长 3600 秒，以 `expires_in` 为准；临近绑定截止时会更短 |
| 绑定和刷新令牌 | 从首次签发起 30 天，刷新不延长 |
| 模型 API Key | `expires_at` 不晚于绑定的 `grant_expires_at` |

同一用户对同一个客户端最多 10 个未过期的有效绑定。超限时用户无法再同意新的授权，需要先在野菜API安全页取消旧授权，或等旧绑定到期。

用户修改密码后，已发出的 OAuth 访问令牌和刷新令牌失效，需要重新授权。已经领到的模型 Key 不会因此自动禁用，直到绑定到期、被撤销，或用户在令牌列表里禁用它。

## 1. 发起授权

把系统浏览器导航到：

```text
GET {ISSUER}/oauth/authorize
```

不要用隐藏 iframe 或前端跨域请求读取这个地址。

### 查询参数

| 参数 | 必填 | 值 |
| --- | --- | --- |
| `response_type` | 是 | `code` |
| `client_id` | 是 | 平台分配的客户端 ID |
| `redirect_uri` | 是 | 与登记值精确匹配。`none` 客户端的回环地址允许端口不同，主机、路径和其余部分必须一致 |
| `scope` | 是 | 空格分隔，不可重复 |
| `state` | 是 | 每次新生成，32–128 个 URL 安全字符 |
| `code_challenge` | 是 | PKCE S256，43 个 Base64URL 字符，无 `=` |
| `code_challenge_method` | 是 | `S256` |

重复参数视为非法请求。

### PKCE

```text
code_verifier  = BASE64URL(32 个密码学安全随机字节)，去掉填充 =
code_challenge = BASE64URL(SHA256(code_verifier 的 ASCII 字节))，去掉填充 =
state          = 另外 32 个随机字节的 Base64URL
```

`code_verifier` 也可以是 43–128 个字符，字符集为 `A-Z a-z 0-9 - . _ ~`。每次授权单独生成。把当前助手用户、`state`、`code_verifier`、`redirect_uri` 和预期 `ISSUER` 存在发起授权的那一侧，约 10 分钟内有效。不要把 `code_verifier` 放进授权 URL。

### 回调

用户同意或拒绝后，浏览器跳回登记的 `redirect_uri`。这不是服务端 webhook。

```text
成功：{REDIRECT_URI}?code=...&state=...&iss=...
拒绝：{REDIRECT_URI}?error=access_denied&state=...&iss=...
```

回调本身已有查询参数时，在后面用 `&` 追加，不要再写一个 `?`。

处理顺序：

1. 用 `state` 找回当初那次授权，确认还是同一个助手用户。
2. 把 `iss` 解码后与配置的 `ISSUER` 做精确比较。
3. 有 `error` 就结束；有 `code` 就立刻兑换，然后丢掉本地事务。

`client_id` 或 `redirect_uri` 无法识别时，平台返回 400 HTML，不会重定向。不要把这种页面当成成功回调。

## 2. 用授权码换令牌

```text
POST {ISSUER}/oauth/token
Content-Type: application/x-www-form-urlencoded
```

机密客户端：

```bash
curl -X POST "$ISSUER/oauth/token" \
  --user "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode "redirect_uri=$REDIRECT_URI" \
  --data-urlencode "code_verifier=$CODE_VERIFIER"
```

`none` 客户端不要发送 Basic，也不要在表单里放 `client_secret`，改为 `--data-urlencode "client_id=$CLIENT_ID"`。机密客户端不要在表单里再传 `client_id` 或 `client_secret`。

成功时 HTTP 200：

```json
{
  "access_token": "oa_example",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "or_example",
  "refresh_token_expires_in": 2592000,
  "scope": "account:read credential:read offline_access",
  "binding_id": "bnd_example"
}
```

没有授予 `offline_access` 时不返回 `refresh_token` 和 `refresh_token_expires_in`。`binding_id` 在后续刷新中保持不变。

授权码过期、用过、PKCE 不对、`redirect_uri` 不一致，都是 `400 invalid_grant`。同一授权码再兑换一次会撤销这次绑定。兑换超时且不确定是否成功时，不要拿同一个 `code` 重试，重新走授权。

## 3. 读取已授权账号

```text
GET {ISSUER}/api/integrations/v1/account
Authorization: Bearer {access_token}
```

需要 `account:read`。不能带任何查询参数，也不能带请求体。

```json
{
  "issuer": "https://relay.example.com",
  "account_id": "acct_888",
  "display_name": "Example User",
  "binding_id": "bnd_example",
  "scope": "account:read credential:read offline_access",
  "grant_expires_at": "2026-11-09T00:00:00Z"
}
```

`account_id` 形如 `acct_` 加用户编号，在该账号存续期间稳定。`display_name` 只用于展示。把助手里的当前用户关联到 `{issuer, account_id, binding_id}`。这两个接口都不接受调用方指定用户或 Key，对象完全由访问令牌决定。

## 4. 领取模型 API Key

```text
POST {ISSUER}/api/integrations/v1/credential
Authorization: Bearer {access_token}
Content-Type: application/json
```

需要 `credential:read`。请求体必须是空对象 `{}`，不能带查询参数，也不能多任何字段。

```bash
curl -X POST "$ISSUER/api/integrations/v1/credential" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{}'
```

成功时 HTTP 200：

```json
{
  "binding_id": "bnd_example",
  "account_id": "acct_888",
  "key_id": "key_1",
  "api_key": "sk-example",
  "base_url": "https://relay.example.com/v1",
  "expires_at": "2026-11-09T00:00:00Z"
}
```

核对 `account_id` 和 `binding_id` 与账号接口一致后，再保存 `api_key` 和 `base_url`。`base_url` 已经包含 `/v1`，末尾没有 `/`。

同一次绑定重复或并发领取，返回同一把 Key，不会再发第二把。Key 被用户删除是 `404 credential_not_found`，被禁用是 `403 credential_disabled`，过期是 `403 credential_expired`。这三种情况都不会自动补发，需要用户重新授权（删除或过期）或在野菜API里重新启用（禁用）。

这把 Key 额度不限、不限模型、使用账号默认分组，会出现在用户的令牌列表里。用户可以自行禁用或删除。取消授权也会禁用它；如果用户把同一把 Key 配进了别的软件，那些软件会一起失效。

## 5. 刷新访问令牌

仍是 `POST /oauth/token`，客户端认证方式与兑换授权码相同，并且必须是签发该绑定的那个客户端。

| 参数 | 值 |
| --- | --- |
| `grant_type` | `refresh_token` |
| `refresh_token` | 最近一次成功响应里的刷新令牌 |
| `client_id` | 仅 `none` 客户端必填 |

成功响应字段与第 2 节相同。每次都会换发新的访问令牌和刷新令牌，旧刷新令牌马上失效。`binding_id` 不变，权限不会变多，`refresh_token_expires_in` 变小。刷新不更换模型 Key，也不延长 30 天截止时间。

同一个 `binding_id` 要串行刷新，并原子地换成新令牌。旧刷新令牌再出现一次，整次绑定会被撤销，关联 Key 被禁用，返回 `400 invalid_grant`。网络超时后不要并发重试旧刷新令牌；分不清哪一枚是最新的，就重新授权。

## 6. 解除绑定

```text
POST {ISSUER}/oauth/revoke
Content-Type: application/x-www-form-urlencoded
```

客户端认证与 Token 接口相同。

| 参数 | 说明 |
| --- | --- |
| `token` | 该绑定的访问令牌或刷新令牌。优先传最新刷新令牌。不要传 `api_key` 或 `binding_id` |
| `token_type_hint` | 可选，`access_token` 或 `refresh_token`。其他值忽略 |
| `client_id` | 仅 `none` 客户端必填 |

可识别为本客户端令牌时，整次绑定被撤销：全部 OAuth 令牌失效，关联模型 Key 被禁用。已经开始的模型请求不保证立刻中断。

成功以及令牌未知、已失效、属于其他客户端时，都是 HTTP 200、空响应体、`Cache-Control: no-store`。不要解析 JSON。客户端认证失败仍然返回错误。收到 200 后清除本地秘密；这个 200 不能证明某一把指定 Key 一定被禁用。没有可撤销的令牌时，请用户到野菜API安全页的「已授权应用」里取消授权。

## 7. 调用模型

`MODEL_BASE_URL` 和 `MODEL_API_KEY` 取第 4 节的 `base_url`、`api_key`。不要再给 `base_url` 追加一次 `/v1`。模型接口不接受 OAuth 访问令牌。

查询模型：

```bash
curl "$MODEL_BASE_URL/models" \
  -H "Authorization: Bearer $MODEL_API_KEY"
```

文本聊天：

```bash
curl -X POST "$MODEL_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"model":"实际模型 ID","messages":[{"role":"user","content":"Hello"}]}'
```

模型 ID 从 `/models` 的 `data[].id` 读取。普通文本读 `choices[0].message.content`。`stream` 为 `true` 时按 SSE 处理，拼接 `choices[].delta.content`，`data: [DONE]` 是结束标记。

本次接入范围是模型列表和文本 Chat Completions。模型接口的错误格式与上面的 OAuth 错误不同。模型 Key 返回 401 时，不要靠刷新 OAuth 令牌来修复。

## 8. 查询余额

```text
GET {ISSUER}/api/integrations/v1/balance
Authorization: Bearer {access_token}
```

需要 `account:read`。不能带查询参数。

```json
{
  "account_id": "acct_888",
  "binding_id": "bnd_example",
  "quota": 1250000,
  "used_quota": 300000,
  "amount": "2.5",
  "currency": "USD",
  "currency_symbol": "$",
  "quota_per_unit": "500000"
}
```

- `quota` 是钱包剩余额度（内部单位，可能为负），`used_quota` 是累计消耗。比较、判断余额是否足够时用 `quota`。
- `amount` 是按站点展示货币换算后的金额，十进制字符串，最多 6 位小数，用于展示。`currency` 为 `USD`、`CNY` 或 `CUSTOM`（自定义货币，看 `currency_symbol`）。
- 只包含钱包余额，不含订阅套餐额度。模型请求时是否有足够额度仍以模型接口为准。
- 余额在消费后可能有几秒延迟。

## 9. 充值

充值分三步：查询可用支付方式，下单拿到收银台地址交给用户付款，轮询订单直到到账。需要 `payment:write`。当前只支持易支付（支付宝、微信等，以 `methods` 为准）。

### 9.1 支付方式

```text
GET {ISSUER}/api/integrations/v1/payment/options
Authorization: Bearer {access_token}
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

- `amount` 是充值数量：1 个单位到账 `amount_unit_quota` 额度。`currency` 为 `USD` 时 1 个单位就是 1 美元额度；为 `TOKENS` 时单位是额度本身。
- `pay_money` 是用户实际支付的金额（`pay_currency`），已经包含账号分组倍率和预设折扣。其他金额的实付价在下单响应里给出。
- `available=false` 表示平台暂未开放充值，不要展示充值入口。

### 9.2 下单

```text
POST {ISSUER}/api/integrations/v1/payment/orders
Authorization: Bearer {access_token}
Content-Type: application/json
Idempotency-Key: {16-64 个 A-Z a-z 0-9 - _}
```

```json
{
  "amount": 10,
  "payment_method": "alipay",
  "return_url": "https://assistant.example.com/billing/done"
}
```

- `amount`、`payment_method` 必填，`return_url` 可选。不能带其他字段或查询参数。
- `Idempotency-Key` 必填，每次新的充值意图生成一个新值。网络超时后用同一个值重试，会返回同一笔订单（HTTP 200），不会重复下单；同一个值换了请求内容会得到 `409 idempotency_conflict`。
- `return_url` 必须和该客户端已登记的某个回调地址同源（协议、域名、端口都相同）；公共客户端登记的回环回调允许任意端口。

成功时 HTTP 201：

```json
{
  "order_id": "USR888NOab12cd1760000000",
  "status": "pending",
  "amount": 10,
  "currency": "USD",
  "pay_money": "70.00",
  "pay_currency": "CNY",
  "payment_method": "alipay",
  "checkout_url": "https://pay.example.com/submit.php?...",
  "created_at": "2026-10-23T08:00:00Z"
}
```

`checkout_url` 是支付平台收银台地址，在内嵌 WebView、弹窗或系统浏览器里打开即可，页面会展示支付宝或微信的收款码。不要修改它的参数，也不要记录到日志里。

每次绑定 1 小时内最多下 20 单，30 分钟内最多 5 笔未支付订单，超出返回 `429 rate_limited`。

### 9.3 查询订单

```text
GET {ISSUER}/api/integrations/v1/payment/orders/{order_id}
Authorization: Bearer {access_token}
```

返回下单时的字段（不含 `checkout_url`），付款成功后 `status` 变为 `success` 并带 `paid_at`。`status` 可能是 `pending`、`success`、`failed`、`expired`。只能查询本次绑定下的订单，其他订单返回 `404 order_not_found`。

打开收银台后每 2–3 秒查询一次；用户关闭支付窗口或超过合理时间后停止轮询。到账以本接口的 `success` 或余额接口为准。

### 9.4 支付后跳回

下单时带了 `return_url`，用户在收银台付款后，浏览器会先回到野菜API完成验签入账，再跳到：

```text
{return_url}?order_id={order_id}&status=success
```

`return_url` 原有的查询参数会保留。`status` 只是提示（可能是 `success` 或 `pending`），不能当作到账凭据，必须再调用 9.3 确认。没带 `return_url` 时，付款后浏览器停在野菜API站内。

第三方下的充值订单会出现在用户的充值记录里，不参与邀请和充值返现活动。

## 10. 错误

### Token 与撤销

```json
{
  "error": "invalid_grant",
  "error_description": "authorization grant is invalid"
}
```

| `error` | HTTP | 处理 |
| --- | --- | --- |
| `invalid_request` | 400 | 修正参数。重复参数也是这个错误 |
| `invalid_client` | 401 或 400 | Basic 失败是 401，并带 `WWW-Authenticate: Basic realm="oauth"`。公共客户端无效是 400 |
| `invalid_grant` | 400 | 重新授权。不要循环重试授权码或旧刷新令牌 |
| `invalid_scope` | 400 或授权回调 | 申请的权限超出客户端允许范围，或格式不对 |
| `unsupported_grant_type` | 400 | 只用 `authorization_code` 和 `refresh_token` |
| `access_denied` | 授权回调 | 用户拒绝。不要自动再次弹授权 |
| `rate_limited` | 429 | 看 `Retry-After`，退避后再试 |
| `server_error` | 500 | 记下 `X-Request-Id`。不要重放授权码或旧刷新令牌 |

`error_description` 只给人看，程序分支只看 `error`。

授权参数错误且回调地址合法时，错误出现在回调查询参数里，而不是 JSON。

### 账号与凭证

```json
{
  "error": {
    "code": "credential_disabled",
    "message": "the authorized API key is disabled"
  },
  "request_id": "..."
}
```

| HTTP | `error.code` | 处理 |
| --- | --- | --- |
| 400 | `invalid_request` | 去掉查询参数，把凭证请求体改成 `{}`，或修正下单字段和 `Idempotency-Key` |
| 400 | `invalid_amount` | 充值数量低于最小值、超过上限，或会让余额超过系统上限 |
| 400 | `invalid_payment_method` | 换成 `payment/options` 里返回的支付方式 |
| 400 | `invalid_return_url` | `return_url` 必须与已登记回调地址同源 |
| 401 | `invalid_token` | 有刷新令牌就刷新一次，再重试原请求一次 |
| 403 | `insufficient_scope` | 重新授权并带上所需 scope |
| 403 | `account_disabled` | 停止调用，提示账号不可用 |
| 403 | `credential_disabled` | 停止调用。不要再领一把新 Key 绕过禁用 |
| 403 | `credential_expired` | 请用户重新授权 |
| 404 | `credential_not_found` | Key 已删除，请用户重新授权 |
| 404 | `order_not_found` | 订单不存在或不属于本次绑定 |
| 409 | `idempotency_conflict` | 同一个 `Idempotency-Key` 用于不同请求，换一个新值 |
| 415 | `unsupported_media_type` | 凭证和下单接口必须是 `application/json` |
| 429 | `rate_limited` | 看 `Retry-After` |
| 503 | `payment_unavailable` | 平台暂未开放充值，稍后再试或隐藏入口 |

完全没有 `Authorization` 时，这些接口返回 401、空正文，以及 `WWW-Authenticate: Bearer realm="integration"`。令牌无效时正文是上面的 JSON，并带 `Bearer error="invalid_token"`。缺权限时带 `Bearer error="insufficient_scope", scope="所需权限"`。

访问令牌只放在 `Authorization: Bearer` 头里。查询参数或正文里的 `access_token` 会被拒绝。

账号查询、同一绑定的凭证领取、撤销可以有限重试。429 优先遵守 `Retry-After`。不要用这套重试去重放授权码、旧刷新令牌或已经发出的模型请求。

## 实现时注意

- 授权必须走系统浏览器的顶层导航。浏览器前端不要保存 `client_secret`，本接口也不提供网页里跨域领取 Key。
- 回调必须对上发起时的助手用户。不要接受链接里随便带一个用户 ID。
- 每个助手用户只用自己的 `api_key`。
- 同一 `binding_id` 的刷新要串行，并一次换成整对新令牌。
- 解绑要先调用 `/oauth/revoke`，再删本地数据。只删本地不算完成解绑。
- 用户也可以在野菜API的安全页取消授权，助手侧应能处理随后出现的 `invalid_token` / `invalid_grant` / `credential_disabled`。
