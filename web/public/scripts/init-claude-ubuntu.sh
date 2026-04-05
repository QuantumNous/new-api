#!/usr/bin/env bash
# init-claude-ubuntu.sh — Install Claude Code + CC Switch on Ubuntu
set -euo pipefail

step()  { echo ""; echo "[*] $*"; }
ok()    { echo "[+] $*"; }
warn()  { echo "[!] $*"; }
die()   { echo "[x] $*" >&2; exit 1; }

AUTO_YES="false"
SUDO=""
APT_MIRROR="${APT_MIRROR:-http://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
GITHUB_PROXY_PREFIX="${GITHUB_PROXY_PREFIX:-}"
NODEJS_MIRROR="${NODEJS_MIRROR:-https://npmmirror.com/mirrors/node}"
NODEJS_MAJOR="${NODEJS_MAJOR:-20}"

require_cmd() {
    command -v "$1" &>/dev/null || die "$1 not found. $2"
}

github_url() {
    local url="$1"
    if [[ -n "$GITHUB_PROXY_PREFIX" ]]; then
        printf '%s%s\n' "$GITHUB_PROXY_PREFIX" "$url"
    else
        printf '%s\n' "$url"
    fi
}

check_url_head() {
    local url="$1"
    curl -fsSI --connect-timeout 5 --max-time 15 \
        -H "User-Agent: bash-installer" \
        "$url" >/dev/null 2>&1
}

confirm_yes_no() {
    local prompt="$1"
    local default="${2:-Y}"
    local reply=""
    local hint="[Y/n]"
    [[ "$default" == "N" ]] && hint="[y/N]"

    if [[ "$AUTO_YES" == "true" ]]; then
        echo "$prompt $hint: y"
        return 0
    fi

    while true; do
        read -rp "$prompt $hint: " reply </dev/tty
        reply="${reply//[[:space:]]/}"
        local normalized
        normalized="$(printf '%s' "$reply" | tr '[:upper:]' '[:lower:]')"
        if [[ -z "$reply" ]]; then
            [[ "$default" == "Y" ]] && return 0
            return 1
        fi
        case "$normalized" in
            y|yes) return 0 ;;
            n|no) return 1 ;;
        esac
        warn "Please answer y or n." >/dev/tty
    done
}

read_required() {
    local prompt="$1"
    local secret="${2:-}"
    local value=""
    while [[ -z "$value" ]]; do
        if [[ "$secret" == "secret" ]]; then
            read -rsp "$prompt: " value </dev/tty
            echo "" >/dev/tty
        else
            read -rp "$prompt: " value </dev/tty
        fi
        [[ -z "$value" ]] && warn "Input cannot be empty. Please try again." >/dev/tty
    done
    echo "$value"
}

refresh_path() {
    for p in /usr/local/bin /usr/bin /bin "$HOME/.local/bin" "$HOME/.npm-global/bin"; do
        [[ -d "$p" && ":$PATH:" != *":$p:"* ]] && export PATH="$p:$PATH"
    done
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
        # shellcheck disable=SC1091
        source "$HOME/.nvm/nvm.sh" 2>/dev/null || true
    fi
}

setup_sudo() {
    if [[ "$(id -u)" -eq 0 ]]; then
        SUDO=""
        return
    fi
    command -v sudo &>/dev/null || die "sudo not found. Install sudo or run this script as root."
    SUDO="sudo"
}

run_with_retries() {
    local attempts="$1"
    shift

    local i=1
    while (( i <= attempts )); do
        if "$@"; then
            return 0
        fi
        if (( i == attempts )); then
            return 1
        fi
        warn "Command failed (attempt $i/$attempts). Retrying in 5 seconds..."
        sleep 5
        i=$((i + 1))
    done
}

apt_install() {
    local packages=("$@")
    run_with_retries 3 env DEBIAN_FRONTEND=noninteractive $SUDO apt-get -o Acquire::Retries=5 install -y "${packages[@]}"
}

