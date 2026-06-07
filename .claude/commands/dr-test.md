Run the standard DeepRouter policy e2e verification (DR-9 test suite).

The local dev stack runs at http://localhost:3000.

## What you need first

Ask the user for two API tokens if not already provided:
- ROOT_KEY: a token belonging to a user with `kids_mode=false`, `policy_profile=passthrough`
- KIDS_KEY: a token belonging to a user with `kids_mode=true`, `policy_profile=kid-safe`

The Groq channel must have `model_mapping`: `gpt-4o-mini` → `llama-3.1-8b-instant`.

## Run 3 test cases

For each test, run the curl command and record the HTTP status + first few words of the response content.

**TEST 1 — root key, non-whitelisted model (should PASS)**
```
curl -s -w "\nHTTP %{http_code}" http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Say hello in 5 words"}],"max_tokens":20}'
```
Expected: HTTP 200, content with words.

**TEST 2 — kids key, non-whitelisted model (should BLOCK)**
```
curl -s -w "\nHTTP %{http_code}" http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $KIDS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Say hello in 5 words"}],"max_tokens":20}'
```
Expected: HTTP 400, error mentioning `model_not_eligible_for_kids_mode`.

**TEST 3 — kids key, whitelisted model that maps to non-whitelisted upstream (should PASS)**
```
curl -s -w "\nHTTP %{http_code}" http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer $KIDS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Say hello in 5 words"}],"max_tokens":20}'
```
Expected: HTTP 200, content with words (channel remaps gpt-4o-mini → llama-3.1-8b-instant internally, but whitelist check sees the original name).

## Report

After running all 3 tests, report a table:

| Test | Key | Model sent | Expected | Result | Pass? |
|------|-----|------------|----------|--------|-------|
| 1 | root | llama-3.1-8b-instant | 200 | ... | ✅/❌ |
| 2 | kids | llama-3.1-8b-instant | 400 | ... | ✅/❌ |
| 3 | kids | gpt-4o-mini | 200 | ... | ✅/❌ |

If any test fails, diagnose why (check container logs: `docker logs new-api-dev --tail 30`).
