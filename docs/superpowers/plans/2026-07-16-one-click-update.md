# One-Click Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Root-only “Pull update” control next to “Check for updates” in system maintenance, supporting binary self-replace (sub2api-style) and Docker self-recreate via docker.sock, pulling deployable artifacts only from the configured fork release/image source.

**Architecture:** New `service/selfupdate` package owns deploy-mode detection, GitHub release check/cache, binary download+checksum+atomic replace, Docker pull+recreate (thin Docker Engine API over sock), and a process-wide single-flight lock + status. Controllers under `/api/system/update/*` and `/api/system/restart` use `RootAuth`. Default frontend calls these APIs from `update-checker-section.tsx`. Independent usage doc at `docs/one-click-update.md`.

**Tech Stack:** Go 1.25 / Gin / testify; React 19 + TypeScript + i18next in `web/default`; optional unix/npipe HTTP to Docker Engine API (no mandatory docker SDK); GitHub Releases REST API.

**Spec:** `docs/superpowers/specs/2026-07-16-one-click-update-design.md`

## Global Constraints

- Runtime update source defaults to fork repo `ChinaToyHunter/new-api` (`NEWAPI_UPDATE_REPO`); never auto-merge upstream into fork inside the app.
- Update APIs are **Root-only** (`middleware.RootAuth()`).
- JSON marshal/unmarshal in business code MUST use `common.Marshal` / `common.Unmarshal` / etc. (not raw `encoding/json` marshal helpers for app logic).
- Go module path stays `github.com/QuantumNous/new-api` (do not rename imports/module).
- Preserve QuantumNous / new-api branding and license headers on new files (AGPL header like existing controllers).
- Frontend user-facing strings: English source keys via `t('...')` + locale files; prefer editing `en.json` / `zh.json` at minimum.
- Do not implement rollback list / version picker / classic theme UI in this plan.
- Checksums required when checksum file exists; if missing for the platform, reject binary update.
- Process-wide single-flight mutex for perform; concurrent perform returns “update in progress”.
- Docker path may only operate on the **current** container; never delete arbitrary containers.
- Deliver standalone `docs/one-click-update.md` (not only this plan/spec).

---

## File map

| Path | Responsibility |
|------|----------------|
| `service/selfupdate/types.go` | Public DTOs: `Info`, `ReleaseInfo`, `Status`, `PerformResult`, deploy mode constants |
| `service/selfupdate/version.go` | Semver-ish compare (`v` prefix strip, major.minor.patch) |
| `service/selfupdate/deploy_mode.go` | Detect `binary` / `docker` + env override |
| `service/selfupdate/config.go` | Read env: enabled, repo, docker host/image, github token |
| `service/selfupdate/github.go` | Fetch latest release + download with host allowlist |
| `service/selfupdate/cache.go` | In-memory update check cache (~20 min) |
| `service/selfupdate/binary.go` | Asset pick, checksum, atomic replace |
| `service/selfupdate/docker.go` | Engine API client over sock: inspect self, pull, recreate |
| `service/selfupdate/service.go` | Facade: Check, Perform, Status, Restart + lock |
| `service/selfupdate/*_test.go` | Unit tests for version, URL allowlist, deploy mode, checksum parse, lock |
| `controller/system_update.go` | HTTP handlers |
| `router/api-router.go` | Register `/api/system` Root routes |
| `web/default/src/features/system-settings/api.ts` | `checkSystemUpdate`, `performSystemUpdate`, `getSystemUpdateStatus`, `restartSystem` |
| `web/default/src/features/system-settings/types.ts` | Response types |
| `web/default/src/features/system-settings/maintenance/update-checker-section.tsx` | Side-by-side buttons + confirm + reconnect |
| `web/default/src/i18n/locales/en.json` (+ `zh.json`) | New strings |
| `docs/one-click-update.md` | Operator-facing usage guide |
| `README.zh_CN.md` (optional one-line link) | Link to usage doc if a natural “运维” section exists; skip if not |

---

### Task 1: Version compare + URL allowlist + deploy mode (core pure logic)

