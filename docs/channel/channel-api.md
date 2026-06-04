# 渠道管理 API

通过管理员鉴权调用 `/api/channel/*` 系列接口，可在不进入 Web 后台的前提下完成：

- **状态统计** — 实时获取正常 / 手动禁用 / 自动禁用（被警用）渠道数（§3-§5）
- **新增渠道** — 单个、多 key 合并、批量拆分三种模式（§6）
- **修改 / 删除 / 测试 / 批量操作** — 完整的管理动作（§7）

适用场景：

- 外部监控/告警（正常渠道数低于阈值时通知值班）
- 巡检脚本（定期统计 / 导出健康状态）
- CI 部署后自检
- 基础设施即代码（IaC）批量初始化或同步渠道配置

---

## 1. 状态枚举

定义位置：`common/constants.go:253-255`

| 值 | 常量 | 含义 |
|---|---|---|
| `1` | `ChannelStatusEnabled` | 正常启用 |
| `2` | `ChannelStatusManuallyDisabled` | 管理员手动禁用 |
| `3` | `ChannelStatusAutoDisabled` | 系统自动禁用（被警用）— 通常因 key 失效、余额不足、连续报错触发 |

---

## 2. 获取管理员 Access Token

`/api/channel/*` 走 `AdminAuth` 中间件（`middleware/auth.go`），支持 **Session（Cookie）** 与 **Access Token（Bearer）** 两种鉴权。本文档使用 Token 方式，便于脚本调用。

### 方式 A：Web UI 一键生成（推荐）

1. 使用 admin 账号登录 Web 控制台
2. 进入「个人设置 / Personal Setting」
3. 点击 **「生成系统访问令牌 / Generate System Access Token」**
4. 复制弹出的 token

底层调用：`GET /api/user/token`（路由 `router/api-router.go:85`，需有效 admin session）。

### 方式 B：纯 CLI 流程

```bash
HOST="http://your-newapi-host:3000"
COOKIES=$(mktemp)

# 1) 登录 admin 账号，保存 session cookie
curl -s -c "$COOKIES" \
  -H "Content-Type: application/json" \
  -X POST "$HOST/api/user/login" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'

# 2) 生成 / 刷新 access token
ADMIN_TOKEN=$(curl -s -b "$COOKIES" "$HOST/api/user/token" | jq -r .data)

# 3) 获取自己的 user id（调用接口必须带）
ADMIN_UID=$(curl -s -b "$COOKIES" "$HOST/api/user/self" | jq -r .data.id)

echo "Token: $ADMIN_TOKEN"
echo "UID:   $ADMIN_UID"
```

> ⚠️ 重新调用 `/api/user/token` 会**覆盖**旧 token；用户被禁用后 token 同步失效。

---

## 3. 请求格式

### 端点

```
GET /api/channel/
```

### 必填请求头

| Header | 说明 |
|---|---|
| `Authorization: Bearer <ADMIN_TOKEN>` | 系统访问令牌（也兼容不带 `Bearer ` 前缀） |
| `New-Api-User: <ADMIN_UID>` | 调用者 user id，未提供会返回 401 |

### 查询参数

| 参数 | 类型 | 含义 |
|---|---|---|
| `status` | int | `1` 仅启用 / `0` 仅禁用（含 manual+auto）/ `-1` 全部 |
| `p` | int | 页码（从 1 开始） |
| `page_size` | int | 每页条数；最大会被后端限制为 `100`。仅统计时设为 `1` 即可（`total` 字段独立返回） |
| `group` | string | 按分组过滤 |
| `type` | int | 按渠道类型过滤（如 `1`=OpenAI，`14`=Anthropic） |
| `tag_mode` | bool | `true` 时返回按 tag 聚合 |
| `sort_by` | string | 排序字段：`id` / `name` / `priority` / `balance` / `response_time` / `test_time` |
| `sort_order` | string | `asc` 或 `desc`；无效值默认按 `desc` 处理 |
| `id_sort` | bool | 旧排序开关：未指定 `sort_by` 时可按 id 倒序 |

参考实现：`controller/channel.go:92` (`GetAllChannels`)、`controller/channel.go:54` (`parseStatusFilter`)。

### 响应结构

