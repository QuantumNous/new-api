# Upstream Sync Workflow

This repository now separates upstream sync from downstream ByteCola customization.

## Branch model

- `upstream-main`: mirror of `upstream/main`
- `main`: product branch with the ByteCola overlay and local deployment docs
- `sync/upstream-YYYYMMDD`: review branch generated from `upstream-main`

## What the workflow preserves

The sync job replays only the downstream layer that should survive upstream updates:

- ByteCola documentation under `docs/branding/`
- ByteCola static assets under `web/default/public/`
- Default UI overlay source under `web/default/src/branding/`
- Sync automation files under `scripts/upstream-sync/` and `.github/workflows/upstream-sync.yml`

Protected upstream identifiers remain on the upstream path by default. The ByteCola overlay is applied through an opt-in frontend brand profile instead of replacing the upstream project identity in source defaults.

## GitHub automation

Workflow file: `.github/workflows/upstream-sync.yml`

Triggers:

- Weekly schedule
- Manual `workflow_dispatch`

Manual inputs:

- `upstream_ref`: defaults to `upstream/main`
- `source_ref`: defaults to `origin/main`
- `brand_profile`: defaults to `bytecola`

The workflow will:

1. Fast-forward `upstream-main` to the chosen upstream ref.
2. Create a fresh `sync/upstream-YYYYMMDD` branch from `upstream-main`.
3. Replay the preserved ByteCola layer.
4. Build the default frontend, build the classic frontend, then run backend compile validation.
5. Push the mirror and sync branches.
6. Open or update a PR into `main`.

## Frontend brand overlay

The new default frontend keeps upstream behavior unless the brand profile is explicitly enabled:

```bash
cd web/default
VITE_PUBLIC_BRAND_PROFILE=bytecola bun run dev
```

With `VITE_PUBLIC_BRAND_PROFILE=bytecola`, the default UI uses ByteCola fallback branding for:

- title and favicon/meta helpers
- default logo and system name
- About page fallback markdown
- footer fallback HTML
- home hero copy

If the backend already returns `system_name`, `logo`, `About`, or `Footer`, those runtime values still take precedence.
