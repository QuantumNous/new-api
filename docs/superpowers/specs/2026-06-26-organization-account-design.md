# 组织账号（Organization Account）功能设计

> 日期：2026-06-26
> 状态：已实现
> 版本：v1.1.6

## 1. 需求背景

系统原有用户体系面向个人使用场景（飞书 OAuth 登录、个人额度管理）。随着组织类智能体使用场景的增加，需要新增"组织类"账号类型，与个人用户隔离管理。

### 核心需求

1. 新增组织账号类型，不绑定飞书 ID
2. 组织账号有独立的用户管理页面（`/organization-users`）
3. 组织账号有独立的模型统计页面（`/org-model-stats`）
4. 个人用户可单向转换为组织账号（仅限无飞书 ID 的账号）
5. **向后兼容**：对外暴露的查询和统计接口默认只返回个人用户数据

## 2. 数据模型

### User 表新增字段

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `account_type` | `int` | `0` | 0=个人用户, 1=组织账号 |
| `org_contact_name` | `varchar(255)` | `''` | 组织联系人姓名 |
| `org_contact_info` | `varchar(255)` | `''` | 组织联系方式 |
| `org_description` | `varchar(500)` | `''` | 用途描述 |

> `org_name` 字段已存在（飞书同步功能中使用），组织账号复用此字段存储组织名称。

### 常量定义

```go
// common/constants.go
const AccountTypePersonal     = 0  // 个人用户
const AccountTypeOrganization = 1  // 组织账号
```

### 数据库迁移

通过 GORM `AutoMigrate` 自动完成，兼容 SQLite/MySQL/PostgreSQL：

```sql
ALTER TABLE users ADD COLUMN account_type INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN org_contact_name VARCHAR(255) DEFAULT '';
ALTER TABLE users ADD COLUMN org_contact_info VARCHAR(255) DEFAULT '';
ALTER TABLE users ADD COLUMN org_description VARCHAR(500) DEFAULT '';
```

旧数据 `account_type` 默认为 0（个人用户），无需手动迁移。

### 类型转换规则

- **方向**：个人 → 组织，**单向不可逆**
- **前置条件**：`feishu_id == "" && feishu_union_id == "" && feishu_user_id == ""`
- 有飞书 ID 的账号永远停留在个人类型

## 3. 后端 API

### 3.1 用户管理接口

所有接口位于 `adminRoute`（需要管理员权限）。

#### 查询用户列表

```
GET /api/user/?account_type=0    # 个人用户（默认）
GET /api/user/?account_type=1    # 组织账号
```

不传 `account_type` 时默认返回个人用户，保持向后兼容。

#### 搜索用户

```
GET /api/user/search?keyword=xxx&account_type=1
```

#### 创建用户

```
POST /api/user/
```

请求体新增可选字段：

```json
{
  "username": "org-agent-001",
  "password": "xxx",
  "account_type": 1,
  "org_name": "XX公司",
  "org_contact_name": "张三",
  "org_contact_info": "zhangsan@xx.com",
  "org_description": "智能客服系统"
}
```

不传 `account_type` 时默认为 0（个人用户）。

#### 编辑用户

```
PUT /api/user/
```

支持更新 `org_name`、`org_contact_name`、`org_contact_info`、`org_description`。

#### 转换为组织账号

```
POST /api/user/:id/convert-to-organization
```

校验逻辑：
1. 目标用户无飞书 ID（`feishu_id`、`feishu_union_id`、`feishu_user_id` 均为空）
2. 当前 `account_type == 0`
3. 调用者权限 `canManageTargetRole` 通过

转换成功后记录审计日志。

### 3.2 统计接口

统计接口的 `account_type` 默认行为与用户管理接口一致：不传时默认只统计个人用户。

