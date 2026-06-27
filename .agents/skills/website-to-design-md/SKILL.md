---
name: website-to-design-md
description: Generate a reusable design.md or DESIGN.md from a live website by deeply inspecting the site with `agent-browser` and `agent-browser eval`, then synthesizing its visual language, layout system, interaction patterns, and content style into a structured markdown design system. Use when given one or more website URLs and asked to analyze a site, reverse-engineer its design, extract its look and feel, write DESIGN.md, create a style guide, or capture a site's UI rules for later AI-assisted design or implementation. Prefer this skill when the goal is documentation rather than rebuilding the page in code. Always use `agent-browser` as the primary browser runtime; if it is missing, help the user install or expose it instead of switching platforms or browser stacks.
---

# Website to DESIGN.md

## Overview

Use this skill to turn a real website into a reusable `design.md` or `DESIGN.md` document plus a companion HTML preview.

The goal is not to clone the site. The goal is to inspect it deeply enough that another agent can recreate the same design language, content tone, and interaction feel without needing to see the original website.

The HTML preview is a practical review surface. It should translate the markdown into a glanceable design board so the user can inspect palette, typography, spacing, component cues, and the raw markdown source without reopening the site.

## Universal Browser Rule

This skill should always use `agent-browser` first.

- Use `agent-browser open`, `agent-browser wait`, and especially `agent-browser eval` as the primary extraction workflow.
- Do not start by checking which app or platform the user is on.
- Do not branch logic based on whether the user is using Codex, Trae, Claude, Cursor, or another host.
- Do not start by checking whether the current project folder contains Playwright, Chrome CLI, or a local browser package.
- If `agent-browser` is unavailable, help the user install it or expose it on `PATH`, then continue with the same workflow.
- Do not silently switch to Playwright, Chrome CLI, or screenshot-led extraction unless the user explicitly asks for a separate fallback.

## Working Style

Work browser-first and evidence-first.

- Prefer `agent-browser` over raw HTML fetches. A live website often hides important behavior behind hydration, scroll state, hover state, or responsive layout changes.
- Treat `agent-browser eval` as the primary extraction layer. The main evidence should come from DOM structure, rendered HTML, computed styles, CSS variables, readable stylesheet rules, and interaction states gathered inside the browser runtime.
- Do not use screenshots as a default evidence source. When `agent-browser eval` or an equivalent page-eval path is available, use DOM, computed styles, CSS variables, readable stylesheet rules, and extracted text as the primary evidence.
- Only use screenshots as an optional last-resort cross-check when DOM evidence is insufficient or the user explicitly asks for a visual verification pass.
- Do not silently fall back to Playwright or Chrome CLI. If `agent-browser` is unavailable, detect that explicitly and help the user install or expose it.
- Treat static source files as supporting evidence, not the main truth source.
- Translate technical details into design language. Do not dump CSS blindly; synthesize it into something an agent can actually use.
- Distinguish observed facts from inference. If something is a judgment or a likely rule rather than a directly observed value, label it clearly.
- Treat the HTML preview as part of the default deliverable, not as an optional extra, unless the user explicitly opts out.

## Preflight

1. Normalize the target into one or more URLs.
2. Check whether `agent-browser` is already usable.
3. If `agent-browser` is missing, use [scripts/check-browser-tooling.mjs](scripts/check-browser-tooling.mjs) and then help the user install or expose `agent-browser`.
4. Do not inspect the current folder for Playwright, Chrome CLI, or local browser executables as the primary path.
5. Do not silently fall back to Playwright or Chrome CLI unless the user explicitly asks for that fallback.
6. Default the markdown output file to `DESIGN.md`.
7. Default the companion preview file to the same basename plus `-preview.html`, for example `DESIGN-preview.html` or `design-preview.html`.
8. If the user explicitly asks for `design.md`, a custom filename, or a custom folder, honor that exactly and keep the HTML preview beside it unless the user asks not to.
9. If multiple URLs are provided, inspect each independently, then synthesize one shared design system only when the visual language is clearly consistent across pages.

## Browser Tooling Bootstrap

Treat browser tooling setup as part of the skill, not as a separate user chore.

