# 鉴权体系说明（Auth）

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/api/management/auth.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/api/management/auth.mdx

## 页面大纲

  - 说明
  - 认证方式（二选一）
    - Session
    - Access Token（推荐）
  - 必需请求头
  - 权限级别

## 原文内容

---
title: 鉴权体系说明（Auth）
description: 后台管理接口鉴权方式与权限级别说明
---
## 说明

后台管理接口采用多级鉴权机制，常见为：**公开**、**用户**、**管理员**、**Root**。

## 认证方式（二选一）

### Session

通过登录接口获取 Session：

- `POST /api/user/login`

### Access Token（推荐）

在请求头中携带：

```text
Authorization: Bearer {token}
```

Token 可在「个人设置 - 安全设置 - 系统访问令牌」中生成。

## 必需请求头

部分接口要求携带用户标识请求头：

```text
New-Api-User: {user_id}
```

其中 `{user_id}` 必须与当前登录用户匹配。

## 权限级别

- **公开（Public）**：无需鉴权
- **用户（User）**：需要登录或 Access Token
- **管理员（Admin）**：需要管理员权限
- **Root**：最高权限
