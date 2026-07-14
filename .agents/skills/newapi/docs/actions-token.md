## Action: `tokens`

List API tokens.

```bash
$RUNTIME "$API_SCRIPT" GET "/api/token/?p=0&page_size=20"
```

Display as a table with columns: ID, Name, Key, Status (1=enabled, 2=disabled, 3=expired), Group, Created Time, Expired Time, Remain Quota.

**Key display note:** The API returns the `key` field without the `sk-` prefix. When displaying, prepend `sk-` to the key value (e.g., API returns `reHR**********OspA` → display as `sk-reHR**********OspA`).

---

## Action: `create-token`

Usage: `/newapi create-token <name> [--group=<group>] [--quota=<amount>]`

Parse the arguments:

- `<name>` — required, the token name
- `--group=<group>` — optional, assign to a specific group
- `--quota=<amount>` — optional, quota limit (in dollar amount, multiply by 500000 for API)

```bash
$RUNTIME "$API_SCRIPT" POST /api/token/ \
  '{"name":"<name>","group":"<group>","remain_quota":<quota_raw>,"unlimited_quota":<true if no quota>}'
```

Confirm that the token was created successfully. For safety, this skill does not display the real token key in model-visible output.

After success, tell the user the token was created (show name/ID only) and that they can use `copy-token <id>` (clipboard), `apply-token <id> <file>` (config file), or `exec-token <id> <command>` (CLI) to securely use the key. Do NOT call any API to fetch the key — the create response intentionally omits it.

---

## Action: `switch-group`

Usage: `/newapi switch-group <token_id> <group>`

First, fetch the token details:

```bash
$RUNTIME "$API_SCRIPT" GET /api/token/<token_id>
```

Then update with the new group:

```bash
$RUNTIME "$API_SCRIPT" PUT /api/token/ \
  '{"id":<token_id>,"name":"<name>","group":"<new_group>",...<other existing fields>}'
```

Confirm the group change was successful.

---

## Action: `copy-token`

Usage: `/newapi copy-token <token_id>`

This action retrieves the real key for a token and copies it directly to the system clipboard using a **dedicated, self-contained script**. The key never appears in stdout, stderr, logs, or any AI-readable output.

```bash
COPY_SCRIPT="${CLAUDE_SKILL_DIR}/scripts/copy-key.js"
$RUNTIME "$COPY_SCRIPT" <token_id>
```

The script handles everything internally: API call, `sk-` prefix, clipboard write. It outputs **only** a fixed success or error message.

- On success: `Token <token_id> 的密钥已复制到剪贴板。`
- On failure: a generic error description (never the key).

**Mandatory constraints (see Security Constraints in SKILL.md):**

- Do **NOT** capture, parse, or inspect the script's internal operations.
- Do **NOT** read clipboard contents afterward.
- Do **NOT** wrap this script in any pipeline that could expose the key.
- The only permitted invocation is the one-liner shown above.
