# @rsbuild/plugin-react

## 2.1.0 (2026-06-18)

### New features

- feat(plugin-react): add reactCompiler option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7938

### Bug fixes

- fix(plugin-react): check reactCompiler rspack version by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7940

### Document

- docs(plugin-react): document reactCompiler option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7944

## 2.0.1 (2026-05-30)

- No plugin-specific changes.

## 2.0.0 (2026-04-22)

### Breaking changes

- feat(plugin-react)!: drop Rsbuild v1 support by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7458
- feat(plugin-react)!: publish as pure ESM package by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7461

### Bug fixes

- fix: remove redundant main fields from package.json files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7338

### Refactor

- refactor(plugin-react): inline react setup into index by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7462

### Other changes

- chore(plugin-react): upgrade @rspack/plugin-react-refresh to v2.0.0 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7456

## 1.4.6 (2026-03-11)

### Bug fixes

- fix: mark type-only plugin peers on @rsbuild/core as optional by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7316

## 1.4.5 (2026-02-02)

### Bug fixes

- fix(plugin-react): failed to split chunks with Rsbuild v1 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7109

## 1.4.4 (2026-01-30)

### Bug fixes

- fix(plugin-react): skip chunk splitting for non-web targets by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/7090

## 1.4.3 (2026-01-15)

### Bug fixes

- fix(plugins): update peerDependencies to support Rsbuild v2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6976

### Document

- docs: update download badge links in README files by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6762

### Other changes

- chore(deps): update dependency @rspack/plugin-react-refresh to ^1.6.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/6938

## 1.4.2 (2025-11-06)

### New features

- feat(plugin-react): enhance splitChunks option to support boolean type by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6515

### Document

- docs(plugin-react): add 'preserve' option to JSX runtime by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/6244

## 1.4.1 (2025-09-24)

### New features

- feat(plugin-react): complete `preserve` React runtime by @Wei in https://github.com/web-infra-dev/rsbuild/pull/6240

## 1.4.0 (2025-08-28)

### New features

- feat(plugin-react): improve transpilation scope of ReactRefreshPlugin by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5969

### Other changes

- chore(plugin-react): update @rspack/plugin-react-refresh to ^1.5.0 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5968

## 1.3.5 (2025-08-04)

### Other changes

- chore(workflow): enable npm trusted publishing by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5754

## 1.3.4 (2025-07-07)

- No plugin-specific changes.

## 1.3.3 (2025-07-03)

### Bug fixes

- fix(plugin-react): profiling not work with React 19 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5524

## 1.3.2 (2025-06-04)

### Bug fixes

- fix(plugin-react): skip React Refresh injection for raw JS content by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5354

## 1.3.1 (2025-05-07)

### Other changes

- chore(deps): update @rspack/plugin-react-refresh to 1.4.2 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/5185

## 1.3.0 (2025-04-23)

### Other changes

- chore(deps): update dependency @rspack/plugin-react-refresh to ~1.4.1 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/5076

## 1.2.0 (2025-04-08)

### Other changes

- chore(deps): update dependency @rspack/plugin-react-refresh to ~1.1.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4951
- chore(deps): update dependency @rspack/plugin-react-refresh to ~1.2.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4984

## 1.1.1 (2025-02-19)

### Document

- docs: update README files for plugin packages by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/4590

## 1.1.0 (2024-12-07)

### Other changes

- chore(deps): update dependency react-refresh to ^0.16.0 by @renovate in https://github.com/web-infra-dev/rsbuild/pull/4134

## 1.0.7 (2024-11-07)

### Bug fixes

- fix(plugin-react): allow to override builtin split chunks by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3887

## 1.0.6 (2024-10-29)

- No plugin-specific changes.

## 1.0.5 (2024-10-17)

### New features

- feat(plugin-react): allow to disable fast refresh by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3738

## 1.0.4 (2024-10-14)

### New features

- feat(plugin-react): use Rslib to bundle by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3704

## 1.0.3 (2024-09-29)

### Bug fixes

- fix(plugin-react): exclude node_modules from react-refresh plugin by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3575

## 1.0.2 (2024-09-13)

### Bug fixes

- fix(plugin-react): allow configuring `tools.swc` to override react runtime by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/3449

## 1.0.1 (2024-09-10)

### New features

- feat(plugin-react): allow to enable/disable chunk splitting by @Timeless0911 in https://github.com/web-infra-dev/rsbuild/pull/746
- feat(plugin-react): add jsxRuntime option to support React 16 by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1189
- feat(plugin-react): add jsxImportSource option by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1190
- feat(plugin-react): allow to configure all SWC react options by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1191
- feat(plugin-react): enable support for profiling React in prod env by @DennisMartinCual in https://github.com/web-infra-dev/rsbuild/pull/2143
- feat(plugin-react): support for configuring react refresh plugin by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2190

### Performance

- perf(plugin-react): use prebundled semver by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/991
- perf(plugin-react): reduce deps and fix peer dep warning by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/830
- perf(plugin-react): reduce deepmerge overhead by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/1481

### Bug fixes

- fix(plugin-react): split react-refresh utils to lib-react chunk by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/850
- fix(plugin-react): should get the new targets from context by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/890
- fix(plugin-react): no chunk group of react if federation enabled by @ZackJackson in https://github.com/web-infra-dev/rsbuild/pull/1942

### Document

- docs(plugin-react): translate enableProfiler to Chinese by @chenjiahan in https://github.com/web-infra-dev/rsbuild/pull/2157

## 1.0.0 (2023-11-22)

### Other changes

- First stable release of `@rsbuild/plugin-react`.
