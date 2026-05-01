#!/bin/bash
set -e

BLUE='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

NEW_API_PATH=${NEW_API_PATH:-/Users/linbiqiu/new-api-test/new-api/deploy}
CLIPROXY_API_PATH=${CLIPROXY_API_PATH:-/Users/linbiqiu/trae/源码部署/CLIProxyAPI-main}

NEW_API_IMAGE=localhost/new-api:1.0.0
CLIPROXY_API_IMAGE=localhost/cliproxyapi:1.0.0

info()    { echo -e "${BLUE}[INFO]${RESET} $1"; }
success() { echo -e "${GREEN}[OK]${RESET} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $1"; }
error()   { echo -e "${RED}[ERROR]${RESET} $1"; exit 1; }

check_docker() {
    info "Checking Docker environment..."
    command -v docker &> /dev/null || error "Docker not installed, please install Docker first"
    docker info &> /dev/null || error "Docker daemon not running, please start Docker"
    success "Docker environment OK"
}

cleanup() {
    info "Cleaning old output files..."
    rm -rf "$OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
    success "Output directory cleaned: $OUTPUT_DIR"
}

build_new_api() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  Build new-api Image${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    if [ ! -d "$NEW_API_PATH" ]; then
        error "new-api project path not found: $NEW_API_PATH"
    fi

    if [ ! -f "$NEW_API_PATH/Dockerfile.optimized" ]; then
        error "Dockerfile.optimized not found: $NEW_API_PATH/Dockerfile.optimized"
    fi

    cd "$NEW_API_PATH"

    info "Building new-api image (linux/amd64)..."
    docker build \
        --platform linux/amd64 \
        --build-arg ENV=production \
        --build-arg VERSION=1.0.0 \
        -t "$NEW_API_IMAGE" \
        -f Dockerfile.optimized \
        .. || error "new-api image build failed"

    NEW_API_SIZE=$(docker images "$NEW_API_IMAGE" --format "{{.Size}}")
    success "new-api image built: $NEW_API_IMAGE ($NEW_API_SIZE)"
}

build_cliproxy_api() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  Build CLIProxyAPI Image${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    if [ ! -d "$CLIPROXY_API_PATH" ]; then
        error "CLIProxyAPI project path not found: $CLIPROXY_API_PATH"
    fi

    if [ ! -f "$CLIPROXY_API_PATH/Dockerfile" ]; then
        error "Dockerfile not found: $CLIPROXY_API_PATH/Dockerfile"
    fi

    cd "$CLIPROXY_API_PATH"

    info "Building CLIProxyAPI image (linux/amd64, using China Go proxy)..."
    docker build \
        --platform linux/amd64 \
        --build-arg VERSION=1.0.0 \
        --build-arg GOPROXY=https://goproxy.cn,https://mirrors.aliyun.com/goproxy/,direct \
        --build-arg GOSUMDB=sum.golang.google.cn \
        -t "$CLIPROXY_API_IMAGE" \
        . || error "CLIProxyAPI image build failed"

    CLIPROXY_SIZE=$(docker images "$CLIPROXY_API_IMAGE" --format "{{.Size}}")
    success "CLIProxyAPI image built: $CLIPROXY_API_IMAGE ($CLIPROXY_SIZE)"
}

export_images() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE} Export Docker Images${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    cd "$OUTPUT_DIR"

    info "Exporting new-api image..."
    docker save -o new-api.tar "$NEW_API_IMAGE" || error "new-api image export failed"
    NEW_API_TAR_SIZE=$(ls -lh new-api.tar | awk '{print $5}')
    success "new-api image exported: new-api.tar ($NEW_API_TAR_SIZE)"

    info "Exporting CLIProxyAPI image..."
    docker save -o cliproxyapi.tar "$CLIPROXY_API_IMAGE" || error "CLIProxyAPI image export failed"
    CLIPROXY_TAR_SIZE=$(ls -lh cliproxyapi.tar | awk '{print $5}')
    success "CLIProxyAPI image exported: cliproxyapi.tar ($CLIPROXY_TAR_SIZE)"
}

copy_configs() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE} Copy Config Files${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    cd "$SCRIPT_DIR"

    cp docker-compose.yml "$OUTPUT_DIR/" || error "docker-compose.yml copy failed"
    success "Copied: docker-compose.yml"

    if [ -f ".env" ]; then
        cp .env "$OUTPUT_DIR/" || error ".env copy failed"
        success "Copied: .env"
    else
        warn ".env file not found, copying .env.example"
        cp .env.example "$OUTPUT_DIR/.env" || error ".env.example copy failed"
        success "Copied: .env.example -> .env"
    fi

    cp init-db.sh "$OUTPUT_DIR/" || error "init-db.sh copy failed"
    success "Copied: init-db.sh"

    if [ -f "config.example.yaml" ]; then
        cp config.example.yaml "$OUTPUT_DIR/" || error "config.example.yaml copy failed"
        success "Copied: config.example.yaml"
    fi

    if [ -f "production-deploy.service" ]; then
        cp production-deploy.service "$OUTPUT_DIR/" || error "production-deploy.service copy failed"
        success "Copied: production-deploy.service"
    fi
}

package_all() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE} Package All Files${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    cd "$SCRIPT_DIR"

    PACKAGE_NAME="production-deploy-${TIMESTAMP}.tar.gz"

    info "Packaging files to: $PACKAGE_NAME"
    tar -czf "$PACKAGE_NAME" -C "$OUTPUT_DIR" . || error "Package failed"

    PACKAGE_SIZE=$(ls -lh "$PACKAGE_NAME" | awk '{print $5}')
    success "Package complete: $PACKAGE_NAME ($PACKAGE_SIZE)"

    mv "$PACKAGE_NAME" "$OUTPUT_DIR/"
}

show_result() {
    echo ""
    echo -e "${BOLD}${GREEN}========================================${RESET}"
    echo -e "${BOLD}${GREEN} Build and Package Complete!${RESET}"
    echo -e "${BOLD}${GREEN}========================================${RESET}"
    echo ""
    echo -e "${BOLD}Output directory:${RESET} $OUTPUT_DIR"
    echo ""
    echo -e "${BOLD}File list:${RESET}"
    ls -lh "$OUTPUT_DIR"
    echo ""
    echo -e "${BOLD}Next steps:${RESET}"
    echo ""
    echo -e "  1. Upload all files in output directory to jump server"
    echo -e "  2. Upload from jump server to production server"
    echo -e "  3. Execute deployment commands on production server (see README.md)"
    echo ""
    echo -e "${BOLD}Quick upload command (local -> jump server):${RESET}"
    echo -e "  ${YELLOW}scp -r output/* user@jump-server:/tmp/production-deploy/${RESET}"
    echo ""
}

main() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE} Production Environment Build and Package${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    check_docker
    cleanup
    build_new_api
    build_cliproxy_api
    export_images
    copy_configs
    package_all
    show_result
}

main
