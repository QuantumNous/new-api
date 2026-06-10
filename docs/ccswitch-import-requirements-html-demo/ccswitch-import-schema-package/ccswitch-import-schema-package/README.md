# CC Switch 导入功能表结构包

本包对应「中转站一键导入 CC Switch」功能，包含新增表、业务依赖表、索引和迁移说明。

## 表清单

新增表：

- `ccswitch_import_logs`：记录用户对某个令牌生成 CC Switch 导入链接的审计日志。
- `user_ccswitch_preferences`：记录用户上次选择的导入目标和模型，作为下次弹窗默认值。

业务依赖表：

- `tokens`：现有令牌表。本功能只读取 `id`、`user_id`、`name`、`key` 等字段，不新增 `tokens` 字段；包内 SQL 仅作为结构参考，生产环境不要重建该表。

## 迁移方式

项目代码通过 GORM AutoMigrate 管理新增表：

- `model/ccswitch_import.go`
- `model/main.go`

手工执行 SQL 时，请按实际数据库选择对应文件：

- `sqlite.sql`
- `mysql.sql`
- `postgresql.sql`

## 敏感数据说明

`ccswitch_import_logs` 不保存完整 API Key，也不保存 `ccswitch://` deep link。完整 key 只在后端生成导入链接的瞬间读取和编码。

## 索引说明

新增表索引：

- `ccswitch_import_logs.user_id`
- `ccswitch_import_logs.token_id`
- `ccswitch_import_logs.created_at`
- `user_ccswitch_preferences.user_id` 唯一索引

现有 `tokens` 依赖索引：

- `tokens.key` 唯一索引
- `tokens.user_id`
- `tokens.name`
- `tokens.deleted_at`

