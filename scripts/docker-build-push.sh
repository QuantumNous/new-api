#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE="${IMAGE:-registry.mrdnd.dev/new-api}"
DATE_TAG="${DATE_TAG:-$(date +%Y%m%d)}"
PLATFORMS="${PLATFORMS:-linux/amd64}"
PUSH="${PUSH:-true}"

usage() {
  cat <<USAGE
Usage: $0 [--image registry/name] [--date-tag yyyyMMdd] [--platforms linux/amd64[,linux/arm64]] [--load]

Builds Docker image tags:
  ${IMAGE}:latest
  ${IMAGE}:${DATE_TAG}

Defaults:
  IMAGE=registry.mrdnd.dev/new-api
  DATE_TAG=$(date +%Y%m%d)
  PLATFORMS=linux/amd64
  PUSH=true

Set PUSH=false or pass --load to build locally without pushing. --load requires one platform.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --image)
      IMAGE="${2:?missing image}"
      shift 2
      ;;
    --date-tag)
      DATE_TAG="${2:?missing date tag}"
      shift 2
      ;;
    --platforms)
      PLATFORMS="${2:?missing platforms}"
      shift 2
      ;;
    --load)
      PUSH=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! [[ "$DATE_TAG" =~ ^[0-9]{8}$ ]]; then
  printf 'DATE_TAG must use yyyyMMdd, got: %s\n' "$DATE_TAG" >&2
  exit 2
fi

if [ "$PUSH" = true ]; then
  OUTPUT_FLAG=(--push)
else
  if [[ "$PLATFORMS" == *,* ]]; then
    printf '--load supports one platform only, got: %s\n' "$PLATFORMS" >&2
    exit 2
  fi
  OUTPUT_FLAG=(--load)
fi

printf 'Building %s with tags %s:latest and %s:%s for %s\n' "$IMAGE" "$IMAGE" "$IMAGE" "$DATE_TAG" "$PLATFORMS"

docker buildx build \
  --platform "$PLATFORMS" \
  -t "$IMAGE:latest" \
  -t "$IMAGE:$DATE_TAG" \
  "${OUTPUT_FLAG[@]}" \
  .
