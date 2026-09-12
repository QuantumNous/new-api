# @rsbuild/plugin-vue

## 2.0.1 (2026-07-02)

### New features

- feat(plugin-vue): support text import attributes by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8053

## 2.0.0 (2026-06-22)

### Breaking changes

- feat(plugin-vue)!: publish as pure ESM package by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7974
- feat(plugin-vue): drop Rsbuild v1 support by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7975

### Document

- docs(plugin-vue): update loader references in types by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7976

### Other changes

- chore: add bugs metadata to remaining plugin packages by @killernova in https://github.com/web-infra-dev/rsbuild/pull/7935

## 1.2.9 (2026-05-30)

### Document

- docs(plugin-vue): reflect integration with rspack-vue-loader by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7649

## 1.2.8 (2026-05-08)

### Bug fixes

- fix: remove redundant main fields from package.json files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7338
- fix(plugin-vue): align CSS Modules hashes for SSR by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7625

## 1.2.7 (2026-03-11)

### Bug fixes

- fix: mark type-only plugin peers on @rsbuild/core as optional by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7316

## 1.2.6 (2026-02-05)

### Bug fixes

- fix(plugin-vue): remove webpack dependency by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7148

## 1.2.5 (2026-02-02)

### Bug fixes

- fix(plugin-vue): failed to split chunks with Rsbuild v1 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7112

## 1.2.4 (2026-01-30)

### Bug fixes

- fix(plugin-vue): skip chunk splitting for non-web targets by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7091

## 1.2.3 (2026-01-15)

### New features

- feat(plugin-vue): bump rspack-vue-loader to support hot update by @9aoy in https://github.com/web-infra-dev/rsbuild/pull/6956

### Bug fixes

- fix(plugins): update peerDependencies to support Rsbuild v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6976

### Refactor

- refactor(plugin-vue): improve CSS module detection by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6879

## 1.2.2 (2025-12-15)

### Bug fixes

- fix(plugin-vue): treat it as a client build when calling from Rstest by @9aoy in https://github.com/web-infra-dev/rsbuild/pull/6779

### Document

- docs: update download badge links in README files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6762

## 1.2.1 (2025-12-09)

### New features

- feat(plugin-vue): add test option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6729

## 1.2.0 (2025-10-21)

### New features

- feat(plugin-vue): supersede vue-loader with rspack-vue-loader by @Wei in https://github.com/web-infra-dev/rsbuild/pull/6390

## 1.1.2 (2025-08-23)

### Bug fixes

- fix(plugin-vue): allow CSS Modules with custom inject names by @EgorBlinov in https://github.com/web-infra-dev/rsbuild/pull/5931

## 1.1.1 (2025-08-04)

### Other changes

- chore(plugin-vue): remove unused webpack dev deps by @thinkasany in https://github.com/web-infra-dev/rsbuild/pull/5608
- chore(workflow): enable npm trusted publishing by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5754

## 1.1.0 (2025-07-01)

### Bug fixes

- fix(plugin-vue): CSS Modules for SSR build by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5517

## 1.0.7 (2025-03-08)

### Bug fixes

- fix(plugin-vue): order problem with pluginReact by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4713

## 1.0.6 (2025-02-19)

### Document

- docs: update README files for plugin packages by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4590

## 1.0.5 (2024-11-14)

### Bug fixes

- fix(plugin-vue): should transpile all Vue SFC by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3964

## 1.0.4 (2024-11-07)

### Bug fixes

- fix(plugin-vue): allow to override builtin split chunks by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3886

## 1.0.3 (2024-10-29)

- No plugin-specific changes.

## 1.0.2 (2024-10-14)

### New features

- feat(plugin-vue): use Rslib to bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3697

## 1.0.1 (2024-09-10)

### New features

- feat(plugin-vue): apply default split chunk rules by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/851
- feat(plugin-vue): add feature flag for Vue v3.4 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1062
- feat(plugin-vue): support CSS Modules in SFC by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2374
- feat(plugin-vue): support for lang="postcss" by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2422

### Performance

- perf(plugin-vue): bump vue-loader v17.4 to reuse AST by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1061

### Bug fixes

- fix(plugin-vue): failed to split lib-vue chunk in Windows by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/971

### Other changes

- types(plugin-vue): fix SplitChunks typing error by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/966
- chore(deps): update dependency vue to ^3.5.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3367

## 1.0.0 (2023-11-22)

### Other changes

- First stable release of `@rsbuild/plugin-vue`.