### Detection

Check in this order:

- whether `agent-browser` is already callable
- if not, whether it can be installed or exposed immediately

The bundled checker script reports:

- whether `node` and `npm` are available
- whether `agent-browser` is callable
- which tool should be used next
- whether installation is recommended

### Installation Default

If `agent-browser` is unavailable, help the user install it or expose it on `PATH`, and verify it with `agent-browser --help` before using the skill.

### Installation Behavior

- Explain that installation is needed so the skill can consistently use `agent-browser`.
- If the first install attempt fails because of network or sandbox restrictions, request the needed approval and retry.
- If installation succeeds, continue directly into site analysis in the same turn.
- If installation fails, tell the user clearly what is missing and stop rather than silently switching to a different extractor.
- Do not silently downgrade to static HTML scraping just because tooling is absent.

## Required Extraction Passes

Use the checklist in [references/website-reading-checklist.md](references/website-reading-checklist.md) when you need a deeper reminder of what to inspect.

### 1. Scope the Page

- Identify the page purpose.
- Identify whether the page is marketing, product, dashboard, docs, ecommerce, editorial, or mixed.
- Identify the important visible sections from top to bottom.
- Note any gated or inaccessible areas instead of inventing them.

### 2. Capture the Baseline

- Inspect the page at desktop first.
- Also inspect tablet and mobile when the layout materially changes.
- Scroll the full page slowly before writing anything so you do not miss delayed animation, sticky UI, or progressive disclosure.
- Capture browser-side code evidence while the page is live: rendered HTML, key node `outerHTML`, root CSS variables, readable stylesheet rules, and computed styles for representative components.
- Prefer direct `agent-browser eval` calls or an `agent-browser`-driven wrapper script rather than switching to another browser stack.
- Use [scripts/extract-browser-evidence.mjs](scripts/extract-browser-evidence.mjs) only when the user explicitly wants a shell-generated JSON artifact while still staying on `agent-browser`.
- Do not pause for screenshot capture during the default pass. Use page evaluation to extract the structure and styles directly from the running page.

### 2.1 Preferred Eval Workflow

When `agent-browser eval` or an equivalent browser-eval path is available, follow this order:

1. open the page
2. wait for load and hydration
3. scroll the page to trigger lazy content and sticky-state changes
4. extract rendered HTML for representative nodes
5. extract computed styles for headings, buttons, cards, navigation, and section wrappers
6. extract root CSS variables and readable stylesheet rules
7. extract visible text snippets and CTA copy
8. probe hover, active, sticky, or expanded states through DOM or computed-style changes

Do not replace steps 4 through 8 with screenshots.

### 3. Extract the Design System

Capture the reusable rules, not only the page-specific surface:

- colors and their roles
- light and dark theme variants when the site supports them
- typography hierarchy
- spacing rhythm and grid behavior
- corner radius language
- border treatment
- shadows and surface layering
- imagery style
- icon style
- motion and transition style
- density and whitespace philosophy
- stylesheet and CSS variable conventions when observable
- DOM patterns that explain how repeated components are actually structured

### 4. Extract Components and States

Inspect the major repeated patterns:

- navigation
- announcement bars
- hero blocks
- buttons and links
- cards
- badges
- forms and inputs
- tabs or pills
- accordions
- tables
- footers

For each important component, inspect the visible states that matter:

- default
- hover
- active or selected
- focused if visible
- disabled if visible
- scrolled or sticky variants
- open or expanded states
- light-mode and dark-mode variants when the site supports theme switching

### 5. Extract Interaction Behavior

Do not stop at static visuals.

Document:

- what changes on scroll
- what changes on hover
- what changes on click
- what changes when the user toggles between light and dark mode
- what is animated into view
- whether carousels, tabs, or sticky sidebars are click-driven, scroll-driven, or time-driven
- how fast motion feels and whether it is subtle, crisp, cinematic, playful, or restrained
- which CSS or DOM states change during those interactions when observable in the browser

### 6. Extract Content and Brand Voice

Capture the tone that shapes the design:

