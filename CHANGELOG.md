# Changelog

DeepRouter gateway 变更记录。规则见 `AGENTS.md` Rule 10。

## 2026-06-20

- 修复 playground 在分组无权时返回 403 `No permission to access this group`：改为静默回退到用户自有分组，第一方 playground 不再因分组不匹配挡住新用户首次请求（`middleware/distributor.go`）
- 新增 `AGENTS.md` Rule 10（每次改动记 CHANGELOG）+ Rule 11（每个任务开工前先写/更新 `docs/tasks/*-prd.md`，带 spec→ship status）
- 新增 `CHANGELOG.md`：建立变更记录文件
