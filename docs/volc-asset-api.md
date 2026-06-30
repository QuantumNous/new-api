# 火山引擎资产 · API 调用文档

本接口通过 new-api 网关提供素材资产的全生命周期管理。客户端只持有 new-api 令牌，由网关负责对上游火山 Ark / 兼容服务的签名、鉴权、用户隔离与转发。

> 管理员配置说明见 **火山引擎资产 · 配置说明**（`volc-asset-config.md`）。

---

## 1. 基础信息

### 接口域名

```HTTP
https://<你的 new-api 域名>
```

### 请求头

所有接口都必须携带：

| Header | 必填 | 说明 |
| --- | --- | --- |
| `Authorization` | 是 | `Bearer <new-api 令牌>`。即 new-api 控制台签发的 API 令牌（`sk-` 开头），**非上游火山密钥**。 |
| `Content-Type` | 是 | `application/json` |
| `X-Asset-Outbound` | 否 | 多出口部署时用于选择出口，值为出口 ID。也可改用查询参数 `?outbound=<出口ID>`。不传则使用默认出口。 |

> `X-Asset-Outbound` 是 new-api 的出口选择头（可由管理员自定义头名），不是火山官方参数；单出口部署可忽略。

---

## 2. 概述

本接口提供素材资产的完整生命周期管理，支持以下 10 个操作：

| 类别 | Action | 权限 | 说明 |
| --- | --- | --- | --- |
| 素材 | `CreateAsset` | 全部令牌 | 创建素材（传入公网 URL） |
| 素材 | `ListAssets` | 全部令牌 | 列出本人素材 |
| 素材 | `GetAsset` | 全部令牌 | 查询素材处理状态 |
| 素材 | `UpdateAsset` | 全部令牌 | 更新素材信息 |
| 素材 | `DeleteAsset` | 全部令牌 | 删除素材 |
| 素材组 | `CreateAssetGroup` | **仅管理员** | 创建素材分组 |
| 素材组 | `ListAssetGroups` | **仅管理员** | 列出素材组 |
| 素材组 | `GetAssetGroup` | **仅管理员** | 查询单个素材组 |
| 素材组 | `UpdateAssetGroup` | **仅管理员** | 修改素材组 |
| 素材组 | `DeleteAssetGroup` | **仅管理员** | 删除素材组 |

**数据隔离**：接口按令牌所属用户标识身份，数据在用户维度严格隔离。每个用户在每个出口上拥有一个由系统自动开通的专属分组 `newapi-user-{用户ID}`；所有素材读写都被强制限定在该分组内，不同用户无法访问彼此的素材。普通调用方**只需使用 5 个素材接口**，分组由系统自动管理。

---

## 3. 请求规范

### Base URL

| 区域 | Base URL |
| --- | --- |
| 通用 | `https://{host}/doubao/open` |

### 请求格式

所有接口统一使用 `POST` 方法，通过**路径**指定操作（注意：是路径式 `/{Action}`，不是查询参数）：

```
POST {Base URL}/{ActionName}
```

例如：`POST https://{host}/doubao/open/CreateAsset`。

### 请求头

| Header | 必填 | 说明 |
| --- | --- | --- |
| `Authorization` | 是 | `Bearer <new-api 令牌>` |
| `Content-Type` | 是 | 固定为 `application/json` |
| `X-Asset-Outbound` | 否 | 选择出口；不传用默认出口 |

### 注意事项

- 请求体中**无需**传 `ProjectName`，服务端会自动填充为出口配置值。
- 请求体中**无需**传 `GroupId`：素材接口会被强制落到调用者的专属分组，传入的 `GroupId` 会被忽略/覆盖。
- 分组名称 `Name` 请传业务原始名（无需添加任何前缀）。

---

## 4. 响应规范

### 成功响应（HTTP 200）

new-api 会**剥离上游信封**（如火山的 `ResponseMetadata`），直接返回结果对象本身。例如 `CreateAsset` 返回：

```json
{
  "Id": "asset-yyyymmddHHmmss-xxxxx"
}
```

各接口的具体结果字段见下文。列表类接口统一返回 `Items` + `TotalCount` + `PageNumber` + `PageSize`。

> 提示：响应字段由上游火山资产服务产生并透传。火山直连（`volcengine`）返回规范化结构（`Items`/`TotalCount`）；若出口为未配置响应映射的自定义网关，则可能原样透传上游结构（如 `AssetGroups`/`Total`），请以实际出口为准。

### 错误响应

new-api 网关层的错误统一为 `{"error": ...}` 形态：

