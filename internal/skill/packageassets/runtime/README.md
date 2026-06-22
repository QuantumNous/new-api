# DeepRouter Skill Runtime

Run from the extracted package root:

```bash
python runtime/deeprouter_skill_runner.py --input "..."
```

Or:

```bash
python3 runtime/deeprouter_skill_runner.py --input "..."
```

Required environment variables:

- `DEEPROUTER_API_KEY`
- `DEEPROUTER_EXECUTION_API_URL`
- optional: `DEEPROUTER_EXECUTION_TIMEOUT_SECONDS` (default `60`)

Behavior:

- missing `DEEPROUTER_API_KEY` -> `AUTH_REQUIRED`
- missing `DEEPROUTER_EXECUTION_API_URL` -> `CONFIG_REQUIRED`
- invalid `DEEPROUTER_EXECUTION_API_URL` or timeout env -> `CONFIG_INVALID`
- the runner reads `manifest.json` and `instruction_template.md` from the package root
- the runner sends only `messages` plus `deeprouter.skill_id` / `deeprouter.skill_version_id`
