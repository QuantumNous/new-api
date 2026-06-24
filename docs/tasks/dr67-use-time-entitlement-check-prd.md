# DR-67 Basic Use-Time Entitlement Check PRD

Status: eval
Ticket: DR-67
Date: 2026-06-24

## Problem

DR-66 enforces lifecycle and `user_enabled_skills.enabled`, but runtime execution still treats user group as a temporary plan proxy and marks subscriptions active unconditionally. A downloaded or enabled Skill must not become a permanent execution right after the runner's paid subscription expires or downgrades.

## Scope

- Enforce the active SkillVersion `required_plan_snapshot` at use time for `free`, `pro`, and `enterprise`.
- Check the runner's current active subscription at each execution.
- Preserve plan hierarchy: `enterprise` satisfies `pro`; `pro` does not satisfy `enterprise`.
- Keep enablement necessary but not sufficient.
- Flip DR-66's deprecated-skill staged behavior only together with this entitlement gate: deprecated Skills may execute only for currently enabled and still-entitled users.
- Ensure entitlement blocks happen before prompt load and before any billing or quota charge.

## Out Of Scope

- Free quota/monthly quota enforcement.
- Model entitlement intersection.
- New subscription product configuration UI.
- Frontend lock-state changes.

## Acceptance

- Free user on Free Skill is allowed when enabled.
- Free user on Pro Skill is blocked with `SKILL_PLAN_REQUIRED`.
- Pro user with active subscription on Pro Skill is allowed.
- Pro user with inactive/expired paid subscription on Pro Skill is blocked with `SKILL_SUBSCRIPTION_INACTIVE`.
- Enterprise user with active subscription on Pro Skill is allowed.
- Non-enterprise user on Enterprise Skill is blocked with `SKILL_PLAN_REQUIRED`.
- Deprecated, enabled, still-entitled users are allowed; deprecated users without current enablement remain blocked.
- Entitlement blocks do not load prompt content and do not create charge/pre-consume records.

## References

- `docs/skill-marketplace/tasks/01_Functional_Requirements.md` §6, FR-E1..E3
- `docs/skill-marketplace/tasks/05_Security_and_NFR.md` §8.1
- `docs/tasks/dr-66-lifecycle-enabled-gate-prd.md`
