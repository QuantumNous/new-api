#!/usr/bin/env bash
set -u

readonly MYSQL_IMAGE='mysql:5.7.44@sha256:4bc6bc963e6d8443453676cae56536f4b8156d78bae03c0145cbe47c2aad73bb'
readonly MYSQL_PLATFORM='linux/amd64'
readonly POSTGRES_IMAGE='postgres:15.19@sha256:9b1d34adbce1dd07ee6e94b4a2cf698884b89bd44a6c9c12f5da8f3acbfe4957'
readonly POSTGRES_PLATFORM='linux/arm64'
readonly PROXY_IMAGE='golang:1.26.5-bookworm@sha256:53eeac89074db483fdf0ab3be1df32bf6e47562263d2d0d6baa7f26acb4957dd'
readonly PROXY_PLATFORM='linux/arm64'
readonly PROXY_GOARCH='arm64'
readonly PROXY_PORT=15432
readonly READINESS_DEADLINE_SECONDS=90
readonly READINESS_KILL_AFTER_SECONDS=$((READINESS_DEADLINE_SECONDS - 1))
readonly ACTIVE_COMMAND_TERM_SECONDS=2

repo_root="${NEW_API_TEST_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)}"
if [[ ! -f "$repo_root/go.mod" ]]; then
  printf 'invalid repository root: %s\n' "$repo_root" >&2
  exit 2
fi

containers=()
networks=()
temp_files=()
temp_dirs=()
active_command_pid=

terminate_active_command() {
  local pid=${active_command_pid:-}
  local deadline
  if [[ -z "$pid" ]]; then
    return
  fi
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid" >/dev/null 2>&1 || true
    deadline=$(( $(date +%s) + ACTIVE_COMMAND_TERM_SECONDS ))
    while kill -0 "$pid" 2>/dev/null && (( $(date +%s) < deadline )); do
      sleep 0.05
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" >/dev/null 2>&1 || true
    fi
  fi
  wait "$pid" 2>/dev/null || true
  active_command_pid=
}

