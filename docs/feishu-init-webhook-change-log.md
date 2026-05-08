# 飞书批量初始化增强与 Webhook 接入说明

本文档汇总本次围绕「飞书人员批量初始化」完成的功能改动、接口说明与使用方式，便于后续运维与二次开发。

---

## 1. 改动目标

本次改动覆盖三类需求：

1. 飞书批量初始化时，分组下拉框可同步系统最新分组。
2. 批量初始化创建新用户时，自动创建用户令牌并返回明文 key。
3. 新增可由飞书多维表格触发的初始化 Webhook 接口。

---

## 2. 改动清单（后端）

### 2.1 批量初始化接口增强

接口：`POST /api/user/feishu/users/batch`

增强点：

- 新建用户成功后，自动创建一个默认令牌（默认名：`feishu-init`）。
- 响应结果新增令牌字段：
  - `token_id`
  - `token_name`
  - `token_key`（明文）

行为说明：

- 用户已存在：`action=skipped_exists`
- 标识解析失败：`action=failed`
- 用户创建成功但令牌失败：`action=failed`，并返回原因
- 用户和令牌都成功：`action=created`

### 2.2 新增飞书初始化 Webhook 接口

接口：`POST /api/feishu/users/init/webhook`

增强点：

- 支持外部系统（如多维表格自动化）无登录调用。
- 支持飞书标识与可读标识（工号/手机号/邮箱）混合输入。
- 用户初始化成功后自动创建令牌并返回明文 key。

安全校验：

- 必须携带请求头：`X-Feishu-Init-Secret`
- 服务端配置项：`feishu.init_webhook_secret`
- 未配置或校验失败返回 `403`

### 2.3 明文令牌管理权限默认值调整

配置键：

- `feishu.allow_admin_manage_plaintext_tokens`

默认值：

- `true`（Root 与 Admin 均可使用飞书明文令牌管理接口）

可选收紧策略：

- 设置为 `false` 后，仅 Root 可调用。

---

## 3. 改动清单（前端）

### 3.1 classic 前端：分组下拉动态化

页面：用户管理 -> 飞书批量初始化弹窗

改动：

- 分组下拉由硬编码（`default/vip`）改为动态请求 `/api/group/`。
- 打开弹窗时加载最新系统分组。

### 3.2 系统设置可视化配置（两套前端）

都已增加 `init_webhook_secret` 可视化配置项：

- 默认新版前端：系统设置 -> Auth -> OAuth Integrations -> Feishu
- classic 前端：系统设置 -> 配置飞书 OAuth

字段形态：

- 密码输入框（不明文展示）

---

## 4. 接口使用说明

## 4.1 管理端批量初始化接口（管理员鉴权）

`POST /api/user/feishu/users/batch`

说明：

- 走管理员鉴权（AdminAuth），适合后台人工操作。
- 支持 preview + confirmed 模式（现有流程）。

请求示例：

```json
{
  "users": [
    {
      "feishu_open_id": "ou_xxxxx1",
      "display_name": "张三",
      "group": "vip",
      "confirmed": true
    }
  ]
}
```

成功响应示例（节选）：

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "feishu_open_id": "ou_xxxxx1",
        "user_id": 101,
        "username": "zhangsan",
        "token_id": 501,
        "token_name": "feishu-init",
        "token_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
        "action": "created"
      }
    ]
  }
}
```

## 4.2 Webhook 批量初始化接口（多维表格触发）

`POST /api/feishu/users/init/webhook`

请求头：

- `X-Feishu-Init-Secret: <你的共享密钥>`

请求体示例：

```json
{
  "users": [
    {
      "employee_id": "074234",
      "mobile": "13800138000",
      "email": "name@company.com",
      "display_name": "张三",
      "group": "vip",
      "quota": 500000,
      "remark": "技术部"
    }
  ]
}
```

支持字段：

- 飞书标识：`feishu_open_id` / `feishu_union_id` / `feishu_user_id`
- 可读标识：`employee_id` / `mobile` / `email`
- 其他：`username` / `display_name` / `password` / `group` / `quota` / `role` / `remark` / `org_name` / `org_path` / `job_title`

返回示例（节选）：

```json
{
  "success": true,
  "data": {
    "total": 1,
    "success": 1,
    "skipped": 0,
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
      }
    ],
    "errors": []
  }
}
```

错误示例：

```json
{
  "success": false,
  "message": "invalid webhook secret"
}
```

---

## 5. 多维表格自动化接入建议

1. 在系统设置中先配置 `init_webhook_secret`。
2. 在多维表格自动化 HTTP 节点中配置：
   - URL：`https://<your-domain>/api/feishu/users/init/webhook`
   - Method：`POST`
   - Header：`X-Feishu-Init-Secret`
   - Body：按本文示例传 `users` 数组
3. 根据返回 `results` 里的 `action` 与 `token_key` 做后续分发或记录。

---

## 6. 关联文档

- 现有管理员接口文档：`docs/feishu-admin-api.md`
- 本文档定位：本次改动汇总 + 快速接入说明
