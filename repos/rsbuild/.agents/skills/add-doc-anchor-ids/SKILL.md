---
name: add-doc-anchor-ids
description: Align Rspress heading anchor IDs between English and Chinese docs. Use for MDX `\{#...}` anchors, shortened hashes, redundant anchors, or dead links.
---

# Add Doc Anchor IDs

Use this skill for Rspress docs mirrored under `website/docs/en` and `website/docs/zh`.

## Rules

- Treat the English document as the source for stable anchor IDs.
- If an English heading has 4 words or fewer, use the default Rspress anchor generated from the English heading.
- If an English heading has more than 4 words, choose a shorter semantic anchor ID and add that same custom ID to both English and Chinese headings.
- Do not add custom IDs that match Rspress default output. For example, keep `### parallel`, not `### parallel \{#parallel}`.
- In Chinese docs, add a custom ID only when the Chinese default anchor would differ from the desired English ID.
- In Chinese docs, remove custom IDs from pure English headings when the custom ID equals the Rspress default.
- MDX custom anchor syntax must be escaped: `\{#anchor-id}`.
- Keep changes limited to `.md`/`.mdx` documentation files unless the user explicitly asks otherwise.
- Do not add persistent validation or update scripts as part of this skill's work.

## Workflow

1. Inspect the current branch and work tree before editing:

   ```bash
   git branch --show-current
   git status --short
   ```

2. Find relevant custom anchors and hash links:

   ```bash
   rg -n -F '\{#' website/docs/en website/docs/zh --glob '*.mdx'
   rg -n "\]\([^)]*#[A-Za-z0-9_-]+[^)]*\)" website/docs/en website/docs/zh --glob '*.mdx'
   rg -n "href=['\"][^'\"]*#[A-Za-z0-9_-]+" website/docs/en website/docs/zh --glob '*.mdx'
   ```

3. For each edited or referenced document pair, compare the English file with its Chinese counterpart at the same locale-relative path:

   ```text
   website/docs/en/guide/configuration/rsbuild.mdx
   website/docs/zh/guide/configuration/rsbuild.mdx
   ```

4. For each heading pair, decide the desired anchor:
   - English heading has an intentional custom ID: use that ID in both locales.
   - English heading has no custom ID and has 4 words or fewer: use the English default ID.
   - English heading has no custom ID and has more than 4 words: choose a shorter semantic ID and add it to both locales.
   - Chinese heading is pure English and its custom ID equals the default ID: remove the custom ID.

5. Apply edits directly in the affected `.md`/`.mdx` files. Examples:

   ```mdx
   ## 指定配置文件 \{#specify-config-file}
   ```

   ```mdx
   ## Dev server and client communication \{#dev-server-client-communication}

   ## 开发服务器与客户端通信 \{#dev-server-client-communication}
   ```

6. Update all links that point to an old hash:

   ```mdx
   [指定配置文件](/guide/configuration/rsbuild#specify-config-file)
   ```

7. Validate the result:

   ```bash
   git diff --check
   changed_docs=$(git diff --name-only -- '*.md' '*.mdx')
   if [ -n "$changed_docs" ]; then
     printf '%s\n' "$changed_docs" | xargs pnpm dlx cspell --no-progress
     printf '%s\n' "$changed_docs" | xargs pnpm exec oxfmt
   fi
   ```

8. If there is an existing repository command for docs link checking or docs build, run it. Otherwise, inspect changed hashes with `rg` and verify each target heading exists in the target file.

## Rspress Anchor Notes

- Rspress/GitHub-style anchors lowercase headings and remove punctuation such as `.` from API names; verify these IDs instead of guessing.
- Some characters are preserved by the actual Rspress slugger, such as underscores in `BASE_URL`; avoid guessing when a link already works.
- Duplicate headings get numbered suffixes like `#environment-api-1`. Preserve those suffixes when the English page relies on them.
- A custom anchor changes the actual target ID, so update same-page and cross-page links that still point to the old generated hash.
