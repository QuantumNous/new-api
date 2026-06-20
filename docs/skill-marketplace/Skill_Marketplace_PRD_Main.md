# Archived: Skill Marketplace Main PRD

This file is retained as historical strategic context only. It is not an implementation source of truth and must not be used by Agents, engineers, QA, Security, Data, or Compliance as the basis for Sprint work.

## Current Source of Truth

Use the modular PRD set under `tasks/`:

| Need | Current Source |
|---|---|
| Product scope, roles, lifecycle, P0/P1/P2, acceptance | `tasks/01_Functional_Requirements.md` |
| UX, IA, page states, error states, accessibility | `tasks/02_UX_Design.md` |
| Data model, enums, API contract, error envelope | `tasks/03_Data_Model_and_API_Spec.md` |
| Events, metrics, dashboards, data quality, operations | `tasks/04_Analytics_and_Operations.md` |
| Security, Kids, RBAC, privacy, NFR, release gates | `tasks/05_Security_and_NFR.md` |
| Agent module breakdown, WBS, Sprint sequencing | `tasks/06_Module_Breakdown_WBS.md` |
| CTO consistency control, decisions, Go/No-Go | `tasks/07_CTO_PRD_Review_Action_Items.md` |
| Compliance gates and release checklist | `compliance/` |

## Canonical Current Status

| Gate | Status |
|---|---|
| Product Direction | GO |
| Sprint Planning | GO with `D-01` to `D-08` defaults |
| Module Implementation | CONDITIONAL GO per module gate |
| GA Launch | NO-GO until M15 release gates and sign-offs pass |

## Rules

- Do not implement from this archived PRD.
- Do not add new requirements here.
- If this file conflicts with `tasks/01-07` or `compliance/`, the modular PRDs always win.
- Strategic background that still matters should be migrated into `tasks/00_Overview.md` or the relevant module PRD before implementation.

