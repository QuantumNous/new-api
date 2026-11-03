# 野菜 API · 商户服务端对接指南

> 面向商户后端开发人员 · Partner Tenant API v1
> 服务地址：`https://yeschoy.com`
> 文档更新：2026-11-03
> 本文基于当前接口实现和线上实测。示例中的密钥、用户、套餐 ID、订阅 ID 和价格均为占位或演示数据，请替换为自己租户的数据。

## 1. 这套接口解决什么问题

商户负责自己的用户登录、订单和收款；平台提供隔离的模型账号、订阅套餐、模型转发和用量管理。

```text
商户用户注册/登录
        │
        ▼
商户后端用 external_user_id 创建模型账号
        │                      └─ 获得该用户的 sk-... 模型 Key
        ▼
商户展示本租户可用套餐，创建自己的订单并收款
        │
        ▼
商户后端确认支付成功，调用开通接口
        │                      └─ 首次开通或续费一个月
        ▼
使用该用户的 sk-... 调用模型
        │
        ▼
查询该用户的订阅额度、使用量、有效期
```

**边界说明：**

- 开通接口不收款，也不充值平台钱包；必须由商户确认收款后调用。测试开通需事先与平台约定。
- 一个商户只能管理本租户的账号和套餐。
- 商户专属套餐不进入平台普通用户的公共套餐列表，其他商户也不能查询或开通；平台管理员仍可管理。
- 这不是 Partner OAuth API，不需要 OAuth 跳转、用户授权码或 OAuth Client Secret。
- 商户账号在平台侧为非登录账号，不提供可直接登录平台的用户名/密码。
- **不要让所有终端用户共用一个 `external_user_id` 或一个模型 Key**，否则额度、订阅和 RPM 都会共用。

## 2. 接入前准备

请向平台确认以下事项：

1. 已创建并启用 Partner Tenant，取得租户服务端密钥。
2. 租户专属分组有效，且相应模型渠道已绑定**完全同名**的分组。
3. 已为该租户配置并启用套餐；商户通过套餐列表接口确认，而不是直接使用别人的套餐 ID。
4. 已确认套餐额度、参考价格、支持的模型、RPM 及服务约定。
5. 商户后端能够通过 HTTPS 访问平台，并具备密钥保管、订单持久化和失败补偿能力。

套餐由平台管理员配置，当前商户 API 不提供创建或修改套餐的接口。

## 3. 两类密钥：不要混用

| 类型 | 形式 | 用途 | 获取方式 |
| --- | --- | --- | --- |
| 租户服务端密钥 | `pt_<PARTNER_SECRET>` | 创建账号、查询套餐、开通/续费、查询订阅额度 | 平台交付 |
| 用户模型 Key | `sk-<USER_API_KEY>` | 模型列表和模型推理接口 | 创建账号接口返回 |

### 3.1 商户管理接口鉴权

```http
Authorization: Bearer pt_<PARTNER_SECRET>
```

- 租户密钥只能保存在商户可信后端或密钥管理服务中。
- **禁止放进网页前端、移动端、桌面客户端、公开仓库、URL、日志或埋点。**
- 不得通过查询参数传递密钥；`access_token`、`api_key`、`secret` 查询参数会被拒绝。
- 租户密钥不是模型 Key，不能直接用于 `/v1/chat/completions`。
- 模型 Key 不能调用商户账号/套餐管理接口。
- 租户密钥轮换后旧密钥立即失效，需要更新后端配置。

### 3.2 模型接口鉴权

OpenAI 兼容接口：

```http
Authorization: Bearer sk-<USER_API_KEY>
```

Anthropic 兼容接口也支持：

```http
x-api-key: sk-<USER_API_KEY>
anthropic-version: 2023-06-01
```

推荐由商户后端代理模型请求并检查本地用户权限。如果业务需要把模型 Key 交给用户，只能交付该用户自己的 Key，并明确其属于长期访问凭证。

## 4. 地址与接口速查

