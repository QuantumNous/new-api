# router-ai-atius — Podman

The full stack runs natively on **rootless Podman** with no Docker daemon required. This is the production-recommended deployment for the ATIUS mesh (no privilege escalation, runs in user systemd, native cgroups v2, image-compatible with Docker registries).

## Layout

```
podman-compose.yml                              # drop-in for podman-compose
podman/
├── quadlets/                                   # systemd-managed pods
│   ├── router-ai-atius-new-api.container
│   ├── router-ai-atius-model-detailed.container
│   ├── router-ai-atius-postgres.container
│   └── router-ai-atius-redis.container
├── systemd/                                    # generator hints, .env templates
│   └── router-ai-atius.env.example
└── secrets/                                    # placeholder for future podman
                                                #   secret injection paths

scripts/
├── podman-up.sh                                # compose-based dev/CI
├── podman-down.sh
├── podman-migrate-from-docker.sh               # one-shot from Docker
└── podman-quadlets-install.sh                  # one-shot to systemd
```

## Two ways to run

### 1. Compose (dev / CI) — `podman-compose`

```bash
./scripts/podman-up.sh                  # detached, .env-driven
./scripts/podman-up.sh --build         # rebuild model-detailed
./scripts/podman-up.sh --logs          # follow logs
./scripts/podman-down.sh               # stop
./scripts/podman-down.sh --volumes     # also drop pg_data
```

Or directly:

```bash
podman-compose -f podman-compose.yml up -d
podman-compose -f podman-compose.yml down
```

### 2. Quadlets (production) — `systemd --user`

Quadlets are systemd units that Podman owns. The service runs as the user (no `sudo`), survives reboots via `loginctl enable-linger`, and integrates with `journald`.

```bash
./scripts/podman-quadlets-install.sh
# then:
systemctl --user enable --now \
  router-ai-atius-postgres.service \
  router-ai-atius-redis.service \
  router-ai-atius-new-api.service \
  router-ai-atius-model-detailed.service
systemctl --user status
systemctl --user journalctl -u router-ai-atius-new-api -f
```

The `.container` files in `podman/quadlets/` are templates — copy them to `~/.config/containers/systemd/` (the script does this) and edit `EnvironmentFile=` to point at your env file.

## Migrating from Docker

```bash
# Pre-flight: install Podman on the host
sudo apt install podman podman-compose
loginctl enable-linger $USER

# One-shot: dump DB, stop Docker stack, start Podman, restore
./scripts/podman-migrate-from-docker.sh
```

Downtime is roughly **2-5 min** for a 100 MB SQL dump on a 2-vCPU host. Plan a maintenance window.

## Verification checklist

After `./scripts/podman-up.sh`:

```bash
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
# expect:
#   new-api          Up 5m  0.0.0.0:3301->3000/tcp
#   model-detailed   Up 5m  0.0.0.0:3300->3001/tcp
#   db-newapi        Up 5m  5432/tcp
#   redis-newapi     Up 5m  6379/tcp

curl -fs http://localhost:3301/api/status | jq .
# expect: {"success":true, ...}

curl -fs http://localhost:3300/v1/models -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# expect: 5  (M3, M2.7-highspeed, M2.7, deepseek-v4-pro, deepseek-v4-flash)
```

After `systemctl --user start`:

```bash
systemctl --user status router-ai-atius-new-api
systemctl --user is-active router-ai-atius-new-api
# expect: active (running)
```

## Differences from `docker-compose.yml`

| Concern | Docker | Podman |
|---------|--------|--------|
| Daemon | `dockerd` (root) | None (rootless, fork/exec) |
| Orchestrator | `docker compose` | `podman-compose` |
| Service integration | none | `systemd` quadlets |
| Data paths | `/var/lib/docker/volumes/...` | `~/.local/share/containers/storage/...` |
| Image registry | `docker.io/...` | Same (compatible) |
| Network on host | bridge | bridge (CNI) or slirp4netns |
| Privileged ops | `--privileged` flag | `--security-opt label=disable` (rootless) |

The `podman-compose.yml` keeps the same service names (`new-api`, `model-detailed`, `redis`, `postgres`) and the same host-port mapping (`3301:3000`, `3300:3001`) as the Docker stack, so the Apache reverse proxy in front of the stack doesn't need to know which backend is in use.

## Files Reference

| File | Purpose |
|------|---------|
| `podman-compose.yml` | Compose Spec service definition (dev/CI) |
| `podman/quadlets/*.container` | systemd unit templates (production) |
| `scripts/podman-up.sh` | Compose-based bring-up |
| `scripts/podman-down.sh` | Compose-based teardown |
| `scripts/podman-migrate-from-docker.sh` | One-shot Docker → Podman migration |
| `scripts/podman-quadlets-install.sh` | One-shot quadlet install to `~/.config/containers/systemd/` |
| `docs/PODMAN.md` | This file |

## Why not both (Docker + Podman)?

The `docker-compose.yml` is preserved for users who prefer Docker. The Podman setup is recommended for new deployments because:

1. **No daemon**: rootless, runs as the user, no `sudo` after setup.
2. **systemd integration**: quadlets give proper dependency ordering, restart policy, journal logging.
3. **Tighter isolation**: cgroups v2, no `docker.sock` exposed, no privileged socket.
4. **Image-compatible**: pulls the same OCI images from the same registries.

The two stacks are NOT meant to run side-by-side on the same host — they bind the same host ports and the same data path. Pick one.

## Cross-references

- `docker-compose.yml` — legacy (Docker) compose, kept for users without Podman
- `scripts/podman-up.sh`, `scripts/podman-down.sh`, etc. — operational entry points
- `podman/quadlets/router-ai-atius-*.container` — quadlet unit templates
- `docs/MODELS.md` — what `/v1/models` returns (used to verify the model-detailed stack is healthy)
- `docs/ARCHITECTURE.md` § 3 — request flow that the stack serves
- `~/GitHub/obsidian-vault/ideaverse/atius-router/09-PODMAN-MIGRATION.md` — vault note (decision log + alternatives considered)
