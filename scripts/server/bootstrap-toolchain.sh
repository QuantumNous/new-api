#!/usr/bin/env bash
# Install Go + Bun on the production host (idempotent).
set -euo pipefail

GO_VERSION="${GO_VERSION:-1.25.1}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) GO_ARCH=amd64; BUN_ARCH=x64 ;;
  aarch64|arm64) GO_ARCH=arm64; BUN_ARCH=aarch64 ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

need_cmd() { command -v "$1" >/dev/null 2>&1; }

install_go() {
  if need_cmd go; then
    local cur
    cur="$(go env GOVERSION 2>/dev/null || true)"
    if [[ "$cur" == "go${GO_VERSION}" ]]; then
      echo "go ${GO_VERSION} already installed"
      return 0
    fi
  fi
  echo "installing go ${GO_VERSION} (${GO_ARCH})..."
  local tgz="/tmp/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -o "$tgz"
  rm -rf /usr/local/go
  tar -C /usr/local -xzf "$tgz"
  rm -f "$tgz"
  ln -sfn /usr/local/go/bin/go /usr/local/bin/go
  ln -sfn /usr/local/go/bin/gofmt /usr/local/bin/gofmt
  go version
}

install_unzip() {
  if need_cmd unzip; then
    return 0
  fi
  echo "installing unzip..."
  if need_cmd apt-get; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq unzip ca-certificates curl
  elif need_cmd dnf; then
    dnf install -y unzip ca-certificates curl
  else
    echo "install unzip manually" >&2
    exit 1
  fi
}

install_bun() {
  if need_cmd bun; then
    echo "bun already installed: $(bun --version)"
    return 0
  fi
  install_unzip
  echo "installing bun..."
  curl -fsSL https://bun.sh/install | bash
  ln -sfn "$HOME/.bun/bin/bun" /usr/local/bin/bun
  bun --version
}

install_poppler() {
  # Document parsing (playground attachments) shells out to pdftotext/pdftoppm.
  if need_cmd pdftotext && need_cmd pdftoppm; then
    return 0
  fi
  echo "installing poppler-utils..."
  if need_cmd apt-get; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq poppler-utils
  elif need_cmd dnf; then
    dnf install -y poppler-utils
  else
    echo "install poppler-utils manually (pdftotext/pdftoppm required)" >&2
  fi
}

export PATH="/usr/local/go/bin:${HOME}/.bun/bin:/usr/local/bin:${PATH}"
install_go
install_bun
install_poppler
echo "toolchain ready"