| 场景 | HTTP | 响应体 |
| --- | --- | --- |
| 请求体格式错误 / 缺少 `Id` | 400 | `{"error":"invalid request body: ..."}` 或 `{"error":"Id is required"}` |
| 无可用出口 | 400 | `{"error":"no configured asset outbound available"}` |
| 令牌无效 / 未授权 | 401 | `{"error":"unauthorized"}`（或令牌鉴权失败的标准错误） |
| 额度不足 | 402 | `{"error":"insufficient user quota for asset operation"}` |
| 无分组管理权限（非管理员） | 403 | `{"error":"asset group management requires admin privileges"}` |
| 素材不属于当前用户 | 404 | `{"error":"asset not found"}` |
| 请求过于频繁 | 429 | `{"error":"asset operation rate limit exceeded"}` |
| 上游调用失败 / 开通分组失败 | 502 | `{"error":"<上游错误信息>"}` |

**上游业务错误**（上游返回的 Code/Message）会被透传为：

```json
{ "error": { "code": "<上游错误码>", "message": "<上游错误信息>" } }
```

其 HTTP 状态码沿用上游返回的状态码。

---

## 5. 素材接口

> 普通调用方使用的核心接口。无需传 `GroupId` / `ProjectName`，服务端会自动隔离到本人分组。

### 5.1 CreateAsset – 创建素材

上传一个素材到本人专属分组。需提供素材的公网可访问 URL，服务端不做二次下载，由上游服务直接处理。

> **注意**：`CreateAsset` 为异步操作。接口返回后素材通常处于处理中状态，需通过 `GetAsset` 轮询直至进入终态（`Active` / `Failed`）。

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/CreateAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "URL": "https://example.com/photo.png",
    "AssetType": "Image",
    "Name": "产品主图"
  }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `URL` | string | 是 | 素材公网 URL，需可被上游服务直接访问 |
| `AssetType` | string | 是 | 素材类型：`Image` / `Video` / `Audio`（首字母大写，也接受全小写如 `image`） |
| `Name` | string | 否 | 素材名称 |
| `GroupId` | string | 否 | 即使传入也会被服务端覆盖为本人分组，无需填写 |

**成功响应**

```json
{
  "Id": "asset-yyyymmddHHmmss-xxxxx"
}
```

> `Id` 即素材 ID，保存它用于后续 `GetAsset` 查询。

---

### 5.2 ListAssets – 列出素材

查询当前用户专属分组下的素材列表。无论是否传入分组过滤，都只会返回本人素材。

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/ListAssets' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "PageNumber": 1,
    "PageSize": 20
  }'
```

可按状态或名称筛选：

```bash
curl -X POST 'https://{host}/doubao/open/ListAssets' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "Filter": { "Statuses": ["Active"], "Name": "产品" },
    "PageNumber": 1,
    "PageSize": 20
  }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `PageNumber` | int | 否 | 页码；不传则发送 `0`，由上游应用其默认值，建议显式传入 |
| `PageSize` | int | 否 | 每页条数；不传则发送 `0`，由上游应用其默认值，建议显式传入 |
| `Filter.Statuses` | []string | 否 | 按状态过滤，如 `["Active"]` |
| `Filter.Name` | string | 否 | 按名称过滤 |
| `SortBy` / `SortOrder` | string | 否 | 排序字段与方向（透传上游） |
| `Filter.GroupIds` / `Filter.GroupType` | - | 否 | 会被服务端强制为本人分组，传入无效 |

**成功响应**

```json
{
  "Items": [
    {
      "Id": "asset-yyyymmddHHmmss-xxxxx",
      "Name": "产品主图",
      "AssetType": "Image",
      "GroupId": "group-yyyymmddHHmmss-xxxxx",
      "Status": "Active",
      "URL": "https://cdn.example.com/assets/photo.png",
      "ProjectName": "default",
      "CreateTime": "2025-01-01T12:00:00Z",
      "UpdateTime": "2025-01-01T12:00:02Z"
    }
  ],
  "TotalCount": 1,
  "PageNumber": 1,
  "PageSize": 20
}
```

