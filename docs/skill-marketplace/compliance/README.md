# Skill Marketplace Compliance Directory

本目录是 Skill Marketplace 的独立合规与发布闸门包，供 Legal、Security、Safety、Privacy、Ops、Finance、QA 和 Release Manager 在上线前复核使用。

## Source of Truth

- `tasks/01_Functional_Requirements.md` 到 `tasks/07_CTO_PRD_Review_Action_Items.md` 是产品、数据、API、事件、RBAC、NFR 和 WBS 的实现 Source of Truth。
- 本目录不重定义 API schema、事件字段、错误码或数据库结构；如出现冲突，以 `tasks/01-07` 为准，并必须同步修复本目录。
- Root PRD 文件仅作战略背景，不作为合规验收依据。

## Documents

| File | Purpose | Primary Owners |
|---|---|---|
| `Skill_Marketplace_Compliance.md` | 合规控制板、发布状态、跨文档闸门 | CTO + Compliance |
| `01_Safety_And_Kids_Mode.md` | Kids Mode、安全模型池、平台密钥/路由逻辑防泄露与包内容边界（R2/D-09）、内容安全 | Safety + Security |
| `02_Audit_RBAC_Privacy.md` | 审计日志、RBAC、隐私、导出与保留策略 | Security + Privacy |
| `03_Release_Readiness_Checklist.md` | Sprint Ready / Implementation Ready / GA Launch 检查清单 | Release Manager + QA |

## Required Usage

1. Sprint Planning 可以基于 `D-01` 到 `D-09` 默认值推进（`D-09` = R2 可下载包 + 运行时依赖护城河，见 `tasks/00_Overview.md` §0）。
2. 受影响模块实现前，必须完成对应 owner sign-off。
3. GA Launch 仍为 NO-GO，直到 `03_Release_Readiness_Checklist.md` 中所有启用路径的 P0 闸门完成。
4. 任何涉及 Kids、Prompt、审计、RBAC、隐私、导出、计费或安全事件的变更，必须同步更新本目录和对应 `tasks/*` PRD。

## Sprint Ready Rule

`compliance/` 达到 Sprint Ready 的条件：

- 不覆盖 `tasks/01-07` 的 schema、API、事件、错误码或权限定义。
- 清楚区分 Sprint Planning GO、Module Implementation CONDITIONAL GO、GA Launch NO-GO。
- 每个启用模块都能追踪到 owner、上游 PRD、合规 gate 和可测试验收项。
- P1 / V1.1 / V2 内容不会被误放进 P0 发布闸门。
