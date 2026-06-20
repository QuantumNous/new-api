# Dev Setup

Get the local dev stack running in under 10 minutes.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Git
- `gh` CLI (optional, for PR creation)

## 1. Clone

```bash
git clone https://github.com/deeprouter-ai/deeprouter.git
cd deeprouter
```

## 2. Start the dev stack

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

This builds Go from source. First build takes ~3 min (downloads Go modules). Subsequent rebuilds take ~40 sec.

Backend: http://localhost:3000  
Admin UI (backend-served): http://localhost:3000

## 3. First-time setup

The DB is empty on fresh volume. Initialize root account:

```bash
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"root","password":"12345678","confirmPassword":"12345678"}'
```

Then log in at http://localhost:3000 with `root` / `12345678`.

## 4. Seed test data (Groq channel + kids tenant)

You need a [Groq API key](https://console.groq.com) (free tier works).

Run the seed script from inside an Alpine container (requires `jq`):

```bash
docker run --rm -it \
  --network host \
  -v "$(pwd)/bin:/scripts" \
  alpine sh -c "apk add -q curl jq && sh /scripts/seed-dev.sh"
```

The seed script creates:
- Groq channel with `gpt-4o-mini` → `llama-3.1-8b-instant` model mapping
- Two API tokens: `root-key` (passthrough) and `kids-key` (kids_mode=true)

## 5. Verify e2e policy

Run `/dr-test` in Claude Code, or manually:

```bash
# Should pass (200)
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <ROOT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'

# Should be blocked (400)
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <KIDS_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'

# Should pass — whitelist match on gpt-4o-mini (200)
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer <KIDS_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'
```

## 6. Rebuild after a Go change

```bash
docker compose -f docker-compose.dev.yml up -d --build new-api
```

## 7. View logs

```bash
docker logs new-api-dev --tail 50 -f
```

## 8. Reset everything

```bash
docker compose -f docker-compose.dev.yml down -v
```
Wipes Postgres and Redis volumes. Next start is a fresh DB.

## Claude Code skills

If you're using Claude Code (the AI CLI), these slash commands are available:

| Command | What it does |
|---------|-------------|
| `/dr-status` | Current sprint/PR/git status report |
| `/dr-test` | Runs the 3-case policy e2e test |
| `/dr-pr` | PR creation checklist |
