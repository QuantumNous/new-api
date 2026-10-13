# 中转平台开放接口文档

**第三方 AI 助手接入 · API v1 · 文档 v0.2 · 2026-10-10**

本接口用于：第三方用户登录 AI 助手后，绑定中转平台账号，取得获准使用的 API Key，再调用模型。AI 助手原有登录体系保持不变。

## 1. 接入配置

接入配置由中转平台单独提供。所有示例域名、账号、令牌、密钥和模型名均为示例值。

| 配置项 | 示例 / 约定 |
| --- | --- |
| `RELAY_ORIGIN` | `https://relay.example.com`；不含 `/v1`，末尾不带 `/` |
| `ISSUER` | `https://relay.example.com`；授权服务器标识，精确匹配 |
| `CLIENT_ID` | `assistant_example`；平台分配的应用标识 |
| `TOKEN_AUTH_METHOD` | `client_secret_basic` 或 `none`；按注册配置固定使用 |
| `CLIENT_SECRET` | 仅 `client_secret_basic` 客户端使用，平台安全交付 |
| `REDIRECT_URI` | `https://assistant.example.com/oauth/callback`；第三方提供并预先登记 |

### 1.1 客户端认证

| 客户端注册类型 | `/oauth/token`、`/oauth/revoke` 的认证方式 |
| --- | --- |
| 有安全后端：`client_secret_basic` | `Authorization: Basic <Base64(client_id:client_secret)>`；不在表单再传密钥 |
| 原生公共客户端：`none` | 表单传 `client_id`；不发送 Basic 或 `client_secret` |

本协议分配的 `client_id`、`client_secret` 只使用 URL 安全字符，Basic 示例可直接使用 cURL 的 `--user`。两种客户端均使用 PKCE S256。原生客户端使用系统浏览器；不得在安装包中内置机密客户端密钥。[1][2][3]

### 1.2 权限与凭证

| 值 | 用途 |
| --- | --- |
| `account:read` | 读取已授权的中转账号 |
| `credential:read` | 领取该次授权关联的一把 API Key |
| `offline_access` | 请求刷新令牌；需要持续绑定时申请 |

`scope` 用空格分隔。完整绑定请求使用 `account:read credential:read offline_access`。这些是本协议的权限名称；本接口不返回 `id_token`。

OAuth `access_token` 只用于账号和凭证接口；`refresh_token` 只用于刷新或撤销；模型接口只接受凭证接口返回的 `api_key`。所有令牌及 ID 均按不透明字符串处理。

### 1.3 通用约定

所有 API 使用 HTTPS。Token 与撤销请求使用 `application/x-www-form-urlencoded`，其他请求按接口定义发送 JSON。成功响应不包裹 `success/data`。敏感响应包含 `Cache-Control: no-store`、`Pragma: no-cache`；API 响应包含 `X-Request-Id`。时间使用 UTC RFC 3339，时长单位为秒。客户端忽略新增的非必需响应字段。[1][4]

授权码有效期 120 秒且只能兑换一次；访问令牌最长 3,600 秒，以 `expires_in` 为准；绑定及刷新令牌绝对有效期最长 30 天，刷新不延长该截止时间。API Key 的有效期以 `expires_at` 为准，且不晚于绑定的 `grant_expires_at`。以上为本接入协议的时效约定。

### 1.4 调用顺序与接口索引

```text
/oauth/authorize → /oauth/token → /account → /credential
                                              ↓
                                   使用 api_key 调用模型
```

| 方法 | 路径 | 鉴权 |
| --- | --- | --- |
| GET | `/oauth/authorize` | 浏览器登录和授权 |
| POST | `/oauth/token` | 已登记的客户端认证 |
| GET | `/api/integrations/v1/account` | OAuth Bearer |
| POST | `/api/integrations/v1/credential` | OAuth Bearer |
| POST | `/oauth/revoke` | 已登记的客户端认证 |
| GET | `{base_url}/models` | 模型 API Key |
| POST | `{base_url}/chat/completions` | 模型 API Key |

## 2. 发起账号绑定

**GET `/oauth/authorize`**

