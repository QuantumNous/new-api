# Seedance 素材组 / 素材管理 API — 用户说明

本文档面向持有平台 API Key（`sk-` 令牌）的调用方，说明如何管理 Seedance **素材组**、**素材**以及完成**真人活体认证**。

视频生成（文生 / 图生）请另见站内 Seedance 视频接口文档；成片任务仍使用：

- `POST /v1/video/generations`
- `GET /v1/video/generations/{task_id}`

素材就绪后，将返回的 `asset_uri`（形如 `asset://asset-xxx`）填入生成请求的 `content` 即可。

---

## 1. 基本信息

| 项目 | 说明 |
|------|------|
| Base URL | `https://sd2.ffir.cn` |
| 认证 | 请求头 `Authorization: Bearer sk-xxxxxxxx` |
| 响应格式 | `{ "success": true/false, "message": "", "data": ..., "code"? }` |
| 租户隔离 | 每个 API Key 对应账号**只能看到/操作自己的**素材组与素材 |

**建议先设置环境变量：**

```bash
export BASE="https://sd2.ffir.cn"
export TOKEN="sk-你的令牌"
```

---

## 2. 接口一览（12 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/seedance/asset-groups` | 创建素材组（仅 AIGC） |
| `POST` | `/api/seedance/asset-groups/query` | 查询本人素材组列表 |
| `GET` | `/api/seedance/asset-groups/{group_id}` | 查询单个素材组 |
| `PATCH` | `/api/seedance/asset-groups/{group_id}` | 更新素材组名称/描述 |
| `DELETE` | `/api/seedance/asset-groups/{group_id}` | 删除素材组 |
| `POST` | `/api/seedance/assets` | 远程公网 URL 资产认证 |
| `POST` | `/api/seedance/assets/query` | 查询本人素材列表 |
| `GET` | `/api/seedance/assets/{id}` | 查询素材状态 |
| `PATCH` | `/api/seedance/assets/{id}` | 更新素材名称 |
| `DELETE` | `/api/seedance/assets/{id}` | 删除素材 |
| `POST` | `/api/seedance/real-person-auth/sessions` | 生成真人认证 H5 链接 |
| `POST` | `/api/seedance/real-person-auth/asset-group` | bytedToken 换真人素材组 |

> 本地文件上传接口如有开放，见站方另行说明；本文档覆盖以上管理类接口。

**建议使用顺序（虚拟人参考图）：**

```text
创建素材组（可选）→ 远程 URL 认证 →（可选）轮询素材 active → 创建视频任务
```

**真人参考图：**

```text
创建认证会话 → 手机打开 h5_link 完成活体
  → bytedToken 换 group_id
  → 带 group_id 做远程认证 / 上传
  → 素材 active 后用于视频生成
```

---

## 3. 素材组

### 3.1 创建素材组

仅支持创建 **AIGC**（虚拟人）组。真人组必须走「真人认证」流程，不能手动创建 `LivenessFace`。

**请求**

```http
POST /api/seedance/asset-groups
Authorization: Bearer sk-你的令牌
Content-Type: application/json
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `group_name` | string | 否 | 组名；也可用 `groupName` / `name` |
| `description` | string | 否 | 描述 |
| `group_type` | string | 否 | 仅支持 `AIGC`（默认） |

```bash
curl -s -X POST "$BASE/api/seedance/asset-groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group_name":"my-aigc","description":"品牌素材"}'
```

**成功响应示例（HTTP 200）**

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "group_id": "group-20260715151913-fc4hn",
    "group_type": "AIGC",
    "group_name": "my-aigc",
    "description": "品牌素材",
    "status": "active",
    "created_at": 1784099959,
    "updated_at": 1784099959
  }
}
```

请保存 `data.group_id`：

```bash
export GROUP_ID="group-20260715151913-fc4hn"
```

---

### 3.2 查询素材组列表

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page_no` | number | 否 | 页码，默认 1 |
| `page_size` | number | 否 | 每页条数，默认 20，最大 100 |
| `group_type` | string | 否 | `AIGC` / `LivenessFace` |
| `group_ids` | string[] | 否 | 按 ID 过滤 |

```bash
curl -s -X POST "$BASE/api/seedance/asset-groups/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page_no":1,"page_size":20}'
```

**成功响应示例**

```json
{
  "success": true,
  "message": "",
  "data": {
    "list": [
      {
        "id": 1,
        "group_id": "group-20260715151913-fc4hn",
        "group_type": "AIGC",
        "group_name": "my-aigc",
        "description": "品牌素材",
        "status": "active",
        "created_at": 1784099959,
        "updated_at": 1784099959
      }
    ],
    "total": 1,
    "page_no": 1,
    "page_size": 20
  }
}
```

只返回**当前账号**名下的组，不会看到其他客户的资源。

---

### 3.3 查询单个素材组

```bash
curl -s "$BASE/api/seedance/asset-groups/$GROUP_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**成功响应：**与创建时 `data` 结构相同。