cleanup_resources() {
  if ((${#containers[@]} > 0)); then
    docker rm -fv "${containers[@]}" >/dev/null 2>&1 || true
  fi
  if ((${#networks[@]} > 0)); then
    docker network rm "${networks[@]}" >/dev/null 2>&1 || true
  fi
  if ((${#temp_files[@]} > 0)); then
    rm -f "${temp_files[@]}" >/dev/null 2>&1 || true
  fi
  if ((${#temp_dirs[@]} > 0)); then
    rm -rf "${temp_dirs[@]}" >/dev/null 2>&1 || true
  fi
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT HUP INT TERM
  terminate_active_command
  cleanup_resources
  exit "$status"
}

cleanup_on_signal() {
  local status=$1
  trap - EXIT HUP INT TERM
  terminate_active_command
  cleanup_resources
  exit "$status"
}

trap cleanup_on_exit EXIT
trap 'cleanup_on_signal 129' HUP
trap 'cleanup_on_signal 130' INT
trap 'cleanup_on_signal 143' TERM

usage() {
  printf 'usage: %s -- command [args...]\n' "${BASH_SOURCE[0]##*/}" >&2
}

describe() {
  cat <<EOF
repo root: $repo_root
databases: sqlite, mysql, postgres
sqlite: temporary database file under the runner temp directory, removed by cleanup
docker isolation: each database starts on and remains attached only to its unique internal Docker network; databases never attach to bridge
ports: one pinned constrained proxy sidecar per database uses -p 127.0.0.1::${PROXY_PORT} (random localhost port to sidecar ${PROXY_PORT}/tcp); each sidecar joins bridge plus that database's internal network
proxy constraints: read-only, uid 65532, all capabilities dropped, no-new-privileges, pids 64, memory 64m, cpus 0.5, init, stop timeout 10s, pull never
proxy source: generated and cross-compiled in the runner temp directory, never stored in the repository
readiness: proxy build, network/container setup, in-container health, and a real host connection through the sidecar must succeed within ${READINESS_DEADLINE_SECONDS}s total per database
cleanup: trap is installed before any temporary file, network, or container is started
argv: the same command argv is run once per dialect
runtime metadata: one APP_PLUGIN_TEST_RUNTIME line is emitted before every dialect command
exit status: all dialects run when possible; any failed dialect produces an aggregate nonzero exit
mysql image: $MYSQL_IMAGE
mysql platform: $MYSQL_PLATFORM
postgres image: $POSTGRES_IMAGE
postgres platform: $POSTGRES_PLATFORM
proxy image: $PROXY_IMAGE
proxy platform: $PROXY_PLATFORM
proxy build: host GOOS=linux GOARCH=$PROXY_GOARCH CGO_ENABLED=0
readiness deadline: ${READINESS_DEADLINE_SECONDS}s
env contract: APP_PLUGIN_TEST_DIALECT, APP_PLUGIN_TEST_DSN, APP_PLUGIN_TEST_DRIVER, APP_PLUGIN_TEST_DATABASE_VERSION, APP_PLUGIN_TEST_IMAGE, APP_PLUGIN_TEST_PLATFORM
dsn exclusions: TEST_MYSQL_DSN and TEST_POSTGRES_DSN are not set by this runner
go flags: GOFLAGS defaults to -p=1 when unset; user supplied GOFLAGS is preserved
runner interface: test_app_plugin_db_matrix.sh -- command [args...]
EOF
}

if [[ "${1:-}" == "--describe" ]]; then
  describe
  exit 0
fi

if [[ "${1:-}" != "--" || $# -lt 2 ]]; then
  usage
  exit 2
fi
shift
command_args=("$@")

unique_id() {
  printf 'newapi-app-plugin-%s-%s' "$1" "$$-$RANDOM"
}

docker_port() {
  local container=$1
  local port=$2
  local deadline=$3
  run_with_deadline "$deadline" docker port "$container" "$port/tcp" |
    sed -n 's/^127\.0\.0\.1://p' |
    head -n 1
}

run_with_deadline() {
  local deadline=$1
  shift

  local now remaining pid status term_deadline
  now=$(date +%s)
  remaining=$((deadline - now))
  if ((remaining <= 0)); then
    return 124
  fi

  "$@" &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    now=$(date +%s)
    if ((now >= deadline)); then
      kill -TERM "$pid" >/dev/null 2>&1 || true
      term_deadline=$(( $(date +%s) + 1 ))
      while kill -0 "$pid" 2>/dev/null && (( $(date +%s) < term_deadline )); do
        sleep 0.05
      done
      if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "$pid" >/dev/null 2>&1 || true
      fi
      wait "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 0.2
  done

  wait "$pid"
  status=$?
  return "$status"
}

wait_for_mysql() {
  local container=$1
  local deadline=$2
  until run_with_deadline "$deadline" docker exec "$container" mysqladmin ping -h127.0.0.1 -uroot -proot --silent >/dev/null 2>&1; do
    if (( $(date +%s) >= deadline )); then
      printf 'mysql did not become ready within %ss\n' "$READINESS_DEADLINE_SECONDS" >&2
      return 1
    fi
    sleep 0.2
  done
}

wait_for_postgres() {
  local container=$1
  local deadline=$2
  until run_with_deadline "$deadline" docker exec "$container" pg_isready -U newapi -d newapi >/dev/null 2>&1; do
    if (( $(date +%s) >= deadline )); then
      printf 'postgres did not become ready within %ss\n' "$READINESS_DEADLINE_SECONDS" >&2
      return 1
    fi
    sleep 0.2
  done
}

assert_only_internal_network() {
  local container=$1
  local expected=$2
  local deadline=$3
  local attached
  attached=$(run_with_deadline "$deadline" docker inspect \
    --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' \
    "$container") || return 1
  if [[ "$attached" != "$expected" ]]; then
    printf 'container %s networks were %q, expected only %q\n' "$container" "$attached" "$expected" >&2
    return 1
  fi
}

assert_proxy_networks() {
  local container=$1
  local internal_network=$2
  local deadline=$3
  local attached
  attached=$(run_with_deadline "$deadline" docker inspect \
    --format "{{if index .NetworkSettings.Networks \"bridge\"}}bridge{{end}} {{if index .NetworkSettings.Networks \"$internal_network\"}}internal{{end}} {{len .NetworkSettings.Networks}}" \
    "$container") || return 1
  if [[ "$attached" != "bridge internal 2" ]]; then
    printf 'proxy %s networks were %q, expected exactly bridge and %q\n' \
      "$container" "$attached" "$internal_network" >&2
    return 1
  fi
}

build_proxy() {
  local output=$1
  local deadline=$2
  run_with_deadline "$deadline" env \
    CGO_ENABLED=0 GOOS=linux GOARCH="$PROXY_GOARCH" \
    go build -buildvcs=false -trimpath -o "$output" "$proxy_source"
}

start_proxy() {
  local container=$1
  local internal_network=$2
  local binary=$3
  local target=$4
  local deadline=$5

  run_with_deadline "$deadline" docker create \
    --name "$container" \
    --platform "$PROXY_PLATFORM" \
    --network bridge \
    -p "127.0.0.1::${PROXY_PORT}" \
    --read-only \
    --user 65532:65532 \
    --cap-drop ALL \
    --security-opt no-new-privileges=true \
    --pids-limit 64 \
    --memory 64m \
    --cpus 0.5 \
    --init \
    --stop-timeout 10 \
    --pull never \
    --mount "type=bind,src=${binary},dst=/usr/local/bin/tcp-proxy,readonly" \
    --entrypoint /usr/local/bin/tcp-proxy \
    "$PROXY_IMAGE" "$target" >/dev/null &&
    run_with_deadline "$deadline" docker network connect "$internal_network" "$container" &&
    assert_proxy_networks "$container" "$internal_network" "$deadline" &&
    run_with_deadline "$deadline" docker start "$container" >/dev/null
}

wait_for_host_database() {
  local dialect=$1
  local dsn=$2
  local deadline=$3
  local version
  until version=$(run_with_deadline "$deadline" "$metadata_probe" "$dialect" "$dsn" 2>/dev/null); do
    if (( $(date +%s) >= deadline )); then
      printf 'BLOCKED: %s on its internal network is not reachable through the published 127.0.0.1 port within %ss\n' \
        "$dialect" "$READINESS_DEADLINE_SECONDS" >&2
      return 1
    fi
    sleep 0.2
  done
  printf '%s\n' "$version"
}

module_version() {
  (
    cd "$repo_root" || exit 1
    go list -m -f '{{.Path}}@{{.Version}}' "$1"
  )
}

run_for_dialect() {
  local dialect=$1
  local dsn=$2
  local driver=$3
  local database_version=$4
  local image=$5
  local platform=$6
  local status

  printf '==> app plugin tests: %s\n' "$dialect" >&2
  printf 'APP_PLUGIN_TEST_RUNTIME dialect=%q driver=%q database_version=%q image=%q platform=%q\n' \
    "$dialect" "$driver" "$database_version" "$image" "$platform" >&2
  (
    cd "$repo_root" || exit 1
    export APP_PLUGIN_TEST_DIALECT="$dialect"
    export APP_PLUGIN_TEST_DSN="$dsn"
    export APP_PLUGIN_TEST_DRIVER="$driver"
    export APP_PLUGIN_TEST_DATABASE_VERSION="$database_version"
    export APP_PLUGIN_TEST_IMAGE="$image"
    export APP_PLUGIN_TEST_PLATFORM="$platform"
    export GOFLAGS="${GOFLAGS:--p=1}"
    unset TEST_MYSQL_DSN
    unset TEST_POSTGRES_DSN
    exec "${command_args[@]}"
  ) &
  active_command_pid=$!
  wait "$active_command_pid"
  status=$?
  active_command_pid=
  return "$status"
}

final_status=0

runner_temp_parent="${NEW_API_TEST_TMPDIR:-${HOME:-/tmp}}"
sqlite_dir=$(mktemp -d "$runner_temp_parent/.newapi-app-plugin.XXXXXX")
temp_dirs+=("$sqlite_dir")
sqlite_file="$sqlite_dir/app-plugin.sqlite"
temp_files+=("$sqlite_file")
metadata_probe_source="$sqlite_dir/app-plugin-db-metadata.go"
metadata_probe="$sqlite_dir/app-plugin-db-metadata"
proxy_source="$sqlite_dir/app-plugin-db-proxy.go"
temp_files+=("$metadata_probe_source" "$metadata_probe" "$proxy_source")
cat >"$metadata_probe_source" <<'EOF'
package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/glebarez/go-sqlite"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	if len(os.Args) != 3 {
		os.Exit(2)
	}
	driver := os.Args[1]
	query := "select version()"
	if driver == "sqlite" {
		query = "select sqlite_version()"
	} else if driver == "postgres" {
		driver = "pgx"
	}
	db, err := sql.Open(driver, os.Args[2])
	if err != nil {
		os.Exit(1)
	}
	defer db.Close()
	var version string
	if err := db.QueryRow(query).Scan(&version); err != nil {
		os.Exit(1)
	}
	fmt.Print(version)
}
EOF
cat >"$proxy_source" <<'EOF'
package main

import (
	"context"
	"io"
	"net"
	"os"
	"os/signal"
	"sync"
	"syscall"
)

const (
	listenAddress = ":15432"
	maxConnections = 32
)

type connectionSet struct {
	mu    sync.Mutex
	conns map[net.Conn]struct{}
}

func (s *connectionSet) add(conn net.Conn) {
	s.mu.Lock()
	s.conns[conn] = struct{}{}
	s.mu.Unlock()
}

func (s *connectionSet) remove(conn net.Conn) {
	s.mu.Lock()
	delete(s.conns, conn)
	s.mu.Unlock()
}

func (s *connectionSet) closeAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for conn := range s.conns {
		_ = conn.Close()
	}
}

func closeWrite(conn net.Conn) {
	if tcp, ok := conn.(*net.TCPConn); ok {
		_ = tcp.CloseWrite()
	}
}

func closeRead(conn net.Conn) {
	if tcp, ok := conn.(*net.TCPConn); ok {
		_ = tcp.CloseRead()
	}
}

func copyHalf(dst, src net.Conn, done chan<- struct{}) {
	_, _ = io.Copy(dst, src)
	closeWrite(dst)
	closeRead(src)
	done <- struct{}{}
}

func proxyConnection(ctx context.Context, client net.Conn, target string, active *connectionSet) {
	defer active.remove(client)
	defer client.Close()

	upstream, err := (&net.Dialer{}).DialContext(ctx, "tcp", target)
	if err != nil {
		return
	}
	active.add(upstream)
	defer active.remove(upstream)
	defer upstream.Close()

	done := make(chan struct{}, 2)
	go copyHalf(upstream, client, done)
	go copyHalf(client, upstream, done)
	<-done
	<-done
}

func main() {
	if len(os.Args) != 2 {
		os.Exit(2)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	listener, err := net.Listen("tcp", listenAddress)
	if err != nil {
		os.Exit(1)
	}
	active := &connectionSet{conns: make(map[net.Conn]struct{})}
	go func() {
		<-ctx.Done()
		_ = listener.Close()
		active.closeAll()
	}()

	slots := make(chan struct{}, maxConnections)
	for {
		client, err := listener.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			continue
		}
		select {
		case slots <- struct{}{}:
			active.add(client)
			go func() {
				defer func() { <-slots }()
				proxyConnection(ctx, client, os.Args[1], active)
			}()
		default:
			_ = client.Close()
		}
	}
}
EOF
if ! (
  cd "$repo_root" &&
    go build -o "$metadata_probe" "$metadata_probe_source"
); then
  printf 'failed to build database metadata probe\n' >&2
  exit 1
fi

sqlite_driver=$(module_version github.com/glebarez/sqlite) || exit 1
mysql_driver=$(module_version gorm.io/driver/mysql) || exit 1
postgres_driver=$(module_version gorm.io/driver/postgres) || exit 1
sqlite_version=$("$metadata_probe" sqlite "$sqlite_file") || {
  printf 'failed to query SQLite runtime version\n' >&2
  exit 1
}
run_for_dialect sqlite "$sqlite_file" "$sqlite_driver" "$sqlite_version" "" "" || final_status=1

mysql_network=$(unique_id mysql-net)
mysql_container=$(unique_id mysql)
mysql_proxy=$(unique_id mysql-proxy)
mysql_proxy_binary="$sqlite_dir/mysql-tcp-proxy"
networks+=("$mysql_network")
containers+=("$mysql_proxy" "$mysql_container")
temp_files+=("$mysql_proxy_binary")
mysql_deadline=$(( $(date +%s) + READINESS_KILL_AFTER_SECONDS ))
if build_proxy "$mysql_proxy_binary" "$mysql_deadline" &&
  run_with_deadline "$mysql_deadline" docker network create --internal "$mysql_network" >/dev/null &&
  run_with_deadline "$mysql_deadline" docker run -d --name "$mysql_container" --restart on-failure:5 --platform "$MYSQL_PLATFORM" \
    --network "$mysql_network" \
    -e MYSQL_ROOT_PASSWORD=root \
    -e MYSQL_ROOT_HOST=% \
    -e MYSQL_DATABASE=newapi \
    "$MYSQL_IMAGE" --innodb-use-native-aio=0 \
      --character-set-server=utf8mb4 \
      --collation-server=utf8mb4_unicode_ci >/dev/null &&
  assert_only_internal_network "$mysql_container" "$mysql_network" "$mysql_deadline" &&
  wait_for_mysql "$mysql_container" "$mysql_deadline" &&
  start_proxy "$mysql_proxy" "$mysql_network" "$mysql_proxy_binary" "$mysql_container:3306" "$mysql_deadline"; then
  mysql_port=$(docker_port "$mysql_proxy" "$PROXY_PORT" "$mysql_deadline")
  if [[ -z "$mysql_port" ]]; then
    printf 'BLOCKED: mysql proxy did not publish the requested 127.0.0.1 port\n' >&2
    final_status=1
  else
    mysql_dsn="root:root@tcp(127.0.0.1:${mysql_port})/newapi?charset=utf8mb4&parseTime=true&loc=Local"
    if mysql_version=$(wait_for_host_database mysql "$mysql_dsn" "$mysql_deadline"); then
      run_for_dialect mysql "$mysql_dsn" "$mysql_driver" "$mysql_version" "$MYSQL_IMAGE" "$MYSQL_PLATFORM" || final_status=1
    else
      final_status=1
    fi
  fi
else
  final_status=1
fi

postgres_network=$(unique_id postgres-net)
postgres_container=$(unique_id postgres)
postgres_proxy=$(unique_id postgres-proxy)
postgres_proxy_binary="$sqlite_dir/postgres-tcp-proxy"
networks+=("$postgres_network")
containers+=("$postgres_proxy" "$postgres_container")
temp_files+=("$postgres_proxy_binary")
postgres_deadline=$(( $(date +%s) + READINESS_KILL_AFTER_SECONDS ))
if build_proxy "$postgres_proxy_binary" "$postgres_deadline" &&
  run_with_deadline "$postgres_deadline" docker network create --internal "$postgres_network" >/dev/null &&
  run_with_deadline "$postgres_deadline" docker run -d --name "$postgres_container" --platform "$POSTGRES_PLATFORM" \
    --network "$postgres_network" \
    -e POSTGRES_USER=newapi \
    -e POSTGRES_PASSWORD=newapi \
    -e POSTGRES_DB=newapi \
    "$POSTGRES_IMAGE" >/dev/null &&
  assert_only_internal_network "$postgres_container" "$postgres_network" "$postgres_deadline" &&
  wait_for_postgres "$postgres_container" "$postgres_deadline" &&
  start_proxy "$postgres_proxy" "$postgres_network" "$postgres_proxy_binary" "$postgres_container:5432" "$postgres_deadline"; then
  postgres_port=$(docker_port "$postgres_proxy" "$PROXY_PORT" "$postgres_deadline")
  if [[ -z "$postgres_port" ]]; then
    printf 'BLOCKED: postgres proxy did not publish the requested 127.0.0.1 port\n' >&2
    final_status=1
  else
    postgres_dsn="host=127.0.0.1 port=${postgres_port} user=newapi password=newapi dbname=newapi sslmode=disable TimeZone=UTC"
    if postgres_version=$(wait_for_host_database postgres "$postgres_dsn" "$postgres_deadline"); then
      run_for_dialect postgres "$postgres_dsn" "$postgres_driver" "$postgres_version" "$POSTGRES_IMAGE" "$POSTGRES_PLATFORM" || final_status=1
    else
      final_status=1
    fi
  fi
else
  final_status=1
fi

exit "$final_status"