将系统浏览器重定向到该地址。此接口展示登录及授权页面，不通过 AJAX 读取 JSON。

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `response_type` | string | 是 | 固定 `code` |
| `client_id` | string | 是 | 已登记的应用标识 |
| `redirect_uri` | string | 是 | 预先登记的回调地址 |
| `scope` | string | 是 | 空格分隔的权限集合 |
| `state` | string | 是 | 每次请求生成的随机值；32–128 个 URL 安全字符 |
| `code_challenge` | string | 是 | PKCE S256 结果；43 个 Base64URL 字符，无 `=` |
| `code_challenge_method` | string | 是 | 固定 `S256` |

`redirect_uri` 精确匹配登记值。原生应用回环回调可使用已登记的 `http://127.0.0.1:<port>/...` 或 IPv6 回环地址，允许动态端口；该例外不适用于普通网页回调。[3]

### 发起请求前生成 PKCE

```text
code_verifier = BASE64URL(32 个密码学安全随机字节)，去掉 =
code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))，去掉 =
state = 另行生成的 32 个密码学安全随机字节的 Base64URL 值
```

每次独立生成。客户端临时保存当前助手用户、浏览器会话、`state`、`code_verifier`、回调地址与预期 `ISSUER`，本地事务 10 分钟过期；不得把 `code_verifier` 放进授权 URL。其他合法 verifier 的长度为 43–128 个字符，允许 `A-Z a-z 0-9 - . _ ~`。[2]

### 授权 URL

以下分行展示，实际发送时拼接为一个 URL：

```text
https://relay.example.com/oauth/authorize
?response_type=code
&client_id=assistant_example
&redirect_uri=https%3A%2F%2Fassistant.example.com%2Foauth%2Fcallback
&scope=account%3Aread%20credential%3Aread%20offline_access
&state=STATE_VALUE
&code_challenge=PKCE_CHALLENGE
&code_challenge_method=S256
```

### 回调参数

平台通过浏览器重定向至第三方登记的 `REDIRECT_URI`，不是服务端 webhook。

| 参数 | 返回条件 | 说明 |
| --- | --- | --- |
| `code` | 成功 | 一次性授权码 |
| `state` | 成功或错误 | 原请求的 `state` |
| `iss` | 成功或错误 | 平台授权服务器标识 |
| `error` | 错误 | 例如 `access_denied` |
| `error_description` | 错误，可选 | 展示或排障说明，不能用于程序分支判断 |

```text
成功：{REDIRECT_URI}?code=CODE&state=STATE&iss=ENCODED_ISSUER
拒绝：{REDIRECT_URI}?error=access_denied&state=STATE&iss=ENCODED_ISSUER
```

示例假设回调原本不含 Query；存在 Query 时追加参数，不能拼出第二个 `?`。

回调先校验 `state`、原发起用户及会话，再将解码后的 `iss` 与配置的 `ISSUER` 精确比较；通过后处理 `error` 或兑换 `code`。缺失、超时、重复或不匹配的事务一律拒绝。不合法的客户端或回调地址不会收到重定向。成功兑换后删除事务并跳转至不含授权码的页面。[1][5]

## 3. 授权码兑换 OAuth 令牌

**POST `/oauth/token`**  
**Content-Type：`application/x-www-form-urlencoded`**  
**认证：第 1.1 节所登记的客户端认证方式**

### 表单参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `grant_type` | string | 是 | 固定 `authorization_code` |
| `code` | string | 是 | 回调收到的授权码 |
| `redirect_uri` | string | 是 | 与本次发起授权时的值完全相同 |
| `code_verifier` | string | 是 | 本次事务保存的原始 verifier |
| `client_id` | string | 条件 | `none` 客户端必填；Basic 客户端不填 |

### 请求示例：有后端的客户端

```bash
curl -X POST "$RELAY_ORIGIN/oauth/token" \
  --user "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=$CODE" \
  --data-urlencode "redirect_uri=$REDIRECT_URI" \
  --data-urlencode "code_verifier=$CODE_VERIFIER"
```

`none` 客户端删除 `--user`，增加 `--data-urlencode "client_id=$CLIENT_ID"`。不要把表单改为 JSON。

### 成功响应：HTTP 200

