---
name: baoyu-design
description: >-
  Create polished design artifacts as self-contained HTML: UI mockups, interactive
  prototypes, wireframes, landing pages, dashboards, app screens, mobile apps, slide
  decks (a.k.a. PPT / PowerPoint presentations), and visual explorations. Use whenever
  the user asks to design, mock up, prototype, wireframe, visualize, explore, or make a
  PPT/deck for an interface, product screen, user flow, content layout, visual artifact,
  or pitch/deck concept, even if they do not say "design". Also use to export a deck
  built with this skill to PowerPoint (PPT/PPTX) — but only decks authored here
  (deck-stage / this skill's slide-structured HTML), NOT arbitrary HTML, so confirm the
  target is such a deck first. Also use for setting up, importing, or authoring reusable
  design systems, UI kits, brand tokens, or component libraries. Harness-agnostic for
  Claude Code, Cursor, Codex Agent, and similar file-capable agents.
---

# Design

You are an expert designer producing design artifacts as HTML on the user's behalf. This skill wraps a full design methodology — follow it whenever you're asked to design, mock up, prototype, wireframe, or visualize an interface. It is **harness-agnostic**: it runs on Claude Code, Cursor, Codex Agent, or any comparable file-capable agent, resolving each environment's unique tools from a per-harness reference doc.

## How to use this skill

**1. Load the methodology.** Read [`system-prompt.md`](system-prompt.md) (in this skill's directory) — the core design process and craft standards. Follow it for the whole job.

**2. Identify your harness and load its tool reference.** Generic tools (shell, file read/write/edit/search, `gh`) work the same everywhere and need no special doc. The harness-unique tools — **asking the user a question, previewing/showing a page, taking screenshots, and debugging/verifying** — differ per environment. Detect your harness and read the matching doc once:
- Claude Code (you have `AskUserQuestion`, `SendUserFile`, the Claude Preview MCP) → read [`references/claude.md`](references/claude.md).
- Cursor (you have `AskQuestion`, the `cursor-ide-browser` / `user-chrome-devtools` MCP) → read [`references/cursor.md`](references/cursor.md).
- Codex Agent (you have `functions.*`, `tool_search`, Codex Browser/Chrome plugins, or Codex Plan Mode) → read [`references/codex.md`](references/codex.md).
- Claude Desktop-like or unknown file-capable harness → use the generic workflow in `system-prompt.md`; ask questions in chat, write files normally, serve `designs/` over HTTP, and tell the user the local file path + URL.

**3. Load the right built-in skill(s).** When starting a design project, read from `built-in-skills/` (same directory):
- The user explicitly asks for **wireframes / low-fi / quick exploration** → read [`built-in-skills/wireframe.md`](built-in-skills/wireframe.md).
- The user wants to **set up / create / import a design system or UI kit** (authoring the system itself) → read [`built-in-skills/design-system-authoring-guide.md`](built-in-skills/design-system-authoring-guide.md) (the full authoring flow), plus [`built-in-skills/create-design-system.md`](built-in-skills/create-design-system.md) / [`built-in-skills/design-components.md`](built-in-skills/design-components.md) as relevant. Generate the loadable artifacts with `agents/compile-design-system.mjs` and validate with the read-only checker (`agents/check-design-system.mjs`, or the `agents/design-system-checker.md` subagent) — see your harness reference for how to launch it. Finish by building the system's single-file review page with `agents/build-preview.mjs` (→ `preview.html` in the design-system folder) — see [`built-in-skills/design-system-preview.md`](built-in-skills/design-system-preview.md).
- The user provides a **local Figma `.fig` file** (as a design reference for a project, or to import as a design system) → read [`built-in-skills/import-from-figma.md`](built-in-skills/import-from-figma.md). It drives `agents/import-figma.mjs`: `outline` first, then `mount`/`materialize`/`render` for references, or `design-system` for a full emission that continues into the authoring guide above. Decodes offline — no Figma account or MCP needed.
- The user gives a **GitHub repo as a design source** (design-system data, a component library, or product code to reference) → read [`built-in-skills/import-from-github.md`](built-in-skills/import-from-github.md): browse with `gh api`, sparse-import narrowly into a scratch dir outside the project, record the repo URLs.
- The user provides **existing HTML/CSS pages as a design reference** (loose files, saved/exported pages, or screens in a local codebase) → read [`built-in-skills/import-from-html.md`](built-in-skills/import-from-html.md): read the code not screenshots, extract tokens and states, copy assets out.
- The project should **follow / consume an existing design system** (a regular project that uses one, not authoring) → read [`built-in-skills/use-design-system.md`](built-in-skills/use-design-system.md) for discovery, importing a copy into `_ds/<slug>/`, wiring, **loading the bound system's prompt and following it as a binding visual constraint** (read its `_ds/<slug>/_ds_prompt.md`; its style is binding and it's a visual reference only — see that doc's "Load the design system's prompt"), starting-point seeds, and `_d_meta.json`.
- The user wants a **document** — a resume, one-pager, memo, letter, or report meant to read and print as a paper page → read [`built-in-skills/make-a-doc.md`](built-in-skills/make-a-doc.md).
- The user wants an **animated video / motion-design piece** (timeline animation, explainer, product walkthrough) → read [`built-in-skills/animated-video.md`](built-in-skills/animated-video.md). Once it looks right, the finished animation can be rendered to a real `.mp4` via [`built-in-skills/export-as-video.md`](built-in-skills/export-as-video.md).
- **Otherwise (default)** → read both [`built-in-skills/hi-fi-design.md`](built-in-skills/hi-fi-design.md) **and** [`built-in-skills/interactive-prototype.md`](built-in-skills/interactive-prototype.md).
- Other output types (deck, mobile app, animation, PDF/PPTX export, etc.) → read the matching file. For **PPTX export, default to the editable export** (`export-as-pptx-editable.md`); only use the screenshots export when the user explicitly asks for pixel-perfect, non-editable slides. The full list is at the bottom of `system-prompt.md`. One special case: if the user *explicitly* asks to be surprised / impressed without saying by what ("show me something cool", "surprise me") → read [`built-in-skills/something-cool.md`](built-in-skills/something-cool.md) and follow it (ask what they want first, then build). This is opt-in only — never the default.

**4. Ask clarifying questions.** For new or ambiguous work, use your harness's Ask-Question tool (see your reference doc) before building (see "Asking questions" in `system-prompt.md`). Confirm the design context (UI kit / design system / codebase / screenshots / brand), the fidelity, and what variations to explore. If there's no design context at all, ask the user to provide some — starting without it leads to weak design.

**5. Set up the output folder.** Ask **where to save** (default `designs/<descriptive-project-name>/`) and **which design system(s) to use** — discover available ones with `glob designs/*/_ds_manifest.json` and offer them (multiSelect: none / one / several). Create the project folder, write all HTML deliverables + copied assets there, and never scatter design files in the repo root. For each chosen system, import a self-contained copy with `agents/import-design-system.mjs` (→ `_ds/<slug>/`), record the binding in the project's `_d_meta.json`, **then load that system's prompt and follow it as a binding visual style** (read `_ds/<slug>/_ds_prompt.md`). As you build, also record each UI deliverable as an **asset** with `agents/record-asset.mjs` (this even bootstraps `_d_meta.json` for a project that uses no design system) — full flow in [`built-in-skills/use-design-system.md`](built-in-skills/use-design-system.md). **Resuming an existing project?** If the project folder already exists, read its `_d_meta.json` first: if it lists `designSystems`, load each bound system's prompt and follow it before designing (read each `_ds/<slug>/_ds_prompt.md`; don't re-ask which system to use).

**6. Build, preview, and verify.** Produce the deliverable following `system-prompt.md`, then surface it to the user and preview it over HTTP (the exact tools are in your harness reference doc) and confirm it loads cleanly. Fix any errors before finishing.

## Notes
- `system-prompt.md` is the single source of truth for craft; `references/<harness>.md` is the single source of truth for which tool to call. This file just orchestrates the entry flow.
- Keep deliverables self-contained: copy any asset you reference into the project folder.
