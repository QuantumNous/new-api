# Local Binary Startup Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add root-level `start.sh`, `stop.sh`, and `restart.sh` scripts that build and run the current main-branch app as a local `35sz-api` binary on port `9588`.

**Architecture:** The scripts live at the repository root and operate on local files only. `start.sh` builds `35sz-api` when missing or when `REBUILD=1`, starts it with `PORT=9588` in the background, writes logs to `35sz-api.log`, and records the PID in `35sz-api.pid`; `stop.sh` stops the PID and falls back to the fixed port; `restart.sh` composes stop and start. All runtime-facing names in the scripts use `35sz-api` because this is a secondary-development project: binary name, process-facing messages, log file, PID file, and stop output must not use `new-api`. Go module/import paths remain unchanged so the existing codebase still builds.

**Tech Stack:** Bash, Go build, macOS/Linux process tools (`kill`, `lsof`, `nohup`).

---

## File Structure

- Create: `start.sh`
  - Responsibility: build the local Go binary when needed, enforce the default project port `9588`, prevent duplicate starts, launch the process in the background, and write PID/log metadata.
- Create: `stop.sh`
  - Responsibility: gracefully stop the local process by PID file, clean stale PID files, and fall back to stopping any process listening on port `9588`.
- Create: `restart.sh`
  - Responsibility: stop the existing local process and start a fresh one using the two focused scripts above.

No Go code changes are required. No frontend build is required because this project embeds built assets according to the existing main-branch runtime.

---

### Task 1: Add `start.sh`

**Files:**
- Create: `start.sh`

- [ ] **Step 1: Create the startup script**

Write this exact file to `start.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY="$ROOT_DIR/35sz-api"
LOG_FILE="${LOG_FILE:-$ROOT_DIR/35sz-api.log}"
PID_FILE="${PID_FILE:-$ROOT_DIR/35sz-api.pid}"
PORT="${PORT:-9588}"
REBUILD="${REBUILD:-0}"

build_binary() {
  echo "Building 35sz-api binary..."
  cd "$ROOT_DIR"

  local ldflags="-s -w"
  if [[ -f "$ROOT_DIR/VERSION" ]]; then
    local version
    version="$(tr -d '\n' < "$ROOT_DIR/VERSION")"
    ldflags="$ldflags -X github.com/QuantumNous/new-api/common.Version=$version"
  fi

  go build -ldflags "$ldflags" -o "$BINARY"
}

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(tr -d '[:space:]' < "$PID_FILE")"
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "35sz-api is already running with PID $EXISTING_PID."
    echo "Run ./stop.sh first if you want to restart it."
    exit 1
  fi
  echo "Removing stale PID file: $PID_FILE"
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Run ./stop.sh first or set a different PORT."
  exit 1
fi

if [[ "$REBUILD" == "1" || ! -x "$BINARY" ]]; then
  build_binary
fi

if [[ ! -x "$BINARY" ]]; then
  echo "Binary not found or not executable after build: $BINARY"
  exit 1
fi

cd "$ROOT_DIR"
PORT="$PORT" nohup "$BINARY" > "$LOG_FILE" 2>&1 &
PID="$!"
echo "$PID" > "$PID_FILE"

sleep 0.5
if ! kill -0 "$PID" 2>/dev/null; then
  echo "35sz-api failed to start. Check log file: $LOG_FILE"
  rm -f "$PID_FILE"
  exit 1
fi

echo "Started 35sz-api with PID $PID on port $PORT."
echo "Log file: $LOG_FILE"
echo "PID file: $PID_FILE"
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x start.sh
```

Expected: command exits successfully with no output.

- [ ] **Step 3: Syntax-check the script**

Run:

```bash
bash -n start.sh
```

Expected: command exits successfully with no output.

- [ ] **Step 4: Commit this task**

Run:

```bash
git add start.sh
git commit -m "chore: add local binary start script"
```

Expected: commit succeeds. If the user has not requested commits in this session, skip the commit and mention it in the handoff.

---