```json
{
  "success": true,
  "data": {
    "items": [ { "id": 1, "name": "...", "type": 14, "status": 1, ... } ],
    "total": 1,
    "type_counts": { "14": 1 }
  }
}
```

- `total` — 符合过滤条件的渠道总数
- `type_counts` — 按 `type`（渠道类型）聚合的计数（map[type]count）。注意：当前实现会应用 `group/status` 过滤，但不会应用请求里的 `type` 过滤，因此可用于展示当前状态下所有类型分布。
- `items` — 当前分页的渠道详情；接口不会返回 `key` 字段

---

## 4. 常用查询示例

### 4.1 仅取「正常启用」渠道数（最常用）

```bash
curl -sH "Authorization: Bearer $ADMIN_TOKEN" \
     -H "New-Api-User: $ADMIN_UID" \
     "$HOST/api/channel/?status=1&p=1&page_size=1" \
  | jq '.data.total'
```

### 4.2 一次性获取三种状态分布

```bash
get_count() {
  curl -sH "Authorization: Bearer $ADMIN_TOKEN" \
       -H "New-Api-User: $ADMIN_UID" \
       "$HOST/api/channel/?status=$1&p=1&page_size=1" \
    | jq -r '.data.total'
}

ENABLED=$(get_count 1)
DISABLED=$(get_count 0)
TOTAL=$(get_count -1)

echo "正常启用: $ENABLED"
echo "已禁用:   $DISABLED"
echo "总计:     $TOTAL"
```

### 4.3 精确区分「手动禁用」vs「自动禁用（被警用）」

接口的 `status=0` 把 manual+auto 合并返回，需在客户端按 `items[].status` 字段二次分组。注意后端会把 `page_size` 限制为最大 `100`，因此禁用渠道较多时必须分页拉完：

```bash
page=1
while :; do
  resp=$(curl -sH "Authorization: Bearer $ADMIN_TOKEN" \
       -H "New-Api-User: $ADMIN_UID" \
       "$HOST/api/channel/?status=0&p=$page&page_size=100")

  echo "$resp" | jq -c '.data.items[]'

  total=$(echo "$resp" | jq -r '.data.total')
  fetched=$((page * 100))
  [ "$fetched" -ge "$total" ] && break
  page=$((page + 1))
done | jq -s '[.[].status] | group_by(.) | map({status: .[0], count: length})'
```

输出示例：

```json
[
  { "status": 2, "count": 3 },   // 手动禁用 3 个
  { "status": 3, "count": 7 }    // 自动禁用（被警用）7 个
]
```

### 4.4 按渠道类型分布

```bash
curl -sH "Authorization: Bearer $ADMIN_TOKEN" \
     -H "New-Api-User: $ADMIN_UID" \
     "$HOST/api/channel/?status=1&p=1&page_size=1" \
  | jq '.data.type_counts'
```

---

## 5. 完整健康检查脚本

将以下脚本保存为 `check_channels.sh`，配合 cron / systemd timer / Prometheus textfile collector 使用。

```bash
#!/usr/bin/env bash
# Usage: ADMIN_TOKEN=xxx ADMIN_UID=1 HOST=http://host:3000 ./check_channels.sh
# 退出码: 0 健康；1 正常渠道数 = 0；2 接口异常
set -euo pipefail

HOST="${HOST:?HOST is required}"
ADMIN_TOKEN="${ADMIN_TOKEN:?ADMIN_TOKEN is required}"
ADMIN_UID="${ADMIN_UID:?ADMIN_UID is required}"
MIN_HEALTHY="${MIN_HEALTHY:-1}"   # 健康渠道最低阈值

call_page() {
  local status="$1"
  local page="$2"
  curl -sf -m 10 \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "New-Api-User: $ADMIN_UID" \
    "$HOST/api/channel/?status=$status&p=$page&page_size=100" \
    || { echo "API request failed for status=$status page=$page" >&2; exit 2; }
}

fetch_all_items() {
  local status="$1"
  local page=1
  while :; do
    resp=$(call_page "$status" "$page")
    echo "$resp" | jq -c '.data.items[]'
    total=$(echo "$resp" | jq -r '.data.total')
    fetched=$((page * 100))
    [ "$fetched" -ge "$total" ] && break
    page=$((page + 1))
  done
}

ENABLED=$(call_page 1 1 | jq -r '.data.total')
DISABLED_ITEMS=$(fetch_all_items 0 | jq -s '.')
TOTAL=$(call_page -1 1 | jq -r '.data.total')

MANUAL=$(echo "$DISABLED_ITEMS" | jq '[.[] | select(.status==2)] | length')
AUTO=$(echo   "$DISABLED_ITEMS" | jq '[.[] | select(.status==3)] | length')

cat <<EOF
[new-api 渠道健康巡检 @ $(date '+%F %T')]
  正常启用 (status=1) : $ENABLED
  手动禁用 (status=2) : $MANUAL
  自动禁用 (status=3) : $AUTO   <- 被系统警用
  渠道总数           : $TOTAL
EOF

if [ "$ENABLED" -lt "$MIN_HEALTHY" ]; then
  echo "❌ 告警：正常渠道数 $ENABLED < $MIN_HEALTHY" >&2
  exit 1
fi
exit 0
```