configure_apt_mirror() {
    local mirror="${APT_MIRROR%/}"
    local codename="${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}"
    [[ -n "$codename" ]] || die "Cannot determine Ubuntu codename from /etc/os-release."

    if [[ -f /etc/apt/sources.list.d/ubuntu.sources ]]; then
        local target="/etc/apt/sources.list.d/ubuntu.sources"
        local backup="${target}.bak-$(date +%Y%m%d-%H%M%S)"
        $SUDO cp "$target" "$backup"
        $SUDO tee "$target" >/dev/null <<EOF
Types: deb
URIs: $mirror
Suites: $codename ${codename}-updates ${codename}-backports ${codename}-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
    else
        local target="/etc/apt/sources.list"
        local backup="${target}.bak-$(date +%Y%m%d-%H%M%S)"
        $SUDO cp "$target" "$backup"
        $SUDO tee "$target" >/dev/null <<EOF
deb $mirror $codename main restricted universe multiverse
deb $mirror ${codename}-updates main restricted universe multiverse
deb $mirror ${codename}-backports main restricted universe multiverse
deb $mirror ${codename}-security main restricted universe multiverse
EOF
    fi

    ok "APT mirror configured: $mirror"
}

ensure_apt_packages() {
    local missing=()
    local pkg
    for pkg in "$@"; do
        dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
    done

    if [[ "${#missing[@]}" -eq 0 ]]; then
        return
    fi

    if ! confirm_yes_no "Missing APT packages detected: ${missing[*]}. Install them now?" "Y"; then
        die "Required Ubuntu packages are missing: ${missing[*]}"
    fi

    step "Installing Ubuntu packages: ${missing[*]}..."
    run_with_retries 3 env DEBIAN_FRONTEND=noninteractive $SUDO apt-get -o Acquire::Retries=5 update
    apt_install "${missing[@]}"
    ok "Ubuntu packages are ready."
}

ensure_fuse_runtime() {
    if dpkg -s libfuse2 >/dev/null 2>&1 || dpkg -s libfuse2t64 >/dev/null 2>&1; then
        return
    fi

    if apt-cache show libfuse2t64 >/dev/null 2>&1; then
        ensure_apt_packages libfuse2t64
    else
        ensure_apt_packages libfuse2
    fi
}

ensure_nodejs_runtime() {
    if command -v node &>/dev/null && command -v npm &>/dev/null; then
        return
    fi

    if ! confirm_yes_no "Node.js/npm is missing. Install Node.js from the configured mirror now?" "Y"; then
        die "Node.js/npm is required to install Claude Code."
    fi

    local arch_suffix=""
    case "$ARCH" in
        x86_64|amd64) arch_suffix="x64" ;;
        aarch64|arm64) arch_suffix="arm64" ;;
        *) die "Unsupported Ubuntu architecture for Node.js: $ARCH" ;;
    esac

    local latest_version=""
    latest_version="$(
        curl -fsSL "$(printf '%s/latest-v%s.x/SHASUMS256.txt' "${NODEJS_MIRROR%/}" "$NODEJS_MAJOR")" | \
        sed -n 's/.*node-v\([0-9][^ ]*\)-linux-'"$arch_suffix"'\.tar\.gz/\1/p' | head -1
    )"
    [[ -n "$latest_version" ]] || die "Failed to determine the latest Node.js v${NODEJS_MAJOR}.x version from $NODEJS_MIRROR"

    local base_dir="$HOME/.local/opt/nodejs"
    local install_dir="$base_dir/node-v${latest_version}-linux-${arch_suffix}"
    local tarball_url="${NODEJS_MIRROR%/}/latest-v${NODEJS_MAJOR}.x/node-v${latest_version}-linux-${arch_suffix}.tar.gz"
    local tmp_tar
    tmp_tar="$(mktemp)"

    step "Installing Node.js v${latest_version} from mirror..."
    mkdir -p "$base_dir" "$HOME/.local/bin"
    curl -fsSL -o "$tmp_tar" "$tarball_url"
    rm -rf "$install_dir"
    tar -xzf "$tmp_tar" -C "$base_dir"
    rm -f "$tmp_tar"

    ln -sf "$install_dir/bin/node" "$HOME/.local/bin/node"
    ln -sf "$install_dir/bin/npm" "$HOME/.local/bin/npm"
    ln -sf "$install_dir/bin/npx" "$HOME/.local/bin/npx"
    if [[ -x "$install_dir/bin/corepack" ]]; then
        ln -sf "$install_dir/bin/corepack" "$HOME/.local/bin/corepack"
    fi

    refresh_path
    command -v node &>/dev/null || die "node not found after mirror installation."
    command -v npm &>/dev/null || die "npm not found after mirror installation."
    ok "Node.js and npm are ready."
}

