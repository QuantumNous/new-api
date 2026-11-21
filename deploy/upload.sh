#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST to the configured SSH destination}"
ssh_options=(-o BatchMode=yes -o StrictHostKeyChecking=yes)
if [[ -n ${VERSION:-} ]]; then
    [[ $VERSION =~ ^[0-9a-f]{40}$ ]] || { echo "VERSION must be a full Git SHA" >&2; exit 1; }
    ssh "${ssh_options[@]}" -- "$DEPLOY_HOST" "bash ~/sailq-deploy/release.sh activate $VERSION"
    exit
fi

if [[ -n $(git status --porcelain) ]]; then
    echo "Commit changes before deploying" >&2
    exit 1
fi

revision=$(git rev-parse HEAD)
GIT_SSH_COMMAND='ssh -o BatchMode=yes -o StrictHostKeyChecking=yes' \
    git push -- "$DEPLOY_HOST:sailq-deploy/source.git" "HEAD:refs/deploy/$revision"
ssh "${ssh_options[@]}" -- "$DEPLOY_HOST" "bash ~/sailq-deploy/release.sh checkout $revision"
