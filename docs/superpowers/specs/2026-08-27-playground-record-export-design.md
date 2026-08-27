# 管理员 Playground 记录导出设计

## 背景与目标

`playground_records` 已保存登录用户的 Playground `turn` 与 `clear` 记录，但现有接口只支持保存、恢复当前会话和清空。需要提供一个仅管理员可用的下载接口，用于归档和离线分析历史数据。

本次范围：

- 新增 `GET /api/playground/records/export`。
- 仅 `middleware.AdminAuth()` 通过的管理员可访问。
- 默认导出所有用户的服务端记录；可用正整数 `user_id` 查询参数限定单个用户。
- 返回 UTF-8 JSON 下载文件，保留 `PlaygroundRecord` 的完整字段、嵌套 JSON 原文和 `clear` 记录。
- 按 `user_id`、`client_completed_at`、`record_id`、数据库 `id` 稳定排序。
- 不导出浏览器 `localStorage`、IndexedDB outbox 或未落库草稿；不新增前端 UI。

## API 与数据流

路由在独立的管理员路由组中注册，避免现有 `/api/playground/records` 的普通用户 `UserAuth` 组意外放宽权限：

```text
GET /api/playground/records/export
GET /api/playground/records/export?user_id=123
```

缺失 `user_id` 表示全量；存在时必须是大于 0 的十进制整数，否则返回 HTTP 400 的统一错误响应。控制器调用 model 层查询函数，查询只使用 GORM 条件，不拼接 SQL。响应设置 `Content-Type: application/json; charset=utf-8` 与安全的 `Content-Disposition` 文件名，并输出 JSON 数组；空结果输出 `[]`。

model 层提供按稳定顺序查询记录的函数，controller 使用 `common.Marshal` 生成下载内容。查询只返回 `PlaygroundRecord` 行，不做二次业务聚合；不会把记录正文写入日志。

## 安全与兼容性

- `AdminAuth` 同时覆盖管理员与 root，仍要求现有登录/访问令牌及 `New-Api-User` 身份头。
- `user_id` 过滤在数据库查询层执行，不能通过请求体或其他字段绕过。
- 不修改 `PlaygroundRecord` schema，因此 SQLite、MySQL、PostgreSQL 兼容性沿用现有模型。
- 导出是高敏感数据操作；不添加普通用户别名路由，不返回浏览器侧数据。

## 测试

- model：验证全量和按用户过滤、稳定顺序、包含 `clear` 记录及用户隔离。
- controller：验证管理员导出响应头/JSON、空结果、非法 `user_id`，并验证不受请求上下文中伪造用户字段影响。
- router：验证导出路径注册在管理员保护链路下（沿用现有路由测试方式）。
