#!/bin/sh
set -eu

mode="${1:-main}"
shift || true

case "$mode" in
  main)
    exec python3 -m scripts.browser_qa.flatkey_browser_qa.supervisor "$@"
    ;;
  cleanup)
    exec python3 -m scripts.browser_qa.flatkey_browser_qa.cleanup_job "$@"
    ;;
  broker)
    exec python3 -m scripts.browser_qa.flatkey_browser_qa.broker "$@"
    ;;
  candidate)
    exec python3 -m scripts.browser_qa.flatkey_browser_qa.candidate_job "$@"
    ;;
  *)
    echo "unknown browser QA mode: $mode" >&2
    exit 2
    ;;
esac
