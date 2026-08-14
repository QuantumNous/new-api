# WeChat Epay Adapter

This is an independent Go service that accepts the existing Epay form contract from new-api, creates WeChat Pay Native orders, verifies WeChat notifications, and reliably sends the signed Epay success callback to new-api.

## Build And Test

```powershell
$env:GOROOT='C:\Users\lukezhang\.cache\codex-go\1.25.1\go'
$env:Path='C:\Users\lukezhang\.cache\codex-go\1.25.1\go\bin;'+$env:Path
$env:GOWORK='off'
go test ./...
go build ./...
```

Copy `.env.example` to `.env` and replace every placeholder before running the service. The default configuration targets an independent MySQL 8.x instance. Merchant private keys and WeChat public keys must be mounted read-only under `/run/secrets`; never copy them into the repository or container image.

## Run

```powershell
$env:GOWORK='off'
go run ./cmd/server
```

`/health/live` verifies process liveness. `/health/ready` performs a database read/write transaction and is suitable for deployment readiness checks. `/metrics` and `/api/v1/admin/*` require their separate bearer tokens and should remain private-network endpoints.

For containers, create `secrets/` outside source control, add the required PEM files, create a populated `.env`, and run:

```sh
docker compose -f deploy/docker-compose.yml up -d --build
```

The provided compose file is for controlled environments only. Replace its MySQL credentials, expose the adapter through a TLS reverse proxy, and keep MySQL off the public network.

## Database Backup And Recovery

Take a consistent MySQL backup at least every 15 minutes and retain it according to the production data-retention policy:

```sh
mysqldump --single-transaction --routines --events -h MYSQL_HOST -u wechat_epay -p wechat_epay_adapter > wechat_epay_adapter.sql
mysql -h MYSQL_HOST -u wechat_epay -p wechat_epay_adapter < wechat_epay_adapter.sql
```

Before recovery, stop all adapter instances. Restore into an isolated database first, verify the latest `payment_orders`, `notification_tasks`, and `payment_audit_events` records, then switch traffic and restart instances. Pending and expired notification leases are reclaimed after restart by the durable worker.

## Key Rotation

For WeChat public-key rotation, configure `WECHAT_PREVIOUS_PUBLIC_KEY_ID` and `WECHAT_PREVIOUS_PUBLIC_KEY_FILE` alongside the new key, roll every instance, verify notifications signed by both identifiers, then remove the previous key after WeChat stops using it. Rotate `ADMIN_API_TOKEN` and `METRICS_API_TOKEN` through an upstream gateway overlap and a rolling deployment.

## Troubleshooting And Rollback

Use the protected admin order endpoint to inspect a payment's notification state and to restart only its original `RETRY` or `DEAD` notification task. Do not manually create a notification task or directly mark an order as notified.

For a rollback, drain public traffic, stop instances, deploy the prior compatible binary, retain the same database, secrets, and callback endpoints, then restart. Do not roll back across an incompatible schema migration without restoring a verified database backup.

During planned shutdown, remove the instance from public traffic first. The service stops HTTP intake before the process exits; unfinished notification tasks remain durable and are recovered by a restarted instance.
