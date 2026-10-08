#!/usr/bin/env bash
# 切换机制需在 GS-467 用控制面真实值核对后确定（候选：Coolify 原始 API 的 PATCH docker_image；或在面板手动改镜像字段）。
# Offline deliverable: --execute is fail-closed until the adapter is established.
# 2.1 执行前用当前值核对：所有 REQUIRED_* 字段及适配脚本能力、数据库恢复权限。
# Installed `coolify service --help` has no image update command. The documented
# coolify_api.py allowlist has no service Compose update recipe either. Do not
# invent an API PATCH or replace it with SSH/docker mutation. Supply a reviewed
# control-plane adapter only after the exact installed CLI/API capability is known.
#
# Adapter executable interface (arguments, never eval):
#   assert-identity CONTEXT SERVICE TEAM_ID TEAM_NAME PROJECT_UUID PROJECT_NAME
#                   ENV_UUID ENV_NAME DEST_UUID SERVER_UUID SERVER_NAME UNIT_NAME
#     Fresh UUID-addressed read; fail unless every ownership field matches.
#   stop-writes / assert-stopped / resume-writes CONTEXT SERVICE
#     Block public writes AND drain/stop application writers, leaving PG running.
#   backup-config CONTEXT SERVICE OUTPUT_FILE
#     Save complete restorable configuration privately, never print it.
#   current-image CONTEXT SERVICE -> exactly repository@sha256:digest
#   set-image CONTEXT SERVICE IMAGE
#     Approved Coolify control-plane mutation only; preserve other config.
#   deploy-wait CONTEXT SERVICE IMAGE
#     Wait for queued action completion, assert running digest; don't blindly retry.
#   stop-app-wait CONTEXT SERVICE
#     Stop/drain application before database restore, leave PG running.
#   restore-config CONTEXT SERVICE INPUT_FILE
#   probe-login / probe-model-key / probe-tool-stream / probe-sse CONTEXT SERVICE BASE_URL
#     Fail on semantic failure: valid login session; model access with test key;
#     complete tool-call sequence; SSE headers, ordered events and termination.
#     Use a private maintenance bypass, never reopen public writes to probe.
# Each control-plane operation must use explicit --context and redact output;
# never context use/list, tokens on argv, raw API recipes or bare Docker writes.
# Adapter must reconcile ambiguous writes by fresh reads before returning failure.
set -Eeuo pipefail

ROLLBACK_IMAGE=${ROLLBACK_IMAGE:-hubwu42/new-api@sha256:65325f4695382008833ab4806abfe5d1ffd81693b3980068e9d2f0c4dc631d8e}
TARGET_IMAGE=${TARGET_IMAGE:-calciumion/new-api@sha256:3293fc3d13bbf243ae720d9c4e0b8049e8ed01f5c130d3bdcdad8a1a2c7e57ed}
SERVICE_UUID=nxaaajntzlycy98lwxrgcygx
TEAM_NAME=GoSail
PROJECT_NAME=platform
ENVIRONMENT_NAME=production
UNIT_NAME=linksail
SERVER_NAME=km-kunming
# 2.1 执行前用当前值核对：离线占位符绝不允许进入实跑。
COOLIFY_CONTEXT=${COOLIFY_CONTEXT:-REQUIRED_CONTEXT}
TEAM_ID=${TEAM_ID:-REQUIRED_TEAM_ID}
PROJECT_UUID=${PROJECT_UUID:-REQUIRED_PROJECT_UUID}
ENVIRONMENT_UUID=${ENVIRONMENT_UUID:-REQUIRED_ENVIRONMENT_UUID}
DESTINATION_UUID=${DESTINATION_UUID:-REQUIRED_DESTINATION_UUID}
SERVER_UUID=${SERVER_UUID:-REQUIRED_SERVER_UUID}
CONTROL_ADAPTER=${CONTROL_ADAPTER:-REQUIRED_REVIEWED_ADAPTER}
PGSERVICE=${PGSERVICE:-REQUIRED_PG_SERVICE}
PGSERVICEFILE=${PGSERVICEFILE:-REQUIRED_PRIVATE_PG_SERVICE_FILE}
BASE_URL=${BASE_URL:-https://REQUIRED_PRIVATE_PROBE_ENDPOINT}
BACKUP_DIR=${BACKUP_DIR:-REQUIRED_NEW_PRIVATE_BACKUP_DIRECTORY}
export PGSERVICE PGSERVICEFILE

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
usage() { printf '%s\n' 'Usage: bash switch.sh --dry-run|--execute [--rollback]' 'Real execution requires approved 2.1 inputs and reviewed CONTROL_ADAPTER; default is refusal.'; }
dry=0; execute=0; rollback=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry=1 ;;
    --execute) execute=1 ;;
    --rollback) rollback=1 ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown argument: $arg" ;;
  esac
