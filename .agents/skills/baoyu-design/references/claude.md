# Claude Code tools — reference

The harness-specific tools `system-prompt.md` relies on, for when you are running inside **Claude Code**. The main prompt only names capabilities ("ask the user", "preview", "screenshot", "debug"); this doc gives the exact Claude Code tool, signature, and call pattern. Generic tools (`Bash`, `Read`/`Write`/`Edit`/`Glob`, `gh`) are the same everywhere and aren't covered here.

## Web tool → Claude Code tool map

The upstream prompt references Claude.ai web tools that do not exist in Claude Code. Substitute as follows everywhere — prose and code alike:

| Web tool | Claude Code equivalent |
|---|---|
| `questions_v2` | `AskUserQuestion` (returns answers inline; up to 4 questions/call, follow-up call if more needed) |
| `done`, `fork_verifier_agent` | `SendUserFile` + the Claude Preview MCP; an `Agent` subagent (prompt: [`../agents/fork-verifier-agent.md`](../agents/fork-verifier-agent.md)) for thorough checks — see "Verification & debug" below |
| `write_file` (and its `asset:` param) | `Write` — drop the "asset review pane" concept entirely |
| `copy_files` | `Bash cp` |
| `read_file`, `list_files`, `view_image` | `Read` (it renders images too), `Glob` / `Bash ls`, `Grep` |
| `show_to_user` | `SendUserFile` (or `open <path>` for a self-contained file); for final deliverables also surface a screenshot and give the served `http://localhost:<port>/...` URL so the user can open and interact with the live result — Claude Code has no user-visible agent browser, so delivery is file + screenshot + URL (see "Showing files & preview") |
| `eval_js`, `eval_js_user_view`, `run_script` | `Bash`; the Claude Preview MCP `preview_eval` for in-page JS |
| `web_fetch`, `web_search` | `WebFetch`, `WebSearch` |
| `copy_starter_component` | `Bash cp starter-components/<file> designs/<project>/` (or `Read` + adapt) |
| `invoke_skill("X")` / `invoke the "X" skill` | `Read` the matching `built-in-skills/<file>.md` |
| `gen_pptx` | `Bash`: serve the deck over HTTP, write the gen_pptx input object to a JSON file, then `node <skill>/agents/gen-pptx/dist/cli.mjs --url <servedDeckUrl> --config <jsonPath> --out <dir>` — see "Exporting to PPTX" below |
| `/projects/<projectId>/<path>` | ordinary filesystem paths (relative to cwd, or absolute) |

_Video export has no web-tool equivalent — see "Exporting to video" below._

## AskUserQuestion (clarifying questions)

Replaces `questions_v2`. `AskUserQuestion` **returns the user's answers inline** — ask, then continue once they respond. It shows up to 4 questions per call; for a large new project, ask a focused round and make a follow-up call if you need more.

- A remembered preference may be offered as a *suggested* default inside a question, but the user still confirms.
- Prefer it over listing choices as text bullets in your reply.
- The project-setup prompts — **where to save** the project and **which design system(s)** to use (a multiSelect; see [`use-design-system.md`](../built-in-skills/use-design-system.md)) — are ordinary `AskUserQuestion` calls.

## Showing files & preview

To surface a deliverable, use `SendUserFile` with the file path (works for any file type — HTML, images, text). Reading a file does NOT show it to the user.

**For final design/prototype deliverables, treat the preview as part of delivery, not only private validation.** Claude Code has no shared, user-visible browser to flip on (the Claude Preview MCP is agent-driven), so make the result visible by handing it off: `SendUserFile` the deliverable, surface a final `preview_screenshot` (it renders inline in the transcript), and give the user the served `http://localhost:<port>/<project>/<file>.html` URL so they can open and interact with the live prototype in their own browser. Do this after verification, unless the user asked you not to.

To open a prototype in a browser — whether for the user to interact with or for you to preview/screenshot it — **always serve it over HTTP and load the `http://localhost:<port>/<project>/<file>.html` URL; do not open the HTML directly from `file://`.** A multi-file prototype (an HTML entry that loads `<script type="text/babel" src="…jsx">` components) only works over HTTP — the browser blocks cross-origin local script reads — and self-contained single files go through the same served URL so preview and screenshots stay consistent.

Serve the whole `designs/` directory once (one server for all projects) and reuse it. Preview through the Claude Preview MCP, which serves from a named config in `.claude/launch.json`: define a single `designs` server that serves the whole `designs/` directory (`python3 -m http.server 4311 --directory designs`) so every project shares one server.