**Files:**
- Create: `service/selfupdate/version.go`
- Create: `service/selfupdate/version_test.go`
- Create: `service/selfupdate/deploy_mode.go`
- Create: `service/selfupdate/deploy_mode_test.go`
- Create: `service/selfupdate/github_url.go` (allowlist helper only)
- Create: `service/selfupdate/github_url_test.go`

**Interfaces:**
- Produces:
  - `func CompareVersions(current, latest string) int` // -1 if current < latest, 0 equal, 1 greater
  - `func NormalizeVersion(v string) string` // trim space, optional leading `v`
  - `type DeployMode string` with `DeployModeBinary`, `DeployModeDocker`
  - `func DetectDeployMode() DeployMode` // reads `NEWAPI_DEPLOY_MODE`, else filesystem/cgroup heuristics
  - `func ValidateDownloadURL(raw string) error`

- [ ] **Step 1: Write failing tests**

```go
// service/selfupdate/version_test.go
package selfupdate

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCompareVersions(t *testing.T) {
	assert.Equal(t, -1, CompareVersions("v1.0.0", "v1.0.1"))
	assert.Equal(t, 0, CompareVersions("1.0.0", "v1.0.0"))
	assert.Equal(t, 1, CompareVersions("v1.2.0", "v1.1.9"))
	assert.Equal(t, -1, CompareVersions("v1.0.0-rc.20", "v1.0.0-rc.21")) // best-effort: if rc not parsed, document fallback as numeric prefix only
}
```

```go
// service/selfupdate/github_url_test.go
package selfupdate

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateDownloadURL(t *testing.T) {
	require.NoError(t, ValidateDownloadURL("https://github.com/ChinaToyHunter/new-api/releases/download/v1/x"))
	require.NoError(t, ValidateDownloadURL("https://objects.githubusercontent.com/github-production-release-asset-2e65be/x"))
	require.Error(t, ValidateDownloadURL("http://github.com/x")) // not https
	require.Error(t, ValidateDownloadURL("https://evil.example/x"))
}
```

```go
// service/selfupdate/deploy_mode_test.go
package selfupdate

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDetectDeployModeOverride(t *testing.T) {
	t.Setenv("NEWAPI_DEPLOY_MODE", "docker")
	assert.Equal(t, DeployModeDocker, DetectDeployMode())
	t.Setenv("NEWAPI_DEPLOY_MODE", "binary")
	assert.Equal(t, DeployModeBinary, DetectDeployMode())
}
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /path/to/new-api
go test ./service/selfupdate/ -count=1
```

Expected: package not found or undefined symbols.

- [ ] **Step 3: Implement minimal code**

`version.go`: strip `v`, split on `.`, parse first 3 numeric segments with `strconv.Atoi` (non-numeric suffix on a segment → treat numeric prefix only via scan, e.g. `0-rc.21` → 0 for that segment if simple parse fails—prefer splitting on non-digit carefully; document that `rc` tags compare by the numeric major.minor.patch **before** pre-release if full semver is too heavy). For tags like `v1.0.0-rc.21`, implement: strip `v`, split by `-` take core `1.0.0` and optional pre `rc.21`; if cores equal, compare pre by splitting `rc.21` numeric tail. Keep under ~80 lines.

`github_url.go`:

```go
func ValidateDownloadURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if u.Scheme != "https" {
		return fmt.Errorf("only HTTPS URLs are allowed")
	}
	host := u.Hostname()
	if host == "github.com" || strings.HasSuffix(host, ".github.com") ||
		host == "objects.githubusercontent.com" || strings.HasSuffix(host, ".githubusercontent.com") {
		return nil
	}
	return fmt.Errorf("download from untrusted host: %s", host)
}
```

`deploy_mode.go`: if env `binary`/`docker` (case-insensitive trim) use it; else if `/.dockerenv` exists → docker; else try read `/proc/1/cgroup` for `docker|containerd|kubepods`; else binary.

- [ ] **Step 4: Run tests — expect PASS**

```bash
go test ./service/selfupdate/ -count=1
```

- [ ] **Step 5: Commit**