| 用途 | 地址 |
| --- | --- |
| 站点根地址 | `https://yeschoy.com` |
| 商户管理接口前缀 | `https://yeschoy.com/api/partner/v1` |
| OpenAI SDK 的 `base_url` | `https://yeschoy.com/v1` |

商户管理接口：

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| `PUT` | `/api/partner/v1/accounts` | 创建账号或取回已有账号的模型 Key |
| `GET` | `/api/partner/v1/plans` | 查询本商户启用中的套餐 |
| `POST` | `/api/partner/v1/accounts/{external_user_id}/subscriptions` | 开通或续费套餐 |
| `GET` | `/api/partner/v1/accounts/{external_user_id}/subscription/quota` | 查询有效订阅及额度 |

常用模型接口，是否可用取决于模型及渠道：

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| `GET` | `/v1/models` | 当前模型 Key 可用的模型列表 |
| `POST` | `/v1/chat/completions` | OpenAI Chat，支持流式与非流式 |
| `POST` | `/v1/responses` | OpenAI Responses |
| `POST` | `/v1/messages` | Anthropic Messages |

### 通用约定

- 使用 HTTPS；不要把带密钥的请求自动重定向到其他域名。
- 有 JSON 请求体时使用 `Content-Type: application/json`。
- 商户管理接口成功响应直接返回业务对象，**不是统一的 `{success, data}` 包装**。
- 正常业务错误返回 JSON；网关、网络或基础设施错误仍可能为空或非 JSON，客户端要能兜底处理。
- 时间为 **Unix 秒级时间戳**，不是毫秒。
- 额度为平台内部整数单位，不等同于模型 Token 数、人民币分或实际支付金额。
- 商户接口返回 `Cache-Control: no-store`；尤其不要缓存到共享代理或记录包含模型 Key 的响应体。
- 客户端可忽略响应新增字段；请求不要擅自增加字段，账号和开通接口会拒绝未知字段。

### cURL 示例约定

以下示例用于可信后端终端调试，要求 cURL 支持 `--fail-with-body`。失败时该参数会保留错误响应体并返回非零退出码。实际接入须同时检查 HTTP 状态和响应内容。

预先通过安全方式设置 `PARTNER_SECRET`，不要把真实密钥写进脚本或命令历史；关闭 shell 调试输出（`set -x`）。

```bash
BASE_URL='https://yeschoy.com'
: "${PARTNER_SECRET:?请从密钥管理服务或受保护环境注入租户密钥}"
```

本节及后续示例中的 `customer-1001`、套餐 `42` 和幂等键均为演示值。**开通示例会产生真实订阅变更，不要直接批量运行。**

## 5. 创建账号 / 获取模型 Key

### 请求

```http
PUT /api/partner/v1/accounts
Authorization: Bearer pt_<PARTNER_SECRET>
Content-Type: application/json
```

```json
{
  "external_user_id": "customer-1001",
  "display_name": "商户用户1001"
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `external_user_id` | 是 | 商户自己的稳定用户 ID；去除前后空白后为 1–128 个 Unicode 字符，不允许控制字符 |
| `display_name` | 否 | 去除前后空白后最多 128 个 Unicode 字符；空值时使用外部用户 ID。平台展示名称可能截断为前 20 个字符，不能用作唯一标识 |

限制：请求体最多 **1 KiB（1024 字节）**，只能包含一个 JSON 对象。字符数量限制与 UTF-8 字节限制需要同时满足。

推荐使用不含个人敏感信息的稳定 ID，例如 `customer-1001` 或 UUID。中文和 emoji 受支持，但用于 URL 路径时必须编码整个路径参数。

```bash
curl --silent --show-error --fail-with-body \
  --connect-timeout 5 --max-time 30 \
  -X PUT "$BASE_URL/api/partner/v1/accounts" \
  -H "Authorization: Bearer $PARTNER_SECRET" \
  -H 'Content-Type: application/json' \
  --data '{"external_user_id":"customer-1001","display_name":"商户用户1001"}'
