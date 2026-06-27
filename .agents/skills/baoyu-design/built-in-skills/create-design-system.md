---
name: "create-design-system"
description: "Create design system\nSkill to use if user asks you to create a design system or UI kit"
---
Design system creation instructions:

## This project is a design system

You are authoring the design system itself, not consuming one. `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, and `preview.html` are **generated artifacts** — never hand-edit them. After you edit components or tokens, (re)generate them by running the portable compiler (a plain shell call on Claude Code / Cursor / Codex):

```
node <skill>/agents/compile-design-system.mjs designs/<project>
```

(`<skill>` is this skill's directory.) See [`design-system-authoring-guide.md`](design-system-authoring-guide.md) for the full authoring flow — including importing sources from GitHub repos (see [`import-from-github.md`](import-from-github.md): browse with `gh api`, sparse-checkout only the paths you need into a scratch dir outside the project).

What the compiler looks for:
- **Global CSS**: `styles.css` (or `index.css`/`globals.css`/`global.css`/`main.css`/`theme.css`/`app.css`/`tokens.css`) at the project root, plus everything it `@import`s. Tokens and `@font-face` are read from that closure.
- **Components**: any `<Name>.d.ts` (PascalCase) with a sibling `<Name>.jsx`/`.tsx` in the same directory — anywhere in the project. The thumbnail is the `@dsCard`-tagged `.html` in that directory (see below). In it, load the compiled bundle via `<script src="…/_ds_bundle.js">` (relative path to project root) and read components via `const { <Name> } = window.<Namespace>` — get the exact `<Namespace>` from `_ds_manifest.json` (or by running the read-only checker, below). Do NOT `<script src>` a component `.jsx`/`.tsx` directly (its `export` is unreachable from inline script). A PascalCase `.jsx` without a `.d.ts` is still bundled and exposed on the namespace, but gets no props contract, adherence rules, or starting-point eligibility.
- **Design System tab cards**: put `<!-- @dsCard group="<Group>" viewport="<WxH>" name="<Label>" subtitle="…" -->` as the **first line** of any `.html`. The tab renders every tagged file, grouped verbatim by `group`. A component's directory needs one to supply its thumbnail. Write cards for tokens, fonts, brand — whatever you want visible.
- **Starting points** (the picker consuming projects see): opt-in only —
  - Screen: put `<!-- @startingPoint section="<Group>" subtitle="<one line>" viewport="<WxH>" -->` as the **first line** of any `.html` file.
  - Component: add `@startingPoint section="<Group>" subtitle="…" viewport="…"` to the JSDoc on the props interface in its `.d.ts`.

When the user says "create a starting point <X>", write an `.html` with the `<!-- @startingPoint … -->` comment as line 1. When they say "add <Component> as a starting point", add the JSDoc tag to its `.d.ts`. Without the tag, the compiler ignores the file for the picker.

After any edit, recompile (above), then run the **read-only design-system checker** to confirm the project is usable by consuming projects — it reports what the compiler found (namespace, components, cards, starting points, tokens, fonts) and any issues, and writes nothing:

```
node <skill>/agents/check-design-system.mjs designs/<project>
```

To run it as an isolated read-only subagent (recommended after a batch of edits), launch it with the prompt at [`../agents/design-system-checker.md`](../agents/design-system-checker.md) — see your harness reference (`references/<harness>.md`) for the exact launch tool. Fix what it reports and run again until clean.

**Finish by building the single-file review page** — once compiler + checker are clean, generate `designs/<project>/preview.html` (one self-contained interactive HTML with the Readme and every card) and re-generate it after any later edit:

```
node <skill>/agents/build-preview.mjs designs/<project>
```

Full doc: [`design-system-preview.md`](design-system-preview.md).

Once compiled, the `_ds_bundle.js` + `_ds_manifest.json` in this folder make it consumable by other projects (they load `window.<Namespace>.<Component>`).
