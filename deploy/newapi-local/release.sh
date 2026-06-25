#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  cat <<'EOF'
Usage:
  deploy/newapi-local/release.sh <command>

This script is a documentation entrypoint only.
It does not run docker, ssh, scp, rollback, deploy, or status commands.
It prints the manual steps you should execute yourself.

Commands:
  help             Show this help
  manual           Show the release overview
  build            Show local image build steps
  verify-image     Show local image verification steps
  backup-env       Show remote backup steps
  upload           Show remote image upload steps
  deploy           Show remote deployment steps
  deploy-existing  Show remote deploy-existing / rollback steps
  release          Show the recommended end-to-end release checklist
  list-remote-images
                   Show remote image inspection steps
  status           Show remote status inspection steps
  rollback         Alias of deploy-existing

References:
  - deploy/newapi-local/README.md
  - deploy/newapi-local/104_SERVER_DEPLOYMENT.md

Notes:
  - Treat this script as an SOP index, not an automation tool.
  - Run every printed command manually after checking the target host and paths.
  - Do not assume local compose files can be copied to production as-is.
EOF
}

print_manual() {
  cat <<'EOF'
Release overview:

1. Confirm the target host, remote deploy directory, compose file, env file, and current running container names on the server.
2. Build the local image with the correct frontend build arg for the target environment.
3. Verify the local image before touching the server.
4. Backup remote compose, env, nginx config, and PostgreSQL.
5. Upload the image tar to the server.
6. On the server, load the image and update only the `new-api` service image in the real production compose.
7. Recreate only `new-api`, then verify container health and public `/api/status`.
8. If verification fails, roll back by pinning the previous image tag in the remote production compose and recreating only `new-api`.

Primary references:
  - deploy/newapi-local/README.md
  - deploy/newapi-local/104_SERVER_DEPLOYMENT.md
EOF
}

print_build() {
  cat <<'EOF'
Local build SOP:

1. Choose the image tag manually.
2. Build from the repo root. Example:
   docker build \
     --build-arg GOPROXY=https://goproxy.cn,direct \
     --build-arg VITE_HOME_ENTRY=en \
     -t new-api:<tag> .
3. Record the final image tag and the git commit you are releasing.

Do not continue until the image builds cleanly.
EOF
}

print_verify_image() {
  cat <<'EOF'
Local image verification SOP:

1. Start a temporary container manually. Example:
   docker run -d --name new-api-image-check -p 18080:3000 new-api:<tag>
2. Verify:
   - http://127.0.0.1:18080/api/status
   - http://127.0.0.1:18080/
   - http://127.0.0.1:18080/logo.png
   - http://127.0.0.1:18080/favicon.ico
3. If you changed frontend assets, compare the served files with the local source files.
4. Remove the temporary container after verification:
   docker rm -f new-api-image-check

Do not touch the server until these checks pass.
EOF
}

print_backup_env() {
  cat <<'EOF'
Remote backup SOP:

1. SSH to the target host and confirm the current production directory.
2. Backup the real production files before any change:
   cd /root/new-api/deploy/newapi-local
   cp docker-compose.postgres.yml docker-compose.postgres.yml.bak-$(date +%F-%H%M%S)
   cp .env.postgres .env.postgres.bak-$(date +%F-%H%M%S)
   cp gateway/nginx.conf gateway/nginx.conf.bak-$(date +%F-%H%M%S)
3. Backup PostgreSQL:
   docker exec -t new-api-postgres pg_dump -U newapi -d newapi > /root/newapi-pg-backup-$(date +%F-%H%M%S).sql
4. Optionally capture current effective env values:
   docker inspect new-api --format '{{range .Config.Env}}{{println .}}{{end}}'
   docker inspect new-api-redis --format '{{range .Config.Env}}{{println .}}{{end}}'

Do not skip backups.
EOF
}