| 接口 | 说明 |
|------|------|
| `GET /api/data/by-user?account_type=1` | 组织账号用户视角统计 |
| `GET /api/data/by-model?account_type=1` | 组织账号模型视角统计 |
| `GET /api/data/by-department?account_type=1` | 组织账号部门视角统计（按 `org_name` 聚合） |
| `GET /api/data/by-detail?account_type=1` | 组织账号用户-模型明细统计 |
| `GET /api/data/export?account_type=1` | 导出组织账号统计 CSV |

### 3.3 向后兼容策略

| 场景 | 不传 account_type | 行为说明 |
|------|------------------|----------|
| 用户列表 | 只返回个人用户 | 历史调用方无感知 |
| 用户搜索 | 只返回个人用户 | 历史调用方无感知 |
| 统计接口 | 只统计个人用户 | 历史调用方无感知 |
| 创建用户 | 默认创建个人用户 | 历史调用方无感知 |

## 4. 前端页面

### 4.1 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/users` | 个人用户管理 | 现有页面，默认 `account_type=0` |
| `/organization-users` | 组织用户管理 | 新增，默认 `account_type=1` |
| `/user-model-stats` | 个人用户模型统计 | 现有页面，默认 `account_type=0` |
| `/org-model-stats` | 组织用户模型统计 | 新增，默认 `account_type=1` |

### 4.2 侧边栏菜单

```
Users                    /users              (Users icon)
Organization Users       /organization-users (Building2 icon)
User Model Statistics    /user-model-stats   (BarChart3 icon)
Org Model Statistics     /org-model-stats    (BarChart3 icon)
```

### 4.3 组织用户管理页面

- 复用现有 `UsersTable` 组件，通过 `accountType` prop 区分
- 创建/编辑抽屉：隐藏飞书字段，显示组织专属字段（org_name / org_contact_name / org_contact_info / org_description）
- 列表：隐藏飞书列，新增"组织名称"和"联系人"列
- 行操作：移除飞书相关操作（批量初始化、令牌管理），保留额度/启停/删除/令牌等

### 4.4 转换操作

在个人用户管理页面的行操作菜单中：
- 条件：`account_type == 0 && feishu_id === ""`
- 点击"转换为组织账号" → 确认对话框 → 调用转换接口 → 刷新列表

## 5. 文件改动清单

### 后端（8 文件）

| 文件 | 改动 |
|------|------|
| `model/user.go` | 新增字段 + 查询/编辑支持 account_type |
| `common/constants.go` | 新增 AccountType 常量 |
| `controller/user.go` | 创建/查询/转换逻辑 |
| `model/usedata.go` | 4 个统计函数加 accountType 过滤 |
| `controller/usedata.go` | 4 个接口 + 导出解析 account_type |
| `service/feishu_stats_push.go` | 适配新函数签名 |
| `router/api-router.go` | 新增转换路由 |
| `i18n/keys.go` + `locales/*.yaml` | 新增消息和翻译 |

### 前端（16 文件）

| 文件 | 改动 |
|------|------|
| `features/users/types.ts` | User schema 新增字段 |
| `features/users/constants.ts` | 新增 ACCOUNT_TYPE 常量 |
| `features/users/api.ts` | 查询参数 + convertToOrganization |
| `features/users/lib/user-form.ts` | 表单 schema 扩展 |
| `features/users/components/users-table.tsx` | accountType prop |
| `features/users/components/users-columns.tsx` | 条件渲染列 |
| `features/users/components/users-mutate-drawer.tsx` | 条件渲染字段 |
| `features/users/components/data-table-row-actions.tsx` | 转换菜单项 |
| `features/users/components/users-primary-buttons.tsx` | accountType prop |
| `features/users/index.tsx` | accountType prop |
| `features/user-model-stats/api.ts` | accountType 参数 |
| `features/user-model-stats/index.tsx` | accountType prop |
| `hooks/use-sidebar-data.ts` | 新增菜单项 |
| `routes/_authenticated/organization-users/index.tsx` | 新路由 |
| `routes/_authenticated/org-model-stats/index.tsx` | 新路由 |
| `i18n/locales/{en,zh}.json` | 新增翻译 |
