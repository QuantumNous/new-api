---
name: docker-deploy
description: >-
  Build Docker image for the current Git branch, push to the private registry
  (registry.local:5000), and deploy / update the remote container on the
  `new-api-deploy` host via SSH. Covers building, pushing, testing the pull, and
  rolling-update with zero data loss.
---

# Docker Build & Remote Deploy Workflow

## Overview

This project uses a multi-stage Dockerfile to build a Go backend + React
frontend image. The standard workflow is:

1. Build image locally from current branch
2. Push to `registry.local:5000/ai/new-api`
3. SSH to `new-api-deploy` host, test pulling the new image
4. Recreate the container with the exact same runtime config

All data lives in a host bind-mount (`/home/ubuntu/pigsty/data:/data`), so
stopping / removing / recreating the container is safe.

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
| Container name | `new-api-latest` |
| Host port | `3000` → container `3000` |
| Data volume | `/home/ubuntu/pigsty/data:/data` |
| Restart policy | `always` |
| Environment | `TZ=Asia/Shanghai`, `GLOBAL_API_RATE_LIMIT_ENABLE=false` |
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

### Step 3: Test pull on remote host

```bash
ssh new-api-deploy "docker pull registry.local:5000/ai/new-api:$BRANCH"
```

Expected: `Status: Downloaded newer image` (or `Image is up to date` if
layers were already cached).

### Step 4: Inspect current container config (optional but recommended)

Before replacing, capture the running config:

```bash
ssh new-api-deploy "docker inspect new-api-latest --format '{{json .Config}}' | python3 -m json.tool"
ssh new-api-deploy "docker inspect new-api-latest --format '{{json .HostConfig}}' | python3 -m json.tool"
```

Key fields to preserve: `Env`, `Binds`, `PortBindings`, `RestartPolicy`.

### Step 5: Rolling update (stop → remove → recreate)

Run this as a single SSH command so the session stays open for all steps:

```bash
ssh new-api-deploy "
docker stop new-api-latest
docker rm new-api-latest
docker run -d \
  --name new-api-latest \
  --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -e GLOBAL_API_RATE_LIMIT_ENABLE=false \
  -v /home/ubuntu/pigsty/data:/data \
  --workdir /data \
  registry.local:5000/ai/new-api:$BRANCH
"
```

### Step 6: Verify deployment

```bash
ssh new-api-deploy "docker ps --filter 'name=new-api-latest' --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'"
ssh new-api-deploy "docker logs --tail 20 new-api-latest"
```

Expected log lines:

```
[SYS] ... | system is already initialized at: ...
[SYS] ... | New API  started
AI Gateway ready in ... ms
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

echo "=== 3. Remote pull test ==="
ssh new-api-deploy "docker pull $IMAGE"

echo "=== 4. Rolling update ==="
ssh new-api-deploy "
docker stop new-api-latest
docker rm new-api-latest
docker run -d \
  --name new-api-latest \
  --restart always \
  -p 3000:3000 \
  -e TZ=Asia/Shanghai \
  -e GLOBAL_API_RATE_LIMIT_ENABLE=false \
  -v /home/ubuntu/pigsty/data:/data \
  --workdir /data \
  $IMAGE
"

echo "=== 5. Verify ==="
ssh new-api-deploy "docker ps --filter 'name=new-api-latest' --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'"
```

## Troubleshooting

### `server gave HTTP response to HTTPS client`

- **Local**: Restart Docker after adding `insecure-registries`.
- **Remote**: Same fix on the `new-api-deploy` host.

### Container fails to start after recreate

Check for data / migration issues:

```bash
ssh new-api-deploy "docker logs --tail 50 new-api-latest"
```

The SQLite database lives in `/home/ubuntu/pigsty/data` on the host, so
migrations are applied against the same file on every start.

### Image tag mismatch

The tag is derived from the Git branch name. If the branch contains `/`, it
is replaced with `-`. Ensure you use the exact same tag string on both the
build host and the remote host.

## Key Rules

1. **Never remove the bind-mount** `/home/ubuntu/pigsty/data:/data` — that
   is where SQLite and all persistent state live.
2. **Preserve all environment variables** from the previous container.
3. **Test the pull before recreating** the container.
4. **Use `docker stop` + `docker rm` + `docker run`** rather than
   `docker restart` so the new image is actually used.
5. **Restart policy must be `always`** so the service comes back after
   host reboot.
