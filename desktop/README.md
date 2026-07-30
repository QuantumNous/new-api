# BoxAI Desktop

**[you-box.com](https://you-box.com)** · [Releases](https://github.com/dev-fan-sophon/boxai/releases) · [Issues](https://github.com/dev-fan-sophon/boxai/issues)

> **Beta** — BoxAI Desktop is in beta. Automatic updates are disabled until BoxAI provisions its own Tauri updater signing key; install updates from this repository's Releases page.

**AI that gets your everyday tasks done.** BoxAI Desktop is an AI coworker that lives on your desktop and delivers **finished work**, not just chat: a polished document, a Slack reply with the numbers, an updated calendar, a triaged inbox.

The agent runtime and tools run on your machine. Model access is provided by your BoxAI account, while local files and connector credentials remain in the desktop app's local secret store.

[![How BoxAI Desktop works](docs/assets/how-it-works.png)](https://you-box.com)

## Download

[**Download BoxAI Desktop releases**](https://github.com/dev-fan-sophon/boxai/releases)

Release assets use stable `BoxAI-Desktop-*` names. macOS requires version 12 or newer; unsigned Windows builds may trigger SmartScreen.

Open the app, sign in with your BoxAI account in the system browser, and ask for something real.

## How it works

1. Tell BoxAI Desktop the outcome you want - "prepare a customer brief," "untangle my calendar," "draft a report," "check where the release stands across Jira and GitHub."
2. It breaks the task into steps and works across your desktop, files, and connected apps.
3. Before anything consequential - sending a message, changing a calendar, running a command - it checks in and you approve or redirect.
4. You get the finished deliverable, not a to-do list.

Under the hood:

```text
┌────────────────────────────────────────────────┐
│              BoxAI Desktop app                 │  native shell + GUI
├────────────────────────────────────────────────┤
│           local agent server (Python)          │  engine · tools · connectors - built on aisuite
├───────────────┬────────────────┬───────────────┤
│  your files   │   your tools   │ BoxAI models  │  local tools run on your machine;
│  & terminal   │ 25+ connectors │  your account │  model calls use your BoxAI account
└───────────────┴────────────────┴───────────────┘
```

## What it can do

- **Produce real deliverables** - documents, spreadsheets, reports, and web pages land as files you can open and share.
- **Work from Slack** - mention `@OpenWorker` in a channel; a session opens on your desktop, the work happens with your tools, and the answer comes back as a thread reply.
- **Use your everyday tools** - 25+ integrations including GitHub, Slack, Jira, Notion, Linear, HubSpot, Outlook, monday.com, Gmail, and Google Calendar, plus your **terminal and local files**. Any tool reachable over [MCP](https://modelcontextprotocol.io/) plugs in too, with per-tool control.
- **Teach it repeatable work with Skills** - SKILL.md instruction packs the coworker loads on demand, reachable from the **Skills** row in the sidebar. Office packs (Word, Excel, PowerPoint, PDF, meeting notes, weekly reports) ship built in, a short recommended list installs with one click, and anything else comes from a folder, a GitHub repo, or the in-app marketplace.
- **Run on a schedule** - automations for recurring work: a morning brief, a weekly report, a standing watch over a channel. Runs land in the app with full transcripts.
- **Ask before acting** - writes, sends, and shell commands are approval-gated. Unattended runs park their asks in an inbox instead of acting on their own.

## BoxAI model access

BoxAI Desktop uses the models available to your signed-in BoxAI account. The app fetches the current account model list from BoxAI and sends all model requests through the BoxAI API gateway.

Direct third-party provider keys, custom model endpoints, and Ollama are disabled in the BoxAI distribution. This prevents a local setting or environment variable from bypassing account authentication, billing, and revocation.

## Privacy

BoxAI Desktop is local-first: the agent loop, conversations, local tool execution, connector tokens, and workspace state stay on your machine. Prompts and model inputs are sent to BoxAI when you invoke a model. A separate BoxAI connector broker handles managed OAuth handshakes; connector access tokens are delivered to and stored by the local app rather than retained by the broker.

## Run from source

Prerequisites: Python 3.10+, Node 20+, and (for the desktop shell) the Rust toolchain via [rustup](https://rustup.rs/).

The desktop project lives under `desktop/` in this monorepo. The commands below are run from the monorepo root; enter the desktop directory first:

```shell
cd desktop

# 1. One-time bootstrap - creates the Python venv at .venv
#    (on Windows, run from Git Bash or WSL)
bash packaging/setup_dev_env.sh

# 2. Start the local agent server
.venv/bin/openworker-server --cwd ~/some/project --port 8765
#    (Windows: .venv\Scripts\openworker-server.exe)

# 3. In a second terminal, start the UI
cd surfaces/gui
npm install
npm run dev        # browser UI on the Vite dev port
```

The standalone server creates a per-launch token at
`<state-dir>/sidecar-8765.token`; Vite reads that user-only file when it starts.
For direct API calls, send its value in the `X-OpenWorker-Token` header. The
desktop app uses an in-memory launch token instead and never writes it to disk.

To run the full desktop app instead of the browser UI, replace step 3 with `npm run tauri dev` (from `surfaces/gui/`) - the Tauri shell launches the window and supervises the server itself.

The UI ships in English, 中文, and Tiếng Việt: it follows the system language and can be changed under Settings > General > Language. Locale files are `surfaces/gui/src/i18n/locales/{zh,vi}.json` (flat JSON, English source strings as keys); `npm run i18n:check` verifies they match the strings used in the code.

Tests: `.venv/bin/pytest` (server), `npm test` and `npm run e2e` in `surfaces/gui` (GUI unit + hermetic end-to-end). Desktop bundles are built with `packaging/build_dmg.sh` / `packaging/build_windows.ps1`.

Desktop releases use `desktop-v<version>` tags (for example, `desktop-v0.2.0`); the tag version must match `surfaces/gui/src-tauri/tauri.conf.json`.

## Repository layout

| Directory | What's in it |
|---|---|
| `coworker/` | Python backend - agent engine, model providers, connectors, MCP client, skills, memory, automations |
| `surfaces/gui/` | Desktop app - React UI + Tauri shell that supervises the server |
| `stt/` | Speech-to-text sidecar (Rust) for voice input |
| `packaging/` | Installer builds (macOS DMG, Windows), auto-update manifest, dev bootstrap |
| `docs/` | Design specs and decision logs |
| `tests/` | Backend test suite |

## Upstream attribution and license

BoxAI Desktop is based on **OpenWorker**. The upstream OpenWorker MIT license, copyright notices, NOTICE, and attribution are retained. See [LICENSE](LICENSE) and the repository's notice files. Product branding and release artifacts are BoxAI-specific; internal `coworker` modules, `openworker-*` CLI/server entrypoints, and the existing state directory remain unchanged to avoid a risky user-data migration.

## Built on aisuite

The upstream OpenWorker engine is built on [**aisuite**](https://github.com/andrewyng/aisuite), a lightweight Python library providing a unified chat-completions API across LLM providers and an agents layer with tools, toolkits, and MCP support. If you want to build your own agent harness rather than use ours, start there; this repo is a working reference for what aisuite can carry.

OpenWorker was originally developed inside the aisuite repository before moving to its own home here; thanks to the aisuite contributors whose work it builds on.

## Contributing

Contributions and bug reports are welcome - open an [issue](https://github.com/dev-fan-sophon/boxai/issues) or a pull request.
For any PR, please attach screenshots of what was broken and how it is fixed now. We will shortly add features that you can contribute to.
Please note that we are actively developing based off a internal list and goal, so we may not approve PRs that add features that are already under-development or deviates from our vision.

## License

MIT - see [LICENSE](LICENSE).
