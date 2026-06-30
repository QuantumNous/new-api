# 火山引擎资产 · 配置说明

本文面向 **new-api 管理员**，说明如何在系统设置中配置「火山引擎资产」网关。配置完成后，客户端只需持有 new-api 令牌，即可通过统一的资产接口（`/doubao/open/*`）管理素材，由 new-api 负责签名、鉴权、用户隔离、计费与转发。

> 客户端调用细节请参见配套文档：**火山引擎资产 · API 调用文档**（`volc-asset-api.md`）。

---

## 1. 概述

「火山引擎资产」是一个**资产管理 API 网关**，对接火山引擎 / 豆包（Doubao）/ Seedance 及兼容服务的素材管理接口。素材（Asset）是图片、视频、音频等媒体的**引用（URL）**，用于视频生成等能力——网关只组织这些媒体链接，并不存储媒体本身。

整体链路：

```
客户端 ──(Bearer new-api 令牌)──▶ new-api（火山引擎资产网关）──(出口: 签名/凭证)──▶ 上游火山 Ark / 兼容网关
```

- **入口固定**：客户端始终调用同一套「规范化（火山原生风格）」资产 API，使用 new-api 令牌鉴权，**不接触任何上游凭证**。
- **出口可配置**：网关把每个请求转发到一个可配置的上游目标（出口 / outbound），出口决定了用何种格式、凭证、基址访问上游。
- **按用户隔离**：每个用户在每个出口上都会被自动分配一个专属素材组，用户之间无法互相访问素材。

---

## 2. 核心概念

| 概念 | 说明 |
| --- | --- |
| **入口（entry）** | 固定的规范化资产 API（火山原生形态）。客户端只认这一套接口与 new-api 令牌。 |
| **出口（outbound）** | 一个上游目标，包含「格式 + 凭证 + 基址」。可配置多个，按请求选择其一。 |
| **格式（format）** | 出口与上游的对接协议。内置 `volcengine`（火山直连 AK/SK）与 `newapi`（套娃另一台 new-api）；其余协议用「自定义格式」模板表达。 |
| **自定义格式（custom format）** | 一份可复用的适配器模板，用 URL / 方法 / 鉴权 / 字段映射描述任意上游协议，被出口以 ID 引用。 |
| **用户隔离分组** | 每个用户在每个出口上自动开通的专属分组 `newapi-user-{用户ID}`，其全部素材读写都被强制限定在该分组内。 |

---

## 3. 配置入口

进入控制台：**系统设置 → 模型与路由 → 火山引擎资产**。

页面顶部「保存资产设置」用于提交。全部配置以 JSON 形式存储在系统选项键 `VolcAssetConfig` 下。页面分为以下几块：

1. 出口（Outbounds）
2. 路由与选择（Routing & selection）
3. 自定义出口格式（Custom outbound formats）
4. 按操作计费（Per-operation billing）
5. 资产接口限流（Asset API rate limit）

---

## 4. 出口配置（Outbounds）

点击「添加出口」新增一个出口。出口字段如下（不同格式所需字段不同）：

| 字段 | UI 标签 | 说明 | 适用格式 |
| --- | --- | --- | --- |
| `id` | Outbound ID | 出口稳定标识，客户端用它选择出口。留空视为 `default`。 | 全部 |
| `name` | Name | 备注名，仅用于展示。 | 全部 |
| `format` | Outbound format | 出口格式：`volcengine` / `newapi` / 某个自定义格式 ID。 | 全部 |
| `base_url` | Base URL | 上游基址。`volcengine` 无需填写（按区域自动拼接）。 | `newapi` / 自定义 |
| `access_key` | Access Key | 火山 Access Key ID。 | `volcengine` / 自定义 |
| `secret_key` | Secret Key | 火山 Secret Access Key。**写入型字段**，留空保留原值。 | `volcengine` / 自定义 |
| `access_token` | Access Token | Bearer / 网关令牌。**写入型字段**，留空保留原值。 | `newapi` / 自定义 |
| `region` | Region | 区域，缺省 `cn-beijing`。 | `volcengine` / 自定义 |
| `project_name` | Project Name | 火山项目名，可留空使用默认值。 | 全部 |
| `group_type` | Group Type | 分组类型，缺省 `AIGC`。 | 全部 |
| `disabled` | （开关） | 关闭后该出口不参与解析与回退。 | 全部 |

