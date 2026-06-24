# DR-79 Publish-Time Skill Packaging PRD

Status: eval
Owner: DeepRouter
Ticket: DR-79
Refs: NEW-1, R2/D-09, FR-A19, M02

## Problem

Published Skill versions need a stable downloadable artifact that is pinned to the exact `skill_version_id` executed by the public routing API. Today package downloads can be built on demand from the active version, which does not make publish the artifact creation boundary.

## Goals

- Build the Skill package during publish.
- Build the Skill package during later version activation for the newly activated `skill_version_id` of an already published Skill.
- Store the immutable zip bytes on the published `skill_versions` row with a checksum and build timestamp.
- Keep downloads retrievable by Skill slug/ID and add version-addressable retrieval by `skill_version_id`.
- Package only the manifest, published instruction template, and thin DeepRouter public-routing client.
- Fail the build if package contents contain provider credentials or server-side routing/model-selection logic.

## Non-Goals

- Add external object storage for package artifacts.
- Add provider-native execution clients to the package.
- Change the public routing API contract from DR-63.
- Change download entitlement semantics from DR-55.

## Requirements

- `POST /api/v1/admin/skills/{skill_id}/publish` must build the package inside the publish transaction before lifecycle/audit/event writes complete.
- `POST /api/v1/admin/skills/{skill_id}/versions/{version_id}/activate` must build and store the target version package inside the activation transaction before version status and active pointer writes complete when the Skill is already published.
- The package manifest must include `skill_id` and `skill_version_id` for the active version being published.
- The package must include `instruction_template.md` from the locked active `SkillVersion`, not mutable Skill metadata.
- The package must include only allowlisted files: `manifest.json`, `SKILL.md`, `instruction_template.md`, and runtime client docs/code.
- The package builder must reject provider credential markers such as provider API key environment names, known provider secret prefixes, AWS static credential names, and direct provider authorization fields.
- The package builder must reject server-side routing/model-selection logic markers such as channel selection helpers, model whitelist snapshots, smart-router internals, upstream relay package paths, and provider routing key indexes.
- `GET /api/v1/marketplace/skill-versions/{skill_version_id}/download` must serve the stored artifact for the published Skill version after normal plan entitlement checks.
- Existing slug/ID download must serve the stored artifact when present and can fall back to on-demand build only for legacy pre-DR-79 fixtures/artifacts.

## Acceptance

- Publishing a valid draft Skill stores a zip artifact on its active `skill_versions` row.
- Activating a later SkillVersion for an already published Skill stores a zip artifact on the newly active `skill_versions` row and rolls back activation when package build fails.
- The stored zip can be downloaded by `skill_version_id`.
- Re-downloading a published version returns the stored bytes instead of rebuilding from later mutable Skill changes.
- Publish fails before lifecycle/audit/event writes when the package contains provider credential markers.
- Publish fails before lifecycle/audit/event writes when the package contains server-side routing/model-selection logic markers.

## Verification

- Focused handler tests for publish-time artifact persistence, immutable version download, and build-fail guards.
- Focused model migration tests for the new package artifact columns.
