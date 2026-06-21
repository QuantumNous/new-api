# DR-80 Runtime Dependency Guard PRD

Status: eval
Owner: DeepRouter
Ticket: DR-80
Refs: NEW-2, R2/D-09, FR-A20, M02

## Problem

Capability-type Skill packages must not be able to complete their work fully offline. Under D-09, the package's real work step depends on DeepRouter's public routing API; removing that call should remove the package's useful capability. The current downloadable package builder emits package files but does not statically verify that the work step invokes DeepRouter.

## Goals

- Add a build-time guard for capability-type Skill packages.
- Reject package builds whose work step has no DeepRouter public routing API call.
- Log a rejection rationale that references D-09.
- Keep compliant packages downloadable.

## Non-Goals

- Implement the full publish pipeline from DR-79.
- Add a new database column for Skill type.
- Prove arbitrary user-authored code cannot evade static analysis.
- Implement runtime execution entitlement or billing checks.

## Requirements

- The package builder runs the guard before writing the zip.
- The guard is scoped so it can be applied only to capability-type packages.
- The guard checks the work step, not just metadata, for a DeepRouter routing call marker such as `/v1/routing/chat/completions`, `/v1/chat/completions`, or `/v1/responses`.
- Rejections return a build error and write a system log containing `D-09`.
- Compliant capability package source content includes an explicit work step that calls DeepRouter with the runner's own key; the build guard must not make an offline-capable Skill pass by injecting that dependency after the fact.
- Legacy unversioned downloads (`active_version_id` absent) are not treated as capability packages until the publish/version pipeline has pinned package metadata; this avoids regressing pre-DR-79 published Skill downloads.

## Acceptance

- A package whose work step has no DeepRouter routing call is rejected.
- A package whose existing work step calls DeepRouter's public routing API passes.
- The rejection rationale references D-09 in logs and errors.
- Focused tests for the package builder and guard pass.
