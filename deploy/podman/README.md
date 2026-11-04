# Podman Deployment Assets

This directory contains Podman deployment assets for single-host production.

## Files

- `../podman-compose.yml`: Podman Compose compatible stack (new-api + PostgreSQL/TimescaleDB).
- `.env.example`: runtime environment template.
- `quadlet/new-api.container`: systemd/Quadlet unit for new-api.
- `quadlet/newapi-postgres.container`: systemd/Quadlet unit for PostgreSQL/TimescaleDB.

## Recommended production path

1. Copy `.env.example` to `.env` and fill in real secrets.
2. Start the stack with `podman compose -f deploy/podman-compose.yml up -d`.
3. For reboot persistence, install the Quadlet units into `/etc/containers/systemd/`
   and run `systemctl enable --now new-api newapi-postgres`.
4. Verify `/api/status`, pricing, and one relay request.
5. Point Caddy at the new-api port and run `systemctl restart caddy`.

## Notes

- Prefer rootful Podman for existing Docker PostgreSQL data volumes to avoid UID mapping issues.
- Use `podman auto-update` or Quadlet for reboot persistence.
- Images are built by CI with Docker Buildx and published to GHCR; Podman pulls them directly.
