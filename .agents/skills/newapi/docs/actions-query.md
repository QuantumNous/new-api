## Action: `models`

List available models.

```bash
$RUNTIME "$API_SCRIPT" GET /api/user/models
```

Display the response as a formatted table with columns: Model ID, Owner (if present).

---

## Action: `groups`

List user groups.

```bash
$RUNTIME "$API_SCRIPT" GET /api/user/self/groups
```

Display the groups as a list.

---

## Action: `balance`

Show account balance.

```bash
$RUNTIME "$API_SCRIPT" GET /api/user/self
```

From the response, extract and display:
- Username
- Display name
- Email
- Quota (remaining balance) — divide the raw quota value by 500000 to get the dollar amount
- Used quota — divide by 500000
- Group
- Request count