```bash
git add service/selfupdate/version.go service/selfupdate/version_test.go \
  service/selfupdate/deploy_mode.go service/selfupdate/deploy_mode_test.go \
  service/selfupdate/github_url.go service/selfupdate/github_url_test.go
git commit -m "feat(selfupdate): add version compare, URL allowlist, deploy mode"
```

---

### Task 2: Config, types, check cache, GitHub latest release client

**Files:**
- Create: `service/selfupdate/types.go`
- Create: `service/selfupdate/config.go`
- Create: `service/selfupdate/cache.go`
- Create: `service/selfupdate/github.go`
- Create: `service/selfupdate/github_test.go` (httptest)

**Interfaces:**
- Produces:
  - `type Config struct { Enabled bool; Repo string; DockerHost string; DockerImage string; GitHubToken string; CacheTTL time.Duration }`
  - `func LoadConfig() Config` // defaults: Enabled=true, Repo=`ChinaToyHunter/new-api`, DockerHost=`unix:///var/run/docker.sock`, CacheTTL=20m
  - `type Info struct { DeployMode DeployMode; CurrentVersion string; LatestVersion string; HasUpdate bool; Release *ReleaseInfo; Docker *DockerCapability; Binary *BinaryCapability; UpdateSource string; Enabled bool; Cached bool; Warning string }`
  - `type ReleaseInfo struct { TagName, Name, Body, HTMLURL, PublishedAt string; Assets []Asset }`
  - `type Asset struct { Name, DownloadURL string; Size int64 }`
  - `type GitHubClient interface { FetchLatestRelease(ctx context.Context, repo string) (*ReleaseInfo, error); Download(ctx context.Context, url, dest string, maxSize int64) error; FetchBytes(ctx context.Context, url string, maxSize int64) ([]byte, error) }`
  - `func NewHTTPGitHubClient(token string, httpClient *http.Client) *HTTPGitHubClient`

- [ ] **Step 1: Write failing test for GitHub client JSON parse via httptest**

```go
func TestHTTPGitHubClient_FetchLatestRelease(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/repos/ChinaToyHunter/new-api/releases/latest", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
		  "tag_name":"v1.0.0-rc.21",
		  "name":"rc21",
		  "body":"notes",
		  "html_url":"https://github.com/ChinaToyHunter/new-api/releases/tag/v1.0.0-rc.21",
		  "published_at":"2026-01-01T00:00:00Z",
		  "assets":[{"name":"new-api-v1.0.0-rc.21","browser_download_url":"https://github.com/ChinaToyHunter/new-api/releases/download/v1.0.0-rc.21/new-api-v1.0.0-rc.21","size":10}]
		}`))
	}))
	defer srv.Close()

	c := NewHTTPGitHubClient("", srv.Client())
	c.APIBase = srv.URL // export field for tests
	rel, err := c.FetchLatestRelease(context.Background(), "ChinaToyHunter/new-api")
	require.NoError(t, err)
	assert.Equal(t, "v1.0.0-rc.21", rel.TagName)
	require.Len(t, rel.Assets, 1)
}
```

- [ ] **Step 2: Run test — FAIL**

```bash
go test ./service/selfupdate/ -run FetchLatest -count=1
```

- [ ] **Step 3: Implement**

`config.go` uses `common.GetEnvOrDefaultBool("NEWAPI_UPDATE_ENABLED", true)`, `common.GetEnvOrDefaultString("NEWAPI_UPDATE_REPO", "ChinaToyHunter/new-api")`, `NEWAPI_DOCKER_HOST`, `NEWAPI_DOCKER_IMAGE`, `NEWAPI_GITHUB_TOKEN`.

`github.go`:
- GET `{APIBase}/repos/{repo}/releases/latest` with headers `Accept: application/vnd.github+json`, `User-Agent: new-api-selfupdate`, optional `Authorization: Bearer {token}`.
- Default `APIBase = "https://api.github.com"`.
- Map assets; on non-2xx return error with status body snippet.
- `Download` / `FetchBytes`: `ValidateDownloadURL` first; `http.NewRequestWithContext`; `io.LimitReader`; write file with `O_CREATE|O_TRUNC`.
- Max download default `500 << 20`.

`cache.go`: package-level mutex + optional cached `Info` snapshot fields needed for check (latest + release + timestamp). TTL from config.

- [ ] **Step 4: PASS**

```bash
go test ./service/selfupdate/ -count=1
```

- [ ] **Step 5: Commit**

```bash
git add service/selfupdate/types.go service/selfupdate/config.go service/selfupdate/cache.go \
  service/selfupdate/github.go service/selfupdate/github_test.go
