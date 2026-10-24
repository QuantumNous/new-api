# @rsbuild/plugin-solid

## 1.2.2 (2026-06-05)

### Bug fixes

- fix(plugin-solid): downgrade solid-refresh to 0.6.3 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7832

## 1.2.1 (2026-05-30)

- No plugin-specific changes.

## 1.2.0 (2026-05-06)

### New features

- feat(plugin-solid): add solid resolve condition by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7592
- feat(plugin-solid): add hot option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7593
- feat(plugin-solid): add dev option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7595
- feat(plugin-solid): add refresh disabled option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7596
- feat(plugin-solid): add ssr option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7597
- feat(plugin-solid): add solid option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7598

### Bug fixes

- fix: remove redundant main fields from package.json files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7338
- fix(plugin-solid): use rspack esm refresh mode by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7594

## 1.1.1 (2026-03-11)

### Bug fixes

- fix: mark type-only plugin peers on @rsbuild/core as optional by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7316

## 1.1.0 (2026-02-28)

### Other changes

- chore(deps): update dependency solid-refresh to v0.7.6 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/7258

## 1.0.8 (2026-02-19)

### Bug fixes

- fix(plugin-solid): fix missing parameter types by @AndrewAvsenin in https://github.com/web-infra-dev/rsbuild/pull/7202

## 1.0.7 (2026-01-15)

### Bug fixes

- fix(plugins): update peerDependencies to support Rsbuild v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6976

### Document

- docs: update download badge links in README files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6762

## 1.0.6 (2025-08-04)

### Other changes

- chore(workflow): enable npm trusted publishing by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5754

## 1.0.5 (2025-02-19)

### Document

- docs: update README files for plugin packages by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4590

## 1.0.4 (2024-10-29)

- No plugin-specific changes.

## 1.0.3 (2024-10-14)

### New features

- feat(plugin-solid): use Rslib to bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3693

## 1.0.2 (2024-09-29)

### Other changes

- chore(deps): update dependency babel-preset-solid to ^1.9.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3552

## 1.0.1 (2024-09-10)

### New features

- feat(plugin-solid): support solid-js HMR by @inottn in https://github.com/web-infra-dev/rsbuild/pull/740

### Bug fixes

- fix(plugin-solid): delegateEvents should be optional by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/950
- fix(plugin-solid): lock solid-refresh to fix runtime error by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1567
- fix(plugin-solid): downgrade solid-refresh to v0.6.3 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1966
- fix(plugin-solid): only enable solid-refresh when target is web by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2069
- fix(plugin-solid): remove `@babel/preset-typescript` for resolve the babel warning by @zhylmzr in https://github.com/web-infra-dev/rsbuild/pull/2842

### Other changes

- chore(deps): update dependency solid-refresh to ^0.7.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/1468

## 1.0.0 (2023-11-22)

### Other changes

- First stable release of `@rsbuild/plugin-solid`.