### 4.1 三种出口格式

**① Volcengine Direct（火山直连 AK/SK）—— `volcengine`**

- 内置格式，直连火山 Ark，使用 AK/SK 进行 **HMAC-SHA256** 签名（无法用模板表达，故内置）。
- 基址自动拼接为 `https://ark.{region}.volcengineapi.com`，**无需填写 Base URL**。
- 必填：`Access Key`、`Secret Key`。可选：`Region`（默认 `cn-beijing`）、`Project Name`、`Group Type`（默认 `AIGC`）。

**② new-api（套娃）—— `newapi`**

- 对接**另一台 new-api** 的资产接口，使用路径式 Action + Bearer 鉴权。
- 必填：`Base URL`（另一台 new-api 的资产接口基址）、`Access Token`（对方的 new-api 令牌）。

**③ 自定义格式 —— 引用某个自定义格式 ID**

- 用于内置格式都不匹配的上游（如火山兼容网关）。先在「自定义出口格式」中定义模板，再在出口的 `format` 中选择该模板 ID。详见 [第 6 节](#6-自定义出口格式custom-formats)。

### 4.2 凭证安全

`Secret Key` 与 `Access Token` 为**只写字段**：加载时会脱敏，永不回显到浏览器。

- 想保留现有凭证：**留空**即可。
- 想更换凭证：填入新值后保存。

---

## 5. 路由与选择（Routing & selection）

决定每个请求落到哪个出口。

| 配置 | UI 标签 | 说明 |
| --- | --- | --- |
| `default_outbound` | Default outbound | 客户端未指定出口时使用的出口 ID。选「Auto」表示用第一个已配置出口。 |
| `outbound_selector_header` | Outbound selector header | 客户端用于指定出口的请求头名，缺省 `X-Asset-Outbound`。客户端在该请求头中携带出口 ID 即可选择目标。 |
| `failover` | Enable failover | 开启后，所选/默认出口不可用时按顺序回退到其它已启用出口。 |

**出口选择优先级**：

1. 客户端指定（请求头 `X-Asset-Outbound: <出口ID>`，或查询参数 `?outbound=<出口ID>`）
2. 默认出口（`default_outbound`）
3. 第一个已启用且配置完整的出口

开启 `failover` 时，主候选之后会追加其余已启用出口用于回退；未开启时只用主候选。仅「配置完整（可用）」的出口才会进入候选。

> 关于 `X-Asset-Outbound`：这是 **new-api 自定义的出口选择头，不是火山引擎官方参数**，仅在 new-api 本端被消费、不会转发给上游。单出口部署可忽略此项；多出口部署才用得上。

---

## 6. 自定义出口格式（Custom formats）

> 可选的高级功能，大多数场景用不到。内置的 `volcengine` 与 `newapi` 只需填凭证。仅当上游协议与内置格式都不匹配时才需要自定义格式。

在「自定义出口格式」中点击「添加格式」（或「网关预设」一键生成火山兼容网关模板）。字段如下：

| 字段 | UI 标签 | 说明 |
| --- | --- | --- |
| `id` | Format ID | 模板标识，被出口的 `format` 引用。 |
| `name` | Name | 备注名。 |
| `method` | HTTP method | 上游 HTTP 方法，缺省 `POST`。 |
| `url_template` | URL template | 上游 URL 模板，支持占位符。缺省 `{base_url}?Action={action}`。 |
| `auth.type` | Auth type | 鉴权方式：`none` / `bearer` / `header` / `query`。 |
| `auth.name` | Auth name | `header` / `query` 模式下的名称（如 `X-Access-Token`）。 |
| `auth.value` | Auth value | 鉴权值，支持占位符（如 `{access_token}`）。 |
| `headers` | Static headers | 附加静态请求头（值支持占位符）。 |
| `request_passthrough` | Pass through request body | 为真则原样透传规范化请求体（仍会叠加静态请求体字段）。 |
| `request_mapping` | Request field mapping | 关闭透传时，把规范化字段搬运到上游字段（`from`→`to`）。 |
| `result_path` | Result path | 上游响应中「结果」所在的 gjson 路径，留空表示整个响应体即结果。 |
| `error_code_path` | Error code path | 上游业务错误码路径，错误码非空（且非 `0`）即视为失败。 |
| `error_message_path` | Error message path | 上游业务错误信息路径。 |
| `response_mapping` | Response field mapping | 把上游结果字段搬运到规范化结果。 |
| `items_path` | Items path | 列表结果中数组所在路径（相对 `result_path`）。 |
| `item_mapping` | List item mapping | 配合 `items_path`，逐元素归一化。 |

### 6.1 模板占位符

可用于 `url_template`、`auth.value` 与静态请求头的值：

| 占位符 | 含义 |
| --- | --- |
| `{base_url}` | 出口的 Base URL（去除末尾斜杠） |
| `{action}` | 操作名：`ListAssets` / `GetAsset` / `CreateAsset` / `UpdateAsset` / `DeleteAsset`（含分组管理操作） |
| `{access_key}` | 出口的 Access Key |
| `{secret_key}` | 出口的 Secret Key |
| `{access_token}` | 出口的 Access Token |
| `{project_name}` | 出口的 Project Name |
| `{region}` | 出口的 Region（默认 `cn-beijing`） |
| `{group_type}` | 出口的 Group Type（默认 `AIGC`） |
| `{uuid}` | 每次请求新生成的随机 UUID |
| `{field:<path>}` | 按 JSON 路径从请求体取值，如 `{field:Id}`、`{field:Filter.GroupIds.0}` |

> 字段映射（`request_mapping` / `response_mapping` / `item_mapping`）使用**纯 JSON 路径**，不使用占位符。

### 6.2 网关预设（火山兼容网关）

点击「网关预设」可一键生成一份名为 `volc-gateway` 的模板，等价于「X-Access-Token 风格的火山兼容网关」：

```json
{
  "id": "volc-gateway",
  "name": "Volcengine-compatible gateway",
  "method": "POST",
  "url_template": "{base_url}?Action={action}",
  "auth": { "type": "header", "name": "X-Access-Token", "value": "{access_token}" },
  "headers": { "X-Track-Id": "{uuid}" },
  "request_passthrough": true,
  "result_path": "Result",
  "error_code_path": "Code",
  "error_message_path": "Message"
}
```

随后新增一个出口并引用它：

```json
{
  "id": "gw1",
  "name": "兼容网关",
  "format": "volc-gateway",
  "base_url": "https://asset.example.com/api/asset-management",
  "project_name": "default",
  "group_type": "AIGC",
  "access_token": "你的网关令牌"
}
```

---

## 7. 按操作计费（Per-operation billing）

为每个面向用户的资产操作配置固定扣费额度（单位与系统额度一致）：

| UI 标签 | Action | 说明 |
| --- | --- | --- |
| List assets | `ListAssets` | 列出素材 |
| Get asset | `GetAsset` | 查询素材 |
| Create asset | `CreateAsset` | 创建素材 |
| Update asset | `UpdateAsset` | 更新素材 |
| Delete asset | `DeleteAsset` | 删除素材 |

规则：

- **`0` 表示免费**。
- 调用前先校验额度是否充足（不足返回 `402`）。
- 调用**成功后**才扣费，同时扣减「用户额度」与「令牌额度」，并写入消费日志（`ModelName = volc-asset/{Action}`）。
- 分组管理操作（`*AssetGroup`）也走同一计费通道，可在 `action_prices` 中按需配置（默认 0）。

---

## 8. 资产接口限流（Asset API rate limit）

按用户对资产接口整体限流：

| UI 标签 | 字段 | 说明 |
| --- | --- | --- |
| Max requests | `rate_limit_count` | 时间窗内允许的最大请求数 |
| Time window (seconds) | `rate_limit_duration_seconds` | 时间窗长度（秒） |

- 任一项为 `0` 即**关闭限流**。
- 启用 Redis 时使用 Redis 限流器，否则使用内存限流器。
- 触发限流时返回 `429`，响应体 `{"error":"asset operation rate limit exceeded"}`。

---

## 9. 用户隔离与分组

- 每个用户**首次**调用资产接口时，网关会在所选出口上自动开通专属分组 `newapi-user-{用户ID}`，并把「用户 ↔ 出口 ↔ 分组」绑定持久化（同一用户在不同出口拥有各自独立分组）。
- 面向用户的接口会**强制覆盖** `GroupId` 与 `ProjectName`，客户端传入的分组字段无法越权。
- `GetAsset` / `UpdateAsset` / `DeleteAsset` 会校验资产是否归属调用者分组，不归属则返回 `404`。
- **分组管理接口（`CreateAssetGroup` / `ListAssetGroups` / `GetAssetGroup` / `UpdateAssetGroup` / `DeleteAssetGroup`）仅管理员可调用**：普通用户的分组由系统自动管理，不暴露分组 CRUD，以维持「一用户一分组」的隔离不变量。

---

## 10. 完整配置 JSON 示例

以下为 `VolcAssetConfig` 的完整结构示例（火山直连为主出口，外加一个兼容网关出口与对应自定义格式）：

```json
{
  "outbounds": [
    {
      "id": "volc-main",
      "name": "火山直连-北京",
      "format": "volcengine",
      "base_url": "",
      "region": "cn-beijing",
      "project_name": "default",
      "group_type": "AIGC",
      "access_key": "AKLT****",
      "secret_key": "****",
      "access_token": "",
      "disabled": false
    },
    {
      "id": "gw1",
      "name": "兼容网关",
      "format": "volc-gateway",
      "base_url": "https://asset.example.com/api/asset-management",
      "region": "",
      "project_name": "default",
      "group_type": "AIGC",
      "access_key": "",
      "secret_key": "",
      "access_token": "****",
      "disabled": false
    }
  ],
  "default_outbound": "volc-main",
  "outbound_selector_header": "X-Asset-Outbound",
  "failover": false,
  "custom_formats": [
    {
      "id": "volc-gateway",
      "name": "Volcengine-compatible gateway",
      "method": "POST",
      "url_template": "{base_url}?Action={action}",
      "auth": { "type": "header", "name": "X-Access-Token", "value": "{access_token}" },
      "headers": { "X-Track-Id": "{uuid}" },
      "request_passthrough": true,
      "result_path": "Result",
      "error_code_path": "Code",
      "error_message_path": "Message"
    }
  ],
  "action_prices": {
    "ListAssets": 0,
    "GetAsset": 0,
    "CreateAsset": 0,
    "UpdateAsset": 0,
    "DeleteAsset": 0
  },
  "rate_limit_count": 0,
  "rate_limit_duration_seconds": 0
}
```

---

## 11. 配置完成后

- 客户端基址：`POST https://<你的 new-api 域名>/doubao/open/{Action}`
- 鉴权：`Authorization: Bearer <new-api 令牌>`
- 多出口选择（可选）：请求头 `X-Asset-Outbound: <出口ID>` 或查询参数 `?outbound=<出口ID>`

具体接口、请求/响应字段、错误码与代码示例，见 **火山引擎资产 · API 调用文档**（`volc-asset-api.md`）。
