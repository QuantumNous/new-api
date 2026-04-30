# Changes from Upstream

Base: [Calcium-Ion/new-api](https://github.com/Calcium-Ion/new-api) v1.0.0-rc.1

## Deployment

- **docker-compose.yml**: all hardcoded secrets replaced with `${ENV_VAR:-default}` env-var form; postgres service gated behind `profiles: [local]` so it does not start in production
- **Redis password**: added `REDIS_PASSWORD` env var; Redis connection string updated to carry auth credentials
- **.env.local.example** / **.env.prod.example**: aligned with the env-var changes above
- **Watchtower**: added Watchtower service for zero-downtime online upgrades via HTTP API
- **Docker images**: switched to Alibaba Cloud Container Registry (ACR) mirrors for `redis` and `postgres`; application image published to ACR under `reputationly/new-api`

## Configuration

- **`TRUSTED_PROXY_CIDR`**: new env var to configure trusted reverse-proxy subnets for real-IP extraction from `X-Forwarded-For`
- **`BIND_HOST`**: new env var to bind the HTTP listener to a specific interface (default `0.0.0.0`)
- **`STREAMING_TIMEOUT`**: passed through from host env into the container; controls the no-response timeout for streaming requests
- **`VITE_UPDATE_REPO`**: externalised as an env var so the frontend update-check points to this fork instead of upstream

## Features

- **Alipay direct top-up**: native Alipay payment integration (`controller/topup_alipay.go`, `setting/payment_alipay.go`); adds `alipay_direct` payment provider
- **WeChat Pay direct top-up**: native WeChat Pay integration (`controller/topup_wxpay.go`, `setting/payment_wxpay.go`); adds `wxpay_direct` payment provider
- **Playground — localStorage quota warning**: detects when chat history exceeds localStorage capacity and shows a persistent warning with a "Clear conversation" action button (classic theme)
- **Logs — CSV export**: added a CSV export button on the usage-log page (classic theme)
- **i18n — custom locale overlay**: loads translation overrides from `locales/custom/` without modifying core translation files (classic theme)

## CI / Release

- Disabled upstream Docker Hub workflow (no credentials in this fork)
- Added `sync-upstream.yml`: automatically merges upstream releases into `main`
- Added `docker-image-ovaijisuan.yml`: builds and pushes multi-arch images to ACR, creates a GitHub Release with the upstream version tag embedded in the image tag
- Added `sync-base-images.yml`: mirrors `redis` and `postgres` base images to ACR

## Bug Fixes

- **Logs — CSV export**: fixed crash when a paginated export request returns `items: null` for an empty last page; backend now returns `[]` instead of `null` for empty result sets (`model/log.go`), and frontend guards with `?? []` on concat (`web/classic/src/hooks/usage-logs/useUsageLogsData.jsx`)
- **model/option.go**: reverted an incorrect exchange-rate display fix that caused a regression
- **Relay handlers**: fixed model-weight path display in the playground
