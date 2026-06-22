# GitHub Copilot → DeepRouter

Short version: **yes, this is now possible — but only in a specific way, and only for chat.**

GitHub Copilot in **VS Code** added a feature called **Bring Your Own Key (BYOK)**. It lets
you plug in an **OpenAI-compatible** endpoint — which DeepRouter is — and use those models in
Copilot **Chat** (including agent mode). Let's be honest about the limits up front so you're
not surprised:

- ✅ Works for **Copilot Chat** and **agent / custom agents**.
- ❌ Does **not** work for **inline code completions** (the grey "ghost text"). Those stay on
  GitHub's own models — BYOK can't change them. This is a Copilot restriction, not a DeepRouter one.
- ℹ️ BYOK shipped first in **VS Code Insiders** and rolled into stable through 2026. If you don't
  see the options below, update VS Code (or use the Insiders build).

> **TL;DR** — in VS Code, run **Chat: Manage Language Models**, add an **OpenAI Compatible** provider:
>
> | Field | Value |
> |---|---|
> | Base URL / endpoint | `https://api.deeprouter.co/v1` |
> | API Key | your DeepRouter key (`sk-...`) |
> | Model ID | from the console **Model Catalog** (e.g. `claude-haiku-4-5`) |

---

## Why DeepRouter

One key gives Copilot Chat access to every model in our catalog (Claude, Qwen, GLM, DeepSeek and more), with smart routing and one place to see your spend.

---

## Before you start

1. A DeepRouter account → **https://deeprouter.co**
2. A DeepRouter **API key** (starts with `sk-`), from the console under **API Keys**
   (also shown once on your welcome screen after signup).
3. **VS Code** with **GitHub Copilot** signed in. BYOK is available on the individual Copilot
   plans (Free, Pro, Pro+); some org-managed accounts have it gated by an admin policy.
4. A reasonably current VS Code. If the steps below don't match, update — or install **VS Code Insiders**.

---

## Steps

1. In VS Code, open the **Command Palette** (**Cmd + Shift + P** / **Ctrl + Shift + P**).
2. Run the command **Chat: Manage Language Models** (sometimes shown as "Manage Models" in the
   Copilot Chat model picker).
3. When asked to pick a provider, choose **OpenAI Compatible**.
4. Enter the connection details when prompted:
   - **Base URL / endpoint**: `https://api.deeprouter.co/v1`
   - **API Key**: your DeepRouter key (`sk-...`)
5. Enter or confirm the **Model ID** you want — use one from the DeepRouter console
   **Model Catalog**, e.g. `claude-haiku-4-5`. Tick it so it's enabled.
6. Finish. Your DeepRouter model now appears in the **Copilot Chat model dropdown**.

> Power-user note: VS Code also exposes a setting called `github.copilot.chat.customOAIModels`
> for fine-tuning model capabilities. You don't need it for a basic setup — the picker above is enough.

---

## Verify it's working

1. Open **Copilot Chat** (the chat icon in the sidebar).
2. At the bottom of the chat box, open the **model dropdown** and select your DeepRouter model.
3. Ask something simple like "Say hello from DeepRouter."
4. You should get a normal reply — and the request should appear in your DeepRouter console usage/logs.
   (Note: usage runs through your DeepRouter account/billing, not your Copilot request quota.)

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **No "Manage Language Models" / "OpenAI Compatible" option** | Your VS Code/Copilot is too old, or an org policy blocks BYOK. Update VS Code (or use Insiders); check with your admin if managed. |
| **Auth / 401 error** | Confirm the key is correct and has quota in the console (**API Keys** + billing). |
| **Connection error** | Base URL must be exactly `https://api.deeprouter.co/v1` (with `/v1`, no trailing slash). |
| **Model not found** | Use an exact model ID from the console **Model Catalog**. |
| **Completions still use GitHub's model** | Expected — BYOK only covers **Chat / agent**, never inline completions. |

---

## Reference

| Item | Value |
|---|---|
| Where to set it | VS Code → **Chat: Manage Language Models** → **OpenAI Compatible** |
| Scope | Copilot **Chat / agent** only (not inline completions) |
| Base URL | `https://api.deeprouter.co/v1` |
| Endpoint used | `POST /chat/completions` (OpenAI-compatible) |
| Auth | `Authorization: Bearer <key>` (VS Code sends it for you) |
| Model IDs | DeepRouter console → **Model Catalog** |
| Get a key | DeepRouter console → **API Keys** |
