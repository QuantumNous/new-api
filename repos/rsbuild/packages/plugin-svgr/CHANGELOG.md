# @rsbuild/plugin-svgr

## 2.0.5 (2026-07-02)

### New features

- feat(plugin-svgr): support SVG text import attributes by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8047

### Document

- docs: update parallel loader docs by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7920

### Other changes

- chore: add bugs metadata to remaining plugin packages by @killernova in https://github.com/web-infra-dev/rsbuild/pull/7935

## 2.0.4 (2026-06-16)

### New features

- feat(plugin-svgr): add parallel option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7915

## 2.0.3 (2026-05-30)

### Document

- docs: improve plugin documentation by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7651

## 2.0.2 (2026-05-01)

### Bug fixes

- fix(plugin-svgr): handle string svg base64 encoding by @yifancong in https://github.com/web-infra-dev/rsbuild/pull/7581

## 2.0.1 (2026-04-22)

### New features

- feat(plugin-svgr): support publicPath options in internal assetLoader by @Timeless0911 in https://github.com/web-infra-dev/rsbuild/pull/7523

## 2.0.0 (2026-04-22)

### Breaking changes

- feat(plugin-svgr)!: drop Rsbuild v1 support by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7460
- feat(plugin-svgr)!: publish as pure ESM package by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7463

### Bug fixes

- fix: remove redundant main fields from package.json files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7338

### Refactor

- refactor(plugin-svgr): use internal asset loader by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7482
- refactor(plugin-svgr): use import.meta.dirname for loaders by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7483

## 1.3.1 (2026-03-11)

### Bug fixes

- fix: mark type-only plugin peers on @rsbuild/core as optional by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7316

## 1.3.0 (2026-01-27)

### New features

- feat(plugin-svgr): compatible with Rsbuild v1 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7061

## 1.2.4 (2026-01-15)

### Bug fixes

- fix(plugins): update peerDependencies to support Rsbuild v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6976

### Document

- docs: update download badge links in README files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6762

## 1.2.3 (2025-12-08)

### Bug fixes

- fix(plugin-svgr): disable React refresh for transformed SVG by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6724

### Document

- docs(plugin-svgr): add note about default exportType with mixedImport by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5907

## 1.2.2 (2025-08-04)

### Performance

- perf: bundle rspack-chain into main JS bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5684

### Other changes

- chore(workflow): enable npm trusted publishing by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5754

## 1.2.1 (2025-07-07)

### Other changes

- chore(plugin-svgr): improve SVGR options type by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5541

## 1.2.0 (2025-04-13)

### Bug fixes

- fix(plugin-svgr): SVGs generated with different hash by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5016

## 1.1.1 (2025-04-08)

### Bug fixes

- fix(plugin-svgr): unpin @rsbuild/plugin-react dependency version by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4988

## 1.1.0 (2025-04-03)

### Bug fixes

- fix(plugin-svgr): support for raw query by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4944

## 1.0.7 (2025-02-19)

### Document

- docs(plugin-svgr): explain base64 URL by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4168
- docs: update README files for plugin packages by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4590

## 1.0.6 (2024-12-07)

- No plugin-specific changes.

## 1.0.5 (2024-10-29)

- No plugin-specific changes.

## 1.0.4 (2024-10-14)

### New features

- feat(plugin-svgr): use Rslib to bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3698

## 1.0.3 (2024-09-29)

- No plugin-specific changes.

## 1.0.2 (2024-09-13)

### Document

- docs(plugin-svgr): correct named export guide by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3469

## 1.0.1 (2024-09-10)

### New features

- feat(plugin-svgr): support configure SVGR options by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1122
- feat(plugin-svgr): support for react query by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1783
- feat(plugin-svgr): add mixedImport option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1805
- feat(plugin-svgr): add support for mdx by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1822
- feat(plugin-svgr): add new query option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1909
- feat(plugin-svgr): add excludeImporter option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2019

### Performance

- perf(plugin-svgr): prebundle url-loader to reduce dependencies by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1243
- perf(plugin-svgr): reuse SWC loader to improve perf by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1070
- perf(plugin-svgr): merge duplicated rules by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1652

### Bug fixes

- fix(plugin-svgr): missing file-loader peer dependency by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1239
- fix(plugin-svgr): failed to reuse SWC react options by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1263
- fix(plugin-svgr): prefer using svgrOptions.exportType option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1789
- fix(plugin-svgr): failed to resolve file-loader by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2273
- fix(plugin-svgr): dedupe SVGO plugins config by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2984

### Document

- docs(plugin-svgr): add tip for named export by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1687
- docs(plugin-svgr): add react query guide by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1786
- docs(plugin-svgr): add mixed import document by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1820
- docs(plugin-svgr): typo of export type by @Soon in https://github.com/web-infra-dev/rsbuild/pull/1982

## 1.0.0 (2023-11-22)

### Other changes

- First stable release of `@rsbuild/plugin-svgr`.
