# Flatkey 真人素材库 API

Base URL: `https://router.flatkey.ai`

真人素材库让同一个 Flatkey API key / 用户创建多个彼此独立的真人档案。每个档案先完成 BytePlus 真人认证，再把图片、视频或音频登记为该真人的可复用素材。客户只使用 Flatkey 的 `rph_...`、`ast_...` 和 `asset://ast_...`，不需要 BytePlus/TOS 凭证、GroupId、上游 AssetId、回调密文或对象存储地址。`asset://ast_...` 是 Flatkey 公开的本地 URI，服务端会在调用上游前改写为上游需要的素材引用；它不是 BytePlus 文档中的通用 `asset://<Asset_Id>` 前缀。

## 权限与幂等

所有客户写入和查询接口使用：

```http
Authorization: Bearer <FLATKEY_API_KEY>
```

Token 必须可访问 `seedance-2.0`。如果 Token 开启模型白名单，白名单必须包含 `seedance-2.0`。

`POST /v1/real-persons`、`POST /v1/real-persons/{person_id}/verification-sessions`、`POST /v1/real-persons/{person_id}/assets` 都必须带 `Idempotency-Key`，长度 1 到 255。相同 key 与相同请求会返回同一个结果；相同 key 配不同请求返回 `409 idempotency_conflict`。如果 Flatkey 已经把请求提交到上游但结果未知，会返回 `502 idempotency_outcome_unknown`；此时继续用同一个 key 重试，不能换 key 触发第二次上游创建。

## 端点概览

| 方法与路径 | 说明 |
| --- | --- |
| `POST /v1/real-persons` | 创建真人档案并返回一次性认证链接 |
| `POST /v1/real-persons/{person_id}/verification-sessions` | 重新发起真人认证 |
| `GET /v1/real-persons` | 分页列出真人档案 |
| `GET /v1/real-persons/{person_id}` | 查询真人档案 |
| `POST /v1/real-persons/{person_id}/assets` | 用 HTTPS URL 或本地文件创建真人素材 |
| `GET /v1/real-persons/{person_id}/assets` | 分页列出某个真人档案的素材 |
| `GET /v1/assets/{asset_id}` | 查询单个素材 |
| `DELETE /v1/assets/{asset_id}` | 删除真人素材 |

## 创建真人档案

```bash
curl -sS https://router.flatkey.ai/v1/real-persons \
  -H "Authorization: Bearer <FLATKEY_API_KEY>" \
  -H "Idempotency-Key: person-create-20260801-001" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ava Chen"}'
```

```json
{
  "id": "rph_1234567890abcdef",
  "object": "real_person",
  "name": "Ava Chen",
  "status": "pending_verification",
  "verification_url": "https://verify.example.com/session/placeholder",
  "verification_expires_at": 1785293800,
  "created_at": 1785292000
}
```

把 `verification_url` 发给真人本人，在 30 分钟内完成 BytePlus 认证。该链接只在创建和重新认证的安全重放响应中出现；`GET /v1/real-persons` 和 `GET /v1/real-persons/{person_id}` 不返回链接。

状态：`pending_verification`、`verifying`、`active`、`failed`、`expired`。只有 `active` 档案可以创建可用真人素材。

重新认证：

```bash
curl -sS https://router.flatkey.ai/v1/real-persons/rph_1234567890abcdef/verification-sessions \
  -X POST \
  -H "Authorization: Bearer <FLATKEY_API_KEY>" \
  -H "Idempotency-Key: person-reverify-20260801-001"
```

## 创建真人素材

### HTTPS URL

```bash
curl -sS https://router.flatkey.ai/v1/real-persons/rph_1234567890abcdef/assets \
  -H "Authorization: Bearer <FLATKEY_API_KEY>" \
  -H "Idempotency-Key: asset-url-20260801-001" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cdn.example.com/reference/ava-front.mp4",
    "asset_type": "Video",
    "name": "front-facing intro"
  }'
```

URL 必须是公网 HTTPS，不能是 `localhost`、内网地址、需要登录的地址、带 user info 的地址，且会经过服务端 SSRF / fetch 策略校验。

### 本地文件

客户不需要先准备公网 URL，可以直接用 `multipart/form-data` 上传本地文件：

```bash
curl -sS https://router.flatkey.ai/v1/real-persons/rph_1234567890abcdef/assets \
  -H "Authorization: Bearer <FLATKEY_API_KEY>" \
  -H "Idempotency-Key: asset-file-20260801-001" \
  -F "asset_type=Image" \
  -F "name=portrait" \
  -F "file=@./portrait.png"
```

