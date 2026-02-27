# 数据库迁移脚本

本目录包含数据库结构变更的迁移脚本。

## 使用说明

### fix_token_model_limits_postgresql.sql

**问题描述：**
当 token 的 `model_limits` 字段内容过长时（超过 1024 字符），PostgreSQL 会报错：
```
ERROR: value too long for type character varying(1024) (SQLSTATE 22001)
```

**解决方案：**
将 `tokens` 表的 `model_limits` 字段类型从 `varchar(1024)` 改为 `text`。

**适用数据库：**
- PostgreSQL

**执行方法：**
```bash
# 连接到 PostgreSQL 数据库
psql -U your_username -d your_database -f fix_token_model_limits_postgresql.sql
```

**注意事项：**
1. 此变更向后兼容，不会影响现有数据
2. MySQL 和 SQLite 用户：GORM 会在下次启动时自动应用 `text` 类型
3. 建议在执行前备份数据库

**相关代码变更：**
- `model/token.go` 第 26 行：`gorm:"type:varchar(1024)"` → `gorm:"type:text"`
