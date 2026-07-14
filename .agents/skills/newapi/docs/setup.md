# Setup

## Configuration

Configuration is loaded in the following priority order (higher overrides lower):

1. **Environment variables** (highest priority, recommended)
2. **Skill directory `.env`** (next to SKILL.md)
3. **Project root `.env`** — project-level config

Required variables — recommended to export in your shell profile:

```bash
export NEWAPI_BASE_URL=https://your-newapi-instance.com
export NEWAPI_ACCESS_TOKEN=your-newapi-access-token
export NEWAPI_USER_ID=your-newapi-user-id
```

Alternatively, create a `.env` file (make sure it's in `.gitignore`). Environment variables are preferred over `.env` files because `.env` files risk accidental commits even with `.gitignore` in place. If you do use `.env`, never commit it to version control.

## Mental Model

This skill uses several JavaScript scripts with different responsibilities:

- `scripts/api.js` handles New API management actions such as listing models, groups, balance, and token metadata.
- `scripts/inject-key.js --scan <file_path>` safely shows the structure of an existing config file with secrets redacted.
- `scripts/inject-key.js <token_id> <file_path>` replaces a placeholder with the real token key in a config file without exposing that key in the conversation, atomically replacing the target file.
- `scripts/exec-token.js <token_id> -- <command>` replaces a placeholder with the real token key in a shell command and executes it, sanitizing stdout/stderr before returning to the AI.

When working with config files that may already contain secrets, always use `--scan` first. Do not read those files directly.

## Authentication

Every API request uses Access Token auth with these headers:

```text
Authorization: Bearer <NEWAPI_ACCESS_TOKEN>
New-Api-User: <NEWAPI_USER_ID>
```

## Runtime Detection

The skill ships with plain JavaScript scripts and no external dependencies. Before first use, detect the available JS runtime once and reuse it for the session:

```bash
API_SCRIPT="${CLAUDE_SKILL_DIR}/scripts/api.js"
INJECT_SCRIPT="${CLAUDE_SKILL_DIR}/scripts/inject-key.js"
EXEC_SCRIPT="${CLAUDE_SKILL_DIR}/scripts/exec-token.js"

# Detect runtime (prefer bun > node > deno)
if command -v bun &>/dev/null; then RUNTIME="bun"; \
elif command -v node &>/dev/null; then RUNTIME="node"; \
elif command -v deno &>/dev/null; then RUNTIME="deno run --allow-net --allow-read --allow-env"; \
else echo "ERROR: No JS runtime found (need bun, node, or deno)" >&2; exit 1; fi
```

Use the same runtime for all scripts.

Management API calls:

```bash
$RUNTIME "$API_SCRIPT" <METHOD> <PATH> [JSON_BODY]
```

Safe config inspection:

```bash
$RUNTIME "$INJECT_SCRIPT" --scan <file_path>
```

Token application by placeholder replacement:

```bash
$RUNTIME "$INJECT_SCRIPT" <token_id> <file_path>
```

Secure command execution with token placeholder:

```bash
$RUNTIME "$EXEC_SCRIPT" <token_id> -- <command with __NEWAPI_TOKEN_{id}__>
```

The expected workflow for configuring another app is:

1. Scan the existing config file with `--scan`.
2. Edit the file so the target key field contains `__NEWAPI_TOKEN_{token_id}__`.
3. Run `inject-key.js <token_id> <file_path>` to replace the placeholder with the real key.
4. Trust the script's success or error message instead of reopening the file to inspect the written key.

## Error Handling

- If the API returns a non-success response, display the error message clearly
- If authentication fails (401/403), suggest checking the environment variables
- If a resource is not found (404), say so clearly
- If the script returns `[CONFIG_MISSING]`, stop retrying and tell the user to set the required environment variables or `.env` values first
