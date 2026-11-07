#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo 'Usage: ./auto_push.sh "commit message"'
  exit 1
fi

git add .
git commit -m "$*"
git pull origin main --rebase
git push origin main