get_latest_github_tag_via_redirect() {
    local repo="$1"
    local location=""

    location="$(curl -fsSLI \
        -H "User-Agent: bash-installer" \
        "$(github_url "https://github.com/$repo/releases/latest")" 2>/dev/null | \
        awk 'BEGIN{IGNORECASE=1} /^location:/ {sub(/\r$/, "", $2); print $2}' | tail -1)"

    if [[ "$location" == *"/tag/"* ]]; then
        printf '%s\n' "${location##*/tag/}" | sed 's/^v//'
        return
    fi

    echo ""
}

get_latest_claude_version() {
    curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        -H "User-Agent: bash-installer" \
        "$(github_url "https://api.github.com/repos/anthropics/claude-code/releases/latest")" \
        2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['tag_name'].lstrip('v'))" 2>/dev/null || echo ""
}

ensure_claude_code() {
    step "Checking Claude Code CLI..."
    refresh_path

    local current_version=""
    local latest_version=""

    if command -v claude &>/dev/null; then
        current_version="$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
        latest_version="$(get_latest_claude_version)"
        if [[ -n "$current_version" && -n "$latest_version" && "$current_version" == "$latest_version" ]]; then
            ok "Claude Code is already up to date: $current_version"
            return
        fi
        if [[ -n "$current_version" && -n "$latest_version" ]]; then
            step "Updating Claude Code ($current_version -> $latest_version)..."
        else
            step "Updating Claude Code CLI..."
        fi
    else
        step "Installing Claude Code CLI..."
    fi

    if ! command -v npm &>/dev/null; then
        die "npm is required to install Claude Code."
    fi

    mkdir -p "$HOME/.npm-global"
    npm --registry "$NPM_REGISTRY" install -g --prefix "$HOME/.npm-global" @anthropic-ai/claude-code
    refresh_path
    command -v claude &>/dev/null || die "claude command not found after installation."

    local version
    version="$(claude --version 2>/dev/null || true)"
    if [[ -n "$version" ]]; then
        ok "Claude Code is ready: $version"
    else
        ok "Claude Code installed."
    fi
}

write_claude_settings() {
    step "Writing Claude Code settings..."

    local claude_dir="$HOME/.claude"
    local settings_path="$claude_dir/settings.json"
    mkdir -p "$claude_dir"

    if [[ -f "$settings_path" ]]; then
        cp "$settings_path" "${settings_path}.bak-$(date +%Y%m%d-%H%M%S)"
    fi

    _PROXY="$API_PROXY" _TOKEN="$API_KEY" _MODEL="$MODEL" _PATH="$settings_path" \
    python3 - <<'PYEOF'
import json, os

settings_path = os.environ["_PATH"]

try:
    with open(settings_path) as f:
        existing = json.load(f)
except Exception:
    existing = {}

env = existing.setdefault("env", {})
env["ANTHROPIC_BASE_URL"] = os.environ["_PROXY"]
env["ANTHROPIC_AUTH_TOKEN"] = os.environ["_TOKEN"]

model = os.environ.get("_MODEL", "")
if model:
    env["ANTHROPIC_MODEL"] = model
elif "ANTHROPIC_MODEL" in env:
    del env["ANTHROPIC_MODEL"]

with open(settings_path, "w") as f:
    json.dump(existing, f, indent=2)
    f.write("\n")
PYEOF

    ok "Claude settings written to $settings_path"
    CLAUDE_SETTINGS_PATH="$settings_path"
}

