# Pricing Catalog 2026 H1 Refresh PRD

Status: eval
Owner: DeepRouter
Ticket: PR-63

## Problem

DeepRouter's pricing catalog and Quick Import presets need to stay aligned with provider model catalogs. Several existing ratios were stale or missing output-token multipliers, and newly released 2026 H1 models were absent from the default pricing maps and user-facing presets.

If these entries are not maintained, users can hit "price not configured" errors, see retired model IDs in Quick Import, or be billed with outdated input/output ratios.

## Goals

- Correct stale or inaccurate pricing ratios for existing model IDs.
- Add 2026 H1 model IDs that users are likely to import from major providers.
- Add completion/output ratios where output pricing differs from input pricing.
- Add cache ratios for cache-capable Anthropic models.
- Refresh Quick Import channel/model presets so user-facing imports surface current flagship models.
- Keep every Quick Import preset model resolvable by the backend ratio settings.

## Non-Goals

- Build an automated provider pricing sync pipeline.
- Guarantee every bootstrap provider estimate is production-certified without a later provider/model sync pass.
- Change quota conversion semantics or wallet billing units.
- Add new relay adapters or provider-specific request conversion behavior.

## Requirements

- Backend pricing maps must include input ratios for all new Quick Import chat model IDs.
- Backend completion ratios must be explicit for models whose output-token price differs from input-token price and is not covered by existing hardcoded prefix logic.
- Backend cache ratio maps must include cache read/write multipliers for new cache-capable Claude entries.
- Frontend Quick Import provider presets must avoid retired default IDs where practical and point users at current models.
- Frontend model presets must include metadata for newly surfaced flagship chat models.
- Price comments should identify bootstrap or verify-needed entries when the source is not yet backed by a provider sync job.

## Acceptance

- `go test ./setting/ratio_setting/ -count=1` passes.
- `bun run typecheck` from `web/default/` passes.
- `git diff --check origin/main...HEAD` passes.
- GitHub PR quality checks pass.
- Review confirms no Quick Import preset model would miss backend pricing.

## Follow-Ups

- Add a provider/model sync task that validates pricing against models.dev and provider `/models` or pricing endpoints.
- Revisit bootstrap/estimate comments before relying on the new entries for high-volume production billing.
