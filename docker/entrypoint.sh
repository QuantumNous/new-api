#!/bin/sh
set -e

if [ "${HYDRA_ENABLED:-true}" = "true" ]; then
  /usr/bin/hydra migrate sql -e --yes
  /usr/bin/hydra serve all --dev &
fi

exec /new-api "$@"