```

### 首次成功：HTTP 201

```json
{
  "external_user_id": "customer-1001",
  "api_key": "sk-<USER_API_KEY>",
  "created": true
}
```

### 重复调用：HTTP 200

```json
{
  "external_user_id": "customer-1001",
  "api_key": "sk-<USER_API_KEY>",
  "created": false
}
```

行为说明：

- 同一租户、同一外部用户 ID 返回同一个模型 Key，不重复创建账号或 Key；不需要 `Idempotency-Key`。
- 相同外部用户 ID 在不同租户中属于不同账号。
- 这是“创建或获取凭证”，**不是修改用户资料接口**；重复传入展示名称不代表更新已有资料。
- 新账号没有钱包额度，也不会自动获得订阅。创建成功不等于可以推理。
- 账号 Key 固定绑定商户专属分组，不能用它选择其他商户分组。
- 已有 Key 被禁用或删除时返回 `409 credential_unavailable`，不会自动补发新 Key；请联系平台处理。
- 商户需要安全保存用户映射和模型 Key；禁止把 `api_key` 写入普通业务日志。

### 路径参数编码

后续接口的 `{external_user_id}` 必须进行 URL 路径段编码，例如 JavaScript 使用 `encodeURIComponent(externalUserId)`。建议避免在业务 ID 中使用 `/`、`?`、`#` 等保留符号，以减少代理路径解码差异。

## 6. 查询商户套餐

```bash
curl --silent --show-error --fail-with-body \
  --connect-timeout 5 --max-time 30 \
  "$BASE_URL/api/partner/v1/plans" \
  -H "Authorization: Bearer $PARTNER_SECRET"
```

### HTTP 200 响应示例（省略非核心字段）

```json
{
  "plans": [
    {
      "id": 42,
      "partner_tenant_id": 7,
      "title": "商户标准月套餐",
      "subtitle": "每月额度与每用户限速",
      "price_amount": 99,
      "currency": "USD",
      "enabled": true,
      "duration_unit": "month",
      "duration_value": 1,
      "applicable_group": "merchant-exclusive",
      "total_amount": 5000000,
      "requests_per_minute": 60,
      "quota_reset_period": "monthly",
      "allow_balance_pay": false,
      "allow_wallet_overflow": false
    }
  ]
}
```

| 字段 | 含义 |
| --- | --- |
| `id` | 开通请求使用的 `plan_id` |
| `partner_tenant_id` | 套餐所属租户；由认证决定权限，不能在请求中伪造租户归属 |
| `title` / `subtitle` | 套餐展示名称与描述 |
| `price_amount` / `currency` | 套餐参考价格与币种；**不是本接口会自动扣除的金额** |
| `enabled` | 是否启用；此列表只返回启用套餐 |
| `duration_unit` / `duration_value` | 当前商户套餐固定为一个月，不应换算为固定 30 天 |
| `applicable_group` | 套餐和模型 Key 使用的专属分组 |
| `total_amount` | 每周期内部额度；`0` 表示不限量，不是无额度 |
| `requests_per_minute` | 每用户、每分组的 RPM；`0` 表示无套餐级限速 |
| `quota_reset_period` | 当前固定为 `monthly` |
| `allow_balance_pay` | 商户套餐不走平台余额购买 |
| `allow_wallet_overflow` | 商户套餐禁止钱包溢出兜底 |

只返回本商户的套餐，不返回其他商户或平台公共套餐。返回 `{"plans":[]}` 是正常响应，表示当前没有对该租户开放的启用套餐，请联系平台配置。

不要从演示文档、其他商户或浏览器页面猜测 `plan_id`；以此接口返回值为准。

## 7. 开通 / 续费套餐

**仅由商户可信后端在确认对应订单已支付或获得明确测试授权后调用。**

### 请求

