<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Package manager

- Use `pnpm` for dependency and script commands.
- Run the repository-pinned shadcn CLI with `pnpm exec shadcn`.
- Do not use `npx shadcn@latest`; it can silently use a CLI version different from the one declared by this project.

# shadcn component workflow

This repository is already initialized for shadcn with Base UI, React Server Components, Tailwind CSS v4, and Tabler icons. Treat `components.json` and the output of `pnpm exec shadcn info --json` as the source of truth for the active style, base, aliases, icon library, and installed components.

For every task that uses, adds, replaces, or troubleshoots a shadcn component, follow this workflow in order.

### Step 1: Confirm the project configuration

Run this when the project configuration is relevant:

```bash
pnpm exec shadcn info --json
```

### Step 2: Discover component names

Search the configured registry instead of guessing component names:

```bash
pnpm exec shadcn search @shadcn -q "component or behavior"
```

Use namespaced registry names from `components.json` when a non-default registry is needed. The `list` command is an alias for `search`.

### Step 3: Query official documentation

Query documentation before writing component usage code:

```bash
pnpm exec shadcn docs <component>
pnpm exec shadcn docs <component> --json
```

The command resolves documentation and example URLs for the project's configured base. Read the returned official `ui.shadcn.com` documentation with an available browser or fetch tool before using the component. Follow the documented API, composition model, accessibility guidance, and examples for the active Base UI variant. Do not substitute Radix UI or React Aria documentation unless `components.json` is changed to that base.

### Step 4: Inspect registry metadata

Inspect registry availability and installation metadata when needed:

```bash
pnpm exec shadcn view <component>
```

Use `view` to confirm the registry item, dependencies, and target files. It is not a replacement for the official documentation returned by `docs`.

### Step 5: Install through the CLI

Preview registry changes before installation, then install through the CLI:

```bash
pnpm exec shadcn add <component> --dry-run
pnpm exec shadcn add <component> --yes
```

Add multiple components in one command when appropriate. Let the CLI install required packages and place files according to the aliases in `components.json`.

### Step 6: Implement from official documentation

Implement usage from the official documentation, adapting only layout, copy, styling, and application-specific behavior. Use `@tabler/icons-react` because it is the configured icon library.

### Step 7: Validate

Validate the result with the relevant project checks, normally `pnpm lint` and `pnpm build`.

## Source-code and installation rules

- Do not read `components/ui/*.tsx` to learn a component's API, available props, composition, or usage examples. Query `shadcn docs` and read the returned official documentation instead.
- Do not infer usage from registry implementation source returned by `view`, `add --dry-run`, or an online source file.
- Local component source may be inspected only when the task explicitly requires modifying a locally installed component or diagnosing behavior that remains unexplained after reading the official documentation. In that case, read the documentation first and keep source inspection limited to the relevant file.
- Do not manually create or copy a component into `components/ui` when an appropriate registry component exists. Install it with `pnpm exec shadcn add`.
- Do not manually install underlying Base UI primitives when the shadcn registry item manages those dependencies.
- Do not overwrite an existing component blindly. Use `pnpm exec shadcn add <component> --diff` first and preserve project-specific changes. Use `--overwrite` only when replacement is explicitly intended.
- Do not run `shadcn init`, `create`, `apply`, `migrate`, `eject`, `add --all`, or registry build commands unless the user explicitly requests the corresponding project-wide operation.
- If the CLI documentation lookup is unavailable, report that limitation instead of treating local component source as official usage documentation.

# Feature component organization

- Group section-specific compound components in a folder named after the section under `components/`.
- Hero components belong in `components/hero/`. Use concise role-based filenames such as `hero.tsx`, `hero-cards.tsx`, and `animated-beam.tsx`; do not place them at the `components/` root with redundant names such as `hero-section`, `hero-link-cards`, or `animated-beam-showcase`.
- Keep reusable registry primitives in `components/ui/`; compose them from the appropriate feature folder instead of moving or duplicating them.
