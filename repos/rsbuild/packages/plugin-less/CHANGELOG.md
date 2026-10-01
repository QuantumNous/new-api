# @rsbuild/plugin-less

## 2.0.1 (2026-07-02)

### New features

- feat(core): support CSS text import attributes by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8042
- feat(core): support asset text import attributes by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8046

### Document

- docs: add plugin changelogs by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7970

## 2.0.0 (2026-06-21)

### Breaking changes

- feat(plugin-less)!: publish as pure ESM by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7957
- feat(plugin-less)!: drop Rsbuild v1 support by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7959

### Document

- docs: update parallel loader docs by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7920

### Other changes

- chore: add bugs metadata to remaining plugin packages by @killernova in https://github.com/web-infra-dev/rsbuild/pull/7935
- chore(deps): upgrade reduce-configs catalog to v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7960

## 1.6.4 (2026-05-30)

### Bug fixes

- fix(plugin-styles): remove unused reduce-configs dep by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7580
- fix(core): support url query with params by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7572

## 1.6.3 (2026-04-28)

### New features

- feat(plugin-less): support Less URL query by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7557

### Bug fixes

- fix: remove redundant main fields from package.json files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7338

## 1.6.2 (2026-03-12)

### Bug fixes

- fix(plugin-less): update less and use default implementation by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7323

## 1.6.1 (2026-03-11)

### Bug fixes

- fix(plugin-less): `parallelLoader` config is no longer needed in Rspack v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7166
- fix: mark type-only plugin peers on @rsbuild/core as optional by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7316
- fix(plugin-less): update less to ^4.6.2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7318

## 1.6.0 (2026-01-27)

### New features

- feat(plugin-less): compatible with Rsbuild v1 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7054

## 1.5.1 (2026-01-15)

### Bug fixes

- fix(plugins): update peerDependencies to support Rsbuild v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6976

### Document

- docs: update download badge links in README files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6762

## 1.5.0 (2025-08-26)

### Bug fixes

- fix: enhance raw query regex to support more patterns by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5938
- fix: enhance inline query regex to support more patterns by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5939

### Refactor

- refactor(css-plugins): inherit CSS options from the built-in rule by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5940

## 1.4.0 (2025-08-10)

### New features

- feat(plugin-less): support for parallel loader execution by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5805

## 1.3.2 (2025-08-04)

### Other changes

- chore(workflow): enable npm trusted publishing by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5754

## 1.3.1 (2025-07-28)

### Performance

- perf: bundle rspack-chain into main JS bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5684

### Bug fixes

- fix(plugin-less): pin less version to 4.3.0 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5690

## 1.3.0 (2025-07-20)

### Other changes

- chore(deps): update dependency less to ^4.4.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5630

## 1.2.5 (2025-07-07)

### New features

- feat(plugin-less): add type for `lessLogAsWarnOrErr` option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5427

## 1.2.4 (2025-05-07)

### New features

- feat(plugin-less): update webpackImporter type to support 'only' by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5181
- feat(plugin-less): improve loader options type with JSDoc by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5182

## 1.2.3 (2025-05-06)

### Other changes

- chore(deps): update dependency less-loader to ^12.3.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5149

## 1.2.2 (2025-04-06)

### Other changes

- chore(deps): update dependency less to ^4.3.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4967

## 1.2.1 (2025-03-29)

### Bug fixes

- fix: make CSS preprocessor plugins compat with Rsbuild 1.2 by @colinaaa in https://github.com/web-infra-dev/rsbuild/pull/4909
- fix: improve inline rules in CSS preprocessor plugins by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4914

## 1.2.0 (2025-03-28)

### New features

- feat(plugin-less): add support for raw query by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4844
- feat: add types for raw imports of CSS preprocessors by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4846
- feat(plugin-less): add support for inline query by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4859

## 1.1.1 (2025-02-19)

### Document

- docs: update README files for plugin packages by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4590

### Other changes

- chore(deps): update dependency reduce-configs to ^1.1.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4042

## 1.1.0 (2024-10-29)

### New features

- feat(plugin-less): allow to register multiple times by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3842
- feat(plugin-less): add `include` option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3843

## 1.0.3 (2024-10-26)

### Bug fixes

- fix(plugin-less): lessLoaderOptions.lessOptions.plugins has lose it's prototype. by @Sang-Sang33 in https://github.com/web-infra-dev/rsbuild/pull/3815

## 1.0.2 (2024-10-14)

### Bug fixes

- fix(plugin-less): missing `lessOptions` type with TS node16 resolution by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3695

### Other changes

- chore(plugin-less): use Rslib to bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3502

## 1.0.1 (2024-09-10)

### Other changes

- First stable release of `@rsbuild/plugin-less`.
