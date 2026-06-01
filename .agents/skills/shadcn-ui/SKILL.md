---
name: shadcn-ui
description: >-
  Give the assistant project-aware shadcn/ui context: components.json,
  composition patterns, CLI, registries, theming, and MCP. Use when working on
  web/default UI, shadcn components, or presets. Overview aligns with
  https://ui.shadcn.com/docs/skills.md; full upstream skill text is vendored
  under vendor/shadcn/.
---

<!-- Canonical overview: https://ui.shadcn.com/docs/skills.md -->

# Skills (shadcn/ui)

Skills give AI assistants project-aware context about shadcn/ui. When used, the assistant knows how to find, install, compose, and customize components using the correct APIs and patterns for your project.

For example, you can ask:

- _"Add a login form with email and password fields."_
- _"Create a settings page with a form for updating profile information."_
- _"Build a dashboard with a sidebar, stats cards, and a data table."_
- _"Switch to --preset [CODE]"_
- _"Can you add a hero from @tailark?"_

The skill reads your project's `components.json` and provides your framework, aliases, installed components, icon library, and base library so it can generate correct code on the first try.

---

## Install (ecosystem vs this repo)

Official install from [Skills — shadcn/ui](https://ui.shadcn.com/docs/skills.md):

```bash
npx skills add shadcn/ui
```

That installs the skill where the `skills` CLI is available. **This repository** keeps the same intent under `.agents/skills/shadcn-ui/` (overview here + **vendored** upstream docs in [`vendor/shadcn/`](./vendor/shadcn/)) and runs the shadcn CLI from the frontend app root:

```bash
cd web/default && bunx shadcn@latest info --json
```

Learn more about skills at [skills.sh](https://skills.sh).

---

## What's included (and where)

### Project context

Run **`shadcn info --json`** (here: `cd web/default && bunx shadcn@latest info --json`) for framework, Tailwind version, aliases, base (`radix` | `base`), icon library, installed components, and resolved paths.

### CLI commands

Full command reference (vendored): [`vendor/shadcn/cli.md`](./vendor/shadcn/cli.md).

### Theming and customization

Vendored: [`vendor/shadcn/customization.md`](./vendor/shadcn/customization.md). Live docs: [Theming](https://ui.shadcn.com/docs/theming).

### Registry authoring

Not duplicated as a single file in the vendor tree; see [Registry](https://ui.shadcn.com/docs/registry) and `build` in [`vendor/shadcn/cli.md`](./vendor/shadcn/cli.md).

### MCP server

Vendored: [`vendor/shadcn/mcp.md`](./vendor/shadcn/mcp.md). Live docs: [MCP Server](https://ui.shadcn.com/docs/mcp).

---

## How it works

1. **Project detection** — Applies when `components.json` exists (here: `web/default/components.json`).
2. **Context injection** — Use `shadcn info --json` as ground truth for imports and APIs.
3. **Pattern enforcement** — Follow rules in [`vendor/shadcn/SKILL.md`](./vendor/shadcn/SKILL.md) and [`vendor/shadcn/rules/`](./vendor/shadcn/rules/).
4. **Component discovery** — `shadcn docs`, `shadcn search`, MCP, or registries — see vendored SKILL + MCP doc.

---

## Learn more (web)

- [CLI](https://ui.shadcn.com/docs/cli) — complements [`vendor/shadcn/cli.md`](./vendor/shadcn/cli.md)
- [Theming](https://ui.shadcn.com/docs/theming)
- [Registry](https://ui.shadcn.com/docs/registry)
- [skills.sh](https://skills.sh)

---

## Vendored upstream bundle (deep rules)

Snapshot from [shadcn-ui/ui `skills/shadcn`](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn); revision note in [`vendor/shadcn/UPSTREAM.txt`](./vendor/shadcn/UPSTREAM.txt).

| Doc | Path |
| --- | --- |
| Full official skill body | [`vendor/shadcn/SKILL.md`](./vendor/shadcn/SKILL.md) |
| CLI reference | [`vendor/shadcn/cli.md`](./vendor/shadcn/cli.md) |
| Theming / customization | [`vendor/shadcn/customization.md`](./vendor/shadcn/customization.md) |
| MCP | [`vendor/shadcn/mcp.md`](./vendor/shadcn/mcp.md) |
| Forms | [`vendor/shadcn/rules/forms.md`](./vendor/shadcn/rules/forms.md) |
| Composition | [`vendor/shadcn/rules/composition.md`](./vendor/shadcn/rules/composition.md) |
| Icons | [`vendor/shadcn/rules/icons.md`](./vendor/shadcn/rules/icons.md) |
| Styling | [`vendor/shadcn/rules/styling.md`](./vendor/shadcn/rules/styling.md) |
| Base vs Radix | [`vendor/shadcn/rules/base-vs-radix.md`](./vendor/shadcn/rules/base-vs-radix.md) |

**Workflow:** Prefer this **root** `SKILL.md` for repo paths (`web/default`, Bun). Read **`vendor/shadcn/SKILL.md`** for the complete upstream workflow, patterns, and CLI quick reference. Use **`vendor/shadcn/rules/*.md`** when validating concrete markup.