---

## 6. 已验证响应（参考）

针对实例 `http://74.50.127.249:3000/`（2026-05 测试）:

```
正常启用 (status=1) : 1   (type=14, Anthropic)
手动禁用 (status=2) : 0
自动禁用 (status=3) : 1   ← 被警用
渠道总数           : 2
```

---

## 7. 注意事项

- `Authorization` 与 `New-Api-User` 两个 header **必须同时携带**，缺一返回 401；Header 名是标准 `Authorization`，不是 `authz`
- 普通用户的 access token 无法访问 `/api/channel/*`，必须为 admin / root 角色
- access token 通过明文比对（`model.ValidateAccessToken`），**请按 secret 级别保管**，泄漏后立即重新生成覆盖
- 接口返回的 `data.total` 是按过滤条件统计的**全量行数**，与分页参数 `page_size` 无关，因此用 `page_size=1` 取统计值最高效
- `page_size` 最大会被限制为 `100`；需要遍历 `items` 做客户端统计时必须分页拉取
- 大多数业务错误返回 HTTP 200 + `success:false`，但鉴权失败会返回 401，部分参数/上游错误可能返回 400/500；脚本应同时检查 HTTP 状态码和 `success` 字段
- 自动禁用（status=3）的渠道，详细禁用原因记录在 Web 后台「渠道列表 → 已禁用」的 `tested_time` / `response_time` 与 channel 详情字段中；当前接口仅返回结构化字段，原始报错需另外查询

---

## 8. 批量按密钥精确查询渠道

### 端点

```
POST /api/channel/search/keys
```

- 中间件：`AdminAuth` + `CriticalRateLimit` + `DisableCache`
- 用途：管理员粘贴多条渠道密钥后，按 **channel.key 精确匹配** 查询渠道行
- 设计原因：密钥可能较多且属于敏感信息，因此使用 POST body，避免 URL 长度限制和 query string 泄漏

### 请求体

```jsonc
{
  "keys": ["sk-key-1", "sk-key-2"],  // 必填；后端会 trim、去空行、去重
  "keyword": "OpenAI",                // 可选；沿用 /api/channel/search 的 broad keyword 语义
  "group": "default",                 // 可选；与现有 group 过滤组合
  "model": "gpt-4o",                  // 可选；按 models LIKE 过滤
  "status": "enabled",                // 可选：enabled / disabled / 空字符串(全部)
  "type": 1,                           // 可选；用于类型 tab 过滤
  "id_sort": false,
  "sort_by": "priority",              // 可选：id/name/priority/balance/response_time/test_time
  "sort_order": "desc",               // 可选：asc / desc
  "p": 1,
  "page_size": 20,
  "tag_mode": false                    // v1 不支持 true
}
```

### 响应