### Task 2: Add `stop.sh`

**Files:**
- Create: `stop.sh`

- [ ] **Step 1: Create the stop script**

Write this exact file to `stop.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PID_FILE:-$ROOT_DIR/35sz-api.pid}"
PORT="${PORT:-9588}"

stop_pid() {
  local pid="$1"

  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  echo "Stopping process $pid..."
  kill "$pid" 2>/dev/null || true

  for _ in {1..25}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done

  echo "Force stopping process $pid..."
  kill -9 "$pid" 2>/dev/null || true
}

if [[ -f "$PID_FILE" ]]; then
  PID="$(tr -d '[:space:]' < "$PID_FILE")"
  stop_pid "$PID"
  rm -f "$PID_FILE"
else
  echo "PID file not found: $PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  while IFS= read -r PID; do
    stop_pid "$PID"
  done < <(lsof -ti tcp:"$PORT" || true)
fi

echo "Stopped 35sz-api services on port $PORT."
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x stop.sh
```

Expected: command exits successfully with no output.

- [ ] **Step 3: Syntax-check the script**

Run:

```bash
bash -n stop.sh
```

Expected: command exits successfully with no output.

- [ ] **Step 4: Commit this task**

Run:

```bash
git add stop.sh
git commit -m "chore: add local binary stop script"
```

Expected: commit succeeds. If the user has not requested commits in this session, skip the commit and mention it in the handoff.

---

### Task 3: Add `restart.sh`

**Files:**
- Create: `restart.sh`

- [ ] **Step 1: Create the restart script**

Write this exact file to `restart.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$ROOT_DIR/stop.sh"
"$ROOT_DIR/start.sh"
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
chmod +x restart.sh
```

Expected: command exits successfully with no output.

- [ ] **Step 3: Syntax-check the script**

Run:

```bash
bash -n restart.sh
```

Expected: command exits successfully with no output.

- [ ] **Step 4: Commit this task**

Run:

```bash
git add restart.sh
git commit -m "chore: add local binary restart script"
```

Expected: commit succeeds. If the user has not requested commits in this session, skip the commit and mention it in the handoff.

---

### Task 4: Verify local startup behavior

**Files:**
- Verify: `start.sh`
- Verify: `stop.sh`
- Verify: `restart.sh`

- [ ] **Step 1: Run all shell syntax checks together**

Run:

```bash
bash -n start.sh stop.sh restart.sh
```

Expected: command exits successfully with no output.

- [ ] **Step 2: Start the service**

Run:

```bash
./start.sh
```

Expected output includes:

```text
Started 35sz-api with PID
Log file:
PID file:
```

Expected files exist:

```text
35sz-api
35sz-api.log
35sz-api.pid
```

- [ ] **Step 3: Confirm the configured port is active**

Run:

```bash
lsof -ti tcp:9588
```

Expected: prints at least one PID.

- [ ] **Step 4: Confirm restart works**

Run:

```bash
./restart.sh
```

Expected output includes a stop message and then:

```text
Started 35sz-api with PID
```

- [ ] **Step 5: Stop the service**

Run:

```bash
./stop.sh
```

Expected output includes:

```text
Stopped 35sz-api services on port 9588.
```

- [ ] **Step 6: Confirm the port is no longer active**

Run:

```bash
if lsof -ti tcp:9588 >/dev/null 2>&1; then echo "port still active"; exit 1; else echo "port stopped"; fi
```

Expected output:

```text
port stopped
```

- [ ] **Step 7: Review final diff**

Run:

```bash
git diff -- start.sh stop.sh restart.sh
```

Expected: diff only contains the three startup scripts.

---

## Self-Review

- Spec coverage: The plan creates all requested scripts, builds `35sz-api`, runs it in the background, and defaults the project port to `9588`.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: Script variables are consistent across files: `ROOT_DIR`, `PID_FILE`, `PORT`, `BINARY`, and `LOG_FILE`.
- Scope check: This is a single local operational feature and does not require backend or frontend code changes.
