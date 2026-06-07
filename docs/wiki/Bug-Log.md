# Bug Log

Notable bugs found, root-caused, and fixed. Useful for onboarding and preventing regressions.

---

## BUG-001 — Policy whitelist checks upstream model name instead of client-requested name

**Date found:** 2026-06-07  
**Severity:** High — blocks legitimate kids key requests  
**Ticket:** DR-9  
**PR:** fix/policy-before-model-mapping

### Symptom
A kids key sending `gpt-4o-mini` (on the `EligibleModels` whitelist) received a 400 error:
```
model_not_eligible_for_kids_mode: llama-3.1-8b-instant
```

### Root cause
In `relay/compatible_handler.go`, `helper.ModelMappedHelper` ran **before** `applyAirbotixPolicy`. `ModelMappedHelper` rewrites `request.Model` to the channel's upstream model name (the Groq channel mapped `gpt-4o-mini` → `llama-3.1-8b-instant`). The whitelist check then saw `llama-3.1-8b-instant`, which is not on the whitelist, and rejected the request.

### Fix
Moved the policy check block above `ModelMappedHelper` so the whitelist always evaluates the client-requested model name.

```go
// CORRECT order in compatible_handler.go:
if d, ok := common.GetContextKey(c, constant.ContextKeyPolicyDecision); ok {
    // ... whitelist check uses request.Model = "gpt-4o-mini" ✅
}
err = helper.ModelMappedHelper(c, info, request)
// request.Model is now "llama-3.1-8b-instant" — but we already approved it
```

### Still open
Same bug exists in `claude_handler.go` (line 39→45), `responses_handler.go` (line 63→69), `gemini_handler.go` (line 69→77). Fix pending.

### How to test
Run `/dr-test` — Test 3 (kids key + gpt-4o-mini) validates this fix.

---

## BUG-002 — Docker build context ~1.5 GB due to missing .dockerignore entries

**Date found:** 2026-06-06  
**Severity:** Low (dev experience only)  
**Status:** Fixed — unstaged, PR pending

### Symptom
`docker compose -f docker-compose.dev.yml up --build` took 8+ minutes, transferring over 1.5 GB of context to Docker daemon.

### Root cause
`.dockerignore` was missing:
```
web/default/node_modules
web/classic/node_modules
```
Both frontend directories' `node_modules` were being sent in full.

### Fix
Added both entries to `.dockerignore`. Build context now ~40 MB.

---

## BUG-003 — Token routing fails if token `group` field is empty

**Date found:** 2026-06-06  
**Severity:** Medium — requests 404 at channel selection  
**Status:** Fixed via DB update

### Symptom
Relay returned channel-not-found error even though the channel existed and the model was in the `abilities` table.

### Root cause
`tokens.group` was empty string `""`. The channel routing query matches `abilities.group = tokens.group`, so an empty token group finds no abilities.

### Fix
```sql
UPDATE tokens SET "group" = 'default' WHERE user_id = 2;
```
Ensure all tokens are assigned a group that matches an entry in the `abilities` table.
