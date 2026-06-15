Help create a clean PR for the current branch. Follow this checklist before opening the PR.

## Pre-PR checklist

1. **Run tests** — confirm all Go tests pass:
   ```
   docker run --rm -v "$(pwd):/app" -w /app golang:1.25-alpine sh -c 'go test ./relay/ ./internal/... 2>&1 | grep -E "^(ok|FAIL)"'
   ```
   All lines must say `ok`. If any say `FAIL`, stop and fix before proceeding.

2. **Check diff** — run `git diff main...HEAD` and summarise what changed. Flag any:
   - Accidental debug prints or TODOs left in
   - Files that shouldn't be in this PR (seed scripts, .env, temp files)
   - Missing test for the change

3. **Check ordering bug** — if the PR touches `relay/*_handler.go`, verify that for each handler that calls `applyAirbotixPolicy*`, the call comes **BEFORE** `helper.ModelMappedHelper`. This ordering is critical for kids_mode whitelist correctness.

4. **Push branch** if not already pushed:
   ```
   git push -u origin <branch-name>
   ```

5. **Create the PR via GitHub MCP** — use the create_pull_request tool with:
   - title: `type(scope): short description` (e.g. `fix(relay): apply policy before model mapping`)
   - base: `main`
   - body sections: Problem, Fix, Verification table (test cases + results)
   - draft: false

## Reminders
- One concern per PR. Don't bundle unrelated fixes.
- Co-author line in description: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- After PR is created, share the URL with the user.