```http
POST /api/partner/v1/accounts/customer-1001/subscriptions
Authorization: Bearer pt_<PARTNER_SECRET>
Content-Type: application/json
Idempotency-Key: order_20261103_demo_0001
```

```json
{
  "plan_id": 42
}
```

| 参数 | 位置 | 必填 | 说明 |
| --- | --- | --- | --- |
| `external_user_id` | URL 路径 | 是 | 已由本商户创建的账号；按路径段编码 |
| `plan_id` | JSON | 是 | 本商户已启用套餐的正整数 ID，不接受字符串 |
| `Idempotency-Key` | 请求头 | 是 | 16–64 个字符，只允许 `A-Z`、`a-z`、`0-9`、`-`、`_` |

请求体最多 1 KiB；只能包含 `plan_id`，不要附加金额、租户 ID、内部用户 ID、到期时间等字段。

```bash
# 演示值：应从已经落库的支付订单读取并复用，不要每次重试都重新生成。
IDEMPOTENCY_KEY='order_20261103_demo_0001'

curl --silent --show-error --fail-with-body \
  --connect-timeout 5 --max-time 30 \
  -X POST "$BASE_URL/api/partner/v1/accounts/customer-1001/subscriptions" \
  -H "Authorization: Bearer $PARTNER_SECRET" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  --data '{"plan_id":42}'
```

### 首次开通：HTTP 201

```json
{
  "external_user_id": "customer-1001",
  "subscription_id": 10001,
  "plan_id": 42,
  "status": "active",
  "start_time": 1793707347,
  "end_time": 1796299347,
  "quota_total": 5000000,
  "quota_used": 0,
  "quota_unlimited": false,
  "next_reset_time": 1796054400,
  "created": true
}
```

| 响应字段 | 说明 |
| --- | --- |
| `external_user_id` | 对应商户用户 |
| `subscription_id` | 平台订阅记录 ID，建议随订单结果保存 |
| `plan_id` | 已开通套餐 ID |
| `status` | 订阅状态；正常开通为 `active` |
| `start_time` / `end_time` | 秒级开始/到期时间 |
| `quota_total` / `quota_used` | 当前周期总额与使用额，均为内部额度单位 |
| `quota_unlimited` | 是否不限量 |
| `next_reset_time` | 下次重置时间；以平台返回值为准 |
| `created` | 是否本次新建订阅；`false` 可能是续费，也可能是重试，不能只靠它识别是否已交付订单 |

### 续费规则

- 同一账号、同一套餐仍有有效订阅时，使用**新订单的新幂等键**续费，返回 HTTP 200、`created:false`。
- 延长原订阅的到期时间一个日历月，`subscription_id` 不变。
- 续费不是立即补充或叠加一份月额度，也不会提高 RPM；周期重置仍按平台自然月边界执行。
- 没有可续的有效同套餐订阅时会新建订阅，返回 HTTP 201。
- 不同 `plan_id` 的开通不是套餐升级接口；可能形成并存订阅，不会自动取消旧套餐。
- 商户侧不要自行用“秒数 + 30 天”推算新到期日，也不要用每次续费累加额度的方式展示权益。

### 幂等语义：防重复执行，不是固定响应快照

当前实现的精确行为如下：

| 情况 | 行为 |
| --- | --- |
| 同一租户、同一幂等键、同一账号、同一套餐重试 | 不再开通或延长；通常返回 HTTP 200、`created:false` |
| 同一幂等键改用不同账号或套餐 | HTTP 409，`idempotency_conflict` |
| 相同账号/套餐使用新的幂等键 | 视为新的业务操作，可能续费一个月 |
| 原开通成功后又发生续费或额度消耗，再重试原幂等键 | 返回订阅**当前状态**；到期时间和用量可能不同于首次响应，不会再次延长 |

**不要依赖重试返回原始 HTTP 状态、`created`、到期时间或用量快照。** 商户自己的订单交付记录应保存首次确认的业务结果。超时后应复用原幂等键，而不是生成新键；否则可能重复续费。