write_ccswitch_config() {
    step "Preparing CC Switch bootstrap config..."

    local cc_dir="$HOME/.cc-switch"
    local db_path="$cc_dir/cc-switch.db"
    local config_path="$cc_dir/config.json"
    mkdir -p "$cc_dir"

    CCSWITCH_CONFIG_PATH="$config_path"
    CCSWITCH_BOOTSTRAP_WRITTEN="false"

    if [[ -f "$db_path" ]]; then
        warn "Existing CC Switch database detected. Skipping bootstrap to avoid overwriting. To add this proxy, use the in-app 'Add Provider' option."
        return
    fi

    local website_url
    website_url="$(python3 -c "from urllib.parse import urlparse; u=urlparse('$API_PROXY'); print(u.scheme+'://'+u.netloc)")"
    local created_at
    created_at="$(python3 -c "import time; print(int(time.time()))")"
    local provider_id
    provider_id="claude-$(python3 -c "import uuid; print(uuid.uuid4().hex[:12])")"

    if [[ -f "$config_path" ]]; then
        cp "$config_path" "${config_path}.bak-$(date +%Y%m%d-%H%M%S)"
    fi

    _PROXY="$API_PROXY" _TOKEN="$API_KEY" _MODEL="$MODEL" \
    _PROVIDER_ID="$provider_id" _PROVIDER_NAME="$PROVIDER_NAME" \
    _WEBSITE="$website_url" _CREATED_AT="$created_at" _PATH="$config_path" \
    python3 - <<'PYEOF'
import json, os

proxy = os.environ["_PROXY"]
token = os.environ["_TOKEN"]
model = os.environ.get("_MODEL", "")
provider_id = os.environ["_PROVIDER_ID"]
provider_name = os.environ["_PROVIDER_NAME"]
website_url = os.environ["_WEBSITE"]
created_at = int(os.environ["_CREATED_AT"])
config_path = os.environ["_PATH"]

provider_env = {
    "ANTHROPIC_BASE_URL": proxy,
    "ANTHROPIC_AUTH_TOKEN": token,
}
if model:
    provider_env["ANTHROPIC_MODEL"] = model

provider = {
    "id": provider_id,
    "name": provider_name,
    "settingsConfig": {"env": provider_env},
    "websiteUrl": website_url,
    "category": "custom",
    "createdAt": created_at,
    "sortIndex": 0,
}

def empty_mgr():
    return {"providers": {}, "current": ""}

claude_mgr = empty_mgr()
claude_mgr["providers"][provider_id] = provider
claude_mgr["current"] = provider_id

config = {
    "version": 2,
    "claude": claude_mgr,
    "codex": empty_mgr(),
    "gemini": empty_mgr(),
    "opencode": empty_mgr(),
    "openclaw": empty_mgr(),
}

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")
PYEOF

    ok "CC Switch bootstrap config written to $config_path"
    CCSWITCH_BOOTSTRAP_WRITTEN="true"
}

get_ccswitch_app_path() {
    local candidates=(
        "$HOME/.local/bin/cc-switch"
        "$HOME/.local/opt/cc-switch/CC-Switch.AppImage"
    )
    local p
    for p in "${candidates[@]}"; do
        [[ -x "$p" ]] && echo "$p" && return
    done
    echo ""
}

ensure_ccswitch() {
    step "Fetching latest CC Switch Linux installer..."

    local release_json
    release_json="$(curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        -H "User-Agent: bash-installer" \
        "$(github_url "https://api.github.com/repos/farion1231/cc-switch/releases/latest")" 2>/dev/null || true)"

    local latest_version=""
    if [[ -n "$release_json" ]]; then
        latest_version="$(printf '%s' "$release_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'].lstrip('v'))" 2>/dev/null || true)"
    fi
    if [[ -z "$latest_version" ]]; then
        warn "GitHub API request for CC Switch release metadata failed or was rate-limited. Falling back to GitHub redirect lookup."
        latest_version="$(get_latest_github_tag_via_redirect "farion1231/cc-switch")"
    fi
    [[ -n "$latest_version" ]] || die "Failed to determine latest CC Switch version from GitHub."

    local arch_suffix=""
    case "$ARCH" in
        x86_64|amd64) arch_suffix="x86_64" ;;
        aarch64|arm64) arch_suffix="arm64" ;;
        *) die "Unsupported Ubuntu architecture for CC Switch: $ARCH" ;;
    esac

    local install_dir="$HOME/.local/opt/cc-switch"
    local app_path="$install_dir/CC-Switch.AppImage"
    local version_file="$install_dir/.version"
    mkdir -p "$install_dir" "$HOME/.local/bin" "$HOME/.local/share/applications"

    if [[ -f "$version_file" ]] && [[ "$(cat "$version_file")" == "$latest_version" ]] && [[ -x "$app_path" ]]; then
        ok "CC Switch is already up to date: $latest_version"
        CCSWITCH_EXE_PATH="$app_path"
        return
    fi

    step "Installing CC Switch ($latest_version)..."

    local appimage_url=""
    if [[ -n "$release_json" ]]; then
        appimage_url="$(
            _RELEASE_JSON="$release_json" _ARCH_SUFFIX="$arch_suffix" python3 - <<'PYEOF'
