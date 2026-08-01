# BytePlus 素材库 API

> 真人认证素材、multipart 本地文件上传、真人素材列表与删除能力见 [Flatkey 真人素材库 API](./byteplus-real-person-asset-api.md)。本文档中的 `POST /v1/assets` 保持虚拟素材兼容：JSON URL 创建，无幂等键要求。

本文档面向调用方，说明 Flatkey 暴露给 `seedance-2.0` 视频生成链路使用的私有素材库接口。素材库用于先登记可复用的图片、视频或音频素材，再在 `POST /v1/videos` 的 `content[]` 中通过 `asset://{asset_id}` 引用。

文档依据当前代码契约核对：`router/asset-router.go`、`router/video-router.go`、`controller/byteplus_asset.go`、`service/byteplus_asset.go`、`service/byteplus_asset_reference.go`、`middleware/distributor.go`、`relay/channel/task/byteplus/adaptor.go`、`dto/byteplus_asset.go`、`dto/video_seedance.go`、`dto/openai_video.go`。

## 1. 基本约定

### 1.1 Base URL

所有示例使用占位符：

```text
https://router.flatkey.ai
```

替换为你的 Flatkey / new-api 服务地址后再调用。

### 1.2 鉴权

除视频内容下载代理外，本文涉及的接口都使用 Flatkey API Token：

```http
Authorization: Bearer <FLATKEY_API_KEY>
```

不要把上游 BytePlus、Ark 或其他供应商密钥发给这些接口。上游鉴权由服务端渠道配置处理。

### 1.3 Token 与模型权限

素材库与素材引用能力绑定 `seedance-2.0`：

- `POST /v1/assets` 和 `GET /v1/assets/{asset_id}` 会检查当前 Token 是否允许访问 `seedance-2.0`。
- 如果 Token 没有启用模型限制，则默认允许。
- 如果 Token 启用了模型限制，则白名单必须包含 `seedance-2.0`，否则返回 `403 access_denied`。
- `POST /v1/videos` 本身按请求体里的 `model` 走模型权限校验；当请求里包含 `asset://...` 引用时，素材解析会在渠道选择前执行，并固定到素材创建时使用的 BytePlus 渠道。

### 1.4 素材 ID 与 URI 格式

素材创建成功后返回公开素材 ID：

```text
ast_<32 位字母或数字>
```

在视频请求中引用素材时必须写成严格 URI：

```text
asset://ast_<32 位字母或数字>
```

`asset://ast_...` 是 Flatkey 公开的本地 URI，服务端会在调用上游前改写为上游素材引用；它不是 BytePlus 文档中的通用 `asset://<Asset_Id>` 前缀。

严格匹配规则：

- 只允许小写 scheme：`asset://`。
- ID 必须以 `ast_` 开头，后接 32 位英文字母或数字。
- 不允许前后空格。
- 不允许 query、fragment、额外路径或其他后缀。
- 不允许 `asset:ast_...`、`asset:/ast_...`、`ASSET://...`。

错误示例都会返回 `400 invalid_asset_request`：

```text
asset://ast_short
 asset://ast_1234567890abcdefABCDEF1234567890
asset://ast_1234567890abcdefABCDEF1234567890?x=1
ASSET://ast_1234567890abcdefABCDEF1234567890
```

### 1.5 公网 HTTPS 源 URL

创建素材时的 `url` 必须是供应商可拉取的公网 HTTPS URL：

- scheme 必须是 `https`。
- 必须有 host，不能包含 URL user info。
- 不能是 `localhost`。
- 会经过服务端 SSRF / fetch setting 校验；被域名、IP 或端口策略拦截时同样视为非法素材源。
- `http://`、本地地址、内网地址或需登录才能访问的 URL 不适合作为素材源。

## 2. 接口总览

