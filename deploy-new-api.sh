#!/usr/bin/env bash
#
# Build a new-api image from this source tree and restart the deployment.
#
# Host layout this assumes, with the script living in the source checkout:
#
#   <root>/new-api/docker-compose.yml          the deployment
#   <root>/new-api-source-code/new-api/        this repository
#
# so the deployment directory is found relative to the script and no absolute
# path is baked in. Override it with --compose-dir.
#
# Two things this exists to prevent:
#
#   The version string is not a label. The Dockerfile bakes `cat VERSION` into
#   common.Version, and VERSION is tracked and empty here, so a plain
#   `docker build` publishes an image that reports no version at all - in the
#   admin UI, in /api/status, and in every bug report made against it. The
#   version is written for the build and the file restored afterwards, so the
#   baked value always matches the tag.
#
#   The deployment must actually reference the image that was just built. The
#   stock compose file pulls calciumion/new-api:latest, so rebuilding a local
#   image and restarting would quietly keep running upstream's. The compose file
#   is checked before anything restarts.
#
#   ./deploy-new-api.sh                          # build, restart, verify
#   ./deploy-new-api.sh --version v1.0.0-fork.1
#   ./deploy-new-api.sh --build-only             # build, do not touch the deployment
#   ./deploy-new-api.sh --no-build               # restart with the current image
#   ./deploy-new-api.sh --push                   # also push to a registry
#   ./deploy-new-api.sh --dry-run
#
# Exits non-zero on any failure, so it is safe to chain in CI or a wrapper.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

image="${NEW_API_IMAGE:-new-api-local}"
version=""
compose_dir="$script_dir/../../new-api"
service="new-api"
service_explicit=false
build=true
build_only=false
push=false
verify=true
no_cache=false
force=false
dry_run=false
health_timeout=180

die() {
	echo "deploy: $*" >&2
	exit 1
}

run() {
	echo "deploy: + $*"
	$dry_run || "$@"
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--image)
		image="${2:?--image needs a name}"
		shift 2
		;;
	--version)
		version="${2:?--version needs a value, e.g. v1.0.0-fork.1}"
		shift 2
		;;
	--compose-dir)
		compose_dir="${2:?--compose-dir needs a path}"
		shift 2
		;;
	--service)
		service="${2:?--service needs a name}"
		service_explicit=true
		shift 2
		;;
	--build-only)
		build_only=true
		shift
		;;
	--no-build)
		build=false
		shift
		;;
	--push)
		push=true
		shift
		;;
	--no-verify)
		verify=false
		shift
		;;
	--no-cache)
		no_cache=true
		shift
		;;
	--force)
		force=true
		shift
		;;
	--dry-run)
		dry_run=true
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

command -v docker >/dev/null 2>&1 || die "docker is not available"

# Compose v2 is a docker subcommand; v1 is a separate binary. Both are still in use.
if docker compose version >/dev/null 2>&1; then
	compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
	compose=(docker-compose)
else
	compose=()
fi

if [[ -z "$version" ]]; then
	version="$(git describe --tags --exact-match 2>/dev/null || true)"
	[[ -n "$version" ]] || version="$(git describe --tags --always --dirty 2>/dev/null || true)"
	[[ -n "$version" ]] || die "cannot derive a version: no tags reachable. Pass --version explicitly"
fi
commit="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

# An image built from uncommitted changes cannot be traced back to the tag it
# claims to be, which looks exactly like one that can. VERSION is excluded
# because this script rewrites it below.
if $build; then
	dirty="$(git status --porcelain --untracked-files=no -- . ':!VERSION' 2>/dev/null || true)"
	if [[ -n "$dirty" ]]; then
		echo "deploy: source tree has uncommitted changes:" >&2
		echo "$dirty" | sed 's/^/        /' >&2
		$force || die "commit them, or pass --force to build anyway"
		echo "deploy: continuing anyway (--force)" >&2
	fi
fi

