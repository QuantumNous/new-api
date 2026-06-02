#!/usr/bin/env bash
# podman-quadlets-install.sh
#
# One-shot: install the systemd quadlets for a rootless Podman deployment
# (per-user, ~USER/.config/containers/systemd/).
#
# Usage:
#   ./scripts/podman-quadlets-install.sh
#
# Pre-conditions:
#   - podman 4.4+ (quadlets shipped in-tree since 4.4)
#   - systemd --user is set up
#   - the user has been `loginctl enable-linger`'d so the user services
#     survive logout.
#
# After this:
#   systemctl --user daemon-reload
#   systemctl --user start \
#     router-ai-atius-postgres.service \
#     router-ai-atius-redis.service \
#     router-ai-atius-new-api.service \
#     router-ai-atius-model-detailed.service
#   systemctl --user status

set -euo pipefail
cd "$(dirname "$0")/.."

QUADLET_SRC="podman/quadlets"
DEST="${HOME}/.config/containers/systemd"
mkdir -p "$DEST"

# Drop in the .container files. systemd generates the .service from each.
install -m 0644 "$QUADLET_SRC"/*.container "$DEST/"

# Generate the env file from .env (only known-safe keys, no secrets
# embedded; we use the actual POSTGRES_PASSWORD from .env if present).
ENV_FILE="$DEST/router-ai-atius.env"
if [ -f .env ]; then
  grep -E '^(POSTGRES_PASSWORD|REDIS_PASSWORD|SESSION_SECRET)=' .env > "$ENV_FILE" || true
  chmod 0600 "$ENV_FILE"
  echo "[quadlets-install] wrote $ENV_FILE (chmod 600)"
fi

systemctl --user daemon-reload
echo "[quadlets-install] quadlets installed in $DEST:"
ls -1 "$DEST"

cat <<'EOF'

Next:
  systemctl --user enable --now \
    router-ai-atius-postgres.service \
    router-ai-atius-redis.service \
    router-ai-atius-new-api.service \
    router-ai-atius-model-detailed.service

  systemctl --user status
EOF
