#!/usr/bin/env bash
set -euo pipefail
umask 077

mode=${1:-}
revision=${2:-}
source=${3:-manual}
run_number=${4:-0}
[[ $mode == build || $mode == activate ]] || exit 2
[[ $revision =~ ^[0-9a-f]{40}$ ]] || exit 2
[[ $source == manual || $source == github ]] || exit 2
[[ $run_number =~ ^(0|[1-9][0-9]{0,9})$ ]] || exit 2

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ -s .env && -s compose.yaml ]] || { echo "Install compose.yaml and .env first" >&2; exit 1; }
docker=(docker)
if ! docker info >/dev/null 2>&1; then
    docker=(sudo -n docker)
fi
compose=("${docker[@]}" compose --project-name sailq --env-file .env -f compose.yaml)

if [[ $mode == build ]]; then
    build_dir=$(mktemp -d)
    trap 'rm -rf -- "$build_dir"' EXIT
    tar -xzf - -C "$build_dir"
fi
exec 9>deploy.lock
flock -w 1800 9

previous=
[[ ! -s current ]] || read -r previous < current
if [[ $source == github ]]; then
    last_run=0
    [[ ! -s github-run ]] || read -r last_run < github-run
    if (( run_number < last_run )); then
        echo "Skipping older GitHub deployment $run_number"
        exit
    fi
    printf '%s\n' "$run_number" > github-run.tmp
    mv github-run.tmp github-run
fi

log_release() {
    printf '%s %s %s %s %s\n' "$(date -u +%FT%TZ)" "$source" "$revision" "${image_id:--}" "$1" >> releases.log
}

if [[ $mode == build ]] && ! "${docker[@]}" image inspect "sailq-new-api:$revision" >/dev/null 2>&1; then
    printf '%s\n' "$revision" > "$build_dir/VERSION"
    if ! "${docker[@]}" build --label "org.opencontainers.image.revision=$revision" -t "sailq-new-api:$revision" "$build_dir"; then
        log_release build-failed
        exit 1
    fi
fi
image_id=$("${docker[@]}" image inspect --format '{{.Id}}' "sailq-new-api:$revision")

# Bring up and check data services before replacing the application.
RELEASE_SHA=$revision "${compose[@]}" up -d --wait --wait-timeout 120 postgres redis
if RELEASE_SHA=$revision "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 150 new-api &&
    { [[ -z ${DEPLOY_HEALTH_URL:-} ]] || curl --fail --silent --show-error --max-time 10 "$health_url" | grep -Eq '"success"[[:space:]]*:[[:space:]]*true'; }; then
    printf '%s\n' "$revision" > current.tmp
    mv current.tmp current
    log_release deployed
    exit
fi

log_release health-check-failed
if [[ -n $previous ]]; then
    if RELEASE_SHA=$previous "${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 150 new-api; then
        log_release "restored-$previous"
    else
        log_release "restore-failed-$previous"
    fi
else
    RELEASE_SHA=$revision "${compose[@]}" stop new-api
fi
exit 1