| 方法与路径 | 鉴权 | 用途 |
| --- | --- | --- |
| `POST /v1/assets` | 需要 Bearer Token | 创建图片、视频或音频素材 |
| `GET /v1/assets/{asset_id}` | 需要 Bearer Token | 查询单个素材状态 |
| `DELETE /v1/assets/{asset_id}` | 需要 Bearer Token | 删除真人素材；虚拟素材仍按兼容链路保留 |
| `POST /v1/videos` | 需要 Bearer Token | 创建异步视频任务，可在 `content[]` 中引用素材 |
| `GET /v1/videos/{task_id}` | 需要 Bearer Token | 查询视频任务状态 |
| `GET /v1/videos/{task_id}/content` | 不需要 Token | 下载已完成任务的视频二进制内容 |

当前契约边界：

- 旧版虚拟素材 `POST /v1/assets` 仍是 JSON URL 创建且不要求幂等键；真人素材写入要求 `Idempotency-Key`，详见真人素材库文档。
- 没有通用 `GET /v1/assets` 素材列表接口；真人素材列表限定在 `GET /v1/real-persons/{person_id}/assets`。
- 没有素材更新、重命名或客户端自定义素材 ID。
- 没有跨用户共享素材能力。

## 3. 创建素材

```http
POST /v1/assets
Authorization: Bearer <FLATKEY_API_KEY>
Content-Type: application/json
```

### 3.1 请求体

```json
{
  "url": "https://cdn.example.com/reference/portrait.mp4",
  "asset_type": "Video",
  "moderation": {
    "strategy": "Default"
  }
}
```

| 字段 | 类型 | 必填 | 取值 | 说明 |
| --- | --- | --- | --- | --- |
| `url` | string | 是 | 公网 HTTPS URL | 服务端会校验 URL 可作为远程素材源。 |
| `asset_type` | string | 是 | `Image`、`Video`、`Audio` | 决定后续必须放入哪个 `content[]` 媒体容器。大小写敏感。 |
| `moderation` | object | 否 | - | 素材审核配置容器。 |
| `moderation.strategy` | string | 否 | `Default`、`Skip`、空字符串 | 省略或空字符串时按 `Default` 处理。其他值返回 `400 invalid_asset_request`。 |

### 3.2 成功响应

素材创建接口成功表示创建请求已提交，不代表素材已经可用于视频生成。通常初始状态为 `Processing`。

```json
{
  "id": "ast_1234567890abcdefABCDEF1234567890",
  "object": "asset",
  "asset_type": "Video",
  "status": "Processing",
  "moderation": {
    "strategy": "Default"
  },
  "created_at": 1785292000
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | Flatkey 公开素材 ID。只暴露 `ast_...`，不暴露上游素材 ID。 |
| `object` | string | 固定为 `asset`。 |
| `asset_type` | string | 创建时传入的素材类型。 |
| `status` | string | 当前素材状态，见下文状态表。 |
| `moderation.strategy` | string | 归一化后的审核策略。 |
| `created_at` | integer | Unix 秒级时间戳。 |

响应不会包含源 URL、上游素材 ID、素材组 ID、渠道 ID、渠道密钥或上游请求 ID。

### 3.3 curl 示例

```bash
curl -sS https://router.flatkey.ai/v1/assets \
  -H "Authorization: Bearer <FLATKEY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cdn.example.com/reference/portrait.mp4",
    "asset_type": "Video",
    "moderation": {
      "strategy": "Default"
    }
  }'
```

## 4. 查询素材

```http
GET /v1/assets/{asset_id}
Authorization: Bearer <FLATKEY_API_KEY>
```

### 4.1 成功响应

```json
{
  "id": "ast_1234567890abcdefABCDEF1234567890",
  "object": "asset",
  "asset_type": "Video",
  "status": "Active",
  "moderation": {
    "strategy": "Default"
  },
  "created_at": 1785292000
}
```

### 4.2 素材状态

| 状态 | 是否可用于视频请求 | 含义 | 调用方动作 |
| --- | --- | --- | --- |
| `Creating` | 否 | Flatkey 正在准备素材记录或素材组。 | 稍后重新查询。 |
| `Processing` | 否 | 上游正在处理素材。 | 继续轮询。 |
| `Active` | 是 | 素材可在 `POST /v1/videos` 中通过 `asset://...` 引用。 | 可以发起视频任务。 |
| `Failed` | 否 | 素材处理失败。 | 修正源素材后重新创建新素材。 |