compose_file=""
if ! $build_only; then
	[[ -d "$compose_dir" ]] || die "deployment directory not found: $compose_dir (pass --compose-dir)"
	compose_dir="$(cd "$compose_dir" && pwd)"
	for candidate in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do
		if [[ -f "$compose_dir/$candidate" ]]; then
			compose_file="$compose_dir/$candidate"
			break
		fi
	done
	[[ -n "$compose_file" ]] || die "no compose file in $compose_dir"
	((${#compose[@]})) || die "neither 'docker compose' nor 'docker-compose' is available"
fi

echo "deploy: source      = $script_dir"
echo "deploy: image       = $image:$version"
echo "deploy: commit      = $commit"
echo "deploy: compose     = ${compose_file:-<skipped, --build-only>}"
echo "deploy: build       = $build"
echo "deploy: push        = $push"
$dry_run && echo "deploy: DRY RUN — nothing will be built, pushed or restarted"

# Rebuilding an image the deployment does not reference is the one failure that
# leaves no trace: compose restarts happily and keeps running upstream's image.
#
# The reference is read from compose's own normalised output rather than the
# handwritten file, because indentation, anchors, extends and multiple -f files
# all change what the raw text looks like while compose sees one resolved value.
if [[ -n "$compose_file" ]]; then
	resolved="$("${compose[@]}" -f "$compose_file" config 2>/dev/null || true)"
	[[ -n "$resolved" ]] || die "docker compose could not parse $compose_file"

	# Deployments name this service after their own topology - new-api-master in
	# a master/slave setup - so an unambiguous single match is adopted rather
	# than made a required argument. Anything ambiguous still asks.
	if ! $service_explicit && ! printf '%s\n' "$resolved" | grep -qE "^[[:space:]]+${service}:[[:space:]]*$"; then
		matches="$("${compose[@]}" -f "$compose_file" config --services 2>/dev/null | grep -E "^${service}" || true)"
		if [[ "$(printf '%s\n' "$matches" | grep -c .)" == "1" ]]; then
			service="$(printf '%s\n' "$matches" | head -n1)"
			echo "deploy: service     = $service (matched in $compose_file)"
		fi
	fi

	service_block="$(printf '%s\n' "$resolved" |
		sed -n -E "/^[[:space:]]+${service}:[[:space:]]*$/,/^[[:space:]]{1,4}[a-zA-Z0-9_.-]+:[[:space:]]*$/p")"
	if [[ -z "$service_block" ]]; then
		available="$("${compose[@]}" -f "$compose_file" config --services 2>/dev/null | paste -sd, - || true)"
		die "service '$service' is not in $compose_file (found: ${available:-none}); pass --service"
	fi
	referenced="$(printf '%s\n' "$service_block" |
		sed -n -E 's/^[[:space:]]*image:[[:space:]]*"?([^"#[:space:]]+)"?.*/\1/p' | head -n1)"
	builds_from_source=false
	printf '%s\n' "$service_block" | grep -qE '^[[:space:]]*(build|context):' && builds_from_source=true

	if $builds_from_source; then
		# compose owns the build in this shape, and building a second image here
		# would leave two candidates for which one is actually deployed.
		echo "deploy: $compose_file builds '$service' from source itself." >&2
		echo "        Use compose for the build instead of this script:" >&2
		echo "" >&2
		echo "            ${compose[*]} -f $compose_file up -d --build $service" >&2
		echo "" >&2
		echo "        Or point the compose file at image: $image:latest and rerun." >&2
		$force || exit 1
		echo "deploy: continuing anyway (--force)" >&2
	elif [[ -z "$referenced" ]]; then
		die "service '$service' in $compose_file declares neither image: nor build:"
	elif [[ "$referenced" != "$image:$version" && "$referenced" != "$image:latest" && "$referenced" != "$image" ]]; then
		echo "deploy: $compose_file runs '$referenced', not the image being built ('$image')." >&2
		echo "        Restarting would keep the old image. Set it to:" >&2
		echo "" >&2
		echo "            image: $image:$version" >&2
		echo "" >&2
		echo "        or pass --force to restart anyway." >&2
		$force || exit 1
		echo "deploy: continuing anyway (--force)" >&2
	fi
fi

if $build; then
	# The Dockerfile reads VERSION rather than a build argument, and changing it
	# would be a local edit to an upstream-owned file that every future merge has
	# to resolve. Writing the file only for the build keeps that footprint at
	# zero; the trap restores it even if the build fails or is interrupted.
	version_backup="$(mktemp)"
	cp VERSION "$version_backup"
	restore_version() {
		cp "$version_backup" VERSION
		rm -f "$version_backup"
	}
	trap restore_version EXIT
	$dry_run || printf '%s' "$version" >VERSION

	build_cmd=(docker build --tag "$image:$version" --tag "$image:latest"
		--label "org.opencontainers.image.version=$version"
		--label "org.opencontainers.image.revision=$commit")
	$no_cache && build_cmd+=(--no-cache)
	build_cmd+=(.)
	run "${build_cmd[@]}"

	restore_version
	trap - EXIT

	if $push; then
		run docker push "$image:$version"
		run docker push "$image:latest"
	fi
fi

if $build_only; then
	echo
	echo "deploy: built $image:$version — the deployment was not touched (--build-only)"
	exit 0
fi

run "${compose[@]}" -f "$compose_file" up -d "$service"

if $dry_run; then
	echo "deploy: dry run finished"
	exit 0
fi

container="$("${compose[@]}" -f "$compose_file" ps -q "$service")"
[[ -n "$container" ]] || die "$service did not start"

if ! $verify; then
	echo "deploy: skipping verification"
	exit 0
fi

# Verifying from inside the container avoids assuming the published port is
# reachable from this host, and reading the version back is the only way to catch
# a stale image or an empty common.Version — both invisible otherwise.
echo -n "deploy: waiting for $service"
deadline=$((SECONDS + health_timeout))
reported=""
while :; do
	if [[ "$(docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null)" != "true" ]]; then
		echo
		"${compose[@]}" -f "$compose_file" logs --tail 60 "$service" >&2
		die "$service is not running"
	fi
	reported="$(docker exec "$container" wget -q -O - http://localhost:3000/api/status 2>/dev/null |
		sed -n -E 's/.*"version":"([^"]*)".*/\1/p' || true)"
	[[ -n "$reported" ]] && break
	if ((SECONDS >= deadline)); then
		echo
		"${compose[@]}" -f "$compose_file" logs --tail 60 "$service" >&2
		die "$service did not answer /api/status within ${health_timeout}s"
	fi
	echo -n .
	sleep 3
done
echo " — up"

if [[ "$reported" != "$version" ]]; then
	die "the running container reports version '$reported' but '$version' was built; the deployment is on a different image"
fi

cat <<EOF

deploy: done. $service is running $image:$version (reported: $reported)

Rollback:

  cd $compose_dir
  # set image: back to the previous tag, then
  ${compose[*]} -f $compose_file up -d $service
EOF