```json
{
  "access_token": "oa_example_only",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "or_example_only",
  "refresh_token_expires_in": 2592000,
  "scope": "account:read credential:read offline_access",
  "binding_id": "bnd_001"
}
```

| 字段 | 类型 | 必返 | 说明 |
| --- | --- | --- | --- |
| `access_token` | string | 是 | OAuth 接口访问令牌，不是模型 Key |
| `token_type` | string | 是 | 固定 `Bearer` |
| `expires_in` | integer | 是 | 访问令牌剩余有效秒数，范围 1–3600 |
| `refresh_token` | string | 条件 | 实际授予 `offline_access` 时返回 |
| `refresh_token_expires_in` | integer | 条件 | 与刷新令牌同时返回，表示剩余秒数 |
| `scope` | string | 是 | 实际授予权限；客户端应核对必需权限 |
| `binding_id` | string | 是 | 本次绑定标识，刷新后保持不变 |

`binding_id`、`refresh_token_expires_in` 是本协议扩展字段。授权码失效、重复兑换、回调或 PKCE 不匹配返回 `400 invalid_grant`。兑换超时且结果不确定时，不循环重用同一授权码，应重新发起绑定。[1][2]

## 4. 获取已授权账号

**GET `/api/integrations/v1/account`**  
**Authorization：`Bearer <access_token>`**  
**Scope：`account:read`**  
**Query / Body：无**

### 请求示例

```bash
curl "$RELAY_ORIGIN/api/integrations/v1/account" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 成功响应：HTTP 200

```json
{
  "issuer": "https://relay.example.com",
  "account_id": "acct_888",
  "display_name": "Example User",
  "binding_id": "bnd_001",
  "scope": "account:read credential:read offline_access",
  "grant_expires_at": "2026-11-09T00:00:00Z"
}
```

| 字段 | 类型 | 必返 | 说明 |
| --- | --- | --- | --- |
| `issuer` | string | 是 | 与配置的 `ISSUER` 一致 |
| `account_id` | string | 是 | 平台内稳定、不可重新分配的账号标识 |
| `display_name` | string | 否 | 仅用于展示，不能作为绑定主键 |
| `binding_id` | string | 是 | 须与令牌响应一致 |
| `scope` | string | 是 | 本次授权实际授予的权限 |
| `grant_expires_at` | string | 是 | 绑定绝对截止时间，UTC RFC 3339 |

第三方将当前已登录助手用户与 `{issuer, account_id, binding_id}` 关联。账号和凭证接口均不接受 `user_id`、`account_id`、`key_id` 等对象选择参数；授权对象完全由访问令牌确定。切换中转账号须由用户发起新的授权。

**错误：** `401 invalid_token`、`403 insufficient_scope`、`403 account_disabled`；其他通用错误见第 9 节。

## 5. 获取模型 API Key

**POST `/api/integrations/v1/credential`**  
**Authorization：`Bearer <access_token>`**  
**Scope：`credential:read`**  
**Content-Type：`application/json`**  
**Query：无；Body：必须为 `{}`，不接受任何字段**

### 请求示例

```bash
curl -X POST "$RELAY_ORIGIN/api/integrations/v1/credential" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{}'
```

### 成功响应：HTTP 200

```json
{
  "binding_id": "bnd_001",
  "account_id": "acct_888",
  "key_id": "key_001",
  "api_key": "sk-example-only",
  "base_url": "https://relay.example.com/v1",
  "expires_at": "2026-11-09T00:00:00Z"
}
```

| 字段 | 类型 | 必返 | 说明 |
| --- | --- | --- | --- |
| `binding_id` | string | 是 | 与令牌、账号响应一致 |
| `account_id` | string | 是 | 与账号响应一致 |
| `key_id` | string | 是 | Key 的不透明标识，不是模型调用凭证 |
| `api_key` | string | 是 | 完整模型调用凭证，不能公开或写入日志 |
| `base_url` | string | 是 | HTTPS 模型基础地址；含 `/v1`，末尾不带 `/` |
| `expires_at` | string | 是 | Key 截止时间，UTC RFC 3339 |

### 客户端处理规则

响应仅包含用户此次授权关联的一把 Key，不返回账号下的全部 Key。客户端核对 `account_id`、`binding_id` 后，安全保存 `api_key` 和 `base_url`，再将绑定标记为可用。

同一有效绑定重复或并发调用返回同一把当前 Key；可在网络故障后有限重试，不会因重复领取新增 Key。Key 被用户禁用、删除或过期时返回错误，不会自动补发。正常聊天不需要每次重新调用本接口。

解绑将禁用本次授权关联的 Key；如果该 Key 同时用于其他软件，其他持有者也会失去调用权限。客户端不能承诺“只删除本地绑定就能收回已取得的 Key”。

**错误：** `400 invalid_request`、`401 invalid_token`、`403 insufficient_scope`、`403 account_disabled`、`403 credential_disabled`、`403 credential_expired`、`404 credential_not_found`；其他通用错误见第 9 节。

## 6. 刷新 OAuth 令牌

**POST `/oauth/token`**  
**Content-Type：`application/x-www-form-urlencoded`**  
**认证：与授权码兑换相同；必须使用本绑定的原客户端**

### 表单参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `grant_type` | string | 是 | 固定 `refresh_token` |
| `refresh_token` | string | 是 | 最新一次成功响应中的刷新令牌 |
| `client_id` | string | 条件 | `none` 客户端必填 |

```bash
curl -X POST "$RELAY_ORIGIN/oauth/token" \
  --user "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=refresh_token' \
  --data-urlencode "refresh_token=$REFRESH_TOKEN"