**失败示例（他人资源或不存在，HTTP 404）**

```json
{
  "success": false,
  "message": "素材组不存在",
  "code": "group_not_found",
  "data": null
}
```

---

### 3.4 更新素材组

```bash
curl -s -X PATCH "$BASE/api/seedance/asset-groups/$GROUP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group_name":"my-aigc-renamed","description":"已更新"}'
```

**成功响应示例**

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "group_id": "group-20260715151913-fc4hn",
    "group_type": "AIGC",
    "group_name": "my-aigc-renamed",
    "description": "已更新",
    "status": "active",
    "created_at": 1784099959,
    "updated_at": 1784099961
  }
}
```

---

### 3.5 删除素材组

```bash
curl -s -X DELETE "$BASE/api/seedance/asset-groups/$GROUP_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**成功响应示例**

```json
{
  "success": true,
  "message": "",
  "data": {
    "group_id": "group-20260715151913-fc4hn",
    "deleted": true
  }
}
```

---

## 4. 素材

### 4.1 远程 URL 资产认证

当你已有**公网可直链访问**的图片/视频/音频地址时，可直接提交认证，无需再传文件。

**要求：**`url` 须为上游可访问的公网直链（建议 `https://`），不能是本机路径、内网地址或需登录的私有链接。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 公网直链（也可用 `assetUrl`） |
| `type` | string | 否 | `image`（默认）/ `video` / `audio` |
| `name` | string | 否 | 素材名称 |
| `group_id` | string | 否 | 本人素材组；不传则使用平台默认 AIGC 组 |

```bash
curl -s -X POST "$BASE/api/seedance/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/path/ref.jpg",
    "type": "image",
    "name": "ref-1",
    "group_id": "group-20260715151913-fc4hn"
  }'
```

**成功响应示例（HTTP 200）**

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "asset_id": 1,
    "aicc_asset_id": "asset-20260715151920-nxq85",
    "aicc_group_id": "group-20260715151913-fc4hn",
    "group_id": "group-20260715151913-fc4hn",
    "filename": "ref-1",
    "type": "image",
    "status": "processing",
    "url": "https://example.com/path/ref.jpg",
    "asset_uri": "asset://asset-20260715151920-nxq85",
    "error_message": "",
    "created_at": 1784099966,
    "updated_at": 1784099966
  }
}
```

拿到 `assetId` 后通常先返回 `processing`；请用查询接口等到 `active` 后再用于稳定出片（创建视频时部分场景平台也会等待就绪）。

请保存：

```bash
export ASSET_ID="1"
# 或使用上游 ID
export ASSET_ID="asset-20260715151920-nxq85"
export ASSET_URI="asset://asset-20260715151920-nxq85"
```

**使用他人 `group_id`（HTTP 403）**

```json
{
  "success": false,
  "message": "素材组不存在或无权使用",
  "code": "group_forbidden",
  "data": null
}
```

---

### 4.2 查询素材列表

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page_no` | number | 否 | 默认 1 |
| `page_size` | number | 否 | 默认 20，最大 100 |
| `group_id` | string | 否 | 按素材组过滤 |
| `group_ids` | string[] | 否 | 多组过滤 |
| `type` | string | 否 | `image` / `video` / `audio` |
| `status` | string | 否 | `uploaded` / `processing` / `active` / `failed` |
| `statuses` | string[] | 否 | 多状态 |

```bash
curl -s -X POST "$BASE/api/seedance/assets/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page_no":1,"page_size":20,"status":"active"}'
```

**成功响应示例**

```json
{
  "success": true,
  "message": "",
  "data": {
    "list": [
      {
        "id": 1,
        "asset_id": 1,
        "aicc_asset_id": "asset-20260715151920-nxq85",
        "group_id": "group-20260715151913-fc4hn",
        "filename": "ref-1",
        "type": "image",
        "status": "active",
        "url": "https://example.com/path/ref.jpg",
        "asset_uri": "asset://asset-20260715151920-nxq85",
        "error_message": ""
      }
    ],
    "total": 1,
    "page_no": 1,
    "page_size": 20
  }
}
```

---

### 4.3 查询单个素材

`{id}` 可为本地数字 `asset_id`，或上游 `aicc_asset_id`。

```bash
curl -s "$BASE/api/seedance/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**成功响应示例（已就绪）**

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "asset_id": 1,
    "aicc_asset_id": "asset-20260715151920-nxq85",
    "group_id": "group-20260715151913-fc4hn",
    "filename": "ref-1",
    "type": "image",
    "status": "active",
    "url": "https://example.com/path/ref.jpg",
    "asset_uri": "asset://asset-20260715151920-nxq85",
    "error_message": ""
  }
}
```

