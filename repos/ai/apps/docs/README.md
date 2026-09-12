# AI SDK docs

This is the package-backed Geistdocs application for `ai-sdk.dev`.

## Local development

Use Node.js 22 or newer from the repository root:

```bash
pnpm install
pnpm --filter ai-sdk-docs dev:site
```

The content sync generates `apps/docs/content/` from two reviewed sources:

- v7 documentation from this checkout's `content/docs/` directory.
- v6 documentation from the commit pinned in
  `scripts/sync-content.mjs`.

Generated content, Fumadocs source files, and Next.js output are ignored by
Git. Run the complete local validation with:

```bash
pnpm --filter ai-sdk-docs validate:site
```

## Vercel project

The Vercel project must use:

- Root Directory: `apps/docs`
- Include source files outside the Root Directory: enabled
- Node.js: a version supported by the repository

The outside-root setting is required because the content sync reads the
repository's `content/docs/` directory and Git metadata.

Ask AI, feedback, and edit-source links remain disabled until their routes and
source-path mapping are ready. Provider, cookbook, and example links continue
to the existing production site while those route families remain outside this
application.