```

### 成功响应：HTTP 200

```json
{
  "access_token": "oa_example_new",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "or_example_new",
  "refresh_token_expires_in": 2588400,
  "scope": "account:read credential:read offline_access",
  "binding_id": "bnd_001"
}
```

字段定义同第 3 节。每次刷新返回新的 `access_token`、`refresh_token`，旧刷新令牌立即失效；权限不扩大，`binding_id` 不变，剩余有效期递减。OAuth 刷新不会更换模型 Key，也不会延长绑定或 Key 的绝对有效期。

同一 `binding_id` 必须串行刷新并原子保存新令牌。检测到旧刷新令牌被再次使用时，该绑定及关联 Key 被撤销；网络超时后不得并发重试旧刷新令牌。无法确定最新令牌时重新授权。`400 invalid_grant` 不进行自动循环重试。[6]

## 7. 解除绑定 / 撤销授权

**POST `/oauth/revoke`**  
**Content-Type：`application/x-www-form-urlencoded`**  
**认证：与 Token 接口相同**

### 表单参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `token` | string | 是 | 本绑定的 OAuth 令牌；优先使用最新刷新令牌 |
| `token_type_hint` | string | 否 | `refresh_token` 或 `access_token`；其他提示值忽略 |
| `client_id` | string | 条件 | `none` 客户端必填 |

`token` 不得传模型 `api_key`，也不得传 `binding_id`。

```bash
curl -i -X POST "$RELAY_ORIGIN/oauth/revoke" \
  --user "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "token=$REFRESH_TOKEN" \
  --data-urlencode 'token_type_hint=refresh_token'
```

### 成功响应

```http
HTTP/1.1 200 OK
Cache-Control: no-store
Content-Length: 0
```

响应体为空，不执行 JSON 解析。令牌未知、已失效或已撤销也返回 200；客户端认证失败仍返回错误。[7]

对可识别的本客户端绑定，本协议约定撤销整个绑定：所有关联 OAuth 令牌和该绑定的模型 Key 失效，新发起的模型请求被拒绝；已开始的请求或流不保证立即中断。该 Key 联动行为属于本接口约定。

第三方收到成功结果后清除本地绑定和秘密。网络失败时停止本地模型调用，保留安全的撤销重试任务；仅删除本地数据不代表完成远端撤销。对未知令牌返回的 200 不能证明某个指定 Key 已被禁用。无可用撤销凭据时，引导用户在中转平台取消授权。

## 8. 使用 API Key 调用模型

本节 `MODEL_BASE_URL`、`MODEL_API_KEY` 分别取第 5 节响应的 `base_url`、`api_key`。`base_url` 已含 `/v1`，不要再追加一遍。模型接口不使用 OAuth `access_token`。

### 8.1 查询可用模型

**GET `{base_url}/models`**  
**Authorization：`Bearer <api_key>`**

```bash
curl "$MODEL_BASE_URL/models" \
  -H "Authorization: Bearer $MODEL_API_KEY"
