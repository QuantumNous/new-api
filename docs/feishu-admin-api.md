# 飞书管理员 API 接口文档

所有接口均需要管理员权限（AdminAuth），通过 session 或系统 access_token 认证。

**认证方式**：在请求头中携带 `Authorization: Bearer <access_token>`，并在请求头中携带 `New-Api-User: <admin_user_id>`。

管理员使用密码登录获取 session 后，通过 `/api/user/self/token` 生成系统 access_token。

---

## 1. 批量初始化用户（通过飞书标识）

根据飞书标识批量创建用户，支持指定用户名、分组、额度、角色等信息。

```
POST /api/user/feishu/users/batch
```

### 请求体

```json
{
  "users": [
    {
      "feishu_open_id": "ou_xxxxx1",
      "feishu_union_id": "on_xxxxx1",
      "feishu_user_id": "u_xxxxx1",
      "username": "zhangsan",
      "display_name": "张三",
      "password": "optional_password",
      "group": "vip",
      "quota": 500000,
      "role": 1,
      "remark": "技术部"
    },
    {
      "feishu_open_id": "ou_xxxxx2"
    }
  ]
}
```

### 请求字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `users` | array | 是 | 用户初始化列表 |
| `users[].feishu_open_id` | string | 是 | 飞书 OpenID（主键） |
| `users[].feishu_union_id` | string | 否 | 飞书 UnionID（辅助标识） |
| `users[].feishu_user_id` | string | 否 | 飞书 UserID（辅助标识） |
| `users[].username` | string | 否 | 用户名（留空则自动生成 `feishu_<open_id>`） |
| `users[].display_name` | string | 否 | 显示名（留空则使用用户名） |
| `users[].password` | string | 否 | 密码（留空则随机生成12位密码） |
| `users[].group` | string | 否 | 分组（留空则默认 `default`） |
| `users[].quota` | int | 否 | 额度（留空则使用系统默认 `QuotaForNewUser`） |
| `users[].role` | int | 否 | 角色（留空则默认 1 普通用户，不能 >= 管理员角色） |
| `users[].remark` | string | 否 | 备注 |

### 成功响应

```json
{
  "success": true,
  "data": {
    "total": 2,
    "success": 1,
    "skipped": 1,
    "failed": 0,
    "results": [
      {
        "feishu_open_id": "ou_xxxxx1",
        "user_id": 101,
        "username": "zhangsan",
        "token_id": 501,
        "token_name": "feishu-init",
        "token_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
        "action": "created"
      },
      {
        "feishu_open_id": "ou_xxxxx2",
        "user_id": 55,
        "username": "existing_user",
        "action": "skipped_exists"
      }
    ],
    "errors": []
  }
}
```

### 行为说明

- 如果 OpenID 已绑定对应用户，则跳过（`skipped_exists`）
- 如果用户名冲突，自动追加数字后缀（如 `zhangsan_1`）
- 如果指定了 `quota`，创建后会覆写系统默认额度
- 如果指定了非 `default` 分组，自动触发 `SyncUserBindGroupSubscriptions`（同步该分组绑定的订阅套餐）
- **创建用户成功后自动创建一个令牌**（默认名 `feishu-init`），并在结果中返回 `token_id/token_name/token_key`
- 写入系统日志记录操作

---

## 2. 批量修改用户信息（通过飞书标识）

根据飞书标识批量更新已有用户的信息，支持修改显示名、密码、分组、额度、状态、备注。

```
PUT /api/user/feishu/users/batch
```

### 请求体

```json
{
  "users": [
    {
      "feishu_open_id": "ou_xxxxx1",
      "feishu_union_id": "on_xxxxx1",
      "display_name": "张三丰",
      "group": "premium",
      "quota": 1000000,
      "remark": "升级为高级用户"
    },
    {
      "feishu_open_id": "ou_xxxxx2",
      "group": "vip",
      "status": 1
    }
  ]
}
```

### 请求字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `users` | array | 是 | 用户更新列表 |
| `users[].feishu_open_id` | string | 否 | 飞书 OpenID（主键） |
| `users[].feishu_union_id` | string | 否 | 飞书 UnionID（辅助标识） |
| `users[].feishu_user_id` | string | 否 | 飞书 UserID（辅助标识） |
用户定位条件：至少提供 `feishu_open_id` / `feishu_union_id` / `feishu_user_id` / `user_id` / `username` 之一。
| `users[].display_name` | string | 否 | 显示名（空则不修改） |
| `users[].password` | string | 否 | 新密码（空则不修改） |
| `users[].group` | string | 否 | 新分组（空则不修改） |
| `users[].quota` | int | 否 | 新额度（空则不修改，设置的是绝对值而非增量） |
| `users[].status` | int | 否 | 状态：1=启用，2=禁用（空则不修改） |
| `users[].remark` | string | 否 | 备注（空则不修改） |