注意：`GET /v1/assets/{asset_id}` 遇到 `Failed` 素材时返回 `422 asset_failed` 错误，而不是返回一个 `status: "Failed"` 的成功响应。

### 4.3 轮询建议

素材创建是异步流程。调用方应轮询 `GET /v1/assets/{asset_id}`，直到拿到 `status: "Active"` 再提交视频任务。

建议：

- 初始等待 1 到 2 秒后开始查询。
- 使用指数退避或固定 2 到 5 秒间隔。
- 遇到 `409 asset_not_ready` 可继续轮询。
- 遇到 `422 asset_failed`、`404 asset_not_found`、`400 invalid_asset_request` 不应继续轮询同一请求。

### 4.4 curl 示例

```bash
curl -sS https://router.flatkey.ai/v1/assets/ast_1234567890abcdefABCDEF1234567890 \
  -H "Authorization: Bearer <FLATKEY_API_KEY>"
```

## 5. 在视频请求中使用素材

素材只能在 `POST /v1/videos` 的 Seedance `content[]` 格式中引用。

### 5.1 最小请求

```http
POST /v1/videos
Authorization: Bearer <FLATKEY_API_KEY>
Content-Type: application/json
```

```json
{
  "model": "seedance-2.0",
  "content": [
    {
      "type": "image_url",
      "image_url": {
        "url": "asset://ast_1234567890abcdefABCDEF1234567890"
      },
      "role": "reference_image"
    },
    {
      "type": "text",
      "text": "A cinematic talking portrait in a studio"
    }
  ],
  "resolution": "1080p",
  "ratio": "16:9",
  "duration": 5
}
```

### 5.2 `content[]` 字段

`content[]` 支持以下条目：

| `type` | 内容字段 | URL 容器 | 常见 `role` | 说明 |
| --- | --- | --- | --- | --- |
| `text` | `text` | 无 | 可省略 | 文本提示词。多个文本条目会用换行拼接为提示词。 |
| `image_url` | `image_url.url` | 图片 URL 或 `asset://...` | `first_frame`、`last_frame`、`reference_image` | 图片输入或图片素材引用。 |
| `video_url` | `video_url.url` | 视频 URL 或 `asset://...` | `reference_video` | 视频输入或视频素材引用。 |
| `audio_url` | `audio_url.url` | 音频 URL 或 `asset://...` | `reference_audio` | 音频输入或音频素材引用。 |

服务端验证的最低要求是：请求中至少有一个非空文本提示词，或至少一个图片 / 视频输入。只有音频且没有文本、图片、视频时不满足当前 Seedance 最小请求校验。

### 5.3 素材类型与容器必须匹配

素材的 `asset_type` 必须与承载它的 URL 容器匹配：

| 素材 `asset_type` | 必须放入 | 正确示例 |
| --- | --- | --- |
| `Image` | `image_url.url` | `"image_url": {"url": "asset://ast_..."}` |
| `Video` | `video_url.url` | `"video_url": {"url": "asset://ast_..."}` |
| `Audio` | `audio_url.url` | `"audio_url": {"url": "asset://ast_..."}` |

不匹配会返回 `400 invalid_asset_request`。例如把 `asset_type: "Video"` 的素材放入 `image_url.url` 会失败。

实现会扫描实际填充的 `image_url`、`video_url`、`audio_url` 字段来解析素材引用。调用方应保持 `type` 与对应容器一致，避免同一个 `content[]` 条目同时填多个媒体容器。

### 5.4 所有权与隔离

素材按用户隔离：

