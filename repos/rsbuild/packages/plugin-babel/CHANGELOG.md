# @rsbuild/plugin-babel

## 2.0.1 (2026-07-02)

### Bug fixes

- fix(plugin-babel): skip text import attributes in standalone rule by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8039
- fix(plugin-babel): skip raw query in standalone rule by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8040
- fix(plugin-babel): skip URL dependencies in standalone rule by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8041

### Document

- docs: update React Compiler guides by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8038

## 2.0.0 (2026-06-16)

### Breaking changes

- feat(plugin-babel)!: publish as pure ESM package by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7919
- feat(plugin-babel)!: drop Rsbuild v1 support by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7922

### New features

- feat(plugin-babel): add parallel option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7917

### Document

- docs: update parallel loader docs by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7920

## 1.2.1 (2026-05-30)

- No plugin-specific changes.

## 1.2.0 (2026-05-27)

### New features

- feat(plugin-babel): support multiple babel rules by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7764

### Bug fixes

- fix: remove redundant main fields from package.json files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7338
- fix(plugin-babel): restrict Babel rule ID matching by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7765

## 1.1.2 (2026-03-11)

### Bug fixes

- fix: mark type-only plugin peers on @rsbuild/core as optional by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7316

## 1.1.1 (2026-03-02)

### Bug fixes

- fix(plugin-babel): remove upath dependency by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7269
- fix(plugin-babel): remove deepmerge dependency by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7274

### Other changes

- chore(deps): update babel to ^7.29.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/7108

## 1.1.0 (2026-01-27)

### New features

- feat(plugin-babel): compatible with Rsbuild v1 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7062

### Other changes

- chore(deps): update dependency @babel/plugin-transform-class-properties to ^7.28.6 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/6997

## 1.0.7 (2026-01-15)

### Bug fixes

- fix(plugins): update peerDependencies to support Rsbuild v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6976

### Document

- docs: update download badge links in README files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6762

## 1.0.6 (2025-08-04)

### Performance

- perf: bundle rspack-chain into main JS bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5684

### Document

- docs(plugin-babel): add execution order section by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4995

### Other changes

- chore(deps): update babel to ^7.27.1 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5142
- chore(deps): update babel to ^7.28.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5550
- chore(workflow): enable npm trusted publishing by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5754

## 1.0.5 (2025-04-08)

- No plugin-specific changes.

## 1.0.4 (2025-02-19)

### Document

- docs: update README files for plugin packages by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4590

### Other changes

- chore(deps): update dependency reduce-configs to ^1.1.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4042

## 1.0.3 (2024-10-29)

### Other changes

- chore(deps): update babel to ^7.26.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3833

## 1.0.2 (2024-10-14)

### New features

- feat(plugin-babel): use Rslib to bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3691

### Other changes

- chore(deps): update babel to ^7.25.7 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3634

## 1.0.1 (2024-09-10)

### New features

- feat(plugin-babel): add include and exclude option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/833

### Performance

- perf(plugin-babel): skip schema-utils in babel-loader by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/853
- perf(plugin-babel): enable compile cache to improve rebuild perf by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1621

### Bug fixes

- fix(plugin-babel): lodash breaks the mjs artifact by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/809
- fix(plugin-babel): prebundle babel-loader to fix peer warning by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/831
- fix(plugin-babel): failed to resolve babel-loader by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/842
- fix(plugin-babel): export getDefaultBabelOptions util from index by @gaoyuan in https://github.com/web-infra-dev/rsbuild/pull/1179
- fix(plugin-babel): missing babel loader types by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1620
- fix(plugin-babel): run babel loader before builtin SWC loader by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2485

### Document

- docs(plugin-babel): fix outdated examples by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/799
- docs(plugin-babel): add include and exclude options by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/925
- docs(plugin-babel): compile jsx in node_modules by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2729

### Other changes

- chore(plugin-babel): mark addIncludes as deprecated by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/827
- chore(plugin-babel): export helper to modify loader options by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/924
- chore(deps): update babel to ^7.24.1 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/1883
- chore(deps): update dependency @babel/core to ^7.25.2 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3130
- chore(deps): update dependency @babel/plugin-transform-class-properties to ^7.25.4 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3283

## 1.0.0 (2023-11-22)

### Other changes

- First stable release of `@rsbuild/plugin-babel`.
