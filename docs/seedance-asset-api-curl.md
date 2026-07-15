# Seedance 素材管理 API — 本地联调 curl

本文档覆盖 new-api 已实现的 **12 个** `/api/seedance/*` 接口（**不含** `POST /api/seedance/upload`）。

设计说明见：`docs/superpowers/specs/2026-07-15-seedance-asset-apis-design.md`  
对外契约对齐：[customer-api §12](https://s.83zi.com/docs/customer-api.md)

---

## 0. 启用前检查

1. 运营设置 → **Seedance 素材网关**：打开启用，填写网关**渠道 ID**（该渠道 Base URL 指向 83zi，Key 为上游 `sk-`）。
2. 用客户令牌（`sk-...`）调用本站接口。
3. 未启用或未配渠道 → HTTP **503**，`code=gateway_not_configured`。

---

## 1. 环境变量

**bash / Git Bash / WSL：**

```bash
export BASE="http://127.0.0.1:3000"
export TOKEN="sk-你的令牌"
```

**PowerShell：**

```powershell
$BASE = "http://127.0.0.1:3000"
$TOKEN = "sk-你的令牌"
```

下文以 bash 为例；PowerShell 把 `"$BASE"` / `"$TOKEN"` 换成 `$BASE` / `$TOKEN` 即可。

---

## 2. 建议联调顺序

```text
创建素材组 → 列表 → 详情 → 更新
  → 远程 URL 认证 → 素材列表 → 素材详情 → 更新素材
  → （可选）真人会话 → 换 group_id
  → 删除素材 → 删除素材组
```

---

## 3. 素材组（5 个）

### 3.1 创建素材组

```bash
curl -s -X POST "$BASE/api/seedance/asset-groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group_name":"local-test-aigc","description":"本地联调"}'
```

保存返回的 `data.group_id`：

```bash
export GROUP_ID="group-xxxxx"
```

### 3.2 查询素材组列表

```bash
curl -s -X POST "$BASE/api/seedance/asset-groups/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page_no":1,"page_size":20}'
```

可选过滤：`group_type`（`AIGC` / `LivenessFace`）、`group_ids`。

### 3.3 查询单个素材组

```bash
curl -s "$BASE/api/seedance/asset-groups/$GROUP_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### 3.4 更新素材组

```bash
curl -s -X PATCH "$BASE/api/seedance/asset-groups/$GROUP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group_name":"local-test-aigc-renamed","description":"已更新"}'
```

### 3.5 删除素材组

```bash
curl -s -X DELETE "$BASE/api/seedance/asset-groups/$GROUP_ID" \
  -H "Authorization: Bearer $TOKEN"
```

> 联调时建议放在整套流程**最后**再删。

---

## 4. 素材（5 个）

### 4.1 远程 URL 认证（创建素材）

`url` 必须是上游/83zi 能访问的**公网直链**（本机 `127.0.0.1` / 内网一般不可用）。

绑定本人素材组：

```bash
curl -s -X POST "$BASE/api/seedance/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://example.com/path/ref.jpg\",
    \"type\": \"image\",
    \"name\": \"ref-1\",
    \"group_id\": \"$GROUP_ID\"
  }"
```

不传 `group_id`（走平台默认 AIGC 组）：

```bash
curl -s -X POST "$BASE/api/seedance/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/path/ref.jpg","type":"image","name":"ref-default"}'
```

使用他人 `group_id` → HTTP **403**，`code=group_forbidden`。

保存返回的本地 `data.asset_id` 或上游 `data.aicc_asset_id`：

```bash
export ASSET_ID="123"
# 或
export ASSET_ID="asset-xxxxxxxx"
```

### 4.2 查询素材列表

```bash
curl -s -X POST "$BASE/api/seedance/assets/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page_no":1,"page_size":20,"status":"active"}'
```

可选：`group_id` / `group_ids`、`type`（`image`/`video`/`audio`）、`status` / `statuses`。

### 4.3 查询单个素材

```bash
curl -s "$BASE/api/seedance/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN"
```

`{id}` 可为本地数字 id 或上游 `aicc_asset_id`。若运营配置开启「GET 时回源刷新」，会向 83zi 同步 `status`。

### 4.4 更新素材名称

```bash
curl -s -X PATCH "$BASE/api/seedance/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"ref-face-1.jpg"}'
```

也可传 `name`。

### 4.5 删除素材

```bash
curl -s -X DELETE "$BASE/api/seedance/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. 真人认证（2 个）

### 5.1 创建真人认证 H5 会话

```bash
curl -s -X POST "$BASE/api/seedance/real-person-auth/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

保存 `data.byted_token`，用手机打开 `data.h5_link` 完成活体后再换组：

```bash
export BYTED_TOKEN="byted-token-xxx"
```

### 5.2 bytedToken 换真人素材组

```bash
curl -s -X POST "$BASE/api/seedance/real-person-auth/asset-group" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"byted_token\":\"$BYTED_TOKEN\"}"
```

未完成活体或 token 无效 → 常见 **404** `group_not_found`。  
成功后本地会绑定 `LivenessFace` 组，可出现在素材组 query 中。

换到的 `group_id` 可用于后续 `POST /api/seedance/assets`（或日后 upload）上传真人参考图。

---

## 6. 接口一览

| # | 方法 | 路径 | 说明 |
|---|------|------|------|
| 1 | `POST` | `/api/seedance/asset-groups` | 创建素材组（仅 AIGC） |
| 2 | `POST` | `/api/seedance/asset-groups/query` | 本人素材组列表 |
| 3 | `GET` | `/api/seedance/asset-groups/{group_id}` | 单个素材组 |
| 4 | `PATCH` | `/api/seedance/asset-groups/{group_id}` | 更新名称/描述 |
| 5 | `DELETE` | `/api/seedance/asset-groups/{group_id}` | 删除素材组 |
| 6 | `POST` | `/api/seedance/assets` | 远程 URL 认证 |
| 7 | `POST` | `/api/seedance/assets/query` | 本人素材列表 |
| 8 | `GET` | `/api/seedance/assets/{id}` | 查询素材状态 |
| 9 | `PATCH` | `/api/seedance/assets/{id}` | 更新 filename |
| 10 | `DELETE` | `/api/seedance/assets/{id}` | 删除素材 |
| 11 | `POST` | `/api/seedance/real-person-auth/sessions` | 真人认证会话 |
| 12 | `POST` | `/api/seedance/real-person-auth/asset-group` | bytedToken 换 GroupId |

认证：请求头 `Authorization: Bearer sk-...`  
成功响应形状：`{ "success": true, "message": "", "data": ... }`

---

## 7. 常见错误

| HTTP | code | 说明 |
|------|------|------|
| 401 | — | 令牌无效 |
| 403 | `group_forbidden` | 使用了他人 `group_id` |
| 404 | `group_not_found` / `asset_not_found` | 资源不存在或不属于本人 |
| 503 | `gateway_not_configured` | 未启用或未配置网关渠道 |

---

## 8. 安全提示

- 勿把真实 API Key 提交进仓库或贴到公开文档。
- 联调用临时 Key，测完后建议在后台作废/轮换。

*文档版本：2026-07-15*