```

```json
{
  "object": "list",
  "data": [
    {"id": "example-chat", "object": "model", "created": 0,
     "owned_by": "relay"}
  ]
}
```

读取 `data[].id` 作为模型名。`example-chat` 仅为示例，应替换成实际可用的文本聊天模型。模型列表不声明多模态、工具或其他接口能力。[8]

### 8.2 文本聊天

**POST `{base_url}/chat/completions`**  
**Authorization：`Bearer <api_key>`**  
**Content-Type：`application/json`**

| Body 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 实际可用的文本聊天模型 ID |
| `messages` | object[] | 是 | 至少一条消息 |
| `messages[].role` | string | 是 | 本节文本示例使用 `system`、`user`、`assistant` |
| `messages[].content` | string | 是 | 文本内容 |
| `stream` | boolean | 否 | 默认 `false`；`true` 表示 SSE 流式响应 |

```bash
curl -X POST "$MODEL_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"model":"example-chat","messages":[
    {"role":"user","content":"Hello"}],"stream":false}'
```

非流式成功响应（HTTP 200）：

```json
{
  "id": "chatcmpl_example",
  "object": "chat.completion",
  "created": 1791590400,
  "model": "example-chat",
  "choices": [{"index": 0, "message": {
    "role": "assistant", "content": "Hello!"
  }, "finish_reason": "stop"}],
  "usage": {"prompt_tokens": 8, "completion_tokens": 3,
    "total_tokens": 11}
}
```

普通文本读取 `choices[0].message.content`；`usage` 可能省略，应按实际响应处理。本节仅覆盖文本 Chat Completions，多模态、工具调用、Responses 等能力不在本次接口范围内。[9]

流式请求设置 `stream=true`，按 `text/event-stream` 逐个处理 `data:` 事件，拼接 `choices[].delta.content`；字段可能缺省，不能假设每个事件都有文本。`data: [DONE]` 是结束标记，不是 JSON；cURL 调试流式响应时加 `-N`。[9]

模型请求超时或流中断时，请求可能已经产生用量；不得当作幂等操作无条件自动重发。具体模型权限、余额及限额由模型 API 校验。

## 9. 错误码与客户端恢复

### 9.1 OAuth 接口错误格式

Token、撤销接口使用顶层 OAuth 错误；授权接口通过已校验的回调地址返回 Query 错误。[1][7]

```json
{
  "error": "invalid_grant",
  "error_description": "The authorization grant is invalid."
}
```

| 错误码 | HTTP / 场景 | 客户端处理 |
| --- | --- | --- |
| `invalid_request` | 400；缺少、重复或不合法参数 | 修正请求 |
| `invalid_client` | Basic 失败为 401；公共客户端无效为 400 | 核对客户端及环境配置 |
| `invalid_grant` | 400；code 或 refresh_token 无效 | 重新发起授权，不循环刷新 |
| `invalid_scope` | 400 或授权回调 | 修正申请权限 |
| `unsupported_grant_type` | 400；Token 接口 | 只使用本文两种 grant_type |
| `unsupported_response_type` | 授权回调 | 使用 `response_type=code` |
| `access_denied` | 授权回调 | 用户取消，不自动再次弹窗 |
| `temporarily_unavailable` | 503 或授权回调 | 稍后重试；503 按 Retry-After |
| `server_error` | 500 或授权回调 | 记录请求标识；避免重放 code / 旧刷新令牌 |

Basic 失败包含 `WWW-Authenticate: Basic realm="oauth"`。OAuth 端点限流返回 HTTP 429，附 `Retry-After`；错误字段使用本协议扩展值 `rate_limited`。Token / Revoke 接口中的 `temporarily_unavailable` 和 `server_error` 也属于本协议扩展错误值。

### 9.2 账号 / 凭证接口错误格式

```json
{
  "error": {
    "code": "credential_disabled",
    "message": "The authorized API key is disabled."
  },
  "request_id": "req_example"
}
```

| HTTP | `error.code` | 客户端处理 |
| --- | --- | --- |
| 400 | `invalid_request` | 修正 JSON、Query 或不允许的参数 |
| 401 | `invalid_token` | 有刷新令牌时刷新一次，再重试原请求一次 |
| 403 | `insufficient_scope` | 重新申请所需权限 |
| 403 | `account_disabled` | 停止调用并提示账号不可用 |
| 403 | `credential_disabled` | 停止调用，不自动领取新 Key 绕过禁用 |
| 403 | `credential_expired` | 提示重新授权 |
| 404 | `credential_not_found` | Key 已不存在；提示重新授权 |
| 415 | `unsupported_media_type` | 凭证接口应发送 JSON |
| 429 | `rate_limited` | 读取 `Retry-After` 秒数并退避 |
| 503 | `service_unavailable` | 有限退避重试 |

资源接口完全缺少认证时返回 401、空响应体及 `WWW-Authenticate: Bearer realm="integration"`。已提供无效令牌时返回上述 JSON 并附 `Bearer error="invalid_token"`；缺少权限时附 `Bearer error="insufficient_scope", scope="所需权限"`。客户端程序按 HTTP 状态和错误码处理，不匹配人类可读的 message。[4]

### 9.3 重试与模型错误

账号查询、同一绑定的凭证领取、撤销请求可以有限重试。429、503 优先遵守 `Retry-After`，无该头时采用带随机抖动的指数退避，最多重试 3 次。该重试策略不适用于一次性授权码、已轮换刷新令牌和非幂等模型请求。

模型接口使用自己的 `error` 对象，例如包含 `message`、`type`、`param`、`code`，不套用上面的账号/凭证业务错误码。模型 Key 的 401 不通过刷新 OAuth 令牌修复；余额、模型权限或限流错误不应一律触发重新登录。

## 10. 客户端实现检查表

| 检查项 | 必须满足 |
| --- | --- |
| 用户归属 | 回调绑定到发起时的助手用户，不接受 URL 中任意用户 ID |
| 回调验证 | 检查 state、会话、issuer、一次性事务；使用 PKCE |
| 绑定完成 | account 与 credential 的账号和 binding_id 一致后才标记可用 |
| 令牌刷新 | 同一 binding_id 串行刷新，原子保存新令牌 |
| 密钥存储 | 后端加密或系统凭证库；URL、日志、埋点、工单不得含完整秘密 |
| 远端解绑 | 调用 revoke，再清理本地；网络失败时停止调用并保留重试能力 |
| 模型请求 | 每个助手用户使用自己的绑定凭证，禁止串用其他用户的 Key |
| 浏览器限制 | 授权走导航；浏览器前端不直接保存 client_secret，本版不提供 SPA 跨域取 Key |
| 测试用例 | 覆盖拒绝授权、错误 PKCE、code 重放、过期、并发领取、刷新和解绑 |

## 附录：协议参考

本项目的业务接口路径、绑定字段、API Key 交付、时效和联动撤销以本文为约定。OAuth 及模型消息格式参考以下规范；引用不表示本文新增接口已部署。

[1] RFC 6749：OAuth 2.0（授权码、客户端认证、令牌响应）。
`https://www.rfc-editor.org/rfc/rfc6749.html`

[2] RFC 7636：PKCE。
`https://www.rfc-editor.org/rfc/rfc7636.html`

[3] RFC 8252：原生客户端及回调。
`https://www.rfc-editor.org/rfc/rfc8252.html`

[4] RFC 6750：Bearer 认证及错误。
`https://www.rfc-editor.org/rfc/rfc6750.html`

[5] RFC 9207：授权响应 issuer。
`https://www.rfc-editor.org/rfc/rfc9207.html`

[6] RFC 9700：OAuth 安全及刷新令牌轮换。
`https://www.rfc-editor.org/rfc/rfc9700.html`

[7] RFC 7009：令牌撤销。
`https://www.rfc-editor.org/rfc/rfc7009.html`

[8] New API：模型列表格式。
`https://docs.newapi.ai/en/docs/api/ai-model/models/list/listmodels`

[9] New API：Chat Completions 格式。
`https://docs.newapi.ai/zh/docs/api/ai-model/chat/openai/createchatcompletion`