- headline style
- CTA phrasing
- sentence density
- product framing
- trust signals
- feature naming patterns
- whether copy is technical, playful, premium, direct, academic, or conversational

This is important because a good `DESIGN.md` should guide both visuals and presentation style.

### 6.1 Theme Mode Sweep

If the site supports appearance switching:

- trigger the light and dark mode toggle directly in the browser
- extract DOM and computed-style evidence for both modes
- document which tokens invert versus which accents stay stable
- note whether imagery, shadows, borders, cards, and code blocks change treatment between modes
- carry both modes into the final markdown and HTML preview

## Output Contract

Write the final document using the structure in [assets/DESIGN.template.md](assets/DESIGN.template.md).

After the markdown is written, generate a companion HTML preview using [scripts/render-design-preview.mjs](scripts/render-design-preview.mjs) when possible.

When browser tooling is available, prefer a DOM-and-style extraction pass before writing. The expected evidence order is:

1. rendered HTML and key node structure
2. computed styles and CSS variables
3. interaction-state diffs
4. optional screenshot cross-check only if the user explicitly asks for it or DOM evidence is ambiguous

If the page supports light and dark themes, the output contract also requires:

1. explicit `Theme Modes` documentation in `DESIGN.md`
2. separate light-mode and dark-mode token notes when they differ materially
3. a visible light/dark theme summary block in the companion HTML preview

The document should usually contain these sections:

1. `Visual Theme & Atmosphere`
2. `Color Palette & Roles`
3. `Typography Rules`
4. `Component Stylings`
5. `Layout Principles`
6. `Depth & Elevation`
7. `Do's and Don'ts`
8. `Responsive Behavior`
9. `Agent Prompt Guide`

Add optional appendices only when they add real value:

- `Interaction Patterns`
- `Content & Messaging Patterns`
- `Observed Pages`
- `Evidence Notes`

Within those sections, prefer richer Stitch-style subsections when the site supports them:

- `Key Characteristics`
- `Primary`, `Interactive`, `Neutral Scale`, `Surface & Overlay`, `Shadows & Depth`
- `Font Family`, `Hierarchy`, `Principles`
- `Buttons`, `Cards & Containers`, `Inputs & Forms`, `Navigation`, `Image Treatment`, `Distinctive Components`
- `Spacing System`, `Grid & Container`, `Whitespace Philosophy`, `Border Radius Scale`
- `Breakpoints`, `Touch Targets`, `Collapsing Strategy`
- `Quick Color Reference`, `Example Component Prompts`, `Iteration Guide`

Do not keep the document at the level of a high-level summary if the site exposes enough evidence to be more precise.

## HTML Preview Contract

Generate one HTML file next to the markdown by default.

The preview should:

- use the final `DESIGN.md` as its source of truth rather than a separate hand-maintained summary
- use a fixed preview shell template, not a newly invented HTML framework on each run
- surface the most useful visual rules on the left, for example overview, palette, typography, spacing, radius, buttons, cards, depth, and responsive notes
- keep the markdown source visible in a dedicated pane so the user can inspect or copy the original document quickly
- feel like a polished design board rather than a plain markdown render
- use the extracted design tokens where practical so the preview itself reflects the documented system

Use [assets/design-preview-shell.template.html](assets/design-preview-shell.template.html) as the default shell when available. Treat that template as stable infrastructure and only fill the documented tokens and content into it unless the user explicitly asks for a new layout direction.

When the user provides a visual reference for layout, follow it closely enough that the HTML is recognizably in the same family while still being generated from the markdown data.

## Synthesis Rules

When writing the final file:

- Prefer semantic names over raw token labels.
- Include exact hex values when color precision matters.
- Translate radius, spacing, shadows, and type scales into plain language that another agent can use immediately.
- Keep the document opinionated and usable; avoid giant data dumps.
- Explain functional roles, not just appearance.
- Group recurring patterns into a system.
- Preserve nuance. If the site mixes two visual modes, describe both and when each appears.
- Prefer precise numeric detail when it is observable: exact hex values, font sizes, line heights, letter spacing, radius values, spacing units, and multi-layer shadow formulas.
- Add a short philosophy or rationale when a pattern is central to the site's identity, for example "shadow-as-border" or "compression as identity".
- Include component-specific implementation cues when they help another agent build matching UI without seeing the source site.
- Include prompt-ready examples in `Agent Prompt Guide` for at least hero, card, button, or navigation patterns on substantial sites.
- When some values are inferred rather than observed, keep them clearly labeled but still useful.

