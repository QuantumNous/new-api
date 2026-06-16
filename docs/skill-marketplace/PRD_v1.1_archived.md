# Archived: Skill Marketplace v1.1 Implementation-Ready PRD

This historical monolithic PRD has been superseded by the modular enterprise PRD set. Despite the filename, this file is no longer implementation-ready and must not be used as an implementation contract.

## Why This File Is Archived

The current implementation specification now lives in `tasks/01-07` and `compliance/`. Those files contain the canonical decisions for V1 scope, API contracts, event names, RBAC, Kids mode, billing, security, NFR, release gates, and Sprint readiness.

Keeping the old monolithic body as an active PRD would create avoidable drift for:

- event names
- Kids approval source of record
- RBAC boundaries
- analytics metadata
- CSV/export scope
- streaming and billing behavior
- Sprint 0 decision IDs
- Go/No-Go status

## Current Source of Truth

| Domain | Current Source |
|---|---|
| Overview and Source of Truth | `tasks/00_Overview.md` |
| Functional requirements | `tasks/01_Functional_Requirements.md` |
| UX design | `tasks/02_UX_Design.md` |
| Data model and API spec | `tasks/03_Data_Model_and_API_Spec.md` |
| Analytics and operations | `tasks/04_Analytics_and_Operations.md` |
| Security and NFR | `tasks/05_Security_and_NFR.md` |
| Module WBS and Sprint plan | `tasks/06_Module_Breakdown_WBS.md` |
| CTO consistency gate | `tasks/07_CTO_PRD_Review_Action_Items.md` |
| Compliance controls | `compliance/Skill_Marketplace_Compliance.md` |
| Release checklist | `compliance/03_Release_Readiness_Checklist.md` |

## Canonical Current Status

| Gate | Status |
|---|---|
| Sprint Planning | GO with defaults |
| Module Implementation | CONDITIONAL GO |
| Kids GA | NO-GO by default |
| Production Provider Integration | GATED by `D-05` |
| Production Prompt Storage | GATED by `D-06` |
| Revenue Launch | GATED by `D-07` and Finance sign-off |
| GA Launch | NO-GO |

## Rules

- Do not implement from this archived file.
- Do not copy event names, schemas, API routes, RBAC rules, Kids rules, billing rules, or security controls from this file.
- Any still-useful business context must be migrated into the relevant `tasks/*` PRD before use.
- If this file conflicts with `tasks/01-07` or `compliance/`, the modular PRDs always win.