- 只有创建素材的用户可以查询和引用该素材。
- 其他用户引用或查询该素材时，结果与素材不存在一致，返回 `404 asset_not_found`。
- 返回给调用方的错误不会区分“不存在”和“属于其他用户”。

### 5.5 同渠道固定

包含素材引用的视频请求会固定到素材创建时使用的同一个 BytePlus 渠道：

- 单个请求中引用的所有素材必须来自同一个渠道。
- 如果多个素材来自不同渠道，返回 `409 asset_channel_conflict`。
- 如果调用方使用了“指定渠道”Token 后缀或管理员指定渠道能力，该指定渠道必须与素材固定渠道一致，否则返回 `409 asset_channel_conflict`。
- 如果素材固定渠道被禁用、不是 BytePlus 渠道、缺少 `seedance-2.0` 能力，或该分组不支持该渠道，返回 `503 asset_channel_unavailable`。
- 固定渠道并发满时返回 `429`，不会自动回退到其他渠道。

### 5.6 提交成功响应

`POST /v1/videos` 是异步提交接口。提交成功后返回公开任务 ID：

```json
{
  "id": "task_1234567890abcdef1234567890abcdef",
  "task_id": "task_1234567890abcdef1234567890abcdef",
  "object": "video",
  "model": "seedance-2.0",
  "status": "queued",
  "progress": 0,
  "created_at": 1785292100
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 公开任务 ID。 |
| `task_id` | string | 兼容字段，通常与 `id` 相同。 |
| `object` | string | 固定为 `video`。 |
| `model` | string | 调用方请求的模型名。 |
| `status` | string | 初始通常为 `queued`。 |
| `progress` | integer | 0 到 100。 |
| `created_at` | integer | Unix 秒级时间戳。 |

## 6. 查询视频任务

```http
GET /v1/videos/{task_id}
Authorization: Bearer <FLATKEY_API_KEY>
```

### 6.1 响应示例：处理中

```json
{
  "id": "task_1234567890abcdef1234567890abcdef",
  "task_id": "task_1234567890abcdef1234567890abcdef",
  "object": "video",
  "model": "seedance-2.0",
  "status": "in_progress",
  "progress": 50,
  "created_at": 1785292100,
  "completed_at": 1785292140
}
```

### 6.2 响应示例：完成

完成后 `metadata.url` 是视频结果地址。BytePlus 白标链路中该地址应是本服务代理地址，而不是上游真实视频地址。

```json
{
  "id": "task_1234567890abcdef1234567890abcdef",
  "task_id": "task_1234567890abcdef1234567890abcdef",
  "object": "video",
  "model": "seedance-2.0",
  "status": "completed",
  "progress": 100,
  "created_at": 1785292100,
  "completed_at": 1785292200,
  "metadata": {
    "url": "https://router.flatkey.ai/v1/videos/task_1234567890abcdef1234567890abcdef/content"
  },
  "usage": {
    "completion_tokens": 120,
    "total_tokens": 120
  }
}
```

`usage` 只有在上游返回并被任务轮询保存后才出现。

### 6.3 响应示例：失败

```json
{
  "id": "task_1234567890abcdef1234567890abcdef",
  "task_id": "task_1234567890abcdef1234567890abcdef",
  "object": "video",
  "model": "seedance-2.0",
  "status": "failed",
  "progress": 100,
  "created_at": 1785292100,
  "completed_at": 1785292200,
  "error": {
    "message": "task failed",
    "code": ""
  }
}
```

### 6.4 视频状态

| 状态 | 含义 | 调用方动作 |
| --- | --- | --- |
| `queued` | 已提交，等待处理。 | 继续轮询。 |
| `in_progress` | 处理中。 | 继续轮询。 |
| `completed` | 已完成。 | 读取 `metadata.url` 或调用 `/content` 下载。 |
| `failed` | 失败。 | 读取 `error`，修正请求后重新提交。 |
| `unknown` | 未知状态。 | 稍后查询；持续未知时按异常处理。 |

### 6.5 轮询建议

- 提交任务后等待 2 到 5 秒再查询。
- 常规间隔 5 到 10 秒；长视频或高负载时适当增加。
- 以 `completed`、`failed` 为终止状态。
- 查询接口需要 Bearer Token；只能查询当前用户自己的任务。

## 7. 下载视频内容

```http
GET /v1/videos/{task_id}/content
```

该接口是匿名下载代理，不需要 Bearer Token。不可猜测的 `task_id` 本身就是访问凭证，便于直接放进 `<video src="...">`、播放器或下载器。

### 7.1 行为

- 只支持已完成任务。任务未完成时返回 `400 invalid_request_error`。
- 找不到任务时返回 `404 invalid_request_error`。
- 服务端从上游真实视频 URL 拉取内容，再把二进制流返回给调用方。
- 调用方不会看到上游真实 URL。
- 返回时透传安全的视频响应头，如 `Content-Type`、`Content-Length`、`Accept-Ranges`、`Content-Disposition`、`ETag`、`Last-Modified` 等。
- 响应包含 `Cache-Control: public, max-age=86400`。
- 该接口有按客户端 IP 的下载限流，触发时返回 `429` 空响应体或网关层限流响应。

### 7.2 curl 示例

```bash
curl -L https://router.flatkey.ai/v1/videos/task_1234567890abcdef1234567890abcdef/content \
  -o output.mp4
