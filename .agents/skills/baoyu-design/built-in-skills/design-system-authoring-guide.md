---
name: "design-system-authoring-guide"
description: "Full authoring flow for setting up or importing a design system — the brand's tokens, components, UI kits, and starting points — and compiling it into a consumable bundle."
---
# Authoring a design system

Use this guide when the user wants to **set up a design system**, **import an existing design system**, or **create a UI kit**. It is the long-form companion to [`create-design-system.md`](create-design-system.md) and [`design-components.md`](design-components.md); read those for the compact compiler/checker contract, this for the full craft flow.

## This project is a design system

You are authoring the design system itself, not consuming one. Design systems are folders on the file system containing typography guidelines, colors, assets, brand style and tone guides, CSS styles, and React recreations of UIs, decks, etc. They give design agents the ability to create designs against a company's existing products, and create assets using that company's brand. A design system should contain real visual assets (logos, brand illustrations, etc.), low-level visual foundations (typography specifics; color, shadow, border, spacing systems), reusable UI components, and high-level UI kits (full screens).

### Compiler & checker (portable)

There is **no background compiler** in this harness. `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, and `preview.html` are **generated artifacts** — never hand-edit them. After you edit components, tokens, or cards, (re)generate them yourself by running the compiler (a plain shell call, identical on Claude Code / Cursor / Codex):

```
node <skill>/agents/compile-design-system.mjs designs/<project>
```

(`<skill>` is this skill's directory; `designs/<project>` is the design-system folder.) The compiler discovers everything from **file content and sibling relationships — not from folder names** — so the only fixed location is the global-CSS entry point (below). It bundles the components into a runtime library, indexes the styles, and writes the three artifacts.

After compiling, validate with the **read-only design-system checker** — it reports what the compiler found (namespace, components, `@dsCard` cards, starting points, tokens, fonts) and any issues, and **writes nothing**:

```
node <skill>/agents/check-design-system.mjs designs/<project>
```

To run it as an isolated read-only subagent (recommended after a batch of edits), launch it with the prompt at [`../agents/design-system-checker.md`](../agents/design-system-checker.md) — see your harness reference (`references/<harness>.md`) for the exact launch tool (Claude → `Agent`; Cursor → `Task`; Codex → inline). Fix what it reports, recompile, and run again until clean. Wherever older instructions said "call `check_design_system`", they mean: recompile, then run this checker.

Once compiler + checker are clean, **build the single-file review page** — it compiles every `@dsCard` card, the Readme, and the starting points into one self-contained interactive `preview.html` in the design-system folder (open it directly in a browser to review everything at once):

```
node <skill>/agents/build-preview.mjs designs/<project>
```

Re-run it after any later edit, like the compiler — full doc in [`design-system-preview.md`](design-system-preview.md).

**Namespace.** Compiled components are exposed on `window.<Namespace>` (e.g. `const { Button } = window.AcmeDesignSystem_a1b2c3`). The compiler derives `PascalCase(<project>)_<6hex>` on first compile and **persists it** — on recompile it reads the existing namespace from `_ds_manifest.json` (or the `/* @ds-bundle */` header), so it never changes under you. Get the exact value from `_ds_manifest.json` or by running the checker; cards reference it in their inline scripts.

### What the compiler looks for, regardless of path

- **Global CSS**: `styles.css` at the project root (or `index.css` / `globals.css` / `global.css` / `main.css` / `theme.css` / `app.css` / `tokens.css` — first match wins). This is the global-CSS entry point; consumers link this one file. Keep it as a list of `@import` lines only. Everything it transitively `@import`s is shipped to consumers; `@font-face` rules anywhere in that closure declare the webfonts. Tokens are any `--*` custom property declared under `:root` (or a single-selector theme scope) in a file reachable from this entry.
- **Components**: any `<Name>.jsx` / `<Name>.tsx` (PascalCase stem) with a sibling `<Name>.d.ts` in the same directory. Add `<Name>.prompt.md` alongside, and one `@dsCard`-tagged `.html` per directory for the thumbnail (details under "Components").
- **Fonts**: any `@font-face` rule in the global-CSS closure; its `src: url(…)` targets are the binaries shipped to consumers. A `--fontFamily*` token whose family has no `@font-face` is flagged as a brand font needing files.

Organize everything else however suits the brand. A sensible default layout (use it unless the attached codebase or brand has its own convention):

- `tokens/` — CSS custom properties, one file per concern (`colors.css`, `typography.css`, `spacing.css`, …), each `@import`ed from `styles.css`.
- `components/<group>/` — reusable React UI primitives.
- `ui_kits/<product>/` — full-screen click-through recreations of real product views.
- `guidelines/` — foundation specimen cards and deeper-dive prose.
- `assets/` — logos, icons, illustrations, imagery.
- `readme.md` (root) — the design guide and manifest.

### Importing source material (codebase / Figma / decks)

Nothing is pre-loaded — read only what you need.

- **Design system repos (GitHub)**: the user may give GitHub repos as design sources (e.g. `adobe/spectrum-design-data`) — full mechanics in [import-from-github.md](import-from-github.md) (browse with `gh api`, shallow sparse clone, auth failures). Two rules matter here: clone into a scratch location **outside** the design-system folder (the compiler scans the whole project tree and would bundle the clone), and record the repo URLs you used in `readme.md`, suggesting the reader explore them further.
- **Figma**: use the harness's Figma MCP if present — `get-design-context` to understand the design system and components, and expand variables/child components for their real values (`get_variable_defs`). If no Figma MCP is available, ask the user to export the frames/variables you need. A Figma link you can't open is a blocker — stop and ask the user to fix access. **If the user has (or can export: File → Save local copy…) a local `.fig` file, prefer [import-from-figma.md](import-from-figma.md)** — it decodes offline and can emit the full component/token set directly, no MCP or account needed.
- **Slide decks**: read them with the harness's file/image tools, extract key assets + text, and write them to disk.

CRITICAL: do not recreate UIs from screenshots alone unless you have no other choice. The codebase or Figma design context is the source of truth; screenshots are lossy — use them as a high-level guide but always find the real components in code/Figma if you can.

## The build flow

To begin, create a todo list with the tasks below, then follow it:

- **Explore** the provided assets and materials to understand the company/product context, the different products represented, etc. Read each asset (codebase, Figma, file) and see what they do. Find product copy; examine core screens; find any existing design-system definitions.
- **Create `readme.md`** (root) with the high-level understanding of the company/product context and the products represented. Mention the sources you were given — full Figma links, GitHub repo URLs, codebase paths. Do not assume the reader has access, but record them in case they do.
- **Set the project title**: put a short brand-derived name (e.g. "Acme Design System") at the top of `readme.md` and use it for the generated `SKILL.md` `name`. This replaces the generic placeholder so the project is findable.
- **If slide decks are attached**, look at them, extract key assets + text, write to disk.
- **Explore the codebase and/or Figma design contexts, then write the token CSS files** — CSS custom properties on `:root`, both base values (`--fg-1`, `--font-serif-display`) and semantic aliases (`--text-body`, `--surface-card`). Copy any webfonts/TTFs into the project and write the `@font-face` rules in a CSS file. Then write the root `styles.css` as a list of `@import` lines only (never inline rules there) that reaches every token and font-face file. Then **compile and run the checker** to confirm tokens and fonts are picked up.
- **Explore, then update `readme.md` with a CONTENT FUNDAMENTALS section**: how is copy written? Tone, casing, "I" vs "you", emoji, the vibe? Include specific examples.
- **Explore, then update `readme.md` with a VISUAL FOUNDATIONS section** covering the brand's visual motifs and foundations: colors, type, spacing, backgrounds (images? full-bleed? hand-drawn illustrations? repeating patterns/textures? gradients?), animation (easing? fades? bounces? none?), hover states (opacity, darker, lighter?), press states (color? shrink?), borders, inner/outer shadow systems, protection gradients vs capsules, layout rules (fixed elements), use of transparency and blur (when?), color vibe of imagery (warm? cool? b&w? grain?), corner radii, what cards look like (shadow, rounding, border), and whatever else you can think of. Answer ALL these questions.
- **If you are missing font files**, find the nearest match on Google Fonts. Flag the substitution to the user and ask for updated font files. (The checker also flags `--fontFamily*` tokens that have no `@font-face`.)
- **Create foundation specimen cards** (small HTML files) that populate the Design System tab — see "Foundation cards" below.
- **Copy logos, icons and other visual assets** into `assets/`, and update `readme.md` with an ICONOGRAPHY section — see "Iconography" below.
- **Author the reusable components** — see "Components" below. Each directory's card HTML carries `<!-- @dsCard group="Components" … -->` on line 1.
- **For each product** (e.g. app and website), create a UI kit in its own directory — see "UI kits" below. One todo item per product/surface.
- **If you were given a slide template**, create sample slides — `{index.html, TitleSlide.jsx, ComparisonSlide.jsx, BigQuoteSlide.jsx, …}` in their own directory, copying the deck's style. Tag each slide HTML with `<!-- @dsCard group="Slides" viewport="1280x720" -->` on line 1 so the 16:9 frame scales to fit the card. If no sample slides were given, don't create them.
- **Tag each UI kit's `index.html`** with `<!-- @dsCard group="<Product>" viewport="<design width>x<above-fold height>" -->` — the declared height caps what's shown, so pick the portion worth previewing.
- **Update `readme.md` with a short "index"** pointing the reader to the other files available — a manifest of the root folder, plus a list of components, UI kits, etc.
- **Create the `SKILL.md` file** (template below).
- **Compile, run the checker until clean,** then preview a card or two over HTTP to confirm components render with no console errors (see your harness reference for preview tools).
- **Build `preview.html`** as the last step — `node <skill>/agents/build-preview.mjs designs/<project>` compiles the whole system (Readme + every card) into one self-contained interactive `designs/<project>/preview.html`. Open/screenshot it to confirm cards mount with no `[ds-preview]` console errors, and point the user at it as the one file to review. See [`design-system-preview.md`](design-system-preview.md).
- **You are done!** The Design System tab shows every registered card. Do NOT summarize your output; just mention CAVEATS (things you couldn't do or are unsure about) and end with a CLEAR, BOLD ASK for the user to help you ITERATE toward perfect.

## Foundation cards

As you work, create foundation specimen cards (small HTML files) that populate the Design System tab. Target ~700×150px each (400px max) — err toward MORE small cards, not fewer dense ones. Split at the sub-concept level: separate cards for primary vs neutral vs semantic colors; display vs body vs mono type; spacing tokens vs a spacing-in-use example. A typical foundations set is 12–20+ cards.

Skip titles and framing — the card name renders OUTSIDE the card, so just show the swatches/specimens/tokens directly with minimal decoration. Each card links `styles.css` (relative path from wherever you put it) so it picks up the real tokens.

Tag each card with `<!-- @dsCard group="<Group>" viewport="700x<height>" subtitle="<one line>" name="<Card name>" -->` as its **first line** — the Design System tab renders every tagged `.html` in the project, grouped verbatim by `group`. Suggested groups: "Type", "Colors", "Spacing", "Brand" — title-cased, consistent.

## Iconography

Copy logos, icons and other visual assets into `assets/`. Update `readme.md` with an ICONOGRAPHY section describing the brand's approach: are certain icon systems used? A built-in icon font? Common SVGs or PNG icons (if so, copy them in)? Is emoji ever used? Unicode chars as icons? Copy key logos, background images, maybe 1–2 full-bleed generic images, and ALL generic illustrations you find. NEVER draw your own SVGs or generate images; COPY icons programmatically where you can. Answer ALL these questions and more.

For icons: FIRST copy the codebase's own icon font/sprite/SVGs into `assets/` if you can. Otherwise, if the set is CDN-available (e.g. Lucide, Heroicons), link it from CDN. If neither, substitute the closest CDN match (same stroke weight / fill style) and FLAG the substitution. Document usage in ICONOGRAPHY.

Avoid reading SVGs — it's a waste of context. If you know their usage, just copy them and reference them.

## Components

- These are the brand's reusable UI primitives — Button, IconButton, Input, Select, Checkbox, Radio, Switch, Card, Badge, Tag, Avatar, Tabs, Dialog, Toast, Tooltip, etc. Group by concern (e.g. `forms/`, `feedback/`, `navigation/` under whatever parent directory you choose); a single `core/` group is fine for a small set.
- Each component is one file `<Name>.jsx` (or `.tsx`) with `export function <Name>(props) {…}` — a named, PascalCase export; that name becomes the public API and the literal `export` keyword is **required** so the compiler picks it up. Keep them self-contained: import React only, reference styling via the CSS custom properties (no CSS-in-JS libs, no npm packages). Siblings may import each other with relative paths. (The compiler strips/rewrites these imports at bundle time; the globals it provides — `const React = window.React;`, `const { Icon } = window.<Namespace>;` — work too.)
- In the same directory, write `<Name>.d.ts` with the props interface — the sibling `.d.ts` is what gives a component its props contract, adherence rules, and starting-point eligibility; a `.jsx` without one is still bundled and exported under the namespace but gets none of those — and `<Name>.prompt.md` (first line a one-sentence "what & when", then a small JSX usage example, then notable variants/props).
- One **card HTML** per directory (name it whatever you like — e.g. `buttons.card.html`): first line is `<!-- @dsCard group="Components" viewport="700x<height>" name="<Directory label>" -->`. Link `styles.css` via the correct relative path, load the bundle via `<script src="…/_ds_bundle.js">` (relative path to project root), then mount with `const { <Name> } = window.<Namespace>` in a `<script type="text/babel">` block. Get the exact `<Namespace>` from `_ds_manifest.json` or the checker. Do **NOT** `<script src>` the `.jsx` directly — its `export` is unreachable from inline script. Show key states/variants (primary/secondary/ghost; sizes; disabled; with icon; etc.); make it dense and scannable, not a single default render. In the `text/babel` block, never give a top-level binding a window-global name (`status`, `name`, `open`, `close`, `event`, `top`, `self`, `parent`, `length`, `origin`, `location`, `history`, `screen`, `scroll`, `stop`, `print`, `focus`, `blur`, `frames`, `closed`, `opener`) — Babel injects the transpiled code as a classic script where top-level `const`/`let` become `var`, so `const status = …` turns into a `window.status` write and the card dies with a pageerror the console may never surface. The checker flags these; pick a longer name (`statusBadge`).
- Do NOT write `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, or a barrel `index.js` — those are generated by the compiler.