| `status` | 含义 |
|----------|------|
| `processing` | 认证处理中 |
| `active` | 可用 |
| `failed` | 失败，见 `error_message` |

他人素材或不存在 → HTTP **404**，`code=asset_not_found`。

---

### 4.4 更新素材名称

```bash
curl -s -X PATCH "$BASE/api/seedance/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"ref-face-1.jpg"}'
```

也可传 `name`。成功时 `data` 中 `filename` 已更新。

---

### 4.5 删除素材

```bash
curl -s -X DELETE "$BASE/api/seedance/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**成功响应示例**

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "aicc_asset_id": "asset-20260715151920-nxq85",
    "deleted": true
  }
}
```

---

## 5. 真人认证（LivenessFace）

真人参考图必须先完成**活体认证**，再使用返回的 `group_id` 上传/认证素材。

### 5.1 创建真人认证 H5 会话

```bash
curl -s -X POST "$BASE/api/seedance/real-person-auth/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**成功响应示例**

```json
{
  "success": true,
  "message": "",
  "data": {
    "byted_token": "20260715xxxxxxxx",
    "h5_link": "https://ark.volcengine.com/.../authorization?...",
    "expires_in": 120
  }
}
```

1. 将 `h5_link` 发给用户，建议**手机浏览器**打开并完成活体。  
2. **本地保存** `byted_token`（有时效，见 `expires_in` 秒）。  
3. 用户完成后，调用下一接口换取 `group_id`（可短间隔轮询）。

```bash
export BYTED_TOKEN="20260715xxxxxxxx"
```

---

### 5.2 bytedToken 换真人素材组

```bash
curl -s -X POST "$BASE/api/seedance/real-person-auth/asset-group" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"byted_token":"'"$BYTED_TOKEN"'"}'
```

**成功响应示例**

```json
{
  "success": true,
  "message": "",
  "data": {
    "group_id": "group-xxxxx",
    "group_type": "LivenessFace"
  }
}
```

成功后该 `group_id` 会绑定到**当前 API Key 对应账号**，可出现在素材组列表中；其他客户无法使用。

未完成活体或 token 无效时，可能返回 HTTP **400/404**，例如：

```json
{
  "success": false,
  "message": "素材库接口失败: HTTP 400 素材组不存在或Token无效",
  "code": "upstream_error",
  "data": null
}
```

换到 `group_id` 后，按 **§4.1** 带上该字段提交人脸参考图；待素材 `active` 后即可用于视频生成。

---

## 6. 与视频生成的衔接（示例）

素材 `status == active` 后：

```bash
curl -s -X POST "$BASE/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seedance-2.0",
    "content": [
      {
        "type": "text",
        "text": "人物对着镜头自然微笑，镜头缓慢推进"
      },
      {
        "type": "image_url",
        "image_url": { "url": "asset://asset-20260715151920-nxq85" },
        "role": "reference_image"
      }
    ],
    "ratio": "16:9",
    "resolution": "720p",
    "duration": 5,
    "watermark": false
  }'
```

再用 `GET /v1/video/generations/{task_id}` 轮询至成功后下载成片。

---

## 7. 常见错误码

| HTTP | code | 说明 |
|------|------|------|
| 401 | — | 令牌无效或未传 `Authorization` |
| 403 | `group_forbidden` | 使用了不属于你的 `group_id` |
| 404 | `group_not_found` | 素材组不存在或不属于你 |
| 404 | `asset_not_found` | 素材不存在或不属于你 |
| 400 | `invalid_url` / `invalid_token` 等 | 参数缺失或非法 |
| 502/400 | `upstream_error` | 上游素材库返回失败 |
| 503 | `gateway_not_configured` | 平台侧素材网关未就绪（请联系服务方） |

---

## 8. 注意事项

1. **隔离：**列表与详情只返回本账号资源；不要使用他人泄露的 `group_id` / `asset_id`。  
2. **公网 URL：**远程认证的图片必须对上游可达。  
3. **状态：**优先等 `active` 再出片；`failed` 时查看 `error_message`（真人素材常见为人脸不一致）。  
4. **真人：**会话有时效；过期需重新创建 sessions。  
5. **计费：**素材管理接口本身是否计费以服务方约定为准；视频生成按模型/时长等另行扣费。

---

## 9. 联系与支持

- **API Base URL：**`https://sd2.ffir.cn`  
- **API Key：**由服务方发放（`sk-` 开头）  
- 排查问题时请提供：请求路径、大致时间、`group_id` / `aicc_asset_id` / `task_id`（如有）

*文档版本：2026-07-15 · 面向客户*
