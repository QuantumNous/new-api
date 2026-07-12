---
name: docker-deploy
description: >-
  Build Docker image for the current Git branch, push to the private registry
  (registry.local:5000), and deploy / update the remote service via Docker
  Compose on the `new-api-deploy` host. Covers building, pushing, testing the
  pull, and rolling-update with zero data loss.
---

# Docker Build & Remote Deploy Workflow

## Overview

This project uses a multi-stage Dockerfile to build a Go backend + React
frontend image. Deployment is managed with Docker Compose on the remote host.

The standard workflow is:

1. Build image locally from current branch
2. Push to `registry.local:5000/ai/new-api`
3. SSH to `new-api-deploy` host, update the image tag in `compose.yaml`
4. Pull the new image and recreate the container via `docker compose up -d`

All data lives in a host bind-mount (`./data:/data` relative to the Compose
project directory), so stopping / removing / recreating the container is safe.

## Prerequisites

### Local Docker daemon

`/etc/docker/daemon.json` must include the insecure registry:

```json
{
  "insecure-registries": ["registry.local:5000"]
}
```

After editing, restart Docker:

```bash
sudo systemctl restart docker
```

### Remote host (`new-api-deploy`)

Docker on the remote host must also trust the registry. Verify with:

```bash
ssh new-api-deploy "docker info 2>/dev/null | grep -A2 'Insecure Registries'"
```

Expected output includes `registry.local:5000`.

If missing, add it on the remote host and restart Docker:

```bash
ssh new-api-deploy "sudo tee /etc/docker/daemon.json <<< '{\"insecure-registries\":[\"registry.local:5000\"]}' && sudo systemctl restart docker"
```

## Configuration Reference

| Key | Value |
|---|---|
| Registry | `registry.local:5000` |
| Image name | `ai/new-api` |
| Tag format | Current Git branch with `/` → `-` |
| Container name | `new-api-app-1` (Compose auto-generated) |
| Compose file | `/home/ubuntu/new-api/compose.yaml` |
| Compose project | `new-api` |
| Service name | `app` |
| Host port | `3000` → container `3000` |
| Data volume | `./data:/data` (relative, resolves to `/home/ubuntu/new-api/data:/data`) |
| Restart policy | `always` |
| Environment | `TZ=Asia/Shanghai`, `GLOBAL_WEB_RATE_LIMIT_ENABLE=false`, `GLOBAL_API_RATE_LIMIT_ENABLE=false` |
| Working dir | `/data` |

## Workflow

### Step 1: Build image

```bash
BRANCH=$(git branch --show-current | sed 's/\//-/g')
docker build -t registry.local:5000/ai/new-api:$BRANCH .
```

The build compiles:
- `web/default` (Rsbuild, React 19)
- `web/classic` (Rsbuild, React 18)
- Go binary with `-ldflags "-s -w -X ...Version=..."`

### Step 2: Push to registry

```bash
docker push registry.local:5000/ai/new-api:$BRANCH
```

If the push fails with `server gave HTTP response to HTTPS client`, confirm
Step 1 prerequisites.

### Step 3: Update compose.yaml on remote host

SSH to the remote host and update the image tag in `compose.yaml`:

```bash
ssh new-api-deploy "sed -i 's|image: registry.local:5000/ai/new-api:.*|image: registry.local:5000/ai/new-api:$BRANCH|' /home/ubuntu/new-api/compose.yaml"
```

Verify the change:

```bash
ssh new-api-deploy "grep 'image:' /home/ubuntu/new-api/compose.yaml"
```

Expected output:
```
    image: registry.local:5000/ai/new-api:feature-design-frontend
```

### Step 4: Pull and recreate via Docker Compose

```bash
ssh new-api-deploy "
cd /home/ubuntu/new-api
docker compose pull app
docker compose up -d app
"
```

- `docker compose pull app` downloads the latest image for the `app` service
- `docker compose up -d app` recreates the container if the image changed (no
  `down` needed — Compose detects the image change and recreates automatically)

### Step 5: Verify deployment

```bash
ssh new-api-deploy "
cd /home/ubuntu/new-api
docker compose ps
docker logs --tail 20 new-api-app-1
"
```

Expected logs:

```
  AI Gateway  ready in ... ms

  ➜  Network: http://172.18.0.2:3000/
```

At this point the service is live and API requests can resume.

## One-shot Complete Script

If you need to do the entire flow in one go:

```bash
#!/usr/bin/env bash
set -euo pipefail

BRANCH=$(git branch --show-current | sed 's/\//-/g')
IMAGE="registry.local:5000/ai/new-api:$BRANCH"

echo "=== 1. Build ==="
docker build -t "$IMAGE" .

echo "=== 2. Push ==="
docker push "$IMAGE"

echo "=== 3. Update compose.yaml on remote ==="
ssh new-api-deploy "sed -i 's|image: registry.local:5000/ai/new-api:.*|image: $IMAGE|' /home/ubuntu/new-api/compose.yaml"

echo "=== 4. Remote pull + compose up ==="
ssh new-api-deploy "
cd /home/ubuntu/new-api
docker compose pull app
docker compose up -d app
"

echo "=== 5. Verify ==="
ssh new-api-deploy "cd /home/ubuntu/new-api && docker compose ps && docker logs --tail 10 new-api-app-1"
```

## Compose Configuration

The canonical `compose.yaml` on the remote host:

```yaml
services:
  app:
    image: registry.local:5000/ai/new-api:feature-design-frontend
    restart: always
    ports:
      - "3000:3000"
    environment:
      - TZ=Asia/Shanghai
      - GLOBAL_WEB_RATE_LIMIT_ENABLE=false
      - GLOBAL_API_RATE_LIMIT_ENABLE=false
    volumes:
      - ./data:/data
    working_dir: /data
```

## Troubleshooting

### `server gave HTTP response to HTTPS client`

- **Local**: Restart Docker after adding `insecure-registries`.
- **Remote**: Same fix on the `new-api-deploy` host.

### Container fails to start after recreate

Check for data / migration issues:

```bash
ssh new-api-deploy "docker logs --tail 50 new-api-app-1"
```

The SQLite database lives in `/home/ubuntu/new-api/data` on the host, so
migrations are applied against the same file on every start.

### Image tag mismatch

The tag is derived from the Git branch name. If the branch contains `/`, it
is replaced with `-`. Ensure you use the exact same tag string when updating
`compose.yaml`.

### Compose warning about `version` field

The `version: '3.8'` field in `compose.yaml` is obsolete in modern Docker
Compose but harmless. It can be safely removed.

## Key Rules

1. **Always update the image tag in `compose.yaml`** before running
   `docker compose up -d`, otherwise Compose won't know the image changed.
2. **Never remove the bind-mount** `./data:/data` — that is where SQLite and
   all persistent state live.
3. **Use `docker compose pull app` before `docker compose up -d app`** to
   ensure the latest image is available.
4. **Restart policy must be `always`** so the service comes back after
   host reboot.
5. **Container is managed by Compose** — do not use `docker stop/rm/run`
   directly; always use `docker compose up -d`.
