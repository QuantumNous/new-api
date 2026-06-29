#!/bin/bash
set -e

BLUE='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_ENV_FILE="${SCRIPT_DIR}/.build.env"

if [ -f "$BUILD_ENV_FILE" ]; then
    set -a
    source "$BUILD_ENV_FILE"
    set +a
fi

NEW_API_PATH="/Users/linbiqiu/new-api-test/new-api-fork"
ACR_REGISTRY="crpi-bij57v7e3thiuuod.cn-shenzhen.personal.cr.aliyuncs.com"
ACR_NAMESPACE="ccpg_einwin"

info()    { echo -e "${BLUE}[INFO]${RESET} $1"; }
success() { echo -e "${GREEN}[OK]${RESET} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $1"; }
error()   { echo -e "${RED}[ERROR]${RESET} $1"; exit 1; }

usage() {
    echo ""
    echo -e "${BOLD}Usage:${RESET}"
    echo "  $0 <version> [options]"
    echo ""
    echo -e "${BOLD}Options:${RESET}"
    echo "  --skip-build     Skip local Go/bun build (use existing binary)"
    echo "  --skip-push      Skip ACR push"
    echo "  --skip-classic   Skip classic frontend build"
    echo "  --skip-default   Skip default frontend build"
    echo ""
    echo -e "${BOLD}Examples:${RESET}"
    echo "  $0 1.1.0                    # Full build + push"
    echo "  $0 1.1.0 --skip-push        # Build only, don't push"
    echo "  $0 1.1.0 --skip-build       # Use existing binary, build image + push"
    echo ""
    exit 1
}

if [ $# -lt 1 ]; then
    usage
fi

VERSION="$1"
shift
SKIP_BUILD=false
SKIP_PUSH=false
SKIP_CLASSIC=false
SKIP_DEFAULT=false

while [ $# -gt 0 ]; do
    case "$1" in
        --skip-build)   SKIP_BUILD=true; shift ;;
        --skip-push)    SKIP_PUSH=true; shift ;;
        --skip-classic) SKIP_CLASSIC=true; shift ;;
        --skip-default) SKIP_DEFAULT=true; shift ;;
        *) error "Unknown option: $1" ;;
    esac
done

IMAGE_TAG="${ACR_REGISTRY}/${ACR_NAMESPACE}/new-api:${VERSION}"
BINARY_PATH="${NEW_API_PATH}/new-api"

info "Version:    ${VERSION}"
info "Image:      ${IMAGE_TAG}"
info "Source:     ${NEW_API_PATH}"
echo ""

# Step 1: Local build
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  Step 1/4: Build Frontend & Backend${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    cd "$NEW_API_PATH"

    if [ "$SKIP_CLASSIC" = false ]; then
        info "Building classic frontend..."
        cd "${NEW_API_PATH}/web/classic"
        bun install
        bun run build
        success "Classic frontend built"
        cd "$NEW_API_PATH"
    fi

    if [ "$SKIP_DEFAULT" = false ]; then
        info "Building default frontend..."
        cd "${NEW_API_PATH}/web/default"
        bun install
        bun run build
        success "Default frontend built"
        cd "$NEW_API_PATH"
    fi

    info "Building Go binary (linux/amd64)..."
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GOEXPERIMENT=greenteagc \
        go build -ldflags "-s -w -X 'github.com/QuantumNous/new-api/common.Version=${VERSION}'" \
        -o new-api .
    success "Go binary built: $(ls -lh new-api | awk '{print $5}') (linux/amd64)"
else
    warn "Skipping local build (--skip-build)"
    if [ ! -f "$BINARY_PATH" ]; then
        error "Binary not found: $BINARY_PATH"
    fi
    info "Using existing binary: $(ls -lh $BINARY_PATH | awk '{print $5}')"
fi

# Step 2: Build Docker image
echo ""
echo -e "${BOLD}${BLUE}========================================${RESET}"
echo -e "${BOLD}${BLUE}  Step 2/4: Build Docker Image${RESET}"
echo -e "${BOLD}${BLUE}========================================${RESET}"
echo ""

cd "$NEW_API_PATH"

info "Building Docker image for linux/amd64..."
docker buildx build \
    --platform linux/amd64 \
    --provenance=false \
    --sbom=false \
    -t "$IMAGE_TAG" \
    -f deploy/Dockerfile.local \
    --load \
    . || error "Docker image build failed"

IMAGE_SIZE=$(docker images "$IMAGE_TAG" --format "{{.Size}}")
success "Image built: $IMAGE_TAG ($IMAGE_SIZE)"

# Step 3: Push to ACR
if [ "$SKIP_PUSH" = false ]; then
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  Step 3/4: Push to ACR${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    info "Logging in to ACR..."
    if [ -z "$ACR_PASSWORD" ]; then
        warn "ACR_PASSWORD not set in .build.env, falling back to interactive login"
        docker login --username="${ACR_USERNAME:-beacherlin}" "$ACR_REGISTRY" || error "ACR login failed"
    else
        echo "$ACR_PASSWORD" | docker login --username="${ACR_USERNAME:-beacherlin}" --password-stdin "$ACR_REGISTRY" || error "ACR login failed"
    fi

    info "Pushing image: $IMAGE_TAG"
    docker push "$IMAGE_TAG" || error "ACR push failed"
    success "Image pushed to ACR"
else
    warn "Skipping ACR push (--skip-push)"
fi

# Step 4: Summary
echo ""
echo -e "${BOLD}${GREEN}========================================${RESET}"
echo -e "${BOLD}${GREEN}  Build Complete!${RESET}"
echo -e "${BOLD}${GREEN}========================================${RESET}"
echo ""
echo -e "${BOLD}Version:${RESET}    $VERSION"
echo -e "${BOLD}Image:${RESET}      $IMAGE_TAG"
echo -e "${BOLD}Size:${RESET}       $IMAGE_SIZE"
echo ""
echo -e "${BOLD}Production deployment:${RESET}"
echo ""
echo -e "  1. SSH to production server"
echo -e "  2. cd /opt/production-deploy"
echo -e "  3. Backup: ${YELLOW}cp .env .env.bak.\$(date +%F-%H%M%S)${RESET}"
echo -e "  4. Edit .env: ${YELLOW}NEW_API_IMAGE=$IMAGE_TAG${RESET}"
echo -e "  5. Pull & restart: ${YELLOW}docker compose pull new-api && docker compose up -d new-api --no-deps${RESET}"
echo -e "  6. Verify: ${YELLOW}docker compose ps && curl -f http://127.0.0.1:3000/api/status${RESET}"
echo ""
echo -e "${BOLD}Rollback:${RESET} edit .env back to old tag, re-run step 5"
echo ""