幂等键的命名空间是整个商户租户，不是某个用户。建议使用已经持久化的订单唯一键，或在创建订单时生成并保存标准 UUID。同一个订单的回调、补偿任务和人工重试必须读取同一个键。

## 8. 支付回调与补偿建议

建议商户保存以下映射：

- 用户表：本地用户 ID、`external_user_id`、加密保存的模型 Key。
- 订单表：订单 ID、用户 ID、`plan_id`、实际收款状态、持久化的幂等键、交付状态、`subscription_id`、最近错误/请求 ID。
- 对账记录：支付机构流水号、已确认的开通结果、有限次数的重试记录。日志不包含密钥。

推荐流程：

```text
接收支付回调
  → 验证支付机构签名、商户号、订单号、金额、币种和支付成功状态
  → 订单已经交付：直接按支付机构约定确认回调，不再生成新幂等键
  → 持久化支付成功状态，并创建/认领该订单唯一的交付任务
  → 用订单原有的 external_user_id + plan_id + Idempotency-Key 调用平台
  → HTTP 200 或 201：核对响应账号/套餐，持久化交付成功及 subscription_id
  → 超时/连接中断/429/5xx：记录待补偿，后续仍使用原幂等键
  → 400/401/403/404/409：按错误码排查，不无条件重试
```

实施要点：

- 用数据库唯一约束、事务或任务认领机制防止本地多个任务生成不同幂等键。
- 支付回调不宜长时间等待平台接口；可先可靠落库，再通过队列异步交付，并按支付渠道约定响应。
- 不能仅因为“用户已经有有效订阅”就认定某笔订单交付成功；多笔续费订单对应同一订阅记录。
- HTTP 超时不代表平台未执行。优先使用同一幂等键重新调用；额度查询只能辅助检查，不能替代订单级幂等确认。
- 409 是键复用冲突，先核对订单映射；不要自动换新键继续开通。
- 客户端按钮去重不足以保证安全，必须实现后端订单级去重。

## 9. 查询订阅额度

```bash
curl --silent --show-error --fail-with-body \
  --connect-timeout 5 --max-time 30 \
  "$BASE_URL/api/partner/v1/accounts/customer-1001/subscription/quota" \
  -H "Authorization: Bearer $PARTNER_SECRET"
```

### HTTP 200 响应示例

```json
{
  "external_user_id": "customer-1001",
  "subscriptions": [
    {
      "plan_id": 42,
      "plan_title": "商户标准月套餐",
      "start_time": 1793707347,
      "end_time": 1798977747,
      "status": "active",
      "quota_total": 5000000,
      "quota_used": 250,
      "quota_remaining": 4999750,
      "quota_unlimited": false,
      "next_reset_time": 1796054400
    }
  ]
}
```

- 只返回当前有效且属于本商户的订阅，不包含平台钱包、其他租户套餐或完整历史记录。
- `subscriptions` 可能为空，也可能有多项，不能写死为只有一个套餐。
- 已有账号但无有效订阅：HTTP 200，`subscriptions:[]`；账号不存在或不属于本商户：HTTP 404。
- 本接口每项不提供 `subscription_id`；需要该 ID 时保存开通/续费接口的返回值。
- 有限额度的剩余值为 `max(quota_total - quota_used, 0)`。
- 不限量订阅为 `quota_unlimited:true`，同时 `quota_total`、`quota_remaining` 均为 `0`。**必须先判断标志，不能把 0 当成耗尽。**
- `next_reset_time` 是秒级时间戳；为 `0` 时不要展示成 1970 年，应显示暂无下一次重置时间。
- 月度重置按平台时区的自然月边界执行，不是简单从开通日每隔 30 天；始终以返回时间为准。

### 额度显示与计费单位

`quota_*` 是平台计费整数。当前站点的 `quota_per_unit` 为 500,000，即：

```text
平台计费单位 = 内部额度 / quota_per_unit
```

