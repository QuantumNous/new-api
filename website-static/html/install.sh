#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BASE_URL="https://router.flatkey.ai"
KEY_URL="https://console.flatkey.ai/keys"
FLATKEY_CONFIG_DIR="$HOME/.config/flatkey"
FLATKEY_ENV_FILE="$FLATKEY_CONFIG_DIR/env"

echo ""
echo "==========================================="
echo "  Flatkey — coding agent setup"
echo "==========================================="
echo ""
echo "Which coding agent do you want to install?"
echo "  1) Claude Code"
echo "  2) Codex CLI"
echo ""
AGENT="${FLATKEY_AGENT:-}"
case "$AGENT" in
  ""|claude|codex) ;;
  *)
    echo -e "${RED}FLATKEY_AGENT must be 'claude' or 'codex'.${NC}"
    exit 1
    ;;
esac
while [ -z "$AGENT" ]; do
  read -r -p "Enter 1 or 2 (default: 1): " CHOICE < /dev/tty
  CHOICE="${CHOICE:-1}"
  case "$CHOICE" in
    1) AGENT="claude" ;;
    2) AGENT="codex" ;;
    *) echo -e "${YELLOW}Please enter 1 or 2.${NC}" ;;
  esac
done
echo ""

echo -n "Checking Node.js... "
if command -v node >/dev/null 2>&1; then
  echo -e "${GREEN}ok${NC} $(node --version)"
else
  echo -e "${YELLOW}not found${NC}"
  echo "Install Node.js LTS from https://nodejs.org/ and re-run this script."
  exit 1
fi

if [ "$AGENT" = "claude" ]; then
  echo -n "Checking Claude Code... "
  if command -v claude >/dev/null 2>&1; then
    echo -e "${GREEN}ok${NC}"
  else
    echo -e "${YELLOW}installing${NC}"
    npm install -g @anthropic-ai/claude-code
  fi
else
  echo -n "Checking Codex CLI... "
  if command -v codex >/dev/null 2>&1; then
    echo -e "${GREEN}ok${NC}"
  else
    echo -e "${YELLOW}installing${NC}"
    npm install -g @openai/codex
  fi
fi

RC_FILE=""
if [ -n "${ZSH_VERSION:-}" ] || [ -f "$HOME/.zshrc" ]; then
  RC_FILE="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  RC_FILE="$HOME/.bashrc"
else
  RC_FILE="$HOME/.profile"
fi

echo "Create or copy your Flatkey API key:"
echo "  $KEY_URL"
echo ""
API_KEY="${FLATKEY_API_KEY:-}"
if [ -z "$API_KEY" ]; then
  read -r -s -p "Paste Flatkey API key (input hidden): " API_KEY < /dev/tty
  echo ""
fi
if [ -z "$API_KEY" ]; then
  echo -e "${RED}API key required.${NC}"
  exit 1
fi

echo -n "Verifying Flatkey API key... "
if curl -fsS "$BASE_URL/v1/models" \
  -H "Authorization: Bearer $API_KEY" >/dev/null; then
  echo -e "${GREEN}ok${NC}"
else
  echo -e "${RED}failed${NC}"
  echo "The key could not access $BASE_URL/v1/models. No configuration was changed."
  exit 1
fi

if [ -f "$RC_FILE" ]; then
  sed -i.bak '/# Flatkey — Claude Code proxy/,/# End Flatkey — Claude Code proxy/d' "$RC_FILE" 2>/dev/null || true
  sed -i.bak '/# Flatkey — Codex CLI proxy/,/# End Flatkey — Codex CLI proxy/d' "$RC_FILE" 2>/dev/null || true
  sed -i.bak '/# Flatkey environment/,/# End Flatkey environment/d' "$RC_FILE" 2>/dev/null || true
  rm -f "${RC_FILE}.bak"
fi

mkdir -p "$FLATKEY_CONFIG_DIR"
chmod 700 "$FLATKEY_CONFIG_DIR"
umask 077

if [ "$AGENT" = "claude" ]; then
  {
    printf 'export FLATKEY_API_KEY=%q\n' "$API_KEY"
    printf 'export ANTHROPIC_BASE_URL=%q\n' "$BASE_URL"
    echo 'export ANTHROPIC_AUTH_TOKEN="$FLATKEY_API_KEY"'
    echo 'export ANTHROPIC_API_KEY=""'
  } > "$FLATKEY_ENV_FILE"
else
  {
    printf 'export FLATKEY_API_KEY=%q\n' "$API_KEY"
  } > "$FLATKEY_ENV_FILE"
fi
chmod 600 "$FLATKEY_ENV_FILE"
unset API_KEY

{
  echo ""
  echo "# Flatkey environment"
  echo 'if [ -f "$HOME/.config/flatkey/env" ]; then . "$HOME/.config/flatkey/env"; fi'
  echo "# End Flatkey environment"
} >> "$RC_FILE"

if [ "$AGENT" = "codex" ]; then
  mkdir -p "$HOME/.codex"
  cat > "$HOME/.codex/flatkey.config.toml" <<EOF
model_provider = "flatkey"
model = "gpt-5.5"

[model_providers.flatkey]
name = "Flatkey"
base_url = "https://router.flatkey.ai/v1"
env_key = "FLATKEY_API_KEY"
wire_api = "responses"
EOF
fi

echo ""
echo -e "${GREEN}Done.${NC} Restart your terminal or run: source $RC_FILE"
if [ "$AGENT" = "claude" ]; then
  echo "Start Claude Code with: claude"
else
  echo "Start Codex CLI with: codex -p flatkey"
fi
