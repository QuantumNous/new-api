# Skill Hub 按标签查询的 PostgreSQL 兼容性修复

## 问题

`GET /api/skill-hub/tags/skills` 与 `GET /api/admin/skill-hub/tags/skills` 原先通过关联标签表后使用 `SELECT DISTINCT skill_hub_skills.*` 去重，同时按包含 `CASE WHEN` 的表达式排序。PostgreSQL 要求 `SELECT DISTINCT` 查询中的排序表达式必须出现在选择列表中，因此请求会返回 `SQLSTATE 42P10`。

## 修复

按标签筛选改为使用关联表的 Skill ID 子查询：主查询通过 `skill_hub_skills.id IN (subquery)` 获取结果。`IN` 本身不会因子查询中的重复 ID 产生重复主表记录，因此不再需要 `DISTINCT`，原有标签并集筛选、关键字筛选、发布状态、推荐状态、分页与排序语义保持不变。

该查询仅使用 GORM 与三种数据库均支持的标准 SQL 结构，适用于 SQLite、MySQL 和 PostgreSQL。公开接口与管理员接口共用同一模型查询，因此同时生效。本次变更不涉及前端接口契约或页面行为，无需修改 `web/classic` 与 `web/default`。