```

## 8. 错误响应

### 8.1 素材接口错误 envelope

`POST /v1/assets` 和 `GET /v1/assets/{asset_id}` 的业务错误使用 OpenAI 兼容 envelope：

```json
{
  "error": {
    "message": "Asset is still processing, please try again later",
    "type": "asset_not_ready",
    "param": "",
    "code": "asset_not_ready"
  }
}
```

### 8.2 视频提交阶段素材错误 envelope

`POST /v1/videos` 在渠道分发阶段发现素材错误时，返回中间件的 OpenAI 兼容 envelope：

```json
{
  "error": {
    "message": "asset is not ready",
    "type": "new_api_error",
    "code": "asset_not_ready"
  }
}
```

不同入口的 `type` 可能不同，调用方应优先使用 `error.code` 和 HTTP 状态码判断稳定错误类型。

### 8.3 视频任务错误 envelope

`POST /v1/videos` 在任务处理链路返回 `dto.TaskError` 时，响应通常是顶层任务错误：

```json
{
  "code": "invalid_request",
  "message": "seedance request requires a text prompt or at least one image/video",
  "status_code": 400
}
```

### 8.4 稳定素材错误码

| HTTP | `code` | 场景 | 是否建议重试 |
| ---: | --- | --- | --- |
| 400 | `invalid_asset_request` | JSON 非法、缺少字段、`asset_type` 非法、`moderation.strategy` 非法、素材源 URL 非法、`asset://` URI 不符合严格格式、素材类型与媒体容器不匹配。 | 修正请求后重试。 |
| 401 | `invalid_request` 或空 | Token 缺失、过期或无效。部分纯限流/代理路径可能只有状态码。 | 更换有效 Token 后重试。 |
| 403 | `access_denied` | Token 无权访问 `seedance-2.0`、Token 禁用、用户禁用、IP 限制不通过、余额/额度不可用等。 | 修正权限或账户状态后重试。 |
| 404 | `asset_not_found` | 素材不存在，或素材不属于当前用户。 | 不要继续轮询同一素材 ID。 |
| 409 | `asset_not_ready` | 素材仍在 `Creating` / `Processing`，或 `Active` 但上游 ID 尚未可用。 | 可继续轮询。 |
| 409 | `asset_channel_conflict` | 同一视频请求引用了不同渠道的素材，或指定渠道与素材固定渠道不一致。 | 修改素材组合或指定渠道后重试。 |
| 422 | `asset_failed` | 素材处理失败。 | 重新创建素材。 |
| 429 | `get_channel_failed`、`channel_concurrency_limit_exceeded` 或空 | 全局 API 限流、模型级限流、渠道并发限流、下载限流。 | 等待后重试。 |
| 500 | `asset_storage_error` | Flatkey 存储读写错误。 | 稍后重试；持续出现需联系平台方。 |
| 502 | `asset_upstream_error` | 素材服务或上游请求失败、上游响应异常。 | 稍后重试；必要时重新创建素材。 |
| 503 | `asset_channel_unavailable` | 无可用 BytePlus 素材渠道、固定渠道不可用、凭据不可用。 | 等待平台修复或切换可用配置。 |
| 503 | `asset_group_initializing` | 用户与渠道对应的素材组正在初始化。 | 稍后重试。 |