git commit -m "feat(selfupdate): GitHub release client and config/cache"
```

---

### Task 3: Binary apply path (asset selection, checksum, atomic replace)

**Files:**
- Create: `service/selfupdate/binary.go`
- Create: `service/selfupdate/binary_test.go`

**Interfaces:**
- Consumes: `ReleaseInfo`, `ValidateDownloadURL`, `GitHubClient.Download`/`FetchBytes`, `CompareVersions`
- Produces:
  - `func SelectBinaryAsset(assets []Asset, goos, goarch string) (binary *Asset, checksum *Asset, err error)`
  - `func ParseChecksumFile(data []byte, fileName string) (wantHex string, err error)`
  - `func ApplyBinaryUpdate(ctx context.Context, client GitHubClient, rel *ReleaseInfo, goos, goarch string) error`

**Asset naming rules (match upstream QuantumNous releases):**
- Prefer exact platform heuristics:
  - windows/amd64: name ends with `.exe` or contains `windows`
  - darwin: contains `macos` or `darwin`
  - linux/arm64: contains `arm64`
  - linux/amd64: name matches `new-api-v*` **without** `arm64`/`macos`/`windows`/`.exe`, or contains `linux` and not arm64
- Checksum file: prefer `checksums-linux.txt` / `checksums-macos.txt` / `checksums-windows.txt` by GOOS; also accept `checksums.txt`.

Checksum file format: lines `hex  filename` (sha256).

Atomic replace (Linux primary):
1. Resolve `os.Executable()` + `filepath.EvalSymlinks`
2. Temp dir under exe dir: `.new-api-update-*`
3. Download binary + checksums
4. Verify hash
5. `chmod 0755` on Unix
6. `exe.backup` ← current; new ← exe; on step2 fail restore backup

- [ ] **Step 1: Failing tests**

```go
func TestSelectBinaryAsset_LinuxAmd64(t *testing.T) {
	assets := []Asset{
		{Name: "new-api-arm64-v1.0.0-rc.21", DownloadURL: "https://github.com/x/a"},
		{Name: "new-api-v1.0.0-rc.21", DownloadURL: "https://github.com/x/b"},
		{Name: "checksums-linux.txt", DownloadURL: "https://github.com/x/c"},
	}
	bin, sum, err := SelectBinaryAsset(assets, "linux", "amd64")
	require.NoError(t, err)
	assert.Equal(t, "new-api-v1.0.0-rc.21", bin.Name)
	assert.Equal(t, "checksums-linux.txt", sum.Name)
}