响应 shape 与 `GET /api/channel/search` 保持一致，仅返回：`items`、`total`、`type_counts`。

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      { "id": 1, "name": "OpenAI-Primary", "key": "" }
    ],
    "total": 1,
    "type_counts": { "1": 1, "14": 2 }
  }
}
```

### 行为说明

- 精确匹配条件为 `channel.key IN keys`，不会把 `keyword` 命中的同名渠道当作密钥命中结果。
- 过滤组合为：`精确密钥集合 AND keyword/group/model/status/type`。
- `type_counts` 在应用 `type` 过滤前计算；也就是说类型 tab 统计反映当前密钥集合 + keyword/group/model/status 下的各类型数量。
- 列表响应不会返回真实密钥；`items[].key` 会保持为空，真实密钥仍只能走受安全验证保护的单独密钥查看接口。
- 请求没有硬性 key 数量限制；后端会把去重后的 keys 分块执行精确 `IN` 查询，避免 SQLite / MySQL / PostgreSQL 的 SQL 参数上限问题。
- v1 不支持标签聚合模式：`tag_mode=true` 会返回 `success:false`，避免“某个 key 命中一个 tag 后返回同 tag 但 key 不匹配的渠道”的误导结果。

---

## 9. 添加渠道

### 端点

```
POST /api/channel/
```

- 中间件：`AdminAuth`
- 路由：`router/api-router.go:231`
- 处理函数：`controller.AddChannel`（`controller/channel.go:587`）
- 校验函数：`validateChannel`（`controller/channel.go:457`）

### 请求体

```jsonc
{
  "mode": "single",                            // 必填，见下方"添加模式"
  "multi_key_mode": "random",                  // 仅 multi_to_single 模式使用
  "batch_add_set_key_prefix_2_name": false,    // batch 模式下是否给名字附加 key 前缀
  "channel": {                                 // 必填，完整 Channel 对象
    "type": 1,
    "name": "OpenAI-Primary",
    "key": "sk-xxxxxxxx",
    "models": "gpt-4o,gpt-4o-mini",
    "group": "default",
    "base_url": "https://api.openai.com",
    "priority": 0,
    "weight": 1,
    "test_model": "gpt-4o-mini",
    "model_mapping": "{}",                     // JSON 字符串
    "status_code_mapping": "{}",
    "auto_ban": 1,                             // 1=失败时自动警用，0=保持启用
    "tag": "",
    "remark": "",
    "setting": "{}",
    "param_override": "{}",
    "header_override": "{}",
    "other": "",                               // VertexAI 必填部署地区 JSON
    "channel_info": {                          // 仅多 key 模式需要
      "is_multi_key": false,
      "multi_key_mode": "",
      "multi_key_size": 0
    }
  }
}
```

完整 Channel 结构定义见 `model/channel.go:23`。

### 添加模式（`mode`）

| mode | 含义 |
|---|---|
| `single` | 单 key 单渠道（最常用） |
| `multi_to_single` | 多个 key 合并到一个渠道，按 `multi_key_mode`（`random` / `polling`）轮询；keys 用 `\n` 分隔 |
| `batch` | 一次拆出多个独立渠道，每行 key 生成一条记录 |

> ⚠️ 其他值会返回 `"不支持的添加模式"`。

### 关键校验规则

- `channel.key` 不能为空
- 模型名长度必须 ≤ 255
- `type=41`（VertexAI）：`other` 字段必填，且 JSON 中必须包含 `default` 区域；如使用 service account JSON，可用标准 JsonArray 批量导入
- `type=57`（Codex）：`key` 必须是合法 JSON，包含 `access_token` 和 `account_id`

### 常用 ChannelType 枚举

定义位置：`constant/channel.go`

| Type | Provider | Type | Provider |
|---|---|---|---|
| 1 | OpenAI | 33 | AWS Bedrock |
| 3 | Azure | 34 | Cohere |
| 8 | Custom (OpenAI 兼容) | 37 | Dify |
| 14 | Anthropic Claude | 40 | SiliconFlow |
| 17 | 阿里通义 | 41 | VertexAI |
| 20 | OpenRouter | 42 | Mistral |
| 23 | 腾讯混元 | 43 | DeepSeek |
| 24 | Google Gemini | 45 | 火山豆包 |
| 25 | Moonshot | 48 | xAI |
| 27 | Perplexity | 57 | Codex |

完整列表（含图像/视频类如 Suno、Kling、Jimeng、Vidu 等）见源码。

### 请求示例

#### 单渠道（最常用）

```bash
curl -X POST "$HOST/api/channel/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "New-Api-User: $ADMIN_UID" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "single",
    "channel": {
      "type": 1,
      "name": "OpenAI-Primary",
      "key": "sk-xxxxxxxx",
      "models": "gpt-4o,gpt-4o-mini,gpt-3.5-turbo",
      "group": "default",
      "base_url": "https://api.openai.com",
      "priority": 0,
      "auto_ban": 1
    }
  }'