当前参数可从 `GET https://yeschoy.com/api/status` 的 `data` 中读取，例如 `quota_per_unit`、`quota_display_type`、`usd_exchange_rate`。本接口属于公共站点配置，不使用商户接口的直接响应结构。

若采用 CNY 显示：

```text
显示金额 = 内部额度 / quota_per_unit × usd_exchange_rate
```

显示币种、兑换率可能调整；不要把 500,000 或固定汇率硬编码成商务结算合同，也不要把额度单位误称为输入/输出 Token。商户向客户收取的金额由商户订单确定，和订阅内部额度分开记录。

## 10. 调用模型

以下请求全部使用**该用户的模型 Key**，不能使用租户密钥。

在可信环境中注入创建账号接口返回的 Key：

```bash
: "${USER_API_KEY:?请安全注入该用户的模型Key}"
```

### 10.1 模型列表

```bash
curl --silent --show-error --fail-with-body \
  --connect-timeout 5 --max-time 30 \
  "$BASE_URL/v1/models" \
  -H "Authorization: Bearer $USER_API_KEY"
```

列表中的 `data[].id` 用于请求中的 `model`。如返回 `supported_endpoint_types`，可据此选择兼容协议；不要假设所有模型都支持所有接口。

模型列表可查询成功，并不代表有足够订阅额度或所有上游渠道都健康，需用小请求完成联调。

### 10.2 Chat 非流式

以下模型名仅为已实测示例；若本商户的模型列表没有它，请替换为本商户可用模型。

```bash
curl --silent --show-error --fail-with-body \
  --connect-timeout 5 --max-time 120 \
  "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $USER_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Reply OK."}],"max_tokens":32,"stream":false}'
```

从 `choices[0].message.content` 读取文本；从 `usage` 获取模型报告的 Token 使用量。订阅真实扣减以额度查询及平台计费记录为准。

### 10.3 Chat 流式（SSE）

```bash
curl --silent --show-error --fail-with-body --no-buffer \
  --connect-timeout 5 --max-time 120 \
  "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $USER_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Reply OK."}],"max_tokens":32,"stream":true,"stream_options":{"include_usage":true}}'
```

客户端需要：

- 按 SSE 事件解析，不把整个响应当作一个 JSON。
- 拼接 `choices[].delta.content`；空增量和独立 usage 事件不视为错误。
- 接收 `data: [DONE]` 作为 Chat 流正常结束信号。
- 检查流内错误和连接异常；HTTP 200 本身不代表整个流正常完成。
- 已收到部分内容后不要自动重新生成整条请求，避免重复内容及重复消费。
- `include_usage` 是否完整生效取决于模型/渠道，不能仅依靠某一个 chunk 估算全部费用。

### 10.4 OpenAI Responses

```bash
curl --silent --show-error --fail-with-body \
  --connect-timeout 5 --max-time 120 \
  "$BASE_URL/v1/responses" \
  -H "Authorization: Bearer $USER_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"model":"deepseek-v4-flash","input":"Reply OK.","max_output_tokens":32,"stream":false}'
```

检查响应 `status`，从 `output` 中消息的 `content` 提取 `output_text`。不要复用 Chat 的 `choices` 解析器。

### 10.5 Anthropic Messages

```bash
curl --silent --show-error --fail-with-body \
  --connect-timeout 5 --max-time 120 \
  "$BASE_URL/v1/messages" \
  -H "x-api-key: $USER_API_KEY" \
  -H 'anthropic-version: 2023-06-01' \
  -H 'Content-Type: application/json' \
  --data '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Reply OK."}],"max_tokens":32,"stream":false}'
```

从 `content` 数组中的 `type:text` 项读取文本，检查 `stop_reason` 和 `usage`。响应可能还包含推理等其他块类型，不能假设第一项一定是正文。

### 10.6 兼容性与预算提醒