## Verification & debug

When the deliverable is ready, surface it (`SendUserFile`), preview it over the served URL, confirm it loads cleanly, and fix any errors before finishing. The user should always land on a view that doesn't crash.

Preview through the Claude Preview MCP:

1. `mcp__Claude_Preview__preview_start` with `{name: "designs"}` (the `designs` config in `.claude/launch.json`).
2. Open `http://localhost:<port>/<project>/<file>.html`.
3. `mcp__Claude_Preview__preview_console_logs` to catch JS errors.
4. `mcp__Claude_Preview__preview_screenshot` to inspect layout. Fix any errors and surface it again.
5. When the deliverable is ready, hand off the result: `SendUserFile` the file, surface the final `preview_screenshot`, and give the user the served URL so they can open and interact with it directly.

For thorough or directed checks ("screenshot and check the spacing"), spawn an `Agent` subagent to load the file, take screenshots, probe the JS, and report back — useful when you don't want to clutter your own context. Use the prompt in [`../agents/fork-verifier-agent.md`](../agents/fork-verifier-agent.md) (pass the project dir, the file path(s), and the served URL).

**Preview-harness gotchas (React + Babel prototypes)** — quirks of the Claude Preview MCP, not your code:

- `preview_click` does not reach React's delegated `onClick` (React 18 `createRoot` delegates from the root container). To fire a handler, use `preview_eval`: find the node, read its `__reactProps$*` key, and call `el[propKey].onClick({stopPropagation(){},preventDefault(){}})`. Real browser clicks are fine; this is harness-only.
- Global `keydown` listeners DO fire via `window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true,bubbles:true}))` — use this to test ⌘K / Esc / shortcuts.
- The screenshot surface desyncs after an in-page `location.reload()` or repeated custom resizes (the window renders tiny in a corner). Resync via `preview_resize` to a preset then back to your size; prefer `location.href = …` over `reload()`.

**If the preview MCP is unavailable,** fall back by file type. A fully self-contained single file can be opened with `open <path>` (`file://`); a multi-file prototype (`<script src="…jsx">`) will NOT load over `file://` and needs HTTP — start the `designs` server yourself (`python3 -m http.server 4311 --directory designs`) and open the URL, or spawn an `Agent` to verify. Never leave the user on a view that silently failed to load its components.

## Design-system checker subagent

Only when **authoring a design system** — the compiler (`compile-design-system.mjs`) and checker (`check-design-system.mjs`) commands and the full flow live in [`design-system-authoring-guide.md`](../built-in-skills/design-system-authoring-guide.md). Both are plain `Bash` `node <skill>/agents/…` calls and run inline. Harness-specific bit: to run the read-only checker as an **isolated subagent**, spawn an **`Agent`** (any read-capable type, e.g. `Explore` or `general-purpose`) with the prompt in [`../agents/design-system-checker.md`](../agents/design-system-checker.md), passing the project directory and this skill's `agents/` path — it only runs `check-design-system.mjs` and relays output; it must not edit files or compile.

When **consuming a design system** in a regular project, the importer (`import-design-system.mjs`) is likewise a plain `Bash` `node <skill>/agents/import-design-system.mjs <dsDir> <projectDir> [--primary]` call that runs inline — full flow in [`use-design-system.md`](../built-in-skills/use-design-system.md). No subagent is needed.

## Exporting to PPTX (gen_pptx)

The web `gen_pptx` tool does not exist in Claude Code. Both export docs ([`export-as-pptx-editable.md`](../built-in-skills/export-as-pptx-editable.md), [`export-as-pptx-screenshots.md`](../built-in-skills/export-as-pptx-screenshots.md)) say "Call `gen_pptx`" — here that means a local CLI under this skill that drives a headless Chromium (Playwright) and writes the `.pptx` to disk. The input JSON is **exactly** the object those docs define (`mode`/`width`/`height`/`slides`/`hideSelectors`/`resetTransformSelector`/`googleFontImports`/`fontSwaps`/`filename`); this section only covers how to invoke it. **Default to the editable export** (omit `mode`, or set `"mode":"editable"`); pass `"mode":"screenshots"` only when the user explicitly wants pixel-perfect, non-editable image slides.

**One-time setup** (skip if `agents/gen-pptx/node_modules` and `dist/` already exist):

```bash
cd <skill>/agents/gen-pptx && npm install && npx playwright install chromium && npm run build
```