```

#### 批量拆分（一次添加 3 个独立 Claude 渠道）

```bash
curl -X POST "$HOST/api/channel/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "New-Api-User: $ADMIN_UID" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "batch",
    "batch_add_set_key_prefix_2_name": true,
    "channel": {
      "type": 14,
      "name": "Claude",
      "key": "sk-ant-key1\nsk-ant-key2\nsk-ant-key3",
      "models": "claude-3-5-sonnet-20241022,claude-3-7-sonnet-latest",
      "group": "default",
      "priority": 0
    }
  }'
```

启用 `batch_add_set_key_prefix_2_name` 后，每个新渠道名会变成 `Claude sk-ant-k`（取 key 前 8 字符），方便区分。

#### 多 Key 合并到一个渠道（轮询模式）

```bash
curl -X POST "$HOST/api/channel/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "New-Api-User: $ADMIN_UID" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "multi_to_single",
    "multi_key_mode": "polling",
    "channel": {
      "type": 14,
      "name": "Claude-Pool",
      "key": "sk-ant-key1\nsk-ant-key2\nsk-ant-key3",
      "models": "claude-3-5-sonnet-20241022",
      "group": "default"
    }
  }'
```

### 响应

成功：

```json
{ "success": true, "message": "" }
```

> 当前新增接口成功时不返回新渠道 ID。如需获取 ID，可按 `name` / `type` / `group` 等条件再查询列表匹配。

失败（如 key 为空、type 校验失败、JSON 格式错）：

```json
{ "success": false, "message": "<中文错误描述>" }
```

> 多数业务校验失败会返回 HTTP 200 + `success:false`；鉴权失败或部分底层错误可能返回非 200。脚本应同时判断 HTTP 状态码和响应体的 `success`。

---

## 10. 其他管理接口

均在 `apiRouter.Group("/channel")` 下、`AdminAuth` 中间件保护（`router/api-router.go:218-257`）。其中 `POST /api/channel/:id/key` 额外需要 root 权限、安全验证和限流，`POST /api/channel/fetch_models` 额外需要 root 权限。

### 修改渠道

```
PUT /api/channel/
```
处理：`controller.UpdateChannel`（`controller/channel.go:863`）

请求体直接放 Channel 对象（不需要 `mode` 字段，必须带 `id`）：

```bash
curl -X PUT "$HOST/api/channel/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "New-Api-User: $ADMIN_UID" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 7,
    "type": 1,
    "name": "OpenAI-Primary-Updated",
    "key": "sk-newkey",
    "models": "gpt-4o,gpt-4o-mini",
    "priority": 10,
    "status": 1
  }'
```

### 删除渠道

| 方法 | 路径 | 用途 |
|---|---|---|
| `DELETE` | `/api/channel/:id` | 删除单个渠道 |
| `POST` | `/api/channel/batch` | 批量删除，body: `{"ids":[1,2,3]}` |
| `DELETE` | `/api/channel/disabled` | 一键清理**所有已禁用**（手动+自动） |

### 测试 / 余额

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/channel/test/:id` | 测试指定渠道连通性 |
| `GET` | `/api/channel/test` | 测试全部启用中的渠道 |
| `GET` | `/api/channel/update_balance/:id` | 刷新单个渠道余额 |
| `GET` | `/api/channel/update_balance` | 刷新全部渠道余额 |

### 按 tag 批量操作

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/channel/tag/disabled` | 把某 tag 下全部渠道禁用 |
| `POST` | `/api/channel/tag/enabled` | 把某 tag 下全部渠道启用 |
| `PUT` | `/api/channel/tag` | 修改 tag 下渠道的批量配置 |

### 模型与上游

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/channel/models` | 全部内置模型列表 |
| `GET` | `/api/channel/models_enabled` | 启用中渠道支持的模型列表 |
| `GET` | `/api/channel/fetch_models/:id` | 拉取指定渠道上游真实支持的模型 |
| `POST` | `/api/channel/fetch_models` | 在创建前预拉取上游模型列表；额外需要 root 权限 |
| `POST` | `/api/channel/fix` | 修复 abilities 表（清理脏数据） |