| 响应字段 | 类型 | 说明 |
| --- | --- | --- |
| `Items[].Id` | string | 素材 ID |
| `Items[].Name` | string | 素材名称 |
| `Items[].AssetType` | string | 素材类型：`Image` / `Video` / `Audio` |
| `Items[].GroupId` | string | 所属分组（恒为本人专属分组） |
| `Items[].Status` | string | 素材状态，见 [5.3](#53-getasset--查询素材状态) |
| `Items[].URL` | string | 素材访问地址 |
| `Items[].CreateTime` / `UpdateTime` | string | 创建/更新时间 |
| `TotalCount` | int | 总数 |

---

### 5.3 GetAsset – 查询素材状态

查询素材的处理状态，通常用于 `CreateAsset` 后轮询直至素材进入终态。仅能查询本人素材，否则返回 `404`。

**素材状态说明**（取值由上游火山资产服务定义，常见为）

| Status | 含义 | 是否终态 |
| --- | --- | --- |
| `Pending` | 处理中 | 否，需继续轮询 |
| `Active` | 处理成功，可正常使用 | 是 |
| `Failed` | 处理失败 | 是 |
| `Deleted` | 已删除 | 是 |

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/GetAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "Id": "<asset_id>"
  }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Id` | string | 是 | 素材 ID（`CreateAsset` 返回的 `Id`） |

**成功响应**

```json
{
  "Id": "asset-yyyymmddHHmmss-xxxxx",
  "Name": "产品主图",
  "AssetType": "Image",
  "GroupId": "group-yyyymmddHHmmss-xxxxx",
  "Status": "Active",
  "URL": "https://cdn.example.com/assets/photo.png?signature=...",
  "Error": { "Code": "", "Message": "" },
  "ProjectName": "default",
  "CreateTime": "2025-01-01T12:00:00Z",
  "UpdateTime": "2025-01-01T12:00:02Z"
}
```

> `URL` 可能为带时效签名的访问地址。需要时重新调用 `GetAsset` 获取最新 URL。

**轮询建议**

- 素材通常在数秒至数十秒内进入终态；轮询间隔建议适当放宽。
- 若管理员开启了限流，超过阈值将返回 `429`，请降低轮询频率。

**错误码**

| HTTP | 说明 |
| --- | --- |
| 400 | `Id is required`（`Id` 未提供） |
| 404 | `asset not found`（素材不属于当前用户） |
| 429 | `asset operation rate limit exceeded`（请求过于频繁） |

---

### 5.4 UpdateAsset – 更新素材

更新素材的名称等信息。仅能更新本人素材。

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/UpdateAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "Id": "<asset_id>",
    "Name": "产品主图-最终版"
  }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Id` | string | 是 | 素材 ID |
| `Name` | string | 否 | 新名称 |

**成功响应**

```json
{}
```

**错误码**

| HTTP | 说明 |
| --- | --- |
| 400 | `Id is required` |
| 404 | `asset not found`（素材不属于当前用户） |

---

### 5.5 DeleteAsset – 删除素材

删除指定素材。仅能删除本人素材。

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/DeleteAsset' \
  -H 'Authorization: Bearer sk-YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "Id": "<asset_id>"
  }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Id` | string | 是 | 素材 ID |

**成功响应**

```json
{}
```

**错误码**

| HTTP | 说明 |
| --- | --- |
| 400 | `Id is required` |
| 404 | `asset not found`（素材不属于当前用户） |

---

## 6. 素材组接口（仅管理员）

> 以下接口需令牌所属用户为**管理员**，否则返回 `403 asset group management requires admin privileges`。
> 普通用户的分组由系统自动开通与管理，无需也无法通过这些接口操作，以维持用户隔离。

### 6.1 CreateAssetGroup – 创建素材组

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/CreateAssetGroup' \
  -H 'Authorization: Bearer sk-ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "Name": "广告素材组",
    "Description": "存放广告投放相关素材"
  }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Name` | string | 是 | 素材组名称 |
| `Description` | string | 否 | 描述备注 |
| `GroupType` | string | 否 | 分组类型，缺省取出口配置（默认 `AIGC`） |

**成功响应**

```json
{
  "Id": "group-yyyymmddHHmmss-xxxxx"
}
```

---

### 6.2 ListAssetGroups – 列出素材组

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/ListAssetGroups' \
  -H 'Authorization: Bearer sk-ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

可按类型筛选：

```bash
curl -X POST 'https://{host}/doubao/open/ListAssetGroups' \
  -H 'Authorization: Bearer sk-ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{ "Filter": { "GroupType": "AIGC" } }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Filter.Name` | string | 否 | 按名称过滤 |
| `Filter.GroupType` | string | 否 | 按分组类型过滤（如 `AIGC`、`LivenessFace`），缺省取出口默认值 |
| `PageNumber` / `PageSize` | int | 否 | 分页 |

**成功响应**

```json
{
  "Items": [
    {
      "Id": "group-yyyymmddHHmmss-xxxxx",
      "Name": "广告素材组",
      "Description": "存放广告投放相关素材",
      "GroupType": "AIGC",
      "ProjectName": "default",
      "CreateTime": "2025-01-01T12:00:00Z",
      "UpdateTime": "2025-01-01T12:00:00Z"
    }
  ],
  "TotalCount": 1,
  "PageNumber": 1,
  "PageSize": 20
}
```

`GroupType` 取值说明：

| GroupType | 含义 |
| --- | --- |
| `AIGC` | 虚拟人像组（系统默认组、通过 `CreateAssetGroup` 创建的组） |
| `LivenessFace` | 真人授权组（由上游 H5 人脸核身授权流程创建，不可通过 `CreateAssetGroup` 创建） |

---