- 不同模型、渠道对 `thinking`、`max_tokens`、推理 Token 和 usage 的行为可能不同。已实测渠道存在禁用推理参数未完全生效、报告输出 Token 超过所填 `max_tokens` 的情况。
- 不要只靠最大输出 Token 参数作为绝对费用保险；还应限制输入长度、并发和请求次数，跟踪订阅用量并设置商户侧预算告警。
- 响应中的 `model` 可能是平台映射后的上游名称，不保证与请求别名相同。
- 商户管理接口的幂等键**不能用于保证模型生成不重复计费**。模型请求超时后的重试策略应单独设计。

## 11. RPM 限速说明

套餐的 `requests_per_minute` 是**每个用户、每个分组**的模型请求限制，不是整个商户所有用户共用的限制，也不是每个 API Key 单独限速。

例如 RPM 为 60：

- 用户 A 和用户 B 各自拥有每滚动 60 秒 60 次的上限。
- 同一用户、同一分组下，不同模型和不同 Key 共用计数。
- 达到限额后，新请求返回 HTTP 429；这不是“允许 60 个同时并发”的意思。
- 通过鉴权并进入该限流器的请求会占用计数，即使后续推理失败；鉴权前已拒绝的请求不计入这一级模型限速。
- RPM 为 `0`：关闭套餐级限速，但仍可能受系统/分组级限速约束。
- 同一用户、同一分组存在多个有效商户套餐时，取最高的非零 RPM，不相加。若有 60 与 120，结果是 120；0 与 60 并存时结果是 60。
- 续费只延长时长，不提高 RPM；平台修改套餐 RPM 后会影响现有有效订阅。
- 多节点服务需由平台配置共享 Redis；否则本地限流器只在单节点内计数。

### 商户管理接口也有独立限流

`/api/partner/v1` 的账号/套餐管理请求和模型 RPM 是两回事。当前实现还包含每租户 1,200 次/60 秒、入口每客户端 IP 3,000 次/60 秒的管理接口保护，部署入口也可能有额外限制。这些不是业务保底吞吐承诺，实际以平台配置及 429 为准。

收到 429：优先按 `Retry-After` 等待；未提供时采用带抖动的退避与本地排队，避免所有用户同时重试。管理接口开通重试仍必须复用原幂等键。

## 12. 错误码与排查

### 12.1 商户管理接口错误格式

```json
{
  "error": {
    "code": "account_not_found",
    "message": "account not found"
  },
  "request_id": "<APPLICATION_REQUEST_ID>"
}
```

| HTTP | `error.code` | 常见原因 | 建议 |
| --- | --- | --- | --- |
| 400 | `invalid_request` | 缺字段、类型错误、ID 格式错误、请求体超限、未知字段、幂等键不合法、URL 传密钥 | 修正请求后再试，不原样无限重试 |
| 401 | `invalid_partner_secret` | 密钥缺失/错误、已轮换、租户被禁用 | 检查服务端密钥与租户状态 |
| 403 | `account_disabled` | 对应商户账号被禁用 | 联系平台，不重复创建替代账号绕过限制 |
| 404 | `account_not_found` | 账号未创建、不可用或不属于本租户 | 核对外部用户 ID、URL 编码和租户 |
| 404 | `plan_not_found` | 套餐不存在、被禁用、不属于本租户或配置不符合商户套餐要求 | 重新查询套餐列表并联系平台 |
| 409 | `credential_unavailable` | 原模型 Key 被禁用/删除等 | 联系平台恢复或处理凭证，重建接口不会补发 |
| 409 | `idempotency_conflict` | 同一键对应不同账号或套餐 | 核对订单，不自动换键重试 |
| 429 | `rate_limited` | 商户管理接口限流 | 参考 `Retry-After`，退避重试 |
| 500 | `server_error` | 平台处理失败 | 有限重试；开通保持同一幂等键，并提供请求 ID |

404 不用于披露其他商户资源是否存在，这是租户隔离的一部分。

### 12.2 模型接口错误