done
[[ $((dry + execute)) == 1 ]] || fail 'Choose exactly one of --dry-run or --execute.'
[[ $ROLLBACK_IMAGE =~ ^hubwu42/new-api@sha256:[0-9a-f]{64}$ ]] || fail 'Invalid rollback digest.'
[[ $TARGET_IMAGE =~ ^calciumion/new-api@sha256:[0-9a-f]{64}$ ]] || fail 'Invalid official digest.'
[[ $BASE_URL == https://* && $BASE_URL != *'@'* && $BASE_URL != *'?'* && $BASE_URL != *'#'* ]] || fail 'BASE_URL must be HTTPS without credentials/query/fragment.'
for field in COOLIFY_CONTEXT TEAM_ID PROJECT_UUID ENVIRONMENT_UUID DESTINATION_UUID SERVER_UUID CONTROL_ADAPTER PGSERVICE PGSERVICEFILE BASE_URL BACKUP_DIR; do
  value=${!field}
  [[ -n $value && $value != *$'\n'* && $value != *$'\r'* ]] || fail "Invalid input: $field"
  printf 'INPUT %s=%q' "$field" "$value"
  if [[ $value == *REQUIRED_* ]]; then
    printf ' [UNRESOLVED: 2.1 执行前用当前值核对]'
    [[ $dry == 1 ]] || fail "Missing live input: $field"
  fi
  printf '\n'
done
printf 'TARGET=%s\nROLLBACK=%s\n' "$TARGET_IMAGE" "$ROLLBACK_IMAGE"
printf 'IDENTITY service=%s team=%s project=%s environment=%s unit=%s server=%s\n' "$SERVICE_UUID" "$TEAM_NAME" "$PROJECT_NAME" "$ENVIRONMENT_NAME" "$UNIT_NAME" "$SERVER_NAME"
# Dry-run does not even invoke help/get, read credential files or create directories.
# Explicitly supplied files must exist, but their contents are not read in dry-run.
[[ $CONTROL_ADAPTER == REQUIRED_* || ( -f $CONTROL_ADAPTER && -x $CONTROL_ADAPTER ) ]] || fail 'CONTROL_ADAPTER is missing or not executable.'
[[ $PGSERVICEFILE == REQUIRED_* || ( -f $PGSERVICEFILE && -r $PGSERVICEFILE ) ]] || fail 'PGSERVICEFILE is missing or unreadable.'
if [[ $rollback == 1 && $BACKUP_DIR != REQUIRED_* ]]; then
  for file in main.dump config.backup current-image; do
    [[ -s $BACKUP_DIR/$file ]] || fail "Rollback backup missing: $BACKUP_DIR/$file"
  done
fi

run() {
  if [[ $dry == 1 ]]; then printf 'CALL'; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}
control() { run "$CONTROL_ADAPTER" "$1" "$COOLIFY_CONTEXT" "$SERVICE_UUID" "${@:2}"; }
identity() { control assert-identity "$TEAM_ID" "$TEAM_NAME" "$PROJECT_UUID" "$PROJECT_NAME" "$ENVIRONMENT_UUID" "$ENVIRONMENT_NAME" "$DESTINATION_UUID" "$SERVER_UUID" "$SERVER_NAME" "$UNIT_NAME"; }
mutate() { identity; control "$@"; identity; }
health() {
  printf 'STEP health: /api/status, login, model Key, tool stream, SSE path\n'
  if [[ $dry == 1 ]]; then
    run curl --fail --silent --show-error --connect-timeout 10 --max-time 30 "${BASE_URL%/}/api/status"
    printf 'ASSERT /api/status JSON .success == true\n'
  else
    curl --fail --silent --show-error --connect-timeout 10 --max-time 30 "${BASE_URL%/}/api/status" | jq -e '.success == true' >/dev/null
  fi
  control probe-login "$BASE_URL"
  control probe-model-key "$BASE_URL"
  control probe-tool-stream "$BASE_URL"
  control probe-sse "$BASE_URL"
}
restore() {
  printf 'STEP rollback: keep writes blocked, stop app, restore pre-migration DB/config and old digest\n'
  mutate stop-writes
  control assert-stopped
  mutate stop-app-wait
  run pg_restore --exit-on-error --single-transaction --clean --if-exists --dbname "service=$PGSERVICE" "$BACKUP_DIR/main.dump"
  mutate restore-config "$BACKUP_DIR/config.backup"
  mutate set-image "$ROLLBACK_IMAGE"
  mutate deploy-wait "$ROLLBACK_IMAGE"
  health
  mutate resume-writes
}

printf '%s\n' '切换机制需在 GS-467 用控制面真实值核对后确定（候选：Coolify 原始 API 的 PATCH docker_image；或在面板手动改镜像字段）'
[[ $execute == 0 ]] || fail 'Real execution is disabled: image-switch adapter is unresolved; GS-467 must establish and review the control-plane implementation first.'

if [[ $execute == 1 ]]; then
  [[ ${APPROVED_2_1:-} == YES ]] || fail 'APPROVED_2_1=YES required after production action approval.'
  for command in pg_dump pg_restore curl jq; do command -v "$command" >/dev/null || fail "Missing command: $command"; done
  umask 077
  if [[ $rollback == 1 ]]; then
    [[ $(cat "$BACKUP_DIR/current-image") == "$ROLLBACK_IMAGE" ]] || fail 'Backup image differs from rollback digest.'
  else
    [[ ! -e $BACKUP_DIR ]] || fail 'BACKUP_DIR already exists; refuse to overwrite backup.'
    mkdir -m 700 "$BACKUP_DIR"
  fi
fi

# Standalone rollback is intentionally a separate branch. It needs the exact
# backup captured before this switch; no DB restore from an unspecified snapshot.
if [[ $rollback == 1 ]]; then
  restore
  exit 0
fi

switched=0
on_failure() {
  rc=$?
  trap - ERR INT TERM
  if [[ $switched == 1 ]]; then
    printf 'Switch failed; attempting rollback from captured backup.\n' >&2
    # Invoke a new Bash process: an || subshell would suppress errexit inside restore.
    bash "$0" --execute --rollback || printf 'ROLLBACK FAILED: keep maintenance enabled; reconcile live state before any retry.\n' >&2
  else
    printf 'Stopped before image mutation; keep maintenance enabled and reconcile before resuming writes.\n' >&2
  fi
  exit "$rc"
}
if [[ $execute == 1 ]]; then
  trap on_failure ERR
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'rc=$?; if [[ $rc == 130 || $rc == 143 ]]; then printf "Interrupted: keep maintenance enabled, reconcile live state before rollback.\n" >&2; fi' EXIT
fi
printf 'STEP 1 stop writes and drain writers (PG stays available)\n'
mutate stop-writes
control assert-stopped
printf 'STEP 2 backup main database and private configuration\n'
run pg_dump --format=custom --no-password --dbname "service=$PGSERVICE" --file "$BACKUP_DIR/main.dump"
mutate backup-config "$BACKUP_DIR/config.backup"
if [[ $execute == 1 ]]; then
  [[ -s $BACKUP_DIR/main.dump && -s $BACKUP_DIR/config.backup ]] || fail 'Empty backup; keep maintenance enabled.'
  pg_restore --list "$BACKUP_DIR/main.dump" >/dev/null
fi
printf 'STEP 3 record and assert active image digest before switching\n'
if [[ $dry == 1 ]]; then
  control current-image
  printf 'ASSERT active image == %s; SAVE privately to %s/current-image\n' "$ROLLBACK_IMAGE" "$BACKUP_DIR"
else
  identity
  current=$(control current-image)
  [[ $current == "$ROLLBACK_IMAGE" ]] || fail 'Active image changed; refusing switch. Keep maintenance enabled.'
  printf '%s\n' "$current" >"$BACKUP_DIR/current-image"
fi
printf 'STEP 4 switch official digest; startup migrations run with writes blocked\n'
switched=1
mutate set-image "$TARGET_IMAGE"
mutate deploy-wait "$TARGET_IMAGE"
health
printf 'STEP 6 resume writes only after every check succeeds\n'
mutate resume-writes
if [[ $dry == 1 ]]; then
  printf 'FAILURE BRANCH (only if switch/deploy/health fails):\n'
  restore
  printf 'DRY-RUN COMPLETE: no external calls, credentials read, or mutations. Unresolved inputs are not live-validated.\n'
else
  trap - ERR INT TERM EXIT
  printf 'Switch complete; retain private backup for standalone --rollback.\n'
fi