### 6.3 GetAssetGroup – 查询素材组

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/GetAssetGroup' \
  -H 'Authorization: Bearer sk-ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{ "Id": "<group_id>" }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Id` | string | 是 | 素材组 ID |

**成功响应**

```json
{
  "Id": "group-yyyymmddHHmmss-xxxxx",
  "Name": "广告素材组",
  "Description": "存放广告投放相关素材",
  "GroupType": "AIGC",
  "ProjectName": "default",
  "CreateTime": "2025-01-01T12:00:00Z",
  "UpdateTime": "2025-01-01T12:00:00Z"
}
```

---

### 6.4 UpdateAssetGroup – 更新素材组

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/UpdateAssetGroup' \
  -H 'Authorization: Bearer sk-ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "Id": "<group_id>",
    "Name": "Q2广告素材组",
    "Description": "Q2 投放专用"
  }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Id` | string | 是 | 素材组 ID |
| `Name` | string | 否 | 新名称 |
| `Description` | string | 否 | 新描述 |

**成功响应**

```json
{}
```

---

### 6.5 DeleteAssetGroup – 删除素材组

**请求示例**

```bash
curl -X POST 'https://{host}/doubao/open/DeleteAssetGroup' \
  -H 'Authorization: Bearer sk-ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{ "Id": "<group_id>" }'
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Id` | string | 是 | 素材组 ID |

**成功响应**

```json
{}
```

---

## 7. 错误码参考

new-api 网关层错误（`{"error": "..."}`）：

| HTTP | 错误信息 | 说明 |
| --- | --- | --- |
| 400 | `invalid request body: ...` | 请求体不是合法 JSON |
| 400 | `Id is required` | 必填的 `Id` 未提供 |
| 400 | `no configured asset outbound available` | 没有可用出口（未配置或所选出口不可用） |
| 401 | `unauthorized` | 令牌无效或缺失 |
| 402 | `insufficient user quota for asset operation` | 用户额度不足 |
| 402 | `insufficient token quota for asset operation` | 令牌额度不足 |
| 403 | `asset group management requires admin privileges` | 非管理员调用分组管理接口 |
| 404 | `asset not found` | 素材不属于当前用户 |
| 429 | `asset operation rate limit exceeded` | 请求频率超限 |
| 502 | `failed to provision user asset group: ...` | 自动开通用户分组失败 |
| 502 | `<上游错误信息>` | 上游传输/调用失败 |

上游业务错误（透传）：

| HTTP | 响应体 | 说明 |
| --- | --- | --- |
| 上游状态码 | `{"error":{"code":"<上游错误码>","message":"<上游错误信息>"}}` | 上游返回的业务错误，`code`/`message` 由上游火山资产服务或兼容网关定义 |

---

## 8. 附录：典型调用流程

### 完整的素材上传与使用流程

```
1. 上传素材
   POST /doubao/open/CreateAsset  { URL, AssetType, Name }
   → 获得 Id（素材处于 Pending 状态）

2. 轮询素材状态
   POST /doubao/open/GetAsset  { Id }
   → Status == "Active" 时表示处理完成

3. 使用素材
   → URL 为可访问的素材地址（可能带时效签名）
   → 需要刷新时重新调用 GetAsset 获取最新 URL

4. 素材管理（可选）
   - 更新名称：POST /doubao/open/UpdateAsset
   - 查看列表：POST /doubao/open/ListAssets
   - 删除素材：POST /doubao/open/DeleteAsset
```

> 分组无需手动创建：每个用户首次调用时，系统会自动开通专属分组并将所有素材落入其中。

### 代码示例（Python）

```python
import time
import requests

HOST = "https://your-newapi-host"
TOKEN = "sk-YOUR_TOKEN"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
# 多出口部署时可加上： HEADERS["X-Asset-Outbound"] = "your-outbound-id"

def call(action, body):
    r = requests.post(f"{HOST}/doubao/open/{action}", json=body, headers=HEADERS)
    r.raise_for_status()
    return r.json()

# 1. 上传素材（无需传 GroupId / ProjectName）
asset = call("CreateAsset", {
    "URL": "https://example.com/photo.png",
    "AssetType": "Image",
    "Name": "示例图片",
})
asset_id = asset["Id"]
print(f"素材 ID：{asset_id}")

# 2. 轮询状态
status = "Pending"
result = {}
for _ in range(60):
    time.sleep(1)
    result = call("GetAsset", {"Id": asset_id})
    status = result.get("Status")
    print(f"状态：{status}")
    if status in ("Active", "Failed", "Deleted"):
        break

# 3. 获取最终 URL
if status == "Active":
    print(f"素材 URL：{result['URL']}")

# 4. 列出本人素材
listing = call("ListAssets", {"PageNumber": 1, "PageSize": 20})
print(f"素材总数：{listing['TotalCount']}")
```