Flatkey 流式写入同区域私有 TOS bucket，不落应用磁盘，不整文件缓冲，不向客户返回签名 URL。

Flatkey-enforced local limits：

| 类型 | 格式 | 大小 |
| --- | --- | --- |
| Image | JPEG、PNG、WebP、BMP、TIFF、GIF、HEIC、HEIF | 严格 <30 MiB |
| Video | MP4、MOV | <=50 MiB |
| Audio | MP3、WAV | <=15 MiB |

总请求硬上限为 50 MiB，加 1 MiB 表单 envelope。超过大小返回 `413`，格式或容器不匹配返回 `415`。

响应示例：

```json
{
  "id": "ast_1234567890abcdef1234567890abcdef",
  "object": "asset",
  "asset_type": "Video",
  "status": "Processing",
  "name": "front-facing intro",
  "asset_uri": "asset://ast_1234567890abcdef1234567890abcdef",
  "created_at": 1785292000
}
```

轮询 `GET /v1/assets/{asset_id}` 或分页查询 `GET /v1/real-persons/{person_id}/assets?limit=20&after=...`。分页按稳定创建顺序返回，`Deleted` 素材隐藏。`Processing`、`Failed`、`Deleting`、`Deleted` 和真人档案非 `active` 时都不能用于视频生成。

## 在 Seedance 中引用

`seedance-2.0` 的 `POST /v1/videos` `content[]` 可以使用 Flatkey 本地 `asset://ast_...`。同一个真人档案可以同时引用多张图片、视频和音频；同一渠道创建的虚拟素材也可以与一个真人档案混用。一次请求里如果出现两个非空真人档案集合，Flatkey 会在调用上游前返回 `409 asset_profile_conflict`。这是 Flatkey 的预上游安全和路由规则，不声明为 BytePlus 的显式限制。媒体容器必须和素材类型匹配，例如 Image 放 `image_url`，Audio 放 `audio_url`。

```json
{
  "model": "seedance-2.0",
  "content": [
    {
      "type": "text",
      "text": "让同一个真人在办公室介绍新产品，口型跟随参考音频。"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "asset://ast_1234567890abcdef1234567890abcdef",
        "role": "reference_image"
      }
    },
    {
      "type": "audio_url",
      "audio_url": {
        "url": "asset://ast_abcdef1234567890abcdef1234567890",
        "role": "reference_audio"
      }
    }
  ]
}
```

## 删除真人素材

```bash
curl -sS -X DELETE https://router.flatkey.ai/v1/assets/ast_1234567890abcdef1234567890abcdef \
  -H "Authorization: Bearer <FLATKEY_API_KEY>" \
  -i
```

删除采用 tombstone-first：素材立即进入 `Deleting`，新的引用立即被拒绝；第一次和重复 DELETE 都返回空 `204`。后台异步做物理删除，非本用户素材按 `404` 处理。

## 稳定错误

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `invalid_real_person_request`、`invalid_asset_request`、`invalid_asset_reference` | 参数、URI、分页、容器类型或请求体错误 |
| 403 | `access_denied` | Token、用户、模型权限、余额或 IP 限制不满足 |
| 404 | `real_person_not_found`、`asset_not_found` | 档案或素材不存在，或不属于当前用户 |
| 409 | `real_person_not_active`、`verification_in_progress`、`idempotency_conflict`、`asset_profile_conflict` | 状态冲突、幂等冲突、一次视频请求引用多个真人档案 |
| 413 | `asset_file_too_large` | 文件或请求超过限制 |
| 415 | `asset_media_unsupported` | 文件格式或容器不支持 |
| 500 | `asset_storage_error` | Flatkey 存储或状态持久化失败 |
| 502 | `asset_upstream_error`、`idempotency_outcome_unknown` | 上游失败或幂等结果未知 |
| 503 | `asset_channel_unavailable` | 可用渠道不存在或暂不可用 |

## 安全边界

客户 API、响应示例和普通日志不得暴露 BytedToken、callback/H5 ciphertext、GroupId、上游 ID、项目名、TOS URL、对象 key、access key 或 secret key。BytePlus 回调文档展示了带 `resultCode` 的 CallbackURL，但没有限定 HTTP method；Flatkey 为兼容性同时接受 GET 和 POST，统一返回 `204`，只作为唤醒信号，不信任 `resultCode` 作为认证权威。Flatkey 服务端只通过 GetVisualValidateResult 拉取权威状态。签名 URL 只在内存中短暂使用，清理任务进入 outbox；如果回调丢失，24 小时生命周期兜底任务会继续收敛状态。

发布证据与上线检查见 [byteplus-real-person-release-checklist.md](./byteplus-real-person-release-checklist.md)。