### 成功响应

```json
{
  "success": true,
  "data": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "skipped": 0,
    "results": [
      {
        "feishu_open_id": "ou_xxxxx1",
        "user_id": 101,
        "username": "zhangsan",
        "old_group": "default",
        "new_group": "premium",
        "sub_synced": true,
        "action": "updated"
      },
      {
        "feishu_open_id": "ou_xxxxx2",
        "user_id": 55,
        "username": "lisi",
        "old_group": "default",
        "new_group": "vip",
        "sub_synced": true,
        "action": "updated"
      }
    ],
    "errors": []
  }
}
```

### 行为说明

- 只有提供了的字段才会被更新，未提供的字段保持不变
- 如果没有提供任何需要更新的字段，该用户会被标记为 `skipped_no_changes`
- **分组变更自动同步订阅套餐**：当 `group` 发生变更时：
  - 自动调用 `SyncUserBindGroupSubscriptions(userId, oldGroup, newGroup)`
  - 删除旧分组对应的 `bind_group` 订阅记录
  - 创建新分组对应的 `bind_group` 订阅记录
  - 响应中 `sub_synced=true` 表示已触发订阅同步
- 自动刷新用户缓存（`InvalidateUserCache`）
- 写入管理日志

---

## 3. 为用户创建令牌（通过飞书标识）

通过飞书标识为指定用户创建一个 API 令牌。

```
POST /api/user/feishu/tokens
```

### 请求体

```json
{
  "feishu_open_id": "ou_xxxxx",
  "feishu_user_id": "u_xxxxx",
  "name": "我的API Key",
  "remain_quota": 1000000,
  "unlimited_quota": false,
  "expired_time": 1735689600,
  "group": "vip",
  "model_limits_enabled": true,
  "model_limits": "gpt-4,claude-3",
  "allow_ips": "192.168.1.0/24",
  "cross_group_retry": false
}
```

### 请求字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `feishu_open_id` | string | 否 | 飞书 OpenID |
| `feishu_user_id` | string | 否 | 飞书 UserID |
用户定位条件：至少提供 `feishu_open_id` 或 `feishu_user_id` 之一。
| `name` | string | 否 | 令牌名称（默认 `admin-created`） |
| `remain_quota` | int | 否 | 剩余额度（默认 0） |
| `unlimited_quota` | bool | 否 | 是否无限额度（默认 true） |
| `expired_time` | int64 | 否 | 过期时间戳，-1 表示永不过期（默认 -1） |
| `group` | string | 否 | 令牌分组 |
| `model_limits_enabled` | bool | 否 | 是否启用模型限制（默认 false） |
| `model_limits` | string | 否 | 模型限制列表，逗号分隔 |
| `allow_ips` | string | 否 | IP 白名单 |
| `cross_group_retry` | bool | 否 | 跨分组重试（默认 false） |

### 成功响应

```json
{
  "success": true,
  "data": {
    "feishu_open_id": "ou_xxxxx",
    "user_id": 101,
    "token_id": 501,
    "token_name": "我的API Key",
    "key": "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

### 错误情况

- 飞书 OpenID 对应用户不存在：返回提示先创建用户
- 用户令牌数量达到上限：返回限制提示

### 权限与安全限制

- 返回明文 key 的接口（创建/批量创建/查询）默认仅 `Root` 可调用。
- 可通过配置 `feishu.allow_admin_manage_plaintext_tokens=true` 放开给 `Admin`。

---

## 4. 批量为用户创建令牌（通过飞书 OpenID）

为多个用户（通过各自的飞书 OpenID）批量创建 API 令牌。

```
POST /api/user/feishu/tokens/batch
```

### 请求体

```json
{
  "items": [
    {
      "feishu_open_id": "ou_xxx1",
      "name": "用户1的Key",
      "unlimited_quota": true
    },
    {
      "feishu_open_id": "ou_xxx2",
      "name": "用户2的Key",
      "remain_quota": 500000,
      "unlimited_quota": false
    }
  ]
}
```

### 请求字段说明

与「为用户创建令牌」相同，每个 item 的字段一致。

### 成功响应

```json
{
  "success": true,
  "data": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "results": [
      {
        "feishu_open_id": "ou_xxx1",
        "user_id": 101,
        "token_id": 501,
        "key": "sk-aaaa"
      },
      {
        "feishu_open_id": "ou_xxx2",
        "user_id": 102,
        "token_id": 502,
        "key": "sk-bbbb"
      }
    ]
  }
}
```

### 行为说明

- 每个用户的操作独立执行，单个失败不影响其他用户
- 返回完整的令牌 key（`sk-...`），不脱敏
- 每个用户受令牌数量上限限制（`MaxUserTokens`）

---

## 5. 查询用户令牌（通过飞书标识）

通过飞书标识查询对应用户的所有令牌列表（返回明文 key）。

```
GET /api/user/feishu/tokens?feishu_open_id=ou_xxxxx&page=1&page_size=10
GET /api/user/feishu/tokens?feishu_user_id=u_xxxxx&page=1&page_size=10
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `feishu_open_id` | string | 否 | 飞书 OpenID |
| `feishu_user_id` | string | 否 | 飞书 UserID |
用户定位条件：至少提供 `feishu_open_id` 或 `feishu_user_id` 之一。
| `page` | int | 否 | 页码（默认 1） |
| `page_size` | int | 否 | 每页数量（默认 10） |