## 9. Python 示例

以下示例只使用占位符，不包含真实凭据。运行前设置环境变量：

```bash
export FLATKEY_BASE_URL="https://router.flatkey.ai"
export FLATKEY_API_KEY="<FLATKEY_API_KEY>"
export ASSET_SOURCE_URL="https://cdn.example.com/reference/portrait.mp4"
```

### 9.1 创建素材并轮询到 Active

```python
import os
import time
import requests

base_url = os.environ["FLATKEY_BASE_URL"].rstrip("/")
api_key = os.environ["FLATKEY_API_KEY"]
source_url = os.environ["ASSET_SOURCE_URL"]

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

create_resp = requests.post(
    f"{base_url}/v1/assets",
    headers=headers,
    json={
        "url": source_url,
        "asset_type": "Video",
        "moderation": {"strategy": "Default"},
    },
    timeout=30,
)
create_resp.raise_for_status()
asset = create_resp.json()
asset_id = asset["id"]
print("asset_id =", asset_id, "status =", asset["status"])

deadline = time.time() + 600
while time.time() < deadline:
    get_resp = requests.get(
        f"{base_url}/v1/assets/{asset_id}",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    )
    if get_resp.status_code == 409:
        print("asset is not ready; polling again")
        time.sleep(5)
        continue
    get_resp.raise_for_status()
    asset = get_resp.json()
    print("asset status =", asset["status"])
    if asset["status"] == "Active":
        break
    time.sleep(5)
else:
    raise TimeoutError(f"asset {asset_id} did not become Active")
```

### 9.2 使用素材提交视频并下载结果

```python
import os
import time
from pathlib import Path
import requests

base_url = os.environ["FLATKEY_BASE_URL"].rstrip("/")
api_key = os.environ["FLATKEY_API_KEY"]
asset_id = os.environ["FLATKEY_ASSET_ID"]

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

submit_resp = requests.post(
    f"{base_url}/v1/videos",
    headers=headers,
    json={
        "model": "seedance-2.0",
        "content": [
            {
                "type": "video_url",
                "video_url": {"url": f"asset://{asset_id}"},
                "role": "reference_video",
            },
            {
                "type": "text",
                "text": "A cinematic product shot with smooth camera motion",
            },
        ],
        "resolution": "1080p",
        "ratio": "16:9",
        "duration": 5,
    },
    timeout=60,
)
submit_resp.raise_for_status()
task = submit_resp.json()
task_id = task["id"]
print("task_id =", task_id)

deadline = time.time() + 1800
while time.time() < deadline:
    poll_resp = requests.get(
        f"{base_url}/v1/videos/{task_id}",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    )
    poll_resp.raise_for_status()
    task = poll_resp.json()
    print("video status =", task["status"], "progress =", task.get("progress"))
    if task["status"] == "completed":
        break
    if task["status"] == "failed":
        raise RuntimeError(task.get("error") or task)
    time.sleep(10)
else:
    raise TimeoutError(f"video task {task_id} did not complete")

content_url = task.get("metadata", {}).get("url") or f"{base_url}/v1/videos/{task_id}/content"
video_resp = requests.get(content_url, timeout=120)
video_resp.raise_for_status()
Path("output.mp4").write_bytes(video_resp.content)
print("saved output.mp4")
```

