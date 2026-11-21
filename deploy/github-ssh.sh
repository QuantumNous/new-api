#!/usr/bin/env bash
set -euo pipefail

if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^bash\ ~/sailq-deploy/release\.sh\ checkout\ ([0-9a-f]{40})\ github\ ([1-9][0-9]{0,9})$ ]]; then
    exec bash "$HOME/sailq-deploy/release.sh" checkout "${BASH_REMATCH[1]}" github "${BASH_REMATCH[2]}"
fi
echo "The GitHub key only accepts SailQ build requests" >&2
exit 2
