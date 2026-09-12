# @tanstack/start-server-core — Skill Spec

Server-side runtime for TanStack Start: createStartHandler, request/response utilities, cookie/session management, three-phase request handling, AsyncLocalStorage context.

## Domains

| Domain         | Description                                                  | Skills            |
| -------------- | ------------------------------------------------------------ | ----------------- |
| Server Runtime | Server request handling, cookies/sessions, AsyncLocalStorage | start-server-core |

## Skill Inventory

| Skill             | Type | Domain         | What it covers                                                   | Failure modes |
| ----------------- | ---- | -------------- | ---------------------------------------------------------------- | ------------- |
| start-server-core | core | server-runtime | createStartHandler, cookies, sessions, three-phase handling, ALS | 2             |

## Failure Mode Inventory

### start-server-core (2 failure modes)

| #   | Mistake                                        | Priority | Source      |
| --- | ---------------------------------------------- | -------- | ----------- |
| 1   | Missing AsyncLocalStorage setup                | HIGH     | source/docs |
| 2   | Incorrect handler export for deployment target | MEDIUM   | source/docs |