模型接口使用其兼容协议的错误结构，**不要假定与商户管理接口完全相同**。例如 OpenAI 兼容接口：

```json
{
  "error": {
    "message": "Insufficient user quota ...",
    "type": "new_api_error",
    "param": "",
    "code": "insufficient_user_quota"
  }
}
```

| 现象 | 排查方向 |
| --- | --- |
| 401 / Invalid token | 是否误用了 `pt_` 密钥、用户模型 Key 是否有效 |
| 403 / `Group ... has been deprecated` | Key 固定分组不在有效分组配置中；请平台核对分组倍率及渠道分组名称，不能只增加近似名称的渠道标签 |
| 403 / `insufficient_user_quota` | 是否已开通订阅、是否过期/额度不足、套餐分组是否匹配；仅创建账号不会获得额度 |
| 429 | 每用户套餐限速或系统/分组限速；按退避策略处理 |
| 模型不存在、无可用渠道、上游错误 | 使用 `/v1/models` 核对模型与协议，并将请求 ID 提供平台 |
| 流式 HTTP 200 后断开或出现错误事件 | 不能当作完整成功；保存已接收状态，不盲目整条重试 |

### 12.3 提交问题时提供什么

请提供：发生时间及其时区、接口路径、HTTP 状态、错误码、外部用户 ID、套餐 ID、商户订单号以及请求 ID。不要发送完整密钥或包含凭证的请求头。

商户错误响应优先使用 JSON 的 `request_id`；线上也可参考 `X-Oneapi-Request-Id`。代理层 `X-Request-Id` 可能与应用请求 ID 不同，建议两者分别记录，不能认为它们永远相等。

## 13. 当前没有的商户管理能力

当前四个管理接口**不包含**：

- 创建/修改套餐、修改套餐价格/RPM/分组。
- 账号列表、账号删除/禁用、模型 Key 轮换/撤销。
- 订阅取消、退款、指定任意时长续费、商户钱包充值。
- 商户可调用的订单交付查询接口或平台订阅事件回调。

以上需求请与平台约定管理方式，不要猜测未公开的路由。平台禁用租户服务端密钥并不等同于撤销已发给客户的模型 Key；需要停止模型使用时应单独联系平台处理账号、Key 或订阅。

## 14. 上线检查清单

- [ ] 租户密钥仅在后端保存；日志和告警已对两类密钥脱敏。
- [ ] 每个真实用户使用稳定且独立的外部用户 ID，Key 与本地用户正确绑定。
- [ ] 能获取本租户的启用套餐，未硬编码演示套餐 ID。
- [ ] 能创建账号，重复调用返回同一 Key。
- [ ] 已验证支付回调签名、订单、金额、币种及成功状态。
- [ ] 幂等键在订单落库时确定，同订单回调、超时补偿、人工重试保持一致。
- [ ] 开通成功、重复请求不再续期、独立续费只延长一个月均已验证。
- [ ] 未把 `created:false` 当作失败，也未假设重试返回原始响应快照。
- [ ] 正确处理不限量标志、空订阅、多订阅、秒级时间戳和额度单位。
- [ ] 普通及流式模型调用已用小请求验证；流处理检查结束信号和错误事件。
- [ ] 已配置每用户排队/限流、429 退避、请求超时及费用告警。
- [ ] 已验证用户之间、商户之间的权限隔离。
- [ ] 已记录应用请求 ID；异常响应非 JSON 或无响应时也能进入补偿流程。
- [ ] 测试账号、测试订阅及临时凭证有明确清理计划。

## 15. 版本说明

**2026-11-03：**整理当前 Partner Tenant v1 对接约定；已实测账号、开通、幂等重试、冲突、续费、跨租户隔离、Chat 流式/非流式、Responses、Messages 和订阅扣量。幂等响应描述以当前实际的“防重复执行、返回最新订阅状态”为准。自然月重置/到期需要跨时间验证；模型能力和限速以实际套餐、渠道配置为准。
