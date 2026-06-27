# web-to-design-md

Generate a reusable `design.md` / `DESIGN.md` from a live website, plus an HTML preview for reviewing the extracted design system.

This repository is packaged as an installable AI skill. Give the GitHub URL to a supported skill installer, or copy this folder into your local skills directory.

## What It Does

- Reads a live website with `agent-browser`.
- Uses `agent-browser eval` to extract DOM structure, computed styles, CSS variables, stylesheet rules, visible text, and interaction states.
- Produces a detailed Stitch-style `DESIGN.md`.
- Produces a sibling HTML preview using the same design tokens documented in the markdown.
- Captures light and dark theme modes when a site supports theme switching.
- Avoids screenshot-first extraction. Screenshots are only a last-resort verification aid when explicitly requested or when DOM evidence is ambiguous.

## Install From GitHub

After publishing this repository, users can install it from the GitHub URL with a skill installer that supports GitHub sources.

For Codex-style skill installers, the repository root contains `SKILL.md`, so the install path is the repository root:

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo Paidax01/web-to-design-md --path .
```

If your installer accepts a direct GitHub URL, provide the repository URL:

```text
https://github.com/Paidax01/web-to-design-md
```

Restart your AI coding app after installation so the new skill is discovered.

## Requirements

This skill is designed to use `agent-browser` for all website reading.

If `agent-browser` is missing, the skill should help install or expose it before extracting the site. It should not silently switch to Playwright, Chrome CLI, or screenshot-led extraction unless the user explicitly asks for a fallback.

## Repository Layout

```text
.
├── SKILL.md
├── agents/
│   └── openai.yaml
├── assets/
│   ├── DESIGN.template.md
│   └── design-preview-shell.template.html
├── references/
│   ├── browser-tooling-bootstrap.md
│   └── website-reading-checklist.md
└── scripts/
    ├── check-browser-tooling.mjs
    ├── extract-browser-evidence.mjs
    └── render-design-preview.mjs
```

## Usage

Ask your AI coding agent:

```text
Use the website-to-design-md skill to extract https://example.com into design.md and design-preview.html.
```

The output should include:

- `design.md` or `DESIGN.md`
- `design-preview.html`

## Publishing Notes

Before publishing publicly, choose and add an open-source license such as MIT, Apache-2.0, or another license that matches your intent.