**Each export:**

1. **Serve the deck over HTTP** — the CLI needs an `http(s)` URL, not `file://` (deck-stage and multi-file decks require a served origin). Reuse the one `designs` server (`python3 -m http.server 4311 --directory designs`); the deck is then at `http://localhost:<port>/<project>/<file>.html`.
2. **Write the gen_pptx input object to a JSON file** (e.g. `/tmp/<project>-pptx.json`) — same schema as the export docs.
3. **Run the CLI:**

   ```bash
   node <skill>/agents/gen-pptx/dist/cli.mjs --url <servedDeckUrl> --config <jsonPath> --out designs/<project>
   ```

   `--config -` reads the JSON from stdin. `--out` defaults to the cwd; pass the project dir so the `.pptx` lands beside the deck. The final path is `<out>/<filename>.pptx`.
4. **Read the printed JSON** (one line on stdout): `{ ok, file, slides, bytes, flags: [{code, message}], warnings, speakerNotes }`. The `flags[].code` values are the same diagnostics the export docs describe (`duplicate_adjacent`, `slide_size_mismatch`, `no_speaker_notes`, …) — interpret them per those docs and **do not relay the codes verbatim** to the user. `warnings` is a (usually empty) list of build-time strings — slides the editable converter couldn't fully represent, unreachable media, or notes that failed to attach; surface them in plain language only if non-empty. On failure the line is `{ ok: false, error }` instead. Exit code is `0` on success (even with warning flags), `64` for a usage/config error, `1` for a runtime failure (a friendly setup hint prints to stderr if Playwright/Chromium is missing).

Then surface the `.pptx` with `SendUserFile`.

## Exporting to video

There is no web `gen_video` tool — in Claude Code, [`export-as-video.md`](../built-in-skills/export-as-video.md) means a local CLI under this skill that drives a headless Chromium (Playwright), seeks the animation's timeline bridge frame-by-frame, and pipes PNG frames to **ffmpeg** to write the file. The input JSON is **exactly** the object that doc defines (`width`/`height`/`duration`/`fps`/`format`/`bridgeGlobal`/…); this section only covers how to invoke it.

**One-time setup** (skip if `agents/gen-video/node_modules` and `dist/` already exist):

```bash
cd <skill>/agents/gen-video && npm install && npx playwright install chromium && npm run build
```

ffmpeg must also be on `PATH` (`brew install ffmpeg` on macOS, `apt install ffmpeg` on Debian/Ubuntu). The CLI preflights for it and prints a one-time-setup hint if it's missing.

**Each export:**

1. **Serve the animation over HTTP** — the CLI needs an `http(s)` URL, not `file://` (multi-file `<script src>` animations require a served origin). Reuse the one `designs` server (`python3 -m http.server 4311 --directory designs`); the page is then at `http://localhost:<port>/<project>/<file>.html`. The CLI appends the capture-mode query param itself.
2. **Write the gen_video input object to a JSON file** (e.g. `/tmp/<project>-video.json`) — same schema as the export doc. For a current `animations.jsx` Stage, `{ "width": 1920, "height": 1080, "filename": "…" }` is enough; for an older/hand-rolled timeline set `bridgeGlobal` (e.g. `"__ahe"`) and pass `hideSelectors` + `resetTransformSelector`.
3. **Run the CLI:**

   ```bash
   node <skill>/agents/gen-video/dist/cli.mjs --url <servedUrl> --config <jsonPath> --out designs/<project>
   ```

   `--config -` reads the JSON from stdin. `--out` defaults to the cwd; pass the project dir so the video lands beside the animation. The final path is `<out>/<filename>.<mp4|webm|gif>`. Long high-fps exports take minutes (every frame is a real screenshot) — run a `startMs`/`endMs` sub-range to iterate, then the full range.
4. **Read the printed JSON** (one line on stdout): `{ ok, file, frames, fps, duration, width, height, bytes, flags: [{code, message}], warnings }`. The `flags[].code` values (`capture_mode_off`, `duplicate_frames`, `fonts_timeout`, `zero_duration`) are diagnostics — interpret them per [`export-as-video.md`](../built-in-skills/export-as-video.md) and **do not relay the codes verbatim**. On failure the line is `{ ok: false, error }` (e.g. no timeline bridge found, or ffmpeg errored). Exit code is `0` on success (even with warning flags), `64` for a usage/config error, `1` for a runtime failure.

Then surface the video with `SendUserFile`.
