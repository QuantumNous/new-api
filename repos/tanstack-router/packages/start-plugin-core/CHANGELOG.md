# @tanstack/start-plugin-core

## 1.171.20

### Patch Changes

- Updated dependencies [[`e2dd204`](https://github.com/TanStack/router/commit/e2dd2049cb42eb219d3b447b8605066d19d9c1fa)]:
  - @tanstack/router-core@1.171.15
  - @tanstack/router-generator@1.167.19
  - @tanstack/router-plugin@1.168.20
  - @tanstack/start-server-core@1.169.17

## 1.171.19

### Patch Changes

- Updated dependencies [[`9809a06`](https://github.com/TanStack/router/commit/9809a0619d4ed3fe8c2a393af5b9eca4b6c7695b)]:
  - @tanstack/router-core@1.171.14
  - @tanstack/router-generator@1.167.18
  - @tanstack/router-plugin@1.168.19
  - @tanstack/start-server-core@1.169.16

## 1.171.18

### Patch Changes

- [#7372](https://github.com/TanStack/router/pull/7372) [`e499164`](https://github.com/TanStack/router/commit/e499164c722841271af4aa2215483476bdb94c94) - Fix Rsbuild preview support for TanStack Start SSR. Preview always installs the SSR middleware; the `installDevServerMiddleware` option only applies to dev.

- Updated dependencies [[`96eca43`](https://github.com/TanStack/router/commit/96eca43ab8ee21917a8075521bef6dcf15fc7a43)]:
  - @tanstack/start-server-core@1.169.15
  - @tanstack/router-generator@1.167.17

## 1.171.17

### Patch Changes

- [#7566](https://github.com/TanStack/router/pull/7566) [`9bebf8d`](https://github.com/TanStack/router/commit/9bebf8dc9f2bf74b680c065a5aa63d03b9622825) - Add `validator()` as the canonical server function and middleware validator method. Deprecate `inputValidator()` and emit compiler warnings for remaining uses.

- Updated dependencies []:
  - @tanstack/start-server-core@1.169.14

## 1.171.16

### Patch Changes

- Updated dependencies [[`776d8ef`](https://github.com/TanStack/router/commit/776d8ef283e5bd9ffe97d43bc3a7f58064cd7e03)]:
  - @tanstack/router-core@1.171.13
  - @tanstack/router-generator@1.167.17
  - @tanstack/router-plugin@1.168.18
  - @tanstack/start-server-core@1.169.13

## 1.171.15

### Patch Changes

- Updated dependencies [[`df1076c`](https://github.com/TanStack/router/commit/df1076c03ae5a51ab384bebd4d6afda20fb6f107), [`837897f`](https://github.com/TanStack/router/commit/837897f0733b836dd63880546eec4c20cf06be59)]:
  - @tanstack/router-core@1.171.12
  - @tanstack/router-plugin@1.168.17
  - @tanstack/router-generator@1.167.16
  - @tanstack/start-server-core@1.169.12

## 1.171.14

### Patch Changes

- Updated dependencies [[`ac10815`](https://github.com/TanStack/router/commit/ac10815f387d25b15163ff711b4049e8f8482d01)]:
  - @tanstack/router-core@1.171.11
  - @tanstack/router-generator@1.167.15
  - @tanstack/router-plugin@1.168.16
  - @tanstack/start-server-core@1.169.11

## 1.171.13

### Patch Changes

- [#7552](https://github.com/TanStack/router/pull/7552) [`301f6ba`](https://github.com/TanStack/router/commit/301f6ba4599386edd6fb3b8423938c48eedb501f) - Fix Start compiler handling for TS-wrapped server/env-only function calls and safely remove unused imported server function handlers from client output.

- Updated dependencies [[`301f6ba`](https://github.com/TanStack/router/commit/301f6ba4599386edd6fb3b8423938c48eedb501f), [`2cca73c`](https://github.com/TanStack/router/commit/2cca73c92262ffd96dac4e283c9f69fb37f4b43a), [`7a83e67`](https://github.com/TanStack/router/commit/7a83e67e6596fbef21cb0a88a7127f5935bed2ba), [`76b3d3b`](https://github.com/TanStack/router/commit/76b3d3b24522bd3d1d216674c441252c9b8f184c)]:
  - @tanstack/router-utils@1.162.2
  - @tanstack/router-core@1.171.10
  - @tanstack/router-generator@1.167.14
  - @tanstack/router-plugin@1.168.15
  - @tanstack/start-server-core@1.169.10

## 1.171.12

### Patch Changes

- [#7540](https://github.com/TanStack/router/pull/7540) [`8091918`](https://github.com/TanStack/router/commit/80919186cbdd0deb948b46fe328881a14a08f414) - Fix Rsbuild RSC builds so client directives in packages under `node_modules` are compiled and detected correctly.

## 1.171.11

### Patch Changes

- Updated dependencies [[`b4cd5af`](https://github.com/TanStack/router/commit/b4cd5af8d0f9d4aaa2d29095e6a261b9181bc778)]:
  - @tanstack/router-core@1.171.9
  - @tanstack/router-generator@1.167.13
  - @tanstack/router-plugin@1.168.14
  - @tanstack/start-client-core@1.170.7
  - @tanstack/start-server-core@1.169.9

## 1.171.10

### Patch Changes

- [#7509](https://github.com/TanStack/router/pull/7509) [`9cb7a00`](https://github.com/TanStack/router/commit/9cb7a003e6e5fa3706711870c7b10a5266356e3b) - feat(rsbuild): add RSC support

- Updated dependencies [[`9cb7a00`](https://github.com/TanStack/router/commit/9cb7a003e6e5fa3706711870c7b10a5266356e3b)]:
  - @tanstack/start-server-core@1.169.8

## 1.171.9

### Patch Changes

- Updated dependencies [[`2f53749`](https://github.com/TanStack/router/commit/2f5374945e2138559a51464f45a5152eae67e1dd)]:
  - @tanstack/router-core@1.171.8
  - @tanstack/router-generator@1.167.12
  - @tanstack/router-plugin@1.168.13
  - @tanstack/start-client-core@1.170.6
  - @tanstack/start-server-core@1.169.7

## 1.171.8

### Patch Changes

- Updated dependencies [[`d1997b6`](https://github.com/TanStack/router/commit/d1997b66d7c24c1d64772bb8bab5caf9c6d9cc48)]:
  - @tanstack/start-server-core@1.169.6
  - @tanstack/router-core@1.171.7
  - @tanstack/router-generator@1.167.11
  - @tanstack/router-plugin@1.168.12
  - @tanstack/start-client-core@1.170.5

## 1.171.7

### Patch Changes

- [#7501](https://github.com/TanStack/router/pull/7501) [`9c09bca`](https://github.com/TanStack/router/commit/9c09bca59e9613e9a6fd9b7149b0737898e705d6) - fix(start): emit client entry scripts from the root route manifest. When `scriptFormat: 'iife'` and the entry chunk has static-import siblings (e.g. an extracted runtime via `optimization.runtimeChunk: 'single'`), the manifest now includes those async siblings before the async client entry in root route scripts, fixing hydration for IIFE bundles with extracted runtimes.

- Updated dependencies [[`9c09bca`](https://github.com/TanStack/router/commit/9c09bca59e9613e9a6fd9b7149b0737898e705d6)]:
  - @tanstack/start-server-core@1.169.5

## 1.171.6

### Patch Changes

- Fix serialization adapter module resolution in TanStack Start. Vite dev now uses clean runtime-specific virtual module IDs instead of browser requests containing encoded null-byte virtual IDs, which avoids reverse proxy failures. When no serialization adapters are configured, Vite and Rsbuild now resolve `#tanstack-start-plugin-adapters` through the package empty-adapter fallback. ([#7484](https://github.com/TanStack/router/pull/7484))

- Publish matching TanStack Start dev server packages so fresh installs do not pair a Start plugin that no longer provides `tanstack-start-injected-head-scripts:v` with an older Start server runtime that still imports it. ([#7487](https://github.com/TanStack/router/pull/7487))

- Updated dependencies [[`a82cec6`](https://github.com/TanStack/router/commit/a82cec69474c366b36efdb3f43c4efe8311c485a), [`d8be4f8`](https://github.com/TanStack/router/commit/d8be4f8adf912128c96b7f83e9a6c49fb24b5eed)]:
  - @tanstack/start-client-core@1.170.4
  - @tanstack/start-server-core@1.169.4

## 1.171.5

### Patch Changes

- Add Vite bundled dev mode support for TanStack Start. Start now recognizes Vite's `experimental.bundledDev` opt-in, uses the bundled dev client entry in the dev manifest, keeps server requests pointed at the latest client build output, and preserves import-protection behavior for bundled client dev. ([#7482](https://github.com/TanStack/router/pull/7482))

## 1.171.4

### Patch Changes

- Add support for Rsbuild client output formats, including module output by default and IIFE output for classic script environments. ([#7477](https://github.com/TanStack/router/pull/7477))

  Client entry scripts and preloads are now represented as root route manifest assets, script preloads follow the manifest script format, and script asset cross-origin configuration uses the `script` key. The `transformAssets` script callback context now exposes only `kind: 'script'` and `url`, keeping script format handling internal to manifest rendering.

- Fix Rsbuild server function metadata replay when Rspack restores modules from its persistent cache. ([#7477](https://github.com/TanStack/router/pull/7477))

  Server function metadata is now stored on Rspack module build info and replayed from cached modules before resolver modules are rebuilt, preventing warm restarts from losing server function registrations.

- Updated dependencies [[`51a97a1`](https://github.com/TanStack/router/commit/51a97a167fb3ef1b8ca70fbb63db635158f43509)]:
  - @tanstack/router-core@1.171.6
  - @tanstack/start-server-core@1.169.3
  - @tanstack/router-generator@1.167.10
  - @tanstack/router-plugin@1.168.11
  - @tanstack/start-client-core@1.170.3

## 1.171.3

### Patch Changes

- Updated dependencies [[`5268ba4`](https://github.com/TanStack/router/commit/5268ba4566233ea58880df85f167ad0401a93a46)]:
  - @tanstack/router-core@1.171.5
  - @tanstack/router-generator@1.167.9
  - @tanstack/router-plugin@1.168.10
  - @tanstack/start-client-core@1.170.2
  - @tanstack/start-server-core@1.169.2

## 1.171.2

### Patch Changes

- Updated dependencies [[`7df0d02`](https://github.com/TanStack/router/commit/7df0d02bfb1407b1f07731ef69af24e2f0e415d7)]:
  - @tanstack/router-generator@1.167.8
  - @tanstack/router-plugin@1.168.9

## 1.171.1

### Patch Changes

- Updated dependencies [[`0300f87`](https://github.com/TanStack/router/commit/0300f87ec5a7f878ffbe0b181acf84cba9139960), [`0300f87`](https://github.com/TanStack/router/commit/0300f87ec5a7f878ffbe0b181acf84cba9139960)]:
  - @tanstack/router-core@1.171.4
  - @tanstack/router-generator@1.167.7
  - @tanstack/router-plugin@1.168.8
  - @tanstack/start-client-core@1.170.1
  - @tanstack/start-server-core@1.169.1

## 1.171.0

### Minor Changes

- Add deferred Hydrate boundary support for TanStack Start. ([#7362](https://github.com/TanStack/router/pull/7362))

  Hydrate boundaries can now be code-split by the Start compiler, preload their generated client chunks, preserve server-rendered fallback HTML, and replay interaction-triggered events after hydration. The compiler integration now uses a Start-owned compiler plugin for Hydrate virtual modules across Vite and Rsbuild, with dev invalidation for generated virtual modules.

  Shared AST utilities used by the router code-splitter and Hydrate virtual modules were moved into `@tanstack/router-utils` so both pipelines can retain referenced top-level declarations, unwrap local exports, and let dead-code elimination remove unused route module code.

### Patch Changes

- Updated dependencies [[`c0f439c`](https://github.com/TanStack/router/commit/c0f439c59b04b7e49a0ab3aa2a0c550f522949e5), [`5fa9e55`](https://github.com/TanStack/router/commit/5fa9e555f3a2edb5e45586623e6bcbfa7f7c7a6b)]:
  - @tanstack/router-plugin@1.168.7
  - @tanstack/start-client-core@1.170.0
  - @tanstack/start-server-core@1.169.0
  - @tanstack/router-core@1.171.3
  - @tanstack/router-utils@1.162.1
  - @tanstack/router-generator@1.167.6

## 1.170.6

### Patch Changes

- Updated dependencies [[`b60eb36`](https://github.com/TanStack/router/commit/b60eb36e59e8a468ee0742cbcf7f47aca1ff1c67)]:
  - @tanstack/router-core@1.171.2
  - @tanstack/router-generator@1.167.5
  - @tanstack/router-plugin@1.168.6
  - @tanstack/start-client-core@1.169.4
  - @tanstack/start-server-core@1.168.4

## 1.170.5

### Patch Changes

- Updated dependencies [[`8146db7`](https://github.com/TanStack/router/commit/8146db7e54f5d508f1fb7d3927edd0a2f71dc930)]:
  - @tanstack/router-plugin@1.168.5

## 1.170.4

### Patch Changes

- Updated dependencies [[`d9cf933`](https://github.com/TanStack/router/commit/d9cf9331b83fcbd2abfee75d839d862f9bb18e6b)]:
  - @tanstack/router-core@1.171.1
  - @tanstack/router-generator@1.167.4
  - @tanstack/router-plugin@1.168.4
  - @tanstack/start-client-core@1.169.3
  - @tanstack/start-server-core@1.168.3

## 1.170.3

### Patch Changes

- Updated dependencies [[`d533f87`](https://github.com/TanStack/router/commit/d533f87976704098a40b48f160b37c28c8182806)]:
  - @tanstack/router-core@1.171.0
  - @tanstack/router-generator@1.167.3
  - @tanstack/router-plugin@1.168.3
  - @tanstack/start-client-core@1.169.2
  - @tanstack/start-server-core@1.168.2

## 1.170.2

### Patch Changes

- Updated dependencies [[`742941e`](https://github.com/TanStack/router/commit/742941e2f1bf069c950d0a4985b2cd733639509e)]:
  - @tanstack/router-generator@1.167.2
  - @tanstack/router-plugin@1.168.2

## 1.170.1

### Patch Changes

- Add runtime-configurable inline CSS and opt-in CSS URL templates for transformAssets. ([#7380](https://github.com/TanStack/router/pull/7380))

- Updated dependencies [[`2387a2e`](https://github.com/TanStack/router/commit/2387a2eea0683004cc400b9f71bed5944eb60110)]:
  - @tanstack/router-core@1.170.1
  - @tanstack/start-server-core@1.168.1
  - @tanstack/router-generator@1.167.1
  - @tanstack/router-plugin@1.168.1
  - @tanstack/start-client-core@1.169.1

## 1.170.0

### Minor Changes

- Clean minor bump, fresh start ([#7395](https://github.com/TanStack/router/pull/7395))

### Patch Changes

- add createCsrfMiddleware based on Sec-Fetch-Site header, auto-apply to unconfigured servers, warn for others ([#7373](https://github.com/TanStack/router/pull/7373))

- Updated dependencies [[`b1c061a`](https://github.com/TanStack/router/commit/b1c061aff9185cdf5fdc08c0136382a9dce0302f), [`038cd12`](https://github.com/TanStack/router/commit/038cd123b70bc6154d75abb6404a744c376f8f6a), [`201e150`](https://github.com/TanStack/router/commit/201e150bd1412bae2faa9ce53f0fefcb7574ac14), [`5ae2ae5`](https://github.com/TanStack/router/commit/5ae2ae5e0f8ce32e02667a482ea9be52a6150240)]:
  - @tanstack/router-core@1.170.0
  - @tanstack/router-generator@1.167.0
  - @tanstack/router-plugin@1.168.0
  - @tanstack/router-utils@1.162.0
  - @tanstack/start-client-core@1.169.0
  - @tanstack/start-server-core@1.168.0

## 1.169.20

### Patch Changes

- Updated dependencies [[`c5811aa`](https://github.com/TanStack/router/commit/c5811aacb59b69a8179f14cd9529a51b2206d504)]:
  - @tanstack/router-generator@1.166.42
  - @tanstack/router-plugin@1.167.35

## 1.169.19

### Patch Changes

- Update seroval dependencies to version 1.5.4. ([#7340](https://github.com/TanStack/router/pull/7340))

- Updated dependencies [[`35e88f0`](https://github.com/TanStack/router/commit/35e88f04996d71019a1868b7b06ecb4ddbc9df9e)]:
  - @tanstack/router-core@1.169.2
  - @tanstack/start-client-core@1.168.2
  - @tanstack/start-server-core@1.167.30
  - @tanstack/router-generator@1.166.41
  - @tanstack/router-plugin@1.167.34

## 1.169.18

### Patch Changes

- Parse plain TypeScript files without JSX when a filename is available, preventing angle-bracket type assertions from being interpreted as JSX during route and Start import-protection transforms. ([#7342](https://github.com/TanStack/router/pull/7342))

- Updated dependencies [[`056337e`](https://github.com/TanStack/router/commit/056337ef02ccbeaf45ec8533a227761be869e8f3)]:
  - @tanstack/router-generator@1.166.40
  - @tanstack/router-plugin@1.167.33
  - @tanstack/router-utils@1.161.8

## 1.169.17

### Patch Changes

- Updated dependencies [[`afa40ef`](https://github.com/TanStack/router/commit/afa40ef46c273c53646ba33f607fc618a07ffede)]:
  - @tanstack/start-server-core@1.167.29

## 1.169.16

### Patch Changes

- Updated dependencies [[`709627f`](https://github.com/TanStack/router/commit/709627f3dbc6d97daa547a1401ef42a53bc4be32)]:
  - @tanstack/start-server-core@1.167.28

## 1.169.15

### Patch Changes

- Updated dependencies [[`238ea4a`](https://github.com/TanStack/router/commit/238ea4a4998ab3a7fd528b317e1935766ac65df8)]:
  - @tanstack/start-server-core@1.167.27

## 1.169.14

### Patch Changes

- Replace global route metadata with explicit router plugin contexts so multiple router plugin instances cannot cross-transform route files. ([#7313](https://github.com/TanStack/router/pull/7313))

- Updated dependencies [[`96818b8`](https://github.com/TanStack/router/commit/96818b8ba5ead6f1f027094841330182aff415b2)]:
  - @tanstack/router-plugin@1.167.32

## 1.169.13

### Patch Changes

- Add compiler-driven RSC CSS auto-injection for Start RSC render APIs and wire it into the React Start Vite and Rsbuild adapters. This ensures same-file CSS module dependencies are discovered for `renderServerComponent`, `createCompositeComponent`, and JSX-based `renderToReadableStream` calls. ([#7310](https://github.com/TanStack/router/pull/7310))

  Also add a configurable server function provider module directive hook used by the React Rsbuild RSC adapter to emit `"use server-entry"` only for extracted provider files.

## 1.169.12

### Patch Changes

- Updated dependencies [[`4a1e63f`](https://github.com/TanStack/router/commit/4a1e63f1d1230b1ed8234609acad4639d8982c13)]:
  - @tanstack/router-core@1.169.1
  - @tanstack/router-generator@1.166.39
  - @tanstack/router-plugin@1.167.31
  - @tanstack/start-client-core@1.168.1
  - @tanstack/start-server-core@1.167.26

## 1.169.11

### Patch Changes

- Updated dependencies [[`82b0613`](https://github.com/TanStack/router/commit/82b06132af776f74603ab27977cc277d6219a845)]:
  - @tanstack/start-client-core@1.168.0
  - @tanstack/start-server-core@1.167.25

## 1.169.10

### Patch Changes

- Ignore fully type-only imports and re-exports when collecting import-protection sources so type-only references to protected modules do not trigger violations. ([#7305](https://github.com/TanStack/router/pull/7305))

## 1.169.9

### Patch Changes

- Sort server function manifest entries by ID before emitting the resolver module. The `serverFnsById` map is populated in source-file scan order, which varies across machines and incremental builds, producing non-deterministic key ordering in the emitted `__tanstack-start-server-fn-resolver-*.mjs` artifact. Stable alphabetic sorting ensures reproducible builds, consistent content hashes, and clean `git diff` on committed artifacts. ([#7287](https://github.com/TanStack/router/pull/7287))

## 1.169.8

### Patch Changes

- Updated dependencies [[`c992495`](https://github.com/TanStack/router/commit/c992495bf4010ff4c3597bb1f3b1ba02594e857e)]:
  - @tanstack/router-core@1.169.0
  - @tanstack/router-generator@1.166.38
  - @tanstack/router-plugin@1.167.30
  - @tanstack/start-client-core@1.167.22
  - @tanstack/start-server-core@1.167.24

## 1.169.7

### Patch Changes

- Updated dependencies [[`b5c4183`](https://github.com/TanStack/router/commit/b5c4183ab8b44be8a75647b7f7b588ad7c146ece)]:
  - @tanstack/router-core@1.168.18
  - @tanstack/router-generator@1.166.37
  - @tanstack/router-plugin@1.167.29
  - @tanstack/start-client-core@1.167.21
  - @tanstack/start-server-core@1.167.23

## 1.169.6

### Patch Changes

- Updated dependencies [[`493148b`](https://github.com/TanStack/router/commit/493148bc5378b7f9de1544d87f6aaa425c12eb34)]:
  - @tanstack/router-core@1.168.17
  - @tanstack/router-generator@1.166.36
  - @tanstack/router-plugin@1.167.28
  - @tanstack/start-client-core@1.167.20
  - @tanstack/start-server-core@1.167.22

## 1.169.5

### Patch Changes

- Updated dependencies [[`a2ad394`](https://github.com/TanStack/router/commit/a2ad394598e2079ab4050ebb16bb03b31d69c32a)]:
  - @tanstack/router-generator@1.166.35
  - @tanstack/router-plugin@1.167.27

## 1.169.4

### Patch Changes

- Updated dependencies [[`8b97002`](https://github.com/TanStack/router/commit/8b97002af3f6d15204e60c55d3f5735b78bd7efe), [`8b97002`](https://github.com/TanStack/router/commit/8b97002af3f6d15204e60c55d3f5735b78bd7efe)]:
  - @tanstack/start-client-core@1.167.19
  - @tanstack/router-plugin@1.167.26
  - @tanstack/start-server-core@1.167.21

## 1.169.3

### Patch Changes

- Updated dependencies [[`1e371b6`](https://github.com/TanStack/router/commit/1e371b60f1832c158ff4953a4ae6c5ccfe8460b3)]:
  - @tanstack/router-plugin@1.167.25

## 1.169.2

### Patch Changes

- Add TanStack Start inline CSS manifest support for SSR so route styles can be embedded in the HTML response and hydrated without duplicate stylesheet links. ([#7253](https://github.com/TanStack/router/pull/7253))

- Updated dependencies [[`4d864ee`](https://github.com/TanStack/router/commit/4d864eebbd184265eabb563d326ab409c93feb17)]:
  - @tanstack/router-core@1.168.16
  - @tanstack/start-server-core@1.167.20
  - @tanstack/router-generator@1.166.34
  - @tanstack/router-plugin@1.167.24
  - @tanstack/start-client-core@1.167.18

## 1.169.1

### Patch Changes

- Fix CSS asset ordering so styles from imported chunks are emitted before route chunk styles. ([#7251](https://github.com/TanStack/router/pull/7251))

## 1.169.0

### Minor Changes

- Split Start plugin core bundler APIs into explicit Vite and Rsbuild subpaths so projects only need the bundler they use. Mark both `vite` and `@rsbuild/core` peers as optional where Start exposes both integrations. ([#7249](https://github.com/TanStack/router/pull/7249))

## 1.168.0

### Minor Changes

- rsbuild ([#7228](https://github.com/TanStack/router/pull/7228))

### Patch Changes

- Updated dependencies [[`91a7089`](https://github.com/TanStack/router/commit/91a708989d00537a21911e74ff60bbfec8266295)]:
  - @tanstack/router-plugin@1.167.23
  - @tanstack/router-utils@1.161.7
  - @tanstack/router-generator@1.166.33

## 1.167.35

### Patch Changes

- Fix missing CSS module assets in TanStack Start production manifests when Vite `build.cssCodeSplit` is disabled. ([#7191](https://github.com/TanStack/router/pull/7191))

## 1.167.34

### Patch Changes

- Updated dependencies [[`16f6892`](https://github.com/TanStack/router/commit/16f6892d6b7ceadf606677c5a40e743f29163aa6)]:
  - @tanstack/router-core@1.168.15
  - @tanstack/router-generator@1.166.32
  - @tanstack/router-plugin@1.167.22
  - @tanstack/start-client-core@1.167.17
  - @tanstack/start-server-core@1.167.19

## 1.167.33

### Patch Changes

- Fix Start virtual module resolution in pnpm workspaces by serving the client entry through a real Vite virtual module. ([#7178](https://github.com/TanStack/router/pull/7178))

  Simplify Start virtual module handling by sharing a single `createVirtualModule` helper and collapsing internal `@tanstack/start-plugin-core` imports to the root export surface.

## 1.167.32

### Patch Changes

- Updated dependencies [[`328d7e5`](https://github.com/TanStack/router/commit/328d7e5ebc6b8074242a07d68ccafafb83e37a0e)]:
  - @tanstack/router-generator@1.166.31
  - @tanstack/router-plugin@1.167.21

## 1.167.31

### Patch Changes

- Updated dependencies [[`96ac2d8`](https://github.com/TanStack/router/commit/96ac2d8ed378340d63b88afeec3633e56e29b5f8)]:
  - @tanstack/router-plugin@1.167.20

## 1.167.30

### Patch Changes

- Updated dependencies [[`105d056`](https://github.com/TanStack/router/commit/105d05691a247779a63e7b688aa1207cce619339)]:
  - @tanstack/router-generator@1.166.30
  - @tanstack/router-plugin@1.167.19

## 1.167.29

### Patch Changes

- Updated dependencies [[`656a2a0`](https://github.com/TanStack/router/commit/656a2a040e79df7721d776e3751c8d634666570b)]:
  - @tanstack/router-plugin@1.167.18

## 1.167.28

### Patch Changes

- Updated dependencies [[`0e2c900`](https://github.com/TanStack/router/commit/0e2c9003c18ae07c09969189c028f277ea562a7a)]:
  - @tanstack/start-server-core@1.167.18
  - @tanstack/router-core@1.168.14
  - @tanstack/router-generator@1.166.29
  - @tanstack/router-plugin@1.167.17
  - @tanstack/start-client-core@1.167.16

## 1.167.27

### Patch Changes

- Reduce React Start SSR manifest payload size by omitting unmatched route assets from dehydrated router state while keeping start-manifest asset serialization deduplicated by shared object identity. ([#7157](https://github.com/TanStack/router/pull/7157))

  This improves SSR HTML size for apps with many routes that share the same CSS assets and adds regression coverage for CSS module hydration, navigation, and start-manifest asset reuse.

- Updated dependencies [[`812792f`](https://github.com/TanStack/router/commit/812792fbda3caf97b300770855cf5641252f413b)]:
  - @tanstack/router-core@1.168.13
  - @tanstack/start-server-core@1.167.17
  - @tanstack/router-generator@1.166.28
  - @tanstack/router-plugin@1.167.16
  - @tanstack/start-client-core@1.167.15

## 1.167.26

### Patch Changes

- Updated dependencies [[`8ec9ca9`](https://github.com/TanStack/router/commit/8ec9ca97b472779de878c2a6510f21deb24d386c)]:
  - @tanstack/router-core@1.168.12
  - @tanstack/router-generator@1.166.27
  - @tanstack/router-plugin@1.167.15
  - @tanstack/start-client-core@1.167.14
  - @tanstack/start-server-core@1.167.16

## 1.167.25

### Patch Changes

- Reuse previously discovered server function IDs across compiler instances so custom `generateFunctionId` values stay stable when duplicate IDs are deduplicated during build. ([#7153](https://github.com/TanStack/router/pull/7153))

  This fixes cases where different build environments could assign different deduped IDs to the same server functions, which could cause requests to resolve to the wrong handler.

## 1.167.24

### Patch Changes

- Updated dependencies [[`6355bb7`](https://github.com/TanStack/router/commit/6355bb75f7637ba77f06a923c18fdaf37720bb48)]:
  - @tanstack/start-server-core@1.167.15
  - @tanstack/router-plugin@1.167.14
  - @tanstack/router-core@1.168.11
  - @tanstack/router-generator@1.166.26
  - @tanstack/start-client-core@1.167.13

## 1.167.23

### Patch Changes

- Updated dependencies [[`459057c`](https://github.com/TanStack/router/commit/459057cd2d90cff20d20e51d4964b0a8c950555e)]:
  - @tanstack/start-client-core@1.167.12
  - @tanstack/start-server-core@1.167.14
  - @tanstack/router-plugin@1.167.13
  - @tanstack/router-core@1.168.10
  - @tanstack/router-generator@1.166.25

## 1.167.22

### Patch Changes

- Updated dependencies [[`f8ac427`](https://github.com/TanStack/router/commit/f8ac427000c3fec99225926e72f9f2fc7a37231f)]:
  - @tanstack/start-server-core@1.167.13
  - @tanstack/start-client-core@1.167.11

## 1.167.21

### Patch Changes

- fix publishing ([`2d53c05`](https://github.com/TanStack/router/commit/2d53c056ef0b203de8a28bc92c24e8e604205d52))

- Updated dependencies [[`2d53c05`](https://github.com/TanStack/router/commit/2d53c056ef0b203de8a28bc92c24e8e604205d52)]:
  - @tanstack/start-server-core@1.167.12

## 1.167.19

### Patch Changes

- Republish the React Start RSC package chain so fresh installs resolve a `start-plugin-core` build that exports the subpaths used by `react-start-rsc`. ([`3384abc`](https://github.com/TanStack/router/commit/3384abcffd98a68eb254b11221834bcbcdebec31))

## 1.167.18

### Patch Changes

- Updated dependencies [[`f7e9c5e`](https://github.com/TanStack/router/commit/f7e9c5e323793d1b28c96871819c265fd28ae397)]:
  - @tanstack/start-client-core@1.167.10
  - @tanstack/start-server-core@1.167.10

## 1.167.17

### Patch Changes

- Updated dependencies [[`796406d`](https://github.com/TanStack/router/commit/796406da66cfb12b518bb3ca326c9d541368fb06)]:
  - @tanstack/router-core@1.168.9
  - @tanstack/router-generator@1.166.24
  - @tanstack/router-plugin@1.167.12
  - @tanstack/start-client-core@1.167.9
  - @tanstack/start-server-core@1.167.9

## 1.167.16

### Patch Changes

- Updated dependencies [[`2d1ec86`](https://github.com/TanStack/router/commit/2d1ec865a446926f7db6e29dbbde82d265de6d36)]:
  - @tanstack/router-core@1.168.8
  - @tanstack/router-generator@1.166.23
  - @tanstack/router-plugin@1.167.11
  - @tanstack/start-client-core@1.167.8
  - @tanstack/start-server-core@1.167.8

## 1.167.15

### Patch Changes

- Updated dependencies [[`f8351a8`](https://github.com/TanStack/router/commit/f8351a8d7aa9f5a341377f96966451892acb39f1)]:
  - @tanstack/router-plugin@1.167.10

## 1.167.14

### Patch Changes

- Updated dependencies [[`6ee0e79`](https://github.com/TanStack/router/commit/6ee0e795b085651beb2f1ac6503cdbd7eaffedd1)]:
  - @tanstack/router-core@1.168.7
  - @tanstack/router-generator@1.166.22
  - @tanstack/router-plugin@1.167.9
  - @tanstack/start-client-core@1.167.7
  - @tanstack/start-server-core@1.167.7

## 1.167.13

### Patch Changes

- Updated dependencies [[`42c3f3b`](https://github.com/TanStack/router/commit/42c3f3b3a3a478fd6d6894310ef94b2d23794b8e)]:
  - @tanstack/router-core@1.168.6
  - @tanstack/router-generator@1.166.21
  - @tanstack/router-plugin@1.167.8
  - @tanstack/start-client-core@1.167.6
  - @tanstack/start-server-core@1.167.6

## 1.167.12

### Patch Changes

- Updated dependencies [[`70b2225`](https://github.com/TanStack/router/commit/70b222513720d99c6d44bd3f28d1e9b19dc91a43)]:
  - @tanstack/router-generator@1.166.20
  - @tanstack/router-plugin@1.167.7

## 1.167.11

### Patch Changes

- Updated dependencies [[`cf5f554`](https://github.com/TanStack/router/commit/cf5f5542476137a81515099ad740747e84512f9a)]:
  - @tanstack/router-core@1.168.5
  - @tanstack/router-generator@1.166.19
  - @tanstack/router-plugin@1.167.6
  - @tanstack/start-client-core@1.167.5
  - @tanstack/start-server-core@1.167.5

## 1.167.10

### Patch Changes

- Updated dependencies [[`71a8b68`](https://github.com/TanStack/router/commit/71a8b684c87c37fd4a033d99f5ba4a05c7a179f5)]:
  - @tanstack/router-core@1.168.4
  - @tanstack/router-generator@1.166.18
  - @tanstack/router-plugin@1.167.5
  - @tanstack/start-client-core@1.167.4
  - @tanstack/start-server-core@1.167.4

## 1.167.9

### Patch Changes

- Deduplicate CSS assets in the Start manifest so shared stylesheets are not repeated within a route entry or across an active parent-child route chain. ([#7030](https://github.com/TanStack/router/pull/7030))

## 1.167.8

### Patch Changes

- feat: transformAssets ([#7023](https://github.com/TanStack/router/pull/7023))

- Updated dependencies [[`d81d21a`](https://github.com/TanStack/router/commit/d81d21ad05c9401bf54b24acd29401e1e4fd624c)]:
  - @tanstack/router-core@1.168.3
  - @tanstack/start-server-core@1.167.3
  - @tanstack/router-generator@1.166.17
  - @tanstack/router-plugin@1.167.4
  - @tanstack/start-client-core@1.167.3

## 1.167.7

### Patch Changes

- fix: streaming in vite preview ([#6828](https://github.com/TanStack/router/pull/6828))

## 1.167.6

### Patch Changes

- Updated dependencies [[`c9e1855`](https://github.com/TanStack/router/commit/c9e18555f3a5531e96de8f574cfca9edcdb18e5c)]:
  - @tanstack/start-client-core@1.167.2
  - @tanstack/start-server-core@1.167.2
  - @tanstack/router-core@1.168.2
  - @tanstack/router-generator@1.166.16
  - @tanstack/router-plugin@1.167.3

## 1.167.5

### Patch Changes

- Updated dependencies [[`9351e99`](https://github.com/TanStack/router/commit/9351e997962d02ecc3f6f1791edd84e64361d27b)]:
  - @tanstack/router-plugin@1.167.2

## 1.167.4

### Patch Changes

- Updated dependencies [[`91cc628`](https://github.com/TanStack/router/commit/91cc62899b75ca920fe83c5ee7f3dbb5c71a523f)]:
  - @tanstack/router-core@1.168.1
  - @tanstack/router-generator@1.166.15
  - @tanstack/router-plugin@1.167.1
  - @tanstack/start-client-core@1.167.1
  - @tanstack/start-server-core@1.167.1

## 1.167.3

### Patch Changes

- Updated dependencies [[`0545239`](https://github.com/TanStack/router/commit/054523900b2ee19308e5a88417dadfc6923afe30)]:
  - @tanstack/start-client-core@1.167.0
  - @tanstack/start-server-core@1.167.0
  - @tanstack/router-plugin@1.167.0
  - @tanstack/router-core@1.168.0
  - @tanstack/router-generator@1.166.14

## 1.167.2

### Patch Changes

- fix(start-plugin-core): fix Vite 7/8 compat for bundler options ([#6985](https://github.com/TanStack/router/pull/6985))

## 1.167.1

### Patch Changes

- Updated dependencies [[`5ff4f0b`](https://github.com/TanStack/router/commit/5ff4f0b8dce1fac2bb0b0bfe2684fc677a8ee505)]:
  - @tanstack/router-core@1.167.5
  - @tanstack/router-generator@1.166.13
  - @tanstack/router-plugin@1.166.14
  - @tanstack/start-client-core@1.166.13
  - @tanstack/start-server-core@1.166.13

## 1.167.0

### Minor Changes

- Support both Vite 7 (`rollupOptions`) and Vite 8 (`rolldownOptions`) by detecting the Vite version at runtime ([#6955](https://github.com/TanStack/router/pull/6955))

## 1.166.15

### Patch Changes

- fix: write static server function cache to correct output directory when using Nitro ([#6940](https://github.com/TanStack/router/pull/6940))

  `TSS_CLIENT_OUTPUT_DIR` was baked in via Vite's `define` at config time, before Nitro's `configEnvironment` hook changed the client `build.outDir`. This caused `staticServerFnCache` files to be written to `dist/client/` instead of the Nitro-managed `.output/public/` directory.

  Now `TSS_CLIENT_OUTPUT_DIR` is set as a runtime environment variable during prerendering using the resolved client output directory, so it correctly reflects any output directory changes made by deployment adapters like Nitro.

- Updated dependencies [[`940151c`](https://github.com/TanStack/router/commit/940151cbed0c76c92a5cf196c0905b17a956ca7e)]:
  - @tanstack/router-core@1.167.4
  - @tanstack/router-plugin@1.166.13
  - @tanstack/start-client-core@1.166.12
  - @tanstack/start-server-core@1.166.12
  - @tanstack/router-generator@1.166.12

## 1.166.14

### Patch Changes

- Updated dependencies [[`32fcba7`](https://github.com/TanStack/router/commit/32fcba7b044b03f5901308b870f70b0b4910c220)]:
  - @tanstack/router-core@1.167.3
  - @tanstack/router-generator@1.166.11
  - @tanstack/router-plugin@1.166.12
  - @tanstack/start-client-core@1.166.11
  - @tanstack/start-server-core@1.166.11

## 1.166.13

### Patch Changes

- build: update to vite-config 5.x (rolldown) ([#6926](https://github.com/TanStack/router/pull/6926))

- Updated dependencies [[`838b0eb`](https://github.com/TanStack/router/commit/838b0eb9a8bbbb987a0a6972c1446e01423bbd7b)]:
  - @tanstack/router-core@1.167.2
  - @tanstack/router-generator@1.166.10
  - @tanstack/router-plugin@1.166.11
  - @tanstack/router-utils@1.161.6
  - @tanstack/start-client-core@1.166.10
  - @tanstack/start-server-core@1.166.10

## 1.166.12

### Patch Changes

- fix: build with @tanstack/vite-config 0.4.3 ([#6923](https://github.com/TanStack/router/pull/6923))

- Updated dependencies [[`ef9b241`](https://github.com/TanStack/router/commit/ef9b241f3cfe95cee40daa96da669f0ffd4a971a)]:
  - @tanstack/start-client-core@1.166.9
  - @tanstack/start-server-core@1.166.9
  - @tanstack/router-generator@1.166.9
  - @tanstack/router-plugin@1.166.10
  - @tanstack/router-utils@1.161.5
  - @tanstack/router-core@1.167.1

## 1.166.11

### Patch Changes

- fix: add `xmlns:xhtml` to generated sitemap ([#6920](https://github.com/TanStack/router/pull/6920))

## 1.166.10

### Patch Changes

- Updated dependencies [[`6f297a2`](https://github.com/TanStack/router/commit/6f297a249424c0fd1c1a56aa4fc12c8217be7b6a)]:
  - @tanstack/router-core@1.167.0
  - @tanstack/router-generator@1.166.8
  - @tanstack/router-plugin@1.166.9
  - @tanstack/start-client-core@1.166.8
  - @tanstack/start-server-core@1.166.8

## 1.166.9

### Patch Changes

- Updated dependencies [[`6069eba`](https://github.com/TanStack/router/commit/6069eba64369dbddb0d8dccdb4407f0e1a82259e)]:
  - @tanstack/router-plugin@1.166.8
  - @tanstack/router-generator@1.166.7

## 1.166.8

### Patch Changes

- fix: keep CSS when referenced both statically and dynamically ([#6891](https://github.com/TanStack/router/pull/6891))