### 查询 / 复制 / 密钥查看

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/channel/search` | 搜索渠道；支持 `keyword`、`group`、`model`、`status`、`type`、分页和排序参数 |
| `GET` | `/api/channel/:id` | 获取单个渠道详情；不返回 key |
| `POST` | `/api/channel/:id/key` | 查看渠道 key；额外需要 root 权限、安全验证、限流和禁用缓存 |
| `POST` | `/api/channel/copy/:id` | 复制渠道；支持 query：`suffix`、`reset_balance` |

### tag / 多 key 扩展操作

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/channel/batch/tag` | 批量设置渠道 tag，body: `{"ids":[1,2],"tag":"prod"}`；`tag:null` 可清空 |
| `GET` | `/api/channel/tag/models?tag=<tag>` | 获取某 tag 下模型列表最多的一条 `models` 字符串 |
| `POST` | `/api/channel/multi_key/manage` | 管理多 key 渠道，见下方动作列表 |

`/api/channel/multi_key/manage` 请求体：

```jsonc
{
  "channel_id": 1,
  "action": "get_key_status",
  "key_index": 0,
  "page": 1,
  "page_size": 50,
  "status": 1
}
```

支持的 `action`：`get_key_status`、`disable_key`、`enable_key`、`enable_all_keys`、`disable_all_keys`、`delete_key`、`delete_disabled_keys`。其中 `key_index` 仅单 key 操作需要；`delete_disabled_keys` 只删除自动禁用（status=3）的 key。

### Ollama 管理

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/channel/ollama/pull` | 为 Ollama 渠道拉取模型，body: `{"channel_id":1,"model_name":"llama3"}` |
| `POST` | `/api/channel/ollama/pull/stream` | 流式拉取 Ollama 模型 |
| `DELETE` | `/api/channel/ollama/delete` | 删除 Ollama 模型 |
| `GET` | `/api/channel/ollama/version/:id` | 获取指定 Ollama 渠道版本 |

### 上游模型更新

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/channel/upstream_updates/apply` | 对单个渠道应用待处理的上游模型变更 |
| `POST` | `/api/channel/upstream_updates/apply_all` | 批量应用所有启用渠道的待处理上游模型变更 |

### Codex OAuth

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/channel/codex/oauth/start` | 启动 Codex OAuth 流程（建渠道前） |
| `POST` | `/api/channel/codex/oauth/complete` | 完成回调 |
| `POST` | `/api/channel/:id/codex/oauth/start` | 已有渠道续期 OAuth |
| `POST` | `/api/channel/:id/codex/oauth/complete` | 已有渠道续期完成 |
| `POST` | `/api/channel/:id/codex/refresh` | 刷新已有 Codex 渠道凭证 |
| `GET` | `/api/channel/:id/codex/usage` | 获取 Codex 渠道用量 |

---

## 10. 修改 / 删除接口的最小完整示例

```bash
# 0) 公共环境
HOST="http://your-host:3000"
ADMIN_TOKEN="..."
ADMIN_UID=1
H=(-H "Authorization: Bearer $ADMIN_TOKEN" -H "New-Api-User: $ADMIN_UID" -H "Content-Type: application/json")

# 1) 新增（成功响应不返回 id，只返回 success/message）
ADD_OK=$(curl -sX POST "$HOST/api/channel/" "${H[@]}" -d '{
  "mode":"single",
  "channel":{"type":1,"name":"tmp","key":"sk-test","models":"gpt-4o-mini","group":"default"}
}' | jq -r '.success')
echo "added: $ADD_OK"

# 2) 再查询列表找到 id（page_size 最大 100）
ID=$(curl -s "${H[@]}" "$HOST/api/channel/search?keyword=tmp&status=1&page_size=100" \
       | jq -r '.data.items[] | select(.name=="tmp") | .id' | head -1)

# 3) 测试连通性
curl -s "${H[@]}" "$HOST/api/channel/test/$ID" | jq

# 4) 删除
curl -sX DELETE "${H[@]}" "$HOST/api/channel/$ID" | jq
```