Good:

- "Primary actions use a cool electric blue `#3B82F6` on dark charcoal surfaces."
- "Cards feel editorial rather than app-like: soft borders, large inner padding, and very light shadow separation."

Bad:

- "Button background is `rgb(59, 130, 246)`."
- "There is some spacing and some rounded corners."

## Quality Bar

The final `DESIGN.md` should be usable as prompt context by another agent with no extra explanation.

Before finishing, check:

- Could another agent reproduce the site's mood from this document alone?
- Are the primary colors tied to specific functions?
- Is the typography hierarchy concrete enough to reuse?
- Are major components described with enough state detail?
- Are responsive shifts documented where they materially affect composition?
- Is the tone of the copy captured, not just the UI chrome?
- Did you avoid fabricating hidden pages or invisible states?
- Would another agent know the spacing scale, radius scale, and shadow behavior well enough to build a matching component library?
- Would another agent know at least 2 to 4 prompt-ready examples for recreating signature sections or components?

If the answer to any of these is no, inspect the site again before finalizing.

## Detail Threshold

Aim for a document that is closer to a design rulebook than a mood board.

For substantial marketing sites or polished product sites, include:

- at least one dense paragraph in `Visual Theme & Atmosphere`
- multiple color groups, not just one flat token table
- a full typography hierarchy table with sizes, weights, line heights, and tracking where possible
- explicit component behavior for buttons, cards, navigation, and at least one distinctive pattern
- implementation-grade notes for shadows, borders, spacing, or radius if those are part of the identity
- prompt-ready examples and iteration rules in the final section

If the output feels shorter than the information you actually observed, expand it before finishing.

## Default Deliverable Pattern

Unless the user asks for something else:

1. Inspect the live site with `agent-browser` and `agent-browser eval`.
2. Synthesize one polished `DESIGN.md` file in the current workspace.
3. Generate one sibling HTML preview from the markdown, usually with [scripts/render-design-preview.mjs](scripts/render-design-preview.mjs).
4. If you had to switch to a shell fallback or install tooling, mention that briefly in the final response.
5. Keep the target folder clean by default. Do not leave standalone `notes`, `note.md`, `research.md`, `evidence.md`, or evidence JSON files next to the deliverables unless the user explicitly asks for them.
6. If an intermediate evidence file is needed, prefer a system temporary path rather than the target folder. When using [scripts/extract-browser-evidence.mjs](scripts/extract-browser-evidence.mjs), omit the output path unless the user wants to keep the artifact.
7. In your final response, call out the biggest design traits, the generated file names, and any evidence gaps.

## Edge Cases

### Multiple Pages

If the user provides multiple URLs from the same product:

- identify shared design rules first
- note page-specific deviations separately
- avoid repeating the same system description on every page

### Auth Walls or Partial Access

If part of the site is not accessible:

- document only what you can actually inspect
- explicitly note missing areas
- do not invent hidden components or flows

### Highly Dynamic Apps

If the site is a complex app rather than a marketing page:

- focus on navigation model, density, table or panel patterns, filters, forms, empty states, and state-change behavior
- capture the dashboard or app shell logic as part of layout principles
- include a concise appendix for workflow-specific interactions when they shape the visual system

### Missing Tooling

If the session starts without usable browser automation:

- detect the actual environment first instead of guessing
- first check whether `agent-browser` is already available
- do not begin with project-folder browser dependency checks
- if it is missing, help the user install or expose it on `PATH`
- verify availability with a real `agent-browser --help` or equivalent smoke check
- keep the user informed that setup is in service of the extraction task
- do not silently switch to Playwright or Chrome CLI unless the user explicitly requests that fallback

## Handy Framing

When the writing feels too literal, use this mental model:

"Write the design system that a strong design-engineering agent would want before building a fresh page in the same product language."
