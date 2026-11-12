#!/usr/bin/env bash
# Move the gateway between the two deployment slots.
#
#   ./switch.sh status
#   ./switch.sh switch            # deploy to the idle slot and point traffic at it
#   ./switch.sh switch blue       # same, but choose the target slot explicitly
#   ./switch.sh rollback          # point traffic back at the slot that was live before
#
# Options for "switch":
#   --image REF   image to run in the target slot (default: NEW_API_IMAGE from .env
#                 or docker-compose.yml)
#   --drain SEC   seconds to keep the old slot running after the switch so open
#                 streams finish (default: 300)
#   --keep-old    never stop the old slot
#
# Nothing is switched until the target slot reports healthy, so a failed release
# leaves the current slot serving traffic.

set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose"
UPSTREAM_FILE="nginx/upstream/active.conf"
STATE_FILE=".last-active"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-300}"
DRAIN_SECONDS=300
KEEP_OLD=0
IMAGE=""

die() {
  echo "error: $*" >&2
  exit 1
}

active_slot() {
  local slot
  slot=$(grep -oE 'app-(blue|green)' "$UPSTREAM_FILE" | head -n1 || true)
  [ -n "$slot" ] || die "cannot read the live slot from $UPSTREAM_FILE"
  echo "${slot#app-}"
}

other_slot() {
  [ "$1" = "blue" ] && echo green || echo blue
}

require_slot() {
  case "$1" in
    blue | green) ;;
    *) die "unknown slot '$1' (expected blue or green)" ;;
  esac
}

health() {
  local status
  status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
    "new-api-$1" 2>/dev/null || true)
  echo "${status:-missing}"
}

wait_healthy() {
  local slot=$1 deadline=$((SECONDS + HEALTH_TIMEOUT))
  while ((SECONDS < deadline)); do
    case "$(health "$slot")" in
      healthy)
        return 0
        ;;
      unhealthy)
        die "slot $slot is unhealthy; traffic stays where it is"
        ;;
    esac
    sleep 3
  done
  die "slot $slot did not become healthy within ${HEALTH_TIMEOUT}s"
}

point_gateway_at() {
  local slot=$1 tmp
  tmp=$(mktemp "$(dirname "$UPSTREAM_FILE")/.active.XXXXXX")
  cat >"$tmp" <<EOF
# Live slot. Written by ../switch.sh; do not edit by hand while the gateway runs.
upstream active {
  server app-$slot:3000;
}
EOF
  chmod 0644 "$tmp"
  # A rename keeps a reader from ever seeing a half-written file. The gateway
  # mounts the directory, so the new inode is visible there too.
  mv -f "$tmp" "$UPSTREAM_FILE"
  docker compose exec -T gateway nginx -t >/dev/null
  docker compose exec -T gateway nginx -s reload
}

start_slot() {
  local slot=$1
  if [ -n "$IMAGE" ]; then
    NEW_API_IMAGE="$IMAGE" $COMPOSE up -d --no-deps --force-recreate "app-$slot"
  else
    $COMPOSE up -d --no-deps --force-recreate "app-$slot"
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    switch | rollback | status) COMMAND="$1" ;;
    blue | green) TARGET="$1" ;;
    --image)
      shift
      IMAGE="${1:-}"
      [ -n "$IMAGE" ] || die "--image needs a value"
      ;;
    --drain)
      shift
      DRAIN_SECONDS="${1:-}"
      [[ "$DRAIN_SECONDS" =~ ^[0-9]+$ ]] || die "--drain needs a number of seconds"
      ;;
    --keep-old) KEEP_OLD=1 ;;
    *) die "unknown argument '$1'" ;;
  esac
  shift
done

: "${COMMAND:=status}"

case "$COMMAND" in
  status)
    current=$(active_slot)
    echo "live slot: $current"
    for slot in blue green; do
      printf '  %-5s %-9s %s\n' "$slot" "$(health "$slot")" \
        "$(docker inspect -f '{{.Config.Image}}' "new-api-$slot" 2>/dev/null || echo '-')"
    done
    ;;
  switch)
    from=$(active_slot)
    target="${TARGET:-$(other_slot "$from")}"
    require_slot "$target"
    if [ "$target" = "$from" ]; then
      die "slot $target already serves traffic; name a different target or edit $UPSTREAM_FILE"
    fi

    echo "live slot: $from -> deploying $target"
    start_slot "$target"
    if ! wait_healthy "$target"; then
      $COMPOSE stop "app-$target" || true
      exit 1
    fi
    point_gateway_at "$target"
    echo "$from" >"$STATE_FILE"
    echo "traffic now on $target"

    if [ "$KEEP_OLD" = "1" ]; then
      echo "keeping $from running (--keep-old)"
      exit 0
    fi
    if [ "$DRAIN_SECONDS" -gt 0 ]; then
      echo "draining $from for ${DRAIN_SECONDS}s so open streams can finish"
      sleep "$DRAIN_SECONDS"
    fi
    $COMPOSE stop "app-$from"
    echo "stopped $from"
    ;;
  rollback)
    [ -f "$STATE_FILE" ] || die "no previous slot recorded in $STATE_FILE"
    previous=$(cat "$STATE_FILE")
    require_slot "$previous"
    echo "switching back to $previous"
    start_slot "$previous"
    if ! wait_healthy "$previous"; then
      $COMPOSE stop "app-$previous" || true
      exit 1
    fi
    point_gateway_at "$previous"
    rm -f "$STATE_FILE"
    echo "traffic now on $previous"
    ;;
esac