### 成功响应

```json
{
  "success": true,
  "data": {
    "page": 1,
    "page_size": 10,
    "total": 3,
    "items": [
      {
        "id": 501,
        "user_id": 101,
        "key": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
        "name": "我的API Key",
        "status": 1,
        "remain_quota": 800000,
        "unlimited_quota": false,
        "expired_time": -1,
        "model_limits_enabled": false,
        "group": ""
      }
    ]
  }
}
```

### 行为说明

- 令牌 key 返回完整明文（如 `sk-xxxxxxxxxxxxxxxxxxxxxxxx`），不脱敏，方便管理员分发
- 支持分页
- 受“权限与安全限制”约束

---

## 6. 管理端页面状态（任务 12 对齐）

### 已完成

- 用户管理页新增“飞书批量初始化”入口（可视化 JSON 批量导入）。
- 用户管理页新增“Feishu Keys”专用入口：
  - 支持按 `feishu_open_id` / `feishu_user_id` 检索指定用户全部 token
  - 支持创建 token，并在结果中展示新明文 key
- 后端权限隔离已落地（默认 Root 与 Admin 可用，可通过配置收紧为仅 Root）。

---

## 订阅套餐同步机制

### 手动重同步入口（修复未生效用户）

`POST /api/user/group-sync`

用于生产环境“已建套餐但部分用户未生效”的一次性修复/补齐。

请求体示例：

```json
{
  "group_name": "default",
  "full": false,
  "only_missing": true
}
```

参数说明：
- `group_name`（可选）：指定分组；`full=false` 且传值时只扫描该分组
- `full`（可选）：`true` 表示扫描所有用户
- `only_missing`（可选，默认 `true`）：
  - `true`：仅补齐“缺少 bind_group 有效订阅”的用户
  - `false`：对命中用户都执行重同步补齐

响应字段：
- `affected_users`：扫描到的用户数
- `updated`：本次实际执行同步的用户数
- `skipped`：被跳过用户数（如 `pending` 组、无绑定套餐、已生效）
- `errors`：失败明细

### 分组绑定订阅（bind_group）说明

订阅套餐可以配置 `bind_group`（绑定分组）属性。当用户被分配到某个分组时，该分组绑定的所有订阅套餐会自动分配给用户。

### 自动同步触发场景

| 场景 | 触发的同步逻辑 |
|------|------|
| 批量创建用户时指定了非 default 分组 | `SyncUserBindGroupSubscriptions(userId, "", newGroup)` — 创建新分组对应的 bind_group 订阅 |
| 批量更新用户时修改了分组 | `SyncUserBindGroupSubscriptions(userId, oldGroup, newGroup)` — 删除旧分组订阅 + 创建新分组订阅 |
| 管理员修改用户分组（`PUT /api/user/:id/group`） | `SyncUserBindGroupSubscriptions(userId, oldGroup, newGroup)` — 同上 |
| 用户编辑（`user.Edit()`）分组变更 | `SyncUserBindGroupSubscriptions(userId, oldGroup, newGroup)` — 同上 |

### SyncUserBindGroupSubscriptions 逻辑

1. 查找旧分组绑定的所有启用套餐（`bind_group = oldGroup AND enabled = true`）
2. 删除用户这些套餐对应的 `source = "bind_group"` 的订阅记录
3. 查找新分组绑定的所有启用套餐
4. 对每个套餐，如果用户已有该套餐的订阅记录（任何来源），则跳过
5. 否则创建新的 `bind_group` 订阅记录（`end_time=0` 表示永久有效）

---

## 9. 通用说明

### 认证

所有接口使用 `AdminAuth()` 中间件，管理员可通过以下方式认证：

1. **Session 认证**：通过密码登录获取 session cookie
2. **Access Token 认证**：
   - 请求头：`Authorization: Bearer <access_token>`
   - 请求头：`New-Api-User: <admin_user_id>`

### 管理员免受飞书登录限制

管理员通过密码登录时，即使账号已绑定飞书，也不受飞书登录限制（代码中 `Login` 方法已对 `RoleRootUser` 做豁免）。管理员可通过系统 access_token 调用所有管理接口，完全不依赖飞书 OAuth 流程。

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述"
}
```