## 10. Node.js 示例

以下示例使用 Node.js 18+ 内置 `fetch`。运行前设置环境变量：

```bash
export FLATKEY_BASE_URL="https://router.flatkey.ai"
export FLATKEY_API_KEY="<FLATKEY_API_KEY>"
export ASSET_SOURCE_URL="https://cdn.example.com/reference/portrait.mp4"
```

### 10.1 创建素材、提交视频、下载结果

```javascript
import { writeFile } from "node:fs/promises";

const baseUrl = process.env.FLATKEY_BASE_URL.replace(/\/$/, "");
const apiKey = process.env.FLATKEY_API_KEY;
const sourceUrl = process.env.ASSET_SOURCE_URL;

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function waitForAsset(assetId) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/v1/assets/${assetId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 409) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }
    const asset = await response.json();
    if (!response.ok) {
      throw new Error(`${response.status} ${JSON.stringify(asset)}`);
    }
    if (asset.status === "Active") {
      return asset;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`asset ${assetId} did not become Active`);
}

async function waitForVideo(taskId) {
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    const task = await requestJson(`/v1/videos/${taskId}`, { method: "GET" });
    if (task.status === "completed") {
      return task;
    }
    if (task.status === "failed") {
      throw new Error(JSON.stringify(task.error || task));
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw new Error(`video task ${taskId} did not complete`);
}

const asset = await requestJson("/v1/assets", {
  method: "POST",
  body: JSON.stringify({
    url: sourceUrl,
    asset_type: "Video",
    moderation: { strategy: "Default" },
  }),
});

await waitForAsset(asset.id);

const task = await requestJson("/v1/videos", {
  method: "POST",
  body: JSON.stringify({
    model: "seedance-2.0",
    content: [
      {
        type: "video_url",
        video_url: { url: `asset://${asset.id}` },
        role: "reference_video",
      },
      {
        type: "text",
        text: "A cinematic product shot with smooth camera motion",
      },
    ],
    resolution: "1080p",
    ratio: "16:9",
    duration: 5,
  }),
});

const completed = await waitForVideo(task.id);
const contentUrl = completed.metadata?.url ?? `${baseUrl}/v1/videos/${task.id}/content`;
const video = await fetch(contentUrl);
if (!video.ok) {
  throw new Error(`download failed: ${video.status}`);
}
await writeFile("output.mp4", Buffer.from(await video.arrayBuffer()));
console.log("saved output.mp4");
```

## 11. 完整端到端脚本

该脚本演示“创建素材 -> 轮询素材 -> 提交视频 -> 轮询视频 -> 下载 MP4”的完整流程。它不会内置任何真实密钥。

保存为 `byteplus_asset_e2e.py` 后运行：

```bash
FLATKEY_BASE_URL="https://router.flatkey.ai" \
FLATKEY_API_KEY="<FLATKEY_API_KEY>" \
ASSET_SOURCE_URL="https://cdn.example.com/reference/portrait.mp4" \
python byteplus_asset_e2e.py
```

脚本内容：

```python
import os
import time
from pathlib import Path
import requests


BASE_URL = os.environ["FLATKEY_BASE_URL"].rstrip("/")
API_KEY = os.environ["FLATKEY_API_KEY"]
ASSET_SOURCE_URL = os.environ["ASSET_SOURCE_URL"]
OUTPUT_PATH = Path(os.environ.get("OUTPUT_PATH", "output.mp4"))


def auth_headers(content_type=True):
    headers = {"Authorization": f"Bearer {API_KEY}"}
    if content_type:
        headers["Content-Type"] = "application/json"
    return headers


def raise_api_error(response):
    if response.ok:
        return
    try:
        detail = response.json()
    except ValueError:
        detail = response.text
    raise RuntimeError(f"HTTP {response.status_code}: {detail}")