## Starting points

- Consuming projects show a "Starting Points" picker that lets users seed a new design with a component or screen from this system. Entries are **opt-in** via a tag — separate from `@dsCard` (which populates the Design System tab).
- To mark a **component**: add `@startingPoint section="<group>" subtitle="<one line>" viewport="<WxH>"` to the JSDoc on its `<Name>.d.ts` props interface. The picker thumbnail is that directory's `@dsCard`-tagged HTML, so make sure it renders sensibly at the declared viewport.
- To mark a **screen**: add `<!-- @startingPoint section="<group>" subtitle="<one line>" viewport="<WxH>" -->` as the first line of the HTML file. The screen itself is the thumbnail.
- When the user says "create a starting point <X>" (or "add <X> as a starting point"), write an HTML file with the `<!-- @startingPoint section="…" -->` comment as its first line — any `.html` in the project with that tag is indexed. `ui_kits/<x>/index.html` is the conventional home but not required.
- When the user asks to remove or retitle a starting point, edit the tag. When they ask to change a thumbnail, edit the `@dsCard`-tagged HTML in that component's directory (component) or the screen HTML itself.

## UI kits

- UI kits are high-fidelity visual + interaction recreations of full interfaces — screens, not primitives. They cut corners on functionality (not "real production code") but are pixel-perfect, created by reading the original UI code if possible, or using Figma's `get-design-context`. UI kits **compose** the component primitives you authored above; don't re-implement Button inside a kit. A UI kit's `index.html` must look like a typical view of the product. These are recreations, not storybooks.
- To start, update the todo list with these steps for each product: (1) explore codebase + components in Figma (design context) and code, (2) create 3–5 core screens for each product (e.g. homepage or app) with interactive click-through components, (3) iterate visually on the designs 1–2×, cross-referencing with design context.
- Figure out the core products from this company/codebase. There may be one, or a few (e.g. mobile app, marketing website, docs website).
- Each UI kit contains JSX (well-factored; small, neat) for that product's surfaces — sidebars, composers, file panels, hero units, headers, footers, blog posts, video players, settings screens, login, etc.
- The `index.html` should demonstrate an interactive version of the UI (e.g. a chat app shows a login screen, lets you create a chat, send a message, etc., as fake).
- Get the visuals exactly right, using design context or codebase import. Don't copy component implementations exactly; make simple, mainly-cosmetic versions. It's important to copy.
- Focus on good component coverage, not replicating every single section of a design.
- Do not invent new designs for UI kits. The job is to **replicate** the existing design, not create a new one. If you don't see it in the project, omit it, or leave it purposely blank with a disclaimer.