print_upload() {
  cat <<'EOF'
Remote upload SOP:

1. Save the local image tar manually:
   docker save -o deploy/newapi-local/new-api-<tag>.tar new-api:<tag>
2. Record the checksum:
   sha256sum deploy/newapi-local/new-api-<tag>.tar
3. Upload it to the target host manually. Example:
   scp deploy/newapi-local/new-api-<tag>.tar root@<host>:/root/
4. On the server, verify the tar exists and optionally re-check its checksum.

Do not load or deploy the image until the upload is confirmed.
EOF
}

print_deploy() {
  cat <<'EOF'
Remote deploy SOP:

1. SSH to the target host.
2. Load the uploaded image tar:
   docker load -i /root/new-api-<tag>.tar
3. Open the real production compose file on the server:
   /root/new-api/deploy/newapi-local/docker-compose.postgres.yml
4. Update only the `new-api` service image to:
   image: new-api:<tag>
5. Recreate only the application container:
   cd /root/new-api/deploy/newapi-local
   docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d --no-deps new-api
6. Verify container health:
   docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' new-api
7. Verify service health:
   curl -fsS http://127.0.0.1:3000/api/status
   curl -fsS http://<public-host>:3000/api/status
8. Check logs if anything looks wrong:
   docker logs --tail=200 new-api

Important:
  - Do not overwrite the remote compose with the local compose.
  - Do not recreate postgres, redis, gateway, or seedance-compat in a normal app release.
EOF
}

print_deploy_existing() {
  cat <<'EOF'
Deploy-existing / rollback SOP:

1. SSH to the target host.
2. Confirm the target image tag is already loaded:
   docker image ls new-api
3. Edit the real production compose on the server and set:
   image: new-api:<tag>
4. Recreate only `new-api`:
   cd /root/new-api/deploy/newapi-local
   docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d --no-deps new-api
5. Verify:
   docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' new-api
   curl -fsS http://127.0.0.1:3000/api/status
   curl -fsS http://<public-host>:3000/api/status

If this is a rollback, use the previously known-good tag and keep the backup files until verification finishes.
EOF
}

print_release() {
  cat <<'EOF'
Recommended release checklist:

1. Read:
   - deploy/newapi-local/README.md
   - deploy/newapi-local/104_SERVER_DEPLOYMENT.md
2. Build the image manually.
3. Verify the image locally.
4. Backup the remote production state.
5. Upload the tar to the server.
6. Update only the remote production `new-api` image reference.
7. Recreate only `new-api`.
8. Verify internal and public health endpoints.
9. Keep the previous image tag and the backup files ready for rollback.

This script does not execute these steps for you.
EOF
}

print_list_remote_images() {
  cat <<'EOF'
Remote image inspection SOP:

1. SSH to the target host.
2. List available application images:
   docker image ls new-api
3. Record the currently running image:
   docker inspect new-api --format '{{.Config.Image}}'
EOF
}

print_status() {
  cat <<'EOF'
Remote status inspection SOP:

1. SSH to the target host.
2. Check running containers:
   docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
3. Inspect the current app container:
   docker inspect new-api --format 'IMAGE={{.Config.Image}} WORKDIR={{ index .Config.Labels "com.docker.compose.project.working_dir" }} CONFIG={{ index .Config.Labels "com.docker.compose.project.config_files" }}'
4. Verify local health from the server:
   curl -fsS http://127.0.0.1:3000/api/status
5. Verify the public endpoint from outside if needed:
   curl -fsS http://<public-host>:3000/api/status
EOF
}

main() {
  local cmd="${1:-help}"

  case "${cmd}" in
    help|-h|--help)
      usage
      ;;
    manual)
      print_manual
      ;;
    build)
      print_build
      ;;
    verify-image)
      print_verify_image
      ;;
    backup-env)
      print_backup_env
      ;;
    upload)
      print_upload
      ;;
    deploy)
      print_deploy
      ;;
    deploy-existing|rollback)
      print_deploy_existing
      ;;
    release)
      print_release
      ;;
    list-remote-images)
      print_list_remote_images
      ;;
    status)
      print_status
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