def create_asset():
    response = requests.post(
        f"{BASE_URL}/v1/assets",
        headers=auth_headers(),
        json={
            "url": ASSET_SOURCE_URL,
            "asset_type": "Video",
            "moderation": {"strategy": "Default"},
        },
        timeout=30,
    )
    raise_api_error(response)
    return response.json()


def wait_for_asset(asset_id, timeout_seconds=600):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        response = requests.get(
            f"{BASE_URL}/v1/assets/{asset_id}",
            headers=auth_headers(content_type=False),
            timeout=30,
        )
        if response.status_code == 409:
            print("asset processing; waiting")
            time.sleep(5)
            continue
        raise_api_error(response)
        asset = response.json()
        print("asset status:", asset["status"])
        if asset["status"] == "Active":
            return asset
        time.sleep(5)
    raise TimeoutError(f"asset {asset_id} did not become Active")


def submit_video(asset_id):
    response = requests.post(
        f"{BASE_URL}/v1/videos",
        headers=auth_headers(),
        json={
            "model": "seedance-2.0",
            "content": [
                {
                    "type": "video_url",
                    "video_url": {"url": f"asset://{asset_id}"},
                    "role": "reference_video",
                },
                {
                    "type": "text",
                    "text": "A polished studio video with smooth camera movement",
                },
            ],
            "resolution": "1080p",
            "ratio": "16:9",
            "duration": 5,
        },
        timeout=60,
    )
    raise_api_error(response)
    return response.json()


def wait_for_video(task_id, timeout_seconds=1800):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        response = requests.get(
            f"{BASE_URL}/v1/videos/{task_id}",
            headers=auth_headers(content_type=False),
            timeout=30,
        )
        raise_api_error(response)
        task = response.json()
        print("video status:", task["status"], "progress:", task.get("progress"))
        if task["status"] == "completed":
            return task
        if task["status"] == "failed":
            raise RuntimeError(task.get("error") or task)
        time.sleep(10)
    raise TimeoutError(f"video task {task_id} did not complete")


def download_video(task):
    task_id = task["id"]
    content_url = task.get("metadata", {}).get("url")
    if not content_url:
        content_url = f"{BASE_URL}/v1/videos/{task_id}/content"
    response = requests.get(content_url, timeout=120)
    raise_api_error(response)
    OUTPUT_PATH.write_bytes(response.content)
    return OUTPUT_PATH


def main():
    asset = create_asset()
    print("created asset:", asset["id"])
    wait_for_asset(asset["id"])
    task = submit_video(asset["id"])
    print("created video task:", task["id"])
    completed = wait_for_video(task["id"])
    output = download_video(completed)
    print("saved:", output)


if __name__ == "__main__":
    main()
```

## 12. 调用方检查清单

- 使用 Flatkey API Token，不要发送上游供应商密钥。
- 如果 Token 开启模型白名单，确认允许 `seedance-2.0`。
- 创建素材时使用公网 HTTPS URL。
- 等素材变为 `Active` 后再提交视频任务。
- `asset://` URI 必须严格匹配 `asset://ast_<32 位字母数字>`。
- `Image` 素材放入 `image_url.url`，`Video` 素材放入 `video_url.url`，`Audio` 素材放入 `audio_url.url`。
- 同一个视频请求中的所有素材必须来自同一渠道。
- 真人素材引用最多来自一个真人档案；同一真人档案下的多个真人素材可以混用，同渠道虚拟素材也可以和这一个真人档案混用。
- 真人素材 DELETE 会立即进入 `Deleting`，新的引用立即拒绝；重复 DELETE 返回空 `204`。
- 使用 `GET /v1/videos/{task_id}` 轮询，完成后从 `metadata.url` 或 `/v1/videos/{task_id}/content` 下载。
- 旧版虚拟素材 `POST /v1/assets` 不要求幂等键；真人素材写入必须提供幂等键。
