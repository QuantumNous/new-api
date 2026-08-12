# Vendored Upstream Source

The directories below are squashed Git subtrees containing source that matches the behavior-defining dependencies used by this project. They exist so agents can inspect real implementations, tests, and examples without relying on isolated snippets.

They are reference-only. Application code must keep importing the packages declared by the normal manifests; nothing under `repos/` is part of the build.

## Inventory

| Prefix | Application dependency | Upstream | Pinned ref |
| --- | --- | --- | --- |
| `repos/gin` | `github.com/gin-gonic/gin v1.9.1` | `https://github.com/gin-gonic/gin.git` | `v1.9.1` |
| `repos/gorm` | `gorm.io/gorm v1.25.2` | `https://github.com/go-gorm/gorm.git` | `v1.25.2` |
| `repos/go-redis` | `github.com/go-redis/redis/v8 v8.11.5` | `https://github.com/redis/go-redis.git` | `v8.11.5` |
| `repos/webauthn` | `github.com/go-webauthn/webauthn v0.14.0` | `https://github.com/go-webauthn/webauthn.git` | `v0.14.0` |
| `repos/testify` | `github.com/stretchr/testify v1.11.1` | `https://github.com/stretchr/testify.git` | `v1.11.1` |
| `repos/react` | `react 19.2.7` / `react-dom 19.2.7` | `https://github.com/facebook/react.git` | `v19.2.7` |
| `repos/base-ui` | `@base-ui/react 1.6.0` | `https://github.com/mui/base-ui.git` | `v1.6.0` |
| `repos/tanstack-query` | `@tanstack/react-query 5.101.2` | `https://github.com/TanStack/query.git` | `@tanstack/react-query@5.101.2` |
| `repos/tanstack-router` | `@tanstack/react-router 1.170.17` | `https://github.com/TanStack/router.git` | `@tanstack/react-router@1.170.17` |
| `repos/tanstack-table` | `@tanstack/react-table 8.21.3` | `https://github.com/TanStack/table.git` | `v8.21.3` |
| `repos/tanstack-virtual` | `@tanstack/react-virtual 3.14.5` | `https://github.com/TanStack/virtual.git` | `@tanstack/react-virtual@3.14.5` |
| `repos/react-hook-form` | `react-hook-form 7.80.0` | `https://github.com/react-hook-form/react-hook-form.git` | `v7.80.0` |
| `repos/zod` | `zod 4.4.3` | `https://github.com/colinhacks/zod.git` | `v4.4.3` |
| `repos/i18next` | `i18next 26.3.4` | `https://github.com/i18next/i18next.git` | `v26.3.4` |
| `repos/react-i18next` | `react-i18next 17.0.8` | `https://github.com/i18next/react-i18next.git` | `v17.0.8` |
| `repos/zustand` | `zustand 5.0.14` | `https://github.com/pmndrs/zustand.git` | `v5.0.14` |
| `repos/tailwindcss` | `tailwindcss 4.3.2` | `https://github.com/tailwindlabs/tailwindcss.git` | `v4.3.2` |
| `repos/rsbuild` | `@rsbuild/core 2.1.4` | `https://github.com/web-infra-dev/rsbuild.git` | `v2.1.4` |
| `repos/ai` | `ai 7.0.14` | `https://github.com/vercel/ai.git` | `ai@7.0.14` |
| `repos/vchart` | `@visactor/vchart 2.1.2` | `https://github.com/VisActor/VChart.git` | `ebf4b2086f6babbc3f16a71b4935124c61de098b` (`npm` package `gitHead`) |

Utility libraries, icon packs, media parsers, provider SDKs, and transitive dependencies are intentionally not copied wholesale. Add one when its implementation materially affects work being done and local source evidence will improve correctness.

## Updating a Subtree

Keep the worktree clean. First update the normal dependency manifest and lockfile, identify the matching upstream tag or package `gitHead`, then run:

```sh
git subtree pull \
  --prefix=repos/<name> \
  <upstream-url> \
  <matching-ref> \
  --squash
```

Afterward, update the inventory row and any affected files under `agent-patterns/`. Never patch a subtree to make application code work; fix the application or contribute the change upstream.

The root `.gitattributes` disables line-ending normalization for `repos/**` so subtree contents remain byte-for-byte compatible with upstream and marks the directory as vendored for language statistics.