## Guidance

- Run independently without stopping unless there's a crucial blocker (e.g. lack of Figma access to a pasted link; lack of codebase access).
- When creating slides and UI kits, avoid cutting corners on iconography; copy icon assets in. Do not create halfway representations of iconography using hand-rolled SVG, emoji, etc.
- Avoid these visual motifs unless you are sure you see them in the codebase or Figma: bluish-purple gradients, emoji cards, cards with rounded corners and a colored left-border only.
- Stop if key resources are inaccessible: if a codebase or Figma URL was attached/mentioned but you can't access it, you MUST stop and ask the user to re-attach/rectify. These get reattached often; do not finish a design system on a disconnect.

## SKILL.md

When you are done, make this folder cross-compatible with Agent Skills so the user can download it and use it in Claude Code (or Cursor / Codex). Create a `SKILL.md` file like this:

```
---
name: {brand}-design
description: Use this skill to generate well-branded interfaces and assets for {brand}, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
```

## After authoring: how projects consume this system

Once compiled, this design system is discovered by regular design projects via `glob designs/*/_ds_manifest.json` and imported into them as a self-contained `_ds/<slug>/` copy (with the binding recorded in the project's `_d_meta.json`, alongside any deliverables the project records as assets). You don't do anything extra to enable that — just keep the artifacts compiled and the `README.md` opening descriptive, since its first heading/paragraph is what the consumer's picker shows. The full consumer-side flow (discovery → import → wiring → starting-point seed → `_d_meta.json`) is in [`use-design-system.md`](use-design-system.md).
