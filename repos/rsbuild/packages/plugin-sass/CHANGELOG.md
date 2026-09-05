# @rsbuild/plugin-sass

## 2.0.1 (2026-07-02)

### New features

- feat(core): support CSS text import attributes by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8042
- feat(core): support asset text import attributes by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/8046

### Document

- docs: add plugin changelogs by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7970

## 2.0.0 (2026-06-21)

### Breaking changes

- feat(plugin-sass)!: publish as pure ESM by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7956
- feat(plugin-sass)!: drop Rsbuild v1 support by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7958

### Other changes

- chore: add bugs metadata to remaining plugin packages by @killernova in https://github.com/web-infra-dev/rsbuild/pull/7935
- chore(deps): update sass to ^1.101.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/7897
- chore(deps): upgrade reduce-configs catalog to v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7960

## 1.5.3 (2026-05-30)

### Bug fixes

- fix(core): support url query with params by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7572

### Other changes

- chore(deps): update sass to ^1.100.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/7733

## 1.5.2 (2026-04-28)

### New features

- feat(plugin-sass): support Sass URL query by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7554

### Other changes

- chore(deps): update sass to ^1.98.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/7327
- chore(deps): update sass to ^1.99.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/7434

## 1.5.1 (2026-03-11)

### Bug fixes

- fix: mark type-only plugin peers on @rsbuild/core as optional by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7316

## 1.5.0 (2026-01-27)

### New features

- feat(plugin-sass): compatible with Rsbuild v1 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7055

## 1.4.1 (2026-01-15)

### Bug fixes

- fix(plugins): update peerDependencies to support Rsbuild v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6976

### Other changes

- chore(deps): update sass related packages by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5965
- chore(deps): update sass to ^1.92.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/6042
- chore(deps): update sass to ^1.93.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/6209
- chore(deps): update sass to ^1.96.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/6757
- chore(deps): update sass to ^1.97.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/6789

## 1.4.0 (2025-08-26)

### Bug fixes

- fix: enhance raw query regex to support more patterns by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5938
- fix: enhance inline query regex to support more patterns by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5939

### Refactor

- refactor(css-plugins): inherit CSS options from the built-in rule by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5940

## 1.3.5 (2025-08-07)

### Other changes

- chore(deps): update sass to ^1.90.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5779

## 1.3.4 (2025-08-04)

### Performance

- perf: bundle rspack-chain into main JS bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5684

### Other changes

- chore(workflow): enable npm trusted publishing by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5754

## 1.3.3 (2025-07-07)

### Bug fixes

- fix(plugin-sass): unpin sass-embedded and update to v1.89.2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5404
- fix: ensure that raw query of styles can be accurately matched by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5540

## 1.3.2 (2025-06-05)

### Bug fixes

- fix(plugin-sass): pin sass-embedded to 1.89.0 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5360

### Other changes

- chore(deps): update sass to ^1.87.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5072
- chore(deps): update sass to ^1.88.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5219
- chore(deps): update sass to ^1.89.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5262

## 1.3.1 (2025-03-29)

### Bug fixes

- fix: make CSS preprocessor plugins compat with Rsbuild 1.2 by @colinaaa in https://github.com/web-infra-dev/rsbuild/pull/4909
- fix: improve inline rules in CSS preprocessor plugins by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4914

## 1.3.0 (2025-03-28)

### New features

- feat(plugin-sass): add support for raw query by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4843
- feat(plugin-sass): add support for inline query by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4856

### Other changes

- chore(deps): update sass to ^1.86.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4821

## 1.2.2 (2025-02-19)

### Document

- docs: update README files for plugin packages by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4590

### Other changes

- chore(deps): update sass to ^1.85.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4565

## 1.2.1 (2025-02-05)

### Bug fixes

- fix(plugin-sass): allow to disable source map by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4445

## 1.2.0 (2025-01-21)

### New features

- feat(plugin-sass): add `useOriginalUrlResolver` option to disable `resolve-url-loader` by @junhea in https://github.com/web-infra-dev/rsbuild/pull/4389

### Document

- docs(plugin-sass): improve `rewriteUrls` option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4401

### Other changes

- chore(deps): update sass to ^1.83.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4194
- chore(plugin-sass): rename unreleased option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4398

## 1.1.2 (2024-12-07)

### Bug fixes

- fix(plugin-sass): mute import deprecation warning by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4122

### Other changes

- chore(deps): update dependency reduce-configs to ^1.1.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4042
- chore(deps): update dependency sass-embedded to ^1.82.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4138

## 1.1.1 (2024-11-18)

### New features

- feat(plugin-sass): mute deprecation warnings of dependencies by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3998

### Other changes

- chore(deps): update dependency sass-embedded to ^1.81.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3989

## 1.1.0 (2024-10-29)

### New features

- feat(plugin-sass): allow to register multiple times by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3844
- feat(plugin-sass): add `include` option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3845

### Document

- docs(plugin-sass): add note for deprecation warnings by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3840

## 1.0.4 (2024-10-20)

### Other changes

- chore(deps): update dependency sass-embedded to ^1.80.3 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3763

## 1.0.3 (2024-10-14)

### New features

- feat(plugin-sass): use Rslib to bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3703

## 1.0.2 (2024-10-04)

### Bug fixes

- fix(plugin-sass): mute the legacy API deprecation warnings by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3629

### Document

- docs(plugin-sass): add legacy API deprecation tip by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3631

### Other changes

- chore(deps): update dependency sass-embedded to ^1.79.2 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/3504

## 1.0.1 (2024-09-10)

### Other changes

- First stable release of `@rsbuild/plugin-sass`.
