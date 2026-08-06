#!/usr/bin/env bash
#
# Deploy or upgrade the prompt audit sidecar.
#
# The sidecar is its own Compose project, built from source on the target host, so
# a deploy is: check the config the container will actually mount, rebuild, restart,
# then confirm the process came up healthy and is running the config you think it
# is. That last step is the point of this script — the proxy reports its effective
# configuration at startup, and an unnoticed stale config file or environment
# override looks exactly like a bug in the audit pipeline.
#
#   ./deploy.sh                                  # build and restart, then verify
#   ./deploy.sh --goproxy https://goproxy.cn,direct
#   ./deploy.sh --config /srv/newapi-audit/config.yaml \
#               --compose-file /srv/newapi-audit/docker-compose.yml
#   ./deploy.sh --no-build                       # restart with the current image
#
# Exits non-zero on any failure, so it is safe to chain in CI or a wrapper.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

compose_file="$script_dir/docker-compose.sidecar.yml"
config_file="$script_dir/config.docker.yaml"
service="prompt-audit"
goproxy=""
build=true
force=false
health_timeout=90

die() {
	echo "deploy: $*" >&2
	exit 1
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--compose-file)
		compose_file="${2:?--compose-file needs a path}"
		shift 2
		;;
	--config)
		config_file="${2:?--config needs a path}"
		shift 2
		;;
	--service)
		service="${2:?--service needs a name}"
		shift 2
		;;
	--goproxy)
		goproxy="${2:?--goproxy needs a URL}"
		shift 2
		;;
	--timeout)
		health_timeout="${2:?--timeout needs seconds}"
		shift 2
		;;
	--no-build)
		build=false
		shift
		;;
	--force)
		force=true
		shift
		;;
	-h | --help)
		awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "${BASH_SOURCE[0]}"
		exit 0
		;;
	*)
		die "unknown argument: $1 (try --help)"
		;;
	esac
done

# Compose v2 is a docker subcommand; v1 is a separate binary. Both are still in use.
if docker compose version >/dev/null 2>&1; then
	compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
	compose=(docker-compose)
else
	die "neither 'docker compose' nor 'docker-compose' is available"
fi

[[ -f "$compose_file" ]] || die "compose file not found: $compose_file"
[[ -f "$config_file" ]] || die "config file not found: $config_file"

compose=("${compose[@]}" -f "$compose_file")

# yaml_value reads a top-level key from the config. Deliberately crude: the only
# values read here are scalars under `capture:` and the root, and depending on a
# YAML parser being installed on the host would be worse than a grep.
yaml_value() {
	sed -n -E "s/^[[:space:]]*$1:[[:space:]]*([^#]*).*/\1/p" "$config_file" |
		head -n1 | tr -d '"'"'"' \r'
}

# The 1 MiB inspection ceiling shipped as the old default, and a body over it was
# recorded with an empty prompt: an agent client resends its whole conversation
# each turn, so 1.6 MB bodies are ordinary and a prefix of a JSON document does not
# parse. A config that still pins the old value keeps that bug after the upgrade,
# which is invisible until someone reads the audit table.
max_body_bytes="$(yaml_value max_body_bytes)"
if [[ -n "$max_body_bytes" && "$max_body_bytes" =~ ^[0-9]+$ ]] && ((max_body_bytes <= 4194304)); then
	echo "deploy: capture.max_body_bytes=$max_body_bytes in $config_file is too low." >&2
	echo "        A request body over this size is audited with an incomplete prompt." >&2
	echo "        Raise it (67108864 = 64 MiB is the current default) or pass --force." >&2
	$force || exit 1
	echo "deploy: continuing anyway (--force)" >&2
fi

listen="$(yaml_value listen)"
health_port="${listen##*:}"
[[ "$health_port" =~ ^[0-9]+$ ]] || health_port=3001

echo "deploy: compose file  = $compose_file"
echo "deploy: config file   = $config_file"
echo "deploy: health port   = $health_port (from listen: $listen)"

if $build; then
	build_args=()
	[[ -n "$goproxy" ]] && build_args=(--build-arg "GOPROXY=$goproxy")
	echo "deploy: building $service"
	"${compose[@]}" build "${build_args[@]}" "$service"
fi

echo "deploy: starting $service"
"${compose[@]}" up -d "$service"

container="$("${compose[@]}" ps -q "$service")"
[[ -n "$container" ]] || die "$service did not start"

# The container defines a healthcheck against /proxy/healthz, so waiting on Docker's
# own verdict avoids assuming the published port is reachable from this host.
echo -n "deploy: waiting for health"
deadline=$((SECONDS + health_timeout))
while :; do
	status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container")"
	case "$status" in
	healthy)
		echo " — healthy"
		break
		;;
	none)
		# No healthcheck defined in this compose file; fall back to running state.
		[[ "$(docker inspect --format '{{.State.Running}}' "$container")" == "true" ]] ||
			die "container is not running"
		echo " — running (no healthcheck defined)"
		break
		;;
	unhealthy)
		echo
		"${compose[@]}" logs --tail 60 "$service" >&2
		die "$service reported unhealthy"
		;;
	esac
	if ((SECONDS >= deadline)); then
		echo
		"${compose[@]}" logs --tail 60 "$service" >&2
		die "$service did not become healthy within ${health_timeout}s"
	fi
	echo -n .
	sleep 2
done

# What the process actually runs with, straight from its own startup report. A
# mounted file that never updated, or a PROXY_* variable silently winning over it,
# is otherwise indistinguishable from a broken audit pipeline.
echo
echo "deploy: effective configuration reported at startup"
"${compose[@]}" logs "$service" 2>/dev/null |
	grep -E "proxy: (config file|OVERRIDDEN|listen|upstream|database driver|fail_open|audited paths|prompt scope|prompt/raw caps|spool dir|identity lookup|debug logging)" |
	tail -n 13 |
	sed 's/^/        /'

echo
echo "deploy: health endpoint"
docker exec "$container" wget -q -O - "http://localhost:$health_port/proxy/healthz" |
	sed 's/^/        /'
echo

cat <<EOF
deploy: done. Send client traffic to port $health_port instead of new-api's own port.

Verify the fix is live — this must return rows with a non-empty prompt_text:

  SELECT created_at, model, truncated, body_bytes, LEFT(prompt_text, 80)
  FROM prompt_audit_logs
  WHERE body_bytes > 1048576
  ORDER BY id DESC LIMIT 20;

Rollback: ${compose[*]} down
EOF
