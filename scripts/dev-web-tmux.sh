#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SESSION_NAME="${NEW_API_WEB_TMUX_SESSION:-new-api-web}"
BACKEND_URL="${NEW_API_BACKEND_URL:-http://localhost:3000}"
DEFAULT_PORT="${NEW_API_DEFAULT_PORT:-5173}"
CLASSIC_PORT="${NEW_API_CLASSIC_PORT:-5174}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_rsbuild() {
  local app_dir="$1"
  if [ ! -x "$app_dir/node_modules/.bin/rsbuild" ]; then
    echo "Missing rsbuild dependency in $app_dir" >&2
    echo "Run: cd $app_dir && bun install" >&2
    exit 1
  fi
}

need_command tmux
need_command bun

need_rsbuild "$ROOT_DIR/web/default"
need_rsbuild "$ROOT_DIR/web/classic"

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "tmux session already exists: $SESSION_NAME"
  echo "Attach: tmux attach -t $SESSION_NAME"
  echo "Windows: tmux list-windows -t $SESSION_NAME"
  exit 0
fi

default_cmd="VITE_REACT_APP_SERVER_URL='' NEW_API_BACKEND_URL='$BACKEND_URL' bun run dev -- --host 0.0.0.0 --port '$DEFAULT_PORT'"
classic_cmd="VITE_REACT_APP_SERVER_URL='' NEW_API_BACKEND_URL='$BACKEND_URL' bun run dev -- --host 0.0.0.0 --port '$CLASSIC_PORT'"

tmux new-session -d -s "$SESSION_NAME" -n default -c "$ROOT_DIR/web/default" "$default_cmd"
tmux new-window -t "$SESSION_NAME" -n classic -c "$ROOT_DIR/web/classic" "$classic_cmd"
tmux select-window -t "$SESSION_NAME:default"

cat <<EOF
Started frontend dev servers in tmux session: $SESSION_NAME

default: http://127.0.0.1:$DEFAULT_PORT/  -> $ROOT_DIR/web/default
classic: http://127.0.0.1:$CLASSIC_PORT/  -> $ROOT_DIR/web/classic
API proxy: $BACKEND_URL

Attach: tmux attach -t $SESSION_NAME
List windows: tmux list-windows -t $SESSION_NAME
Stop session: tmux kill-session -t $SESSION_NAME
EOF