func TestParseChecksumFile(t *testing.T) {
	data := []byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  new-api-v1.0.0-rc.21\n")
	got, err := ParseChecksumFile(data, "new-api-v1.0.0-rc.21")
	require.NoError(t, err)
	assert.Equal(t, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", got)
}
```

- [ ] **Step 2: Run FAIL**

```bash
go test ./service/selfupdate/ -run 'SelectBinary|ParseChecksum' -count=1
```

- [ ] **Step 3: Implement `binary.go`**

Include `ApplyBinaryUpdate` fully; unit-test selection/parse only. Optional integration-style test with temp dir + fake client implementing `GitHubClient` that writes known bytes and checksum—**recommended**:

```go
type fakeGH struct {
	files map[string][]byte
}

func (f *fakeGH) FetchLatestRelease(context.Context, string) (*ReleaseInfo, error) {
	return nil, fmt.Errorf("unused")
}
func (f *fakeGH) Download(_ context.Context, url, dest string, _ int64) error {
	b, ok := f.files[url]
	if !ok {
		return fmt.Errorf("missing %s", url)
	}
	return os.WriteFile(dest, b, 0o644)
}
func (f *fakeGH) FetchBytes(_ context.Context, url string, _ int64) ([]byte, error) {
	b, ok := f.files[url]
	if !ok {
		return nil, fmt.Errorf("missing")
	}
	return b, nil
}
```

For full apply test: build a tiny temp “current binary” file, set env or inject exe path—if `os.Executable` points at test binary, **do not** overwrite the real test binary. Instead export `var executablePath = os.Executable` for test override:

```go
var lookupExecutable = os.Executable
```

In test, point `lookupExecutable` to a temp file path.

- [ ] **Step 4: PASS**

```bash
go test ./service/selfupdate/ -count=1
```

- [ ] **Step 5: Commit**

```bash
git add service/selfupdate/binary.go service/selfupdate/binary_test.go
git commit -m "feat(selfupdate): binary asset selection, checksum, atomic replace"
```

---

### Task 4: Docker Engine client (self inspect, pull, recreate)

**Files:**
- Create: `service/selfupdate/docker.go`
- Create: `service/selfupdate/docker_test.go`

**Interfaces:**
- Produces:
  - `type DockerCapability struct { Image string; SocketAvailable bool; ContainerID string }`
  - `type DockerEngine interface { Ping(ctx context.Context) error; InspectSelf(ctx context.Context) (*ContainerInspect, error); PullImage(ctx context.Context, image string) error; RecreateSelf(ctx context.Context, image string) error }`
  - `func NewDockerEngine(dockerHost string) (DockerEngine, error)`
  - `func ProbeDocker(ctx context.Context, host, imageOverride string) DockerCapability`

**Docker HTTP (no SDK):**
- Transport: `unix` socket path from `unix:///var/run/docker.sock` (Windows `npipe:////./pipe/docker_engine` optional later; document Linux first).
- API version prefix: `/v1.41` (or `/v1.43`) on paths.
- `GET /_ping` → socket available
- Self ID: `os.Hostname()` often equals short container id; `GET /containers/{id}/json` try hostname, then `/containers/json?filters={"id":[...]}` fallback—if fail, SocketAvailable may be true but capability warning.
- `POST /images/create?fromImage=repo&tag=tag` — stream until EOF; treat HTTP error as fail.
- Recreate algorithm:
  1. Inspect full container JSON (Config, HostConfig, NetworkSettings)
  2. Remember name (strip leading `/`)
  3. Pull image (override or Config.Image)
  4. Compare `Image` ID before/after inspect of image; if same digest/id → return sentinel `ErrAlreadyUpToDate`
  5. `POST /containers/{id}/stop`
  6. `POST /containers/{id}/rename?name={name}-updating-old`
  7. `POST /containers/create?name={name}` with body reconstructed from inspect (Image set to pulled ref)
  8. `POST /containers/{newid}/start`
  9. `DELETE /containers/{oldid}?force=true`
  10. On failure after rename: try rename old back + start old

Keep recreate body mapping pragmatic: copy `Env`, `Cmd`, `Entrypoint`, `Labels`, `WorkingDir`, `HostConfig` (Binds, PortBindings, RestartPolicy, NetworkMode, Privileged, Resources, Mounts if present). Prefer forwarding HostConfig from inspect with minimal mutation.

- [ ] **Step 1: httptest-based tests for Ping + Inspect path parsing**

Use `httptest` with custom client transport is hard for unix; instead unit-test pure helpers:
- `parseDockerHost("unix:///var/run/docker.sock") → ("unix", "/var/run/docker.sock")`
- `splitImageTag("calciumion/new-api:latest") → ("calciumion/new-api","latest")`
- Mock `DockerEngine` not required for httptest if client methods accept injectable `do(req)`.

Structure client as:

```go
type engineClient struct {
	do func(*http.Request) (*http.Response, error)
	base string // e.g. "http://docker/v1.41"
}
```

- [ ] **Step 2: FAIL then implement docker.go**

- [ ] **Step 3: PASS**

```bash
go test ./service/selfupdate/ -count=1
```

- [ ] **Step 4: Commit**

```bash
git add service/selfupdate/docker.go service/selfupdate/docker_test.go
git commit -m "feat(selfupdate): Docker Engine self pull and recreate"
```

---

### Task 5: Service facade (Check / Perform / Status / Restart + lock)

**Files:**
- Create: `service/selfupdate/service.go`
- Create: `service/selfupdate/service_test.go`
- Create: `service/selfupdate/status.go` (if preferred separate)

**Interfaces:**
- Produces:
  - `type Service struct { ... }`
  - `func Default() *Service` // package singleton constructed lazily with LoadConfig + real clients
  - `func (s *Service) Check(ctx context.Context, force bool) (*Info, error)`
  - `func (s *Service) Perform(ctx context.Context) (*PerformResult, error)`
  - `func (s *Service) Status() Status`
  - `func (s *Service) Restart(ctx context.Context) error` // binary: schedule `os.Exit(0)` after 500ms; docker: error “use update recreate” or no-op message
  - `type Status struct { Phase string; Message string; Updating bool; Error string; UpdatedAt int64 }`
  - `type PerformResult struct { Message string; NeedRestart bool; AlreadyUpToDate bool; DeployMode DeployMode; FromVersion, ToVersion string }`
  - `var ErrUpdateInProgress = errors.New("update already in progress")`
  - `var ErrAlreadyUpToDate = errors.New("already up to date")`
  - `var ErrUpdateDisabled = errors.New("self-update is disabled")`

**Check logic:**
1. If !Enabled → return Info with Enabled=false, current version `common.Version`
2. DeployMode = DetectDeployMode()
3. Unless force, try cache
4. Fetch latest release from Repo
5. HasUpdate = CompareVersions(current, latest) < 0 (normalize both)
6. Fill Binary capability (asset found for runtime.GOOS/GOARCH)
7. Fill Docker capability via ProbeDocker when mode docker or always probe for UI honesty
8. Save cache; return

**Perform logic:**
1. Try lock (mutex); if held → ErrUpdateInProgress
2. set phase checking → …
3. Check force
4. if !HasUpdate → AlreadyUpToDate result
5. switch mode:
   - binary: ApplyBinaryUpdate; NeedRestart=true
   - docker: require socket; Pull+Recreate; NeedRestart=false (process dies with container)
6. phases updated throughout; defer unlock; on error phase=failed

**Restart:** only binary; `go func(){ time.Sleep(500*time.Millisecond); os.Exit(0) }()` — document that systemd/docker restart policy must bring process back for binary under process manager.

- [ ] **Step 1: Tests with fake GitHub + fake Docker**

```go
func TestService_Perform_AlreadyUpToDate(t *testing.T) {
	// inject current version via field s.currentVersion = "v1.0.0"
	// fake GH returns same tag
	// Perform → AlreadyUpToDate
}

func TestService_Perform_Lock(t *testing.T) {
	// hold lock manually or start blocking Perform; second Perform returns ErrUpdateInProgress
}
```

- [ ] **Step 2–4: Implement, pass, commit**

```bash
go test ./service/selfupdate/ -count=1
git add service/selfupdate/service.go service/selfupdate/service_test.go service/selfupdate/status.go
git commit -m "feat(selfupdate): check/perform/status facade with single-flight lock"
```

---

### Task 6: HTTP controllers + router

**Files:**
- Create: `controller/system_update.go`
- Modify: `router/api-router.go` (after `systemInfoRoute` block ~line 293)

**Interfaces:**
- Consumes: `selfupdate.Default()` methods
- Produces handlers:
  - `CheckSystemUpdate(c *gin.Context)`
  - `PerformSystemUpdate(c *gin.Context)`
  - `GetSystemUpdateStatus(c *gin.Context)`
  - `RestartSystem(c *gin.Context)`

**Handler patterns (match existing):**

```go
func CheckSystemUpdate(c *gin.Context) {
	force := c.Query("force") == "true"
	info, err := selfupdate.Default().Check(c.Request.Context(), force)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, info)
}
```

Map `ErrUpdateInProgress` / `ErrUpdateDisabled` to `ApiError` with clear message. Log Root user id if available from context (same pattern as other admin logs—use existing helper if any; else `c.GetInt("id")` / project’s identity key—**grep** `c.Get(` in controllers for user id key before coding).

**Router:**

```go
systemRoute := apiRouter.Group("/system")
systemRoute.Use(middleware.RootAuth())
{
	systemRoute.GET("/update/check", controller.CheckSystemUpdate)
	systemRoute.POST("/update", controller.PerformSystemUpdate)
	systemRoute.GET("/update/status", controller.GetSystemUpdateStatus)
	systemRoute.POST("/restart", controller.RestartSystem)
}
```

JSON field names: use `json` tags on exported structs in `types.go` with snake_case (`current_version`, `has_update`, `deploy_mode`, `need_restart`, `already_up_to_date`, `update_source`, `socket_available`, …) matching the design spec.

- [ ] **Step 1: Compile check**

```bash
go test ./controller/ ./router/ ./service/selfupdate/ -count=1
```

If controller tests are uncommon, at least `go build -o NUL .` on Windows or `go build -o /dev/null .` on Unix.

- [ ] **Step 2: Commit**

```bash
git add controller/system_update.go router/api-router.go
git commit -m "feat(selfupdate): expose Root-only system update HTTP APIs"
```

---

### Task 7: Frontend API helpers + types

**Files:**
- Modify: `web/default/src/features/system-settings/api.ts`
- Modify: `web/default/src/features/system-settings/types.ts`

**Interfaces:**
- Produces async functions using existing `api` client:

```ts
export type SystemUpdateCheckData = {
  deploy_mode: 'binary' | 'docker'
  current_version: string
  latest_version: string
  has_update: boolean
  release_info?: {
    tag_name: string
    name?: string
    body?: string
    html_url?: string
    published_at?: string
  }
  docker?: { image: string; socket_available: boolean; container_id?: string }
  binary?: { platform: string; asset_found: boolean }
  update_source: string
  enabled: boolean
  cached: boolean
  warning?: string
}

export async function checkSystemUpdate(force = false) {
  const res = await api.get<{ success: boolean; message: string; data: SystemUpdateCheckData }>(
    '/api/system/update/check',
    { params: force ? { force: 'true' } : undefined }
  )
  return res.data
}

export async function performSystemUpdate() {
  const res = await api.post<{ success: boolean; message: string; data: SystemUpdatePerformData }>(
    '/api/system/update'
  )
  return res.data
}

export async function getSystemUpdateStatus() {
  const res = await api.get<{ success: boolean; message: string; data: SystemUpdateStatusData }>(
    '/api/system/update/status'
  )
  return res.data
}

export async function restartSystem() {
  const res = await api.post<{ success: boolean; message: string; data: { message: string } }>(
    '/api/system/restart'
  )
  return res.data
}
```

Align response envelope with how other helpers treat `res.data` (they return `res.data` which is already the axios body including `success`). Follow the same pattern as `getSystemOptions`.

- [ ] **Step 1: Add types + API functions**
- [ ] **Step 2: Typecheck**

```bash
cd web/default && bun run build
```

If full build too heavy, use project’s preferred `bunx tsc -p tsconfig.json --noEmit` if script exists—check `package.json` scripts.

- [ ] **Step 3: Commit**

```bash
git add web/default/src/features/system-settings/api.ts web/default/src/features/system-settings/types.ts
git commit -m "feat(web): API helpers for system self-update"
```

---

### Task 8: UpdateCheckerSection UI (side-by-side buttons)

**Files:**
- Modify: `web/default/src/features/system-settings/maintenance/update-checker-section.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`

**UX requirements from spec:**
- Keep version + uptime cards.
- Button row: flex with gap — **Check for updates** + **Pull update** side by side.
- Check: call `checkSystemUpdate(true)`; if !has_update toast success; else open release dialog (body markdown).
- Pull: disabled when `!enabled` or (`deploy_mode==='docker' && !socket_available`) or while busy; if no has_update, toast already latest (or disable after check).
- Confirm Dialog before pull: show current → latest, deploy_mode, update_source.
- On perform success:
  - binary + need_restart: offer/auto call `restartSystem()` after toast, then poll `/api/status` every 2s up to ~2 min
  - docker: immediately start poll until status OK then reload page or re-check version
- Show warning from check if present.
- Secondary muted text: deploy source is fork; merge upstream on GitHub before releasing.

**Icons:** reuse `RefreshCcwIcon` for check; use `DownloadIcon` or `ArrowDownToLine` from `lucide-react` for pull.

**i18n keys (English source strings):**
- `Pull update`
- `Pulling update...`
- `Confirm update`
- `Update from {{from}} to {{to}} ({{mode}})?`
- `Update completed. Restarting...`
- `Update completed.`
- `Docker socket unavailable. Mount /var/run/docker.sock to enable one-click updates.`
- `Self-update is disabled.`
- `Waiting for service to come back...`
- `Deploy source: {{repo}}. Merge upstream into your fork before publishing releases.`

- [ ] **Step 1: Implement UI changes in `update-checker-section.tsx`**
- [ ] **Step 2: Add locale strings**
- [ ] **Step 3: Build frontend**

```bash
cd web/default && bun run build
```

- [ ] **Step 4: Commit**

```bash
git add web/default/src/features/system-settings/maintenance/update-checker-section.tsx \
  web/default/src/i18n/locales/en.json web/default/src/i18n/locales/zh.json
git commit -m "feat(web): side-by-side check and pull update controls"
```

---

### Task 9: Operator documentation `docs/one-click-update.md`

**Files:**
- Create: `docs/one-click-update.md`
- Modify (optional one link): `README.zh_CN.md` only if there is an existing ops/deploy section—search for `Docker` / `部署` headings; add a single bullet linking to `docs/one-click-update.md`. Do **not** rewrite README branding.

**Doc contents (must include):**
1. What was added (check vs pull)
2. Root-only permission
3. Fork-first source (`NEWAPI_UPDATE_REPO`); upstream merge workflow steps
4. Binary: how to publish GitHub Release assets + checksum files; systemd restart expectation
5. Docker: compose snippet mounting docker.sock; `NEWAPI_DOCKER_IMAGE`; security warning
6. Full env table from spec
7. Troubleshooting table (no update, checksum, socket, permission, stuck updating)
8. Note that classic theme is not covered yet

- [ ] **Step 1: Write the markdown file completely (no TBD)**
- [ ] **Step 2: Commit**

```bash
git add docs/one-click-update.md README.zh_CN.md
git commit -m "docs: add one-click update operator guide"
```

---

### Task 10: End-to-end verification checklist (manual)

**Files:** none required (checklist for implementer)

- [ ] **Step 1: Backend unit suite**

```bash
go test ./service/selfupdate/ -count=1
go build -o new-api-tmp$(go env GOEXE) .
rm -f new-api-tmp$(go env GOEXE)
```

- [ ] **Step 2: Frontend build**

```bash
cd web/default && bun run build
```

- [ ] **Step 3: Manual binary smoke (optional local)**  
Run binary as Root user in test env; mock not required if GitHub reachable; call check API with session cookie.

- [ ] **Step 4: Manual Docker smoke on ali-server (when deploying)**  
Mount sock; open system maintenance; check + pull against fork release/image.

- [ ] **Step 5: Final commit if fixes only**

```bash
git status
# commit any verification fixes
```

---

## Self-review (plan vs spec)

| Spec item | Task |
|-----------|------|
| Side-by-side buttons | Task 8 |
| Root-only APIs | Task 6 |
| Binary sub2api-style | Tasks 3, 5 |
| Docker sock pull/recreate | Tasks 4, 5 |
| Fork-first repo default | Tasks 2, 5, 9 |
| No in-app upstream merge | Global + Task 9 |
| Env vars | Tasks 2, 9 |
| Single-flight lock | Task 5 |
| Checksum required | Task 3 |
| Status phases | Task 5–6 |
| Independent usage doc | Task 9 |
| No rollback list | Out of scope (not scheduled) |
| classic theme | Out of scope |

Placeholder scan: none intentional. Types use consistent `selfupdate.Info` / `PerformResult` / frontend `SystemUpdateCheckData`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-16-one-click-update.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session runs tasks with executing-plans checkpoints  

Which approach?
