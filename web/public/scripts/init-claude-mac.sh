#!/usr/bin/env bash
# init-claude.sh — Install Claude Code + CC Switch on macOS
set -euo pipefail

# ── Helpers ───────────────────────────────────────────────────────────────────
step()  { echo ""; echo "[*] $*"; }
ok()    { echo "[+] $*"; }
warn()  { echo "[!] $*"; }

die() { echo "[x] $*" >&2; exit 1; }

AUTO_YES="false"

require_cmd() {
    command -v "$1" &>/dev/null || die "$1 not found. $2"
}

require_any_cmd() {
    local found="false"
    for cmd in "$@"; do
        if command -v "$cmd" &>/dev/null; then
            found="true"
            break
        fi
    done
    [[ "$found" == "true" ]]
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

wait_for_xcode_clt() {
    local attempts=180
    while (( attempts > 0 )); do
        if xcode-select -p >/dev/null 2>&1; then
            return 0
        fi
        sleep 5
        attempts=$((attempts - 1))
    done
    return 1
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

# ── Platform check ────────────────────────────────────────────────────────────
[[ "$(uname)" == "Darwin" ]] || die "This script is for macOS only. Use init-claude.ps1 on Windows."

ARCH="$(uname -m)"   # arm64 | x86_64

# ── Args / interactive prompts ────────────────────────────────────────────────
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

# Normalize proxy URL (strip trailing slash)
API_PROXY="${API_PROXY%/}"

# Validate URL scheme
if [[ ! "$API_PROXY" =~ ^https?:// ]]; then
    die "API Proxy must start with http:// or https://"
fi

# Default provider name from hostname
if [[ -z "$PROVIDER_NAME" ]]; then
    HOST="$(echo "$API_PROXY" | awk -F/ '{print $3}')"
    PROVIDER_NAME="Claude Proxy - $HOST"
fi

# ── PATH refresh ──────────────────────────────────────────────────────────────
refresh_path() {
    for p in /usr/local/bin /opt/homebrew/bin /opt/homebrew/sbin \
              "$HOME/.npm-global/bin" "$HOME/.local/bin"; do
        [[ -d "$p" && ":$PATH:" != *":$p:"* ]] && export PATH="$p:$PATH"
    done
    # nvm
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
        # shellcheck disable=SC1091
        source "$HOME/.nvm/nvm.sh" 2>/dev/null || true
    fi
}

refresh_path

# ── Preflight checks ──────────────────────────────────────────────────────────
ensure_xcode_clt() {
    if xcode-select -p >/dev/null 2>&1; then
        return
    fi

    warn "Xcode Command Line Tools do not appear to be installed."
    if ! confirm_yes_no "Install Xcode Command Line Tools now? macOS may show a system dialog." "Y"; then
        die "Xcode Command Line Tools are required. Install them with: xcode-select --install"
    fi

    xcode-select --install >/dev/null 2>&1 || true
    step "Waiting for Xcode Command Line Tools installation to complete..."
    wait_for_xcode_clt || die "Xcode Command Line Tools installation did not complete in time. Re-run the script after installation finishes."
    ok "Xcode Command Line Tools are ready."
}

ensure_homebrew() {
    if command -v brew &>/dev/null; then
        return
    fi

    if ! confirm_yes_no "Homebrew is not installed. Install Homebrew automatically?" "Y"; then
        die "Homebrew is required to install missing dependencies automatically. Install it from https://brew.sh and re-run the script."
    fi

    step "Installing Homebrew..."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    refresh_path
    command -v brew &>/dev/null || die "Homebrew installation finished, but brew is still not in PATH."
    ok "Homebrew is ready."
}

ensure_python3() {
    if command -v python3 &>/dev/null; then
        return
    fi

    ensure_homebrew
    if ! confirm_yes_no "Python 3 is missing. Install it with Homebrew now?" "Y"; then
        die "Python 3 is required by this installer."
    fi

    step "Installing Python 3..."
    brew install python
    refresh_path
    command -v python3 &>/dev/null || die "python3 not found after Homebrew installation."
    ok "Python 3 is ready."
}

ensure_node_or_npm() {
    if command -v npm &>/dev/null || command -v claude &>/dev/null; then
        return
    fi

    ensure_homebrew
    if ! confirm_yes_no "Node.js/npm is missing. Install Node.js with Homebrew now?" "Y"; then
        die "Node.js/npm is required to install Claude Code."
    fi

    step "Installing Node.js..."
    brew install node
    refresh_path
    command -v npm &>/dev/null || die "npm not found after Node.js installation."
    ok "Node.js and npm are ready."
}

preflight_checks() {
    step "Running preflight checks..."
    refresh_path

    require_cmd "curl" "curl is required. Install Xcode Command Line Tools first: xcode-select --install"
    ensure_xcode_clt
    ensure_python3
    require_cmd "hdiutil" "This macOS tool is required to mount the CC Switch DMG."
    require_cmd "open" "This macOS tool is required to launch CC Switch after installation."
    require_cmd "defaults" "This macOS tool is required to read app version metadata."
    require_cmd "mktemp" "This system utility is required to create temporary installer files."
    require_cmd "sed" "This system utility is required by the installer."
    require_cmd "awk" "This system utility is required by the installer."
    require_cmd "find" "This system utility is required by the installer."
    ensure_node_or_npm

    if ! check_url_head "https://github.com"; then
        die "Cannot reach https://github.com. Check your network, proxy, or firewall settings first."
    fi

    if command -v npm &>/dev/null; then
        if ! check_url_head "https://registry.npmjs.org"; then
            warn "Cannot reach https://registry.npmjs.org right now. npm-based Claude Code installation may fail."
        fi
    fi

    if ! check_url_head "$API_PROXY"; then
        warn "Cannot reach the configured API proxy right now: $API_PROXY"
        warn "Claude Code may install successfully, but requests through the proxy will fail until this endpoint is reachable."
    fi

    ok "Preflight checks passed."
}

# ── Install Claude Code ───────────────────────────────────────────────────────
get_latest_claude_version() {
    curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        -H "User-Agent: bash-installer" \
        "https://api.github.com/repos/anthropics/claude-code/releases/latest" \
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

    if command -v npm &>/dev/null; then
        npm install -g @anthropic-ai/claude-code && refresh_path
    elif command -v brew &>/dev/null; then
        warn "npm not found. Trying Homebrew..."
        brew install claude-code && refresh_path
    else
        die "Neither npm nor Homebrew found. Install Node.js (https://nodejs.org) or Homebrew (https://brew.sh) first."
    fi

    command -v claude &>/dev/null || die "claude command not found after installation."

    local version
    version="$(claude --version 2>/dev/null || true)"
    if [[ -n "$version" ]]; then
        ok "Claude Code is ready: $version"
    else
        ok "Claude Code installed."
    fi
}

# ── Write Claude settings.json ────────────────────────────────────────────────
write_claude_settings() {
    step "Writing Claude Code settings..."

    local claude_dir="$HOME/.claude"
    local settings_path="$claude_dir/settings.json"
    mkdir -p "$claude_dir"

    # Read existing JSON or start fresh
    local existing="{}"
    if [[ -f "$settings_path" ]]; then
        existing="$(cat "$settings_path")"
        # Backup
        cp "$settings_path" "${settings_path}.bak-$(date +%Y%m%d-%H%M%S)"
    fi

    # Use python3 to merge JSON; pass values via env vars to avoid quoting issues
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
env["ANTHROPIC_BASE_URL"]   = os.environ["_PROXY"]
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

# ── Write CC Switch bootstrap config ──────────────────────────────────────────
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

    # Derive website URL (scheme + host)
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

proxy        = os.environ["_PROXY"]
token        = os.environ["_TOKEN"]
model        = os.environ.get("_MODEL", "")
provider_id  = os.environ["_PROVIDER_ID"]
provider_name= os.environ["_PROVIDER_NAME"]
website_url  = os.environ["_WEBSITE"]
created_at   = int(os.environ["_CREATED_AT"])
config_path  = os.environ["_PATH"]

provider_env = {
    "ANTHROPIC_BASE_URL":   proxy,
    "ANTHROPIC_AUTH_TOKEN": token,
}
if model:
    provider_env["ANTHROPIC_MODEL"] = model

provider = {
    "id":             provider_id,
    "name":           provider_name,
    "settingsConfig": {"env": provider_env},
    "websiteUrl":     website_url,
    "category":       "custom",
    "createdAt":      created_at,
    "sortIndex":      0,
}

def empty_mgr():
    return {"providers": {}, "current": ""}

claude_mgr = empty_mgr()
claude_mgr["providers"][provider_id] = provider
claude_mgr["current"] = provider_id

config = {
    "version":  2,
    "claude":   claude_mgr,
    "codex":    empty_mgr(),
    "gemini":   empty_mgr(),
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

# ── Install CC Switch ─────────────────────────────────────────────────────────
get_ccswitch_app_path() {
    for p in "/Applications/CC Switch.app" "$HOME/Applications/CC Switch.app"; do
        [[ -d "$p" ]] && echo "$p" && return
    done
    echo ""
}

get_latest_github_tag_via_redirect() {
    local repo="$1"
    local location=""

    location="$(curl -fsSLI \
        -H "User-Agent: bash-installer" \
        "https://github.com/$repo/releases/latest" 2>/dev/null | \
        awk 'BEGIN{IGNORECASE=1} /^location:/ {sub(/\r$/, "", $2); print $2}' | tail -1)"

    if [[ "$location" == *"/tag/"* ]]; then
        printf '%s\n' "${location##*/tag/}" | sed 's/^v//'
        return
    fi

    echo ""
}

ensure_ccswitch() {
    step "Fetching latest CC Switch macOS installer..."

    local release_json
    release_json="$(curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        -H "User-Agent: bash-installer" \
        "https://api.github.com/repos/farion1231/cc-switch/releases/latest" 2>/dev/null || true)"

    local latest_version
    if [[ -n "$release_json" ]]; then
        latest_version="$(printf '%s' "$release_json" | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'].lstrip('v'))" 2>/dev/null || true)"
    else
        latest_version=""
    fi
    if [[ -z "$latest_version" ]]; then
        warn "GitHub API request for CC Switch release metadata failed or was rate-limited. Falling back to GitHub redirect lookup."
        latest_version="$(get_latest_github_tag_via_redirect "farion1231/cc-switch")"
    fi
    [[ -n "$latest_version" ]] || die "Failed to determine latest CC Switch version from GitHub."

    # Check if already installed at the latest version
    local installed_app
    installed_app="$(get_ccswitch_app_path)"
    if [[ -n "$installed_app" ]]; then
        local installed_version=""
        local plist="$installed_app/Contents/Info.plist"
        if [[ -f "$plist" ]]; then
            installed_version="$(defaults read "$plist" CFBundleShortVersionString 2>/dev/null || true)"
        fi
        if [[ -n "$installed_version" && "$installed_version" == "$latest_version" ]]; then
            ok "CC Switch is already up to date: $installed_version"
            CCSWITCH_EXE_PATH="$installed_app"
            return
        fi
        if [[ -n "$installed_version" ]]; then
            step "Updating CC Switch ($installed_version -> $latest_version)..."
        else
            step "Installing CC Switch ($latest_version)..."
        fi
    else
        step "Installing CC Switch ($latest_version)..."
    fi
    local arch_pattern
    if [[ "$ARCH" == "arm64" ]]; then
        arch_pattern="aarch64"
    else
        arch_pattern="x64\|x86_64"
    fi

    local dmg_url
    if [[ -n "$release_json" ]]; then
        dmg_url="$(
        _RELEASE_JSON="$release_json" _ARCH_PATTERN="$arch_pattern" python3 - <<'PYEOF'
import json, os, re, sys

data = json.loads(os.environ["_RELEASE_JSON"])
assets = data.get("assets", [])
arch_pat = os.environ["_ARCH_PATTERN"]

# Try arch-specific first
for asset in assets:
    name = asset["name"]
    if re.search(r"(?i)(macos|mac|darwin)", name) and re.search(arch_pat, name) and name.endswith(".dmg"):
        print(asset["browser_download_url"])
        sys.exit(0)

# Fallback: any macOS DMG
for asset in assets:
    name = asset["name"]
    if re.search(r"(?i)(macos|mac|darwin)", name) and name.endswith(".dmg"):
        print(asset["browser_download_url"])
        sys.exit(0)

print("")
PYEOF
        )"
    else
        dmg_url=""
    fi

    if [[ -z "$dmg_url" ]]; then
        dmg_url="https://github.com/farion1231/cc-switch/releases/download/v${latest_version}/CC-Switch-v${latest_version}-macOS.dmg"
    fi

    [[ -z "$dmg_url" ]] && die "No macOS DMG found in the latest CC Switch release."

    step "Installing CC Switch ($latest_version)..."

    local tmp_dmg
    tmp_dmg="$(mktemp -t cc-switch).dmg"

    # Download
    curl -fsSL -o "$tmp_dmg" "$dmg_url"

    # Mount
    local mount_output
    if ! mount_output="$(hdiutil attach "$tmp_dmg" -nobrowse 2>&1)"; then
        rm -f "$tmp_dmg"
        die "Failed to mount DMG: $mount_output"
    fi
    local mount_point
    mount_point="$(printf '%s\n' "$mount_output" | sed -n 's#.*\(/Volumes/.*\)$#\1#p' | tail -1)"

    if [[ -z "$mount_point" || ! -d "$mount_point" ]]; then
        rm -f "$tmp_dmg"
        die "Mounted DMG but could not determine mount point. hdiutil output: $mount_output"
    fi

    # Copy .app
    local app_src
    app_src="$(find "$mount_point" -maxdepth 1 -name "*.app" | head -1)"
    if [[ -z "$app_src" ]]; then
        hdiutil detach "$mount_point" -quiet 2>/dev/null || true
        rm -f "$tmp_dmg"
        die "No .app bundle found in DMG."
    fi

    local app_name
    app_name="$(basename "$app_src")"
    local dest="/Applications/$app_name"

    [[ -d "$dest" ]] && rm -rf "$dest"
    cp -R "$app_src" "/Applications/"

    hdiutil detach "$mount_point" -quiet 2>/dev/null || true
    rm -f "$tmp_dmg"

    ok "CC Switch installed to $dest"
    CCSWITCH_EXE_PATH="$dest"
}

# ── Launch CC Switch for first-run import ─────────────────────────────────────
launch_ccswitch() {
    local exe_path="$1"
    if [[ -z "$exe_path" ]]; then
        warn "Cannot auto-launch CC Switch. On first manual launch it will import the generated config."
        return
    fi

    step "Launching CC Switch for first-run import..."
    open "$exe_path"

    local db_path="$HOME/.cc-switch/cc-switch.db"
    local deadline=$(( $(date +%s) + 30 ))
    while [[ $(date +%s) -lt $deadline ]]; do
        [[ -f "$db_path" ]] && { ok "CC Switch first-run initialization complete."; return; }
        sleep 1
    done
    warn "CC Switch launched, but database file not detected within 30 seconds. Config will be imported on first manual open."
}

# ═════════════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════════════
step "Starting Claude Code + CC Switch installation on macOS ($ARCH)..."

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
echo ""
echo "Next steps:"
echo "  1. Run 'claude' to start using Claude Code."
echo "  2. If CC Switch was not auto-launched, open it once manually to complete the import."
[[ -n "$MODEL" ]] && echo "  3. Model configured: $MODEL"
