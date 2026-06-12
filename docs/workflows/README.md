# Workflows

Hands-on, task-oriented walkthroughs. Each answers a "how do I do X?" question that comes up regularly. Pair these with the architectural docs:

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — module tour
- [`../../relay/channel/README.md`](../../relay/channel/README.md) — provider adapter spec
- [`../adr/`](../adr/) — why we made the decisions
- [`../data-model.md`](../data-model.md) — tables & Redis keys
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — AWS deployment

## Index

| Workflow | When to read |
|---|---|
| [add-provider.md](./add-provider.md) | Adding a new upstream LLM provider (e.g. a new China model vendor, a niche aggregator) |
| [add-user-field.md](./add-user-field.md) | Adding a per-tenant configuration column to `users` (similar to `kids_mode`, `billing_webhook_url`) |
| [debug-relay-issues.md](./debug-relay-issues.md) | Triaging 4xx / 5xx / hanging requests on the `/v1/*` endpoints |
| [dr-10-chat-completions-smoke.md](./dr-10-chat-completions-smoke.md) | Validating DR-10 `/v1/chat/completions` stream and non-stream paths for OpenAI + Anthropic |

All workflows assume you've completed [`../../DEV.md`](../../DEV.md) §1–3 (local docker compose up + first admin + first curl).
