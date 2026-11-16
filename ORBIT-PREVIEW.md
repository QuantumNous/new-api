# Temporary GitHub Pages preview

The owner authorized a temporary GitHub Pages design preview during Phase 1. This is separate from the Go gateway and is not a production API deployment.

The preview uses `web/rsbuild.preview.config.ts` and `web/src/preview/main.tsx`. It renders the shared Orbit homepage, planned model catalog, documentation, and planned-program pages. A visible notice identifies its limitations. Login, registration, dashboard, API key management, and the configured gateway catalog lead to an explanatory preview-only page. No authentication is simulated, no credentials are embedded, and no backend is exposed.

The production entry point, generated application router, backend APIs, and role checks do not import the preview entry point or its presentation-only status adapter. Preview-only module aliases are confined to the separate preview build configuration.

## Build

```bash
source .cache/orbit/env.sh
cd web
bun run typecheck
bun run build:preview
```

Publish the generated `web/dist-preview` files to the dedicated `gh-pages` branch. Preserve that branch's history with ordinary commits and pushes. Copy `index.html` to `404.html` for client-side deep links, add `.nojekyll`, and include `LICENSE`, `NOTICE`, and third-party notices. Enable repository Pages with source `gh-pages` and path `/`.

The repository subpath `/BEU-Developer-Orbit/` is configured explicitly in the static router, asset prefix, and preview brand asset URLs. The preview is expected at <https://pratik2k25.github.io/BEU-Developer-Orbit/> after GitHub completes its Pages build; publication must be verified before reporting it live.

Updates become visible after a new preview build is committed and pushed and GitHub finishes publishing. This is not instant hot reload. The cloud development server remains on port 3002; access to that server from a separate browser requires platform port forwarding.

To remove the temporary preview, disable Pages in repository Settings → Pages or delete the Pages site through the repository API. Removing the preview does not require merging the feature branch.

Validation and final review evidence will be recorded in `ORBIT-PHASE1-VALIDATION.md` and `ORBIT-PHASE1-REPORT.md` when the checks finish. No feature branch merge is authorized.
