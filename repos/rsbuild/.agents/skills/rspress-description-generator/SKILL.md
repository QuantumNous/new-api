---
name: rspress-description-generator
description: Generate and maintain description frontmatter for Rspress documentation files (.md/.mdx). Use when a user wants to add SEO descriptions, improve search engine snippets, generate llms.txt metadata, prepare docs for AI summarization, or batch-update frontmatter across an Rspress doc site. Also use when adding new documentation pages to an Rspress project — every new doc file needs a description.
---

# Rspress Description Generator

The `description` field in Rspress frontmatter generates `<meta name="description" content="...">` tags, which are used for search engine snippets, social media previews, and AI-oriented formats like llms.txt.

## Step 1 — Locate the docs root

1. Find the Rspress config file. Search for `rspress.config.ts`, `.js`, `.mjs`, or `.cjs`. It may be at the project root or inside a subdirectory like `website/`.
2. Read the config and extract the `root` option.
   - The value might be a plain string (`root: 'docs'`) or a JS expression (`root: path.join(__dirname, 'docs')`). In either case, determine the resolved directory path.
   - If `root` is set, resolve it relative to the config file's directory.
   - If `root` is not set, default to `docs` relative to the config file's directory.
3. Confirm the directory exists. If neither `docs` nor the configured root exists, check for `doc` as a fallback.

## Step 2 — Detect i18n structure

Rspress i18n projects place language subdirectories (e.g., `en/`, `zh/`) directly under the docs root:

```
docs/
├── en/
│   ├── guide/
│   └── index.md
└── zh/
    ├── guide/
    └── index.md
```

Check if the docs root contains language subdirectories (two-letter codes like `en`, `zh`, `ja`, `ko`, etc.). If so, process each language directory separately — the description language should match the content language.

If there are no language subdirectories, treat the entire docs root as a single-language site.

## Step 3 — Scan and process files

Glob for `**/*.md` and `**/*.mdx` under the docs root. Exclude:

- `node_modules`, build output (`doc_build`, `.rspress`, `dist`)
- `_meta.json` / `_nav.json` (sidebar/nav config files, not doc pages)
- `**/shared/**` directories (reusable snippets included via `@import`, not standalone pages)

For each file:

1. **Read the file.**
2. **Check for existing `description` in frontmatter.** If it exists and is non-empty, skip.
3. **Check `pageType` in frontmatter.** For `home` pages, derive the description from the `hero.text` / `hero.tagline` fields or the features list, not from body content.
4. **Generate a description** following the writing guidelines below.
5. **Insert `description` into frontmatter:**
   - If the file has frontmatter with a `title` field, insert `description` on the line after `title`.
   - If the file has frontmatter without `title`, insert `description` as the first field.
   - If the file has no frontmatter block, add one:

     ```yaml
     ---
     description: Your generated description here
     ---
     ```

### YAML formatting

Most descriptions can be bare YAML strings:

```yaml
description: Step-by-step guide to setting up your first Rspress site
```

If the description contains colons, quotes, or other special YAML characters, wrap in double quotes:

```yaml
description: 'API reference for Rspress configuration: plugins, themes, and build options'
```

## Step 4 — Batch processing

For sites with many files, use parallel agent calls to process independent files simultaneously. Group by directory (e.g., all files in `guide/`, then all in `api/`) to maintain focus and consistency within each section.

After processing all files, do a quick scan to ensure no files were missed — re-glob and check for any remaining files without `description`.

## Description Writing Guidelines

The description serves three audiences: search engines (Google snippet), AI systems (llms.txt, summarization), and humans (scanning search results). A good description helps all three.

### Rules

- **Length**: 50–160 characters. Under 50 is too vague for search engines; over 160 gets truncated in snippets.
- **Language**: Match the document content. Chinese docs get Chinese descriptions, English docs get English descriptions.
- **Be direct**: State what the page covers. Avoid starting with "This document", "This page", "Learn about" — jump straight to the substance.
- **Be specific**: Mention concrete technologies, APIs, or concepts the page covers. "Configure Rspress plugins for search, analytics, and internationalization" beats "How to use plugins."
- **No markdown**: Plain text only, no formatting syntax.

### Examples

**Good:**

| Content                    | Description                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| Plugin development guide   | Create custom Rspress plugins using the Node.js plugin API and runtime hooks |
| MDX component usage        | Import and use React components in MDX documentation files                   |
| Rspress 快速开始           | 从安装到本地预览，搭建 Rspress 文档站点的完整流程                            |
| 主题配置                   | 自定义 Rspress 主题的导航栏、侧边栏、页脚和暗色模式                          |
| Home page (pageType: home) | Rspress documentation framework — fast, MDX-powered static site generator    |

**Bad:**

| Description                                             | Why                                              |
| ------------------------------------------------------- | ------------------------------------------------ |
| "About plugins"                                         | Too vague — which plugins? what about them?      |
| "This page explains how to configure the Rspress theme" | Wastes characters on "This page explains how to" |
| "Learn everything about Rspress!"                       | Marketing fluff, says nothing specific           |

## Documentation

- Frontmatter fields: <https://rspress.rs/api/config/config-frontmatter>
- Basic config (`root` option): <https://rspress.rs/api/config/config-basic>
- Full Rspress docs: <https://rspress.rs/llms.txt>
