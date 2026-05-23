# DEPLOYMENT.md — AWS Sydney production deployment

Reference for deploying DeepRouter + smart-router as a sidecar pair on AWS. Default target: **Sydney (ap-southeast-2)**, single region, V0 traffic levels (≤ 200 RPM sustained, ≤ 1000 RPM burst).

For local development see [`../DEV.md`](../DEV.md). For the why of architectural shapes see [`adr/`](./adr/). For schema and Redis keys see [`data-model.md`](./data-model.md).

## TL;DR

For prod-only at V0 traffic, the cheapest defensible architecture is:

- **EC2 single instance** (`t3.medium` on a 1-year Savings Plan, ~$27 USD/month)
- Docker compose running deeprouter + smart-router + Postgres + Redis on the same instance
- EBS gp3 50 GB for persistent volumes (Postgres data, configuration)
- Public IPv4 via Elastic IP, TLS via Caddy + Let's Encrypt
- Secrets via SSM Parameter Store (free) — not Secrets Manager
- IAM role on the instance for AWS Bedrock channel + future S3 backups

**Estimated monthly cost** (Sydney, 1-yr Savings Plan): **~$42 USD (≈ $63 AUD)**.

This is the right starting point. Don't over-engineer for traffic you don't have. Detailed scaling thresholds in §6.

## 1. Architecture topology

```
                       ┌─────────────────────────────────┐
                       │  Route 53 (deeprouter.ai)       │
                       │  ACM cert (or Caddy on host)    │
                       └────────────┬────────────────────┘
                                    │
                                    ▼  Elastic IP (static, $3.65/mo)
   ┌────────────────────────────────────────────────────────────────────┐
   │  EC2 t3.medium  (Amazon Linux 2023 or Ubuntu 22.04)                │
   │  IAM role: bedrock:InvokeModel*, ssm:GetParameters, s3:PutObject   │
   │                                                                    │
   │  ┌──────────────────────────────────────────────────────────────┐ │
   │  │ docker compose (-f docker-compose.smart-router.yml)          │ │
   │  │   ┌────────────┐  ┌──────────────┐                           │ │
   │  │   │ deeprouter │◄─┤ smart-router │   localhost loopback only │ │
   │  │   │  :3000     │─►│   :8001      │                           │ │
   │  │   └─────┬──────┘  └──────────────┘                           │ │
   │  │         │                                                     │ │
   │  │   ┌─────▼──────┐  ┌──────────────┐                           │ │
   │  │   │  Postgres  │  │    Redis     │                           │ │
   │  │   │   :5432    │  │    :6379     │                           │ │
   │  │   └────────────┘  └──────────────┘                           │ │
   │  │   (internal docker network only)                              │ │
   │  └──────────────────────────────────────────────────────────────┘ │
   │                                                                    │
   │  EBS gp3 50 GB volume mounted at /var/lib/deeprouter               │
   │  (pg_data + smart-router config + logs)                            │
   └────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (outbound, NAT-less via IGW)
                       Upstream LLM APIs (OpenAI, Anthropic, …)
                       AWS Bedrock (via SDK + instance role)
                       SSM Parameter Store (secrets)
                       S3 (encrypted backups)
```

Notes:
- Single AZ. Multi-AZ requires a load balancer + multi-instance, which roughly doubles the cost. Defer until traffic justifies it.
- Postgres on the instance, **not RDS**. RDS adds ~$25 USD/mo at minimum tier and isn't needed for V0 traffic. Migration path to RDS is clean (dump-restore, switch `SQL_DSN`).
- NAT Gateway is **not** used. The instance has a public IP and routes outbound via IGW directly. NAT is $0.05/hour ($36/mo) — not justified for single-instance deployment.

## 2. Required AWS services

| Service | Configuration | Purpose |
|---|---|---|
| **EC2** | `t3.medium` (2 vCPU, 4 GB), Amazon Linux 2023, on-demand or 1-yr Savings Plan | Compute |
| **EBS gp3** | 50 GB, default 3000 IOPS / 125 MB/s, encryption at rest ON | `pg_data` + smart-router config + logs |
| **VPC** | Default VPC works; if custom, public subnet with IGW | Network |
| **Security Group** | Inbound: `22` (SSH, **restricted to your IP**), `443` (HTTPS). Outbound: all. Do NOT open `3000`, `8001`, `5432`, `6379` | Firewall |
| **Elastic IP** | 1, attached to the instance | Static public IP for DNS |
| **Route 53** | Hosted zone for your domain, A record → EIP | DNS |
| **ACM** | Cert for `*.deeprouter.ai` — only if using ALB; if using Caddy on host, Let's Encrypt handles TLS | TLS cert |
| **IAM Role** (attached to EC2) | Inline policy with `bedrock:InvokeModel*`, `ssm:GetParameters` + `kms:Decrypt` for the SSM-default KMS key, optional `s3:PutObject` for the backup bucket | Service auth without long-lived keys |
| **SSM Parameter Store** | `SecureString` parameters under `/deeprouter/prod/*` | Secret management (free) |
| **S3** (optional) | One bucket for daily `pg_dump` uploads, lifecycle: 7-day retention or longer; bucket policy: instance role only | Backups |
| **CloudWatch Logs** (optional) | CloudWatch Agent on the instance scrapes Docker logs | Log aggregation |