import json, os, sys

data = json.loads(os.environ["_RELEASE_JSON"])
arch = os.environ["_ARCH_SUFFIX"]
for asset in data.get("assets", []):
    name = asset["name"]
    if name == f"CC-Switch-v{data['tag_name'].lstrip('v')}-Linux-{arch}.AppImage":
        print(asset["browser_download_url"])
        sys.exit(0)
print("")
PYEOF
        )"
    fi

    if [[ -z "$appimage_url" ]]; then
        appimage_url="$(github_url "https://github.com/farion1231/cc-switch/releases/download/v${latest_version}/CC-Switch-v${latest_version}-Linux-${arch_suffix}.AppImage")"
    fi

    local tmp_appimage
    tmp_appimage="$(mktemp)"
    curl -fsSL -o "$tmp_appimage" "$appimage_url"
    mv "$tmp_appimage" "$app_path"
    chmod +x "$app_path"
    printf '%s\n' "$latest_version" > "$version_file"
    ln -sf "$app_path" "$HOME/.local/bin/cc-switch"

    cat > "$HOME/.local/share/applications/cc-switch.desktop" <<EOF
[Desktop Entry]
Name=CC Switch
Exec=$app_path
Terminal=false
Type=Application
Categories=Development;
EOF

    ok "CC Switch installed to $app_path"
    CCSWITCH_EXE_PATH="$app_path"
}

launch_ccswitch() {
    local exe_path="$1"
    if [[ -z "$exe_path" ]]; then
        warn "Cannot auto-launch CC Switch. On first manual launch it will import the generated config."
        return
    fi

    if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
        warn "No desktop session detected. Skipping auto-launch. Run 'cc-switch' manually in a GUI session to complete the import."
        return
    fi

    step "Launching CC Switch for first-run import..."
    nohup "$exe_path" >/dev/null 2>&1 &

    local db_path="$HOME/.cc-switch/cc-switch.db"
    local deadline=$(( $(date +%s) + 30 ))
    while [[ $(date +%s) -lt $deadline ]]; do
        [[ -f "$db_path" ]] && { ok "CC Switch first-run initialization complete."; return; }
        sleep 1
    done
    warn "CC Switch launched, but database file not detected within 30 seconds. Config will be imported on first manual open."
}

