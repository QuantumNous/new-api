# Upstream Error 503 Policy

This branch keeps upstream-provider failures private from downstream users.

## Goal

- Local New API errors stay unchanged.
- Upstream-origin errors returned to downstream clients become generic `503 Service Unavailable`.
- User-visible logs also show upstream-origin errors as generic `503 Service Unavailable`.
- Admin/server logs and raw database records keep original details for troubleshooting.

## Downstream Behavior

When an upstream error happens, downstream OpenAI-compatible responses should look like:

```json
{
  "error": {
    "message": "Service Unavailable (request id: ...)",
    "type": "new_api_error",
    "code": "service_unavailable"
  }
}
```

Local errors are not masked. For example, an invalid local token still returns:

```json
{
  "error": {
    "message": "Invalid token (request id: ...)",
    "type": "new_api_error",
    "code": ""
  }
}
```

## User Log Behavior

For ordinary user log APIs, upstream-origin error logs are masked:

- `content` becomes `status_code=503, Service Unavailable`
- `other.status_code` becomes `503`
- `other.error_code` becomes `service_unavailable`
- `other.error_type` becomes `new_api_error`
- channel fields and `upstream_request_id` are hidden from user-visible results

Admin log APIs keep the original error details.

## Main Files

- `types/error.go`
  - Adds `upstreamError` marker on `NewAPIError`.
  - Adds `ApplyDownstreamNewAPIErrorPolicy`.
  - Adds `MarkAsUpstreamError` and `IsUpstreamError`.

- `controller/relay.go`
  - Applies the downstream masking policy at the final response boundary.
  - Records `other.upstream_error` for error logs.

- `service/error.go`
  - Marks errors parsed from upstream non-2xx responses as upstream errors.

- `model/log.go`
  - Masks upstream-origin error logs only when formatting logs for ordinary users.

- `relay/channel/*`
  - Marks provider/body-level errors as upstream errors for channels that construct errors directly.

- Tests:
  - `types/error_policy_test.go`
  - `model/log_test.go`
  - `service/error_test.go`

## Local Test Commands

Use the local Go toolchain. If `proxy.golang.org` is slow, use `goproxy.cn`.

```powershell
$env:GOPROXY='https://goproxy.cn,direct'
F:\workspace\mszb\.codex-tmp\go\go\bin\go.exe test ./types
F:\workspace\mszb\.codex-tmp\go\go\bin\go.exe test ./model -run "TestFormatUserLogs"
F:\workspace\mszb\.codex-tmp\go\go\bin\go.exe test ./service -run "Test(RelayErrorHandler|ResetStatusCode)"
F:\workspace\mszb\.codex-tmp\go\go\bin\go.exe test ./controller -run "^$"
```

Known unrelated failures seen in this source snapshot:

- Full `./service` can fail in channel-affinity usage-cache tests.
- Full `./relay/channel/claude` can fail in existing file-content conversion tests.

For compile-only checks:

```powershell
$env:GOPROXY='https://goproxy.cn,direct'
F:\workspace\mszb\.codex-tmp\go\go\bin\go.exe test ./relay/channel/claude -run "^$"
```

## Frontend Build

The backend embeds both frontend builds. Build them before building the Linux binary:

```powershell
cd F:\workspace\mszb\.codex-tmp\new-api-src\web\default
$env:DISABLE_ESLINT_PLUGIN='true'
$env:VITE_REACT_APP_VERSION=(Get-Content ..\..\VERSION -Raw)
bun run build

cd F:\workspace\mszb\.codex-tmp\new-api-src\web\classic
$env:VITE_REACT_APP_VERSION=(Get-Content ..\..\VERSION -Raw)
bun run build
```

## Local Linux Build

Do not compile on the server. Build locally:

```powershell
cd F:\workspace\mszb\.codex-tmp\new-api-src
$env:GOPROXY='https://goproxy.cn,direct'
$env:GOOS='linux'
$env:GOARCH='amd64'
$env:CGO_ENABLED='0'
$env:GOEXPERIMENT='greenteagc'
$version=''; if (Test-Path VERSION) { $raw=Get-Content VERSION -Raw; if ($null -ne $raw) { $version=$raw.Trim() } }
F:\workspace\mszb\.codex-tmp\go\go\bin\go.exe build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=$version'" -o F:\workspace\mszb\.codex-tmp\new-api-linux-amd64
```

## Deploy To 178

Upload and replace the binary. This does not compile on the server.

```powershell
scp -i E:\MircDL\178.239.117.128_id_ed25519 -P 80 `
  F:\workspace\mszb\.codex-tmp\new-api-linux-amd64 `
  root@178.239.117.128:/opt/new-api/deploy/new-api-upstream-503-logmask

$ts=(Get-Date -Format 'yyyyMMdd-HHmm')
ssh -i E:\MircDL\178.239.117.128_id_ed25519 -p 80 root@178.239.117.128 "
docker cp newapi:/new-api /opt/new-api/backup/new-api.bak-$ts &&
docker cp /opt/new-api/deploy/new-api-upstream-503-logmask newapi:/tmp/new-api-upstream-503-logmask &&
docker exec newapi sh -lc 'cp /new-api /new-api.bak-$ts && chmod +x /tmp/new-api-upstream-503-logmask && mv /tmp/new-api-upstream-503-logmask /new-api && sha256sum /new-api' &&
docker restart newapi
"
```

Verify:

```powershell
ssh -i E:\MircDL\178.239.117.128_id_ed25519 -p 80 root@178.239.117.128 `
  "docker ps --filter name=newapi --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'"
```

Invalid local token should still return 401:

```powershell
ssh -i E:\MircDL\178.239.117.128_id_ed25519 -p 80 root@178.239.117.128 "
curl -sS -i -X POST http://127.0.0.1:3001/v1/responses \
  -H 'Authorization: Bearer invalid-token-for-local-check' \
  -H 'Content-Type: application/json' \
  -d '{\"model\":\"gpt-5.5\",\"input\":\"hi\"}' | head -n 20
"
```

## Rollback

The container keeps timestamped binary backups:

```powershell
ssh -i E:\MircDL\178.239.117.128_id_ed25519 -p 80 root@178.239.117.128 "
docker exec newapi sh -lc 'cp /new-api.bak-YYYYMMDD-HHMM /new-api && chmod +x /new-api' &&
docker restart newapi
"
```

Host backups are stored in:

```text
/opt/new-api/backup/
```

## Updating From Upstream

Recommended workflow:

```powershell
cd F:\workspace\mszb\.codex-tmp\new-api-src
git fetch origin
git switch codex/upstream-error-503-logmask
git rebase origin/main
```

If conflicts happen, resolve them in the files listed in "Main Files", then rerun tests and build/deploy.

Do not deploy the official `calciumion/new-api:latest` directly unless this branch has been rebuilt and redeployed, otherwise these masking changes will be lost.