What we **don't** use at V0:
- RDS / Aurora (cost premium not justified)
- ElastiCache (Redis on the instance is fine)
- ALB / NLB (one instance doesn't need it)
- Fargate / ECS (Docker compose on EC2 is simpler and cheaper)
- Secrets Manager (priced per secret + per API call; SSM is free for SecureString)
- NAT Gateway

## 3. Secrets — what goes in SSM

Five environment variables hold real secrets. Names from `model/user.go` / compose files / source code (`common/init.go`, `internal/smart_router_client/client.go`):

| SSM parameter path | Source/Purpose |
|---|---|
| `/deeprouter/prod/SQL_DSN` | Full DSN incl. DB password, e.g. `postgresql://root:STRONGPASS@postgres:5432/new-api` |
| `/deeprouter/prod/REDIS_CONN_STRING` | `redis://:STRONGPASS@redis:6379` |
| `/deeprouter/prod/CRYPTO_SECRET` | `openssl rand -hex 32`. **HMAC secret** for token cache keys (NOT encryption — see [ADR 0004](./adr/0004-channel-key-plaintext.md)) |
| `/deeprouter/prod/SESSION_SECRET` | `openssl rand -hex 32`. Without this, sessions invalidate on every restart |
| `/deeprouter/prod/DEEPROUTER_INTERNAL_TOKEN` | `openssl rand -hex 32`. Shared with smart-router for the `/internal/router-catalog` endpoint |

LLM provider API keys (OpenAI, Anthropic, etc.) are **not** in SSM. They live in the `channels.key` Postgres column (plaintext — see [ADR 0004](./adr/0004-channel-key-plaintext.md)) and are configured via the admin UI. Bedrock is special — see §5.

Pulling secrets into the instance at boot:

```bash
#!/bin/bash
# /usr/local/bin/load-deeprouter-secrets.sh — invoked by systemd before docker compose up
set -euo pipefail

REGION=ap-southeast-2
PREFIX=/deeprouter/prod
ENVFILE=/etc/deeprouter/secrets.env

aws ssm get-parameters-by-path \
  --region "$REGION" \
  --path "$PREFIX" \
  --recursive \
  --with-decryption \
  --query 'Parameters[].[Name,Value]' \
  --output text | \
  awk -v prefix="$PREFIX/" '{
    n = $1; sub(prefix, "", n);
    printf "%s=%s\n", n, $2
  }' > "$ENVFILE"

chmod 600 "$ENVFILE"
```

Then in `docker-compose.smart-router.yml`, use `env_file: /etc/deeprouter/secrets.env` for the relevant services.

## 4. Cost breakdown (Sydney, USD, monthly)

| Item | On-demand | 1-yr Savings Plan | 3-yr SP all-upfront |
|---|---|---|---|
| EC2 `t3.medium` | $38 | $27 | $19 |
| EBS gp3 50 GB | $4.80 | $4.80 | $4.80 |
| Public IPv4 (EIP attached) | $3.65 | $3.65 | $3.65 |
| Route 53 hosted zone | $0.50 | $0.50 | $0.50 |
| Outbound data transfer (50 GB) | $5.70 | $5.70 | $5.70 |
| SSM Parameter Store | $0 | $0 | $0 |
| CloudWatch Logs (5 GB) | $0 (free tier) | $0 | $0 |
| **Total** | **~$53** | **~$42** | **~$34** |

In AUD (at ~1.5 USD/AUD): ~$80 / $63 / $51 per month.

Inflection points:
- **EC2 instance**: t3.medium handles ~50–200 concurrent users. Upgrade to `c7i.large` ($63/mo on-demand) or `m7i.large` ($73) when CPU > 60% sustained.
- **Outbound data transfer**: $0.114/GB after the 100 GB free tier. If you stream a lot, this can outpace EC2 cost. At ~1 TB/mo outbound, transfer alone is ~$110. Mitigations: CloudFront, or VPC endpoint to AWS Bedrock to avoid public-internet egress for that traffic.
- **EBS**: at 50 GB, gp3 default IOPS (3000) handles thousands of Postgres tx/sec. Resize when free space < 20%.

## 5. AWS Bedrock channel — important limitation

`relay/channel/aws/` only supports two credential modes:

1. **ApiKey** — channel `key` formatted as `apikey|region`, sent as bearer token.
2. **AKSK** — channel `key` formatted as `accesskey|secretkey|region`, used via the AWS SDK with static credentials.

**There is no IAM role / instance profile path.** Running this on an EC2 instance with a Bedrock-capable role attached does **not** automatically pick up the role for Bedrock calls. You still need to put credentials into the channel.

Workarounds:
- (Recommended) Use the API key mode with a Bedrock API key generated in the AWS console — simplest.
- Use a long-lived IAM user's access key + secret in AKSK mode — works but means a credential to rotate.
- (Feature work) Add an `IAM` mode that constructs the AWS SDK client with the default credential chain (`config.LoadDefaultConfig`). Then attach `bedrock:InvokeModel*` to the instance role. See `relay/channel/README.md` §"AWS Bedrock specifics" for the file changes required.

## 6. Operational runbook

### Boot

1. Launch EC2 with the IAM role attached and the EBS data volume in user-data scripts (or attach after launch).
2. Install Docker + docker compose:
   ```bash
   dnf install -y docker
   systemctl enable --now docker
   curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
     -o /usr/local/lib/docker/cli-plugins/docker-compose && chmod +x $_
   ```
3. Mount the EBS volume at `/var/lib/deeprouter`. Update `/etc/fstab` for boot persistence.
4. Clone the repo to `/opt/deeprouter`. Run the secrets-load script.
5. `docker compose -f docker-compose.smart-router.yml up -d --build`.
6. First request to `http://<EIP>:3000` registers the root admin. Lock down the SG to block `:3000` afterward; route through Caddy on `:443`.

### Backups

Cron entry on the instance:

```cron
# /etc/cron.d/deeprouter-backup
0 2 * * *  root  /usr/local/bin/backup-deeprouter.sh
```

```bash
#!/bin/bash
# /usr/local/bin/backup-deeprouter.sh
set -euo pipefail

TS=$(date -u +%Y%m%d-%H%M%S)
BUCKET=deeprouter-backups-syd
KEY="prod/${TS}.sql.gz.gpg"

docker compose -f /opt/deeprouter/docker-compose.smart-router.yml exec -T postgres \
  pg_dump -U root new-api | \
  gzip -9 | \
  gpg --batch --encrypt --recipient backup@deeprouter.ai | \
  aws s3 cp - "s3://${BUCKET}/${KEY}" --region ap-southeast-2

# Retention: keep last 7 days
aws s3 ls "s3://${BUCKET}/prod/" --region ap-southeast-2 | \
  awk '{print $4}' | \
  sort -r | \
  tail -n +8 | \
  xargs -I {} aws s3 rm "s3://${BUCKET}/prod/{}" --region ap-southeast-2
```

### Restore drill

1. New EC2 (or same instance after disk-loss event).
2. Fresh `docker compose up`, then immediately `docker compose stop new-api`.
3. `aws s3 cp s3://... - | gpg --decrypt | gunzip | docker compose exec -T postgres psql -U root -d new-api`
4. `docker compose start new-api`.
5. Verify with the curl in `DEV.md` §3.4.

Do this drill quarterly. Untested backups are not backups.

### Common incidents

| Symptom | Likely cause | Action |
|---|---|---|
| `/api/status` 5xx | new-api container crash | `docker compose logs new-api`; check OOM; restart |
| Requests hang on streaming | smart-router unreachable AND `SMART_ROUTER_URL` set non-empty | gateway falls back to default model after timeout (~100ms). If it doesn't, check `internal/smart_router_client/` breaker state in logs |
| All channels showing "auto-disabled" | upstream provider returning 401/403 | a channel key rotated; admin UI → enable + replace key |
| Postgres disk full | `pg_data` exceeded EBS | grow EBS volume (online with gp3), then `resize2fs` |
| Outbound traffic spike | one tenant streaming 10× normal | check `logs` table by `user_id`; cap their quota or rate-limit |

## 7. Scaling beyond V0

Order of changes when traffic grows:

1. **Instance upsize**: `t3.medium` → `c7i.large` → `m7i.xlarge`. Cheap, fast.
2. **Move Postgres to RDS** when (a) you want multi-AZ, or (b) instance memory < Postgres working set. Migration is dump-restore + `SQL_DSN` swap; takes ~30 min for ≤10 GB DB.
3. **Move Redis to ElastiCache** when same concerns. Note: most caches degrade gracefully if Redis is missing; this is rarely the binding constraint.
4. **Horizontal scale** — multiple EC2 instances behind ALB. Requirements:
   - DB must be external (RDS).
   - Redis must be external (ElastiCache) for shared session/rate-limit state.
   - `SESSION_SECRET` must be set (otherwise rolling restarts log everyone out).
   - Smart-router is per-instance sidecar (see [ADR 0003](./adr/0003-sidecar-topology.md)) — no shared state to coordinate.
5. **Multi-region** — out of scope for V0; deferred to V2+. Region failover via Route 53 health checks; cross-region DB replication via RDS read replicas.

## 8. What's intentionally NOT here

- Multi-region active-active. Sydney-only at V0.
- Auto-scaling group. Manual instance management is fine at this size.
- Blue-green deploys. `docker compose up -d --build new-api` is fast enough; downtime is ~5s.
- Fully automated infrastructure. Terraform / CDK would be nice but not required; the runbook is short enough.
- WAF. Cloudflare in front (DNS-only or proxied) is easier and free at this scale.

Add these when you have evidence they're needed, not before.