preflight_checks() {
    step "Running preflight checks..."
    refresh_path
    setup_sudo
    configure_apt_mirror

    require_cmd "bash" "bash is required."
    require_cmd "apt-get" "apt-get is required. This script supports Ubuntu only."
    require_cmd "apt-cache" "apt-cache is required. This script supports Ubuntu only."
    require_cmd "dpkg" "dpkg is required. This script supports Ubuntu only."

    ensure_apt_packages ca-certificates curl python3
    ensure_fuse_runtime
    ensure_nodejs_runtime
    refresh_path

    require_cmd "curl" "curl is required. Install it with: sudo apt-get install curl"
    require_cmd "python3" "python3 is required. Install it with: sudo apt-get install python3"
    require_cmd "sed" "sed is required."
    require_cmd "awk" "awk is required."
    require_cmd "find" "find is required."
    require_cmd "grep" "grep is required."
    require_cmd "tail" "tail is required."
    require_cmd "mv" "mv is required."
    require_cmd "ln" "ln is required."
    require_cmd "chmod" "chmod is required."
    require_cmd "nohup" "nohup is required."
    require_cmd "tar" "tar is required."
    require_cmd "mktemp" "mktemp is required."

    if ! check_url_head "$APT_MIRROR"; then
        die "Cannot reach configured APT mirror: $APT_MIRROR"
    fi

    if ! check_url_head "https://github.com" && [[ -z "$GITHUB_PROXY_PREFIX" ]]; then
        warn "Cannot reach https://github.com directly."
        warn "If you are in mainland China, consider setting GITHUB_PROXY_PREFIX, for example:"
        warn "  export GITHUB_PROXY_PREFIX='https://your-github-proxy/'"
    fi

    if command -v npm &>/dev/null; then
        if ! check_url_head "$NPM_REGISTRY"; then
            warn "Cannot reach npm registry right now: $NPM_REGISTRY"
        fi
    fi

    if ! check_url_head "$API_PROXY"; then
        warn "Cannot reach the configured API proxy right now: $API_PROXY"
        warn "Claude Code may install successfully, but requests through the proxy will fail until this endpoint is reachable."
    fi

    ok "Preflight checks passed."
}

[[ "$(uname)" == "Linux" ]] || die "This script is for Ubuntu Linux only. Use init-claude.sh on macOS or init-claude.ps1 on Windows."
[[ -f /etc/os-release ]] || die "/etc/os-release not found. This script supports Ubuntu only."
# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "Detected ${ID:-unknown}. This script currently supports Ubuntu only."

ARCH="$(uname -m)"
refresh_path

POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -y|--yes)
            AUTO_YES="true"
            shift
            ;;
        --)
            shift
            while [[ $# -gt 0 ]]; do
                POSITIONAL_ARGS+=("$1")
                shift
            done
            ;;
        -*)
            die "Unknown option: $1"
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

API_PROXY="${POSITIONAL_ARGS[0]:-}"
API_KEY="${POSITIONAL_ARGS[1]:-}"
PROVIDER_NAME="${POSITIONAL_ARGS[2]:-}"
MODEL="${POSITIONAL_ARGS[3]:-}"
SKIP_LAUNCH="${POSITIONAL_ARGS[4]:-}"

if [[ -z "$API_PROXY" ]]; then
    API_PROXY="$(read_required "Enter API Proxy URL (e.g. https://example.com/v1)")"
fi

if [[ -z "$API_KEY" ]]; then
    API_KEY="$(read_required "Enter API Key" secret)"
fi

API_PROXY="${API_PROXY%/}"
if [[ ! "$API_PROXY" =~ ^https?:// ]]; then
    die "API Proxy must start with http:// or https://"
fi

if [[ -z "$PROVIDER_NAME" ]]; then
    HOST="$(echo "$API_PROXY" | awk -F/ '{print $3}')"
    PROVIDER_NAME="Claude Proxy - $HOST"
fi

step "Starting Claude Code + CC Switch installation on Ubuntu ($ARCH)..."

preflight_checks
ensure_claude_code
write_claude_settings
write_ccswitch_config
ensure_ccswitch

CCSWITCH_EXE_PATH="${CCSWITCH_EXE_PATH:-$(get_ccswitch_app_path)}"

if [[ "$CCSWITCH_BOOTSTRAP_WRITTEN" == "true" && -z "$SKIP_LAUNCH" ]]; then
    launch_ccswitch "$CCSWITCH_EXE_PATH"
fi

echo ""
echo "[+] Installation complete."
echo "    Claude settings file:       ${CLAUDE_SETTINGS_PATH:-$HOME/.claude/settings.json}"
echo "    CC Switch bootstrap config: ${CCSWITCH_CONFIG_PATH:-$HOME/.cc-switch/config.json}"
echo "    CC Switch executable:       ${CCSWITCH_EXE_PATH:-$HOME/.local/bin/cc-switch}"
echo ""
echo "Next steps:"
echo "  1. Run 'claude' to start using Claude Code."
echo "  2. Run 'cc-switch' in a desktop session if CC Switch was not auto-launched."
[[ -n "$MODEL" ]] && echo "  3. Model configured: $MODEL"
