# Integration docs — image / screenshot capture list

Every image referenced by the integration guides lives in this folder. Files are referenced as
`./images/<name>.png` from the docs. This is the **shot list** — what each image must show, so
whoever captures them (or a designer) can work straight down the list.

## Conventions

- **Format:** PNG. **Width:** 1200–1600px for diagrams; native window size for screenshots.
- **Naming:** keep the exact filenames below — the docs already point at them.
- **Redaction:** blur/replace any real API key, email, or token. Show a fake `sk-...` placeholder.
- **Theme:** light mode, DeepRouter brand where it's our own UI (cream `#F7F4ED` / charcoal
  `#1C1C1C` / AI-blue `#2563FF`). Tool screenshots: that tool's default theme.
- **Highlight style:** one AI-blue rounded rectangle + a number badge per field to point to.

---

## A. Master guide — `GUIDE.md` (priority: do these first)

| File | What it must show |
|---|---|
| `01-concept-before-after.png` | Diagram. Left: "Your tool → one vendor (Anthropic/OpenAI)". Right: "Your tool → **DeepRouter** → any model". Caption: *only the base URL + key change.* Our own graphic, no screenshot needed. |
| `02-signin.png` | The deeprouter.co landing / sign-in page, with the **Sign in / Get started** button highlighted. (Public page — capturable now.) |
| `03-api-keys.png` | **Console → API Keys** page. Highlight the **Create key** button and the copy icon next to a key starting with `sk-`. ⭐ Most important shot — reused conceptually everywhere. Redact the real key. |
| `04-welcome-default-key.png` | Welcome/onboarding screen showing "Your default API key (shown once)". Optional but nice. Redact. |
| `05-base-url-table.png` | Clean reference card of the 3-row base-URL table (OpenAI `/v1`, Anthropic bare, Gemini `/v1beta`). Our own graphic. |
| `06-style-a-settings.png` | A representative chat-app settings screen (Cherry Studio **or** Chatbox) with three fields circled + numbered: **1** base URL, **2** API key, **3** model. |
| `07-style-b-terminal.png` | Terminal showing the two `export` lines for Claude Code, then `claude` running with the status bar reading `api.deeprouter.co`. |
| `08-style-c-ccswitch.png` | CC Switch **add-provider** form filled with DeepRouter values, arrow on the **Use/Enable** button. |
| `09-verify.png` | Split image — left: a tool's `/status` showing `api.deeprouter.co`; right: the curl smoke test returning a 200 JSON reply. |

---

## B. Per-tool screenshots (one or two per guide)

Each tool page can use 1–2 shots. Capture the **settings screen where the base URL + key go**,
with those fields highlighted. Suggested filenames per guide:

| Doc | File(s) | What to show |
|---|---|---|
| `claude-code.md` | `claude-code-status.png` | `/status` output with base URL = `api.deeprouter.co`. |
| `codex.md` | `codex-config.png` | `~/.codex/config.toml` with the `[model_providers.deeprouter]` block. |
| `gemini-cli.md` | `gemini-cli-env.png` | Terminal with `GOOGLE_GEMINI_BASE_URL` + `GEMINI_API_KEY` set, CLI running. |
| `opencode.md` | `opencode-json.png` | `opencode.json` with the `deeprouter` provider block. |
| `cursor.md` | `cursor-models.png` | Settings → Models → **Override OpenAI Base URL** toggle on, URL + key fields. |
| `copilot.md` | `copilot-byok.png` | VS Code **Chat: Manage Language Models** → OpenAI Compatible provider form. |
| `cline.md` | `cline-openai.png`, `cline-anthropic.png` | Cline ⚙️ settings, OpenAI-Compatible path **and** Anthropic custom-base-URL path. |
| `zed.md` | `zed-settings.png` | `settings.json` `language_models.openai_compatible` block. |
| `claude-coworks.md` | `cowork-gateway.png` | Claude Cowork Developer Mode → third-party inference / gateway form. |
| `openclaw.md` | `openclaw-config.png` | `openclaw.json` provider block. |
| `cherry-studio.md` | `cherry-provider.png` | Settings → Model Providers → OpenAI provider, API host + key. |
| `botgem.md` | `botgem-provider.png` | Settings → Service Provider → OpenAI-compatible, Base URL + key. |
| `chatbox.md` | `chatbox-provider.png` | Settings → Model Provider → OpenAI API Compatible, API Host + key. |
| `lobehub.md` | `lobe-openai.png` | Settings → AI Service Provider → OpenAI, API Proxy Address + key. |
| `opencat.md` | `opencat-provider.png` | Settings → API Providers → Add Provider, API Host + key. |
| `nextchat.md` | `nextchat-endpoint.png` | Settings → API Endpoint + key + custom model. |
| `workbuddy.md` | `workbuddy-models.png` | `models.json` custom model entry with `url` + `apiKey`. |
| `cc-switch.md` | `ccswitch-form.png`, `ccswitch-list.png` | Add-provider form (same as IMAGE 08) + the provider list with DeepRouter **active**. |
| `openai-sdk.md` | — | Code-only; no screenshot needed. |
| `langchain.md` | — | Code-only; no screenshot needed. |
| `llamaindex.md` | — | Code-only; no screenshot needed. |
| `immersive-translate.md` | `immersive-custom.png` | Settings → Translation Services → custom OpenAI-compatible service, Custom API Endpoint + key + model. |
| `others.md` | — | Code/curl only; no screenshot needed. |

---

## Capture priority

1. **`03-api-keys.png`** — every guide depends on the reader finding their key.
2. **`01`, `05`, `06`, `07`, `08`, `09`** — the master guide is the entry point; finish it first.
3. **Per-tool shots**, in order of expected user volume: Claude Code, Cursor, Cherry Studio,
   Chatbox, Cline, CC Switch, then the rest.

## What I (Claude) can capture vs. what needs you

- ✅ **Public pages** (`02-signin.png`, and any landing graphics) — I can drive a browser to capture these.
- ✅ **Our own diagram graphics** (`01`, `05`) — these are illustrations, not screenshots; can be built.
- 🔒 **Console internal pages** (`03`, `04`) — require a logged-in DeepRouter account; you'll need to
  capture these or give me an authenticated session.
- 🔒 **Each third-party tool's settings screen** — requires that app installed and configured; best
  captured on the machine where you actually use each tool.
