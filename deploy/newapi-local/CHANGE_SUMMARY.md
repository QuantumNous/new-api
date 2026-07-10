# Branch Change Summary

This branch adds local deployment support for NewAPI with Seedance video compatibility.

## Backend endpoint metadata

- Adds default endpoint metadata for `openai-video` at `POST /v1/videos`.
- Adds a Seedance-only endpoint type, `seedance-video-native`, for the native Seedance task API:
  - `POST /api/v3/contents/generations/tasks`
  - `GET /api/v3/contents/generations/tasks/{task_id}`
- Marks Doubao video channels as supporting both `openai-video` and `seedance-video-native`.
- Keeps Sora and other generic video channels on `openai-video` only.
- Adds tests for the endpoint mappings above.

## Seedance native compatibility proxy

- Adds `deploy/newapi-local/seedance-compat`, a small Go proxy service.
- Accepts Seedance native task creation/query paths.
- Converts native create requests into NewAPI `/v1/videos` requests.
- Forwards task query requests back to NewAPI task APIs.
- Includes unit tests for request translation and proxy behavior.

## Local Docker deployment

- Adds `deploy/newapi-local/docker-compose.yml` for local SQLite-based deployment.
- Adds `deploy/newapi-local/docker-compose.postgres.yml` for PostgreSQL-based deployment.
- Adds `deploy/newapi-local/docker-compose.dev.mock.yml` for standalone Alibaba video mock debugging.
- Adds `deploy/newapi-local/.env.postgres.example`.
- Adds `gateway/nginx.conf` so one public port can serve both NewAPI and Seedance native compatibility paths.
- Adds a local metadata nginx service for `SYNC_UPSTREAM_BASE=http://metadata`.

## Local metadata copy

- Adds maintainable local copies of NewAPI metadata:
  - `metadata/api/newapi/models.json`
  - `metadata/api/newapi/vendors.json`
  - localized copies under `metadata/api/i18n/*/newapi/`
- These files can be copied to another machine and exposed as one shared metadata source.

## Frontend

- Adds endpoint display support for endpoint aliases in the pricing detail modal.
- Adds default endpoint templates for `seedance-video-native` in model metadata edit screens.
- Keeps the Seedance native endpoint out of the channel test modal because that modal does not go through the gateway compatibility proxy.

## Smoke examples

- Adds `seedance-compat-smoke.json` for Seedance native compatibility smoke tests.
- Adds `remote-seedance-smoke.json` for remote NewAPI video endpoint smoke tests.
