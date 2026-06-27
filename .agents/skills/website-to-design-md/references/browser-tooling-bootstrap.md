# Browser Tooling Bootstrap

Use this guide when `website-to-design-md` starts in an environment that may not yet have `agent-browser` set up.

## Goal

Before analyzing a site, make sure `agent-browser` is available.

If it is not available, the default action is to help install `agent-browser` or expose it on `PATH`.

## Preferred Detection Flow

Run the bundled checker:

```bash
node /path/to/website-to-design-md/scripts/check-browser-tooling.mjs /target/workspace
```

If you cannot run the script, reproduce the same checks manually:

```bash
node -v
npm -v
which agent-browser
agent-browser --help
```

## Default Installation Flow

When `agent-browser` is not available:

1. Install or expose `agent-browser`.
2. Verify the command is callable:

```bash
agent-browser --help
```

3. Verify the workflow you need is available:

```bash
agent-browser eval 'document.title'
```

If step 3 fails because no browser session is open yet, that is fine. The important requirement is that the command exists and can run.

## Decision Rules

- Always prefer `agent-browser`.
- Do not switch to Playwright or Chrome CLI unless the user explicitly asks for that fallback.
- Keep the extraction workflow consistent: `agent-browser open`, `agent-browser wait`, and `agent-browser eval`.

## What to Tell the User

Keep the user informed in one short line:

- that you are checking whether `agent-browser` already exists
- that you are installing or exposing `agent-browser` if it does not
- that the setup is needed to inspect the live rendered site accurately with `agent-browser eval`

## Common Failure Modes

### No `agent-browser`

Install it or expose it on `PATH`. Do not silently switch browser stacks.

### Network or registry access blocked

Retry with the correct elevated permission request. Do not stop after the first network-related failure.

### Command exists but cannot launch correctly

This is often a runtime permission or sandbox problem, not an install problem. Verify with a real command smoke check and escalate if needed.

### User declines installation

State clearly that the skill is designed to run on `agent-browser` and that you are stopping unless they explicitly approve another fallback.
